# LaburamosApp · Administración y marca con la L

Entrega del 8 de noviembre de 2026. Base: `LABURAMOS (1).zip` provisto en esta conversación.

Este paquete contiene archivos completos para reemplazar o agregar, con sus rutas originales. No son fragmentos de código. Incluye el Admin aprobado y la marca con la L. La nueva portada previsualizada NO se incluye, según lo confirmado.

## Cambios aplicados

- Administración abre en Usuarios y usa encabezados y pestañas compactos con la paleta y Bricolage Grotesque del proyecto.
- Cinco KPI funcionan como filtros: Usuarios, Administradores, Verificados, Bloqueados y Piden verificación. La búsqueda combina nombre, correo, localidad y provincia, sin distinguir acentos.
- Tabla compacta con iniciales, rol, estado de verificación, bloqueo, publicaciones y postulaciones. Cuando el backend no devuelve una foto, se muestran iniciales.
- Acciones por cuenta: consultar, verificar/quitar verificación, aceptar/rechazar solicitudes, dar/quitar admin, bloquear/desbloquear, cambiar tipo de cuenta y eliminar. Se conservan las RPC y permisos existentes.
- Selección y acciones en lote para verificar, bloquear y desbloquear. Exigen confirmación y muestran cuántas cuentas fallaron, conservando la selección de esas cuentas. Tu propia cuenta queda excluida del lote, bloqueo, eliminación y cambio de permisos de admin desde esta pantalla.
- Carga de usuarios por páginas, sin quedarse en los primeros mil registros.
- Panel de usuario en un dialog nativo sobre la tabla, con Cuenta / Publicaciones / Actividad. Bloquea la interacción con la tabla hasta cerrar, admite Escape y devuelve el foco al botón de origen. Conserva los filtros.
- Publicaciones reúne todos los empleos, servicios y pedidos del usuario, incluidos pausados, cubiertos y vencidos; orden descendente por fecha.
- Ver detalle consulta el registro completo y reutiliza JobSign / ServiceCard, los mismos componentes públicos. El aviso laboral no muestra valoraciones; los servicios conservan su reputación. Las acciones de contacto, guardado y denuncia están desactivadas en esta vista administrativa.
- Edición de la publicación dentro del mismo dialog, con la función de guardado existente, sin abrir otro modal.
- Se corrige el envío de `verification_requested: false` al aceptar o rechazar solicitudes. El cliente envía los seis parámetros de la RPC de la migración 022.
- Marca con el PNG de la L y texto LaburamosApp con la misma familia, peso, ancho y espaciado del pie. Se incluyen favicon, iconos de app/PWA y el símbolo del CV derivados del mismo PNG.
- Si falta una ilustración de una tarjeta, se muestra el emoji de respaldo en lugar de dejar el espacio vacío.

## Archivos de código para reemplazar o agregar

| Archivo | Cambio |
| --- | --- |
| src/App.jsx | Pasa la cuenta actual al Admin. |
| src/main.jsx | Carga el nuevo archivo de estilos después de index.css. |
| src/admin.css | Nuevo: marca, tabla, KPI, modal y adaptación a pantallas pequeñas. |
| src/lib/adminUsers.js | Nuevo: filtros, contadores, paginación, parámetros de RPC y publicaciones. |
| src/components/Admin.jsx | Navegación y encabezados compactos; Usuarios como sección inicial. Se conservan las siete secciones. |
| src/components/UsersPanel.jsx | Tabla, filtros, acciones y conexión con datos reales. |
| src/components/UserActivityModal.jsx | Dialog, cuenta, publicaciones, actividad, tarjeta real y edición. |
| src/components/EditListing.jsx | Permite edición integrada al dialog; conserva sus usos públicos. |
| src/components/Sign.jsx | Vista previa con las tres acciones desactivadas y respaldo de ilustraciones. |
| src/components/Reputation.jsx | Permite mostrar la reputación sin abrir otro modal en la vista previa. |
| src/components/Logo.jsx | L en PNG y texto con la tipografía del pie. |
| src/components/ConfigScreen.jsx | Reutiliza el nuevo Logo. |
| herramientas/admin-users.test.mjs | Nuevo: cinco pruebas automáticas de filtros, RPC, publicaciones y paginación. |

Recursos de marca en `public/marca/`: `icono-l.png`, `isotipo.png`, `favicon.ico`, `favicon-32.png`, `favicon-48.png`, `apple-touch-icon.png`, `icono-app-192.png`, `icono-app-512.png` e `icono-app-maskable-512.png`.

## Cómo trasladarlo al proyecto

1. Hacer una copia o un commit de la versión actual. Comparar contra la base `LABURAMOS (1).zip`: si el proyecto productivo tuvo cambios posteriores, integrarlos antes de reemplazar los archivos completos, especialmente App.jsx y main.jsx.
2. Copiar `src/`, `public/marca/` y, opcionalmente, la prueba de `herramientas/` sobre las mismas carpetas del proyecto. Conservar el resto de los archivos; NO borrar ni reemplazar toda la carpeta public. El ZIP original no incluía todas las ilustraciones y recursos de marca del sitio.
3. Mantener package.json, package-lock.json y las variables de entorno del proyecto. Esta entrega no cambia dependencias ni credenciales. Usar el dominio actual en `VITE_SITE_URL` si el despliegue lo define.
4. Confirmar los requisitos de base detallados debajo. No ejecutar la instalación completa sobre una base existente.
5. Ejecutar:

   ```sh
   npm ci
   node --test herramientas/admin-users.test.mjs
   npm run lint
   npm run build
   ```

6. En el entorno de pruebas del despliegue, entrar con una cuenta administradora y comprobar filtros, una cuenta con publicaciones históricas, una tarjeta de empleo y una de servicio, cierre del panel y edición. Luego publicar con el procedimiento habitual.

## Requisitos de Supabase

Se usa el esquema existente del proyecto y sus permisos administrativos. No hay migraciones nuevas y no se ejecutó ningún cambio remoto ni operación sobre usuarios reales durante esta entrega.

- `admin_users()` y permisos de lectura de publicaciones para administradores, existentes en las migraciones del proyecto.
- `admin_set_user` con SEIS parámetros, incluida `p_verification_requested`, de `022_admin_set_user_verification.sql`.
- `admin_user_activity` corregida por `025_fix_admin_user_activity_schema.sql`.
- `admin_delete_user` y `admin_update_listing`, ya utilizados por el Admin y la edición original (migraciones 021 y 019).
- Vista `user_reputation`, ya utilizada por las tarjetas públicas.

Se adjuntan copias sin modificaciones de las migraciones 022 y 025 en `REFERENCIAS_SQL/` para identificar los requisitos. No son archivos nuevos de la base ni se aplican automáticamente. Si ya están aplicadas, no hace falta volver a ejecutarlas. Si faltan, revisar el historial del proyecto y aplicar las migraciones pendientes en su orden habitual.

## Validación realizada y límites

- `npm ci` con el lock original: correcto; sin cambios en dependencias.
- `npm run lint`: correcto, sin advertencias.
- `npm run build` y postbuild: correctos.
- Cinco pruebas Node de reglas de negocio: correctas.
- Diez comprobaciones DOM con React real y Supabase simulado: tabla/cuenta propia; KPI/filtros; dialog y estados históricos; JobSign; edición y RPC; ServiceCard y valoraciones; foco/filtro al cerrar; seis parámetros de verificación; lote con fallo parcial; cierre y respuesta tardía.
- Las comprobaciones DOM usan una implementación de prueba de showModal. No sustituyen una revisión visual en navegador ni la validación con una sesión administrativa real. No se probó contra la base productiva.
- El build informa dos avisos: falta `/marca/marca-agua.png` en el ZIP de origen y el bundle principal supera 500 kB. El paquete no borra recursos existentes del sitio.
- El ZIP entrega fuentes y recursos, no dist ni node_modules. El original `LABURAMOS (1).zip` queda intacto.

`ARCHIVOS_Y_HASHES.sha256` permite comprobar que los archivos extraídos coinciden con los empaquetados.
