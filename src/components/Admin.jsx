import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Pause, Pencil, Play, Search, Trash2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { JOB_CATEGORIES, JOB_TYPES, PAY_MODES as MODES, SERVICE_CATEGORIES, friendlyError, money } from '../lib/utils';
import { Empty } from './ui';
import { CvModal } from './Candidates';

const STATUS = { approved: 'Aprobado', pending: 'Pendiente', rejected: 'Rechazado' };
const LISTING_STATUS = { active: 'Activo', paused: 'Pausado', filled: 'Cubierto', expired: 'Vencido' };
const TABS = [
  { id: 'config', label: 'Configuración' },
  { id: 'jobs', label: 'Avisos de empleo' },
  { id: 'services', label: 'Servicios' },
  { id: 'cvs', label: 'CVs' },
  { id: 'users', label: 'Usuarios' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'recibidos', label: 'Recibidos' },
];
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const stateOf = (item) => (item.status === 'active' && new Date(item.expires_at) < new Date() ? 'expired' : item.status);

// ---------- configuración ----------
function SettingsTab({ notify, onSaved }) {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(friendlyError(err.message));
        setCfg({ cv_paid_enabled: false, cv_price: 3000, cv_mode: 'por_dias', cv_days: 30, job_days: 30, service_days: 30, contact_email: 'laburamosapp@gmail.com', ...data });
      });
  }, []);

  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const num = (v) => Number(String(v).replace(',', '.'));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const price = num(cfg.cv_price);
    const days = [num(cfg.cv_days), num(cfg.job_days), num(cfg.service_days)];
    if (!(price > 0) || price > 1000000) return setError('Poné un precio mayor a $0.');
    if (days.some((d) => !(d >= 1 && d <= 365))) return setError('Los días tienen que estar entre 1 y 365.');
    setSaving(true);
    const { error: err } = await supabase
      .from('app_settings')
      .update({
        cv_paid_enabled: cfg.cv_paid_enabled,
        cv_price: price,
        cv_mode: cfg.cv_mode,
        cv_days: days[0],
        job_days: days[1],
        service_days: days[2],
        contact_email: cfg.contact_email?.trim() || 'laburamosapp@gmail.com',
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);
    if (err) setError(friendlyError(err.message));
    else {
      notify('Configuración guardada');
      onSaved?.();
    }
  };

  if (!cfg) return <p className="count">Cargando…</p>;

  return (
    <form className="admin-card" onSubmit={save}>
      {error && <p className="note err">{error}</p>}

      <h2 className="block-title">Contacto</h2>
      <p className="lede">Correo donde llegan las sugerencias y denuncias del sitio.</p>
      <div className="field">
        <span>Correo de contacto</span>
        <input type="email" value={cfg.contact_email || ''} onChange={(e) => set({ contact_email: e.target.value })} />
      </div>

      <h2 className="block-title">Duración de las publicaciones</h2>
      <p className="lede">Se aplica a lo que se publique o renueve de ahora en adelante. Para cambiar una publicación puntual, editala en su pestaña.</p>
      <div className="two">
        <label className="field">
          <span>Avisos de empleo (días)</span>
          <input inputMode="numeric" value={cfg.job_days} onChange={(e) => set({ job_days: e.target.value.replace(/\D/g, '') })} />
        </label>
        <label className="field">
          <span>Servicios y pedidos (días)</span>
          <input inputMode="numeric" value={cfg.service_days} onChange={(e) => set({ service_days: e.target.value.replace(/\D/g, '') })} />
        </label>
      </div>

      <h2 className="block-title">Descarga del CV en PDF</h2>
      <label className="switch">
        <input className="sr" type="checkbox" checked={cfg.cv_paid_enabled} onChange={(e) => set({ cv_paid_enabled: e.target.checked })} />
        <span className="sw" aria-hidden="true" />
        <span>
          <b>Cobrar la descarga</b>
          <small>{cfg.cv_paid_enabled ? 'Para descargar el CV hay que pagar con Mercado Pago.' : 'Ahora la descarga es libre para todos.'}</small>
        </span>
      </label>
      <div className="two">
        <label className="field">
          <span>Precio (en pesos)</span>
          <input inputMode="decimal" value={cfg.cv_price} onChange={(e) => set({ cv_price: e.target.value.replace(/[^\d.,]/g, '') })} />
        </label>
        {cfg.cv_mode === 'por_dias' && (
          <label className="field">
            <span>Cantidad de días</span>
            <input inputMode="numeric" value={cfg.cv_days} onChange={(e) => set({ cv_days: e.target.value.replace(/\D/g, '') })} />
          </label>
        )}
      </div>
      <div className="field">
        <span>Qué compra la persona</span>
        <div className="tiles three">
          {Object.entries(MODES).map(([id, label]) => (
            <button key={id} type="button" className={`tile${cfg.cv_mode === id ? ' on' : ''}`} onClick={() => set({ cv_mode: id })} aria-pressed={cfg.cv_mode === id}>
              <b>{label}</b>
              <small>
                {id === 'por_descarga' && 'Cada PDF se paga. Puede repetir la descarga durante 24 horas.'}
                {id === 'por_dias' && `Descarga todas las veces que quiera durante ${cfg.cv_days || '…'} días.`}
                {id === 'para_siempre' && 'Paga una vez y descarga sin límite.'}
              </small>
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-ink btn-lg" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar configuración'}
      </button>
    </form>
  );
}

// ---------- editar una publicación ----------
function EditListing({ kind, item, onClose, onSaved }) {
  const isJob = kind === 'job';
  const [f, setF] = useState({
    ...item,
    expires: item.expires_at ? item.expires_at.slice(0, 10) : '',
    salary: item.salary || '',
    requirements: item.requirements || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const p = {
      title: f.title,
      category: f.category,
      description: f.description || '',
      phone: f.phone || '',
      is_urgent: !!f.is_urgent,
      status: f.status,
      ...(f.expires ? { expires_at: new Date(`${f.expires}T23:59:59`).toISOString() } : {}),
      ...(isJob
        ? { company_name: f.company_name, job_type: f.job_type, salary: f.salary, requirements: f.requirements }
        : { provider_name: f.provider_name, intent: f.intent || 'ofrece' }),
    };
    const { error: err } = await supabase.rpc('admin_update_listing', { p_kind: kind, p_id: item.id, p });
    setSaving(false);
    if (err) setError(friendlyError(err.message));
    else onSaved();
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="place-dlg admin-edit" role="dialog" aria-modal="true" aria-label="Editar publicación" onSubmit={save}>
        <div className="place-head">
          <h2>Editar {isJob ? 'aviso' : 'servicio'}</h2>
          <button type="button" className="x-sm" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {error && <p className="note err">{error}</p>}
        <label className="field">
          <span>Título</span>
          <input required value={f.title || ''} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <div className="two">
          <label className="field">
            <span>{isJob ? 'Comercio o empresa' : 'Nombre'}</span>
            <input value={(isJob ? f.company_name : f.provider_name) || ''} onChange={(e) => set(isJob ? { company_name: e.target.value } : { provider_name: e.target.value })} />
          </label>
          <label className="field">
            <span>Rubro</span>
            <select value={f.category} onChange={(e) => set({ category: e.target.value })}>
              {(isJob ? JOB_CATEGORIES : SERVICE_CATEGORIES).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        {isJob ? (
          <div className="two">
            <label className="field">
              <span>Modalidad</span>
              <select value={f.job_type} onChange={(e) => set({ job_type: e.target.value })}>
                {JOB_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Sueldo</span>
              <input value={f.salary} onChange={(e) => set({ salary: e.target.value })} />
            </label>
          </div>
        ) : (
          <label className="field">
            <span>Tipo</span>
            <select value={f.intent || 'ofrece'} onChange={(e) => set({ intent: e.target.value })}>
              <option value="ofrece">Ofrece un servicio</option>
              <option value="busca">Busca quien le haga un trabajo</option>
            </select>
          </label>
        )}
        <label className="field">
          <span>Descripción</span>
          <textarea value={f.description || ''} onChange={(e) => set({ description: e.target.value })} />
        </label>
        {isJob && (
          <label className="field">
            <span>Requisitos</span>
            <input value={f.requirements} onChange={(e) => set({ requirements: e.target.value })} />
          </label>
        )}
        <div className="two">
          <label className="field">
            <span>Estado</span>
            <select value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="active">Activo</option>
              <option value="paused">Pausado</option>
              {isJob && <option value="filled">Cubierto</option>}
            </select>
          </label>
          <label className="field">
            <span>Vence el</span>
            <input type="date" value={f.expires} onChange={(e) => set({ expires: e.target.value })} />
          </label>
        </div>
        <div className="two">
          <label className="field">
            <span>WhatsApp</span>
            <input value={f.phone || ''} onChange={(e) => set({ phone: e.target.value })} />
          </label>
          <label className="check admin-check">
            <input type="checkbox" checked={!!f.is_urgent} onChange={(e) => set({ is_urgent: e.target.checked })} />
            Urgente
          </label>
        </div>
        <button className="btn btn-ink btn-lg btn-block" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}

// ---------- avisos y servicios ----------
function ListingsTab({ kind, notify }) {
  const isJob = kind === 'job';
  const table = isJob ? 'jobs' : 'services';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from(table).select('*').order('created_at', { ascending: false }).limit(500);
    if (err) setError(friendlyError(err.message));
    setItems(data || []);
    setLoading(false);
  }, [table]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((i) => {
      const text = !t || [i.title, i.company_name, i.provider_name, i.description, i.location, i.city].some((v) => (v || '').toLowerCase().includes(t));
      return text && (!state || stateOf(i) === state);
    });
  }, [items, search, state]);

  const setStatus = async (item, status) => {
    const { error: err } = await supabase.rpc('admin_update_listing', { p_kind: kind, p_id: item.id, p: { status } });
    if (err) setError(friendlyError(err.message));
    else {
      notify(status === 'active' ? 'Publicación activada' : 'Publicación pausada');
      load();
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`¿Eliminar "${item.title}"? No se puede deshacer.`)) return;
    const { error: err } = await supabase.rpc('admin_delete_listing', { p_kind: kind, p_id: item.id });
    if (err) setError(friendlyError(err.message));
    else {
      notify('Publicación eliminada');
      load();
    }
  };

  return (
    <>
      {error && <p className="note err">{error}</p>}
      <div className="admin-tools">
        <label className="search">
          <span className="sr">Buscar</span>
          <input type="search" placeholder="Buscá por título, nombre o localidad" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search size={22} aria-hidden="true" />
        </label>
        <select className="fbtn" value={state} onChange={(e) => setState(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(LISTING_STATUS)
            .filter(([id]) => isJob || id !== 'filled')
            .map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
        </select>
      </div>
      <p className="count">
        {filtered.length} de {items.length}
      </p>
      {loading ? (
        <p className="count">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Empty title="No hay publicaciones" text="Probá con otra búsqueda o sacá el filtro." />
      ) : (
        <div className="admin-table" role="table">
          <div className="admin-row list head" role="row">
            <span role="columnheader">Publicación</span>
            <span role="columnheader">Localidad</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader">Vence</span>
            <span role="columnheader">Acciones</span>
          </div>
          {filtered.map((i) => {
            const st = stateOf(i);
            return (
              <div className="admin-row list" role="row" key={i.id}>
                <span role="cell">
                  <b>
                    {!isJob && <span className={`kind-s ${i.intent === 'busca' ? 'busca' : ''}`}>{i.intent === 'busca' ? 'Busca' : 'Ofrece'}</span>}
                    {i.title}
                  </b>
                  <small>
                    {(isJob ? i.company_name : i.provider_name) || '—'} · {i.category}
                    {i.is_urgent ? ' · Urgente' : ''}
                  </small>
                </span>
                <span role="cell">{(isJob ? i.location : i.city) || '—'}</span>
                <span role="cell">
                  <span className={`pill ${st}`}>{LISTING_STATUS[st]}</span>
                </span>
                <span role="cell">{fmt(i.expires_at)}</span>
                <span role="cell" className="admin-acts">
                  <button className="icon-sq" onClick={() => setEditing(i)} aria-label="Editar" title="Editar">
                    <Pencil size={16} />
                  </button>
                  {i.status === 'active' ? (
                    <button className="icon-sq" onClick={() => setStatus(i, 'paused')} aria-label="Pausar" title="Pausar">
                      <Pause size={16} />
                    </button>
                  ) : (
                    <button className="icon-sq" onClick={() => setStatus(i, 'active')} aria-label="Activar" title="Activar">
                      <Play size={16} />
                    </button>
                  )}
                  <button className="icon-sq danger" onClick={() => remove(i)} aria-label="Eliminar" title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <EditListing
          kind={kind}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify('Cambios guardados');
            load();
          }}
        />
      )}
    </>
  );
}

// ---------- CVs ----------
function ResumesTab({ notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from('resumes').select('*').order('updated_at', { ascending: false }).limit(500);
    if (err) setError(friendlyError(err.message));
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((r) => !t || [r.full_name, r.profession, r.city].some((v) => (v || '').toLowerCase().includes(t)));
  }, [items, search]);

  const remove = async (r) => {
    if (!window.confirm(`¿Eliminar el CV de ${r.full_name}? No se puede deshacer.`)) return;
    const { error: err } = await supabase.rpc('admin_delete_resume', { p_user: r.user_id });
    if (err) setError(friendlyError(err.message));
    else {
      notify('CV eliminado');
      load();
    }
  };

  return (
    <>
      {error && <p className="note err">{error}</p>}
      <div className="admin-tools">
        <label className="search">
          <span className="sr">Buscar CVs</span>
          <input type="search" placeholder="Buscá por nombre, oficio o localidad" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search size={22} aria-hidden="true" />
        </label>
      </div>
      <p className="count">
        {filtered.length} de {items.length}
      </p>
      {loading ? (
        <p className="count">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Empty title="No hay CVs" text="Cuando alguien guarde su CV, va a aparecer acá." />
      ) : (
        <div className="admin-table" role="table">
          {filtered.map((r) => (
            <div className="admin-row list cvs" role="row" key={r.user_id}>
              <span role="cell">
                <b>{r.full_name}</b>
                <small>{r.profession}</small>
              </span>
              <span role="cell">{r.city || '—'}</span>
              <span role="cell">Actualizado {fmt(r.updated_at)}</span>
              <span role="cell" className="admin-acts">
                <button className="icon-sq" onClick={() => setOpen(r)} aria-label="Ver CV" title="Ver CV">
                  <FileText size={16} />
                </button>
                <button className="icon-sq danger" onClick={() => remove(r)} aria-label="Eliminar CV" title="Eliminar CV">
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      {open && <CvModal resume={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// ---------- usuarios ----------
function UsersTab({ notify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [busy, setBusy] = useState('');

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

  const pending = users.filter((u) => u.verification_requested && !u.is_verified).length;

  return (
    <>
      {error && <p className="note err">{error}</p>}
      <div className="admin-tools">
        <label className="search">
          <span className="sr">Buscar usuarios</span>
          <input type="search" placeholder="Buscá por nombre, email o localidad" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search size={22} aria-hidden="true" />
        </label>
        <select className="fbtn" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar usuarios">
          <option value="todos">Todos</option>
          <option value="comercios">Comercios</option>
          <option value="pendientes">Verificación pendiente{pending ? ` (${pending})` : ''}</option>
          <option value="bloqueados">Bloqueados</option>
        </select>
      </div>
      <p className="count">
        {filtered.length} de {users.length}
      </p>
      {loading ? (
        <p className="count">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Empty title="No hay usuarios" text="Probá con otra búsqueda o sacá el filtro." />
      ) : (
        <div className="admin-table users" role="table">
          <div className="admin-row user head" role="row">
            <span role="columnheader">Persona</span>
            <span role="columnheader">Rol</span>
            <span role="columnheader">Actividad</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader">Acciones</span>
          </div>
          {filtered.map((u) => (
            <div className={`admin-row user${u.is_blocked ? ' blocked' : ''}`} role="row" key={u.id}>
              <span role="cell">
                <b>{u.full_name || 'Sin nombre'}</b>
                <small>{u.email}</small>
              </span>
              <span role="cell">
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
              </span>
              <span role="cell">
                <small>
                  {u.listings} publicaciones · {u.applications} postulaciones
                </small>
              </span>
              <span role="cell">
                <span className="user-flags">
                  {u.is_admin && <span className="pill active">Admin</span>}
                  {u.is_blocked && <span className="pill expired">Bloqueado</span>}
                  {u.is_verified && <span className="pill verified">Verificado</span>}
                  {!u.is_blocked && !u.is_verified && u.verification_requested && <span className="pill paused">Pide verificación</span>}
                </span>
              </span>
              <span role="cell" className="admin-acts">
                {u.role === 'company' && (
                  <button
                    className="btn btn-line btn-xs"
                    disabled={busy === u.id}
                    onClick={() => setUser(u, { is_verified: !u.is_verified }, u.is_verified ? 'Verificación quitada' : 'Comercio verificado')}
                    title={u.is_verified ? 'Quitar verificación' : 'Verificar comercio'}
                  >
                    {u.is_verified ? 'Quitar verificación' : 'Verificar'}
                  </button>
                )}
                <button
                  className="btn btn-line btn-xs"
                  disabled={busy === u.id}
                  onClick={() => setUser(u, { is_admin: !u.is_admin }, u.is_admin ? 'Ya no es administrador' : 'Ahora es administrador')}
                  title={u.is_admin ? 'Quitar administrador' : 'Hacer administrador'}
                >
                  {u.is_admin ? 'Quitar admin' : 'Hacer admin'}
                </button>
                <button
                  className={`btn btn-xs ${u.is_blocked ? 'btn-line' : 'btn-danger'}`}
                  disabled={busy === u.id}
                  onClick={() => setUser(u, { is_blocked: !u.is_blocked }, u.is_blocked ? 'Cuenta desbloqueada' : 'Cuenta bloqueada')}
                >
                  {u.is_blocked ? 'Desbloquear' : 'Bloquear'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- pagos ----------
function PaymentsTab() {
  const [purchases, setPurchases] = useState(null);
  useEffect(() => {
    supabase
      .from('cv_purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setPurchases(data || []));
  }, []);
  if (!purchases) return <p className="count">Cargando…</p>;
  const approved = purchases.filter((p) => p.status === 'approved');
  const total = approved.reduce((acc, p) => acc + Number(p.amount), 0);
  return (
    <>
      <p className="count">
        {approved.length} aprobados · {money(total)} cobrados (de los últimos {purchases.length})
      </p>
      {purchases.length === 0 ? (
        <Empty title="Todavía no hay pagos" text="Cuando alguien pague la descarga de su CV, va a aparecer acá." />
      ) : (
        <div className="admin-table" role="table" aria-label="Últimos pagos">
          <div className="admin-row head" role="row">
            <span role="columnheader">Fecha</span>
            <span role="columnheader">Monto</span>
            <span role="columnheader">Modalidad</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader">Usuario</span>
          </div>
          {purchases.map((p) => (
            <div className="admin-row" role="row" key={p.id}>
              <span role="cell">{new Date(p.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span role="cell">{money(p.amount)}</span>
              <span role="cell">
                {MODES[p.mode]}
                {p.mode === 'por_dias' && p.days ? ` (${p.days})` : ''}
              </span>
              <span role="cell">
                <span className={`pill ${p.status === 'approved' ? 'active' : p.status === 'pending' ? 'paused' : 'expired'}`}>{STATUS[p.status]}</span>
              </span>
              <span role="cell" className="mono">
                {p.user_id.slice(0, 8)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Panel del administrador: control de la configuración y de todo el contenido de la app
function ReportsTab({ notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('reports')
      .select('id, type, job_id, message, status, created_at, jobs(title)')
      .order('created_at', { ascending: false });
    if (err) setError(friendlyError(err.message));
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const setStatus = async (id, status) => {
    const { error: err } = await supabase.from('reports').update({ status }).eq('id', id);
    if (err) notify(friendlyError(err.message));
    else {
      notify('Estado actualizado');
      load();
    }
  };
  if (loading) return <p className="count">Cargando…</p>;
  if (error) return <p className="note err">{error}</p>;
  if (rows.length === 0) return <p className="count">Todavía no hay sugerencias ni denuncias.</p>;
  return (
    <div className="admin-card">
      {rows.map((r) => (
        <div key={r.id} className="admin-row" style={{ gridTemplateColumns: '1fr' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="pill">{r.type === 'denuncia' ? 'Denuncia' : 'Sugerencia'}</span>
              <span className="pill">{r.status}</span>
              <small className="cv-hint">{new Date(r.created_at).toLocaleString('es-AR')}</small>
            </div>
            {r.jobs?.title && <p style={{ margin: '6px 0 4px' }}><b>{r.jobs.title}</b></p>}
            <p style={{ margin: '4px 0 8px', whiteSpace: 'pre-wrap' }}>{r.message}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {r.status !== 'enviada' && <button type="button" className="btn btn-line btn-xs" onClick={() => setStatus(r.id, 'enviada')}>Marcar enviada</button>}
              {r.status !== 'cerrada' && <button type="button" className="btn btn-ink btn-xs" onClick={() => setStatus(r.id, 'cerrada')}>Cerrar</button>}
              {r.status !== 'nueva' && <button type="button" className="btn btn-line btn-xs" onClick={() => setStatus(r.id, 'nueva')}>Reabrir</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Admin({ notify, onSettingsSaved }) {
  const [tab, setTab] = useState('config');
  return (
    <section className="wrap page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Administración</h1>
          <p className="lede">Configurá duraciones y precios, y revisá, editá o eliminá cualquier publicación o CV de la app.</p>
        </div>
      </header>
      <div className="admin-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'config' && <SettingsTab notify={notify} onSaved={onSettingsSaved} />}
      {tab === 'jobs' && <ListingsTab key="jobs" kind="job" notify={notify} />}
      {tab === 'services' && <ListingsTab key="services" kind="service" notify={notify} />}
      {tab === 'cvs' && <ResumesTab notify={notify} />}
      {tab === 'users' && <UsersTab notify={notify} />}
      {tab === 'pagos' && <PaymentsTab />}
      {tab === 'recibidos' && <ReportsTab notify={notify} />}
    </section>
  );
}
