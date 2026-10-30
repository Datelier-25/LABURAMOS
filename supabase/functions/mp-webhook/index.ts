// Recibe los avisos de Mercado Pago y marca la compra como aprobada o rechazada.
// No confía en lo que llega en el aviso: vuelve a consultar el pago a la API de Mercado Pago
// con el Access Token, así nadie puede "aprobar" un pago mandando un aviso falso.
// Se publica sin verificación de sesión:  supabase functions deploy mp-webhook --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ok = () => new Response('ok', { status: 200 });

Deno.serve(async (req) => {
  const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
  if (!mpToken) return new Response('sin configurar', { status: 503 });

  const url = new URL(req.url);
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    /* algunos avisos vienen solo por la dirección */
  }
  const type = body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic');
  const paymentId = body.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
  // El id de un pago de Mercado Pago es solo un número: cualquier otra cosa se descarta (SEC-005)
  if (type !== 'payment' || !/^\d{1,20}$/.test(String(paymentId ?? ''))) return ok();

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  });
  // Si Mercado Pago no responde, devolvemos error para que reintente el aviso
  if (!res.ok) return new Response('error', { status: 502 });
  const p = await res.json();
  if (!p.external_reference) return ok();

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: purchase } = await admin.from('cv_purchases').select('*').eq('id', p.external_reference).maybeSingle();
  if (!purchase) return ok();

  const reversed = ['refunded', 'charged_back', 'cancelled', 'rejected'].includes(p.status);
  if (purchase.status === 'approved' && !reversed) return ok(); // ya procesado

  const approved = p.status === 'approved' && p.currency_id === 'ARS' && Number(p.transaction_amount) >= Number(purchase.amount);
  const patch = approved
    ? {
        status: 'approved',
        mp_payment_id: String(p.id),
        approved_at: new Date().toISOString(),
        valid_until: purchase.mode === 'por_dias' ? new Date(Date.now() + purchase.days * 86400000).toISOString() : null,
        downloads_left: purchase.mode === 'por_descarga' ? 1 : null,
      }
    : { status: reversed ? 'rejected' : 'pending', mp_payment_id: String(p.id) };

  await admin.from('cv_purchases').update(patch).eq('id', purchase.id);
  return ok();
});
