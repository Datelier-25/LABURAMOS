import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { JOB_CATEGORIES, JOB_TYPES, SERVICE_CATEGORIES, cleanPhone, friendlyError, isValidPhone } from '../lib/utils';
import JobSign, { ServiceCard } from './Sign';
import { PlaceField } from './Place';

// Localidad inicial: la del perfil; si no, la zona elegida (si es una localidad)
const startPlace = (user, zone) => {
  if (user.city) return { city: user.city, province: user.province || null };
  if (zone?.city) return { city: zone.city, province: zone.province };
  return null;
};

export default function PublishModal({ type, intent: startIntent = null, user, zone, settings, onClose, onCreated }) {
  const isJob = type === 'job';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    intent: startIntent || 'ofrece',
    title: '',
    name: user.name || '',
    category: isJob ? JOB_CATEGORIES[0] : SERVICE_CATEGORIES[0],
    job_type: JOB_TYPES[0],
    salary: '',
    description: '',
    requirements: '',
    phone: user.phone || '',
    place: startPlace(user, zone),
    is_urgent: false,
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isAsk = !isJob && form.intent === 'busca';

  // Cerrar con Escape y bloquear el scroll de fondo
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.place?.city) {
      setError('Elegí la localidad del aviso.');
      return;
    }
    if (!isValidPhone(form.phone)) {
      setError('Ingresá un WhatsApp válido: código de área y número, sin 0 ni 15. Ejemplo: 2342112233');
      return;
    }
    setLoading(true);
    const phone = cleanPhone(form.phone);

    const { error: err } = isJob
      ? await supabase.from('jobs').insert({
          company_id: user.id,
          title: form.title.trim(),
          company_name: form.name.trim(),
          category: form.category,
          job_type: form.job_type,
          salary: form.salary.trim() || null,
          location: form.place.city,
          province: form.place.province,
          phone,
          description: form.description.trim(),
          requirements: form.requirements.trim() || null,
          is_urgent: form.is_urgent,
        })
      : await supabase.from('services').insert({
          owner_id: user.id,
          intent: form.intent,
          provider_name: form.name.trim(),
          title: form.title.trim(),
          category: form.category,
          description: form.description.trim(),
          phone,
          city: form.place.city,
          province: form.place.province,
          is_urgent: isAsk && form.is_urgent,
        });

    if (err) {
      setError(friendlyError(err.message));
      setLoading(false);
    } else {
      onCreated(type);
    }
  };

  const city = form.place?.city || 'Tu localidad';
  const previewJob = {
    category: form.category,
    title: form.title || 'Título de tu aviso',
    company_name: form.name || 'Tu comercio',
    location: city,
    job_type: form.job_type,
    salary: form.salary,
    is_urgent: form.is_urgent,
  };
  const previewService = {
    intent: form.intent,
    category: form.category,
    title: form.title || (isAsk ? 'Lo que necesitás' : 'Tu oficio o servicio'),
    provider_name: form.name || 'Tu nombre',
    description: form.description,
    city,
    is_urgent: isAsk && form.is_urgent,
  };

  const heading = isJob ? 'Publicá tu aviso' : isAsk ? 'Pedí un servicio' : 'Anunciá tu servicio';

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={heading}>
        <button type="button" className="x" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>

        <div className="sheet-preview">
          <p className="cap">Así se va a ver tu {isJob ? 'cartel' : isAsk ? 'pedido' : 'tarjeta'}</p>
          {isJob ? <JobSign job={previewJob} preview /> : <ServiceCard service={previewService} preview />}
        </div>

        <form className="sheet-form" onSubmit={handleSubmit}>
          <h2>{heading}</h2>
          {error && <p className="note err">{error}</p>}

          {!isJob && (
            <div className="field">
              <span>¿Qué querés publicar?</span>
              <div className="tiles">
                <button type="button" className={`tile${form.intent === 'ofrece' ? ' on' : ''}`} onClick={() => set({ intent: 'ofrece', is_urgent: false })} aria-pressed={form.intent === 'ofrece'}>
                  <b>Ofrezco un servicio</b>
                  <small>Doy a conocer mi oficio o mi negocio</small>
                </button>
                <button type="button" className={`tile${form.intent === 'busca' ? ' on' : ''}`} onClick={() => set({ intent: 'busca' })} aria-pressed={form.intent === 'busca'}>
                  <b>Busco quien me haga un trabajo</b>
                  <small>Cuento qué necesito y me contactan</small>
                </button>
              </div>
            </div>
          )}

          <label className="field">
            <span>{isJob ? 'Puesto que buscás' : isAsk ? '¿Qué necesitás?' : 'Oficio o servicio'}</span>
            <input
              required
              minLength={3}
              maxLength={120}
              placeholder={isJob ? 'Vendedor/a de atención al público' : isAsk ? 'Busco parquero para cortar el pasto' : 'Plomería y gas matriculado'}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>
          <label className="field">
            <span>{isJob ? 'Comercio o empresa' : isAsk ? 'Tu nombre' : 'Tu nombre o el de tu negocio'}</span>
            <input required value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <div className="two">
            <label className="field">
              <span>Rubro</span>
              <select value={form.category} onChange={(e) => set({ category: e.target.value })}>
                {(isJob ? JOB_CATEGORIES : SERVICE_CATEGORIES).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <PlaceField value={form.place} onChange={(place) => set({ place })} required />
          </div>
          {isJob && (
            <div className="two">
              <label className="field">
                <span>Modalidad</span>
                <select value={form.job_type} onChange={(e) => set({ job_type: e.target.value })}>
                  {JOB_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Sueldo (opcional)</span>
                <input placeholder="$450.000" value={form.salary} onChange={(e) => set({ salary: e.target.value })} />
              </label>
            </div>
          )}
          <label className="field">
            <span>Descripción</span>
            <textarea
              required
              maxLength={2000}
              placeholder={isJob ? 'Tareas, horarios y qué ofrecés' : isAsk ? 'Contá el trabajo: qué hay que hacer, dónde y para cuándo' : 'Qué trabajos hacés y en qué zonas'}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
          {isJob && (
            <label className="field">
              <span>Requisitos (opcional)</span>
              <input placeholder="Experiencia previa, edad mínima, etc." value={form.requirements} onChange={(e) => set({ requirements: e.target.value })} />
            </label>
          )}
          <label className="field">
            <span>WhatsApp para que te escriban</span>
            <input required inputMode="tel" placeholder="2342112233" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            <small>Código de área y número, sin 0 ni 15.</small>
          </label>
          {(isJob || isAsk) && (
            <label className="check">
              <input type="checkbox" checked={form.is_urgent} onChange={(e) => set({ is_urgent: e.target.checked })} />
              Es urgente
            </label>
          )}

          <p className="sheet-note">
            Queda publicado {(isJob ? settings?.job_days : settings?.service_days) || 30} días. Después podés renovarlo o pausarlo desde Mis avisos.
          </p>
          <button className="btn btn-ink btn-lg btn-block" disabled={loading}>
            {loading ? 'Publicando…' : 'Publicar'}
          </button>
        </form>
      </div>
    </div>
  );
}
