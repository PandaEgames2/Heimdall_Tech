# Heimdall Tech — frontend

Interfaz React 19 + Vite. Requiere que el backend Django esté activo para iniciar sesión y consultar información.

## Requisitos

- Node.js 20.19+ o 22.12+ y npm.
- Navegador moderno. Para la cámara, prueba en `http://localhost:5173/` o configura HTTPS.
- Backend Heimdall disponible en `http://localhost:8000/api/`.

La aplicación usa `VITE_API_URL`. Si se deja vacía, calcula la API como el mismo host del frontend en el puerto `8000`, lo que permite probar desde otro dispositivo de la red. Para un destino fijo, copia `.env.example` a `.env` y asigna, por ejemplo, `VITE_API_URL=http://localhost:8000/api`.

## Instalar y ejecutar

Desde esta carpeta:

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Abre <http://localhost:5173/>. El método recomendado para instalar y levantar todo el sistema en Windows está en el [README principal](../README.md).

## Rutas

- `/` — landing comercial con botones para iniciar sesión y abrir el repositorio.
- `/login` — inicio de sesión.
- `/panel` — panel autenticado. Si no hay sesión, redirige a `/login`.

La navegación usa la History API. En producción, el servidor web debe devolver `index.html` para `/login` y `/panel` (fallback de SPA). No uses `/app`: ese nombre coincide con el archivo legado `app.js` de la raíz y Vite lo sirve como recurso estático.

## Comandos de desarrollo

```powershell
npm run lint
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

`npm ci` instala las versiones fijadas en `package-lock.json`. Usa `npm install` solo cuando vayas a añadir o actualizar dependencias.
