# Heimdall Tech

**Control de acceso vehicular, visitantes y seguridad operativa para establecimientos multi-tenant.**

Heimdall Tech combina una API **Django REST Framework**, una interfaz **React 19 + Vite** y **MySQL 8+**. El sistema atiende varios establecimientos desde una sola instalación, aplica permisos RBAC reales en el backend y separa la operación de portería de la administración comercial del plan.

> **Documentación relacionada**
> - [Guía de arranque en 5 minutos](GUÍA_DE_ARRANQUE_5_MINUTOS.md)
> - [Arquitectura, RBAC, cupos y diseño](docs/ARQUITECTURA.md)
> - [Frontend: rutas, componentes y comandos](frontend/README.md)
> - [Enlaces rápidos de la API](ENLACES_RAPIDOS.md)
> - [Uso desde el celular](USO_MOVIL.md)

---

## 1. Arranque rápido (5 minutos)

La primera instalación puede tardar más de cinco minutos porque descarga dependencias de Python, Node y los modelos de IA de FastALPR.

### Requisitos

| Herramienta | Versión recomendada | Notas |
|---|---|---|
| Windows | 10/11 de 64 bits | PowerShell 5.1 o superior. |
| Python | 3.12 de 64 bits | El proyecto usa el intérprete de `backend\.venv`. |
| MySQL Server | 8.0 o superior | Servicio activo y usuario con permiso para crear la base en una instalación nueva. |
| Node.js | 20.19+ o 22.12+ | Incluye `npm`. Vite no admite versiones anteriores. |
| Git | Actual | Opcional si ya tienes una copia del proyecto. |
| Navegador | Chrome o Edge actualizado | Recomendado para cámara, QR y LPR. |

### Paso 1 — Clonar y entrar al proyecto

```powershell
git clone https://github.com/PandaEgames2/Heimdall_Tech.git
cd Heimdall_Tech
```

### Paso 2 — Crear el entorno de Python

```powershell
py -3.12 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Si PowerShell bloquea la activación del entorno virtual:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\backend\.venv\Scripts\Activate.ps1
```

### Paso 3 — Configurar `backend\.env`

```powershell
Copy-Item backend\.env.example backend\.env
```

Edita `backend\.env` con los datos reales de tu MySQL:

```env
DJANGO_SECRET_KEY=pega-una-clave-larga-y-aleatoria
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=heimdall_tech
DB_USER=root
DB_PASSWORD=tu_contraseña_de_mysql
DB_HOST=127.0.0.1
DB_PORT=3306
```

Genera la clave de Django con:

```powershell
backend\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

No subas `backend\.env` ni `frontend\.env` al repositorio. Los archivos `.env.example` sí deben permanecer versionados.

### Paso 4 — Crear la base y cargar el seed demo

En una base **nueva o desechable**, desde la carpeta `backend`:

```powershell
cd backend
.\.venv\Scripts\python.exe bootstrap_db.py --check
.\.venv\Scripts\python.exe bootstrap_db.py --execute
.\.venv\Scripts\python.exe bootstrap_db.py --check-schema
cd ..
```

`--execute` importa `Heimdall_Tech.sql`, que **elimina y vuelve a crear** las tablas funcionales. No lo ejecutes sobre una base con datos que quieras conservar.

El seed incluye **más de 160 filas demo**: planes, establecimientos, roles, recursos RBAC, usuarios, responsables, vehículos, movimientos, reconocimientos, invitaciones e incidencias. Los planes quedan con cupos de **170 / 400 / 900** residentes y política de excedente `COBRO`.

Si ya tienes una base Heimdall con datos, **no ejecutes el SQL**. Salta al paso 6: el script de arranque aplica los cambios de esquema de forma idempotente.

### Paso 5 — Instalar el frontend

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
cd ..
```

`VITE_API_URL` puede quedar vacío. En ese caso el frontend usa el mismo host del navegador en el puerto `8000`, lo que permite probar desde otro dispositivo de la red local.

### Paso 6 — Arrancar todo con `iniciar.ps1`

Con MySQL activo y `backend\.env` configurado, desde la raíz:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

Qué hace el script, en orden:

1. Reutiliza `backend\.venv` o lo crea e instala dependencias.
2. Copia `backend\.env` y `frontend\.env` desde sus ejemplos si no existen.
3. Verifica la conexión MySQL y las tablas base.
4. Ejecuta las migraciones internas de Django.
5. Sincroniza el RBAC de cinco tablas con `ensure_rbac_schema`.
6. Prepara las cuentas demo con `ensure_demo_accounts`.
7. Asegura el esquema operativo con `ensure_operational_schema`.
8. Sincroniza cupos por plan y restricciones de invitación con `ensure_plan_quota_schema`.
9. Ejecuta `manage.py check`.
10. Inicia la API en `0.0.0.0:8000` y busca el frontend en los puertos `5173–5180`.

**No importa el SQL ni borra datos.** Si la base es nueva, primero completa el paso 4.

Abre:

- Landing: <http://localhost:5173/>
- Login: <http://localhost:5173/login>
- Panel: <http://localhost:5173/panel>
- API: <http://localhost:8000/api/>
- Salud de API/base de datos: <http://localhost:8000/api/health/>

Para detener los servidores, cierra los procesos de Python y Node iniciados por el script desde el Administrador de tareas.

---

## 2. Cuentas demo

Todas las cuentas comparten la contraseña **`Heimdall#2026`**:

| Ámbito | Rol | Usuario |
|---|---|---|
| Plataforma | Super Admin | `admin` o `admin@heimdall.tech` |
| Plataforma | Super Admin de respaldo | `rastor36` o `rastor36@heimdall.tech` |
| Los Pinos | Administrador | `admin@pinos.com` |
| Los Pinos | Vigilante | `vigilante@pinos.com` |
| Los Pinos | Vigilante | `vigilante2@pinos.com` |
| Los Pinos | Residente | `residente@pinos.com` |
| Norte | Administrador | `admin@norte.com` |
| Norte | Vigilante | `vigilante@norte.com` |
| Uniguajira | Administrador | `admin@uniguajira.edu.co` |
| Uniguajira | Vigilante | `porteria@uniguajira.edu.co` |
| Uniguajira | Supervisor | `supervision@uniguajira.edu.co` |
| Logístico | Administrador | `admin@logistico.com` |
| Logístico | Vigilante | `porteria@logistico.com` |

Son credenciales de desarrollo. Cámbialas antes de usar el sistema fuera de un entorno local. Para imprimirlas durante el arranque:

```powershell
$env:HEIMDALL_SHOW_DEMO_CREDENTIALS=1
.\iniciar.ps1
```

También puedes definir otra contraseña con `HEIMDALL_DEMO_PASSWORD` antes de ejecutar `ensure_demo_accounts`. Si una base antigua conserva hashes PBKDF2 o inválidos, repara las cuentas con:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py ensure_demo_accounts --reset-passwords
```

La autenticación usa **scrypt** con `parallelism=1` para portería. Los hashes antiguos se rehashean en el primer login exitoso.

---

## 3. Arquitectura general

```text
┌──────────────────────────────┐        HTTPS/JSON        ┌──────────────────────────────┐
│ React 19 + Vite              │  ──────────────────────▶ │ Django REST Framework        │
│ - SPA con History API        │   Access token Bearer    │ - JWT + cookie HttpOnly      │
│ - RBAC visual                │   Refresh en cookie      │ - RBAC y multi-tenant        │
│ - QR / cámara / LPR          │ ◀──────────────────────  │ - Cupos y reglas de negocio  │
└──────────────────────────────┘                          └──────────────┬───────────────┘
                                                                         │
                                                                         ▼
                                                          ┌──────────────────────────────┐
                                                          │ MySQL 8+                     │
                                                          │ Tablas funcionales managed=  │
                                                          │ False + tablas internas de   │
                                                          │ Django (`migrate`)           │
                                                          └──────────────────────────────┘
```

### Estructura del repositorio

```text
Heimdall_Tech/
├─ backend/
│  ├─ app_empresas/        Planes, establecimientos, cupos y funcionalidades
│  ├─ app_identidad/       Usuarios, roles, perfil, login y JWT
│  ├─ app_operaciones/     Movimientos, vehículos, invitaciones, QR e incidencias
│  ├─ app_inteligencia/    Reconocimiento de placas con FastALPR
│  ├─ config/              Settings, RBAC, permisos, mixins y utilidades de tenant
│  ├─ manage.py
│  ├─ bootstrap_db.py      Importación del esquema MySQL
│  └─ requirements.txt
├─ frontend/
│  ├─ src/App.jsx          Vistas principales del panel
│  ├─ src/App.css          Sistema visual del panel
│  ├─ src/features/rbac/   Usuarios, roles, recursos y modales RBAC
│  ├─ src/features/empresas/ Modal de establecimientos y planes
│  ├─ src/components/      Sidebar, Modal y componentes compartidos
│  └─ package.json
├─ docs/ARQUITECTURA.md
├─ Heimdall_Tech.sql       Esquema + seed demo
├─ iniciar.ps1
└─ README.md
```

La explicación detallada de cada capa, el modelo de datos, los permisos y las decisiones de diseño está en **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)**.

---

## 4. Multi-tenant: un backend, varios establecimientos

El **establecimiento** es la frontera de datos. Cada tabla operativa guarda `id_establecimiento` y el backend filtra por el tenant del perfil autenticado antes de leer o escribir.

- El usuario no puede elegir un tenant ajeno en el cuerpo de la petición: el establecimiento se resuelve desde `USUARIO` y se contrasta con el token.
- Los endpoints multiestablecimiento exigen `id_establecimiento` en la URL y llaman a `assert_establecimiento_access`.
- Un identificador válido de otro establecimiento devuelve `403` o una lista vacía, nunca datos ajenos.
- El **Super Admin** es la única cuenta con lectura global y puede administrar planes, establecimientos, roles y recursos.
- El **Administrador** gestiona usuarios, catálogo y reportes de su propia sede; no ve cuentas de otras sedes ni Super Admins.

---

## 5. RBAC de cinco tablas

La autorización real vive en Django. El menú y los botones del frontend son una representación del contrato que la API vuelve a validar.

| Tabla | Función |
|---|---|
| `USUARIO` | Cuenta, establecimiento, rol principal y estado. |
| `ROL` | Nombre, descripción y caché de permisos para compatibilidad. |
| `RECURSO` | Catálogo de módulos y acciones disponibles. |
| `USUARIO_HAS_ROL` | Roles múltiples por usuario. |
| `ROL_HAS_RECURSO` | Recursos asignados a cada rol. |

- **Roles base protegidos:** Super Admin, Administrador, Supervisor, Vigilante y Residente.
- **Multirrol:** los permisos efectivos son la unión de todos los roles asignados. Si cualquier rol es Super Admin, la cuenta se eleva.
- **Excepciones individuales:** cada permiso puede quedar heredado, permitido o denegado. `solo_lectura` prevalece sobre `puede_editar` y `puede_eliminar`.
- **Roles personalizados:** el Super Admin los crea desde **Roles y permisos**; nacen con Dashboard para no quedar inaccesibles.
- **Recursos:** el Super Admin administra el catálogo desde **Recursos**. Los recursos del sistema no se eliminan, desactivan ni cambian de clave.
- **Protecciones:** no se puede degradar al último Super Admin activo, ni eliminar/desactivar la propia cuenta.

`GET /api/profile/` devuelve rol principal, roles asignados, permisos heredados, excepciones, permisos efectivos, acciones, catálogo, menú dinámico, funcionalidades del plan y datos del cupo.

---

## 6. Cupos por plan y facturación

Cada plan define una capacidad de **residentes/empleados** por establecimiento. El cupo no cuenta usuarios operativos (vigilantes, supervisores) ni administradores: cuenta únicamente cuentas activas con rol **Residente**, incluidas las que lo tienen como rol secundario en `USUARIO_HAS_ROL`.

### Campos del plan

| Campo | Significado |
|---|---|
| `cupo_residentes` | Plazas incluidas en el plan. |
| `precio_excedente` | Valor mensual por cada plaza adicional. |
| `politica_excedente` | `COBRO` permite seguir y factura; `BLOQUEO` rechaza y exige upgrade. |
| `limite_usuarios` | Límite comercial histórico de referencia; **no bloquea** altas en esta versión. |

### Planes seed

| Plan | Precio base | Cupo | Excedente por persona | Política |
|---|---:|---:|---:|---|
| Básico | $49.99 | 170 | $0.75 / mes | `COBRO` |
| Medio | $129.99 | 400 | $0.50 / mes | `COBRO` |
| Avanzado | $299.99 | 900 | $0.35 / mes | `COBRO` |

### Cálculo

```text
excedente       = max(0, residentes_activos - cupo_residentes)
cobro_extra     = excedente × precio_excedente
total_mensual   = precio_base + cobro_extra
disponibles     = max(0, cupo_residentes - residentes_activos)
```

Ejemplo: plan Básico con 175 residentes activos → `5 × 0.75 = 3.75` de excedente; total estimado `53.74`.

### Cuándo se valida el cupo

La validación se ejecuta en `UsuarioSerializer` y en `app_empresas/quotas.py` cuando:

- se crea un residente activo;
- se reactiva una cuenta de residente;
- se traslada un residente a otro establecimiento;
- se asigna el rol Residente a una cuenta activa que antes no lo tenía.

Editar nombre, correo o contraseña de una plaza existente **no vuelve a consumir cupo**. Si la política es `BLOQUEO` y no hay plazas, la API devuelve un error de validación con la clave `cupo` y el mensaje para contratar un upgrade. Si la política es `COBRO`, el alta continúa y el panel muestra el excedente y el total estimado.

El frontend muestra el consumo en **Catálogo**, en el perfil y en el formulario de establecimiento. No puede saltarse la regla: la decisión final siempre es del backend.

---

## 7. Restricciones contextuales de invitación

Cada establecimiento tiene un `tipo_entidad`:

- `RESIDENCIAL` — Conjunto residencial.
- `GUBERNAMENTAL` — Oficina de gobierno.
- `EMPRESA_ALTA_SEGURIDAD` — Empresa de alta seguridad.

Y una bandera `permite_invitaciones_residente`.

### Comportamiento

| Contexto | Valor por defecto | Quién puede crear invitaciones |
|---|---|---|
| Conjunto residencial | Invitaciones habilitadas | Residente/empleado con plan QR y administradores. |
| Oficina de gobierno | Invitaciones deshabilitadas | Solo administración (Administrador o Super Admin). |
| Empresa de alta seguridad | Invitaciones deshabilitadas | Solo administración (Administrador o Super Admin). |

- Al crear o convertir un establecimiento a un tipo estricto, la bandera nace apagada. El **Super Admin** puede habilitarla explícitamente desde el formulario de establecimiento.
- Si la bandera está apagada, el residente/empleado **no ve el formulario** de invitación en **Mi QR** y la API responde `403` si intenta crear una.
- La restricción es contextual: el residente conserva su QR personal y su acceso; solo se limita la generación de códigos de invitados.
- En contextos estrictos, un **Administrador** o **Super Admin** puede crear la invitación seleccionando el residente/empleado anfitrión. La invitación sigue quedando vinculada a esa persona y a su establecimiento.

La autorización se aplica en `InvitacionVisitanteViewSet.create`; no depende de ocultar botones.

---

## 8. Sistema de Diseño Mitológico

Heimdall Tech toma nombres de la mitología nórdica para dar coherencia visual y conceptual al producto:

| Concepto | Uso en el producto |
|---|---|
| **Heimdall** | Guardián de Bifröst y nombre del sistema de control de acceso. |
| **El Dios Blanco** | Identidad luminosa del panel RBAC: marfil, oro y precisión. |
| **Bifröst** | Puente de luz que inspira el degradado prismático de los bordes y modales. |
| **Yggdrasil** | Árbol del mundo; icono de la vista **Recursos**. |
| **Tablillas Rúnicas** | Piedra nórdica de inventario; icono de la vista **Catálogo**. |
| **Himinbjörg** | Fortaleza de Heimdall; metáfora de la vista **Seguridad**. |

### Lenguaje visual

- Fondo profundo `#040912` / `#08101f` y superficies `#0b132b` con degradados sutiles.
- Texto principal claro (`#f4f8fe`) y secundario azul grisáceo (`#94a7bd`).
- Acentos dorados (`#d8b56d`, `#e0b66b`) para títulos, bordes y acciones primarias.
- Verde Bifröst y cian para estados operativos.
- Tipografía serif en títulos de sección y sans-serif en datos y formularios.
- Modales centrados con backdrop oscuro, trampa de foco, cierre con `Escape` y bloqueo del scroll de fondo.
- La vista **Usuarios** es la referencia del modo oscuro; **Catálogo**, **Reportes**, **Seguridad** y los formularios de establecimiento comparten el mismo lenguaje.

### Iconos del menú

- **Catálogo:** tablilla de piedra con runas e inventario (SVG inline `w-5 h-5`).
- **Recursos:** Yggdrasil.
- **Reportes:** documento con barras de actividad.
- **Seguridad:** escudo con check.

---

## 9. Módulos principales

- **Dashboard:** métricas del establecimiento, estado del plan y últimos eventos.
- **Control de acceso:** ingresos/salidas manuales, escaneo QR y validación de invitaciones.
- **Cámaras:** captura y reconocimiento de placas con FastALPR; el vigilante confirma antes de registrar.
- **Mi QR e invitados:** QR temporal del residente, código de respaldo de 6 dígitos (90 s, un uso) e invitaciones de visitantes.
- **Usuarios:** altas, roles múltiples, estado, excepciones y cupo.
- **Roles y permisos:** administración global del RBAC, exclusiva del Super Admin.
- **Recursos:** catálogo de módulos y acciones, exclusivo del Super Admin.
- **Catálogo:** planes, establecimientos, vehículos, responsables e incidencias; muestra cupo, política y tipo de entidad.
- **Reportes:** movimientos, incidencias y reconocimientos con detalle en modal.
- **Seguridad:** tarjetas interactivas con ficha técnica de cada control implementado.

---

## 10. Base de datos y seeds

El proyecto usa dos grupos de tablas:

1. **Tablas funcionales** creadas por `Heimdall_Tech.sql`: `PLAN`, `ESTABLECIMIENTO`, `ROL`, `RECURSO`, `USUARIO`, tablas puente y tablas operativas. Los modelos usan `managed = False`.
2. **Tablas internas de Django** creadas por `manage.py migrate`: autenticación, sesiones, contenido y lista negra de tokens.

### Comandos idempotentes

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py migrate --noinput
.\.venv\Scripts\python.exe manage.py ensure_rbac_schema
.\.venv\Scripts\python.exe manage.py ensure_demo_accounts
.\.venv\Scripts\python.exe manage.py ensure_operational_schema
.\.venv\Scripts\python.exe manage.py ensure_plan_quota_schema
.\.venv\Scripts\python.exe manage.py check
```

Estos comandos **no borran datos**:

- `ensure_rbac_schema` crea/actualiza las tablas RBAC y convierte permisos antiguos.
- `ensure_demo_accounts` repara cuentas demo y sus relaciones de rol.
- `ensure_operational_schema` añade RFID, invitaciones y códigos cortos si faltan.
- `ensure_plan_quota_schema` añade `cupo_residentes`, `precio_excedente`, `politica_excedente`, `tipo_entidad` y `permite_invitaciones_residente` en bases antiguas.

### Verificar la base

```powershell
backend\.venv\Scripts\python.exe backend\bootstrap_db.py --check
backend\.venv\Scripts\python.exe backend\bootstrap_db.py --check-schema
```

`--check` valida credenciales y conexión. `--check-schema` confirma que existen las tablas base `PLAN`, `ESTABLECIMIENTO`, `ROL` y `USUARIO`.

---

## 11. Variables de entorno

### Backend (`backend\.env`)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DJANGO_SECRET_KEY` | Sí en producción | Clave de firma. La app rechaza valores de ejemplo con `DEBUG=False`. |
| `DJANGO_DEBUG` | No | `True` en local; `False` en producción. |
| `DJANGO_ALLOWED_HOSTS` | No | Hosts separados por coma. |
| `DB_NAME` | Sí | Base MySQL. Por defecto `heimdall_tech`. |
| `DB_USER` / `DB_PASSWORD` | Sí | Credenciales MySQL. |
| `DB_HOST` / `DB_PORT` | No | Por defecto `127.0.0.1:3306`. |
| `DJANGO_CORS_ALLOWED_ORIGINS` | En producción | Orígenes exactos del frontend. |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | En producción | Orígenes de confianza CSRF. |
| `DJANGO_BEHIND_PROXY` | No | `True` si hay proxy inverso con HTTPS. |
| `JWT_ACCESS_MINUTES` | No | Vida del access token; por defecto 15. |
| `JWT_REFRESH_DAYS` | No | Vida del refresh; por defecto 7. |
| `REFRESH_TOKEN_COOKIE_NAME` | No | Nombre de la cookie HttpOnly. |
| `HEIMDALL_DEMO_PASSWORD` | No | Contraseña de las cuentas demo. |
| `LOGIN_THROTTLE_RATE` | No | Límite de intentos de login; por defecto `10/min`. |

### Frontend (`frontend\.env`)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API. Si está vacía, se calcula como `<host actual>:8000/api`. |

---

## 12. Dependencias principales

### Backend (`backend/requirements.txt`)

| Paquete | Uso |
|---|---|
| `Django>=5.0,<6` | Framework y ORM. |
| `djangorestframework>=3.15,<4` | API REST. |
| `djangorestframework-simplejwt>=5.3,<6` | Access/refresh tokens y lista negra. |
| `mysqlclient>=2.2,<3` | Driver MySQL para Django. |
| `mysql-connector-python>=9.0,<10` | Conexión usada por `bootstrap_db.py` y comandos idempotentes. |
| `python-dotenv>=1.0,<2` | Lectura de `.env`. |
| `django-cors-headers>=4.3,<5` | CORS para el frontend. |
| `Babel>=2.14,<3` | Formatos e idiomas. |
| `fast-alpr[onnx]==0.4.0` | Detección y OCR de placas. Si falta, solo se deshabilita LPR. |

### Frontend (`frontend/package.json`)

| Paquete | Uso |
|---|---|
| `react` / `react-dom` 19 | Interfaz SPA. |
| `vite` 8 | Servidor de desarrollo y build. |
| `@zxing/browser` | Escaneo de QR con cámara. |
| `qrcode.react` | Generación de QR de residentes e invitaciones. |
| `eslint` + plugins | Calidad del código. |

Para actualizar dependencias:

```powershell
cd frontend
npm install
npm run lint
npm run build
```

Usa `npm install` solo cuando cambies dependencias; para una instalación limpia usa `npm ci`.

---

## 13. Arranque manual (opcional)

Con MySQL activo y las dependencias instaladas, abre dos terminales en la raíz.

**Terminal 1 — backend:**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py migrate --noinput
python manage.py ensure_rbac_schema
python manage.py ensure_demo_accounts
python manage.py ensure_operational_schema
python manage.py ensure_plan_quota_schema
python manage.py check
python manage.py runserver 127.0.0.1:8000
```

**Terminal 2 — frontend:**

```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Detén cada proceso con `Ctrl+C`.

---

## 14. API útil

La mayoría de endpoints requieren `Authorization: Bearer <access>`.

### Identidad y perfil

- `POST /api/identidad/auth/login/` — access en la respuesta, refresh en cookie HttpOnly.
- `POST /api/identidad/auth/refresh/` — renueva el access.
- `POST /api/identidad/auth/logout/` — revoca el refresh y borra la cookie.
- `GET /api/profile/` — rol, permisos, menú, plan, cupo, tipo de establecimiento y `puede_invitar`.
- `/api/identidad/usuarios/?id_establecimiento=1`
- `/api/identidad/roles/`
- `/api/identidad/recursos/`

### Empresas y planes

- `GET /api/empresas/planes/` — incluye `cupo_residentes`, `precio_excedente` y `politica_excedente`.
- `/api/empresas/establecimientos/` — incluye `tipo_entidad`, `permite_invitaciones_residente` y `uso_cupo`.

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

El detalle completo de contratos y ejemplos está en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) y [ENLACES_RAPIDOS.md](ENLACES_RAPIDOS.md).

---

## 15. Prueba rápida de flujos

1. **Residente en conjunto residencial:** inicia como `residente@pinos.com`, abre **Mi QR e invitados**, genera su QR o código de 6 dígitos y crea una invitación.
2. **Vigilante:** inicia como `vigilante@pinos.com`, abre **Control de acceso**, valida el código del residente o el QR de la invitación y registra ingreso/salida.
3. **Contexto estricto:** inicia como `admin@norte.com` o `admin@uniguajira.edu.co`. El establecimiento es de alta seguridad/gobierno y las invitaciones de residentes están deshabilitadas. Revisa el aviso en **Catálogo** y la ficha de **Seguridad**.
4. **Cupo:** como Super Admin, abre **Catálogo** y revisa el banner de cupo del plan, el excedente y el total estimado. Crea un residente para verificar que el backend aplica la política.
5. **RBAC:** como Super Admin, crea un rol personalizado, asígnale recursos y luego asigna ese rol a un usuario. Comprueba que el menú y la API cambian.
6. **LPR:** inicia con un usuario de plan Avanzado, abre **Cámaras**, permite la cámara y captura una placa. La lectura requiere confirmación antes de registrar el acceso.
7. **Seguridad:** abre **Seguridad** y haz clic en cualquier tarjeta para ver su ficha técnica, archivos y fragmento de implementación.

---

## 16. Solución de problemas

| Síntoma | Solución |
|---|---|
| `No module named django` | Usa `backend\.venv\Scripts\python.exe`; el Python global puede no tener Django. |
| No conecta con MySQL | Verifica el servicio, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`. Ejecuta `bootstrap_db.py --check`. |
| `Failed to fetch` al iniciar sesión | Confirma que la API responde en `http://localhost:8000/api/` y que `VITE_API_URL` apunta al backend correcto. |
| Faltan tablas base | En una base nueva importa el SQL con `bootstrap_db.py --execute`. En una base con datos, no ejecutes el SQL: revisa `ensure_*` y haz copia de seguridad. |
| El frontend no abre | Confirma `npm ci`, la versión de Node y el puerto `5173`. El script busca hasta `5180`. |
| La cámara no funciona | Usa `localhost` o HTTPS. En HTTP por IP de LAN el navegador puede bloquear `getUserMedia`; usa el código manual de 6 dígitos. |
| El cupo bloquea un alta | El plan está en política `BLOQUEO` y no quedan plazas. Cambia a un plan superior o ajusta la política a `COBRO`. |
| Un residente no ve invitaciones | El establecimiento es estricto o la bandera `permite_invitaciones_residente` está apagada. El Super Admin puede habilitarla. |
| No se puede iniciar sesión | Verifica usuario, contraseña y estado activo. Repara cuentas demo con `ensure_demo_accounts --reset-passwords`. |
| FastALPR no disponible | Instala `requirements.txt` y revisa Internet en la primera inferencia. El resto del sistema funciona sin LPR. |

---

## 17. Estado de esta versión

Incluye:

- Multi-tenant y RBAC de cinco tablas con roles múltiples y excepciones.
- Cupos de residentes/empleados con cobro extra o bloqueo por plan.
- Tipos de establecimiento y restricciones contextuales de invitación.
- Catálogo, Reportes y Seguridad con el lenguaje visual oscuro/dorado.
- Modales técnicos en Seguridad y modales centrados en toda la administración.
- LPR con confirmación humana, QR temporal, código de 6 dígitos e invitaciones.

Limitaciones conocidas:

- La cola de sincronización offline de movimientos aún no está implementada; la UI avisa del modo sin conexión, pero las escrituras requieren API.
- `limite_usuarios` se conserva por compatibilidad comercial y no bloquea altas.
- La facturación del excedente es estimada en el panel; no hay integración con pasarela de pagos ni facturación electrónica.
- La precisión LPR debe validarse con placas colombianas reales antes de usarla como única fuente de acceso.

---

## 18. Guías relacionadas

- [Guía de arranque en 5 minutos](GUÍA_DE_ARRANQUE_5_MINUTOS.md)
- [Arquitectura, RBAC, cupos y sistema de diseño](docs/ARQUITECTURA.md)
- [Frontend](frontend/README.md)
- [Versión portable](frontend/portable-README.md)
- [Enlaces rápidos](ENLACES_RAPIDOS.md)
- [Uso desde móvil](USO_MOVIL.md)
