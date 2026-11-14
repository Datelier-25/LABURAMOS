# Postulaciones por email

Las postulaciones ya no se envían por WhatsApp ni desde el correo personal del
postulante. El flujo es:

1. La persona elige su CV (el de LaburamosApp o un PDF) y acepta Términos y Privacidad.
2. Pasa a una pantalla de confirmación donde ve el puesto, la empresa y puede
   agregar un comentario breve opcional.
3. Se guarda la postulación en la tabla `applications`.
4. La Edge Function `send_application_email` manda el correo a la empresa.

## Cabeceras del correo

| Campo | Valor |
| --- | --- |
| `From` | Remitente configurado en Admin (`app_settings.application_email_from`) |
| Nombre visible | `LaburamosApp - Juan Pérez` (`application_email_name` + postulante) |
| `Reply-To` | Email real del postulante |
| `To` | Email de postulaciones del aviso (`jobs.apply_email`) |

Así la empresa responde directo al postulante y el correo nunca se envía
"haciéndose pasar" por un Gmail/Outlook personal.

La dirección de la empresa **no se muestra** en la app: ni en el aviso ni en la
pantalla de postulación. El texto siempre explica que el correo sale desde
LaburamosApp y que el email del postulante va como `Responder a`.

## Diseño del correo

El HTML de la función usa la misma identidad que la app (`src/index.css`):

- Encabezado navy `#0F1242` con el logotipo claro (`/marca/logotipo-claro.png`).
- Título del aviso, empresa y mensaje del postulante con acento naranja `#FF6A00`.
- Perfil en tabla de dos columnas con etiquetas en mayúsculas y gris `#586088`.
- Bloque navy "Respondé este correo y le llega directo" con el email del postulante.
- Botón naranja a `/candidatos` y pie gris `#F2F4F7`.

Los estilos van inline porque los clientes de correo no cargan CSS externo. Las
imágenes se sirven desde el dominio público de la app, así que `APP_URL` tiene
que apuntar al sitio real para que el logo cargue.

### Foto del remitente (avatar)

El avatar que muestra Gmail junto al remitente **no lo controla el correo**: lo
define la cuenta del remitente. Para que aparezca el logo:

1. En la cuenta de Google del remitente (`laburamosapp@gmail.com`), cargar como
   foto de perfil el isotipo de la app.
2. Opcional: crear un Gravatar para esa misma dirección con el logo (lo usan
   Apple Mail, Outlook.com y Thunderbird).
3. A futuro, con dominio propio: publicar BIMI (requiere DMARC y, para el logo
   en Gmail, un certificado VMC pago).

## Configuración en Admin

En **Admin → Configuración → Correo de postulaciones** se definen:

- **Remitente (From):** por ejemplo `laburamosapp@gmail.com` o
  `postulaciones@tudominio.com` (recomendado: dominio propio verificado).
- **Nombre visible:** por defecto `LaburamosApp`.

El remitente debe estar verificado en el proveedor que se use (Resend, Brevo,
SendGrid, etc.). Si se usa un Gmail como remitente, conviene configurarlo como
remitente verificado en el proveedor; no se envía con la contraseña de Gmail.

## Proveedor de envío

La función soporta dos proveedores por variable de entorno. Alcanza con
configurar uno:

```bash
# Opción A: Resend
supabase secrets set RESEND_API_KEY=re_...

# Opción B: Brevo
supabase secrets set BREVO_API_KEY=xkeysib-...

# Opcional: enlace que aparece en el pie del correo
supabase secrets set APP_URL=https://laburamosapp.laburos-y-oficios.workers.dev
```

Publicar la función:

```bash
supabase functions deploy send_application_email
```

Mientras no haya proveedor configurado, la postulación se guarda igual y la
función registra `email_error = 'proveedor_no_configurado'`. No se pierde nada:
se puede reenviar cuando el proveedor esté listo.

## Seguimiento

En `applications`:

- `worker_comment`: comentario breve opcional del postulante.
- `email_sent_at`: cuándo se envió el correo.
- `email_error`: último error de envío (si hubo).

La función es idempotente: si `email_sent_at` ya tiene valor, no vuelve a enviar.

## Requisitos

- Bucket privado `cvs` para los PDF (ya existe).
- La persona debe estar logueada: la función valida que quien dispara el envío
  sea la dueña de la postulación.
- El aviso debe tener `apply_email` cargado. Al publicar o editar un aviso de
  empleo, el email es obligatorio.
