import { useEffect, useState } from 'react';
import { lockScroll } from '../lib/scrollLock';
import { ImagePlus, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { JOB_CATEGORIES, JOB_PAY_TYPES, JOB_TYPES, SERVICE_CATEGORIES, cleanPhone, cleanRequirementItems, friendlyError, isValidEmail, isValidPhone } from '../lib/utils';
import { SERVICE_PHOTO_BUCKET, compressImage, servicePhotoUrl } from '../lib/photos';
import { listingLimits, normalizeLink } from '../lib/premium';
import { PROFESSION_PREFIXES } from '../lib/prefixes';
import JobSign, { ServiceCard } from './Sign';
import EmotePicker from './EmotePicker';
import LinkFields from './LinkFields';
import RequirementItems from './RequirementItems';
import { PlaceField } from './Place';

// Localidad inicial: la del perfil; si no, la zona elegida (si es una localidad)
const startPlace = (user, zone) => {
  if (user.city) return { city: user.city, province: user.province || null };
  if (zone?.city) return { city: zone.city, province: zone.province };
  return null;
};

// Selector de emote: miniaturas del catálogo (30 oficios × hombre/mujer).
export { default as EmotePicker } from './EmotePicker';

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
    requirement_items: [{ text: '', required: false }],
    apply_channel: 'whatsapp',
    apply_email: '',
    phone: user.phone || '',
    place: startPlace(user, zone),
    icon: '', // emote de la tarjeta (id del PNG); se usa si no hay portada ni fotos
    photos: [], // { path, url } — galería de "Ver más", solo en servicios
    links: [], // links de Maps, Instagram, Facebook, WhatsApp o web
  });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isAsk = !isJob && form.intent === 'busca';
  // Al publicar todavía no hay premium activo: se usan los límites gratis.
  const limits = listingLimits(settings, false);
  const premiumUpgrade = !!settings?.premium_enabled
    && ((settings?.premium_include_links && Number(settings?.premium_links_limit) > limits.links)
      || (settings?.premium_include_photos && Number(settings?.premium_photos_limit) > limits.photos));
  const publishedSalary = form.publish_salary
    ? form.pay_type === 'A convenir'
      ? 'A convenir'
      : form.salary.trim() || null
    : null;
  const publishedPayType = form.publish_salary ? form.pay_type : null;
  const [cover, setCover] = useState(null); // { path, url } — imagen de la tarjeta
  const [coverBusy, setCoverBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Portada de la tarjeta: foto propia o logo. Es independiente de la galería.
  const onCover = async (e) => {
    const file = (e.target.files || [])[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('La imagen tiene que ser JPG, PNG o WebP.');
      return;
    }
    setError('');
    setCoverBusy(true);
    try {
      const blob = await compressImage(file);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from(SERVICE_PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      setCover({ path, url: servicePhotoUrl(path) });
      set({ icon: '' });
    } catch (err) {
      setError(friendlyError(err.message || 'No pudimos subir la imagen.'));
    }
    setCoverBusy(false);
  };

  const removeCover = () => {
    if (cover) void supabase.storage.from(SERVICE_PHOTO_BUCKET).remove([cover.path]);
    setCover(null);
  };

  // Elegir un emote reemplaza la portada: la tarjeta muestra una sola imagen.
  const chooseEmote = (icon) => {
    if (icon && cover) removeCover();
    set({ icon });
  };

  // Sube las fotos de la galería (no cuentan la portada). Se guardan en la carpeta de la persona.
  const onPhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, limits.photos - form.photos.length);
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
    if (added.length) set({ photos: [...form.photos, ...added].slice(0, limits.photos) });
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
    const cleanLinks = form.links.map(normalizeLink).filter(Boolean);
    if (form.links.some((link) => link.trim() && !normalizeLink(link))) {
      setError('Revisá los links: tienen que ser direcciones web válidas.');
      return;
    }
    if (cleanLinks.length > limits.links) {
      setError(`Podés cargar hasta ${limits.links} ${limits.links === 1 ? 'link' : 'links'}.`);
      return;
    }
    if (isJob && form.apply_channel === 'email' && !isValidEmail(form.apply_email)) {
      setError('Ingresá un email válido para recibir las postulaciones.');
      return;
    }
    setLoading(true);
    const phone = cleanPhone(form.phone);
    const requirementItems = isJob ? cleanRequirementItems(form.requirement_items) : [];

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
          requirement_items: requirementItems,
          requirements: requirementItems.map((req) => req.text).join(' · ') || null,
          apply_channel: form.apply_channel,
          apply_email: form.apply_channel === 'email' ? form.apply_email.trim() : null,
          salary: publishedSalary,
          pay_type: publishedPayType,
          schedule: form.schedule.trim() || null,
          duration: form.duration.trim() || null,
          icon: form.icon.trim() || null,
          links: cleanLinks,
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
          cover_photo: cover?.path || null,
          photos: form.photos.map((p) => p.path),
          links: cleanLinks,
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
    links: form.links.map(normalizeLink).filter(Boolean),
    requirement_items: cleanRequirementItems(form.requirement_items),
    apply_channel: form.apply_channel,
    apply_email: form.apply_email.trim() || null,
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
    cover_photo: cover?.url || null,
    photos: form.photos.map((p) => p.url),
    links: form.links.map(normalizeLink).filter(Boolean),
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
          {isJob ? <JobSign job={previewJob} preview settings={settings} /> : <ServiceCard service={previewService} preview settings={settings} />}
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
            <div className="field">
              <span>Requisitos (opcional)</span>
              <RequirementItems items={form.requirement_items} onChange={(items) => set({ requirement_items: items })} />
            </div>
          )}
          {isJob && (
            <div className="field">
              <span>¿Dónde querés recibir las postulaciones?</span>
              <div className="tiles">
                <button
                  type="button"
                  className={`tile${form.apply_channel === 'whatsapp' ? ' on' : ''}`}
                  onClick={() => set({ apply_channel: 'whatsapp' })}
                  aria-pressed={form.apply_channel === 'whatsapp'}
                >
                  <b>WhatsApp</b>
                  <small>Te escriben al número del aviso</small>
                </button>
                <button
                  type="button"
                  className={`tile${form.apply_channel === 'email' ? ' on' : ''}`}
                  onClick={() => set({ apply_channel: 'email' })}
                  aria-pressed={form.apply_channel === 'email'}
                >
                  <b>Email</b>
                  <small>Las postulaciones llegan a tu correo</small>
                </button>
              </div>
              {form.apply_channel === 'email' && (
                <label className="field">
                  <span>Email para postulaciones</span>
                  <input
                    type="email"
                    required
                    placeholder="rrhh@tuempresa.com"
                    value={form.apply_email}
                    onChange={(e) => set({ apply_email: e.target.value })}
                  />
                </label>
              )}
              <small>Las y los postulantes cargan su CV en la app y después se abre el contacto que elijas.</small>
            </div>
          )}
          <div className="field">
            <span>Links (opcional)</span>
            {limits.links > 0 ? (
              <LinkFields links={form.links} onChange={(links) => set({ links })} limit={limits.links} upgrade={premiumUpgrade} />
            ) : (
              <p className="premium-lock">Incluir links en la publicación es parte del premium.</p>
            )}
            <small>Podés sumar Google Maps, Instagram, Facebook, WhatsApp o tu sitio web.</small>
          </div>
          {!isJob && (
            <div className="field">
              <span>Imagen de la tarjeta (opcional)</span>
              <div className="cover-pick">
                {cover ? (
                  <div className="cover-slot">
                    <img src={cover.url} alt="Imagen de la tarjeta" />
                    <button type="button" onClick={removeCover} aria-label="Quitar imagen de la tarjeta">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="cover-add">
                    <ImagePlus size={20} aria-hidden="true" />
                    <span>{coverBusy ? 'Subiendo…' : 'Subir foto o logo'}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr" disabled={coverBusy} onChange={onCover} />
                  </label>
                )}
              </div>
              {!cover && <EmotePicker value={form.icon} onChange={chooseEmote} />}
              <small>Se ve en la tarjeta: puede ser una foto tuya, el logo de tu negocio o un emote. Si no elegís una, se usa la primera foto de la publicación.</small>
            </div>
          )}
          {!isJob && (
            <div className="field">
              <span>Fotos de la publicación (opcional)</span>
              <div className="photo-pick">
                {form.photos.map((p, i) => (
                  <div className="photo-slot" key={p.path}>
                    <img src={p.url} alt={`Foto ${i + 1}`} />
                    <button type="button" onClick={() => removePhoto(p.path)} aria-label={`Quitar foto ${i + 1}`}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {form.photos.length < limits.photos && (
                  <label className="photo-add">
                    <ImagePlus size={20} aria-hidden="true" />
                    <span>{photoBusy ? 'Subiendo…' : `Agregar foto`}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr" disabled={photoBusy} onChange={onPhotos} />
                  </label>
                )}
              </div>
              <small>
                Hasta {limits.photos} fotos. Se muestran dentro de “Ver más”; la imagen de la tarjeta no se repite.
                {premiumUpgrade && settings?.premium_include_photos ? ' Con premium podés sumar más.' : ''}
              </small>
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
