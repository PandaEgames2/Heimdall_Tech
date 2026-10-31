# Heimdall Tech — frontend

Interfaz **React 19 + Vite 8** del panel Heimdall. Requiere la API Django activa para iniciar sesión y consultar datos.

## Requisitos

- Node.js **20.19+** o **22.12+** y npm.
- Navegador moderno. Para cámara y QR usa `http://localhost:5173/` o HTTPS.
- Backend disponible en `http://localhost:8000/api/`.

## Configuración

```powershell
Copy-Item .env.example .env
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

`VITE_API_URL` es opcional:

- Si está vacía, el frontend usa `${window.location.protocol}//${window.location.hostname}:8000/api`.
- Si el backend está en otro host o dominio, asigna la URL completa:

```env
VITE_API_URL=https://api.midominio.com/api
```

La instalación completa del sistema está en el [README principal](../README.md) y en la [guía de 5 minutos](../GUÍA_DE_ARRANQUE_5_MINUTOS.md).

## Rutas

- `/` — landing comercial.
- `/login` — inicio de sesión.
- `/panel` — panel autenticado; redirige a `/login` si no hay sesión.

La navegación usa History API. En producción, el servidor debe devolver `index.html` para `/login` y `/panel` (fallback de SPA). No uses `/app`: coincide con el archivo legado `app.js` de la raíz y Vite lo sirve como recurso estático.

## Vistas del panel

| Vista | Contenido |
|---|---|
| **Dashboard** | Métricas, plan, estado operativo y últimos eventos. |
| **Control de acceso** | Ingresos/salidas manuales, QR de residente, invitaciones y validación. |
| **Cámaras** | Captura y reconocimiento de placas con FastALPR. |
| **Mi QR e invitados** | QR temporal, código de 6 dígitos e invitaciones de visitantes. |
| **Usuarios** | Cuentas, roles múltiples, estado y excepciones. Referencia del modo oscuro. |
| **Roles y permisos** | Roles base/personalizados y recursos. |
| **Recursos** | Catálogo RBAC, exclusivo del Super Admin. |
| **Catálogo** | Planes, establecimientos, vehículos e incidencias. |
| **Reportes** | Movimientos, incidencias y LPR con detalle en modal. |
| **Seguridad** | Tarjetas interactivas con ficha técnica de cada control. |

## RBAC visual

El frontend no decide permisos: consume `/api/profile/` y usa `menu`, `permisos_efectivos`, `puede_editar`, `puede_eliminar` y `solo_lectura` para construir la barra lateral y mostrar u ocultar acciones. Cada operación se vuelve a validar en la API.

- Roles múltiples con un rol principal.
- Excepciones individuales heredadas/ permitidas/ denegadas.
- Recursos del sistema protegidos.
- Modales centrados con backdrop oscuro, focus trap y cierre con `Escape`.

## Cupos por plan

El perfil incluye `cupo`:

```json
{
  "cupo_base": 170,
  "ocupados": 2,
  "disponibles": 168,
  "excedente": 0,
  "cobro_extra": "0.00",
  "total_mensual": "49.99",
  "politica_excedente": "COBRO",
  "puede_registrar": true
}
```

- **Catálogo** muestra el banner de consumo, excedente y total estimado.
- El formulario de establecimiento muestra cupo, precio de excedente y política del plan.
- Si la política es `BLOQUEO` y no hay plazas, el backend rechaza el alta; el frontend muestra el error de la API.
- El contador es de residentes/empleados activos, no de vigilantes ni administradores.

## Restricciones contextuales

`/api/profile/` devuelve `tipo_entidad`, `tipo_entidad_etiqueta`, `permite_invitaciones_residente` y `puede_invitar`.

- En **Mi QR**, si `puede_invitar === false`, se oculta el formulario y se muestra un aviso.
- En contextos `GUBERNAMENTAL` o `EMPRESA_ALTA_SEGURIDAD`, solo la administración puede crear invitaciones para un residente/empleado.
- El QR personal del residente sigue disponible.
- El Super Admin puede habilitar la bandera desde el modal de establecimiento.

## Sistema de Diseño Mitológico

- Fondo profundo slate (`#040912`, `#08101f`, `#0b132b`).
- Texto claro (`#f4f8fe`, `#94a7bd`).
- Acentos dorados (`#d8b56d`, `#e0b66b`).
- Verde Bifröst y cian para estados.
- Títulos serif, tablas oscuras y línea prismática superior.
- Iconos SVG inline `w-5 h-5`: tablilla rúnica para **Catálogo**, Yggdrasil para **Recursos**, documento con barras para **Reportes** y escudo con check para **Seguridad**.

## Estructura

```text
src/
├─ App.jsx                 Sesión, rutas, vistas y flujos
├─ App.css                 Diseño global del panel
├─ components/
│  ├─ Sidebar.jsx          Menú dinámico e iconos
│  └─ Modal.jsx            Modal accesible
├─ features/
│  ├─ rbac/                Usuarios, roles, recursos y modales
│  ├─ empresas/            Modal de establecimientos
│  └─ landing/             Landing comercial
└─ lib/
   ├─ api.js               Fetch, refresh y errores
   └─ router.js            History API
```

## Comandos

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
npm run lint
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

`npm ci` instala las versiones fijadas en `package-lock.json`. Usa `npm install` solo cuando añadas o actualices dependencias.

## Calidad

- `npm run lint` debe pasar sin errores.
- `npm run build` debe generar `dist/` correctamente.
- El aviso de chunk grande es informativo; una mejora futura es dividir la carga de vistas y librerías de cámara/QR con `import()` dinámico.
- Prueba el panel en escritorio y en ancho móvil; los formularios y tablas deben seguir siendo utilizables.
