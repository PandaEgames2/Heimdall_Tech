# Heimdall Tech

Sistema web de control de acceso vehicular y gestión de establecimientos. El proyecto usa Django REST Framework para la API, React + Vite para la interfaz y MySQL para los datos.

## Funciones disponibles

- Gestión de establecimientos, planes, usuarios, responsables y vehículos.
- Registro manual de ingresos, salidas e incidencias por vigilancia.
- Acceso de residentes mediante QR temporal o código numérico de respaldo de 6 dígitos (vence en 90 segundos y se usa una sola vez).
- Invitaciones QR para visitantes, vinculadas con el residente anfitrión, con registro de entrada y salida.
- RFID en los planes que lo permiten (el lector debe funcionar como teclado USB/keyboard wedge).
- Vistas y operaciones diferenciadas por rol y establecimiento. Solo el Super Admin puede crear administradores de establecimiento y administrar roles; los administradores crean supervisores, vigilantes y residentes de su propio establecimiento.
- La administración de usuarios está limitada por establecimiento; las cuentas de Super Admin no aparecen para los administradores de conjuntos.
- Cada establecimiento consulta únicamente su plan contratado. Los módulos no incluidos muestran un aviso y la API también aplica el límite de plan.
- Reconocimiento de placas FastALPR basado en DNN (YOLOv9 para localizar placas y OCR ONNX para leerlas), desde una captura de cámara. Cada lectura requiere confirmación del vigilante antes de registrar el acceso.
- Interfaz de identidad Heimdall con iconos SVG propios, ojo vigilante y acentos inspirados en Bifröst.

## Requisitos

- Windows 10/11 y PowerShell.
- Git.
- Python 3.12 de 64 bits (versión de referencia para el proyecto).
- MySQL Server 8.0 o superior, iniciado localmente. El usuario de base de datos debe poder crear la base y sus tablas durante una instalación limpia.
- Node.js 20.19 o superior, o 22.12 o superior (incluye npm).
- Navegador actualizado (Chrome o Edge recomendado para probar cámara y QR).
- Internet durante la instalación de dependencias y la primera inferencia FastALPR, que descarga los modelos DNN/OCR.

En Windows, `pip` normalmente instala `mysqlclient` desde un wheel. Si intenta compilarlo y falla, instala MariaDB Connector/C y las herramientas de compilación de Visual Studio compatibles con tu versión de Python; consulta la [guía oficial de mysqlclient para Windows](https://github.com/PyMySQL/mysqlclient/blob/main/README.md#install). Vite requiere Node.js 20.19+ o 22.12+ ([documentación oficial](https://vite.dev/guide/)).

Instaladores oficiales: [Python para Windows](https://www.python.org/downloads/windows/), [Node.js](https://nodejs.org/en/download/) y [MySQL Community Server](https://dev.mysql.com/downloads/mysql/). MySQL Workbench es opcional; Heimdall incluye `bootstrap_db.py` para cargar el esquema.

## Inicio paso a paso

### 1. Clona el repositorio

Sustituye `<URL_DEL_REPOSITORIO>` por la URL de GitHub del proyecto:

```powershell
git clone <URL_DEL_REPOSITORIO>
cd Heimdall_Tech
```

Si ya tienes el repositorio local, abre PowerShell en la carpeta que contiene `iniciar.ps1` y continúa con el paso 2.

### 2. Inicia MySQL

Asegúrate de que el servicio MySQL esté activo y conoce el usuario, la contraseña y el puerto de la instancia local (normalmente `3306`).

### 3. Instala las dependencias del backend

Desde la raíz del repositorio:

```powershell
py -3.12 -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r .\backend\requirements.txt
```

Si PowerShell bloquea la activación del entorno, permite scripts solo durante la sesión actual:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\backend\.venv\Scripts\Activate.ps1
```

### 4. Configura la conexión a MySQL

Crea el archivo de configuración local:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
```

Edita `backend\.env` y configura al menos estos valores según tu MySQL:

```env
DJANGO_SECRET_KEY=una-clave-local
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=heimdall_tech
DB_USER=root
DB_PASSWORD=tu_contraseña_de_mysql
DB_HOST=127.0.0.1
DB_PORT=3306
```

No subas el archivo `backend\.env` a GitHub; contiene credenciales locales.

### 5. Prepara la base de datos

**Si ya tienes una base Heimdall con datos que quieres conservar:** no ejecutes `Heimdall_Tech.sql` ni `bootstrap_db.py --execute`. El SQL elimina y vuelve a crear tablas. El script de inicio solo comprueba la conexión y aplica las adiciones de esquema necesarias de forma idempotente.

**Si es una instalación nueva y la base todavía no existe:** desde la carpeta `backend`, ejecuta una sola vez:

```powershell
cd backend
python bootstrap_db.py --check
python bootstrap_db.py --execute
cd ..
```

`--execute` crea la base `heimdall_tech` e importa `Heimdall_Tech.sql`. Úsalo únicamente en una base nueva o desechable, porque ese SQL contiene instrucciones que eliminan y vuelven a crear tablas existentes dentro de esa base. También puedes importarlo desde MySQL Workbench. El usuario configurado en `backend\.env` necesita permiso para crear bases de datos y tablas.

El proyecto usa dos grupos de tablas: el SQL crea las tablas funcionales de Heimdall y el comando `manage.py migrate` crea las tablas internas de Django (autenticación y sesiones). `iniciar.ps1` ejecuta las migraciones de Django automáticamente; no borra las tablas funcionales.

### 6. Instala las dependencias del frontend

```powershell
cd frontend
npm ci
cd ..
```

El frontend usa la API en `http://localhost:8000/api` por defecto. Si necesitas cambiarla, copia `frontend\.env.example` a `frontend\.env` y asigna `VITE_API_URL`.

### 7. Inicia la aplicación

Desde la raíz del repositorio:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

El script comprueba MySQL, aplica las migraciones internas de Django, prepara roles/cuentas demo y el esquema operativo, valida Django e inicia API y frontend. No importa el SQL ni reinicia tus datos. En una instalación nueva, importa primero `Heimdall_Tech.sql` con el paso 5.

La primera captura LPR puede tardar más porque FastALPR descarga sus modelos de IA. Se necesita conexión a Internet para esa descarga inicial; las siguientes capturas reutilizan los modelos locales.

Abre:

- Aplicación: <http://localhost:5173/>
- API: <http://localhost:8000/api/>
- Estado de API y base de datos: <http://localhost:8000/api/health/>

### Arranque manual (opcional)

Con MySQL iniciado, el entorno virtual y las dependencias instaladas, abre dos terminales en la raíz del proyecto.

Terminal 1 — backend:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py migrate --noinput
python manage.py ensure_demo_accounts
python manage.py ensure_operational_schema
python manage.py check
python manage.py runserver 127.0.0.1:8000
```

Terminal 2 — frontend:

```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Para detener el arranque manual, usa `Ctrl+C` en cada terminal.

## Cuentas locales de demostración

El comando `ensure_demo_accounts` agrega los roles necesarios y crea las cuentas demo si no existen. También registra al residente como responsable de la unidad Casa 14, Torre B. Las cuentas de prueba son:

| Rol | Usuario | Contraseña |
|---|---|---|
| Super Admin | `admin` | `miacarola` |
| Super Admin alternativo | `rastor36` | `miacarola` |
| Vigilante de Los Pinos | `vigilante@pinos.com` | `hash_pass_123` |
| Residente de Los Pinos | `residente@pinos.com` | `hash_pass_123` |

Son credenciales de desarrollo. Cámbialas antes de usar el sistema fuera de un entorno local.

## Prueba rápida de los flujos

1. Inicia sesión como `residente@pinos.com` y abre **Mi QR e invitados**. Puede mostrar el QR temporal o dictar al vigilante el código rápido de 6 dígitos que aparece debajo. También puede crear una invitación QR para un visitante.
2. En otra sesión o navegador, inicia como `vigilante@pinos.com` y abre **Control de acceso**. Selecciona residente e ingresa sus 6 dígitos, o escanea el QR. Para visitantes, selecciona visitante y escanea el QR de la invitación. La validación registra el movimiento de ingreso/salida.
3. Para probar acceso vehicular por QR, LPR o RFID, crea un vehículo y relaciónalo con el residente desde Catálogo. El residente demo no trae vehículo precargado.
4. Para probar LPR, inicia sesión con un usuario de un plan que incluya IA, abre **Cámaras**, permite el acceso a la cámara, centra una placa y pulsa **Capturar y reconocer placa**. Revisa el resultado y continúa a Control de acceso para confirmar manualmente. La precisión debe validarse con fotos reales de placas colombianas antes de usarla en portería.
5. Para probar la administración, inicia como Super Admin. Un administrador puede crear residentes, supervisores y vigilantes de su establecimiento.
6. Registra una incidencia asociada a la invitación. Inicia sesión como Supervisor y revisa el movimiento o la incidencia desde reportes y su opción “Ver detalle”.
7. Prueba también un movimiento manual sin QR. Para probar RFID, usa un lector que escriba el código como entrada de teclado.

## Roles y permisos

El frontend adapta la navegación al rol y la API vuelve a validar permisos, autenticación y establecimiento. Administración gestiona datos del establecimiento; vigilancia registra accesos e incidencias; supervisión consulta la actividad; los residentes consultan su QR y gestionan sus propias invitaciones. Las funciones QR, RFID y LPR dependen del plan del establecimiento.

## API útil

- `GET /api/health/`
- `POST /api/identidad/auth/login/`
- `GET /api/profile/`
- `/api/empresas/planes/`
- `/api/empresas/establecimientos/`
- `/api/operaciones/responsables/?id_establecimiento=1`
- `/api/operaciones/vehiculos/?id_establecimiento=1`
- `/api/operaciones/movimientos/?id_establecimiento=1`
- `/api/operaciones/incidencias/?id_establecimiento=1`
- `/api/operaciones/invitaciones-visitantes/?id_establecimiento=1`

## Solución de problemas

- **No conecta con MySQL:** comprueba que el servicio esté iniciado y revisa `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` en `backend\.env`.
- **`Failed to fetch` al iniciar sesión:** confirma que el backend responde en `http://localhost:8000/api/`, que no se cerró la terminal/proceso del backend y que `VITE_API_URL` apunta a ese backend. El puerto de la web (`5173`) y el de la API (`8000`) son procesos distintos.
- **La API indica que faltan tablas:** si es una base nueva, importa el SQL con el procedimiento del paso 5. Si ya contiene datos, haz una copia antes de cualquier cambio y no ejecutes el SQL destructivo.
- **No abre el frontend:** confirma que `npm install` terminó y que Node.js cumple la versión mínima. El puerto predeterminado es `5173`.
- **No puedes usar la cámara para leer QR o placas:** concede permiso de cámara y usa `localhost` o HTTPS. Un teléfono que abra la aplicación por una dirección HTTP de red local puede bloquear la cámara; en ese caso usa HTTPS o el código manual para QR.
- **No puedes iniciar sesión:** confirma el usuario, la contraseña y que el estado de la cuenta esté activo. Las cuentas demo se preparan al ejecutar el script de inicio.

## Guías relacionadas

- [Guía de arranque en cinco minutos](GU%C3%8DA_DE_ARRANQUE_5_MINUTOS.md)
- [Requisitos y desarrollo del frontend](frontend/README.md)
- [Versión portable](frontend/portable-README.md)
- [Enlaces rápidos de la API](ENLACES_RAPIDOS.md)
- [Uso desde móvil](USO_MOVIL.md)
