import { supabase } from '../supabaseClient';

// Reputación pública (promedio de estrellas y sello de verificado) de varias cuentas.
// La vista `user_reputation` solo expone esos datos: el perfil sigue siendo privado.
export async function loadReputation(ids) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!list.length) return {};
  const { data, error } = await supabase
    .from('user_reputation')
    .select('user_id, rating, reviews, comments, score, compliance, responsibility, communication, is_verified, verification_requested')
    .in('user_id', list);
  if (error) return {};
  return Object.fromEntries((data || []).map((r) => [r.user_id, r]));
}

// Agrega `reputation` a cada publicación (avisos por company_id, servicios por owner_id).
export function attachReputation(items, rep, idKey) {
  if (!items?.length) return items || [];
  return items.map((i) => ({ ...i, reputation: rep[i[idKey]] || null }));
}
