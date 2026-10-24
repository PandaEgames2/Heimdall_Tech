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
git clone <URL_DEL_REPOSITORIO>
cd Heimdall_Tech
```

Si ya tienes la carpeta, abre PowerShell en ella. Comprueba versiones con `py -3.12 --version`, `node --version` y `npm --version`.

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
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

El script comprueba MySQL, aplica migraciones internas de Django, asegura las cuentas demo y el esquema operativo, ejecuta `manage.py check` e inicia los dos servidores. No importa el SQL destructivo.

Abre <http://localhost:5173/>. API: <http://localhost:8000/api/>. Estado: <http://localhost:8000/api/health/>.

## Cuentas de demostración

| Rol | Usuario | Contraseña |
|---|---|---|
| Super Admin | `admin` | `miacarola` |
| Super Admin alternativo | `rastor36` | `miacarola` |
| Vigilante | `vigilante@pinos.com` | `hash_pass_123` |
| Residente | `residente@pinos.com` | `hash_pass_123` |

## Si algo falla

- `Failed to fetch`: confirma que `http://localhost:8000/api/` responde y que frontend/backend están activos.
- Error de MySQL: revisa servicio, puerto y credenciales en `backend\.env`.
- Cámara bloqueada: usa `localhost` o HTTPS y concede el permiso del navegador; en QR se puede usar el código escrito.
- El inicio completo, la configuración detallada y la guía móvil están en el [README principal](README.md) y [USO_MOVIL.md](USO_MOVIL.md).
