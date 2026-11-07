import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Trash2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { friendlyError } from '../lib/utils';
import { Empty } from './ui';
import UserActivityModal from './UserActivityModal';

function avatarInitials(name) {
  return (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function UsersPanel({ notify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [busy, setBusy] = useState('');
  const [activityUser, setActivityUser] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('admin_users');
    if (err) setError(friendlyError(err.message));
    setUsers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setUser = async (u, patch, message) => {
    if (patch.is_blocked === true && !window.confirm(`¿Bloquear a ${u.full_name || u.email}? No va a poder publicar ni postularse, y sus avisos se pausan.`)) return;
    setBusy(u.id);
    setError('');
    const { error: err } = await supabase.rpc('admin_set_user', {
      p_user: u.id,
      p_role: patch.role ?? null,
      p_is_admin: patch.is_admin ?? null,
      p_is_blocked: patch.is_blocked ?? null,
      p_is_verified: patch.is_verified ?? null,
    });
    setBusy('');
    if (err) setError(friendlyError(err.message));
    else {
      notify(message);
      load();
    }
  };

  const viewActivity = async (u) => {
    setActivityUser(u);
    setActivityLoading(true);
    setActivityData(null);
    const { data, error: err } = await supabase.rpc('admin_user_activity', { p_user: u.id });
    setActivityLoading(false);
    if (err) {
      notify(friendlyError(err.message), 'err');
    } else {
      setActivityData(data);
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`¿Eliminar a ${u.full_name || u.email}? Se borrarán TODOS sus datos: avisos, postulaciones, CV, reseñas, compras y su perfil. Esta acción NO se puede deshacer.`)) return;
    setBusy(u.id);
    setError('');
    const { error: err } = await supabase.rpc('admin_delete_user', { p_user: u.id });
    setBusy('');
    if (err) setError(friendlyError(err.message));
    else {
      notify('Usuario eliminado');
      load();
    }
  };

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return users.filter((u) => {
      const text = !t || [u.full_name, u.email, u.city].some((v) => (v || '').toLowerCase().includes(t));
      const f =
        filter === 'todos' ||
        (filter === 'comercios' && u.role === 'company') ||
        (filter === 'pendientes' && u.verification_requested && !u.is_verified) ||
        (filter === 'bloqueados' && u.is_blocked);
      return text && f;
    });
  }, [users, search, filter]);

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.is_admin).length,
    verified: users.filter((u) => u.is_verified).length,
    blocked: users.filter((u) => u.is_blocked).length,
    pending: users.filter((u) => u.verification_requested && !u.is_verified).length,
  };

  return (
    <section className="users-panel">
      {error && <p className="note err">{error}</p>}

      {/* Barra de herramientas */}
      <div className="users-toolbar">
        <div className="users-search">
          <label className="search">
            <span className="sr">Buscar usuarios</span>
            <input
              type="search"
              placeholder="Buscá por nombre, email o localidad"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Eye size={20} aria-hidden="true" />
          </label>
        </div>
        <select
          className="fbtn"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filtrar usuarios"
        >
          <option value="todos">Todos</option>
          <option value="comercios">Comercios</option>
          <option value="pendientes">Verificación pendiente{stats.pending ? ` (${stats.pending})` : ''}</option>
          <option value="bloqueados">Bloqueados</option>
        </select>
      </div>

      {/* Estadísticas rápidas */}
      <div className="users-stats">
        <div className="stat-card">
          <b>{stats.total}</b>
          <span>Usuarios</span>
        </div>
        <div className="stat-card">
          <b>{stats.admins}</b>
          <span>Administradores</span>
        </div>
        <div className="stat-card">
          <b>{stats.verified}</b>
          <span>Verificados</span>
        </div>
        <div className="stat-card">
          <b>{stats.blocked}</b>
          <span>Bloqueados</span>
        </div>
        <div className="stat-card warn">
          <b>{stats.pending}</b>
          <span>Piden verificación</span>
        </div>
      </div>

      <p className="users-count">
        {filtered.length} de {stats.total}
      </p>

      {loading ? (
        <p className="count">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Empty title="No hay usuarios" text="Probá con otra búsqueda o sacá el filtro." />
      ) : (
        <div className="users-list">
          {filtered.map((u) => (
            <div key={u.id} className={`user-card${u.is_blocked ? ' blocked' : ''}`}>
              <div className="user-main">
                <div className="user-avatar">
                  <span>{avatarInitials(u.full_name || u.email)}</span>
                </div>
                <div className="user-info">
                  <div className="user-name">
                    <b>{u.full_name || 'Sin nombre'}</b>
                    {u.is_admin && <span className="pill admin">Admin</span>}
                    {u.is_verified && <span className="pill verified">Verificado</span>}
                    {u.is_blocked && <span className="pill blocked">Bloqueado</span>}
                    {!u.is_blocked && !u.is_verified && u.verification_requested && (
                      <span className="pill pending">Pide verificación</span>
                    )}
                  </div>
                  <small>{u.email}</small>
                  <div className="user-role">
                    <span>{u.role === 'company' ? 'Comercio' : 'Trabajador'}</span>
                    <select
                      className="fbtn mini"
                      value={u.role}
                      disabled={busy === u.id}
                      aria-label={`Rol de ${u.full_name || u.email}`}
                      onChange={(e) =>
                        setUser(u, { role: e.target.value }, e.target.value === 'company' ? 'Ahora es comercio' : 'Ahora es trabajador')
                      }
                    >
                      <option value="worker">Trabajador</option>
                      <option value="company">Comercio</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="user-activity">
                <span>{u.listings} publicaciones</span>
                <span>{u.applications} postulaciones</span>
              </div>

              <div className="user-actions">
                <button
                  className="btn-icon"
                  disabled={busy === u.id || activityLoading}
                  onClick={() => viewActivity(u)}
                  title="Ver actividad completa"
                  aria-label="Ver actividad"
                >
                  <Eye size={16} />
                </button>

                {u.verification_requested && !u.is_verified ? (
                  <div className="action-group">
                    <button
                      className="btn btn-line btn-sm"
                      disabled={busy === u.id}
                      onClick={() => setUser(u, { is_verified: true, verification_requested: false }, 'Verificación aceptada')}
                      title="Aceptar verificación"
                    >
                      Aceptar verificación
                    </button>
                    <button
                      className="btn btn-line btn-sm"
                      disabled={busy === u.id}
                      onClick={() => setUser(u, { verification_requested: false }, 'Pedido rechazado')}
                      title="Rechazar verificación"
                    >
                      Rechazar
                    </button>
                  </div>
                ) : u.is_verified ? (
                  <button
                    className="btn btn-line btn-sm"
                    disabled={busy === u.id}
                    onClick={() => setUser(u, { is_verified: false }, 'Verificación quitada')}
                    title="Quitar verificación"
                  >
                    Quitar verificación
                  </button>
                ) : null}

                <button
                  className="btn btn-line btn-sm"
                  disabled={busy === u.id}
                  onClick={() => setUser(u, { is_admin: !u.is_admin }, u.is_admin ? 'Ya no es admin' : 'Ahora es admin')}
                  title={u.is_admin ? 'Quitar administrador' : 'Hacer administrador'}
                >
                  {u.is_admin ? 'Quitar admin' : 'Hacer admin'}
                </button>

                <button
                  className={`btn btn-sm ${u.is_blocked ? 'btn-line' : 'btn-danger'}`}
                  disabled={busy === u.id}
                  onClick={() => setUser(u, { is_blocked: !u.is_blocked }, u.is_blocked ? 'Desbloqueado' : 'Bloqueado')}
                  title={u.is_blocked ? 'Desbloquear cuenta' : 'Bloquear cuenta'}
                >
                  {u.is_blocked ? 'Desbloquear' : 'Bloquear'}
                </button>

                <button
                  className="btn-icon danger"
                  disabled={busy === u.id}
                  onClick={() => deleteUser(u)}
                  title="Eliminar usuario y todos sus datos"
                  aria-label="Eliminar usuario"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <UserActivityModal user={activityUser} data={activityData} onClose={() => setActivityUser(null)} loading={activityLoading} />
    </section>
  );
}
