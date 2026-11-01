# Publicar LaburamosApp en Cloudflare Pages

Host alternativo mientras Netlify tiene el deploy bloqueado por créditos
(`Account credit usage exceeded`). El proyecto ya está preparado: no hace falta
cambiar código, solo conectar el repositorio y cargar las variables.

## Por qué Cloudflare Pages

| Opción | Veredicto |
|---|---|
| **Cloudflare Pages (Free)** | Permite uso comercial, ancho de banda y requests ilimitados, 500 builds/mes. Ya usa `_headers` y `_redirects` con la misma sintaxis que Netlify (los dejamos en `public/`). **Elegida.** |
| Vercel (Hobby) | Excelente DX, pero el plan gratuito es solo para uso personal/no comercial. LaburamosApp cobra la descarga del CV, así que correspondería el plan Pro (US$ 20/mes). |
| GitHub Pages | No permite fijar encabezados (se pierde la CSP) y el ruteo SPA necesita un hack de `404.html`. No conviene. |
| Render / Railway | Pensados para apps con servidor; acá es un sitio estático. Sobrecarga innecesaria. |

## 1. Crear el proyecto

1. Entrar a <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git**.
2. Autorizar la app de GitHub (solo lectura del repo) y elegir `Datelier-25/LABURAMOS`.
3. Nombre del proyecto: `laburamosapp` (queda en `https://laburamosapp.pages.dev`).

## 2. Configuración del build

| Campo | Valor |
|---|---|
| Framework preset | `Vite` (o *None*) |
| Build command | `npm run lint && npm run build` |
| Build output directory | `dist` |
| Root directory | `laburamos-app` si el repo tiene el proyecto en esa carpeta; si el repo es el proyecto, dejar vacío |

> `npm run build` ejecuta además `postbuild`, que ajusta canonical, `og:url`,
> `sitemap.xml` y `robots.txt` al dominio publicado.

## 3. Variables de entorno

En **Settings → Environment variables** (producción y preview):

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://fcfomffkmxcakqmbugje.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | la anon/publishable key del Supabase de LaburamosApp |
| `VITE_SITE_URL` | `https://laburamosapp.pages.dev` |
| `NODE_VERSION` | `22` |

Nunca cargar acá la `service_role`, la clave de Mercado Pago ni ninguna clave
secreta: todo lo que empieza con `VITE_` queda visible en el navegador.

## 4. Primer deploy

Guardar y desplegar. Si el build falla por Node, revisar que `NODE_VERSION`
esté en `22` (también hay un `.nvmrc` en la raíz del proyecto).

## 5. Supabase: autorizar el dominio nuevo

En Supabase (proyecto `fcfomffkmxcakqmbugje`) → **Authentication → URL Configuration**:

- **Site URL**: `https://laburamosapp.pages.dev`
- **Redirect URLs**: agregar `https://laburamosapp.pages.dev/**`

Sin esto, los mails de confirmación y de recuperación de contraseña siguen
apuntando a Netlify.

## 6. Verificación rápida

1. `https://laburamosapp.pages.dev` carga la home.
2. Ruta directa `https://laburamosapp.pages.dev/contacto` (no debe dar 404).
3. Login con la cuenta de prueba y Admin → **Recibidos**.
4. Enviar una sugerencia de prueba desde `/contacto`.
5. Consola sin errores de CSP.

## Notas

- **Volver a Netlify**: cuando se liberen los créditos, el `netlify.toml` sigue
  intacto y un push vuelve a publicar allá. Conviene que haya un solo host
  "oficial" para no duplicar SEO; si se queda Cloudflare, actualizar el
  `VITE_SITE_URL` de Netlify o retirar ese sitio.
- **Dominio propio** (recomendado a futuro): en Cloudflare Pages → **Custom
  domains** se agrega el dominio y se apunta el DNS. Después se actualiza
  `VITE_SITE_URL` y las URLs de Supabase.
- **Límites del plan gratis**: 500 deploys/mes, 20.000 archivos por sitio,
  archivos de hasta 25 MiB. La app queda muy por debajo.
