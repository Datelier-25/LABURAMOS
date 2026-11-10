import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, FileText, Pause, Pencil, Play, Search, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PAY_MODES as MODES, friendlyError, money } from '../lib/utils';
import { Empty } from './ui';
import { CvModal } from './Candidates';
import UsersPanel from './UsersPanel';
import EditListing from './EditListing';
import { isPremium } from '../lib/premium';

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
        setCfg({
          cv_paid_enabled: false,
          cv_price: 3000,
          cv_mode: 'por_dias',
          cv_days: 30,
          job_days: 30,
          service_days: 30,
          contact_email: 'laburamosapp@gmail.com',
          premium_enabled: false,
          premium_price: 3000,
          premium_days: 30,
          premium_include_links: true,
          premium_include_photos: true,
          free_links_limit: 1,
          premium_links_limit: 3,
          free_photos_limit: 5,
          premium_photos_limit: 10,
          ...data,
        });
      });
  }, []);

  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const num = (v) => Number(String(v).replace(',', '.'));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const price = num(cfg.cv_price);
    const premiumPrice = num(cfg.premium_price);
    const days = [num(cfg.cv_days), num(cfg.job_days), num(cfg.service_days), num(cfg.premium_days)];
    const limits = [num(cfg.free_links_limit), num(cfg.premium_links_limit), num(cfg.free_photos_limit), num(cfg.premium_photos_limit)];
    if (!(price > 0) || price > 1000000) return setError('Poné un precio mayor a $0.');
    if (!(premiumPrice >= 0) || premiumPrice > 1000000) return setError('El precio del premium tiene que ser $0 o más.');
    if (days.some((d) => !(d >= 1 && d <= 365))) return setError('Los días tienen que estar entre 1 y 365.');
    if (limits.some((n) => !(n >= 0 && n <= 20))) return setError('Los límites de links y fotos tienen que estar entre 0 y 20.');
    if (limits[1] < limits[0]) return setError('El premium no puede permitir menos links que el plan gratis.');
    if (limits[3] < limits[2]) return setError('El premium no puede permitir menos fotos que el plan gratis.');
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
        premium_enabled: cfg.premium_enabled,
        premium_price: premiumPrice,
        premium_days: days[3],
        premium_include_links: cfg.premium_include_links,
        premium_include_photos: cfg.premium_include_photos,
        free_links_limit: limits[0],
        premium_links_limit: limits[1],
        free_photos_limit: limits[2],
        premium_photos_limit: limits[3],
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

      <h2 className="block-title">Premium por publicación</h2>
      <p className="lede">
        Permite sumar links y más fotos a un aviso. Por ahora se activa a mano desde “Avisos de empleo” o “Servicios”; el cobro con Mercado Pago queda para la próxima etapa.
      </p>
      <label className="switch">
        <input className="sr" type="checkbox" checked={cfg.premium_enabled} onChange={(e) => set({ premium_enabled: e.target.checked })} />
        <span className="sw" aria-hidden="true" />
        <span>
          <b>Ofrecer premium</b>
          <small>{cfg.premium_enabled ? 'El panel muestra la opción de activar premium en cada publicación.' : 'El premium está desactivado. Las publicaciones usan los límites gratis.'}</small>
        </span>
      </label>
      <div className="two">
        <label className="field">
          <span>Precio del premium (en pesos)</span>
          <input inputMode="decimal" value={cfg.premium_price} onChange={(e) => set({ premium_price: e.target.value.replace(/[^\d.,]/g, '') })} />
        </label>
        <label className="field">
          <span>Duración del premium (días)</span>
          <input inputMode="numeric" value={cfg.premium_days} onChange={(e) => set({ premium_days: e.target.value.replace(/\D/g, '') })} />
        </label>
      </div>

      <div className="premium-config">
        <label className="switch">
          <input className="sr" type="checkbox" checked={cfg.premium_include_links} onChange={(e) => set({ premium_include_links: e.target.checked })} />
          <span className="sw" aria-hidden="true" />
          <span>
            <b>Incluir links en el premium</b>
            <small>{cfg.premium_include_links ? 'Los links extra se desbloquean con el premium.' : 'Los links quedan disponibles para todos con el límite más alto.'}</small>
          </span>
        </label>
        <div className="two">
          <label className="field">
            <span>Links sin premium</span>
            <input inputMode="numeric" value={cfg.free_links_limit} onChange={(e) => set({ free_links_limit: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="field">
            <span>Links con premium</span>
            <input inputMode="numeric" value={cfg.premium_links_limit} onChange={(e) => set({ premium_links_limit: e.target.value.replace(/\D/g, '') })} />
          </label>
        </div>

        <label className="switch">
          <input className="sr" type="checkbox" checked={cfg.premium_include_photos} onChange={(e) => set({ premium_include_photos: e.target.checked })} />
          <span className="sw" aria-hidden="true" />
          <span>
            <b>Incluir fotos extra en el premium</b>
            <small>{cfg.premium_include_photos ? 'Las fotos extra se desbloquean con el premium.' : 'Las fotos quedan disponibles para todos con el límite más alto.'}</small>
          </span>
        </label>
        <div className="two">
          <label className="field">
            <span>Fotos sin premium</span>
            <input inputMode="numeric" value={cfg.free_photos_limit} onChange={(e) => set({ free_photos_limit: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="field">
            <span>Fotos con premium</span>
            <input inputMode="numeric" value={cfg.premium_photos_limit} onChange={(e) => set({ premium_photos_limit: e.target.value.replace(/\D/g, '') })} />
          </label>
        </div>
      </div>

      <button className="btn btn-ink btn-lg" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar configuración'}
      </button>
    </form>
  );
}

// ---------- avisos y servicios ----------
function ListingsTab({ kind, notify, settings }) {
  const isJob = kind === 'job';
  const table = isJob ? 'jobs' : 'services';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [editing, setEditing] = useState(null);
  const [premiumBusy, setPremiumBusy] = useState(null);

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

  const togglePremium = async (item) => {
    const enable = !isPremium(item);
    if (enable && !settings?.premium_enabled && !window.confirm('El premium está desactivado en Configuración. ¿Querés activarlo igual para esta publicación?')) return;
    setPremiumBusy(item.id);
    const { data, error: err } = await supabase.rpc('admin_set_listing_premium', { p_kind: kind, p_id: item.id, p_enabled: enable });
    setPremiumBusy(null);
    if (err) setError(friendlyError(err.message));
    else {
      notify(enable ? `Premium activo hasta el ${fmt(data)}` : 'Premium quitado');
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
                  </small>
                </span>
                <span role="cell">{(isJob ? i.location : i.city) || '—'}</span>
                <span role="cell">
                  <span className={`pill ${st}`}>{LISTING_STATUS[st]}</span>
                  {isPremium(i) && (
                    <span className="pill premium" title={`Premium hasta el ${fmt(i.premium_until)}`}>
                      <Crown size={11} aria-hidden="true" /> Premium
                    </span>
                  )}
                </span>
                <span role="cell">{fmt(i.expires_at)}</span>
                <span role="cell" className="admin-acts">
                  <button className="icon-sq" onClick={() => setEditing(i)} aria-label="Editar" title="Editar">
                    <Pencil size={16} />
                  </button>
                  <button
                    className={`icon-sq${isPremium(i) ? ' premium' : ''}`}
                    onClick={() => togglePremium(i)}
                    disabled={premiumBusy === i.id}
                    aria-label={isPremium(i) ? 'Quitar premium' : 'Activar premium'}
                    title={isPremium(i) ? `Quitar premium (vence el ${fmt(i.premium_until)})` : 'Activar premium'}
                  >
                    <Crown size={16} />
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

export default function Admin({ notify, onSettingsSaved, currentUser, settings }) {
  const [tab, setTab] = useState('users');
  return (
    <section className="wrap page admin-page">
      <header className={tab === 'users' ? 'sr' : 'page-head admin-page-head'}>
        <div>
          <h1 className="page-title">Administración</h1>
          <p className="lede">Configurá duraciones y precios, y revisá, editá o eliminá cualquier publicación o CV de la app.</p>
        </div>
      </header>
      <nav className="admin-tabs" aria-label="Secciones de Administración">
        {TABS.map((t) => (
          <button type="button" key={t.id} aria-pressed={tab === t.id} aria-controls="admin-tab-content" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div id="admin-tab-content">
      {tab === 'config' && <SettingsTab notify={notify} onSaved={onSettingsSaved} />}
      {tab === 'jobs' && <ListingsTab key="jobs" kind="job" notify={notify} settings={settings} />}
      {tab === 'services' && <ListingsTab key="services" kind="service" notify={notify} settings={settings} />}
      {tab === 'cvs' && <ResumesTab notify={notify} />}
      {tab === 'users' && <UsersPanel notify={notify} currentUser={currentUser} />}
      {tab === 'pagos' && <PaymentsTab />}
      {tab === 'recibidos' && <ReportsTab notify={notify} />}
      </div>
    </section>
  );
}
