# Heimdall Tech Backend

## 1. Descripción general

Heimdall Tech es una plataforma de gestión y control de acceso vehicular orientada a un modelo SaaS multi-establecimiento. La solución está diseñada para que cada empresa o establecimiento pueda operar de forma aislada, sin acceder a la información de otras organizaciones.

El backend está desarrollado con Django y Django REST Framework, conectado a una base de datos MySQL y expone una API REST para uso por un frontend web o móvil.

El sistema contempla:

- gestión de planes y establecimientos
- administración de usuarios por empresa
- control de accesos, movimientos vehiculares y responsables
- manejo de incidencias y alertas
- reconocimiento de placas con inteligencia artificial
- seguridad por JWT por usuario
- segregación de datos por `id_establecimiento`

## 2. Objetivos del sistema

- Gestionar planes y clientes empresariales.
- Administrar establecimientos y usuarios asociados.
- Controlar responsables, vehículos, movimientos y incidencias.
- Mantener una arquitectura escalable y multi-tenant.
- Proveer APIs para integración frontend.
- Implementar autenticación segura y permisos por rol.

## 3. Stack tecnológico

- Python 3.12+
- Django 5.x
- Django REST Framework
- MySQL 8+
- djangorestframework-simplejwt
- django-cors-headers
- python-dotenv

## 4. Requisitos previos

Antes de iniciar el backend debes tener instalado:

- Python 3.12 o superior
- MySQL Server 8 o superior
- Git
- PowerShell o terminal equivalente
- Navegador web para probar endpoints y admin

## 5. Estructura del proyecto

```text
Heimdall_Tech/
├── Heimdall_Tech.sql
├── backend/
│   ├── .env
│   ├── .venv/
│   ├── manage.py
│   ├── requirements.txt
│   ├── README.md
│   ├── app_empresas/
│   ├── app_identidad/
│   ├── app_operaciones/
│   ├── app_inteligencia/
│   └── config/
└── ENLACES_RAPIDOS.md
```

## 6. Preparación de la base de datos MySQL

Antes de levantar Django, debes ejecutar el script SQL principal localizado en la raíz del proyecto:

```text
Heimdall_Tech.sql
```

Este archivo crea la base de datos `heimdall_tech` y las tablas necesarias para el sistema:

- `PLAN`
- `ESTABLECIMIENTO`
- `ROL`
- `USUARIO`
- `RESPONSABLE`
- `VEHICULO`
- `MOVIMIENTO`
- `RECONOCIMIENTO_PLACA`
- `INCIDENCIA`

### Forma de ejecución

#### Opción A: MySQL Workbench

1. Abrir MySQL Workbench.
2. Conectarse a MySQL.
3. Cargar el archivo `Heimdall_Tech.sql`.
4. Ejecutar el script completo.

#### Opción B: PowerShell

```powershell
cd "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech"
mysql -u root -p
```

Dentro de MySQL:

```sql
SOURCE C:/Users/Ian de Jesus/Documents/Heimdall_Tech/Heimdall_Tech/Heimdall_Tech.sql;
```

> Importante: este paso es obligatorio antes de iniciar Django, porque el proyecto usa tablas reales y no depende de migraciones automáticas para la lógica principal del negocio.

## 7. Configuración del entorno

El archivo `backend/.env` debe tener una configuración similar a esta:

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

> En producción se recomienda cambiar valores sensibles por secretos reales y usar HTTPS.

## 8. Crear entorno virtual

Desde la carpeta `backend`:

```powershell
cd "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

## 9. Instalar dependencias

```powershell
pip install -r requirements.txt
```

## 10. Verificar conexión y configuración

```powershell
python manage.py check
```

Si todo está bien, el comando debe devolver:

```text
System check identified no issues (0 silenced).
```

## 11. Iniciar el backend

```powershell
python manage.py runserver 8000
```

La aplicación quedará disponible en:

- http://127.0.0.1:8000/
- http://127.0.0.1:8000/admin/
- http://127.0.0.1:8000/api/

## 12. Autenticación JWT por usuario

El sistema usa JWT para autenticar a cada usuario de forma individual.

Cada inicio de sesión genera un token propio, con información del usuario, su rol y su establecimiento.

### Endpoint de login

```text
http://127.0.0.1:8000/api/identidad/auth/login/
```

Ejemplo de petición JSON:

```json
{
  "username": "IanLR",
  "password": "miacarola2004"
}
```

### Endpoint de refresh

```text
http://127.0.0.1:8000/api/identidad/auth/refresh/
```

Ejemplo:

```json
{
  "refresh": "<refresh_token>"
}
```

### Token generado

El JWT incluye información útil para controlar permisos y contexto empresarial:

- `user_id`
- `username`
- `email`
- `is_staff`
- `is_superuser`
- `id_establecimiento`
- `rol`
- `rol_id`

Esto permite que el sistema sepa exactamente:

- quién es el usuario autenticado
- a qué empresa o establecimiento pertenece
- qué permisos tiene según su rol

## 13. Modelo SaaS / multi-establecimiento

La arquitectura del proyecto está pensada para un SaaS multi-clientes o multi-establecimientos.

Por este motivo, las consultas de negocio requieren el parámetro `id_establecimiento` para evitar fugas de información entre clientes.

### Ejemplos correctos

```text
http://127.0.0.1:8000/api/identidad/usuarios/?id_establecimiento=1
http://127.0.0.1:8000/api/operaciones/vehiculos/?id_establecimiento=1
http://127.0.0.1:8000/api/operaciones/responsables/?id_establecimiento=1
http://127.0.0.1:8000/api/inteligencia/reconocimientos/?id_establecimiento=3
```

### Regla de negocio

- Un usuario solo debe ver información de su establecimiento.
- Un administrador de empresa no puede ver información de otra empresa.
- Un superadmin puede tener acceso global, según la estrategia de permisos de la solución.

## 14. Permisos por rol

El sistema está pensado para diferenciar roles de acceso.

### Roles conceptuales

- `Superadmin`: acceso global y administrativo completo
- `Administrador`: gestión del establecimiento al que pertenece
- `Vigilante`: operaciones restringidas de validación y control
- `Supervisor`: revisión y reportes

La idea es que el token lleve el `rol` y el `id_establecimiento`, para filtrar los datos desde el backend.

## 15. Endpoints principales

### API base

```text
http://127.0.0.1:8000/api/
```

### Empresas

```text
http://127.0.0.1:8000/api/empresas/planes/
http://127.0.0.1:8000/api/empresas/establecimientos/?id_establecimiento=1
```

### Identidad

```text
http://127.0.0.1:8000/api/identidad/roles/
http://127.0.0.1:8000/api/identidad/usuarios/?id_establecimiento=1
http://127.0.0.1:8000/api/identidad/auth/login/
http://127.0.0.1:8000/api/identidad/auth/refresh/
```

### Operaciones

```text
http://127.0.0.1:8000/api/operaciones/responsables/?id_establecimiento=1
http://127.0.0.1:8000/api/operaciones/vehiculos/?id_establecimiento=1
http://127.0.0.1:8000/api/operaciones/movimientos/?id_establecimiento=1
http://127.0.0.1:8000/api/operaciones/incidencias/?id_establecimiento=1
```

### Inteligencia

```text
http://127.0.0.1:8000/api/inteligencia/reconocimientos/?id_establecimiento=3
```

### Meta

```text
http://127.0.0.1:8000/api/meta/idiomas/
http://127.0.0.1:8000/api/meta/catalogo-enums/
```

## 16. Usuarios de demostración

En el proyecto existen usuarios de prueba que pueden usar el sistema en entorno local.

Ejemplos:

- `IanLR`
- `rastor65`

## 17. Recomendaciones de seguridad para producción

Para una versión real de producción, se recomienda:

- usar JWT con expiración corta
- usar refresh tokens con rotación
- habilitar HTTPS
- proteger variables de entorno con secretos reales
- restringir accesos por rol y por establecimiento
- validar permisos en cada endpoint de negocio
- usar un sistema de logs y auditoría

## 18. Buenas prácticas del proyecto

- mantener la separación por apps (`empresas`, `identidad`, `operaciones`, `inteligencia`)
- no exponer información sensible como `password_hash`
- filtrar por `id_establecimiento` en consultas del negocio
- usar JWT para autenticar usuarios sin depender de sesiones del navegador
- manejar roles explícitos para permisos y acceso a recursos

## 19. Flujo recomendado para arrancar el proyecto

```powershell
cd "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech"

# 1. Ejecutar la BD SQL
# Abrir y correr Heimdall_Tech.sql desde MySQL

# 2. Entrar a backend
cd backend

# 3. Activar entorno virtual
.\.venv\Scripts\Activate.ps1

# 4. Instalar dependencias
pip install -r requirements.txt

# 5. Validar proyecto
python manage.py check

# 6. Iniciar servidor
python manage.py runserver 8000
```

## 20. Conclusión

Heimdall Tech ya está preparado para una arquitectura profesional de backend empresarial, con:

- autenticación JWT individual por usuario
- trazabilidad por usuario, rol y establecimiento
- segmentación de datos por empresa o establecimiento
- API REST para integración con frontend
- base de datos relacional con esquema real en MySQL

Esto responde a una estructura de software más orientada a producción, a negocio y a posible venta o despliegue empresarial.
