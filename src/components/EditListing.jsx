import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  JOB_CATEGORIES,
  JOB_PAY_TYPES,
  JOB_TYPES,
  SERVICE_CATEGORIES,
  friendlyError,
} from '../lib/utils';
import { PROFESSION_PREFIXES } from '../lib/prefixes';

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

// Edición de un aviso propio (o de cualquiera, si la cuenta es admin).
// La base vuelve a validar la propiedad en admin_update_listing.
export default function EditListing({ kind, item, onClose, onSaved }) {
  const isJob = kind === 'job';
  const [f, setF] = useState({
    title: item.title || '',
    name: (isJob ? item.company_name : item.provider_name) || '',
    category: item.category || (isJob ? JOB_CATEGORIES[0] : SERVICE_CATEGORIES[0]),
    job_type: item.job_type || JOB_TYPES[0],
    pay_type: item.pay_type || JOB_PAY_TYPES[0],
    salary: item.salary || '',
    schedule: item.schedule || '',
    duration: item.duration || '',
    intent: item.intent || 'ofrece',
    price: item.price || '',
    prefix: item.provider_prefix || '',
    city: isJob ? item.location || '' : item.city || '',
    province: item.province || '',
    description: item.description || '',
    requirements: item.requirements || '',
    phone: item.phone || '',
    status: item.status || 'active',
    expires: item.expires_at ? item.expires_at.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

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

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const common = {
      title: f.title,
      category: f.category,
      description: f.description,
      phone: f.phone,
      status: f.status,
      ...(f.expires ? { expires_at: `${f.expires}T23:59:59` } : {}),
    };
    const payload = isJob
      ? {
          ...common,
          company_name: f.name,
          job_type: f.job_type,
          pay_type: f.pay_type,
          salary: f.salary,
          schedule: f.schedule,
          duration: f.duration,
          location: f.city,
          province: f.province,
          requirements: f.requirements,
        }
      : {
          ...common,
          provider_name: f.name,
          provider_prefix: f.prefix,
          intent: f.intent,
          price: f.price,
          city: f.city,
          province: f.province,
        };

    // Los campos vacíos se mandan como null para poder borrarlos.
    Object.keys(payload).forEach((key) => {
      if (payload[key] === '') payload[key] = null;
    });
    if (payload.province) payload.province = clean(payload.province);

    const { error: err } = await supabase.rpc('admin_update_listing', {
      p_kind: kind,
      p_id: item.id,
      p: payload,
    });
    setSaving(false);
    if (err) setError(friendlyError(err.message));
    else {
      onSaved?.(kind, item.id);
      onClose?.();
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
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
          <input required minLength={3} maxLength={120} value={f.title} onChange={(e) => set({ title: e.target.value })} />
        </label>

        <div className="two">
          <label className="field">
            <span>{isJob ? 'Comercio o empresa' : 'Nombre'}</span>
            <input
              required
              value={f.name}
              onChange={(e) => set({ name: e.target.value })}
            />
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

        {!isJob && (
          <label className="field">
            <span>Abreviatura de profesión (opcional)</span>
            <select value={f.prefix} onChange={(e) => set({ prefix: e.target.value })}>
              <option value="">Sin abreviatura</option>
              {PROFESSION_PREFIXES.map((p) => (
                <option key={`${p.value}-${p.label}`} value={p.value}>
                  {p.value} · {p.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {isJob ? (
          <>
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
                <span>Forma de pago</span>
                <select value={f.pay_type} onChange={(e) => set({ pay_type: e.target.value })}>
                  {JOB_PAY_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Monto o banda salarial (opcional)</span>
              <input
                disabled={f.pay_type === 'A convenir'}
                placeholder="$650.000"
                value={f.salary}
                onChange={(e) => set({ salary: e.target.value })}
              />
            </label>
            <div className="two">
              <label className="field">
                <span>Horario (opcional)</span>
                <input value={f.schedule} onChange={(e) => set({ schedule: e.target.value })} />
              </label>
              <label className="field">
                <span>Duración (opcional)</span>
                <input value={f.duration} onChange={(e) => set({ duration: e.target.value })} />
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="two">
              <label className="field">
                <span>Tipo</span>
                <select value={f.intent} onChange={(e) => set({ intent: e.target.value })}>
                  <option value="ofrece">Ofrece un servicio</option>
                  <option value="busca">Busca quien le haga un trabajo</option>
                </select>
              </label>
              <label className="field">
                <span>Precio orientativo (opcional)</span>
                <input value={f.price} onChange={(e) => set({ price: e.target.value })} />
              </label>
            </div>
          </>
        )}

        <div className="two">
          <label className="field">
            <span>Localidad</span>
            <input required value={f.city} onChange={(e) => set({ city: e.target.value })} />
          </label>
          <label className="field">
            <span>Provincia (opcional)</span>
            <input value={f.province} onChange={(e) => set({ province: e.target.value })} />
          </label>
        </div>

        <label className="field">
          <span>Descripción</span>
          <textarea value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </label>

        {isJob && (
          <label className="field">
            <span>Requisitos (opcional)</span>
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

        <label className="field">
          <span>WhatsApp</span>
          <input inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
        </label>

        <button className="btn btn-ink btn-lg btn-block" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
