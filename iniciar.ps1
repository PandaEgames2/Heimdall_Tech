# Heimdall Tech — requiere MySQL activo; inicia backend + frontend
# Uso en VS Code (PowerShell, desde la raíz del proyecto): .\iniciar.ps1
# Requiere: MySQL en ejecución, Python 3.12+, Node.js 20.19+ o 22.12+

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$VenvDir = Join-Path $Backend ".venv"
$VenvPython = Join-Path $Backend ".venv\Scripts\python.exe"
$Python = $null

Write-Host "== Heimdall Tech: preparando entorno ==" -ForegroundColor Cyan

if (Test-Path $VenvPython) {
    try {
        $null = & $VenvPython -c "import django, rest_framework, mysql.connector" 2>$null
        if ($LASTEXITCODE -eq 0) { $Python = $VenvPython }
    } catch {
        # A moved virtual environment may contain a launcher pointing to an old Python path.
        $Python = $null
    }
}

if (-not $Python) {
    $PythonLauncher = Get-Command py -ErrorAction SilentlyContinue
    $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($PythonLauncher) {
        Write-Host "Preparando entorno virtual con Python 3.12..."
        & $PythonLauncher.Source -3.12 -m venv $VenvDir
        if ($LASTEXITCODE -eq 0) { $Python = $VenvPython }
    } elseif ($PythonCommand) {
        Write-Host "Preparando entorno virtual con Python..."
        & $PythonCommand.Source -m venv $VenvDir
        if ($LASTEXITCODE -eq 0) { $Python = $VenvPython }
    }

    if ($Python) {
        & $Python -m pip install --upgrade pip
        if ($LASTEXITCODE -ne 0) { exit 1 }
        & $Python -m pip install -r (Join-Path $Backend "requirements.txt")
        if ($LASTEXITCODE -ne 0) { exit 1 }
    } else {
        # Codex's bundled Python can run this existing local checkout when its
        # venv was moved together with the project. Normal clones use Python above.
        $CodexPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
        $VenvPackages = Join-Path $VenvDir "Lib\site-packages"
        $LocalAlprPackages = Join-Path $Backend ".alpr_runtime"
        if ((Test-Path $CodexPython) -and (Test-Path $VenvPackages)) {
            $PythonPaths = @($VenvPackages)
            if (Test-Path $LocalAlprPackages) { $PythonPaths = $PythonPaths + @($LocalAlprPackages) }
            $env:PYTHONPATH = [string]::Join([IO.Path]::PathSeparator, $PythonPaths)
            $Python = $CodexPython
            $null = & $Python -c "import django, rest_framework, mysql.connector" 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-Host "ERROR: Faltan dependencias de Python. Instala Python 3.12 y vuelve a iniciar." -ForegroundColor Red
                exit 1
            }
            Write-Host "Usando el entorno Python local disponible para esta máquina." -ForegroundColor Yellow
        } else {
            Write-Host "ERROR: Instala Python 3.12+ y vuelve a iniciar el proyecto." -ForegroundColor Red
            exit 1
        }
    }
}

$BackendEnv = Join-Path $Backend ".env"
$BackendEnvExample = Join-Path $Backend ".env.example"
if (-not (Test-Path -LiteralPath $BackendEnv)) {
    Copy-Item -LiteralPath $BackendEnvExample -Destination $BackendEnv
    Write-Host "Se creó backend\.env. Revisa DB_PASSWORD si MySQL falla." -ForegroundColor Yellow
}

Write-Host "Verificando conexión a MySQL (no se reiniciarán los datos)..."
& $Python (Join-Path $Backend "bootstrap_db.py") --check
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: No se pudo conectar a MySQL. Verifica que esté activo y revisa backend\.env." -ForegroundColor Red
    exit 1
}

Write-Host "Verificando tablas base de Heimdall..."
& $Python (Join-Path $Backend "bootstrap_db.py") --check-schema
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: La base no tiene el esquema de Heimdall. En una instalación nueva ejecuta una sola vez:" -ForegroundColor Red
    Write-Host "       python backend\bootstrap_db.py --execute" -ForegroundColor Red
    Write-Host "       Si la base ya tenía datos, no ejecutes ese comando: revisa el mensaje anterior." -ForegroundColor Red
    exit 1
}

Write-Host "Preparando tablas internas de Django..."
& $Python (Join-Path $Backend "manage.py") migrate --noinput
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Sincronizando esquema RBAC de 5 tablas..."
& $Python (Join-Path $Backend "manage.py") ensure_rbac_schema
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Sincronizando cuentas demo..."
if ($env:HEIMDALL_SHOW_DEMO_CREDENTIALS -eq "1") {
    & $Python (Join-Path $Backend "manage.py") ensure_demo_accounts --show-credentials
} else {
    & $Python (Join-Path $Backend "manage.py") ensure_demo_accounts
}
if ($LASTEXITCODE -ne 0) { exit 1 }

& $Python (Join-Path $Backend "manage.py") ensure_operational_schema
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "Sincronizando cupos por plan y restricciones de invitación..."
& $Python (Join-Path $Backend "manage.py") ensure_plan_quota_schema
if ($LASTEXITCODE -ne 0) { exit 1 }

& $Python (Join-Path $Backend "manage.py") check
if ($LASTEXITCODE -ne 0) { exit 1 }

$AlprReady = $false
try {
    $null = & $Python -c "import fast_alpr, cv2, numpy, onnxruntime" 2>$null
    if ($LASTEXITCODE -eq 0) { $AlprReady = $true }
} catch { }
if (-not $AlprReady) {
    Write-Host "AVISO: FastALPR no está disponible en el Python seleccionado." -ForegroundColor Yellow
    Write-Host "       El reconocimiento de placas quedará deshabilitado; el resto del sistema funciona con normalidad." -ForegroundColor Yellow
    Write-Host "       Instala las dependencias con: $Python -m pip install -r backend\requirements.txt" -ForegroundColor Yellow
    Write-Host "       La primera inferencia necesita Internet para descargar los modelos DNN/OCR." -ForegroundColor Yellow
}

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
$NpmCommand = Get-Command npm -ErrorAction SilentlyContinue
if (-not $NodeCommand -or -not $NpmCommand) {
    Write-Host "ERROR: Instala Node.js 20.19+ o 22.12+ (incluye npm) y vuelve a iniciar." -ForegroundColor Red
    exit 1
}
$NodeVersionText = (& $NodeCommand.Source --version).Trim().TrimStart('v')
try { $NodeVersion = [version]$NodeVersionText } catch { $NodeVersion = [version]"0.0" }
$NodeSupported = ($NodeVersion.Major -eq 20 -and $NodeVersion -ge [version]"20.19") -or `
    ($NodeVersion.Major -ge 22 -and $NodeVersion -ge [version]"22.12")
if (-not $NodeSupported) {
    Write-Host "ERROR: Node.js $NodeVersionText no es compatible. Instala Node.js 20.19+ o 22.12+." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    $NpmInstallArgs = @("install")
    if (Test-Path (Join-Path $Frontend "package-lock.json")) {
        $NpmInstallArgs = @("ci")
    }
    Write-Host "Instalando dependencias del frontend con npm $($NpmInstallArgs[0])..."
    Push-Location $Frontend
    & $NpmCommand.Source @NpmInstallArgs
    $NpmExitCode = $LASTEXITCODE
    Pop-Location
    if ($NpmExitCode -ne 0) { exit 1 }
}

$ViteCommand = Join-Path $Frontend "node_modules\.bin\vite.cmd"
if (-not (Test-Path $ViteCommand)) {
    Write-Host "ERROR: No se encontró Vite. Ejecuta npm ci dentro de frontend." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $Frontend ".env"))) {
    Copy-Item (Join-Path $Frontend ".env.example") (Join-Path $Frontend ".env")
}

Write-Host "Iniciando backend y buscando el frontend actual..." -ForegroundColor Green
$BackendOut = Join-Path $Backend "runserver.stdout.log"
$BackendErr = Join-Path $Backend "runserver.stderr.log"
$FrontendOut = Join-Path $Frontend "vite.stdout.log"
$FrontendErr = Join-Path $Frontend "vite.stderr.log"

$ApiReady = $false
try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health/" -TimeoutSec 2 -UseBasicParsing
    $ApiReady = $true
} catch { }

if (-not $ApiReady) {
    Start-Process -FilePath $Python -ArgumentList @("manage.py", "runserver", "0.0.0.0:8000", "--noreload") `
        -WorkingDirectory $Backend -WindowStyle Hidden -RedirectStandardOutput $BackendOut -RedirectStandardError $BackendErr
    for ($attempt = 0; $attempt -lt 20 -and -not $ApiReady; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            $null = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health/" -TimeoutSec 2 -UseBasicParsing
            $ApiReady = $true
        } catch { }
    }
}

if (-not $ApiReady) {
    Write-Host "ERROR: El backend no respondió en http://127.0.0.1:8000/api/. Revisa backend\runserver.stderr.log." -ForegroundColor Red
    if (Test-Path $BackendErr) { Get-Content $BackendErr -Tail 20 }
    exit 1
}

function Find-HeimdallFrontendPort {
    for ($port = 5173; $port -le 5180; $port++) {
        try {
            $page = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -TimeoutSec 1 -UseBasicParsing
            if (-not $page.Content.Contains('id="root"')) { continue }
            $source = Invoke-WebRequest -Uri "http://127.0.0.1:$port/src/App.jsx" -TimeoutSec 2 -UseBasicParsing
            if ($source.Content.Contains("UserManagement") -and $source.Content.Contains("Sidebar")) {
                return $port
            }
        } catch { }
    }
    return $null
}

$FrontendPort = Find-HeimdallFrontendPort
$FrontendReady = $null -ne $FrontendPort

if (-not $FrontendReady) {
    Start-Process powershell -WindowStyle Hidden -RedirectStandardOutput $FrontendOut -RedirectStandardError $FrontendErr -ArgumentList @(
        "-NoProfile", "-Command", "Set-Location '$Frontend'; & '$ViteCommand' --host 0.0.0.0 --port 5173"
    )
    for ($attempt = 0; $attempt -lt 20 -and -not $FrontendReady; $attempt++) {
        Start-Sleep -Seconds 1
        $FrontendPort = Find-HeimdallFrontendPort
        $FrontendReady = $null -ne $FrontendPort
    }
}

if (-not $FrontendReady) {
    Write-Host "ERROR: No se encontró Heimdall Tech en los puertos 5173–5180. Revisa frontend\vite.stderr.log." -ForegroundColor Red
    if (Test-Path $FrontendErr) { Get-Content $FrontendErr -Tail 20 }
    exit 1
}

Write-Host ""
Write-Host "Listo:" -ForegroundColor Green
Write-Host "  API:      http://127.0.0.1:8000/api/"
Write-Host "  Frontend: http://localhost:$FrontendPort/"
Write-Host "  Credenciales: define HEIMDALL_SHOW_DEMO_CREDENTIALS=1 antes de iniciar si necesitas verlas."
Write-Host "  Móvil (misma Wi-Fi): http://<IP-de-tu-PC>:$FrontendPort/ — ver USO_MOVIL.md"
