# Cumplimiento legal en Argentina

Checklist operativo de LaburamosApp. Explica qué se implementó, qué normativa se
tuvo en cuenta y qué falta completar. **No es asesoramiento legal**: los textos y
este checklist deben revisarse con un abogado/a matriculado/a antes de considerar
el cumplimiento cerrado.

## 1. Documentos publicados

| Documento | Ruta | Contenido principal |
| --- | --- | --- |
| Términos y Condiciones | `/terminos` | Uso, cuentas, publicaciones, pagos, anuncios, responsabilidad, ley aplicable. |
| Política de Privacidad | `/privacidad` | Datos, finalidades, base legal, destinatarios, plazos, derechos, seguridad. |
| Política de Cookies | `/cookies` | Almacenamiento necesario, categorías opcionales, consentimiento. |
| Reembolsos y arrepentimiento | `/reembolsos` | Botón de arrepentimiento, compras de CV y anuncios, plazos. |

Versión de los documentos: `2026-11-12` (constante `LEGAL_VERSION` en
`src/lib/legal.js`). Cada aceptación guarda la versión aceptada.

## 2. Consentimiento y prueba

- Dos casillas separadas en cada formulario: Términos y Privacidad. Nunca vienen
  premarcadas.
- Registro en `public.legal_acceptances` con: usuario (si existe), documento,
  versión, contexto, método, fecha, IP y navegador.
- El alta de cuenta registra las dos aceptaciones desde el trigger
  `handle_new_user`, incluso si la confirmación por correo queda pendiente.
- Los demás formularios registran después de que la operación salió bien. Si el
  registro falla, la operación no se bloquea.
- La decisión de cookies se guarda en `localStorage` (`laburamos_cookies_v1`) y se
  registra con método `banner` o `settings`.

## 3. Normativa argentina considerada

### Datos personales — Ley 25.326

- Consentimiento informado y finalidad determinada.
- Datos mínimos y campos opcionales marcados (fecha de nacimiento, barrio y correo
  del CV).
- Derechos de acceso, rectificación, actualización, supresión y confidencialidad.
- Derecho a retirar el consentimiento y a reclamar ante la AAIP.
- Medidas de seguridad y notificación de incidentes.
- **Pendiente:** evaluar si corresponde inscripción de la base de datos ante la
  AAIP y designar un responsable de seguridad de la información. La inscripción
  fue simplificada por la Resolución 14/2024, pero conviene confirmar el encuadre
  con un abogado.
- **Pendiente:** revisar transferencias internacionales (Supabase, Cloudflare,
  Mercado Pago, Google Fonts) y dejar asentadas las garantías contractuales.

### Defensa del consumidor — Ley 24.240 y Resolución 424/2020

- Precio en pesos, informado antes de contratar.
- Botón de arrepentimiento visible y de fácil acceso en `/reembolsos`.
- Derecho de revocación de 10 días corridos en contrataciones a distancia.
- Información sobre el derecho a reclamar ante Defensa del Consumidor.
- **Pendiente:** publicar el domicilio legal y los datos fiscales completos en
  Admin → Configuración → Datos legales.

### Comercio electrónico — Código Civil y Comercial

- Identificación del proveedor y datos de contacto.
- Información clara sobre el servicio y los precios.
- Confirmación de la operación y comprobantes cuando corresponda.

### Derechos de imagen y propiedad intelectual — Ley 11.723 y CCyC art. 53

- Declaración de derechos al subir fotos, videos y anuncios.
- Aviso en el CV y en los formularios de publicación.
- Inventario y pendientes en `docs/DERECHOS_IMAGENES.md`.

### Cookies y navegación

- Solo almacenamiento necesario activo por defecto.
- Analítica y publicidad desactivadas hasta que la persona las acepte.
- Panel para cambiar la decisión desde el pie, la política y el aviso inicial.
- Criterio más protector: si se activan cookies no esenciales, se pide
  consentimiento previo aunque la norma argentina sea más flexible.

## 4. Minimización de datos

- El registro pide nombre, correo, contraseña, rol y localidad/provincia.
- El perfil pide nombre, WhatsApp, ciudad y provincia.
- El CV marca como opcionales fecha de nacimiento, barrio y correo.
- No se piden DNI, datos de salud, religión, ideología ni biométricos.
- Las denuncias pueden enviarse sin cuenta.
- Los CV en PDF se guardan en un bucket privado y solo los abre el comercio que
  recibe la postulación.

## 5. Conservación y eliminación

- La cuenta se puede eliminar desde “Mi perfil”; se borran perfil, avisos,
  servicios, postulaciones, reseñas, CV, fotos y videos.
- No se puede eliminar mientras haya un anuncio pago vigente (se informa en la
  pantalla).
- Las compras de CV quedan como registro contable sin el identificador directo.
- Las aceptaciones legales quedan con `user_id = NULL` si se elimina la cuenta,
  para conservar la prueba del consentimiento.
- Plazos declarados en la Política de Privacidad: postulaciones hasta 12 meses,
  denuncias hasta 2 años, registros técnicos 90 días y compras hasta 10 años.

## 6. Pendientes antes de dar por cerrado el cumplimiento

- [ ] Completar en Admin → Configuración → Datos legales: nombre o razón social,
  CUIT, domicilio legal, correo legal y fecha de actualización.
- [ ] Revisar los cuatro documentos con un abogado/a argentino/a.
- [ ] Definir si corresponde inscripción de la base ante la AAIP.
- [ ] Confirmar licencias y cesiones de imágenes (`docs/DERECHOS_IMAGENES.md`).
- [ ] Configurar en Supabase la Site URL y las Redirect URLs del dominio real
  (hoy es un paso manual en el panel).
- [ ] Verificar que el correo legal reciba y responda los pedidos de derechos.
- [ ] Si se activan analítica o publicidad, actualizar la Política de Cookies,
  volver a pedir consentimiento y registrar la nueva versión.
- [ ] Revisar los textos de precios y comprobantes con el contador.
- [ ] Guardar copia firmada o fechada de los documentos publicados por versión.

## 7. Cómo cambiar los documentos

1. Editar el texto en `src/components/Legal.jsx`.
2. Cambiar `LEGAL_VERSION` en `src/lib/legal.js` (formato `AAAA-MM-DD`).
3. Actualizar la fecha en Admin → Configuración → Datos legales.
4. Probar `/terminos`, `/privacidad`, `/cookies` y `/reembolsos`.
5. Publicar y, si el cambio es relevante, avisar a las personas usuarias.

Las aceptaciones anteriores conservan la versión que se aceptó en su momento.
