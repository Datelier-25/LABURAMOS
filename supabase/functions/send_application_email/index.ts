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

function resumeBlock(resume: Record<string, any> | null, app: Record<string, any>) {
  if (!resume) {
    return `<p><b>${escapeHtml(app.worker_name || 'La persona')}</b> se postuló con su perfil de LaburamosApp.</p>`;
  }

  const rows: string[] = [];
  const add = (label: string, value: unknown) => {
    const text = clean(value);
    if (text) rows.push(`<tr><td style="padding:4px 12px 4px 0;color:#666">${label}</td><td>${escapeHtml(text)}</td></tr>`);
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
    ? `<p style="margin:16px 0;padding:12px 16px;background:#f5f5f3;border-radius:8px">${escapeHtml(summary).replaceAll('\n', '<br>')}</p>`
    : '';

  return `
    <table style="border-collapse:collapse;font-size:14px">${rows.join('')}</table>
    ${summaryHtml}
    <p style="font-size:13px;color:#666">CV completo en LaburamosApp, sección Postulantes.</p>
  `;
}

function buildHtml(app: Record<string, any>, job: Record<string, any>, resume: Record<string, any> | null) {
  const worker = clean(app.worker_name || resume?.full_name || 'Una persona');
  const comment = clean(app.worker_comment);
  const appUrl = clean(Deno.env.get('APP_URL')) || 'https://laburamosapp.laburos-y-oficios.workers.dev';

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f5f5f3;font-family:Arial,Helvetica,sans-serif;color:#1c1c1c">
    <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:14px;padding:28px">
      <p style="margin:0 0 4px;font-size:13px;color:#666">LaburamosApp</p>
      <h1 style="margin:0 0 16px;font-size:22px">Nueva postulación: ${escapeHtml(job.title)}</h1>
      <p style="margin:0 0 20px;font-size:15px">
        <b>${escapeHtml(worker)}</b> se postuló a <b>${escapeHtml(job.title)}</b>
        ${job.company_name ? ` en <b>${escapeHtml(job.company_name)}</b>` : ''}.
      </p>
      ${
        comment
          ? `<div style="margin:0 0 20px;padding:12px 16px;border-left:3px solid #1c1c1c;background:#fafaf8">
               <p style="margin:0 0 4px;font-size:12px;color:#666">Comentario para el empleador</p>
               <p style="margin:0;font-size:15px">${escapeHtml(comment).replaceAll('\n', '<br>')}</p>
             </div>`
          : ''
      }
      <h2 style="margin:24px 0 8px;font-size:16px">Perfil del postulante</h2>
      ${resumeBlock(resume, app)}
      ${
        app.cv_kind === 'file'
          ? `<p style="margin:16px 0;font-size:14px">📎 Adjunto: <b>${escapeHtml(app.cv_name || 'CV en PDF')}</b></p>`
          : ''
      }
      <hr style="border:0;border-top:1px solid #e6e6e2;margin:24px 0">
      <p style="margin:0 0 8px;font-size:14px">
        Para responderle, usá <b>Responder</b>: el correo va directo a
        <b>${escapeHtml(app.email || 'su email')}</b>.
      </p>
      <p style="margin:0;font-size:12px;color:#777">
        Este correo se envió desde LaburamosApp a pedido de la persona postulante.
        Ver postulantes: <a href="${escapeHtml(appUrl)}" style="color:#1c1c1c">${escapeHtml(appUrl)}</a>
      </p>
    </div>
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
