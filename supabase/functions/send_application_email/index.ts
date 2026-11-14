// Envía por correo una postulación a la empresa.
//
// Arquitectura (para no caer en spam):
//   From:      remitente propio configurado en Admin (application_email_from)
//   From name: "LaburamosApp - Juan Pérez" (application_email_name + postulante)
//   Reply-To:  email real del postulante (la empresa le responde directo)
//   To:        email de postulaciones del aviso (jobs.apply_email)
//
// El correo nunca se envía "como" el Gmail/Outlook del postulante.
//
// Variables de entorno (elegí un proveedor):
//   RESEND_API_KEY   -> https://resend.com
//   BREVO_API_KEY    -> https://brevo.com
//   APP_URL          -> opcional, para los enlaces del correo
//
// Deploy:
//   supabase functions deploy send_application_email
//   supabase secrets set RESEND_API_KEY=re_...
//
// El cliente la invoca con supabase.functions.invoke('send_application_email', {
//   body: { application_id }
// }). Si falla, la postulación igual queda guardada y se puede reenviar.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const clean = (value: unknown) => String(value ?? '').trim();

// Paleta y tipografía de la marca (las mismas de src/index.css) para que el
// correo se sienta parte de la app. Todo con estilos inline: los clientes de
// correo no cargan CSS externo.
const BRAND = {
  ink: '#0F1242',
  blue: '#405AE5',
  sky: '#99C4EF',
  orange: '#FF6A00',
  mist: '#F2F4F7',
  line: '#DCDFEC',
  muted: '#586088',
  paper: '#FFFFFF',
};
const FONT = 'Arial,Helvetica,sans-serif';

const fieldRow = (label: string, value: string) => `<tr>
      <td width="128" style="width:128px;padding:0 14px 12px 0;vertical-align:top;font:700 11px/1.5 ${FONT};letter-spacing:.06em;text-transform:uppercase;color:${BRAND.muted}">${label}</td>
      <td style="padding:0 0 12px;vertical-align:top;font:400 14px/1.55 ${FONT};color:${BRAND.ink}">${value}</td>
    </tr>`;

const sectionTitle = (text: string) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px">
      <tr>
        <td style="width:4px;height:16px;background:${BRAND.orange};border-radius:2px"></td>
        <td style="padding-left:10px;font:700 11px/1.2 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:${BRAND.ink}">${text}</td>
      </tr>
    </table>`;

function resumeBlock(resume: Record<string, any> | null, app: Record<string, any>) {
  if (!resume) {
    return `<p style="margin:0;font:400 14px/1.6 ${FONT};color:${BRAND.muted}">
      <b style="color:${BRAND.ink}">${escapeHtml(app.worker_name || 'La persona')}</b> se postuló con su perfil de LaburamosApp.
    </p>`;
  }

  const rows: string[] = [];
  const add = (label: string, value: unknown) => {
    const text = clean(value);
    if (text) rows.push(fieldRow(label, escapeHtml(text).replaceAll('\n', '<br>')));
  };

  add('Nombre', resume.full_name || app.worker_name);
  add('Profesión', resume.profession);
  add('Ciudad', [resume.city, resume.province].filter(Boolean).join(', '));
  add('Teléfono', resume.phone || app.worker_phone);
  add('Email', resume.email || app.email);
  add('Disponibilidad', resume.availability);

  const skills = Array.isArray(resume.skills_list) ? resume.skills_list : String(resume.skills || '').split(',');
  const skillText = skills.map((s) => clean(s)).filter(Boolean).join(' · ');
  if (skillText) add('Habilidades', skillText);

  const experience = Array.isArray(resume.experience_list) ? resume.experience_list : [];
  const experienceText = experience
    .map((item) => [item?.role || item?.puesto, item?.place || item?.lugar, item?.detail || item?.detalle].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('\n');
  if (experienceText) add('Experiencia', experienceText);

  const education = Array.isArray(resume.education) ? resume.education : [];
  const educationText = education
    .map((item) => [item?.title || item?.titulo, item?.place || item?.lugar, item?.detail || item?.detalle].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('\n');
  if (educationText) add('Educación', educationText);

  const summary = clean(resume.summary);
  const summaryHtml = summary
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;background:${BRAND.mist};border-radius:14px">
        <tr><td style="padding:14px 16px;font:400 14px/1.6 ${FONT};color:${BRAND.ink}">${escapeHtml(summary).replaceAll('\n', '<br>')}</td></tr>
      </table>`
    : '';

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">${rows.join('')}</table>
    ${summaryHtml}
    <p style="margin:14px 0 0;font:400 12px/1.5 ${FONT};color:${BRAND.muted}">CV completo en LaburamosApp, sección Postulantes.</p>
  `;
}

function buildHtml(app: Record<string, any>, job: Record<string, any>, resume: Record<string, any> | null) {
  const worker = clean(app.worker_name || resume?.full_name || 'Una persona');
  const comment = clean(app.worker_comment);
  const company = clean(job.company_name);
  const appUrl = (clean(Deno.env.get('APP_URL')) || 'https://laburamosapp.laburos-y-oficios.workers.dev').replace(/\/+$/, '');
  const logoUrl = `${appUrl}/marca/logotipo-claro.png`;
  const candidatesUrl = `${appUrl}/candidatos`;
  const replyEmail = clean(app.email || resume?.email) || 'su email';

  const commentBlock = comment
    ? `<tr>
        <td style="padding:22px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF6EF;border-left:4px solid ${BRAND.orange};border-radius:0 14px 14px 0">
            <tr>
              <td style="padding:14px 16px">
                <p style="margin:0 0 6px;font:700 10px/1.4 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:#B44A00">Mensaje del postulante</p>
                <p style="margin:0;font:400 15px/1.6 ${FONT};color:${BRAND.ink}">${escapeHtml(comment).replaceAll('\n', '<br>')}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  const attachBlock =
    app.cv_kind === 'file'
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;background:${BRAND.mist};border:1px solid ${BRAND.line};border-radius:14px">
          <tr>
            <td style="padding:12px 16px;font:700 13px/1.5 ${FONT};color:${BRAND.ink}">📎 CV adjunto: <span style="font-weight:400;color:${BRAND.muted}">${escapeHtml(app.cv_name || 'CV en PDF')}</span></td>
          </tr>
        </table>`
      : '';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Nueva postulación: ${escapeHtml(job.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.mist}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(worker)} se postuló a ${escapeHtml(job.title)}. Abrí el correo para ver su perfil y responderle.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.mist}">
      <tr>
        <td align="center" style="padding:28px 12px">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:20px;overflow:hidden">
            <tr>
              <td style="background:${BRAND.ink};padding:20px 28px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left">
                      <img src="${logoUrl}" width="150" height="19" alt="LaburamosApp" style="display:block;width:150px;height:auto;border:0;outline:none;text-decoration:none">
                    </td>
                    <td align="right" style="font:700 10px/1.2 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${BRAND.sky}">Nueva postulación</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 0">
                ${company ? `<p style="margin:0 0 8px;font:700 11px/1.4 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:${BRAND.blue}">${escapeHtml(company)}</p>` : ''}
                <h1 style="margin:0 0 14px;font:800 25px/1.22 ${FONT};color:${BRAND.ink}">${escapeHtml(job.title)}</h1>
                <p style="margin:0;font:400 15px/1.6 ${FONT};color:${BRAND.ink}">
                  <b>${escapeHtml(worker)}</b> se postuló a este aviso${company ? ` en <b>${escapeHtml(company)}</b>` : ''}.
                </p>
              </td>
            </tr>
            ${commentBlock}
            <tr>
              <td style="padding:26px 28px 0">
                ${sectionTitle('Perfil del postulante')}
                ${resumeBlock(resume, app)}
                ${attachBlock}
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 0">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.ink};border-radius:16px">
                  <tr>
                    <td style="padding:18px 20px">
                      <p style="margin:0 0 4px;font:700 15px/1.4 ${FONT};color:#FFFFFF">Respondé este correo y le llega directo</p>
                      <p style="margin:0;font:400 13px/1.6 ${FONT};color:${BRAND.sky}">Va a <b style="color:#FFFFFF">${escapeHtml(replyEmail)}</b>. No hace falta entrar a la app.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 30px">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background:${BRAND.orange};border-radius:999px">
                      <a href="${candidatesUrl}" style="display:inline-block;padding:13px 24px;font:700 14px/1 ${FONT};color:${BRAND.ink};text-decoration:none">Ver la postulación completa</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:12px 0 0;font:400 12px/1.5 ${FONT};color:${BRAND.muted}">Ahí ves el CV completo, el archivo si adjuntó uno y todas tus postulaciones.</p>
              </td>
            </tr>
            <tr>
              <td style="background:${BRAND.mist};border-top:1px solid ${BRAND.line};padding:20px 28px">
                <p style="margin:0 0 6px;font:700 12px/1.5 ${FONT};color:${BRAND.ink}">LaburamosApp</p>
                <p style="margin:0;font:400 12px/1.6 ${FONT};color:${BRAND.muted}">
                  Este correo se envió desde LaburamosApp a pedido de la persona postulante. El remitente es la app:
                  al responder, la respuesta va al postulante.
                </p>
                <p style="margin:8px 0 0;font:400 12px/1.6 ${FONT};color:${BRAND.muted}">
                  <a href="${appUrl}" style="color:${BRAND.blue};text-decoration:none">${appUrl}</a>
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font:400 11px/1.5 ${FONT};color:${BRAND.muted}">Recibís este correo porque alguien se postuló a un aviso publicado en LaburamosApp.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendWithResend(input: {
  apiKey: string;
  from: string;
  fromName: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  attachment?: { filename: string; content: string };
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${input.fromName} <${input.from}>`,
      to: [input.to],
      reply_to: input.replyTo,
      subject: input.subject,
      html: input.html,
      attachments: input.attachment ? [input.attachment] : undefined,
    }),
  });
  if (!res.ok) throw new Error(`resend_${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function sendWithBrevo(input: {
  apiKey: string;
  from: string;
  fromName: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  attachment?: { name: string; content: string };
}) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': input.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: input.from, name: input.fromName },
      to: [{ email: input.to }],
      replyTo: { email: input.replyTo },
      subject: input.subject,
      htmlContent: input.html,
      attachment: input.attachment ? [input.attachment] : undefined,
    }),
  });
  if (!res.ok) throw new Error(`brevo_${res.status}: ${(await res.text()).slice(0, 300)}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const brevoKey = Deno.env.get('BREVO_API_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'supabase_no_configurado' }, 503);

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'sin_sesion' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: 'sesion_invalida' }, 401);

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'cuerpo_invalido' }, 400);
  }

  const applicationId = clean(body.application_id);
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return json({ error: 'postulacion_invalida' }, 400);

  const { data: app } = await admin.from('applications').select('*').eq('id', applicationId).maybeSingle();
  if (!app) return json({ error: 'postulacion_no_encontrada' }, 404);

  // Puede disparar el envío quien se postuló, la empresa dueña del aviso o un admin.
  let allowed = app.worker_id === user.id || app.email === user.email;
  if (!allowed && app.company_id === user.id) allowed = true;
  if (!allowed) {
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    allowed = !!profile?.is_admin;
  }
  if (!allowed) return json({ error: 'sin_permiso' }, 403);

  if (app.email_sent_at) return json({ ok: true, already_sent: true });

  const [{ data: job }, { data: settings }, { data: resume }] = await Promise.all([
    admin.from('jobs').select('*').eq('id', app.job_id).maybeSingle(),
    admin.from('app_settings').select('application_email_from, application_email_name').eq('id', 1).maybeSingle(),
    admin.from('resumes').select('*').eq('user_id', app.worker_id || user.id).maybeSingle(),
  ]);

  if (!job) return json({ error: 'aviso_no_encontrado' }, 404);
  if (!job.apply_email) {
    // El aviso quedó sin correo (avisos viejos). Se registra para que el
    // administrador o el dueño sepan por qué no salió el correo.
    await admin.from('applications').update({ email_error: 'aviso_sin_email' }).eq('id', app.id);
    return json({ error: 'aviso_sin_email' }, 422);
  }

  const from = clean(settings?.application_email_from) || 'laburamosapp@gmail.com';
  const appName = clean(settings?.application_email_name) || 'LaburamosApp';
  const workerName = clean(app.worker_name || resume?.full_name) || 'Postulante';
  const replyTo = clean(app.email || resume?.email || user.email);
  const subject = `Postulación: ${job.title} · ${appName}`;
  const html = buildHtml(app, job, resume || null);

  if (!replyTo) {
    await admin.from('applications').update({ email_error: 'postulante_sin_email' }).eq('id', app.id);
    return json({ error: 'postulante_sin_email' }, 422);
  }

  // Adjunto del CV en PDF (bucket privado "cvs").
  let attachment: { filename: string; content: string } | undefined;
  if (app.cv_kind === 'file' && app.cv_path) {
    const { data: file } = await admin.storage.from('cvs').download(app.cv_path);
    if (file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      attachment = { filename: clean(app.cv_name) || 'CV.pdf', content: btoa(binary) };
    }
  }

  try {
    if (resendKey) {
      await sendWithResend({
        apiKey: resendKey,
        from,
        fromName: `${appName} - ${workerName}`,
        to: job.apply_email,
        replyTo,
        subject,
        html,
        attachment,
      });
    } else if (brevoKey) {
      await sendWithBrevo({
        apiKey: brevoKey,
        from,
        fromName: `${appName} - ${workerName}`,
        to: job.apply_email,
        replyTo,
        subject,
        html,
        attachment: attachment ? { name: attachment.filename, content: attachment.content } : undefined,
      });
    } else {
      await admin.from('applications').update({ email_error: 'proveedor_no_configurado' }).eq('id', app.id);
      return json({ error: 'proveedor_no_configurado' }, 503);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error_desconocido';
    await admin.from('applications').update({ email_error: message.slice(0, 500) }).eq('id', app.id);
    return json({ error: 'envio_fallido', detail: message }, 502);
  }

  await admin
    .from('applications')
    .update({ email_sent_at: new Date().toISOString(), email_error: null })
    .eq('id', app.id);

  return json({ ok: true });
});
