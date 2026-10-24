# Heimdall Tech — uso portable en la red local

“Portable” significa que se abre desde el navegador de otro dispositivo en la misma red; no es una app nativa ni un despliegue público. Para instalar el proyecto en una PC nueva, sigue el [README principal](../README.md).

## Requisitos

- PC con Heimdall, MySQL, backend y frontend instalados y activos.
- Celular y PC conectados a la misma red Wi‑Fi.
- Permitir los puertos `5173` (Vite) y `8000` (Django) en el firewall de Windows para la red privada.
- Navegador actualizado.

## Abrir desde el celular

1. Inicia Heimdall en la PC con `iniciar.ps1`.
2. En PowerShell, ejecuta `ipconfig` y busca la IPv4 de la red Wi‑Fi, por ejemplo `192.168.1.50`.
3. En el celular abre `http://<IP-DE-LA-PC>:5173/`. El frontend usará esa misma IP para conectar con la API en el puerto `8000`.
4. Inicia sesión con una cuenta de prueba descrita en el [README principal](../README.md).

Puedes añadir la página a la pantalla de inicio desde el menú del navegador. Eso la abre en una ventana más parecida a una app, pero sigue siendo una web local.

## Cámara y códigos QR

El navegador permite cámara en `localhost` y en contextos HTTPS seguros. Una dirección HTTP de red local como `http://192.168.1.50:5173/` puede bloquearla. Para probar QR desde el celular, configura HTTPS en el entorno local o usa la cámara en el navegador de la PC; el residente también puede dictar su código corto y el vigilante escribirlo.

## Solución de problemas

- **No carga la página:** comprueba que frontend y backend estén activos y permite los puertos `5173` y `8000` en el firewall.
- **Aparece `Failed to fetch`:** verifica que `http://<IP-DE-LA-PC>:8000/api/` responda y que el celular y la PC estén en la misma Wi‑Fi.
- **La cámara no abre:** usa HTTPS o `localhost`, concede permiso de cámara y recarga. El ingreso manual de códigos sigue disponible.
