# Heimdall Tech - Versión portable

## ¿Cómo probarla desde el celular?

1. Asegúrate de que la PC y el celular estén en la misma red Wi‑Fi.
2. Abre la terminal en la PC y levanta el backend y el frontend.
3. En el celular entra a:
   `http://192.168.20.24:5173`
4. Desde el navegador del celular puedes:
   - abrir la app en pantalla completa
   - añadirla a la pantalla de inicio
   - probarla como una app portable

## Backend

```powershell
cd "c:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech\backend"
.\.venv\Scripts\Activate.ps1
python manage.py runserver 0.0.0.0:8000
```

## Frontend

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$env:Path += ";C:\Program Files\nodejs"
cd "c:\Users\Ian de Jesus\Documents\Heimdall_Tech\Heimdall_Tech\frontend"
npm run dev -- --host 0.0.0.0 --port 5173
```

## Credenciales de prueba

```json
{
  "username": "admin@pinos.com",
  "password": "hash_pass_123"
}
```

## Nota importante

La versión portable es una versión local de prueba para acceso rápido desde celular. No es un despliegue real en nube ni una app publicada en Play Store/App Store.
