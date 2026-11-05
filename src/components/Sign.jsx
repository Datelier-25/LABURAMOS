import { useState } from 'react';
import { AlertTriangle, Bookmark, CircleDollarSign, MapPin, Share2, Store, User } from 'lucide-react';
import { emojiOf, intentOf, shareListing, timeAgo, toneOf, waLink } from '../lib/utils';
import { plateEmote } from '../lib/emotes';
import { MAX_SERVICE_PHOTOS, servicePhotoUrl } from '../lib/photos';
import { nameWithPrefix } from '../lib/prefixes';
import { Reputation } from './Reputation';
import { useUser } from '../lib/auth';

// Fotos del aviso (hasta 3). En la vista previa no son enlaces.
function ServicePhotos({ service, preview }) {
  const photos = (service.photos || []).filter(Boolean).slice(0, MAX_SERVICE_PHOTOS);
  if (!photos.length) return null;
  return (
    <div className={`scard-photos n${photos.length}`}>
      {photos.map((p, i) =>
        preview ? (
          <span key={p}>
            <img src={servicePhotoUrl(p)} alt="" />
          </span>
        ) : (
          <a key={p} href={servicePhotoUrl(p)} target="_blank" rel="noreferrer" aria-label={`Foto ${i + 1} de ${service.title}`}>
            <img src={servicePhotoUrl(p)} alt="" loading="lazy" />
          </a>
        )
      )}
    </div>
  );
}

// Fila de tres acciones (Guardar / Compartir / Denunciar) del nuevo diseño de tarjeta.
function CardActs({ saved, onSave, onShare, onReport, dead }) {
  const [shareHint, setShareHint] = useState('');
  const share = async () => {
    if (!onShare) return;
    const result = await onShare();
    if (result === 'copied') {
      setShareHint('¡Copiado!');
      window.setTimeout(() => setShareHint(''), 2500);
    }
  };
  return (
    <div className="card-acts">
      <button type="button" disabled={dead} className={saved ? 'on' : ''} onClick={onSave} aria-label={saved ? 'Quitar de guardados' : 'Guardar aviso'} aria-pressed={saved}>
        <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /> {saved ? 'Guardado' : 'Guardar'}
      </button>
      <button type="button" disabled={dead || !onShare} onClick={share} aria-label="Compartir aviso con otra persona">
        <Share2 size={16} aria-hidden="true" /> {shareHint || 'Compartir'}
      </button>
      {onReport && (
        <button type="button" disabled={dead} onClick={onReport} aria-label="Denunciar aviso">
          <AlertTriangle size={16} aria-hidden="true" /> Denunciar
        </button>
      )}
    </div>
  );
}

// Cartel de empleo. Es el mismo en las listas, en la vista previa y en los carteles de ejemplo.
export default function JobSign({ job, user, saved = false, onSave, onLogin, onApply, applied = false, compact = false, preview = false, wide = false, style, onReport }) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const interactive = !compact && !preview;
  const long = (job.description || '').length > 130 || !!job.requirements;
  const message = `Hola, vi tu aviso de "${job.title}" en LaburamosApp y me interesa.${user ? ` Soy ${user.name}.` : ''}${user?.role === 'worker' ? ' Mi CV lo ves en LaburamosApp, en Postulantes.' : ''}`;
  const { user: currentUser, isAdmin } = useUser();
  const isOwner = currentUser?.id === job.company_id;
  const canEdit = isAdmin || isOwner;
  const [editOpen, setEditOpen] = useState(false);

  return (
    <article
      className={`sign ${toneOf(job.category)}${open ? ' open' : ''}${wide ? ' wide' : ''}${compact ? ' compact' : ''}`}
      id={`job-${job.id}`}
      style={style}
    >
      <div className="card-body">
        {!compact && (
          <div className="plate" aria-hidden="true">
            {emote ? <img src={emote} alt="" loading="lazy" /> : <span className="plate-emoji">{emojiOf(job.category)}</span>}
          </div>
        )}
        <div className="card-info">
          <div className="card-badges">
            <span className="pill pill-job">Laburo</span>
          </div>
          <h3>{job.title}</h3>
          <p className="who-row">
            <span className="who">
              <Store size={18} aria-hidden="true" />
              <span className="who-name">{job.company_name}</span>
            </span>
            {job.location && (
              <span className="where">
                <MapPin size={18} aria-hidden="true" />
                <span>{job.location}</span>
              </span>
            )}
          </p>
          {canEdit && (
            <p className="edit-row">
              <button className="edit-btn" onClick={() => setEditOpen(true)}>
                ✎ Editar
              </button>
            </p>
          )}
        </div>

        {(payLabel || conds) && (
          <p className="meta-row pay card-pay">
            <span className="coin">
              <CircleDollarSign size={13} aria-hidden="true" />
            </span>
            {payLabel && <b>{payLabel}</b>}
            {conds && <span>{conds}</span>}
          </p>
        )}
        <div className="card-extra">
          {!compact && job.description && <p className="desc">{job.description}</p>}
          {open && job.requirements && (
            <p className="desc">
              <strong>Requisitos:</strong> {job.requirements}
            </p>
          )}
          {interactive && long && (
            <button type="button" className="more" onClick={() => setOpen(!open)} aria-expanded={open}>
              {open ? 'Ver menos' : 'Ver más'}
            </button>
          )}
        </div>
      </div>

      <div className="plate-bottom">
        {job.reputation ? <Reputation data={job.reputation} showStatus /> : <span className="rep-empty">Sin valoraciones</span>}
      </div>

      {(interactive || preview) && (
        <>
          <CardActs
            saved={saved}
            onSave={onSave ? () => onSave(job.id) : undefined}
            onShare={preview ? undefined : share}
            onReport={preview ? undefined : canReport ? () => onReport({ kind: 'job', job }) : undefined}
            dead={preview}
          />
          {!preview &&
            (user ? (
              applied ? (
                <button type="button" className="card-cta" disabled>
                  Ya postulaste
                </button>
              ) : (
                <button type="button" className="card-cta" onClick={apply} disabled={applying}>
                  {applying ? 'Enviando…' : 'Postularme'}
                </button>
              )
            ) : (
              <button type="button" className="card-cta" onClick={onLogin}>
                Ingresá para postularte
              </button>
            ))}
          {preview && <span className="card-cta as-text">Postularme</span>}
        </>
      )

      {job.created_at && !compact && !preview && <span className="when">Publicado {timeAgo(job.created_at)}</span>}
    </article>
  );
}

function EditJobModal({ onClose, onSave, job }) {
  const { error, setError } = useState('');
  const { user } = useUser();
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const [f, setF] = useState({
    title: job.title,
    company_name: job.company_name,
    category: job.category,
    job_type: job.job_type,
    description: job.description || '',
    phone: job.phone || '',
    status: job.status,
    expires: job.expires_at ? job.expires_at.slice(0, 10) : '',
    requirements: job.requirements || '',
  });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const p = {
      title: f.title,
      company_name: f.company_name,
      category: f.category,
      job_type: f.job_type,
      description: f.description,
      phone: f.phone,
      status: f.status,
      ...(f.expires ? { expires_at: new Date(`${f.expires}T23:59:59`).toISOString() } : {}),
    };
    const { error: err } = await supabase.rpc('admin_update_listing', { p_kind: 'job', p_id: job.id, p: JSON.parse(JSON.stringify(p)) });
    setSaving(false);
    if (err) setError(friendlyError(err.message));
    else onClose(), onSave();
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Editar aviso">
        <button type="button" className="x" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
        <h2>Editar aviso</h2>
        {error && <p className="note err">{error}</p>}
        <form onSubmit={save}>
          <label className="field">
            <span>Título</span>
            <input required value={f.title} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label className="field">
            <span>Comercio o empresa</span>
            <input required value={f.company_name} onChange={(e) => set({ company_name: e.target.value })} />
          </label>
          <label className="field">
            <span>Rubro</span>
            <select value={f.category} onChange={(e) => set({ category: e.target.value })}>
              {JOB_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Modalidad</span>
            <select value={f.job_type} onChange={(e) => set({ job_type: e.target.value })}>
              {JOB_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Descripción</span>
            <textarea value={f.description} onChange={(e) => set({ description: e.target.value })} />
          </label>
          <label className="field">
            <span>Requisitos (opcional)</span>
            <input value={f.requirements} onChange={(e) => set({ requirements: e.target.value })} />
          </label>
          <label className="field">
            <span>Vence el</span>
            <input type="date" value={f.expires} onChange={(e) => set({ expires: e.target.value })} />
          </label>
          <label className="field">
            <span>WhatsApp</span>
            <input value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
          </label>
          <button className="btn btn-ink btn-lg btn-block" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Tarjeta de servicio. "ofrece": la vidriera de un oficio o negocio. "busca": un pedido de trabajo.
export function ServiceCard({ service, user, onLogin, preview = false, onReport, saved = false, onSave }) {
  const intent = intentOf(service);
  const isAsk = intent === 'busca';
  const interactive = !preview;
  const canReport = !preview && !!onReport && user?.id !== service.owner_id;
  const deepUrl = `${window.location.origin}${window.location.pathname}#/aviso/svc/${service.id}`;
  const emoji = isAsk ? '🔎' : emojiOf(service.category);
  const emote = plateEmote(service);
  const photosList = (service.photos || []).filter(Boolean);
  const share = () =>
    shareListing({
      title: `${service.title} · LaburamosApp`,
      text: `Mirá ${isAsk ? 'este pedido de oficio' : 'este servicio'} en LaburamosApp: "${service.title}"${service.provider_name ? ` — ${service.provider_name}` : ''}${service.city ? ` (${service.city})` : ''}.`,
      url: deepUrl,
    });
  const message = isAsk
    ? `Hola, vi tu pedido "${service.title}" en LaburamosApp y te puedo ayudar.`
    : `Hola, vi tu servicio de "${service.title}" en LaburamosApp y quería consultarte.`;
  const ctaLabel = isAsk ? 'Me interesa' : 'Contactar';

  let cta;
  if (preview) cta = <span className="card-cta as-text">{ctaLabel}</span>;
  else if (user)
    cta = (
      <a className="card-cta" href={waLink(service.phone, message)} target="_blank" rel="noreferrer">
        {ctaLabel}
      </a>
    );
  else
    cta = (
      <button type="button" className="card-cta" onClick={onLogin}>
        Ingresá para {isAsk ? 'responder' : 'escribir'}
      </button>
    );

  return (
    <article id={`svc-${service.id}`} className={`scard ${intent} ${toneOf(service.category)}`}>
      <div className="card-body">
        <div className={`plate${photosList[0] ? ' photo' : ''}`} aria-hidden="true">
          {photosList[0] ? (
            <img src={servicePhotoUrl(photosList[0])} alt="" loading="lazy" />
          ) : emote ? (
            <img src={emote} alt="" loading="lazy" />
          ) : (
            <span className="plate-emoji">{emoji}</span>
          )}
        </div>
        <div className="card-info">
          <div className="card-badges">
            <span className={`pill pill-${intent}`}>{isAsk ? 'Estoy buscando a alguien' : 'Ofrezco mi servicio'}</span>
          </div>
          <h3>{service.title}</h3>
          <p className="who-row">
            <span className="who">
              {isAsk ? <Store size={18} aria-hidden="true" /> : <User size={18} aria-hidden="true" />}
              <span className="who-name">{nameWithPrefix(service.provider_name, service.provider_prefix)}</span>
            </span>
            {service.city && (
              <span className="where">
                <MapPin size={18} aria-hidden="true" />
                <span>{service.city}</span>
              </span>
            )}
          </p>
        </div>
        {service.price && (
          <p className="meta-row pay card-pay">
            <span className="coin">
              <CircleDollarSign size={13} aria-hidden="true" />
            </span>
            <b>{service.price}</b>
            <span>{isAsk ? 'presupuesto' : 'precio'}</span>
          </p>
        )}
        <div className="card-extra">
          {service.description && <p className="desc">{service.description}</p>}
        </div>
      </div>
      <div className="plate-bottom">
        {service.reputation ? <Reputation data={service.reputation} showStatus /> : <span className="rep-empty">Sin valoraciones</span>}
      </div>
      <ServicePhotos service={service} preview={preview} />
      {(interactive || preview) && (
        <>
          <CardActs
            saved={saved}
            onSave={onSave ? () => onSave(service.id) : undefined}
            onShare={preview ? undefined : share}
            onReport={canReport ? () => onReport({ kind: 'service', service }) : undefined}
            dead={preview}
          />
          {cta}
        </>
      )}
      {service.created_at && !preview && <span className="when">{timeAgo(service.created_at)}</span>}
    </article>
  );
}