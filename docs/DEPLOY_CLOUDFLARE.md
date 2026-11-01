# Publicar LaburamosApp en Cloudflare

Host alternativo mientras Netlify tiene el deploy bloqueado por créditos
(`Account credit usage exceeded`).

## Estado actual

| Dato | Valor |
|---|---|
| Cuenta | `Fvontivero@gmail.com's Account` (`541937cb8317e928d808e16e66d3965b`) |
| Proyecto | Worker `laburamosapp` (assets estáticos) |
| URL | `https://laburamosapp.fvontivero.workers.dev` |
| Config | `wrangler.jsonc` en la raíz del repo |

Es un **Worker con assets estáticos** (no un proyecto Pages): Cloudflare publica
el contenido de `dist/` y resuelve el ruteo del SPA con
`not_found_handling: "single-page-application"`.

## Deploy

```powershell
npm run build
npx wrangler deploy
```

`wrangler deploy` necesita `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en el
entorno (o `wrangler login` en la máquina).

## Variables de entorno

Para compilar, Vite necesita las claves de Supabase (se incrustan en el bundle,
son públicas):

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://fcfomffkmxcakqmbugje.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | la anon/publishable key del Supabase de LaburamosApp |
| `VITE_SITE_URL` | `https://laburamosapp.fvontivero.workers.dev` |

Nunca cargar la `service_role` ni la clave de Mercado Pago: todo lo que empieza
con `VITE_` queda visible en el navegador.

`VITE_SITE_URL` define canonical, `og:url`, `sitemap.xml` y `robots.txt`
(`herramientas/postbuild.mjs` los reescribe durante el build).

## Encabezados y ruteo

- **`public/_headers`**: CSP, `X-Frame-Options`, `nosniff`, cache de
  `/assets/*`. Workers con assets soporta el mismo formato que Pages.
- **No hay `_redirects`**: Cloudflare aplica los redirects *aunque exista un
  asset* en esa ruta, así que `/* /index.html 200` serviría el HTML en lugar del
  JS/CSS. El SPA lo resuelve `not_found_handling`.

## Supabase: autorizar el dominio

En Supabase (proyecto `fcfomffkmxcakqmbugje`) → **Authentication → URL Configuration**:

- **Site URL**: `https://laburamosapp.fvontivero.workers.dev`
- **Redirect URLs**: agregar `https://laburamosapp.fvontivero.workers.dev/**`

Sin esto, los mails de confirmación y de recuperación siguen apuntando a Netlify.

## Verificación

1. `/` carga la home con datos de Supabase.
2. `/contacto` y `/laburos` por URL directa (sin 404).
3. Los archivos de `/assets/*` responden con su Content-Type correcto.
4. Consola sin errores de CSP.
5. Admin → **Recibidos** y envío de una sugerencia de prueba.

## Volver a Netlify

El `netlify.toml` sigue intacto: cuando se liberen los créditos, un push vuelve
a publicar allá. Conviene dejar un solo host "oficial" para no duplicar SEO.
