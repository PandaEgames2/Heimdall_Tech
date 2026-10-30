# Heimdall Tech — enlaces rápidos

## Servicios locales

- Frontend: <http://localhost:5173/>
- API: <http://localhost:8000/api/>
- Salud de API/base de datos: <http://localhost:8000/api/health/>
- Inicio de sesión (POST): <http://localhost:8000/api/identidad/auth/login/>

Si aparece `Failed to fetch`, revisa primero que el backend responda en `http://localhost:8000/api/`.

## Iniciar

Desde PowerShell en la raíz del repositorio, con MySQL activo y `backend\.env` configurado:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

Instalación nueva y pasos de base de datos: [README principal](README.md). No ejecutes `bootstrap_db.py --execute` sobre una base que contenga datos que quieras conservar.

## Endpoints de la API

La mayoría de endpoints de negocio requieren un token JWT. Los endpoints multiestablecimiento usan `id_establecimiento` para seleccionar el ámbito autorizado del usuario. El login devuelve el access token y guarda el refresh en una cookie `HttpOnly`; el frontend no persiste tokens en `localStorage`.

### Identidad

- `POST /api/identidad/auth/login/`
- `POST /api/identidad/auth/refresh/` (usa la cookie `HttpOnly`)
- `POST /api/identidad/auth/logout/` (revoca el refresh y borra la cookie)
- `GET /api/profile/` (rol, permisos efectivos, acciones y menú)
- `GET /api/identidad/usuarios/?id_establecimiento=1`
- `/api/identidad/roles/` (lectura/escritura según permisos; escritura solo Super Admin)
- `/api/identidad/recursos/` (catálogo de módulos y acciones; escritura solo Super Admin)

### Empresas

- `GET /api/empresas/planes/`
- `/api/empresas/establecimientos/`

### Operaciones

- `/api/operaciones/responsables/?id_establecimiento=1`
- `/api/operaciones/vehiculos/?id_establecimiento=1`
- `/api/operaciones/movimientos/?id_establecimiento=1`
- `/api/operaciones/incidencias/?id_establecimiento=1`
- `/api/operaciones/invitaciones-visitantes/?id_establecimiento=1`
- `POST /api/operaciones/qr/residente/`
- `POST /api/operaciones/qr/residente/validar/`
- `POST /api/operaciones/qr/visitante/validar/`

### Inteligencia

- `/api/inteligencia/reconocimientos/?id_establecimiento=1`
- `POST /api/inteligencia/reconocimientos/procesar/?id_establecimiento=1`

## Atajos de desarrollo

```powershell
cd frontend
npm run lint
npm run build
```

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe bootstrap_db.py --check-schema
```

Para probar el uso desde un teléfono, consulta [USO_MOVIL.md](USO_MOVIL.md). Para el entorno completo, vuelve al [README principal](README.md).
