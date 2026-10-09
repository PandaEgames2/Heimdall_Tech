# HEIMDALL TECH — Backend API

API **Django REST Framework** sobre MySQL (`heimdall_tech`). Los modelos usan `managed = False`: el esquema oficial está en `../Heimdall_Tech.sql`.

## Capas del backend (requisito académico)

| Capa | Ubicación | Función |
|------|-----------|---------|
| **Models** | `app_*/models.py` | Mapeo ORM → tablas MySQL (`PLAN`, `USUARIO`, `MOVIMIENTO`, …) |
| **Serializers** | `app_*/serializers.py` | JSON, relaciones anidadas, ocultar datos sensibles (`password_hash`) |
| **Views** | `app_*/views.py` | ViewSets REST (list/retrieve) → respuesta JSON |
| **URLs** | `app_*/urls.py` + `config/urls.py` | Rutas que consume el frontend |

### Apps y tablas

| App | Modelos (tabla SQL) |
|-----|---------------------|
| `app_empresas` | `Plan` → PLAN, `Establecimiento` → ESTABLECIMIENTO |
| `app_identidad` | `Rol` → ROL, `Usuario` → USUARIO |
| `app_operaciones` | `Responsable`, `Vehiculo`, `Movimiento`, `Incidencia` |
| `app_inteligencia` | `ReconocimientoPlaca` → RECONOCIMIENTO_PLACA |

## Instalación

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
pybabel compile -d locale -D django
python manage.py check
python manage.py runserver
```

## Descubrir la API (frontend / profesor)

- **Índice JSON:** `GET http://127.0.0.1:8000/api/`
- **Navegador DRF:** cualquier ruta `/api/.../` (formato browsable + JSON)
- **Admin Django:** `http://127.0.0.1:8000/admin/` (modelos registrados en `app_*/admin.py`)

## Rutas principales

| Módulo | Base URL |
|--------|----------|
| Empresas | `/api/empresas/planes/`, `/api/empresas/establecimientos/` |
| Identidad | `/api/identidad/roles/`, `/api/identidad/usuarios/` |
| Operaciones | `/api/operaciones/responsables/`, `vehiculos/`, `movimientos/`, `incidencias/` |
| Inteligencia | `/api/inteligencia/reconocimientos/` |
| Meta i18n | `/api/meta/idiomas/`, `/api/meta/catalogo-enums/` |

## Multi-cliente (SaaS)

Listados y detalle operativos exigen el query param **`id_establecimiento`**:

`GET /api/operaciones/movimientos/?id_establecimiento=3`

`GET /api/operaciones/movimientos/42/?id_establecimiento=3`

Filtros adicionales: `?search=ABC123`, `?ordering=-fecha_evento`.

## Multilingüe (es / en)

- Configuración: `config/settings.py` (`LANGUAGES`, `LocaleMiddleware`)
- Traducciones: `locale/es`, `locale/en` (compilar con `pybabel compile -d locale -D django`)
- Cliente envía cabecera: `Accept-Language: es` o `Accept-Language: en`
- Enums y choices devuelven campo `*_etiqueta` traducido en serializers
- Catálogo de valores: `GET /api/meta/catalogo-enums/`

## Seguridad en serializers

- `Usuario`: no expone `password_hash`
- `UsuarioResumenSerializer`: usado en vistas anidadas (movimientos, incidencias, IA)
- Detalle (`retrieve`) incluye relaciones `vehiculo`, `usuario`, `movimiento` según módulo
