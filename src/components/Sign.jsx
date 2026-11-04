import { useState } from 'react';
import { Bookmark, CalendarDays, Clock, Flag, MapPin, MessageCircle, Phone, Search, Share2, Wallet } from 'lucide-react';
import { initials, intentOf, timeAgo, toneOf, waLink } from '../lib/utils';
import { MAX_SERVICE_PHOTOS, servicePhotoUrl } from '../lib/photos';
import { Reputation } from './Reputation';

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

// Cartel de empleo. Es el mismo en las listas, en la vista previa y en los carteles de ejemplo.
export default function JobSign({ job, user, saved = false, onSave, onLogin, onApply, applied = false, compact = false, preview = false, wide = false, style, onReport }) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const interactive = !compact && !preview;
  const long = (job.description || '').length > 130 || !!job.requirements;
  const message = `Hola, vi tu aviso de "${job.title}" en LaburamosApp y me interesa.${user ? ` Soy ${user.name}.` : ''}${user?.role === 'worker' ? ' Mi CV lo ves en LaburamosApp, en Postulantes.' : ''}`;

  // Pago visible: la banda salarial ya escrita o la forma de cobro. "A convenir" es un dato explícito.
  const pay = job.salary || job.pay_type || null;
  const payLabel = !pay
    ? null
    : pay === 'A convenir' || /a convenir/i.test(String(pay))
      ? 'A convenir'
      : `${pay}${job.pay_type && job.pay_type !== 'A convenir' && !/a convenir/i.test(String(job.salary || '')) ? ` · ${job.pay_type}` : ''}`;

  // Primero se registra la postulación y después se abre WhatsApp (ver applyTo en App.jsx).
  // Si el registro falla, no se navega y además se muestra el motivo.
  const apply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      await onApply?.(job, waLink(job.phone, message));
    } finally {
      setApplying(false);
    }
  };

  return (
    <article
      className={`sign ${toneOf(job.category)}${open ? ' open' : ''}${wide ? ' wide' : ''}${compact ? ' compact' : ''}`}
      style={style}
    >
      <div className="sign-top">
        <span className="chip-s acc">{job.category}</span>
        <div>
          {job.is_urgent && <span className="chip-s urgent">Urgente</span>}
          <span className="chip-s">{job.job_type}</span>
        </div>
      </div>

      <h3>{job.title}</h3>
      {payLabel && (
        <p className="sign-pay">
          <Wallet size={15} aria-hidden="true" /> <b>{payLabel}</b>
        </p>
      )}
      {!compact && (job.schedule || job.duration) && (
        <p className="sign-conds">
          {job.schedule && (
            <span>
              <Clock size={13} aria-hidden="true" /> {job.schedule}
            </span>
          )}
          {job.duration && (
            <span>
              <CalendarDays size={13} aria-hidden="true" /> {job.duration}
            </span>
          )}
        </p>
      )}
      <p className="sign-meta">
        <span>{job.company_name}</span>
        <Reputation data={job.reputation} showStatus />
        <span className="loc">
          <MapPin size={15} aria-hidden="true" /> {job.location}
        </span>
      </p>

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

      <div className="sign-foot">
        {interactive && (
          <div className="sign-acts">
            <button
              type="button"
              className={`icon-btn${saved ? ' on' : ''}`}
              onClick={() => onSave && onSave(job.id)}
              aria-label={saved ? 'Quitar de guardados' : 'Guardar aviso'}
              aria-pressed={saved}
            >
              <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              className="icon-btn share"
              onClick={() =>
                window.open(waLink(job.phone, `Hola, vi tu aviso de "${job.title}" en LaburamosApp y me interesa. ${job.id}`), '_blank', 'noopener')
              }
              aria-label="Compartir aviso por WhatsApp"
              title="Compartir aviso por WhatsApp"
            >
              <Share2 size={17} />
            </button>
            {job?.id && onReport && user?.id !== job.company_id && (
              <button type="button" className="icon-btn report" onClick={() => onReport(job)} aria-label="Denunciar aviso" title="Denunciar aviso">
                <Flag size={17} />
              </button>
            )}
            {user ? (
              applied ? (
                <button type="button" className="btn btn-line btn-sm" disabled>
                  Ya postulaste
                </button>
              ) : (
                <button type="button" className="btn btn-ink btn-sm" onClick={apply} disabled={applying}>
                  <Phone size={16} /> {applying ? 'Enviando…' : 'Postularme'}
                </button>
              )
            ) : (
              <button type="button" className="btn btn-ink btn-sm" onClick={onLogin}>
                Ingresá para postularte
              </button>
            )}
          </div>
        )}
      </div>

      {job.created_at && !compact && !preview && <span className="when">Publicado {timeAgo(job.created_at)}</span>}
    </article>
  );
}

// Tarjeta de servicio. "ofrece": la vidriera de un oficio o negocio. "busca": un pedido de trabajo.
export function ServiceCard({ service, user, onLogin, preview = false }) {
  const intent = intentOf(service);
  const isAsk = intent === 'busca';
  const message = isAsk
    ? `Hola, vi tu pedido "${service.title}" en LaburamosApp y te puedo ayudar.`
    : `Hola, vi tu servicio de "${service.title}" en LaburamosApp y quería consultarte.`;
  const label = isAsk ? 'Me interesa' : 'Contactar';
  const btn = isAsk ? 'btn btn-sun btn-sm' : 'btn btn-ink btn-sm';

  let action;
  if (preview) action = <span className={btn}>{label}</span>;
  else if (user)
    action = (
      <a className={btn} href={waLink(service.phone, message)} target="_blank" rel="noreferrer">
        <MessageCircle size={16} /> {label}
      </a>
    );
  else
    action = (
      <button type="button" className={btn} onClick={onLogin}>
        Ingresá para {isAsk ? 'responder' : 'escribir'}
      </button>
    );

  return (
    <article className={`scard ${intent} ${toneOf(service.category)}`}>
      <div className="scard-head">
        <div className="disc" aria-hidden="true">
          {isAsk ? <Search size={22} /> : initials(service.provider_name)}
        </div>
        <div className="scard-tags">
          <span className="kind">{isAsk ? 'Busca' : 'Ofrece'}</span>
          <span className="chip-s">{service.category}</span>
          {service.is_urgent && <span className="chip-s urgent">Urgente</span>}
        </div>
      </div>
      <h3>{service.title}</h3>
      {service.price && (
        <p className="sign-pay">
          <Wallet size={15} aria-hidden="true" /> <small>{isAsk ? 'Presupuesto' : 'Precio'}</small> <b>{service.price}</b>
        </p>
      )}
      <p className="by">
        {isAsk ? `Pedido de ${service.provider_name}` : service.provider_name}
        <Reputation data={service.reputation} showStatus />
        <span className="loc">
          <MapPin size={15} aria-hidden="true" /> {service.city}
        </span>
      </p>
      {service.description && <p className="desc">{service.description}</p>}
      <ServicePhotos service={service} preview={preview} />
      <div className="scard-foot">
        {service.created_at && !preview ? <span className="when">{timeAgo(service.created_at)}</span> : <span />}
        {action}
      </div>
    </article>
  );
}
