import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, CircleAlert, Eye, LockKeyhole, MoreHorizontal, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { friendlyError } from '../lib/utils';
import { filterUsers, loadAllAdminUsers, USER_FILTERS, userPatchArgs, userStats } from '../lib/adminUsers';
import { Empty } from './ui';
import UserActivityModal from './UserActivityModal';

const KPIS = [
  ['todos', 'Usuarios', Users], ['admins', 'Administradores', ShieldCheck],
  ['verificados', 'Verificados', BadgeCheck], ['bloqueados', 'Bloqueados', LockKeyhole],
  ['pendientes', 'Piden verificación', CircleAlert],
];
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

export default function UsersPanel({ notify, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulk, setBulk] = useState('');
  const [activityUser, setActivityUser] = useState(null);
  const [activityTab, setActivityTab] = useState('publications');
  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const activityRequest = useRef(0);
  const listRequest = useRef(0);
  const operation = useRef(false);

  const load = useCallback(async () => {
    const request = ++listRequest.current;
    setLoading(true); setError('');
    try {
      const rows = await loadAllAdminUsers(supabase);
      if (request === listRequest.current) {
        setUsers(rows);
        setSelected((prev) => new Set([...prev].filter((id) => rows.some((u) => u.id === id))));
      }
    } catch (err) {
      if (request === listRequest.current) setError(friendlyError(err.message));
    } finally { if (request === listRequest.current) setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    return () => { listRequest.current++; activityRequest.current++; };
  }, [load]);

  const filtered = useMemo(() => filterUsers(users, filter, search), [users, filter, search]);
  const stats = useMemo(() => userStats(users), [users]);
  const selectable = filtered.filter((u) => u.id !== currentUser?.id);
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const changeFilter = (next) => { setFilter(next); setSearch(''); setSelected(new Set()); setBulk(''); };
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const getActivity = useCallback(async (u) => {
    const request = ++activityRequest.current;
    setActivityLoading(true); setActivityError('');
    try {
      const { data, error: err } = await supabase.rpc('admin_user_activity', { p_user: u.id });
      if (err) throw err;
      if (!data?.profile) throw new Error('No se encontró el perfil.');
      if (request === activityRequest.current) setActivityData(data);
    } catch (err) {
      if (request === activityRequest.current) setActivityError(friendlyError(err.message));
    } finally { if (request === activityRequest.current) setActivityLoading(false); }
  }, []);
  const viewActivity = (u, tab = 'publications') => {
    setActivityUser(u); setActivityTab(tab); setActivityData(null); getActivity(u);
  };
  const closeActivity = () => { activityRequest.current++; setActivityUser(null); setActivityData(null); };

  const setUser = async (u, patch, message) => {
    if (operation.current) return;
    if (u.id === currentUser?.id && (patch.is_blocked || patch.is_admin === false)) return;
    const question = patch.is_blocked === true
      ? `¿Bloquear a ${u.full_name || u.email}? No podrá publicar ni postularse y sus avisos activos se pausarán.`
      : patch.is_admin !== undefined
        ? `¿${patch.is_admin ? 'Dar permisos de administrador' : 'Quitar los permisos de administrador'} a ${u.full_name || u.email}?`
        : null;
    if (question && !window.confirm(question)) return;
    operation.current = true; setBusy(true); setError('');
    try {
      const { error: err } = await supabase.rpc('admin_set_user', userPatchArgs(u.id, patch));
      if (err) throw err;
      notify?.(message); await load();
    } catch (err) { setError(friendlyError(err.message)); }
    finally { operation.current = false; setBusy(false); }
  };
  const deleteUser = async (u) => {
    if (operation.current || u.id === currentUser?.id) return;
    if (!window.confirm(`¿Eliminar a ${u.full_name || u.email}? Se borrarán TODOS sus datos: publicaciones, postulaciones, CV, reseñas, compras y perfil. Esta acción no se puede deshacer.`)) return;
    operation.current = true; setBusy(true); setError('');
    try {
      const { error: err } = await supabase.rpc('admin_delete_user', { p_user: u.id });
      if (err) throw err;
      notify?.('Usuario eliminado'); await load();
    } catch (err) { setError(friendlyError(err.message)); }
    finally { operation.current = false; setBusy(false); }
  };
  const runBulk = async () => {
    const targets = filtered.filter((u) => selected.has(u.id) && u.id !== currentUser?.id);
    if (operation.current || !bulk || !targets.length) return;
    const label = { verify: 'Verificar', block: 'Bloquear', unblock: 'Desbloquear' }[bulk];
    if (!window.confirm(`¿${label} ${targets.length} cuenta(s)?${bulk === 'block' ? ' Sus avisos activos se pausarán.' : bulk === 'unblock' ? ' Los avisos pausados no se reactivarán automáticamente.' : ''}`)) return;
    operation.current = true; setBusy(true); setError('');
    const patch = bulk === 'verify' ? { is_verified: true, verification_requested: false } : { is_blocked: bulk === 'block' };
    const failed = []; let done = 0;
    for (const u of targets) {
      try {
        const { error: err } = await supabase.rpc('admin_set_user', userPatchArgs(u.id, patch));
        if (err) throw err;
        done++;
      } catch (err) { failed.push({ id: u.id, name: u.full_name || u.email, message: friendlyError(err.message) }); }
    }
    await load();
    setSelected(new Set(failed.map((u) => u.id))); setBulk('');
    if (done) notify?.(`${done} cuenta(s) actualizada(s)`);
    if (failed.length) setError(`No se actualizaron ${failed.length} cuenta(s): ${failed.map((u) => `${u.name}: ${u.message}`).join(' · ')}`);
    operation.current = false; setBusy(false);
  };

  return <section className="admin-users" aria-label="Gestión de usuarios" aria-busy={loading || busy}>
    <div className="au-kpis" aria-label="Filtros rápidos de usuarios">
      {KPIS.map(([key, label, Icon]) => <button type="button" key={key} disabled={busy || loading} className="au-kpi" aria-pressed={filter === key} onClick={() => changeFilter(key)}>
        <Icon size={18} aria-hidden="true" /><b>{loading ? '—' : stats[key]}</b><span>{label}</span>
      </button>)}
    </div>
    <h2>Usuarios</h2>
    <div className="au-toolbar">
      <label className="au-search"><span className="sr">Buscar por nombre, email o localidad</span><input type="search" placeholder="Buscar por nombre, email o localidad" value={search} disabled={busy} onChange={(e) => { setSearch(e.target.value); setSelected(new Set()); }} /><Search size={18} aria-hidden="true" /></label>
      <div className="au-chips" aria-label="Filtrar cuentas">{[['todos', 'Todos'], ['verificados', 'Verificados'], ['admins', 'Administradores']].map(([key, label]) => <button type="button" key={key} disabled={busy} aria-pressed={filter === key} onClick={() => changeFilter(key)}>{label}</button>)}</div>
      <label className="sr" htmlFor="au-filter">Más filtros de usuarios</label><select id="au-filter" className="au-select" disabled={busy} value={filter} onChange={(e) => changeFilter(e.target.value)}>{USER_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    </div>
    <div className="au-results"><p aria-live="polite">{loading ? 'Cargando usuarios…' : `Mostrando ${filtered.length} de ${users.length} usuarios`}{selected.size > 0 ? ` · ${selected.size} seleccionados` : ''}</p>
      <div className="au-bulk"><label className="sr" htmlFor="au-bulk">Acciones sobre usuarios seleccionados</label><select id="au-bulk" className="au-select" value={bulk} disabled={!selected.size || busy || loading} onChange={(e) => setBulk(e.target.value)}><option value="">Acciones en lote</option><option value="verify">Verificar</option><option value="block">Bloquear</option><option value="unblock">Desbloquear</option></select><button className="au-btn" type="button" disabled={!bulk || busy || loading} onClick={runBulk}>{busy ? 'Procesando…' : 'Aplicar'}</button></div>
    </div>
    {error && <div className="note err" role="alert">{error} <button type="button" className="au-btn" disabled={busy || loading} onClick={load}>Reintentar carga</button></div>}
    {!loading && !error && !filtered.length && <Empty title="No hay usuarios para estos filtros" text="Probá otra búsqueda o elegí Todos." />}
    {users.length > 0 && <div className="au-table-scroll"><table className="au-table"><caption className="sr">Cuentas de la aplicación y acciones administrativas</caption><thead><tr><th><input type="checkbox" aria-label="Seleccionar los usuarios visibles, excepto tu cuenta" disabled={busy || loading || !selectable.length} checked={allSelected} ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelected; }} onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((u) => u.id)))} /></th><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Estado</th><th scope="col">Actividad</th><th scope="col">Acciones</th></tr></thead><tbody>
      {filtered.map((u) => { const self = u.id === currentUser?.id; return <tr key={u.id} className={selected.has(u.id) ? 'au-selected' : ''}>
        <td><input type="checkbox" aria-label={`Seleccionar a ${u.full_name || u.email}`} disabled={busy || loading || self} checked={selected.has(u.id)} onChange={() => toggle(u.id)} /></td>
        <th scope="row"><div className="au-person"><span className="au-avatar" aria-hidden="true">{initials(u.full_name || u.email)}</span><span><b>{u.full_name || 'Sin nombre'}{self ? ' (vos)' : ''}</b><small>{u.email}</small></span></div></th>
        <td><span className={`au-badge ${u.is_admin ? 'admin' : u.role === 'company' ? 'company' : 'worker'}`}>{u.is_admin ? 'Admin' : u.role === 'company' ? 'Empleador' : 'Trabajador'}</span></td>
        <td><div className="au-status">{u.is_blocked && <span className="au-badge blocked">Bloqueado</span>}<span className={`au-badge ${u.is_verified ? 'verified' : u.verification_requested ? 'pending' : 'unverified'}`}>{u.is_verified ? 'Verificado' : u.verification_requested ? 'En proceso' : 'No verificado'}</span></div></td>
        <td><div className="au-activity-links"><button type="button" onClick={() => viewActivity(u, 'publications')}>{u.listings || 0} publicaciones</button><span aria-hidden="true"> / </span><button type="button" onClick={() => viewActivity(u, 'activity')}>{u.applications || 0} postulaciones</button></div></td>
        <td><div className="au-row-actions"><button className="au-btn au-icon" type="button" onClick={() => viewActivity(u, 'account')} aria-label={`Ver cuenta de ${u.full_name || u.email}`}><Eye size={15} /></button>
          <button className="au-btn" type="button" disabled={busy || loading} onClick={() => setUser(u, { is_verified: !u.is_verified, verification_requested: false }, u.is_verified ? 'Verificación quitada' : 'Cuenta verificada')}>{u.is_verified ? 'Quitar verificación' : u.verification_requested ? 'Aceptar verificación' : 'Verificar'}</button>
          <button className="au-btn" type="button" disabled={busy || loading || self} onClick={() => setUser(u, { is_admin: !u.is_admin }, u.is_admin ? 'Permisos de admin quitados' : 'Administrador asignado')}>{u.is_admin ? 'Quitar admin' : 'Hacer admin'}</button>
          <button className="au-btn au-danger" type="button" disabled={busy || loading || self} onClick={() => setUser(u, { is_blocked: !u.is_blocked }, u.is_blocked ? 'Cuenta desbloqueada; sus avisos siguen pausados' : 'Cuenta bloqueada')}>{u.is_blocked ? 'Desbloquear' : 'Bloquear'}</button>
          <button className="au-btn au-icon au-danger" type="button" disabled={busy || loading || self} onClick={() => deleteUser(u)} aria-label={`Eliminar cuenta de ${u.full_name || u.email}`}><Trash2 size={14} /></button>
          <details className="au-more"><summary aria-label={`Más acciones para ${u.full_name || u.email}`}><MoreHorizontal size={17} /></summary><div><button className="au-btn" type="button" onClick={() => viewActivity(u)}>Ver publicaciones</button>{u.verification_requested && !u.is_verified && <button className="au-btn" type="button" disabled={busy || loading} onClick={() => setUser(u, { verification_requested: false }, 'Pedido de verificación rechazado')}>Rechazar verificación</button>}<button className="au-btn" type="button" disabled={busy || loading} onClick={() => setUser(u, { role: u.role === 'company' ? 'worker' : 'company' }, 'Tipo de cuenta actualizado')}>Cambiar a {u.role === 'company' ? 'trabajador' : 'empleador'}</button></div></details>
        </div></td>
      </tr>; })}
    </tbody></table></div>}
    {activityUser && <UserActivityModal key={activityUser.id} user={activityUser} data={activityData} loading={activityLoading} error={activityError} initialTab={activityTab} onClose={closeActivity} onRetry={() => getActivity(activityUser)} onChanged={() => { getActivity(activityUser); load(); }} />}
  </section>;
}
