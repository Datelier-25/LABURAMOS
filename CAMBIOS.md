# Cambios de diseño y funcionalidad

## Antes de publicar
1. Crear un **Supabase nuevo y vacío**. No usar la base de Workeo.
2. Aplicar en el SQL Editor la opción rápida
   `supabase/migrations/000_instalacion_completa.sql`, o en orden:
   - `supabase/migrations/001_base_laburamos.sql`: tablas base, RLS y trigger de registro.
   - `supabase/migrations/003_zonas_servicios_cv.sql`: provincia, servicios "ofrece / busca", CV completo y colores del CV.
   - `supabase/migrations/004_admin_pagos_cv.sql`: administradores, configuración del cobro y compras.
   - `supabase/migrations/005_grants_laburamos.sql`: permisos de la Data API.
   La guía completa está en `supabase/INSTALACION_NUEVA.md`.
3. Hacerte administrador (una vez, en el SQL Editor de Supabase):
   `update public.profiles set is_admin = true where id = (select id from auth.users where email = 'TU_EMAIL');`
4. Probar en StackBlitz (ver `LEEME_STACKBLITZ.md`) o en un preview de Netlify con `npm install` y `npm run dev`.

## Activar el cobro de la descarga del CV (Mercado Pago)
1. En Mercado Pago Developers, crear una aplicación (Checkout Pro) y copiar el **Access Token de prueba**.
2. En Supabase > Edge Functions > Secrets, cargar:
   - `MP_ACCESS_TOKEN`: el Access Token (primero el de prueba; cuando todo ande, el de producción).
   - `APP_URL`: la dirección de la app, por ejemplo `https://laburamos.netlify.app`.
3. Publicar las funciones con la CLI de Supabase:
   - `supabase functions deploy crear-pago-cv`
   - `supabase functions deploy mp-webhook --no-verify-jwt`
4. En la app, entrar a **Admin**, activar "Cobrar la descarga" y elegir el precio y la modalidad.
5. Probar una compra con las tarjetas de prueba de Mercado Pago antes de pasar al Access Token de producción.

Mientras el cobro está desactivado, la descarga es libre. La credencial de Mercado Pago nunca va en la app ni en el repositorio.

## Qué cambió
- **Marca:** logo e isotipo de la lámina (`public/marca/`), favicon nuevo y paleta de la marca (naranja, navy, azul, celeste y blanco). Componente único `src/components/Logo.jsx`; se borró `HorseMark.jsx`.
- **Bienvenida:** las tarjetas de ejemplo son las mismas que las reales. El panel oscuro queda fijo, así en "Crear cuenta" se siguen viendo. "Solo mirar" tiene el mismo estilo que "Ingresar" y "Crear cuenta".
- **Zonas:** se puede elegir cualquier localidad de Argentina o una provincia entera, con un botón "Usar mi ubicación". Las localidades salen de la API Georef y están en `public/geo/localidades.json`; a la API solo se la llama para "Usar mi ubicación". Todos los textos muestran la zona elegida.
- **Inicio:** hero más compacto (la franja naranja se ve sin hacer scroll), tres caminos parejos con una línea de explicación, carteles nuevos y "Ver N laburos" debajo de la pila.
- **Laburos y Oficios:** filtros agrupados (Rubro, Modalidad, Solo urgentes) y, en el celular, un solo botón "Filtros" que abre un panel desde abajo. Guardados pasó a un botón al lado de "Publicar". Cada sección tiene su leyenda.
- **Servicios:** se distinguen los que **ofrecen** un oficio de los que **buscan** que les hagan un trabajo, con tarjetas distintas y el filtro "Todos / Ofrecen / Buscan". Al publicar, lo primero es elegir el tipo.
- **Mi CV:** editor con forma de currículum. A la izquierda van foto, edad, localidad y barrio, habilidades (máx. 5) y contacto; a la derecha, nombre, profesión, presentación con ideas sugeridas, educación y experiencia.
- **Pie:** "LaburamosApp" y una leyenda que no limita la zona ni promete que todo es gratis.
- **Nombre:** la app se llama **LaburamosApp** en el título de la pestaña, en el logo del menú y de las pantallas oscuras, y en los mensajes de WhatsApp.
- **Colores del CV:** se eligen el fondo de la columna izquierda y el color de los títulos. Si un título no se lee sobre su fondo, pasa a blanco o navy.
- **Descarga del CV en PDF (A4):** el botón "Descargar PDF" genera el CV en una hoja A4 completa, limpio y con una marca de agua suave. Mientras se arma, el CV muestra una trama densa de marcas de agua, e imprimir la pantalla de Mi CV no muestra el CV. Si el cobro está activo, el botón lleva primero a Mercado Pago.
- **Admin (control total):** sección visible solo para administradores, con cinco pestañas:
  - **Configuración:** duración de los avisos de empleo y de los servicios, y cobro del CV (activar, precio y qué compra la persona).
  - **Avisos de empleo** y **Servicios:** ver todas las publicaciones de la app, buscarlas, editar cualquier dato (incluidos estado y vencimiento), pausarlas, activarlas o eliminarlas.
  - **CVs:** ver cualquier CV completo o eliminarlo.
  - **Pagos:** últimos pagos y total cobrado.
- **Duraciones:** al publicar, la base fija el estado y el vencimiento con los días que configura el administrador; "Renovar" usa los mismos días. Desde el navegador ya no se pueden mandar.
- **CV privado:** el CV lo ven solo su dueño, las empresas a las que se postuló y el administrador. La foto está en un bucket privado, con un nombre aleatorio, y se muestra con un enlace temporal.
- **Postulaciones:** "Postularme" abre WhatsApp y además deja registrada la postulación. La empresa la ve en **Postulantes**, con el CV completo y un botón para escribirle.
- **Estructura:** la carpeta `src/Components` pasó a `src/components` (así la importa `App.jsx`, y en Netlify/Linux importa la diferencia). `ServiceList.jsx` se movió adentro.
