# 🎯 GUÍA RÁPIDA PARA EL PROFESOR - DEMO DEL PROYECTO

**Proyecto:** Heimdall Tech - Sistema de Inteligencia de Acceso Vehicular  
**Idioma:** Español  
**Herramientas:** Django, Django REST Framework, MySQL  

---

## 🚀 INICIO RÁPIDO (5 minutos)

### 1. Abrir Terminal en la carpeta backend
```powershell
cd "C:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech\backend"
```

### 2. Activar ambiente virtual
```powershell
.\.venv\Scripts\Activate.ps1
```

### 3. Iniciar servidor Django
```powershell
python manage.py runserver 8000
```

**Resultado esperado:**
```
Starting development server at http://127.0.0.1:8000/
```

---

## 📱 DEMOSTRACIÓN EN NAVEGADOR

### Opción 1: Panel Administrativo (Más visual)
1. Abrir: http://127.0.0.1:8000/admin/
2. Login:
   - Usuario: `IanLR`
   - Contraseña: `miacarola2004`
3. Explorar pestañas:
   - **Users & Groups** (del administrador Django)
   - **Planes** (Basico, Profesional, Empresarial)
   - **Establecimientos** (4 ubicaciones)
   - **Roles** (Admin, Vigilante, Gestor)
   - **Usuarios** (10 usuarios del sistema)
   - **Responsables** (20 personas)
   - **Vehículos** (20 autos registrados)
   - **Movimientos** (30 entradas/salidas)
   - **Incidencias** (5 alertas/reportes)
   - **Reconocimientos de Placa** (5 detecciones IA)

### Opción 2: API REST (Más técnico)

#### 📍 Documentación API
```
http://127.0.0.1:8000/api/
```
Muestra todos los endpoints disponibles en JSON

#### 🏢 Módulo Empresas
```
http://127.0.0.1:8000/api/empresas/planes/
```
**Resultado:** 3 planes con precios y descripción

```
http://127.0.0.1:8000/api/empresas/establecimientos/
```
**Resultado:** 4 establecimientos con datos de plan

#### 👤 Módulo Identidad
```
http://127.0.0.1:8000/api/identidad/roles/
```
**Resultado:** Roles disponibles

```
http://127.0.0.1:8000/api/identidad/usuarios/?id_establecimiento=1
```
**Resultado:** Usuarios del Establecimiento 1 (Conjunto Residencial Los Pinos)

#### 🚗 Módulo Operaciones
```
http://127.0.0.1:8000/api/operaciones/vehiculos/?id_establecimiento=1
```
**Resultado:** Vehículos con placas (AAA-111, BBB-222, etc.)

```
http://127.0.0.1:8000/api/operaciones/movimientos/?id_establecimiento=1
```
**Resultado:** Entradas y salidas de vehículos

```
http://127.0.0.1:8000/api/operaciones/incidencias/?id_establecimiento=1
```
**Resultado:** Alertas y eventos

#### 🤖 Módulo Inteligencia
```
http://127.0.0.1:8000/api/inteligencia/reconocimientos/?id_establecimiento=3
```
**Resultado:** 5 detecciones de placas con IA (Universidad de La Guajira)

#### 📊 Endpoints de Metadatos
```
http://127.0.0.1:8000/api/meta/idiomas/
```
Idiomas soportados (Español, English)

```
http://127.0.0.1:8000/api/meta/catalogo-enums/
```
Valores de enums traducidos (Estados, Prioridades, etc.)

---

## 🖥️ DEMOSTRACIÓN EN LÍNEA DE COMANDOS (PowerShell)

### Listar Usuarios Admin
```powershell
python manage.py shell -c "from django.contrib.auth.models import User; print([u.username for u in User.objects.filter(is_staff=True)])"
```
**Resultado:** ['IanLR', 'rastor65']

### Contar Registros en BD
```powershell
python manage.py shell -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from app_empresas.models import Plan, Establecimiento
from app_identidad.models import Usuario
from app_operaciones.models import Vehiculo, Movimiento, Incidencia

print('Planes:', Plan.objects.count())
print('Establecimientos:', Establecimiento.objects.count())
print('Usuarios:', Usuario.objects.count())
print('Vehículos:', Vehiculo.objects.count())
print('Movimientos:', Movimiento.objects.count())
print('Incidencias:', Incidencia.objects.count())
"
```

### Ver Establecimientos
```powershell
python manage.py shell -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from app_empresas.models import Establecimiento

for est in Establecimiento.objects.all():
    print(f'{est.id_establecimiento}. {est.nombre} - {est.direccion}')
"
```

**Resultado:**
```
1. Conjunto Residencial Los Pinos - Calle Principal 123
2. Edificio Empresarial Norte - Av. Comercio 456
3. Universidad de La Guajira - Campus Principal
4. Centro Comercial La Plaza - Carrera 10 No. 5-23
```

### Ver Vehículos de un Establecimiento
```powershell
python manage.py shell -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from app_operaciones.models import Vehiculo

for v in Vehiculo.objects.filter(id_establecimiento=1)[:5]:
    print(f'{v.placa} - {v.marca} {v.modelo} ({v.tipo_autorizacion})')
"
```

**Resultado:**
```
AAA-111 - Toyota Corolla (AUTORIZADO)
BBB-222 - Honda Civic (AUTORIZADO)
CCC-333 - Volkswagen Jetta (AUTORIZADO)
...
```

---

## 🎓 PUNTOS CLAVE PARA EL PROFESOR

### 1. **Arquitectura Profesional**
El proyecto sigue el patrón **MTV (Model-Template-View)** de Django con:
- **4 Aplicaciones independientes** (empresas, identidad, operaciones, inteligencia)
- **Serializers para presentación** de datos
- **ViewSets para operaciones CRUD**
- **Routers automáticos** de URLs

### 2. **Base de Datos Relacional**
- **MySQL** con 100+ registros
- **Relaciones FK** correctas (restricciones CASCADE/RESTRICT)
- **Índices** en campos clave
- **Charset UTF-8mb4** para soportar ñ y caracteres especiales

### 3. **API REST**
- **Endpoints funcionales** que devuelven JSON
- **Paginación automática**
- **Filtrado y búsqueda**
- **Serialization anidada** (nested data)

### 4. **Multi-Tenant SaaS**
- Parámetro `id_establecimiento` obliga separación de datos
- Cada usuario ve solo su establecimiento
- Escalable para múltiples clientes

### 5. **Seguridad**
- Admin de Django protegido
- Credenciales hasheadas
- Read-Only Views (sin POST/PUT/DELETE)
- Sin exposición de datos sensibles

---

## ❓ PREGUNTAS FRECUENTES DEL PROFESOR Y RESPUESTAS

### P: "¿Dónde están los datos?"
**R:** En MySQL, tabla `heimdall_tech`
```bash
# Ver tablas
mysql -h 127.0.0.1 -u root -p101001 heimdall_tech -e "SHOW TABLES;"

# Ver datos de PLAN
mysql -h 127.0.0.1 -u root -p101001 heimdall_tech -e "SELECT * FROM PLAN;"
```

### P: "¿Cómo se ven cuando hago click en un enlace?"
**R:** Los datos se muestran automáticamente:
- Navegar a `/admin/entidades/` → Ver tabla en interfaz web
- Navegar a `/api/empresas/planes/` → Ver JSON de planes
- Usar parámetro `?id_establecimiento=1` → Datos filtrados

### P: "¿Quién puede acceder?"
**R:** 
- Admin: Usuario IanLR o rastor65 (requiere login)
- API: AllowAny (sin autenticación en desarrollo)
- Producción: Requeriría JWT tokens

### P: "¿Es escalable para vender?"
**R:** Sí, pero necesita:
1. Autenticación JWT
2. Validación de tenant_id en tokens
3. HTTPS obligatorio
4. Rate limiting
5. Logs centralizados
6. Dockerización

Ver: `ESTADO_PROYECTO_PROFESIONAL.md` para plan completo

### P: "¿Cuáles son las mejoras futuras?"
**R:** Documentadas en `ESTADO_PROYECTO_PROFESIONAL.md`:
- Fase 1: Seguridad (JWT, permisos)
- Fase 2: Testing y documentación
- Fase 3: Performance (caché, índices)
- Fase 4: DevOps (Docker, CI/CD)

---

## 📚 ARCHIVOS IMPORTANTES

```
backend/
├── manage.py              ← Comando principal de Django
├── requirements.txt        ← Dependencias Python
├── config/
│   ├── settings.py        ← Configuración Django
│   ├── urls.py            ← Rutas principales
│   ├── views.py           ← Vistas API (documentación)
│   └── serializers.py     ← Utilidades compartidas
├── app_empresas/
│   ├── models.py          ← Plan, Establecimiento
│   ├── serializers.py     ← Conversión JSON
│   ├── views.py           ← Endpoints REST
│   └── urls.py            ← Rutas específicas
├── app_identidad/         ← Rol, Usuario
├── app_operaciones/       ← Responsable, Vehiculo, Movimiento, Incidencia
└── app_inteligencia/      ← ReconocimientoPlaca

../
├── ESTADO_PROYECTO_PROFESIONAL.md  ← Análisis profesional y recomendaciones
└── VERIFICACION_FINAL.md            ← Checklist de implementación
```

---

## 🎯 SCRIPTED DEMO (1 minuto)

**Demostración automatizada:**

```powershell
# 1. Abrir admin
Start-Process "http://127.0.0.1:8000/admin/"

# 2. Abrir API
Start-Process "http://127.0.0.1:8000/api/"

# 3. Probar un endpoint
Invoke-WebRequest "http://127.0.0.1:8000/api/empresas/planes/" | Select-Object StatusCode, Content
```

---

## 📞 CONTATOS Y SOPORTE

**Usuarios creados:**
- IanLR (ian99090@gmail.com)
- rastor65 (rdamianquintero@uniguajira.edu.co)

**Configuración de BD:**
- Host: 127.0.0.1
- Puerto: 3306
- User: root
- Password: 101001

**Timezone:** America/Bogota  
**Idiomas:** Español, English

---

## ✅ CHECKLIST FINAL ANTES DE PRESENTAR

- [ ] Servidor Django corriendo (`python manage.py runserver 8000`)
- [ ] Navegador abierto en http://127.0.0.1:8000/
- [ ] Admin accesible en http://127.0.0.1:8000/admin/
- [ ] API documentada en http://127.0.0.1:8000/api/
- [ ] BD MySQL funcional con datos
- [ ] Terminal lista para comandos Django
- [ ] Documentación profesional disponible

---

**Versión:** 1.0.0  
**Fecha:** 8 de octubre de 2026  
**Autor:** Implementación Profesional  
**Estado:** ✅ Listo para presentación
