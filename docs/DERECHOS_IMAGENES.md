# Derechos de las imágenes y del contenido visual

Este documento deja constancia de qué imágenes usa LaburamosApp y qué falta
confirmar antes de considerar que los derechos están acreditados. No reemplaza
un contrato ni una revisión legal: sirve como inventario y checklist.

## 1. Regla general

- Solo se publica una imagen si es propia, si tiene licencia que permita el uso
  comercial o si la persona que aparece dio su consentimiento.
- Las fotos y videos de usuarios se suben bajo su responsabilidad. Al publicar,
  la persona declara que tiene los derechos o permisos (ver Términos, sección 5).
- Si llega una denuncia fundada, el contenido se puede pausar o dar de baja y se
  puede pedir la acreditación de la autorización.
- No se deben usar imágenes descargadas de Google, capturas de redes sociales ni
  fotos de bancos de imágenes sin licencia comercial.

## 2. Inventario actual

| Archivo | Uso | Estado | Qué falta |
| --- | --- | --- | --- |
| `public/marca/*` (logotipo, isotipo, favicon, íconos PWA) | Marca de la app | **Propio** | Confirmar autoría del diseño y guardar el archivo fuente o cesión del diseñador. |
| `src/assets/hero.png` | Imagen de portada | **A confirmar** | Indicar origen (foto propia, banco de imágenes o generada) y conservar la licencia. |
| `public/emotes/*.png` | Ilustraciones de oficios | **A confirmar** | Confirmar si son encargo propio, generadas con IA o de un banco. Guardar prompt/licencia/cesión. |
| Fotos de portada y galería de avisos | Contenido de usuarios | **Declarado por el usuario** | El formulario pide confirmar derechos. Ante denuncia, pedir autorización. |
| Videos e imágenes de anuncios | Contenido de anunciantes | **Declarado por el anunciante** | El formulario de anuncios incluye la declaración de derechos. |
| Foto del CV | Contenido del usuario | **Declarado por el usuario** | El CV avisa que la foto debe ser propia o tener permiso. |
| `public/icons.svg` (Bluesky, redes) | Íconos de terceros | **Marca de terceros** | Se usan como referencia de red social. No sugerir patrocinio. |
| Tipografías del sistema / Google Fonts | Tipografía | **Licencia del proveedor** | Mantener la atribución que exija la licencia (OFL/Apache). |

## 3. Qué hacer con `hero.png` y `emotes`

1. Confirmar el origen de cada archivo. Si fue un encargo, guardar el correo, la
   factura o el contrato con la cesión de derechos.
2. Si se generó con una herramienta de IA, guardar el prompt, la fecha y los
   términos de la herramienta (uso comercial permitido).
3. Si viene de un banco de imágenes, guardar la licencia y el comprobante. Las
   licencias gratuitas suelen excluir logos, personas identificables y uso
   político; verificar que el uso en publicidad de la app esté permitido.
4. Si no se puede acreditar, reemplazar el archivo antes de seguir usándolo.

## 4. Personas identificables

- Una foto de una persona requiere su consentimiento para el uso previsto. Si es
  menor de edad, hace falta el consentimiento de quien ejerce la responsabilidad
  parental.
- El consentimiento debe explicar dónde se va a publicar y por cuánto tiempo. Un
  “me sacaste una foto” no alcanza para publicidad.
- Si la imagen se usa para un anuncio, conviene un permiso escrito y separado del
  consentimiento general de la app.

## 5. Cómo acreditar y conservar

- Guardar los archivos de licencia/cesión en una carpeta privada del operador,
  fuera del repositorio público.
- Anotar en este inventario la fecha, la fuente y el comprobante.
- Ante un reclamo, responder con el plazo legal y, si corresponde, dar de baja el
  contenido mientras se revisa.

## 6. Pendiente de confirmación del titular

- [ ] Autoría y cesión de la marca y los logos.
- [ ] Origen y licencia de `src/assets/hero.png`.
- [ ] Origen y licencia de los 24 archivos de `public/emotes/`.
- [ ] Licencia de las tipografías cargadas desde Google Fonts.
- [ ] Revisión de las imágenes de muestra usadas en la vista previa
  (`herramientas/preview/`): no se publican en producción, pero conviene que
  también tengan origen claro.
