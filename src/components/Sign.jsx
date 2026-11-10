import { useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Camera,
  CircleDollarSign,
  Clock3,
  Crown,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Share2,
  Store,
  ThumbsUp,
  User,
} from 'lucide-react';
import { emojiOf, intentOf, mailtoLink, shareListing, timeAgo, toneOf, waLink } from '../lib/utils';
import { plateEmote } from '../lib/emotes';
import { servicePhotoUrl } from '../lib/photos';
import { isPremium, linkKind, linkLabel, listingLimits, visibleLinks } from '../lib/premium';
import { nameWithPrefix } from '../lib/prefixes';
import { Reputation } from './Reputation';
import EditListing from './EditListing';

// Si falta una ilustración en el despliegue, la tarjeta conserva su imagen de respaldo.
function ListingArt({ src, emoji }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="plate-emoji">{emoji}</span>;
}

// Fotos del aviso. El límite depende del plan (gratis o premium).
function ServicePhotos({ service, preview, limit = 5 }) {
  const photos = (service.photos || []).filter(Boolean).slice(0, limit);
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

const LINK_ICONS = { maps: MapPin, instagram: Camera, facebook: ThumbsUp, whatsapp: MessageCircle, web: Globe };

// Links de la publicación (Maps, Instagram, Facebook, WhatsApp o web).
// Se muestran dentro de “Ver más”.
function ListingLinks({ links }) {
  if (!links?.length) return null;
  return (
    <div className="listing-links">
      {links.map((link) => {
        const kind = linkKind(link);
        const Icon = LINK_ICONS[kind] || Globe;
        return (
          <a key={link} className="listing-link" href={link} target="_blank" rel="noreferrer noopener" title={link}>
            <Icon size={15} aria-hidden="true" /> {linkLabel(link)}
          </a>
        );
      })}
    </div>
  );
}

function PremiumMark() {
  return (
    <span className="premium-mark" title="Publicación premium" aria-label="Publicación premium">
      <Crown size={14} aria-hidden="true" /> Premium
    </span>
  );
}

// Requisitos del aviso: los ítems nuevos o, si es un aviso viejo, el texto único.
function requirementList(job) {
  if (Array.isArray(job.requirement_items) && job.requirement_items.length) {
    return job.requirement_items
      .map((item) => ({ text: String(item?.text || '').trim(), required: !!item?.required }))
      .filter((item) => item.text);
  }
  const legacy = String(job.requirements || '').trim();
  return legacy ? [{ text: legacy, required: false }] : [];
}

// Fila de acciones de la tarjeta: Guardar / Compartir (+ Editar o Denunciar).
// Para el administrador, editar es un lápiz compacto a la derecha de Denunciar.
function CardActs({ saved, onSave, onShare, onReport, onEdit, editIcon = false, dead }) {
  const [shareHint, setShareHint] = useState('');
  const showReport = !!onReport || dead;
  const adminEdit = !!onEdit && editIcon;
  const share = async () => {
    if (!onShare) return;
    const result = await onShare();
    if (result === 'copied') {
      setShareHint('¡Copiado!');
      window.setTimeout(() => setShareHint(''), 2500);
    }
  };
  return (
    <div className={`card-acts${adminEdit ? ' has-edit-icon' : ''}${adminEdit && showReport ? ' has-report' : ''}`}>
      <button type="button" disabled={dead} className={saved ? 'on' : ''} onClick={onSave} aria-label={saved ? 'Quitar de guardados' : 'Guardar aviso'} aria-pressed={saved}>
        <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /> {saved ? 'Guardado' : 'Guardar'}
      </button>
      <button type="button" disabled={dead || !onShare} onClick={share} aria-label="Compartir aviso con otra persona">
        <Share2 size={16} aria-hidden="true" /> {shareHint || 'Compartir'}
      </button>
      {onEdit && !editIcon && (
        <button type="button" disabled={dead} onClick={onEdit} aria-label="Editar aviso">
          <Pencil size={16} aria-hidden="true" /> Editar
        </button>
      )}
      {showReport && (
        <button type="button" disabled={dead} onClick={onReport} aria-label="Denunciar aviso">
          <AlertTriangle size={16} aria-hidden="true" /> Denunciar
        </button>
      )}
      {onEdit && editIcon && (
        <button type="button" className="card-edit-icon" disabled={dead} onClick={onEdit} aria-label="Editar aviso" title="Editar aviso">
          <Pencil size={17} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// Cartel de empleo. Es el mismo en las listas, en la vista previa y en los carteles de ejemplo.
export default function JobSign({
  job,
  user,
  settings,
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
  const canEdit = !!user && (user.isAdmin || user.id === job.company_id);
  const premium = isPremium(job);
  const links = interactive || preview ? visibleLinks(job, settings) : [];
  const requirements = requirementList(job);
  const applyByEmail = job.apply_channel === 'email' && !!job.apply_email;
  const message = `Hola, vi tu aviso de "${job.title}" en LaburamosApp y me interesa.${user ? ` Soy ${user.name}.` : ''}${user?.role === 'worker' ? ' Mi CV lo ves en LaburamosApp, en Postulantes.' : ''}`;
  const applyUrl = applyByEmail
    ? mailtoLink(
        job.apply_email,
        `Postulación: ${job.title} · LaburamosApp`,
        `Hola, vi tu aviso de "${job.title}" en LaburamosApp y me interesa.${user ? ` Soy ${user.name}.` : ''} Mi CV está en Postulantes de LaburamosApp.`
      )
    : waLink(job.phone, message);
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
      await onApply(job, { channel: applyByEmail ? 'email' : 'whatsapp', url: applyUrl });
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
            <ListingArt key={emote} src={emote} emoji={emojiOf(job.category)} />
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
          <h3>
            {job.title}
            {premium && <PremiumMark />}
          </h3>
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
        <Reputation data={job.reputation} showStatus showReviews={false} readOnly={preview} />
      </div>

      <div className="card-extra">
        {!compact && job.description && <p className="desc">{job.description}</p>}
        {open && requirements.length > 0 && (
          <div className="req-list">
            <strong>Requisitos</strong>
            <ul>
              {requirements.map((req, i) => (
                <li key={i}>
                  <span>{req.text}</span>
                  <span className={`req-badge${req.required ? ' on' : ''}`}>
                    {req.required ? 'Excluyente' : 'No excluyente'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {open && (
          <p className="apply-channel">
            {applyByEmail ? <Mail size={15} aria-hidden="true" /> : <MessageCircle size={15} aria-hidden="true" />}
            {applyByEmail ? (
              <span>
                Postulaciones por email: <a href={`mailto:${job.apply_email}`}>{job.apply_email}</a>
              </span>
            ) : (
              <span>Postulaciones por WhatsApp</span>
            )}
          </p>
        )}
        {open && <ListingLinks links={links} />}
        {interactive && (
          <button type="button" className="more" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Ver menos' : 'Ver más'}
          </button>
        )}
      </div>

      {(interactive || preview) && (
        <>
          <CardActs
            saved={saved}
            onSave={onSave ? () => onSave(job.id) : undefined}
            onShare={preview ? undefined : share}
            onReport={canReport ? () => onReport({ kind: 'job', job }) : undefined}
            onEdit={canEdit && !preview ? () => setEditing(true) : undefined}
            editIcon={canEdit && !!user?.isAdmin}
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
export function ServiceCard({ service, user, settings, onLogin, preview = false, onReport, saved = false, onSave, onChanged }) {
  const intent = intentOf(service);
  const isAsk = intent === 'busca';
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const interactive = !preview;
  const canEdit = !!user && (user.isAdmin || user.id === service.owner_id);
  const canReport = !preview && !!onReport && user?.id !== service.owner_id;
  const premium = isPremium(service);
  const limits = listingLimits(settings, premium);
  const links = interactive || preview ? visibleLinks(service, settings) : [];
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
        {ctaLabel}
      </button>
    );

  return (
    <article id={`svc-${service.id}`} className={`scard ${intent} ${toneOf(service.category)}${open ? ' open' : ''}`}>
      <div className="card-body">
        <div className={`plate${photosList[0] ? ' photo' : ''}`} aria-hidden="true">
          <ListingArt key={photosList[0] || emote} src={photosList[0] ? servicePhotoUrl(photosList[0]) : emote} emoji={emoji} />
        </div>
        <div className="card-info">
          <div className="card-top">
            <div className="card-badges">
              <span className={`pill pill-${intent}`}>
                <span className="pill-label-full">{isAsk ? 'Estoy buscando a alguien' : 'Ofrezco mi servicio'}</span>
                <span className="pill-label-mid">{isAsk ? 'Busco a alguien' : 'Ofrezco servicio'}</span>
                <span className="pill-label-tiny">{isAsk ? 'Busco' : 'Ofrezco'}</span>
              </span>
            </div>
            {service.city && (
              <span className="where" title={service.city}>
                <MapPin size={18} aria-hidden="true" />
                <span>{service.city}</span>
              </span>
            )}
          </div>
          <h3>
            {service.title}
            {premium && <PremiumMark />}
          </h3>
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
        <Reputation data={service.reputation} showStatus readOnly={preview} />
      </div>

      <div className="card-extra">
        {service.description && <p className="desc">{service.description}</p>}
        {interactive && (
          <button type="button" className="more" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'Ver menos' : 'Ver más'}
          </button>
        )}
        {open && <ListingLinks links={links} />}
        {open && <ServicePhotos service={service} preview={preview} limit={limits.photos} />}
      </div>

      {(interactive || preview) && (
        <>
          <CardActs
            saved={saved}
            onSave={onSave ? () => onSave(service.id) : undefined}
            onShare={preview ? undefined : share}
            onReport={canReport ? () => onReport({ kind: 'service', service }) : undefined}
            onEdit={canEdit && !preview ? () => setEditing(true) : undefined}
            editIcon={canEdit && !!user?.isAdmin}
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
