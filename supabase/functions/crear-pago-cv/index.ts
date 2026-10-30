// Crea el pago de la descarga del CV en Mercado Pago (Checkout Pro) y devuelve el enlace para pagar.
// El precio y la modalidad salen de app_settings: nunca del navegador.
//
// Secretos (Supabase > Edge Functions > Secrets):
//   MP_ACCESS_TOKEN  Access Token de Mercado Pago (primero el de prueba, después el de producción)
//   APP_URL          dirección de la app, por ejemplo https://laburamos.netlify.app
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
  const appUrl = (Deno.env.get('APP_URL') || '').replace(/\/$/, '');
  if (!mpToken || !appUrl) return json({ error: 'pago_no_configurado' }, 503);

  // Quién está pagando (con su sesión)
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: 'no_autenticado' }, 401);

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cfg } = await admin.from('app_settings').select('*').eq('id', 1).single();
  if (!cfg?.cv_paid_enabled) return json({ error: 'cobro_desactivado' }, 400);

  const { data: purchase, error } = await admin
    .from('cv_purchases')
    .insert({
      user_id: user.id,
      amount: cfg.cv_price,
      mode: cfg.cv_mode,
      days: cfg.cv_mode === 'por_dias' ? cfg.cv_days : null,
      status: 'pending',
    })
    .select()
    .single();
  if (error || !purchase) return json({ error: 'no_se_pudo_crear' }, 500);

  const back = `${appUrl}/?pago=cv`;
  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': purchase.id },
    body: JSON.stringify({
      items: [{ id: 'cv-pdf', title: 'Descarga de tu CV en PDF - LaburamosApp', quantity: 1, unit_price: Number(cfg.cv_price), currency_id: 'ARS' }],
      external_reference: purchase.id,
      back_urls: { success: back, pending: back, failure: back },
      auto_return: 'approved',
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      statement_descriptor: 'LABURAMOSAPP',
    }),
  });
  const pref = await res.json();
  if (!res.ok) return json({ error: 'mercadopago', detail: pref?.message }, 502);

  await admin.from('cv_purchases').update({ mp_preference_id: pref.id }).eq('id', purchase.id);
  return json({ url: pref.init_point });
});
