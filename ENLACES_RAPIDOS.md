# Heimdall Tech - Enlaces rápidos

Este archivo reúne los enlaces más útiles para revisar la aplicación sin perder tiempo navegando por toda la estructura.

## 1. Iniciar el backend

```powershell
cd "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech\backend"
.\.venv\Scripts\Activate.ps1
python manage.py runserver 8000
```

## 2. Base de datos / SQL

- Archivo principal SQL:
  `C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech\Heimdall_Tech.sql`

- Ejecutar primero antes de iniciar Django

## 3. Enlaces del sistema

### Página principal

- http://127.0.0.1:8000/

### Administración Django

- http://127.0.0.1:8000/admin/

### API base

- http://127.0.0.1:8000/api/

### Empresas

- http://127.0.0.1:8000/api/empresas/planes/
- http://127.0.0.1:8000/api/empresas/establecimientos/?id_establecimiento=1

### Identidad

- http://127.0.0.1:8000/api/identidad/roles/
- http://127.0.0.1:8000/api/identidad/usuarios/?id_establecimiento=1

### Operaciones

- http://127.0.0.1:8000/api/operaciones/responsables/?id_establecimiento=1
- http://127.0.0.1:8000/api/operaciones/vehiculos/?id_establecimiento=1
- http://127.0.0.1:8000/api/operaciones/movimientos/?id_establecimiento=1
- http://127.0.0.1:8000/api/operaciones/incidencias/?id_establecimiento=1

### Inteligencia

- http://127.0.0.1:8000/api/inteligencia/reconocimientos/?id_establecimiento=3

### Metadatos

- http://127.0.0.1:8000/api/meta/idiomas/
- http://127.0.0.1:8000/api/meta/catalogo-enums/

## 4. Usuarios de demostración

- IanLR
- rastor65

## 5. Importante

Si quieres ver la información de un establecimiento concreto, siempre debe ir el parámetro:

```text
?id_establecimiento=1
```

Eso es parte del diseño SaaS del proyecto.

## 6. Ejemplo de verificación rápida

```powershell
Invoke-WebRequest "http://127.0.0.1:8000/api/operaciones/responsables/?id_establecimiento=1" -UseBasicParsing
```

## 7. Orden recomendado para pruebas

1. Ejecutar `Heimdall_Tech.sql`
2. Activar entorno virtual
3. Ejecutar `python manage.py runserver 8000`
4. Abrir `http://127.0.0.1:8000/api/`
5. Probar los endpoints de empresas, identidad y operaciones
6. Revisar el panel admin
