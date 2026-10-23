# Guía de arranque en 5 minutos

Esta guía sirve para otra persona que clone el repositorio y quiera levantar el proyecto sin errores en una máquina local.

## 1) Requisitos

- Python 3.12+
- MySQL 8+
- Node.js 18+
- npm
- Git
- PowerShell o terminal de Windows

> Si PowerShell bloquea scripts, ejecuta esto antes de cualquier comando:
>
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

## 2) Clonar el proyecto

```powershell
git clone <url-del-repositorio>
cd Heimdall_Tech
```

## 3) Base de datos local

### Crear base en MySQL

```sql
CREATE DATABASE heimdall_tech CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

### Importar el esquema

```powershell
mysql -u root -p heimdall_tech < Heimdall_Tech.sql
```

Si prefieres hacerlo dentro de MySQL Workbench, abre `Heimdall_Tech.sql` y ejecuta el script completo.

## 4) Backend Django

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Crea el archivo `.env` dentro de `backend/`:

```powershell
copy .env.example .env
```

Ajusta por tus credenciales locales:

```env
DJANGO_SECRET_KEY=change-me-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=heimdall_tech
DB_USER=root
DB_PASSWORD=tu_password
DB_HOST=127.0.0.1
DB_PORT=3306
```

Validar backend:

```powershell
python manage.py check
```

Levantar backend:

```powershell
python manage.py runserver 0.0.0.0:8000
```

La API estará en:

```text
http://127.0.0.1:8000/api/
```

## 5) Frontend React

En otra terminal:

```powershell
cd frontend
npm install
copy .env.example .env
```

Archivo `.env` del frontend:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

Levantar frontend:

```powershell
npm run dev -- --host 0.0.0.0
```

La app estará en:

```text
http://127.0.0.1:5173/
```

## 6) Credenciales de prueba

Usuario de prueba del backend:

```json
{
  "username": "admin@pinos.com",
  "password": "hash_pass_123"
}
```

## 7) Verificación rápida

- Backend: `http://127.0.0.1:8000/api/health/`
- Login: `http://127.0.0.1:8000/api/identidad/auth/login/`
- Frontend: `http://127.0.0.1:5173/`

## 8) Importante

- El proyecto está pensado para entorno local y no depende de servicios en la nube.
- El backend usa MySQL local.
- El frontend se conecta al backend por `VITE_API_URL`.
- Si falla la conexión, revisa:
  - MySQL está activo
  - la base `heimdall_tech` existe
  - `.env` del backend tiene credenciales correctas
  - `.env` del frontend apunta a la API correcta
