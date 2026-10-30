# Heimdall Tech — uso en celular (PWA portable)

No hay app nativa en Play Store todavía. La **versión móvil** es la misma web React, optimizada para abrirse desde el navegador del teléfono en la red local (PWA ligera).

## Requisitos

- PC con backend y frontend en ejecución (`iniciar.ps1`).
- Celular y PC en la **misma red Wi‑Fi**.
- Navegador moderno (Chrome, Safari, Edge).

## Pasos

1. En la PC, obtén tu IP local (PowerShell):

   ```powershell
   ipconfig
   ```

   Busca **IPv4** (ejemplo: `192.168.1.50`).

2. Arranca el proyecto con host en todas las interfaces (el script `iniciar.ps1` ya usa `0.0.0.0`).

   En `backend\.env`, agrega la IPv4 de la PC a `DJANGO_ALLOWED_HOSTS`, por ejemplo `DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.50`, y reinicia el backend. El código permite CORS para direcciones privadas de la LAN.

3. En el celular abre:

   ```text
   http://<TU-IP>:5173/
   ```

   Ejemplo: `http://192.168.1.50:5173/`

4. Inicia sesión como **vigilante** para pruebas de portería:

   - Usuario: `vigilante@pinos.com`
   - Contraseña: `Heimdall#2026`

5. **Añadir a pantalla de inicio** (opcional):
   - **Android (Chrome):** menú ⋮ → “Instalar aplicación” o “Añadir a pantalla principal”.
   - **iPhone (Safari):** Compartir → “Añadir a pantalla de inicio”.

6. Para usar cámara en **Cámaras** o escanear QR, el navegador requiere un contexto seguro: `localhost` funciona por HTTP, pero un teléfono que abre `http://192.168.x.x:5173/` normalmente necesita HTTPS para habilitar cámara. Usa un certificado HTTPS de desarrollo confiable para el dispositivo o prueba la cámara en la PC desde `localhost`. El código QR del residente también se puede ingresar manualmente.

## Qué puede hacer un vigilante

- Ver **Dashboard**, **Cámaras** y **Control de acceso** según los permisos efectivos que devuelve el backend.
- Usar la cámara del dispositivo para simular captura LPR.
- Modo offline: la UI indica si no hay red; la cola de sincronización completa está prevista en el backend (`estado_sincronizacion`) y se ampliará en versiones futuras.

La barra lateral se construye con el menú que entrega `/api/profile/`. Si un permiso no está incluido en el rol ni en las excepciones del usuario, el módulo no aparece y la API también rechaza la operación.

## Super Admin en móvil

- Usuario: `admin` o `admin@heimdall.tech`
- Contraseña: `Heimdall#2026`

El Super Admin administra los roles globales y las excepciones de permisos desde **Roles y permisos** y **Usuarios**. Los demás roles no ven esas opciones. Las contraseñas demo solo se imprimen si ejecutas `iniciar.ps1` con `$env:HEIMDALL_SHOW_DEMO_CREDENTIALS=1`.

## Problemas frecuentes

| Síntoma | Solución |
|--------|----------|
| No carga la página en el celular | Firewall de Windows: permitir Node (5173) y Python (8000) para redes privadas; confirmar que ambos dispositivos usen la misma Wi‑Fi. |
| `Failed to fetch` / login falla | Verificar IP en la URL, que backend responde en `http://<IP>:8000/api/`, MySQL activo y `<IP>` incluido en `DJANGO_ALLOWED_HOSTS`; reiniciar el backend después de cambiar `.env`. |
| Cámara no abre | Usa `localhost` en la PC o HTTPS en el teléfono; concede permiso y recarga. HTTP por IP de LAN suele bloquear `getUserMedia`. |
