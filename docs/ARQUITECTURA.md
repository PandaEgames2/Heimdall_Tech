# Arquitectura de Heimdall Tech

> Documento de referencia para desarrolladores. Describe la arquitectura real del código, el modelo multi-tenant, el RBAC, los cupos por plan, las restricciones contextuales y el sistema de diseño mitológico.

## 1. Visión general

Heimdall Tech es un **SaaS multi-establecimiento** para control de acceso vehicular y gestión de visitantes. Una sola instalación atiende conjuntos residenciales, oficinas de gobierno y empresas de alta seguridad, con aislamiento de datos por establecimiento.

### Stack

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | React 19 + Vite 8 | SPA, panel, QR, cámara, formularios y RBAC visual. |
| Backend | Django 5 + Django REST Framework | API, autenticación, permisos, reglas de negocio y cupos. |
| Base de datos | MySQL 8+ | Datos funcionales y tablas internas de Django. |
| Autenticación | SimpleJWT + scrypt | Access corto en memoria, refresh rotativo en cookie HttpOnly. |
| Visión | FastALPR (YOLO DNN + OCR ONNX) | Reconocimiento de placas con confirmación humana. |

### Capas del backend

```text
backend/
├─ config/
│  ├─ settings.py          Settings, JWT, CORS, hashers y throttling
│  ├─ urls.py              Rutas raíz de la API
│  ├─ rbac.py              Catálogo y resolución de permisos
│  ├─ permissions.py       Permisos DRF por módulo y política de escritura
│  ├─ mixins.py            Filtro obligatorio por establecimiento
│  ├─ tenant_utils.py      Perfil, roles y acceso al tenant
│  ├─ pagination.py
│  └─ exception_handlers.py
├─ app_empresas/           Plan, Establecimiento, cupos y funcionalidades
├─ app_identidad/          Usuario, Rol, login, perfil y serializers
├─ app_operaciones/        Movimiento, Vehículo, Invitación, QR e incidencias
└─ app_inteligencia/       Reconocimiento de placas
```

### Capas del frontend

```text
frontend/src/
├─ App.jsx                 Rutas, sesión, vistas y flujos principales
├─ App.css                 Sistema visual global del panel
├─ components/
│  ├─ Sidebar.jsx          Menú dinámico e iconos SVG
│  └─ Modal.jsx            Modal accesible con portal y focus trap
├─ features/
│  ├─ rbac/                Usuarios, roles, recursos y modales
│  ├─ empresas/            Modal de establecimientos
│  └─ landing/             Landing comercial
└─ lib/
   ├─ api.js               Fetch, refresh y errores normalizados
   └─ router.js            History API
```

---

## 2. Modelo multi-tenant

### Frontera de datos

El **establecimiento** (`ESTABLECIMIENTO.id_establecimiento`) es la frontera. Las tablas operativas guardan `id_establecimiento` y las vistas lo usan para filtrar antes de leer o escribir.

```text
PLAN 1 ─── N ESTABLECIMIENTO 1 ─── N USUARIO
                              ├── N RESPONSABLE
                              ├── N VEHICULO
                              ├── N MOVIMIENTO
                              ├── N INCIDENCIA
                              ├── N INVITACION_VISITANTE
                              └── N RECONOCIMIENTO_PLACA
```

### Resolución del tenant

1. El login valida el correo contra `USUARIO`.
2. El token incorpora `id_establecimiento`, rol principal y roles.
3. `get_usuario_perfil(request.user)` vuelve a consultar `USUARIO` y confirma que la cuenta sigue activa.
4. `EstablecimientoQueryParamMixin` exige `id_establecimiento` en la URL y llama a `assert_establecimiento_access`.
5. La vista filtra el queryset por ese identificador.

El cliente no puede cambiar de tenant enviando otro `id_establecimiento` en el body. El Super Admin es la única cuenta con lectura global.

### Consecuencias prácticas

- Un administrador de Los Pinos no ve usuarios, vehículos ni movimientos de Uniguajira.
- Un identificador de otro tenant devuelve `403` o una lista vacía; nunca filtra datos ajenos.
- Los reportes y el catálogo se cargan con el `id_establecimiento` del perfil.
- El frontend reconstruye el menú con `/api/profile/`, pero la API vuelve a autorizar cada operación.

---

## 3. RBAC de cinco tablas

### Tablas

| Tabla | Contenido |
|---|---|
| `USUARIO` | Cuenta, correo, hash, establecimiento, rol principal y estado. |
| `ROL` | Nombre, descripción, `es_sistema` y caché `permisos`. |
| `RECURSO` | Catálogo de módulos y acciones (`clave`, `nombre`, `tipo`, `grupo`, `orden`). |
| `USUARIO_HAS_ROL` | Relación N:M usuario-rol con `es_principal`. |
| `ROL_HAS_RECURSO` | Relación N:M rol-recurso. |

`ROL.permisos` se conserva como caché de compatibilidad para instalaciones antiguas. La fuente de verdad son las tablas puente.

### Roles base

| Rol | ID | Alcance |
|---|---:|---|
| Administrador | 1 | Gestión de su establecimiento. |
| Vigilante | 2 | Operación de portería. |
| Supervisor | 3 | Auditoría y reportes. |
| Super Admin | 4 | Plataforma global y RBAC. |
| Residente | 5 | QR personal e invitaciones. |

Los cinco roles están protegidos: no se eliminan ni renombran. Un rol personalizado nace con Dashboard para evitar un rol inaccesible.

### Resolución de permisos

```text
permisos_heredados = unión de ROL_HAS_RECURSO de todos los roles
permisos_efectivos = permisos_heredados + excepciones permitidas - excepciones denegadas
acciones           = puede_editar / puede_eliminar / solo_lectura
```

Reglas:

- Si cualquier rol asignado es Super Admin, la cuenta se eleva.
- `solo_lectura` prevalece sobre `puede_editar` y `puede_eliminar`.
- El Super Admin conserva siempre dashboard, usuarios, roles, recursos, edición y eliminación.
- El backend rechaza claves desconocidas en `permisos_excepciones`.
- No se puede degradar al último Super Admin activo ni eliminar/desactivar la propia cuenta.

### Aplicación en la API

`config/permissions.py` mapea cada ViewSet a un módulo:

- `usuarios`, `roles`, `recursos`, `catalogos`, `reportes`, `seguridad`, `accesos`, `camaras`, `mi_qr`.
- En módulos administrativos, escribir exige `puede_editar`.
- `DELETE` exige `puede_eliminar`.
- `mi_qr` es una operación personal: el residente puede generar su QR y revocar sus invitaciones aunque su rol sea de solo lectura sobre el establecimiento.

### Perfil

`GET /api/profile/` devuelve:

```json
{
  "id_usuario": 10,
  "nombre": "Residente Los Pinos",
  "rol": "Residente",
  "roles_asignados": [],
  "permisos_efectivos": ["mi_qr"],
  "puede_editar": false,
  "puede_eliminar": false,
  "solo_lectura": true,
  "menu": [],
  "plan": {
    "id": 1,
    "nombre": "Basico",
    "cupo_residentes": 170,
    "precio_excedente": "0.75",
    "politica_excedente": "COBRO"
  },
  "tipo_entidad": "RESIDENCIAL",
  "permite_invitaciones_residente": true,
  "puede_invitar": true,
  "cupo": {
    "cupo_base": 170,
    "ocupados": 2,
    "disponibles": 168,
    "excedente": 0,
    "cobro_extra": "0.00",
    "total_mensual": "49.99",
    "politica_excedente": "COBRO",
    "puede_registrar": true
  }
}
```

---

## 4. Cupos por plan y facturación

### Campos

`PLAN` incorpora:

| Campo | Tipo | Uso |
|---|---|---|
| `cupo_residentes` | `INT` | Plazas incluidas de residentes/empleados. |
| `precio_excedente` | `DECIMAL(10,2)` | Cobro mensual por plaza adicional. |
| `politica_excedente` | `VARCHAR(10)` | `COBRO` o `BLOQUEO`. |

`limite_usuarios` se conserva como dato comercial histórico y no se usa para bloquear altas en esta versión.

### Conteo

`app_empresas/quotas.py` cuenta usuarios:

- del establecimiento;
- con `estado = True`;
- con rol Residente en `USUARIO.id_rol` **o** en `USUARIO_HAS_ROL`;
- sin duplicar usuarios que tengan el rol por ambas vías.

Si la tabla puente no existe en una base muy antigua, cae al rol principal.

### Fórmulas

```text
excedente     = max(0, ocupados - cupo_base)
disponibles   = max(0, cupo_base - ocupados)
cobro_extra   = excedente * precio_excedente
total_mensual = precio_base + cobro_extra
porcentaje    = min(100, ocupados / cupo_base * 100)
```

### Políticas

| Política | Alta en el límite | Resultado |
|---|---|---|
| `COBRO` | Permitida | Se calcula excedente y total estimado. |
| `BLOQUEO` | Rechazada | `ValidationError` con clave `cupo` y mensaje de upgrade. |

La validación se ejecuta al crear, reactivar o trasladar un residente activo, y al asignarle el rol Residente a una cuenta activa. Editar datos de una plaza existente no consume cupo.

### Seeds

| Plan | Precio base | Cupo | Excedente | Política |
|---|---:|---:|---:|---|
| Básico | 49.99 | 170 | 0.75 | `COBRO` |
| Medio | 129.99 | 400 | 0.50 | `COBRO` |
| Avanzado | 299.99 | 900 | 0.35 | `COBRO` |

### Contrato de establecimiento

```json
{
  "id_establecimiento": 1,
  "nombre": "Conjunto Residencial Los Pinos",
  "tipo_entidad": "RESIDENCIAL",
  "tipo_entidad_etiqueta": "Conjunto residencial",
  "permite_invitaciones_residente": true,
  "plan": {
    "nombre": "Basico",
    "cupo_residentes": 170,
    "precio_excedente": "0.75",
    "politica_excedente": "COBRO"
  },
  "uso_cupo": {
    "ocupados": 2,
    "cupo_base": 170,
    "disponibles": 168,
    "excedente": 0,
    "cobro_extra": "0.00",
    "total_mensual": "49.99",
    "puede_registrar": true
  }
}
```

---

## 5. Restricciones contextuales de invitación

### Modelo

`ESTABLECIMIENTO` incorpora:

| Campo | Valores |
|---|---|
| `tipo_entidad` | `RESIDENCIAL`, `GUBERNAMENTAL`, `EMPRESA_ALTA_SEGURIDAD`. |
| `permite_invitaciones_residente` | `TRUE` / `FALSE`. |

### Regla de negocio

| Tipo | Invitaciones de residentes | Quién invita |
|---|---|---|
| Conjunto residencial | Habilitadas por defecto | Residente/empleado y administración. |
| Oficina de gobierno | Deshabilitadas por defecto | Solo administración. |
| Empresa de alta seguridad | Deshabilitadas por defecto | Solo administración. |

Al crear o convertir un establecimiento a un tipo estricto, el serializer apaga la bandera si el cliente no envía un valor explícito. El Super Admin puede volver a habilitarla desde el formulario; es una decisión consciente, no un efecto accidental.

### Backend

`InvitacionVisitanteViewSet.create`:

1. Resuelve el perfil autenticado.
2. Exige el módulo `mi_qr` para residentes o `accesos` para administración.
3. Comprueba que el plan incluya QR.
4. Si el creador es residente, exige `permite_invitaciones_residente = true`; si está apagada, responde `403`.
5. Si el creador es Administrador/Super Admin, permite crear la invitación a nombre de un residente activo del mismo establecimiento.
6. Guarda el token solo como hash SHA-256 y devuelve el token crudo una única vez para dibujar el QR.

La invitación siempre queda vinculada a un `id_residente` anfitrión, aunque la cree un administrador. Así se conserva la trazabilidad y el residente ve la invitación en su historial.

### Frontend

- `/api/profile/` devuelve `puede_invitar`.
- Si es `false`, **Mi QR** oculta el formulario y muestra un aviso con el tipo de establecimiento.
- En contextos estrictos, la administración dispone de la acción de invitar y selecciona el residente anfitrión.
- El QR personal del residente no se desactiva: la restricción solo afecta a invitados.

---

## 6. Autenticación y seguridad

### Login

- Contraseña verificada contra `USUARIO.password_hash`.
- Hasher primario: scrypt con `parallelism=1` para reducir el tiempo en equipos de portería.
- PBKDF2 y hashes antiguos se validan y se rehashean en el primer login exitoso.
- Throttle de login: `10/min` por defecto (`LOGIN_THROTTLE_RATE`).

### Tokens

| Token | Vida | Almacenamiento |
|---|---|---|
| Access | 15 min | Memoria del frontend. |
| Refresh | 7 días | Cookie HttpOnly, SameSite=Strict, Secure fuera de DEBUG. |

- El refresh rota y el anterior entra en lista negra.
- Logout revoca el refresh y borra la cookie.
- Al recargar, el frontend renueva el access y vuelve a consultar `/api/profile/`.
- El token incluye tenant y roles, pero el backend siempre contrasta con la base.

### Cabeceras y cookies

- `SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS=DENY`, `Referrer-Policy`.
- `SESSION_COOKIE_SECURE` y `CSRF_COOKIE_SECURE` fuera de DEBUG.
- HSTS de un año fuera de DEBUG.
- CORS restringido a orígenes configurados; en DEBUG se permiten direcciones privadas de LAN.
- Throttling global: `60/min` anónimo y `300/min` autenticado.

### Auditoría

- `MOVIMIENTO` conserva establecimiento, vehículo, operador, placa, tipo, dispositivo, observación, sincronización y fechas.
- `INCIDENCIA` puede vincular vehículo, usuario e invitación.
- `RECONOCIMIENTO_PLACA` conserva placa, confianza, resultado IA y fotografía.
- La bitácora es operativa; para producción crítica se recomienda exportación append-only y retención definida.

---

## 7. Flujos principales

### Acceso de residente por QR

```text
Residente → POST /qr/residente/ → token + código de 6 dígitos
Vigilante → POST /qr/residente/validar/ → valida token o código
          → registra MOVIMIENTO de ingreso/salida
```

El código de 6 dígitos vence en 90 segundos y se usa una sola vez. El QR se guarda hasheado y se invalida al consumirse.

### Invitación de visitante

```text
Residente/Administrador → POST /invitaciones-visitantes/
                         → token crudo + QR
Vigilante → POST /qr/visitante/validar/ → ingreso
          → POST /qr/visitante/validar/ (SALIDA)
```

Estados: `PENDIENTE`, `EN_SITIO`, `FINALIZADA`, `REVOCADA`. La vigencia máxima es de 24 horas.

### Reconocimiento LPR

```text
Cámara → POST /inteligencia/reconocimientos/procesar/
       → detector YOLO + OCR ONNX
       → resultado con confianza
Vigilante confirma → Movimiento
```

La IA no registra el acceso por sí sola: el vigilante revisa la placa y confirma.

---

## 8. Sistema de Diseño Mitológico

### Nombres y símbolos

| Nombre | Significado | Uso |
|---|---|---|
| **Heimdall** | Guardián de Bifröst | Producto y control de acceso. |
| **El Dios Blanco** | Identidad luminosa | Panel RBAC: marfil, oro y precisión. |
| **Bifröst** | Puente de luz | Degradado prismático de bordes y modales. |
| **Yggdrasil** | Árbol del mundo | Icono de **Recursos**. |
| **Tablillas Rúnicas** | Inventario de piedra nórdica | Icono de **Catálogo**. |
| **Himinbjörg** | Fortaleza de Heimdall | Vista **Seguridad**. |

### Paleta

| Token | Hex | Uso |
|---|---|---|
| Fondo profundo | `#040912` / `#08101f` | Fondo general y superficies. |
| Slate de panel | `#0b132b` / `#0d1a34` | Tarjetas del modo oscuro. |
| Texto principal | `#f4f8fe` / `#edf9ff` | Títulos y datos. |
| Texto secundario | `#94a7bd` / `#a8c1cc` | Descripciones y metadatos. |
| Oro | `#d8b56d` / `#e0b66b` | Acentos, títulos y acciones. |
| Verde Bifröst | `#4ce0b5` / `#3fe8a9` | Estados activos y éxito. |
| Rojo | `#ff6674` | Errores y bloqueos. |

### Componentes

- **Panel oscuro:** degradado slate, borde azul grisáceo, línea prismática superior.
- **Cabecera de vista:** eyebrow dorado, título serif, descripción y badges.
- **Stats:** tarjetas pequeñas con etiqueta dorada, cifra clara y nota.
- **Tabla:** cabecera dorada, filas con hover dorado y acciones fantasma.
- **Modal:** portal, backdrop oscuro con blur, panel centrado, focus trap y cierre con Escape.
- **Botón primario:** degradado oro → cian.
- **Botón fantasma:** borde dorado y texto claro.
- **Badge/estado:** píldora con color semántico.

### Vistas refactorizadas

- **Usuarios:** referencia del modo oscuro (`rbac-card-dark`).
- **Catálogo:** banner de cupo, tarjetas de categorías, tabla de planes/establecimientos y acciones.
- **Reportes:** resumen de actividad, pestañas y tablas con detalle.
- **Seguridad:** tarjetas clicables con ficha técnica en modal oscuro.

### Accesibilidad

- Modales con `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap y restauración de foco.
- Botones con `aria-label` cuando el contenido visual no describe la acción.
- Contraste alto en textos principales y estados.
- Navegación por teclado en menús, tabs y tarjetas.
- `prefers-reduced-motion` desactiva animaciones cuando el usuario lo solicita.

---

## 9. Base de datos

### Estrategia `managed = False`

Las tablas funcionales se crean desde `Heimdall_Tech.sql` y los modelos Django no las gestionan con migraciones. Las tablas internas de Django sí usan `migrate`.

Ventajas:

- Control explícito del esquema MySQL.
- Compatibilidad con instalaciones existentes.
- Seeds reproducibles.

Riesgo:

- Un cambio de modelo no genera migración automática. Por eso existen comandos idempotentes como `ensure_plan_quota_schema`.

### Comandos idempotentes

```powershell
python manage.py migrate --noinput
python manage.py ensure_rbac_schema
python manage.py ensure_demo_accounts
python manage.py ensure_operational_schema
python manage.py ensure_plan_quota_schema
```

`ensure_plan_quota_schema` añade columnas solo si no existen y completa los seeds conocidos una sola vez. No borra datos.

### Instalación limpia

```powershell
cd backend
python bootstrap_db.py --check
python bootstrap_db.py --execute
python bootstrap_db.py --check-schema
```

`--execute` es destructivo para esa base: elimina y recrea tablas. Úsalo solo en una base nueva o desechable.

---

## 10. API y contratos

### Autenticación

```http
POST /api/identidad/auth/login/
Content-Type: application/json

{ "username": "admin@heimdall.tech", "password": "Heimdall#2026" }
```

Respuesta: `access` en JSON y refresh en cookie `HttpOnly`.

### Perfil

```http
GET /api/profile/
Authorization: Bearer <access>
```

### Planes

```http
GET /api/empresas/planes/
```

### Establecimientos

```http
GET /api/empresas/establecimientos/?page_size=200
```

### Crear invitación como administrador

```http
POST /api/operaciones/invitaciones-visitantes/?id_establecimiento=2
Authorization: Bearer <access-admin>
Content-Type: application/json

{
  "id_residente": 15,
  "nombre_visitante": "Visitante Autorizado",
  "documento_visitante": "123456789",
  "placa_visitante": "ABC-123",
  "motivo": "Reunión con dirección",
  "vigente_desde": "2026-11-01T09:00:00-05:00",
  "vigente_hasta": "2026-11-01T12:00:00-05:00"
}
```

El backend valida que el residente pertenezca al mismo establecimiento, esté activo y tenga rol Residente.

### Errores de cupo

```json
{
  "cupo": [
    "El plan Basico alcanzó su cupo base de 170 residentes/empleados. Aumenta el plan para registrar más plazas o cambia la política del plan a cobro por excedente."
  ]
}
```

### Errores de invitación restringida

```json
{
  "detail": "La administración de este establecimiento no ha habilitado invitaciones para residentes/empleados. Solicita autorización a un administrador."
}
```

---

## 11. Decisiones de diseño

| Decisión | Motivo |
|---|---|
| `managed = False` + comandos idempotentes | Conservar el esquema MySQL explícito y actualizar bases existentes sin migraciones destructivas. |
| Cupo por rol Residente, no por total de cuentas | El plan comercial se vende por residentes/empleados, no por vigilantes o administradores. |
| Política de excedente configurable | Permite vender con cobro automático o forzar upgrade según el cliente. |
| Tipo de entidad + bandera | Evita duplicar roles y permite una excepción administrativa explícita. |
| Invitación siempre vinculada a un residente | Conserva trazabilidad aunque la cree un administrador. |
| Token de invitación hasheado | Una filtración de base no expone QR válidos. |
| Confirmación humana en LPR | La IA no debe abrir una barrera sin revisión en esta versión. |
| Modales centrados con focus trap | Accesibilidad y consistencia en escritorio y móvil. |

---

## 12. Limitaciones y siguientes pasos

- **Offline:** no hay cola IndexedDB de movimientos pendientes. `estado_sincronizacion` existe en el modelo, pero la escritura requiere API.
- **Facturación:** el cobro por excedente es estimado; no hay pasarela de pagos ni factura electrónica.
- **LPR:** requiere validación con placas colombianas reales y condiciones de iluminación variables.
- **Notificaciones:** no hay correo o push automático para invitados o incidencias.
- **Observabilidad:** no hay SIEM ni exportación append-only; se recomienda añadir retención y auditoría externa en producción.
- **Testing:** no hay suite automatizada completa de frontend/backend; las verificaciones actuales son `manage.py check`, `npm run lint` y `npm run build`.

---

## 13. Checklist de verificación

```powershell
# Backend
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py ensure_plan_quota_schema

# Frontend
cd frontend
npm run lint
npm run build
```

Prueba manual mínima:

1. Login de Super Admin, Administrador, Vigilante y Residente.
2. `/api/profile/` con plan, cupo, tipo de entidad y `puede_invitar`.
3. Alta de residente en plan `COBRO` y en plan `BLOQUEO`.
4. Invitación de residente en Los Pinos.
5. Intento de invitación de residente en Norte/Uniguajira → `403`.
6. Invitación creada por Administrador en contexto estricto.
7. Catálogo con banner de cupo y tipo de establecimiento.
8. Reportes con tablas y modales de detalle.
9. Seguridad con tarjetas clicables y modal técnico.
10. Responsive en ancho móvil y navegación por teclado.
