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

Este documento explica paso a paso cómo iniciar el backend de `Heimdall Tech`, preparar la base de datos MySQL real y dejar el proyecto listo para trabajar.

### 1. Requisitos previos

Necesitas tener instalado:

- Python 3.12+
- MySQL Server 8.0+
- Git
- Navegador web
- PowerShell o terminal de comandos

### 2. Estructura del proyecto

El proyecto está dividido así:

- `backend/` → proyecto Django
- `Heimdall_Tech.sql` → script SQL con la estructura y datos base
- `backend/.env` → variables de entorno
- `backend/.venv/` → entorno virtual

### 3. Preparar la base de datos MySQL

Antes de levantar Django, debes crear/activar la base de datos real con el script SQL del proyecto.

#### 3.1 Ubicación del script SQL

En la raíz del proyecto encontrarás:

- `Heimdall_Tech.sql`

Ese archivo crea la base de datos `heimdall_tech` y las tablas:

- `PLAN`
- `ESTABLECIMIENTO`
- `ROL`
- `USUARIO`
- `RESPONSABLE`
- `VEHICULO`
- `MOVIMIENTO`
- `RECONOCIMIENTO_PLACA`
- `INCIDENCIA`

#### 3.2 Ejecutar el SQL

Opción 1: desde MySQL Workbench

1. Abre MySQL Workbench
2. Conéctate a MySQL
3. Abre `Heimdall_Tech.sql`
4. Ejecuta el script completo

Opción 2: desde terminal (PowerShell)

```powershell
cd "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech"
mysql -u root -p
```

Luego dentro de MySQL:

```sql
SOURCE C:/Users/Ian de Jesus/Documents/Heimdall_Tech/Heimdall_Tech/Heimdall_Tech.sql;
```

O si prefieres usar el comando directo en PowerShell:

```powershell
Get-Content "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech\Heimdall_Tech.sql" | mysql -u root -p
```

> Importante: este script debe ejecutarse antes de iniciar Django, porque el proyecto usa modelos con `managed = False` y la base de datos real ya está definida en SQL.

### 4. Configurar las variables de entorno

Entra a:

```text
backend/.env
```

Y asegúrate de que tenga algo como esto:

```env
DJANGO_SECRET_KEY=change-me-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=heimdall_tech
DB_USER=root
DB_PASSWORD=101001
DB_HOST=127.0.0.1
DB_PORT=3306
```

> En producción se recomienda cambiar esta configuración por valores seguros.

### 5. Crear e iniciar el entorno virtual

Desde la carpeta `backend`:

```powershell
cd "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 6. Instalar dependencias

```powershell
pip install -r requirements.txt
```

### 7. Verificar y compilar traducciones

```powershell
python manage.py check
pybabel compile -d locale -D django
```

### 8. Confirmar que la conexión a MySQL funciona

```powershell
python manage.py check
```

Si no hay errores, la configuración está correcta y la base de datos está lista.

### 9. Iniciar el servidor Django

```powershell
python manage.py runserver 8000
```

Luego abre en el navegador:

- http://127.0.0.1:8000/
- http://127.0.0.1:8000/admin/
- http://127.0.0.1:8000/api/

### 10. Crear usuarios admin (si hace falta)

```powershell
python manage.py createsuperuser
```

Ejemplo usado en el proyecto:

- Usuario: `IanLR`
- Correo: `ian99090@gmail.com`
- Contraseña: `miacarola2004`

Y también:

- Usuario: `rastor65`
- Correo: `rdamianquintero@uniguajira.edu.co`
- Contraseña: `123456789`

### 11. ¿Qué pasa si no ejecutas el SQL antes?

Si no ejecutas `Heimdall_Tech.sql` primero, Django no encontrará las tablas reales y la API no podrá consultar información real del sistema.

Por eso este proyecto usa la base de datos relacional real como fuente principal y no depende solo del ORM en vacío.

### 12. URLs principales del proyecto

### Panel administrativo

```text
http://127.0.0.1:8000/admin/
```

### API base

```text
http://127.0.0.1:8000/api/
```

### Endpoints principales

```text
http://127.0.0.1:8000/api/empresas/planes/
http://127.0.0.1:8000/api/empresas/establecimientos/?id_establecimiento=1

http://127.0.0.1:8000/api/identidad/roles/
http://127.0.0.1:8000/api/identidad/usuarios/?id_establecimiento=1

http://127.0.0.1:8000/api/operaciones/responsables/?id_establecimiento=1
http://127.0.0.1:8000/api/operaciones/vehiculos/?id_establecimiento=1
http://127.0.0.1:8000/api/operaciones/movimientos/?id_establecimiento=1
http://127.0.0.1:8000/api/operaciones/incidencias/?id_establecimiento=1

http://127.0.0.1:8000/api/inteligencia/reconocimientos/?id_establecimiento=3
```

## 13. Nota importante sobre el diseño SaaS

Los módulos operativos exigen el parámetro:

```text
?id_establecimiento=1
```

Esto es correcto y está pensado para que cada cliente/establecimiento vea solo su información, evitando que un usuario vea datos de otro establecimiento.

## 14. Resumen rápido

Para iniciar el backend correctamente:

```powershell
cd "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech"
mysql -u root -p
# ejecutar Heimmall_Tech.sql

cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py check
python manage.py runserver 8000
```

## 15. Recomendación final

Si vas a presentar el proyecto o a entregarlo a otra persona, primero activa el script SQL y luego arranca Django. Así te aseguras de que el backend está conectado con la base de datos real y no con un esquema vacío.

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
