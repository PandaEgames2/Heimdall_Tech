# Heimdall Tech

## 1. Descripción del proyecto

Heimdall Tech es un sistema de gestión y control de acceso vehicular orientado a un modelo SaaS multi-establecimiento. Está pensado para que cada empresa o establecimiento administre su información de manera aislada, sin mezclar datos entre clientes.

El backend se desarrolló con Django y Django REST Framework, exponiendo una API REST para integración con frontend y proporcionando acceso administrativo a través de Django Admin.

## 2. Objetivo y alcance

- gestionar planes y establecimientos
- administrar usuarios por empresa
- controlar responsables, vehículos y movimientos
- registrar incidencias y alertas
- reconocer placas con lógica de IA
- mantener aislamiento de datos por `id_establecimiento`
- autenticar cada usuario de forma segura con JWT
- preparar una solución reproducible para otra máquina que clone el repositorio

## 3. Arquitectura del sistema

La organización funcional es la siguiente:

- `app_empresas`: planes y establecimientos
- `app_identidad`: roles, usuarios, autenticación y perfil
- `app_operaciones`: responsables, vehículos, movimientos e incidencias
- `app_inteligencia`: reconocimiento de placas
- `config`: configuración global, rutas y utilidades

## 4. Requisitos del sistema

Antes de ejecutar el proyecto, necesitas:

- Python 3.12+
- MySQL 8+
- Git
- PowerShell o terminal compatible
- acceso a la base de datos local

## 5. Stack tecnológico

- Django 5.x
- Django REST Framework
- djangorestframework-simplejwt
- mysqlclient
- mysql-connector-python
- python-dotenv
- django-cors-headers
- Babel

## 6. Base de datos real

El proyecto usa MySQL como motor principal. La base se define en:

```text
Heimdall_Tech.sql
```

Ese script crea la base `heimdall_tech` y las siguientes tablas:

- `PLAN`
- `ESTABLECIMIENTO`
- `ROL`
- `USUARIO`
- `RESPONSABLE`
- `VEHICULO`
- `MOVIMIENTO`
- `RECONOCIMIENTO_PLACA`
- `INCIDENCIA`

## 7. Preparación de la base de datos local

### Opción 1: MySQL Workbench

1. Abre MySQL Workbench.
2. Conéctate a tu instancia local de MySQL.
3. Abre `Heimdall_Tech.sql`.
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

> Este paso es obligatorio para que el backend tenga tablas y datos de prueba. Sin esto, la API no podrá devolver información real.

## 8. Variables de entorno

El archivo `.env` debe estar en:

```text
backend/.env
```

Ejemplo válido:

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

> El proyecto funciona sobre entorno local. No es necesario un servicio en la nube para que el sistema funcione correctamente.

## 9. Instalación desde GitHub en otra computadora

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

### 4. Crear el archivo `.env`

```powershell
copy .env.example .env
```

Luego edita `.env` con los datos correctos de tu MySQL local.

### 5. Ejecutar la base de datos

```powershell
cd ..
mysql -u root -p
SOURCE C:/ruta/al/proyecto/Heimdall_Tech.sql;
```

O, si se prefiere automatizarlo desde el proyecto:

```powershell
cd backend
python bootstrap_db.py --check
python bootstrap_db.py --execute
```

### 6. Validar que el backend está listo

```powershell
python manage.py check
```

Resultado esperado:

```text
System check identified no issues (0 silenced).
```

### 7. Iniciar el sistema

```powershell
python manage.py runserver 8000
```

## 10. Endpoints principales

### Admin de Django

```text
http://127.0.0.1:8000/admin/
```

### API base

```text
http://127.0.0.1:8000/api/
```

### Health check

```text
http://127.0.0.1:8000/api/health/
```

### Rutas principales

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

El sistema usa JWT para autenticar a cada usuario de forma individual.

### Login

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

## 12. Seguridad y reglas del sistema

El proyecto está diseñado con la lógica SaaS multi-establecimiento:

- cada usuario tiene su propio token
- cada token incluye contexto del usuario y del establecimiento
- los endpoint de negocio requieren `?id_establecimiento=` para evitar mezcla de datos
- el acceso se valida por usuario autenticado y contexto empresarial

## 13. Datos base del sistema

La base de datos contiene datos reales de prueba para validar comportamiento del sistema:

- 3 planes
- 4 establecimientos
- 3 roles
- 10 usuarios
- 20 responsables
- 20 vehículos
- 30 movimientos
- 5 incidencias
- 5 reconocimientos IA

Esto suma 100 registros y cumple con la validación de datos cargados.

## 14. Dependencias oficiales del proyecto

El archivo `backend/requirements.txt` contiene exactamente lo necesario para ejecutar el proyecto:

```text
Django>=5.0,<6
djangorestframework>=3.15,<4
djangorestframework-simplejwt>=5.3,<6
mysqlclient>=2.2,<3
mysql-connector-python>=9.0,<10
python-dotenv>=1.0,<2
django-cors-headers>=4.3,<5
Babel>=2.14,<3
```

> No se incluyen servicios en la nube ni paquetes comerciales porque este proyecto funciona en entorno local por decisión técnica y presupuestaria.

## 15. Simulación de ejecución en otra máquina

Este es el flujo exacto para una persona que clone el repositorio desde GitHub y lo ejecute en otra PC.

### Paso 1: clonar

```powershell
git clone <url-del-repositorio>
cd Heimdall_Tech
```

### Paso 2: crear entorno virtual

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Paso 3: instalar dependencias

```powershell
pip install -r requirements.txt
```

### Paso 4: configurar MySQL local

- iniciar MySQL local
- crear la base `heimdall_tech`
- ejecutar `Heimdall_Tech.sql`

### Paso 5: crear `.env`

```powershell
copy .env.example .env
```

Luego ajustar:

```env
DB_NAME=heimdall_tech
DB_USER=root
DB_PASSWORD=tu_password
DB_HOST=127.0.0.1
DB_PORT=3306
```

### Paso 6: verificar arranque

```powershell
python manage.py check
```

### Paso 7: abrir la aplicación

```powershell
python manage.py runserver 8000
```

### Paso 8: probar la API

```text
http://127.0.0.1:8000/api/
```

## 16. Diagnóstico de errores comunes

### Error: `ModuleNotFoundError`

Solución:

```powershell
pip install -r requirements.txt
```

### Error: conexión a MySQL fallida

Solución:

- verificar que MySQL esté levantado
- revisar `.env`
- confirmar `DB_HOST`, `DB_USER`, `DB_PASSWORD` y `DB_PORT`

### Error: no se encuentran tablas

Solución:

- ejecutar `Heimdall_Tech.sql`
- o ejecutar:

```powershell
python bootstrap_db.py --execute
```

### Error: no hay datos en la API

Solución:

- comprobar que la base de datos fue cargada
- revisar el parámetro `?id_establecimiento=`
- confirmar que el usuario autenticado pertenece al establecimiento correcto

## 17. Recomendaciones profesionales

Para una solución de nivel profesional y futura evolución, se recomienda:

- usar HTTPS en producción
- limitar secretos en variables de entorno reales
- usar token de refresh con rotación
- aplicar permisos por rol y establecimiento
- implementar logs y monitoreo
- mantener copias de seguridad periódicas de MySQL
- desplegar en un entorno controlado cuando se requiera producción real

## 18. Conclusión

El proyecto está en un estado funcional y profesional para entorno local, con autenticación JWT, aislamiento por establecimiento, API REST real y base de datos cargada. Se ha validado que el sistema arranca correctamente y que la base contiene 100 registros.

El enfoque actual es claro:

- no depende de una nube paga
- funciona con MySQL local
- se puede clonar desde GitHub y configurar en otra PC
- la documentación y dependencias están alineadas con lo que realmente existe en el proyecto

## 19. Comandos rápidos

```powershell
cd "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech\backend"
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py check
python manage.py runserver 8000
```

## 20. Estado final

El proyecto tiene:

- APIs en Django REST Framework
- base de datos local cargada
- archivo `.env` configurado
- más de 100 registros reales
- autenticación JWT por usuario
- seguridad y contexto por establecimiento y rol
- documentación actualizada para entorno local sin nube

Esto deja el sistema listo para ser ejecutado por otra persona en otra máquina con los pasos correctos y reproducibles.


