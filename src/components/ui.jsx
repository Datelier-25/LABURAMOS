import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, Check, ChevronDown, Eye, EyeOff, SlidersHorizontal, Star, X } from 'lucide-react';
import { initials } from '../lib/utils';

// Reputación de una cuenta: sello de verificado y promedio de estrellas.
// No muestra nada si la persona todavía no tiene reseñas ni verificación.
export function Reputation({ data, className = '' }) {
  const reviews = Number(data?.reviews || 0);
  const rating = Number(data?.rating || 0);
  const verified = !!data?.is_verified;
  if (!verified && !reviews) return null;
  return (
    <span className={`rep ${className}`.trim()}>
      {verified && (
        <span className="rep-ver" title="Verificado por LaburamosApp">
          <BadgeCheck size={15} aria-hidden="true" /> Verificado
        </span>
      )}
      {reviews > 0 && (
        <span className="rep-stars" title={`${rating.toFixed(1)} de 5 según ${reviews} ${reviews === 1 ? 'reseña' : 'reseñas'}`}>
          <Star size={14} fill="currentColor" aria-hidden="true" />
          {rating.toFixed(1)}
          <small>({reviews})</small>
        </span>
      )}
    </span>
  );
}

export function SkeletonGrid({ n = 6 }) {
  return (
    <div className="signs" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skel" />
      ))}
    </div>
  );
}

// Campo de contraseña con botón para mostrarla u ocultarla
export function PasswordField({ label, value, onChange, autoComplete, hint, minLength = 6, required = true, children }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="pw">
        <input
          type={show ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          className="pw-eye"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={show}
          title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && <small>{hint}</small>}
      {children}
    </label>
  );
}

export function Empty({ title, text, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

// Fila de la guía de candidatos
export function Row({ tone, name, tag, title, by, desc, action, extra }) {
  return (
    <article className={`row ${tone}`}>
      <div className="disc" aria-hidden="true">
        {initials(name)}
      </div>
      <div>
        <span className="chip-s">{tag}</span>
        <h3>{title}</h3>
        <p className="by">{by}</p>
        {extra}
        {desc && <p className="rdesc">{desc}</p>}
      </div>
      <div className="act">{action}</div>
    </article>
  );
}

// ---------- filtros agrupados ----------
// groups:  [{ id, label, all, options: [...], value: string | null, onChange }]
// segment: { options: [{ value, label }], value, onChange }   (la primera opción es "todos")
// toggles: [{ id, label, value: bool, onChange }]
// extra:   chips activos que maneja la pantalla, [{ id, label, onRemove }]
function Dropdown({ group }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (v) => {
    group.onChange(v);
    setOpen(false);
  };

  return (
    <div className="fdrop" ref={box}>
      <button type="button" className={`fbtn${group.value ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true">
        {group.value ? `${group.label}: ${group.value}` : group.label}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="fpop" role="menu" aria-label={group.label}>
          <button type="button" role="menuitemradio" aria-checked={!group.value} className={!group.value ? 'on' : ''} onClick={() => pick(null)}>
            {group.all}
            {!group.value && <Check size={16} aria-hidden="true" />}
          </button>
          {group.options.map((o) => (
            <button key={o} type="button" role="menuitemradio" aria-checked={group.value === o} className={group.value === o ? 'on' : ''} onClick={() => pick(o)}>
              {o}
              {group.value === o && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Segment({ segment, className = '' }) {
  return (
    <div className={`fseg ${className}`} role="group">
      {segment.options.map((o) => (
        <button key={o.value} type="button" className={segment.value === o.value ? 'on' : ''} aria-pressed={segment.value === o.value} onClick={() => segment.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilterSheet({ groups, segment, toggles, onClear, onClose, total }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fsheet" role="dialog" aria-modal="true" aria-label="Filtros">
        <div className="place-head">
          <h2>Filtros</h2>
          <button type="button" className="x-sm" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {segment && <Segment segment={segment} className="wide" />}
        {groups.map((g) => (
          <fieldset key={g.id} className="fgroup">
            <legend>{g.label}</legend>
            <div className="fchips">
              {[null, ...g.options].map((o) => (
                <button key={o || 'all'} type="button" className={`chip${g.value === o ? ' on' : ''}`} aria-pressed={g.value === o} onClick={() => g.onChange(o)}>
                  {o || g.all}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        {toggles.map((t) => (
          <label key={t.id} className="switch">
            <input className="sr" type="checkbox" checked={t.value} onChange={(e) => t.onChange(e.target.checked)} />
            <span className="sw" aria-hidden="true" />
            <span>
              <b>{t.label}</b>
            </span>
          </label>
        ))}
        <div className="fsheet-foot">
          <button type="button" className="btn btn-line" onClick={onClear}>
            Limpiar
          </button>
          <button type="button" className="btn btn-ink" onClick={onClose}>
            {total === undefined ? 'Ver resultados' : `Ver ${total} ${total === 1 ? 'resultado' : 'resultados'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function Filters({ groups = [], segment, toggles = [], extra = [], onClear, total }) {
  const [sheet, setSheet] = useState(false);

  const active = [
    ...(segment && segment.value !== segment.options[0].value
      ? [{ id: 'seg', label: segment.options.find((o) => o.value === segment.value)?.label, onRemove: () => segment.onChange(segment.options[0].value) }]
      : []),
    ...groups.filter((g) => g.value).map((g) => ({ id: g.id, label: g.value, onRemove: () => g.onChange(null) })),
    ...toggles.filter((t) => t.value).map((t) => ({ id: t.id, label: t.label, onRemove: () => t.onChange(false) })),
    ...extra,
  ];

  return (
    <>
      <div className="fbar">
        {segment && <Segment segment={segment} />}
        {groups.map((g) => (
          <Dropdown key={g.id} group={g} />
        ))}
        {toggles.map((t) => (
          <button key={t.id} type="button" className={`fbtn toggle${t.value ? ' on' : ''}`} aria-pressed={t.value} onClick={() => t.onChange(!t.value)}>
            <span className="tdot" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="fbar-m">
        <button type="button" className={`fbtn${active.length ? ' on' : ''}`} onClick={() => setSheet(true)}>
          <SlidersHorizontal size={16} aria-hidden="true" /> Filtros{active.length ? ` (${active.length})` : ''}
        </button>
      </div>

      {active.length > 0 && (
        <div className="factive" aria-label="Filtros aplicados">
          {active.map((a) => (
            <button key={a.id} type="button" className="fchip" onClick={a.onRemove} aria-label={`Quitar filtro ${a.label}`}>
              {a.label} <X size={14} aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="fclear" onClick={onClear}>
            Limpiar filtros
          </button>
        </div>
      )}

      {sheet && <FilterSheet groups={groups} segment={segment} toggles={toggles} onClear={onClear} onClose={() => setSheet(false)} total={total} />}
    </>
  );
}

export function Footer({ go, links }) {
  return (
    <footer className="foot">
      <div className="wrap">
        <p className="foot-big" aria-label="LaburamosApp">
          Laburamos<span>App</span>
        </p>
        <div className="foot-cols">
          <p>Laburos, oficios y changas cerca tuyo. El contacto es directo por WhatsApp y los acuerdos los arreglás vos.</p>
          <div className="foot-links">
            {links.map((l) => (
              <button key={l.id} onClick={() => go(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
