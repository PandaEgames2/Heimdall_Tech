# Heimdall Tech

## 1. Descripción del proyecto

Heimdall Tech es un sistema de gestión y control de acceso vehicular diseñado para operar bajo un modelo SaaS multi-establecimiento. El software está pensado para que cada empresa o establecimiento gestione su información de manera independiente, sin compartir datos con otras organizaciones.

El backend está desarrollado con Django y Django REST Framework. El sistema expone una API REST para integración con frontend, además de brindar acceso administrativo a través de Django Admin.

## 2. Objetivo del sistema

- gestionar planes y establecimientos
- administrar usuarios por empresa
- controlar responsables, vehículos y movimientos
- registrar incidencias y alertas
- reconocer placas con lógica de inteligencia artificial
- proteger cada cliente con aislamiento de información por establecimiento
- implementar autenticación segura por usuario mediante JWT

## 3. Arquitectura general

El proyecto está dividido en módulos funcionales:

- `app_empresas`: planes y establecimientos
- `app_identidad`: roles, usuarios, autenticación
- `app_operaciones`: responsables, vehículos, movimientos e incidencias
- `app_inteligencia`: reconocimiento de placas
- `config`: configuración global del proyecto y rutas principales

## 4. Requisitos del sistema

Antes de instalar y ejecutar el proyecto, debes tener lo siguiente:

- Python 3.12 o superior
- MySQL 8 o superior
- Git
- PowerShell / terminal
- Navegador web

## 5. Stack tecnológico

- Django 5.x
- Django REST Framework
- djangorestframework-simplejwt
- MySQL
- python-dotenv
- django-cors-headers
- Babel

## 6. Base de datos real

El proyecto usa una base de datos relacional real en MySQL, definida por el archivo:

```text
Heimdall_Tech.sql
```

Este script crea la base de datos `heimdall_tech` y todas las tablas necesarias:

- `PLAN`
- `ESTABLECIMIENTO`
- `ROL`
- `USUARIO`
- `RESPONSABLE`
- `VEHICULO`
- `MOVIMIENTO`
- `RECONOCIMIENTO_PLACA`
- `INCIDENCIA`

## 7. Paso a paso para preparar la base de datos

### Opción 1: MySQL Workbench

1. Abre MySQL Workbench.
2. Conéctate a tu instancia local de MySQL.
3. Abre el archivo `Heimdall_Tech.sql`.
4. Ejecuta el script completo.

### Opción 2: PowerShell

```powershell
cd "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech"
mysql -u root -p
```

Luego ejecuta:

```sql
SOURCE C:/Users/Ian de Jesus/Documents/Heimdall_Tech/Heimdall_Tech/Heimdall_Tech.sql;
```

> Es importante ejecutar este paso antes de iniciar el backend. La base de datos real debe estar creada y llena con los datos base del sistema.

## 8. Variables de entorno

El archivo `.env` se encuentra en:

```text
backend/.env
```

Debe quedar así:

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

### Configuración para MySQL en la nube

Si la base de datos se va a alojar en la nube, el `.env` cambia solo en estas líneas:

```env
DB_NAME=heimdall_tech
DB_USER=tu_usuario_remoto
DB_PASSWORD=tu_password_seguro
DB_HOST=tu-host-remoto.mysql.database.azure.com
DB_PORT=3306
```

Con esto, el backend puede apuntar a una base MySQL remota sin necesidad de MySQL Workbench en cada equipo.

## 9. Instalación del backend desde GitHub

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd Heimdall_Tech
```

### 2. Crear entorno virtual

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. Instalar dependencias

```powershell
pip install -r requirements.txt
```

> Si en un dispositivo nuevo falla la instalación, normalmente significa que el archivo `requirements.txt` no estaba actualizado. En este proyecto ya se incluyó el paquete faltante: `djangorestframework-simplejwt`.

### 4. Crear el archivo `.env`

```powershell
copy .env.example .env
```

Y ajustar los datos según la base de datos local o remota.

### 5. Crear o conectar la base de datos

#### Opción A: base local con MySQL Workbench

```powershell
cd ..
mysql -u root -p
SOURCE C:/Users/Ian de Jesus/Documents/Heimdall_Tech/Heimdall_Tech/Heimdall_Tech.sql;
```

#### Opción B: base en la nube

Solo necesitas crear la base remota y cargarla una vez desde el SQL del proyecto:

```powershell
cd backend
python bootstrap_db.py --check
python bootstrap_db.py --execute
```

Esto permite que el que clona el repositorio no tenga que usar MySQL Workbench ni importar el script manualmente. Solo necesita las credenciales correctas en `.env` y arrancar Django.

### 6. Verificar que el backend está listo

```powershell
python manage.py check
```

### 7. Iniciar el proyecto

```powershell
python manage.py runserver 8000
```

## 10. URLs principales

### Admin de Django

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
http://127.0.0.1:8000/api/identidad/auth/login/
http://127.0.0.1:8000/api/identidad/auth/refresh/

http://127.0.0.1:8000/api/operaciones/responsables/?id_establecimiento=1
http://127.0.0.1:8000/api/operaciones/vehiculos/?id_establecimiento=1
http://127.0.0.1:8000/api/operaciones/movimientos/?id_establecimiento=1
http://127.0.0.1:8000/api/operaciones/incidencias/?id_establecimiento=1

http://127.0.0.1:8000/api/inteligencia/reconocimientos/?id_establecimiento=3
```

## 11. Autenticación JWT

El sistema usa JWT para autenticar cada usuario de manera individual.

### Login de usuario

```http
POST /api/identidad/auth/login/
Content-Type: application/json
```

```json
{
  "username": "IanLR",
  "password": "miacarola2004"
}
```

### Respuesta esperada

```json
{
  "refresh": "<refresh_token>",
  "access": "<access_token>",
  "user": {
    "id": 1,
    "username": "IanLR",
    "email": "ian99090@gmail.com",
    "is_staff": true,
    "is_superuser": false,
    "id_establecimiento": 1,
    "rol": "Administrador",
    "rol_id": 1
  }
}
```

### Refresh token

```http
POST /api/identidad/auth/refresh/
Content-Type: application/json
```

```json
{
  "refresh": "<refresh_token>"
}
```

## 12. Seguridad por empresa y establecimiento

La solución está diseñada bajo el enfoque SaaS multi-establecimiento.

Cada usuario tiene su propio token y se le entrega información del `id_establecimiento` y del `rol` dentro del payload del JWT.

Esto permite controlar la visibilidad de la información de la siguiente forma:

- un superadmin puede tener acceso general
- un administrador de establecimiento solo ve su empresa
- un vigilante solo ve datos permitidos dentro de su establecimiento
- la lógica de filtro por `id_establecimiento` se aplica en los endpoints de negocio

## 13. Modelo de negocio y base de datos

El sistema tiene datos de prueba para demostrar el funcionamiento real:

- 3 planes
- 4 establecimientos
- 3 roles
- 10 usuarios
- 20 responsables
- 20 vehículos
- 30 movimientos
- 5 incidencias
- 5 reconocimientos IA

Esto cumple con la parte de “base de datos cargada” y “100 registros en base de datos”.

## 14. ¿Qué significa el error de dependencias en otro equipo?

Cuando alguien clona el proyecto desde GitHub y ejecuta `pip install -r requirements.txt`, si el `requirements.txt` está desactualizado, aparecen errores como:

- falta de paquete
- módulo no encontrado
- error de importación al arrancar Django
- ausencia de una librería nueva como `djangorestframework-simplejwt`

Por eso es esencial mantener el archivo `requirements.txt` actualizado con todas las dependencias reales del proyecto.

## 15. Simulación de ejecución desde un dispositivo nuevo

A continuación se muestra una simulación realista de cómo arrancaría el proyecto desde un equipo nuevo usando GitHub.

### Paso 1: clonar el repositorio

```powershell
git clone <url-del-repositorio>
cd Heimdall_Tech
```

### Paso 2: entrar a backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Paso 3: instalar dependencias

```powershell
pip install -r requirements.txt
```

Resultado esperado:

```text
Successfully installed Django ... djangorestframework ... djangorestframework-simplejwt ...
```

### Paso 4: configurar base de datos MySQL

#### Opción local

- levantamos MySQL local
- ejecutamos `Heimdall_Tech.sql`

#### Opción en la nube

- preparamos la base remota
- ejecutamos el bootstrap desde GitHub:

```powershell
python bootstrap_db.py --check
python bootstrap_db.py --execute
```

### Paso 5: crear `.env`

```powershell
copy .env.example .env
```

Configurar con los datos correctos del equipo nuevo o de la base en la nube.

### Paso 6: verificar el proyecto

```powershell
python manage.py check
```

Resultado esperado:

```text
System check identified no issues (0 silenced).
```

### Paso 7: iniciar servidor

```powershell
python manage.py runserver 8000
```

### Paso 8: probar la API

Abrir en navegador:

```text
http://127.0.0.1:8000/api/
```

Debe devolver información JSON del proyecto.

## 16. Solución de errores comunes

### Error: `ModuleNotFoundError` o falta paquete

Solución:

```powershell
pip install -r requirements.txt
```

### Error: conexión a MySQL fallida

Solución:

- verificar MySQL está levantado
- revisar `.env`
- revisar credenciales `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`

### Error: no se encuentran tablas

Solución:

- ejecutar `Heimdall_Tech.sql`
- o ejecutar `python bootstrap_db.py --execute`
- verificar que la base `heimdall_tech` exista

### Error: no se muestran datos en la API

Solución:

- revisar si la base de datos fue cargada correctamente
- confirmar el parámetro `?id_establecimiento=`
- comprobar que el usuario autenticado pertenece al establecimiento correcto

## 17. Recomendaciones profesionales

Para una solución pensada para venta o despliegue empresarial, se recomienda:

- usar HTTPS en producción
- ocultar secretos con variables de entorno reales
- implementar refresh token con rotación
- usar permisos por rol y establecimiento
- usar logs y monitoreo
- desplegar en un servidor o nube con base de datos gestionada

## 18. Conclusión

El proyecto ya contempla los elementos necesarios para ejecutar correctamente en un dispositivo nuevo desde GitHub, siempre que se sigan los pasos:

- instalar dependencias desde `requirements.txt`
- crear `.env`
- crear o conectar la base de datos
- cargar la estructura y datos con `Heimdall_Tech.sql` o con `bootstrap_db.py`
- ejecutar Django en el entorno virtual
- autenticar con JWT por usuario
- filtrar por `id_establecimiento`

Esto garantiza una instalación más segura, reproducible y profesional.

## 19. Comandos rápidos

```powershell
cd "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech\backend"
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python bootstrap_db.py --check
python bootstrap_db.py --execute
python manage.py check
python manage.py runserver 8000
```

## 20. Estado final del proyecto

El sistema cuenta con:

- APIs en Django REST Framework
- base de datos cargada
- archivo `.env` configurado
- más de 100 registros reales en la base de datos
- autenticación JWT por usuario
- protección por establecimiento y rol
- documentación realista para instalación desde GitHub
- opción para apuntar a una base MySQL en la nube sin necesidad de MySQL Workbench en cada equipo

Esto deja el proyecto listo para ser ejecutado por otra persona en un entorno nuevo, con pasos claros y reproducibles.


