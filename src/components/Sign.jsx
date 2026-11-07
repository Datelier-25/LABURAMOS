import { useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  CircleDollarSign,
  Clock3,
  MapPin,
  Share2,
  Store,
  User,
} from 'lucide-react';
import { emojiOf, intentOf, shareListing, timeAgo, toneOf, waLink } from '../lib/utils';
import { plateEmote } from '../lib/emotes';
import { MAX_SERVICE_PHOTOS, servicePhotoUrl } from '../lib/photos';
import { nameWithPrefix } from '../lib/prefixes';
import { Reputation } from './Reputation';
import EditListing from './EditListing';

// Fotos del aviso (hasta 5). En la vista previa no son enlaces.
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

// Fila de tres acciones (Guardar / Compartir / Denunciar) de la tarjeta.
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

function editButton(onClick) {
  return (
    <div className="edit-row">
      <button type="button" className="edit-btn" onClick={onClick}>
        ✎ Editar
      </button>
    </div>
  );
}

// Cartel de empleo. Es el mismo en las listas, en la vista previa y en los carteles de ejemplo.
export default function JobSign({
  job,
  user,
  saved = false,
  onSave,
  onLogin,
  onApply,
  applied = false,
  compact = false,
  preview = false,
  wide = false,
  style,
  onReport,
  onChanged,
}) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const interactive = !compact && !preview;
  const long = (job.description || '').length > 130 || !!job.requirements;
  const canEdit = !!user && (user.isAdmin || user.id === job.company_id);
  const message = `Hola, vi tu aviso de "${job.title}" en LaburamosApp y me interesa.${user ? ` Soy ${user.name}.` : ''}${user?.role === 'worker' ? ' Mi CV lo ves en LaburamosApp, en Postulantes.' : ''}`;
  const emote = plateEmote(job);
  const salaryText = String(job.salary || '').trim();
  const payLabel = !salaryText
    ? null
    : salaryText.toLowerCase() === 'a convenir'
      ? 'A convenir'
      : salaryText.startsWith('$')
        ? salaryText
        : /^\d+$/.test(salaryText)
          ? `$${Number(salaryText).toLocaleString('es-AR')}`
          : `$${salaryText}`;
  const jobTypeLabel = {
    'Full-time': 'Jornada completa',
    'Part-time': 'Media jornada',
    'Por horas': 'Por horas',
    Temporal: 'Temporal',
    Changa: 'Por trabajo',
  }[job.job_type] || job.job_type;
  const conditions = [job.schedule, job.duration, jobTypeLabel]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
  const canReport = !preview && !!onReport && user?.id !== job.company_id;
  const deepUrl = `${window.location.origin}${window.location.pathname}#/aviso/job/${job.id}`;
  const share = () =>
    shareListing({
      title: `${job.title} · LaburamosApp`,
      text: `Mirá este aviso en LaburamosApp: "${job.title}"${job.company_name ? ` — ${job.company_name}` : ''}${job.location ? ` (${job.location})` : ''}.`,
      url: deepUrl,
    });
  const apply = async () => {
    if (!onApply || applying) return;
    setApplying(true);
    try {
      await onApply(job, waLink(job.phone, message));
    } finally {
      setApplying(false);
    }
  };

  return (
    <article
      className={`sign ${toneOf(job.category)}${open ? ' open' : ''}${wide ? ' wide' : ''}${compact ? ' compact' : ''}`}
      id={`job-${job.id}`}
      style={style}
    >
      <div className="card-body">
        {!compact && (
          <div className="plate" aria-hidden="true">
            {emote ? (
              <img src={emote} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
            ) : (
              <span className="plate-emoji">{emojiOf(job.category)}</span>
            )}
          </div>
        )}
        <div className="card-info">
          <div className="card-top">
            <div className="card-badges">
              <span className="pill pill-job">Laburo</span>
            </div>
            {job.location && (
              <span className="where" title={job.location}>
                <MapPin size={18} aria-hidden="true" />
                <span>{job.location}</span>
              </span>
            )}
          </div>
          <h3>{job.title}</h3>
          <p className="who-row">
            <span className="who">
              <Store size={18} aria-hidden="true" />
              <span className="who-name">{job.company_name}</span>
            </span>
          </p>
          {(payLabel || conditions.length > 0) && (
            <p className="meta-row pay card-pay">
              {payLabel ? (
                <span className="coin"><CircleDollarSign size={13} aria-hidden="true" /></span>
              ) : (
                <Clock3 size={16} aria-hidden="true" />
              )}
              {payLabel && <b>{payLabel}</b>}
              {conditions.length > 0 && (
                <span>{payLabel ? `· ${conditions.join(' · ')}` : conditions.join(' · ')}</span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="plate-bottom">
        <Reputation data={job.reputation} showStatus showReviews={false} />
      </div>

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

      {canEdit && editButton(() => setEditing(true))}

      {(interactive || preview) && (
        <>
          <CardActs
            saved={saved}
            onSave={onSave ? () => onSave(job.id) : undefined}
            onShare={preview ? undefined : share}
            onReport={canReport ? () => onReport({ kind: 'job', job }) : undefined}
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
                Postularme
              </button>
            ))}
          {preview && <span className="card-cta as-text">Postularme</span>}
        </>
      )}

      {job.created_at && !compact && !preview && <span className="when">Publicado {timeAgo(job.created_at)}</span>}

      {editing && (
        <EditListing
          kind="job"
          item={job}
          onClose={() => setEditing(false)}
          onSaved={() => onChanged?.('job', job.id)}
        />
      )}
    </article>
  );
}

// Tarjeta de servicio. "ofrece": la vidriera de un oficio o negocio. "busca": un pedido de trabajo.
export function ServiceCard({ service, user, onLogin, preview = false, onReport, saved = false, onSave, onChanged }) {
  const intent = intentOf(service);
  const isAsk = intent === 'busca';
  const [editing, setEditing] = useState(false);
  const interactive = !preview;
  const canEdit = !!user && (user.isAdmin || user.id === service.owner_id);
  const canReport = !preview && !!onReport && user?.id !== service.owner_id;
  const deepUrl = `${window.location.origin}${window.location.pathname}#/aviso/svc/${service.id}`;
  const emoji = isAsk ? '🔎' : emojiOf(service.category);
  const emote = plateEmote(service);
  const photosList = (service.photos || []).filter(Boolean);
  const extraPhotos = photosList.slice(1);
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
        {ctaLabel}
      </button>
    );

  return (
    <article id={`svc-${service.id}`} className={`scard ${intent} ${toneOf(service.category)}`}>
      <div className="card-body">
        <div className={`plate${photosList[0] ? ' photo' : ''}`} aria-hidden="true">
          {photosList[0] ? (
            <img src={servicePhotoUrl(photosList[0])} alt="" loading="lazy" />
          ) : emote ? (
            <img src={emote} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
          ) : (
            <span className="plate-emoji">{emoji}</span>
          )}
        </div>
        <div className="card-info">
          <div className="card-top">
            <div className="card-badges">
              <span className={`pill pill-${intent}`}>{isAsk ? 'Estoy buscando a alguien' : 'Ofrezco mi servicio'}</span>
            </div>
            {service.city && (
              <span className="where" title={service.city}>
                <MapPin size={18} aria-hidden="true" />
                <span>{service.city}</span>
              </span>
            )}
          </div>
          <h3>{service.title}</h3>
          <p className="who-row">
            <span className="who">
              {isAsk ? <Store size={18} aria-hidden="true" /> : <User size={18} aria-hidden="true" />}
              <span className="who-name">{nameWithPrefix(service.provider_name, service.provider_prefix)}</span>
            </span>
          </p>
          {service.price && (
            <p className="meta-row pay card-pay">
              <span className="coin"><CircleDollarSign size={13} aria-hidden="true" /></span>
              <b>{service.price}</b>
              <span>{isAsk ? 'presupuesto' : 'precio'}</span>
            </p>
          )}
        </div>
      </div>

      <div className="plate-bottom">
        <Reputation data={service.reputation} showStatus />
      </div>

      <div className="card-extra">
        {service.description && <p className="desc">{service.description}</p>}
      </div>

      {canEdit && editButton(() => setEditing(true))}

      {extraPhotos.length > 0 && (
        <ServicePhotos service={{ ...service, photos: extraPhotos }} preview={preview} />
      )}

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

      {editing && (
        <EditListing
          kind="service"
          item={service}
          onClose={() => setEditing(false)}
          onSaved={() => onChanged?.('service', service.id)}
        />
      )}
    </article>
  );
}
