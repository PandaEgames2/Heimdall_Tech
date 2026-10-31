# Guía de arranque en 5 minutos

Esta guía deja Heimdall Tech funcionando en Windows con MySQL, backend Django y frontend React. La primera instalación puede tardar más de cinco minutos porque descarga dependencias y, en la primera captura LPR, modelos de IA.

> Para el contexto completo de arquitectura, RBAC, cupos y diseño, consulta el [README principal](README.md) y [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Antes de empezar

- Windows 10/11 de 64 bits y PowerShell.
- Python **3.12** de 64 bits.
- Node.js **20.19+** o **22.12+** (incluye npm).
- MySQL Server **8+** activo. La cuenta debe poder crear la base en una instalación nueva.
- Git para clonar el repositorio (opcional si ya tienes la carpeta).
- Internet para dependencias y para la primera descarga de modelos FastALPR.

Comprueba las versiones:

```powershell
py -3.12 --version
node --version
npm --version
```

## 1. Obtener el código y preparar Python

```powershell
git clone https://github.com/PandaEgames2/Heimdall_Tech.git
cd Heimdall_Tech
py -3.12 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

## 2. Configurar la conexión MySQL

```powershell
Copy-Item backend\.env.example backend\.env
```

Edita `backend\.env` y ajusta al menos:

```env
DJANGO_SECRET_KEY=una-clave-larga-y-aleatoria
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=heimdall_tech
DB_USER=root
DB_PASSWORD=tu_contraseña_de_mysql
DB_HOST=127.0.0.1
DB_PORT=3306
```

Genera la clave con:

```powershell
backend\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

No subas `backend\.env` ni `frontend\.env` a GitHub.

## 3. Crear la base y cargar el seed demo

En una base **nueva o desechable**, desde `backend`:

```powershell
cd backend
.\.venv\Scripts\python.exe bootstrap_db.py --check
.\.venv\Scripts\python.exe bootstrap_db.py --execute
.\.venv\Scripts\python.exe bootstrap_db.py --check-schema
cd ..
```

`--execute` importa `Heimdall_Tech.sql` y **elimina/crea** las tablas funcionales. No lo uses sobre una base con datos que quieras conservar.

El SQL carga **más de 160 filas demo**: 3 planes, 4 establecimientos, 5 roles base, recursos RBAC, 20 usuarios, responsables, vehículos, movimientos, reconocimientos, invitaciones e incidencias. Los cupos de plan quedan en **170 / 400 / 900** con política `COBRO`.

Si ya tienes una base Heimdall con datos, no ejecutes el SQL: salta al paso 5 y deja que `iniciar.ps1` aplique los cambios idempotentes.

## 4. Instalar el frontend

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
cd ..
```

Con `VITE_API_URL` vacío, el navegador usa el mismo host en el puerto `8000`. Para un backend remoto o fijo, edita `frontend\.env`:

```env
VITE_API_URL=http://localhost:8000/api
```

## 5. Arrancar con `iniciar.ps1`

Con MySQL activo, desde la raíz del proyecto:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\iniciar.ps1
```

Si PowerShell bloquea el archivo:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

El script:

1. Prepara o reutiliza `backend\.venv`.
2. Copia `backend\.env` y `frontend\.env` desde los ejemplos si faltan.
3. Verifica MySQL y las tablas base.
4. Ejecuta `migrate`.
5. Sincroniza RBAC, cuentas demo, esquema operativo y cupos por plan.
6. Ejecuta `manage.py check`.
7. Inicia la API en `8000` y el frontend en `5173` (o el siguiente puerto libre hasta `5180`).

Abre:

- Landing: <http://localhost:5173/>
- Login: <http://localhost:5173/login>
- Panel: <http://localhost:5173/panel>
- API: <http://localhost:8000/api/>
- Salud: <http://localhost:8000/api/health/>

El script no importa el SQL ni reinicia tus datos. Si FastALPR no está disponible, muestra un aviso y el resto del sistema funciona sin LPR.

## 6. Entrar con cuentas demo

Todas usan la contraseña **`Heimdall#2026`**:

| Rol | Usuario |
|---|---|
| Super Admin | `admin` o `admin@heimdall.tech` |
| Super Admin alternativo | `rastor36` o `rastor36@heimdall.tech` |
| Administrador de Los Pinos | `admin@pinos.com` |
| Vigilantes de Los Pinos | `vigilante@pinos.com`, `vigilante2@pinos.com` |
| Residente de Los Pinos | `residente@pinos.com` |
| Administrador de Norte | `admin@norte.com` |
| Vigilante de Norte | `vigilante@norte.com` |
| Administrador de Uniguajira | `admin@uniguajira.edu.co` |
| Vigilante de Uniguajira | `porteria@uniguajira.edu.co` |
| Supervisor de Uniguajira | `supervision@uniguajira.edu.co` |
| Administrador Logístico | `admin@logistico.com` |
| Vigilante Logístico | `porteria@logistico.com` |

Para verlas durante el arranque:

```powershell
$env:HEIMDALL_SHOW_DEMO_CREDENTIALS=1
.\iniciar.ps1
```

Para cambiar la contraseña demo:

```powershell
$env:HEIMDALL_DEMO_PASSWORD="OtraClaveSegura#2026"
```

Si una base antigua falla al iniciar sesión:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py ensure_demo_accounts --reset-passwords
```

## 7. Verificar cupos y contextos

### Planes y cupos

| Plan | Precio base | Residentes incluidos | Excedente | Política seed |
|---|---:|---:|---:|---|
| Básico | $49.99 | 170 | $0.75 / persona / mes | `COBRO` |
| Medio | $129.99 | 400 | $0.50 / persona / mes | `COBRO` |
| Avanzado | $299.99 | 900 | $0.35 / persona / mes | `COBRO` |

El cupo cuenta usuarios **activos con rol Residente** del establecimiento, incluidos los que lo tienen como rol secundario. No cuenta vigilantes, supervisores ni administradores.

- `COBRO`: permite el alta y estima el cobro extra mensual.
- `BLOQUEO`: rechaza el alta y exige un upgrade.

La validación real está en el backend (`app_empresas/quotas.py` y `UsuarioSerializer`); el banner de **Catálogo** solo muestra el estado.

### Tipos de establecimiento

| Tipo | Invitaciones de residentes |
|---|---|
| `RESIDENCIAL` | Habilitadas por defecto. |
| `GUBERNAMENTAL` | Deshabilitadas por defecto; solo administración invita. |
| `EMPRESA_ALTA_SEGURIDAD` | Deshabilitadas por defecto; solo administración invita. |

En un contexto estricto, el residente/empleado no ve el formulario de invitación y la API responde `403`. El Super Admin puede habilitar la bandera desde el formulario de establecimiento o crear la invitación como administrador.

Los establecimientos demo quedaron así:

- **Los Pinos:** residencial, invitaciones habilitadas.
- **Edificio Empresarial Norte:** alta seguridad, invitaciones deshabilitadas.
- **Universidad de La Guajira:** gobierno, invitaciones deshabilitadas.
- **Centro Logístico Manaure:** alta seguridad, invitaciones deshabilitadas.

## 8. Comandos útiles

```powershell
# Backend
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py ensure_rbac_schema
.\.venv\Scripts\python.exe manage.py ensure_operational_schema
.\.venv\Scripts\python.exe manage.py ensure_plan_quota_schema

# Frontend
cd frontend
npm run lint
npm run build
```

## 9. Si algo falla

- **`No module named django`:** usa `backend\.venv\Scripts\python.exe`, no el Python global.
- **Error de MySQL:** revisa servicio, puerto y credenciales en `backend\.env`; ejecuta `bootstrap_db.py --check`.
- **`Failed to fetch`:** confirma que `http://localhost:8000/api/` responde y que frontend/backend están activos.
- **Faltan tablas base:** en una base nueva importa el SQL con `--execute`. En una base con datos, no lo hagas: ejecuta los comandos `ensure_*` y haz copia de seguridad.
- **Cámara bloqueada:** usa `localhost` o HTTPS; para QR puedes usar el código manual de 6 dígitos.
- **El cupo bloquea un alta:** cambia a un plan superior o ajusta la política a `COBRO`.
- **Un residente no ve invitaciones:** el establecimiento es estricto o la bandera está apagada; la administración debe autorizarlo.

El inicio completo, la arquitectura y la solución de problemas detallada están en el [README principal](README.md) y en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
