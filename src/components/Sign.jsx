import { useState } from 'react';
import { AlertTriangle, Bookmark, CircleDollarSign, MapPin, Share2, Store, User } from 'lucide-react';
import { emojiOf, intentOf, timeAgo, toneOf, waLink } from '../lib/utils';
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

// Fila de tres acciones (Guardar / Compartir / Denunciar) del nuevo diseño de tarjeta.
function CardActs({ saved, onSave, onShare, onReport, dead }) {
  return (
    <div className="card-acts">
      <button type="button" disabled={dead} className={saved ? 'on' : ''} onClick={onSave} aria-label={saved ? 'Quitar de guardados' : 'Guardar aviso'} aria-pressed={saved}>
        <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /> {saved ? 'Guardado' : 'Guardar'}
      </button>
      <button type="button" disabled={dead} onClick={onShare} aria-label="Compartir por WhatsApp">
        <Share2 size={17} aria-hidden="true" /> Compartir
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

  // Pago visible: la banda salarial ya escrita o la forma de cobro. "A convenir" es un dato explícito.
  const pay = job.salary || job.pay_type || null;
  const payLabel = !pay
    ? null
    : pay === 'A convenir' || /a convenir/i.test(String(pay))
      ? 'A convenir'
      : `${pay}${job.pay_type && job.pay_type !== 'A convenir' && !/a convenir/i.test(String(job.salary || '')) ? ` · ${job.pay_type}` : ''}`;
  const conds = [job.schedule, job.duration, !payLabel ? job.job_type : null].filter(Boolean).join(' · ');

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

  // Compartir por WhatsApp: link directo al aviso puntual del sitio.
  const deepUrl = `${window.location.origin}${window.location.pathname}#/aviso/job/${job.id}`;
  const share = () =>
    window.open(waLink(job.phone, `Hola, vi tu aviso de "${job.title}" en LaburamosApp y me interesa.\n${deepUrl}`), '_blank', 'noopener');

  const canReport = !!job.id && !!onReport && user?.id !== job.company_id;
  const emoji = emojiOf(job.category);

  return (
    <article
      className={`sign ${toneOf(job.category)}${open ? ' open' : ''}${wide ? ' wide' : ''}${compact ? ' compact' : ''}`}
      id={`job-${job.id}`}
      style={style}
    >
      <div className="card-body">
        {!compact && (
          <div className="plate" aria-hidden="true">
            {job.image ? <img src={job.image} alt="" loading="lazy" /> : <span className="plate-emoji">{emoji}</span>}
          </div>
        )}
        <div className="card-info">
          <div className="card-badges">
            <span className="pill pill-job">Laburo</span>
            <span className="chip-s acc">{job.category}</span>
            {job.is_urgent && <span className="chip-s urgent">Urgente</span>}
          </div>
          <h3>{job.title}</h3>
          <p className="meta-row">
            <Store size={15} aria-hidden="true" /> {job.company_name}
            {job.location && (
              <span className="loc">
                <MapPin size={13} aria-hidden="true" /> {job.location}
              </span>
            )}
          </p>
          {(payLabel || conds) && (
            <p className="meta-row">
              <span className="coin">
                <CircleDollarSign size={13} aria-hidden="true" />
              </span>
              {payLabel && <b>{payLabel}</b>}
              {conds && <span>{conds}</span>}
            </p>
          )}
          {job.reputation && (
            <div className="rep-row">
              <Reputation data={job.reputation} showStatus />
            </div>
          )}
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
      )}

      {job.created_at && !compact && !preview && <span className="when">Publicado {timeAgo(job.created_at)}</span>}
    </article>
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
  const share = () =>
    window.open(
      waLink(service.phone, `Hola, vi tu servicio de "${service.title}" en LaburamosApp y quería consultarte.\n${deepUrl}`),
      '_blank',
      'noopener'
    );
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
        <div className="plate" aria-hidden="true">
          {(service.photos || []).filter(Boolean)[0] ? (
            <img src={servicePhotoUrl((service.photos || []).filter(Boolean)[0])} alt="" loading="lazy" />
          ) : (
            <span className="plate-emoji">{emoji}</span>
          )}
        </div>
        <div className="card-info">
          <div className="card-badges">
            <span className={`pill pill-${intent}`}>{isAsk ? 'Estoy buscando a alguien' : 'Ofrezco mi servicio'}</span>
            <span className="chip-s acc">{service.category}</span>
            {service.is_urgent && <span className="chip-s urgent">Urgente</span>}
          </div>
          <h3>{service.title}</h3>
          <p className="meta-row">
            {isAsk ? <Store size={15} aria-hidden="true" /> : <User size={15} aria-hidden="true" />} {isAsk ? `Pedido de ${service.provider_name}` : service.provider_name}
            {service.city && (
              <span className="loc">
                <MapPin size={13} aria-hidden="true" /> {service.city}
              </span>
            )}
          </p>
          {service.price && (
            <p className="meta-row">
              <span className="coin">
                <CircleDollarSign size={13} aria-hidden="true" />
              </span>
              <b>{service.price}</b>
              <span>{isAsk ? 'presupuesto' : 'precio'}</span>
            </p>
          )}
          {service.reputation && (
            <div className="rep-row">
              <Reputation data={service.reputation} showStatus />
            </div>
          )}
          {service.description && <p className="desc">{service.description}</p>}
        </div>
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
