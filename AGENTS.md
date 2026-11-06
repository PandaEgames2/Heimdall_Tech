# AGENTS.md – Heimdall Tech

Guía operativa para agentes de código que trabajan en este repositorio. Se prioriza lo verificable desde el código/scripts.

## Stack

- **Backend:** Python 3.12, Django 5.x, DRF 3.15, MySQL 8. Sistema de autenticación JWT (access en memoria, refresh en cookie HttpOnly) con `djangorestframework-simplejwt`, lista negra y scrypt con `parallelism=1`.
- **Frontend:** React 19, Vite 8, ESLint 10 (js + react-hooks + react-refresh). Sin test runner (solo `eslint .` y `vite build`). Escaneo QR con `@zxing/browser`, generación con `qrcode.react`. LPR con `fast-alpr==0.4.0` (si falta, el resto del sistema funciona sin LPR).

## Arquitectura

Estructura real:

```
backend/
  app_empresas/         Planes, establecimientos, cupos y funcionalidades.
  app_identidad/        Usuarios, roles, perfil, login y JWT.
  app_operaciones/      Movimientos, vehículos, invitaciones, QR e incidencias.
  app_inteligencia/     Reconocimiento de placas con FastALPR.
  config/               Settings, RBAC (backend/config/rbac.py — tabla MENU_DEFINITIONS),
                        permisos (backend/config/permissions.py — IsTenantAdmin),
                        mixins, tenant_utils y utilidades multi-tenant.
  manage.py
  bootstrap_db.py       Importación del esquema MySQL (Heimdall_Tech.sql).
  requirements.txt
frontend/
  src/
    App.jsx             Sesión, rutas y flujos principales.
    App.css             Sistema visual del panel.
    features/rbac/      Usuarios, roles, recursos y modales RBAC.
    features/empresas/  Modal de establecimientos y planes.
    features/landing/   Landing comercial.
    components/         Sidebar, Modal y componentes compartidos.
    lib/
      api.js            Fetch con refresh automático, manejo de errores y JWT.
      router.js         History API.
  package.json
docs/
  ARQUITECTURA.md       Detalle de arquitectura, RBAC y cuotas.
iniciar.ps1             Arranque completo (Python venv, MySQL, backend + frontend).
Heimdall_Tech.sql       Esquema MySQL + seed demo (respaldo, no uso diario).
```

Puntos clave:
- **Multi-tenant:** el establecimiento es la frontera de datos. Cada tabla operativa guarda `id_establecimiento` y el backend filtra por el tenant del perfil autenticado antes de leer/escribir. Identificadores válidos de otro establecimiento → `403` o lista vacía.
- **RBAC de cinco tablas:** `USUARIO`, `ROL`, `RECURSO`, `USUARIO_HAS_ROL`, `ROL_HAS_RECURSO`. Más detalles en `docs/ARQUITECTURA.md`.
- **Super Admin:** único rol con lectura global sin establecimiento obligatorio (`id_establecimiento=None`). Roles base protegidos: Super Admin, Administrador, Supervisor, Vigilante, Residente.
- **API:** llamadas con JWT Bearer; auth en `/identidad/auth/`; perfil en `/api/profile/`. El frontend usa `apiFetch`/`apiRequest` de `src/lib/api.js`.

## Comandos

### Arranque completo
```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```
Flujo: reutiliza/crea `backend\.venv`, verifica MySQL y tablas, corre `migrate --noinput`, `ensure_rbac_schema`, `ensure_demo_accounts`, `ensure_operational_schema`, `ensure_plan_quota_schema`, `manage.py check`, levanta API en `0.0.0.0:8000` y frontend en `5173–5180`.

### Variables de entorno (ver `.env.example`)
- **Backend:** `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS`, `HEIMDALL_DEMO_PASSWORD`, `LOGIN_THROTTLE_RATE`.
- **Frontend:** `VITE_API_URL` (opcional; si está vacía usa host actual puerto 8000).

### Verificaciones rápidas
```powershell
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe bootstrap_db.py --check         # Conexión DB
.\.venv\Scripts\python.exe bootstrap_db.py --check-schema  # Existencia de tablas base
```

---

## Checklist de implementación

### Checklist backend — crear endpoint con permisos RBAC

- Usar `IsTenantAdmin` en ViewSets (backend/config/permissions.py) para exigir permiso de administración del módulo.
- Definir el módulo en `_module_for_view` (`backend/config/permissions.py`) y su clave en `MENU_DEFINITIONS` (`backend/config/rbac.py`).
- Añadir el módulo a `ADMIN_MODULES` si requiere `puede_editar` para escrituras.
- Verificar que `IsTenantAdmin` valide `IsAuthenticated`.
- Comprobar con `manage.py shell` que el permiso efectivo se resuelve (Response 403 esperado sin permiso).

### Checklist frontend — componente con permisos RBAC

- Consumir `permisos_efectivos`, `acciones.puede_editar/puede_eliminar` y `solo_lectura` desde `/api/profile/` (ver `src/lib/api.js`).
- Construir acciones con helpers `canAccess(key)`, `canEditModule(key)`, `canDeleteModule(key)` (ver `src/App.jsx`).
- Controlar visibilidad de botones de Editar/Eliminar con esos flags; la validación real queda en la API.
- Verificar en escritorio y móvil que el componente se renderiza sin crasheos.
- Ejecutar `npm run lint` (ESLint 10) y `npm run build` (Vite 8) sin errores.

### Checklist general

- Ejecutar desde raíz `powershell -ExecutionPolicy Bypass -File .\iniciar.ps1` para validación integral.
- Backend: `manage.py check` sin issues.
- Frontend: `npm run lint && npm run build` (o `npm ci && npm run dev` para dev).
- No commitear `backend\.env` ni `frontend\.env`; usar `.env.example` como plantilla.
- Contraseña para eliminar recursos: `Miacarol@2025` (hardcodeada, previa confirmación Super Admin).
