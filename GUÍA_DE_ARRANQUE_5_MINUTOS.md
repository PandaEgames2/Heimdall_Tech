# Guía rápida para instalar Heimdall Tech

Esta guía resume el primer arranque en una PC Windows. La primera instalación puede tardar más de cinco minutos porque descarga dependencias.

## Antes de empezar

- Windows 10/11 de 64 bits y PowerShell.
- Python 3.12 de 64 bits (versión de referencia para el proyecto).
- Node.js 20.19+ o 22.12+ (incluye npm).
- MySQL Server 8+ instalado y activo, con una cuenta que pueda crear base de datos y tablas.
- Git para clonar el repo (opcional si recibiste una copia del código).
- Internet para descargar paquetes y, en la primera prueba LPR, los modelos de IA.

## 1. Obtener el código

```powershell
git clone https://github.com/PandaEgames2/Heimdall_Tech.git
cd Heimdall_Tech
```

Si ya tienes la carpeta, abre PowerShell en ella. Comprueba versiones con `py -3.12 --version`, `node --version` y `npm --version`.

En VS Code, abre la carpeta raíz del proyecto y usa **Terminal → Nueva terminal** para trabajar desde PowerShell sin salir del editor.

## 2. Preparar Python y las dependencias del backend

Desde la raíz del proyecto:

```powershell
py -3.12 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Edita `backend\.env` y ajusta `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` y `DB_NAME` para la instancia MySQL de esa PC. No subas `backend\.env` a GitHub. Si `mysqlclient` intenta compilarse y no encuentra dependencias, sigue la nota oficial de [instalación de mysqlclient en Windows](https://github.com/PyMySQL/mysqlclient/blob/main/README.md#install).

## 3. Crear el esquema inicial

En una base nueva, desde la carpeta `backend`:

```powershell
cd backend
.\.venv\Scripts\python.exe bootstrap_db.py --check
.\.venv\Scripts\python.exe bootstrap_db.py --execute
cd ..
```

`--execute` importa `Heimdall_Tech.sql`, que elimina y crea tablas funcionales: úsalo solo para una base nueva o desechable. No lo ejecutes sobre datos que quieras conservar. La cuenta de MySQL debe tener permiso `CREATE DATABASE`.

## 4. Instalar dependencias del frontend

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
cd ..
```

`VITE_API_URL` puede quedar vacía para que el navegador use el backend en el mismo host, puerto `8000`.

## 5. Arrancar

Con MySQL activo y `backend\.env` configurado, ejecuta desde la raíz:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\iniciar.ps1
```

Si el archivo sigue bloqueado, usa `powershell -ExecutionPolicy Bypass -File .\iniciar.ps1`.

El script comprueba MySQL, aplica migraciones internas de Django, asegura las cuentas demo y el esquema operativo, ejecuta `manage.py check` e inicia los dos servidores. No importa el SQL destructivo.

Abre la landing en <http://localhost:5173/>, inicia sesión en <http://localhost:5173/login> y entra al panel en <http://localhost:5173/panel>. API: <http://localhost:8000/api/>. Estado: <http://localhost:8000/api/health/>.

## Cuentas de demostración

Todas las cuentas demo comparten la contraseña `Heimdall#2026`.

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

Las contraseñas solo se muestran con `$env:HEIMDALL_SHOW_DEMO_CREDENTIALS=1` antes de iniciar. Cambia la contraseña demo con `HEIMDALL_DEMO_PASSWORD` si lo necesitas. Si una base antigua falla al iniciar sesión, ejecuta `python manage.py ensure_demo_accounts --reset-passwords` para reparar los hashes y migrarlos a scrypt.

## Si algo falla

- `Failed to fetch`: confirma que `http://localhost:8000/api/` responde y que frontend/backend están activos.
- Error de MySQL: revisa servicio, puerto y credenciales en `backend\.env`.
- Cámara bloqueada: usa `localhost` o HTTPS y concede el permiso del navegador; en QR se puede usar el código escrito.
- El inicio completo, la configuración detallada y la guía móvil están en el [README principal](README.md) y [USO_MOVIL.md](USO_MOVIL.md).
