// Helpers compartidos por la tabla y el detalle. No contienen datos de ejemplo.
export const USER_FILTERS = [
  ['todos', 'Todos'], ['admins', 'Administradores'], ['verificados', 'Verificados'],
  ['bloqueados', 'Bloqueados'], ['pendientes', 'Piden verificación'],
  ['no-verificados', 'No verificados'], ['comercios', 'Comercios'], ['trabajadores', 'Trabajadores'],
];
const normalize = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterUsers(users, filter, search = '') {
  const term = normalize(search.trim());
  return users.filter((u) => {
    const matches = {
      todos: true, admins: !!u.is_admin, verificados: !!u.is_verified,
      bloqueados: !!u.is_blocked, pendientes: !!u.verification_requested && !u.is_verified,
      'no-verificados': !u.is_verified && !u.verification_requested,
      comercios: u.role === 'company', trabajadores: u.role === 'worker',
    };
    return !!matches[filter] && (!term || [u.full_name, u.email, u.city, u.province].some((v) => normalize(v).includes(term)));
  });
}
export function userStats(users) {
  return Object.fromEntries(['todos', 'admins', 'verificados', 'bloqueados', 'pendientes'].map((key) => [key, filterUsers(users, key).length]));
}
// Seis claves eligen la sobrecarga de la migración 022; ?? preserva false.
export function userPatchArgs(id, patch) {
  return {
    p_user: id, p_role: patch.role ?? null, p_is_admin: patch.is_admin ?? null,
    p_is_blocked: patch.is_blocked ?? null, p_is_verified: patch.is_verified ?? null,
    p_verification_requested: patch.verification_requested ?? null,
  };
}
export async function loadAllAdminUsers(client, pageSize = 500) {
  const users = new Map();
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.rpc('admin_users')
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    (data || []).forEach((u) => users.set(u.id, u));
    if (!data || data.length < pageSize) break;
  }
  return [...users.values()];
}
export function userPublications(data) {
  return [
    ...(data?.jobs || []).map((item) => ({ ...item, kind: 'job' })),
    ...(data?.services || []).map((item) => ({ ...item, kind: 'service' })),
  ].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || String(a.id).localeCompare(String(b.id)));
}
export function publicationState(item, now = Date.now()) {
  return item.status === 'active' && item.expires_at && Date.parse(item.expires_at) < now ? 'expired' : item.status;
}
export const PUBLICATION_STATES = { active: 'Activo', paused: 'Pausado', filled: 'Cubierto', expired: 'Vencido' };
