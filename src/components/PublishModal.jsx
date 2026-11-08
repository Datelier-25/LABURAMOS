import { useEffect, useState } from 'react';
import { lockScroll } from '../lib/scrollLock';
import { ImagePlus, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { JOB_CATEGORIES, JOB_PAY_TYPES, JOB_TYPES, SERVICE_CATEGORIES, cleanPhone, friendlyError, isValidPhone } from '../lib/utils';
import { MAX_SERVICE_PHOTOS, SERVICE_PHOTO_BUCKET, compressImage, servicePhotoUrl } from '../lib/photos';
import { EMOTE_OPTIONS, emoteUrl } from '../lib/emotes';
import { PROFESSION_PREFIXES } from '../lib/prefixes';
import JobSign, { ServiceCard } from './Sign';
import { PlaceField } from './Place';

// Localidad inicial: la del perfil; si no, la zona elegida (si es una localidad)
const startPlace = (user, zone) => {
  if (user.city) return { city: user.city, province: user.province || null };
  if (zone?.city) return { city: zone.city, province: zone.province };
  return null;
};

// Selector de emote: miniaturas del catálogo (30 oficios × hombre/mujer).
export function EmotePicker({ value, onChange }) {
  return (
    <>
      {value && (
        <div className="emote-pick">
          <span className="emote-cur">
            <img src={emoteUrl(value)} alt="" />
          </span>
          <button type="button" className="chip" onClick={() => onChange('')}>
            Quitar emote
          </button>
        </div>
      )}
      <details className="emote-picker">
        <summary>{value ? 'Elegir otro emote' : 'Elegir emote'}</summary>
        <div className="emote-grid" role="group" aria-label="Catálogo de emotes">
          {EMOTE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`emote${value === o.id ? ' on' : ''}`}
              title={`${o.label} (${o.cat})`}
              onClick={() => onChange(o.id)}
              aria-pressed={value === o.id}
            >
              <img src={o.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </details>
    </>
  );
}

export default function PublishModal({ type, intent: startIntent = null, user, zone, settings, onClose, onCreated, onSafety }) {
  const isJob = type === 'job';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    intent: startIntent || 'ofrece',
    title: '',
    name: user.name || '',
    prefix: '',
    category: isJob ? JOB_CATEGORIES[0] : SERVICE_CATEGORIES[0],
    job_type: JOB_TYPES[0],
    pay_type: 'Por mes',
    publish_salary: false,
    salary: '',
    schedule: '',
    duration: '',
    price: '',
    description: '',
    requirements: '',
    phone: user.phone || '',
    place: startPlace(user, zone),
    icon: '', // emote de la tarjeta (id del PNG); se usa si no hay fotos
    photos: [], // { path, url } — hasta 5, solo en servicios
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isAsk = !isJob && form.intent === 'busca';
  const publishedSalary = form.publish_salary
    ? form.pay_type === 'A convenir'
      ? 'A convenir'
      : form.salary.trim() || null
    : null;
  const publishedPayType = form.publish_salary ? form.pay_type : null;
  const [photoBusy, setPhotoBusy] = useState(false);

  // Sube las fotos elegidas (máx. 3). Se guardan en la carpeta de la persona.
  const onPhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_SERVICE_PHOTOS - form.photos.length);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setPhotoBusy(true);
    const added = [];
    for (const file of files) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        setError('Las fotos tienen que ser JPG, PNG o WebP.');
        continue;
      }
      try {
        const blob = await compressImage(file);
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from(SERVICE_PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        added.push({ path, url: servicePhotoUrl(path) });
      } catch (err) {
        setError(friendlyError(err.message || 'No pudimos subir la foto.'));
      }
    }
    if (added.length) set({ photos: [...form.photos, ...added].slice(0, MAX_SERVICE_PHOTOS) });
    setPhotoBusy(false);
  };

  const removePhoto = (path) => {
    set({ photos: form.photos.filter((p) => p.path !== path) });
    supabase.storage.from(SERVICE_PHOTO_BUCKET).remove([path]);
  };

  // Cerrar con Escape y bloquear el scroll de fondo
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const unlock = lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlock();
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
          location: form.place.city,
          province: form.place.province,
          phone,
          description: form.description.trim(),
          requirements: form.requirements.trim() || null,
          salary: publishedSalary,
          pay_type: publishedPayType,
          schedule: form.schedule.trim() || null,
          duration: form.duration.trim() || null,
          icon: form.icon.trim() || null,
        })
      : await supabase.from('services').insert({
          owner_id: user.id,
          intent: form.intent,
          provider_name: form.name.trim(),
          provider_prefix: form.prefix || null,
          title: form.title.trim(),
          category: form.category,
          description: form.description.trim(),
          phone,
          city: form.place.city,
          province: form.place.province,
          price: form.price.trim() || null,
          icon: form.icon.trim() || null,
          photos: form.photos.map((p) => p.path),
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
    salary: publishedSalary,
    pay_type: publishedPayType,
    schedule: form.schedule.trim() || null,
    duration: form.duration.trim() || null,
    icon: form.icon.trim() || null,
  };
  const previewService = {
    intent: form.intent,
    category: form.category,
    title: form.title || (isAsk ? 'Lo que necesitás' : 'Tu oficio o servicio'),
    provider_name: form.name || 'Tu nombre',
    provider_prefix: form.prefix || null,
    description: form.description,
    city,
    price: form.price.trim() || null,
    icon: form.icon.trim() || null,
    photos: form.photos.map((p) => p.url),
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
                <button type="button" className={`tile${form.intent === 'ofrece' ? ' on' : ''}`} onClick={() => set({ intent: 'ofrece' })} aria-pressed={form.intent === 'ofrece'}>
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
          {!isJob && (
            <label className="field">
              <span>Abreviatura de tu profesión (opcional)</span>
              <select value={form.prefix} onChange={(e) => set({ prefix: e.target.value })}>
                <option value="">Sin abreviatura</option>
                {PROFESSION_PREFIXES.map((p) => (
                  <option key={`${p.value}-${p.label}`} value={p.value}>
                    {p.value} · {p.label}
                  </option>
                ))}
              </select>
              <small>Se muestra antes de tu nombre. Ejemplo: Cra. Andrea Pérez.</small>
            </label>
          )}
          <div className="two">
            <div className="field">
              <span>Rubro</span>
              <div className="fchips" role="group" aria-label="Rubro">
                {(isJob ? JOB_CATEGORIES : SERVICE_CATEGORIES).map((c) => (
                  <button key={c} type="button" className={`chip${form.category === c ? ' on' : ''}`} onClick={() => set({ category: c })} aria-pressed={form.category === c}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <PlaceField value={form.place} onChange={(place) => set({ place })} required />
          </div>
          {isJob && (
            <label className="field">
              <span>Modalidad</span>
              <select value={form.job_type} onChange={(e) => set({ job_type: e.target.value })}>
                {JOB_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          )}
          {isJob && (
            <label className="check">
              <input type="checkbox" checked={form.publish_salary} onChange={(e) => set({ publish_salary: e.target.checked })} />
              <span>Publicar sueldo (opcional)</span>
            </label>
          )}
          {isJob && form.publish_salary && (
            <div className="two">
              <label className="field">
                <span>Forma de pago</span>
                <select value={form.pay_type} onChange={(e) => set({ pay_type: e.target.value })}>
                  {JOB_PAY_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Monto o banda salarial</span>
                <input required={form.pay_type !== 'A convenir'} disabled={form.pay_type === 'A convenir'} inputMode="decimal" placeholder="$650.000" value={form.salary} onChange={(e) => set({ salary: e.target.value })} />
                <small>Solo el monto. Si es “a convenir”, elegí esa forma de pago y no cargues monto.</small>
              </label>
            </div>
          )}
          {isJob && (
            <div className="two">
              <label className="field">
                <span>Horario (opcional)</span>
                <input placeholder="Lunes a viernes de 9 a 18" value={form.schedule} onChange={(e) => set({ schedule: e.target.value })} />
              </label>
              <label className="field">
                <span>Duración (opcional)</span>
                <input placeholder="Permanente / 3 meses" value={form.duration} onChange={(e) => set({ duration: e.target.value })} />
              </label>
            </div>
          )}
          {!isJob && (
            <label className="field">
              <span>{isAsk ? 'Presupuesto' : 'Precio orientativo'} (opcional)</span>
              <input placeholder={isAsk ? 'A presupuesto' : 'Desde $8.000'} value={form.price} onChange={(e) => set({ price: e.target.value })} />
              <small>Para ofertas: monto de referencia. Para pedidos: preferís cotizar por presupuesto.</small>
            </label>
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
          {!isJob && (
            <div className="field">
              <span>Fotos (opcional)</span>
              <div className="photo-pick">
                {form.photos.map((p, i) => (
                  <div className="photo-slot" key={p.path}>
                    <img src={p.url} alt={`Foto ${i + 1}`} />
                    <button type="button" onClick={() => removePhoto(p.path)} aria-label={`Quitar foto ${i + 1}`}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {form.photos.length < MAX_SERVICE_PHOTOS && (
                  <label className="photo-add">
                    <ImagePlus size={20} aria-hidden="true" />
                    <span>{photoBusy ? 'Subiendo…' : `Agregar foto`}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr" disabled={photoBusy} onChange={onPhotos} />
                  </label>
                )}
              </div>
              <small>Hasta {MAX_SERVICE_PHOTOS} fotos. Se achican solas para que carguen rápido.</small>
            </div>
          )}
          {!isJob && !form.photos.length && (
            <div className="field">
              <span>Emote de la tarjeta (opcional)</span>
              <EmotePicker value={form.icon} onChange={(icon) => set({ icon })} />
              <small>Elegí una ilustración de oficio para tu tarjeta. Se usa solo si no subís fotos.</small>
            </div>
          )}
          {isJob && (
            <div className="field">
              <span>Emote de la tarjeta (opcional)</span>
              <EmotePicker value={form.icon} onChange={(icon) => set({ icon })} />
              <small>Si no cargás una imagen propia, la tarjeta usa una ilustración de oficio.</small>
            </div>
          )}
          <label className="field">
            <span>WhatsApp para que te escriban</span>
            <input required inputMode="tel" placeholder="2342112233" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            <small>Código de área y número, sin 0 ni 15.</small>
          </label>

          <p className="sheet-note">
            Queda publicado {(isJob ? settings?.job_days : settings?.service_days) || 30} días. Después podés renovarlo o pausarlo desde Mis avisos.
          </p>
          <p className="sheet-note safe">
            Nunca pidas dinero por adelantado ni datos de tarjetas.{' '}
            <button type="button" className="linky" onClick={onSafety}>
              Consejos para operar seguro
            </button>
          </p>
          <button className="btn btn-ink btn-lg btn-block" disabled={loading}>
            {loading ? 'Publicando…' : 'Publicar'}
          </button>
        </form>
      </div>
    </div>
  );
}
