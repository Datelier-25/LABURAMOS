import { useEffect, useRef, useState } from 'react';
import { lockScroll } from '../lib/scrollLock';
import { ImagePlus, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  JOB_CATEGORIES,
  JOB_PAY_TYPES,
  JOB_TYPES,
  SERVICE_CATEGORIES,
  cleanRequirementItems,
  friendlyError,
  isValidEmail,
} from '../lib/utils';
import { PROFESSION_PREFIXES } from '../lib/prefixes';
import { SERVICE_PHOTO_BUCKET, compressImage, servicePhotoUrl } from '../lib/photos';
import { isPremium, listingLimits, normalizeLink } from '../lib/premium';
import { useSettings } from '../lib/settings';
import EmotePicker from './EmotePicker';
import LinkFields from './LinkFields';
import RequirementItems from './RequirementItems';
import LegalConsent from './LegalConsent';
import { consentReady, recordLegalConsent } from '../lib/legal';

const clean = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

// Edición de un aviso propio (o de cualquiera, si la cuenta es admin).
// La base vuelve a validar la propiedad en admin_update_listing.
export default function EditListing({ kind, item, onClose, onSaved, embedded = false, onBusyChange }) {
  const isJob = kind === 'job';
  const [settings] = useSettings();
  const premium = isPremium(item);
  const limits = listingLimits(settings, premium);
  const premiumUpgrade = !!settings?.premium_enabled
    && ((settings?.premium_include_links && Number(settings?.premium_links_limit) > limits.links)
      || (settings?.premium_include_photos && Number(settings?.premium_photos_limit) > limits.photos));
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
    requirement_items: Array.isArray(item.requirement_items)
      ? item.requirement_items.map((req) => ({ text: req?.text || '', required: !!req?.required }))
      : item.requirements
        ? [{ text: item.requirements, required: false }]
        : [],
    apply_email: item.apply_email || '',
    phone: item.phone || '',
    icon: item.icon || '',
    status: item.status || 'active',
    expires: item.expires_at ? item.expires_at.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState({ terms: false, privacy: false });
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const [links, setLinks] = useState(() => (item.links || []).filter(Boolean));

  // Fotos de la galería: se muestran dentro de “Ver más”.
  const [photos, setPhotos] = useState(() =>
    isJob ? [] : (item.photos || []).filter(Boolean).map((path) => ({ path, url: servicePhotoUrl(path) }))
  );
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photosToDelete, setPhotosToDelete] = useState([]);

  // Imagen de la tarjeta: foto propia o logo. Es independiente de la galería.
  const [cover, setCover] = useState(() =>
    !isJob && item.cover_photo ? { path: item.cover_photo, url: servicePhotoUrl(item.cover_photo) } : null
  );
  const [coverBusy, setCoverBusy] = useState(false);
  const [coversToDelete, setCoversToDelete] = useState([]);

  const addedRef = useRef(new Set()); // rutas subidas en esta edición
  const savedRef = useRef(false);

  // Si se cierra sin guardar, borramos las fotos nuevas para no dejar archivos sueltos.
  useEffect(() => () => {
    if (savedRef.current) return;
    const pendientes = [...addedRef.current];
    if (pendientes.length) void supabase.storage.from(SERVICE_PHOTO_BUCKET).remove(pendientes);
  }, []);

  // Al reemplazar o quitar la portada, el archivo se borra cuando el cambio se guarda.
  const discardCover = (prev) => {
    if (!prev) return;
    if (addedRef.current.has(prev.path)) {
      addedRef.current.delete(prev.path);
      void supabase.storage.from(SERVICE_PHOTO_BUCKET).remove([prev.path]);
    } else {
      setCoversToDelete((list) => (list.includes(prev.path) ? list : [...list, prev.path]));
    }
  };

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
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (!uid) {
      setError('Tu sesión expiró. Volvé a ingresar.');
      setCoverBusy(false);
      return;
    }
    try {
      const blob = await compressImage(file);
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from(SERVICE_PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      addedRef.current.add(path);
      discardCover(cover);
      setCover({ path, url: servicePhotoUrl(path) });
      set({ icon: '' });
    } catch (err) {
      setError(friendlyError(err.message || 'No pudimos subir la imagen.'));
    }
    setCoverBusy(false);
  };

  const removeCover = () => {
    discardCover(cover);
    setCover(null);
  };

  // Elegir un emote reemplaza la portada: la tarjeta muestra una sola imagen.
  const chooseEmote = (icon) => {
    if (icon && cover) removeCover();
    set({ icon });
  };

  const onPhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, limits.photos - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setPhotoBusy(true);
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (!uid) {
      setError('Tu sesión expiró. Volvé a ingresar.');
      setPhotoBusy(false);
      return;
    }
    const added = [];
    for (const file of files) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        setError('Las fotos tienen que ser JPG, PNG o WebP.');
        continue;
      }
      try {
        const blob = await compressImage(file);
        const path = `${uid}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from(SERVICE_PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        addedRef.current.add(path);
        added.push({ path, url: servicePhotoUrl(path) });
      } catch (err) {
        setError(friendlyError(err.message || 'No pudimos subir la foto.'));
      }
    }
    if (added.length) setPhotos((prev) => [...prev, ...added].slice(0, limits.photos));
    setPhotoBusy(false);
  };

  const removePhoto = (path) => {
    setPhotos((prev) => prev.filter((p) => p.path !== path));
    if (addedRef.current.has(path)) {
      addedRef.current.delete(path);
      void supabase.storage.from(SERVICE_PHOTO_BUCKET).remove([path]);
    } else {
      setPhotosToDelete((prev) => (prev.includes(path) ? prev : [...prev, path]));
    }
  };

  useEffect(() => {
    if (embedded) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const unlock = lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlock();
    };
  }, [onClose, embedded]);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const cleanLinks = links.map(normalizeLink).filter(Boolean);
    if (links.some((link) => link.trim() && !normalizeLink(link))) {
      setError('Revisá los links: tienen que ser direcciones web válidas.');
      return;
    }
    const originalLinks = (item.links || []).filter(Boolean);
    const linksChanged = cleanLinks.length !== originalLinks.length || cleanLinks.some((link, i) => link !== originalLinks[i]);
    if (linksChanged && cleanLinks.length > limits.links) {
      setError(`Esta publicación permite hasta ${limits.links} ${limits.links === 1 ? 'link' : 'links'}. Quitá los que sobren para guardar.`);
      return;
    }
    const originalPhotos = (item.photos || []).filter(Boolean);
    const photosChanged = !isJob && (photos.length !== originalPhotos.length || photos.some((p, i) => p.path !== originalPhotos[i]));
    if (photosChanged && photos.length > limits.photos) {
      setError(`Esta publicación permite hasta ${limits.photos} fotos. Quitá las que sobren para guardar.`);
      return;
    }
    if (isJob && !isValidEmail(f.apply_email)) {
      setError('Ingresá un email válido para recibir las postulaciones.');
      return;
    }
    if (!consentReady(consent)) {
      setError('Para guardar los cambios, aceptá los Términos y la Política de Privacidad.');
      return;
    }
    setSaving(true);
    onBusyChange?.(true);
    const common = {
      title: f.title,
      category: f.category,
      description: f.description,
      phone: f.phone,
      status: f.status,
      links: cleanLinks,
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
          requirement_items: cleanRequirementItems(f.requirement_items),
          requirements: cleanRequirementItems(f.requirement_items).map((req) => req.text).join(' · ') || null,
          apply_channel: 'email',
          apply_email: f.apply_email.trim() || null,
        }
      : {
          ...common,
          provider_name: f.name,
          provider_prefix: f.prefix,
          intent: f.intent,
          price: f.price,
          city: f.city,
          province: f.province,
          icon: f.icon,
          cover_photo: cover?.path || null,
          photos: photos.map((p) => p.path),
        };

    // Los campos vacíos se mandan como null para poder borrarlos.
    Object.keys(payload).forEach((key) => {
      if (payload[key] === '') payload[key] = null;
    });
    if (payload.province) payload.province = clean(payload.province);

    try {
      const { error: err } = await supabase.rpc('admin_update_listing', {
        p_kind: kind, p_id: item.id, p: payload,
      });
      if (err) throw err;
      savedRef.current = true;
      // Las fotos quitadas se borran recién cuando el cambio quedó guardado.
      // Si edita un admin y el archivo es de otra persona, la política de
      // Storage puede impedirlo: la publicación igual deja de mostrarlo.
      if (photosToDelete.length) void supabase.storage.from(SERVICE_PHOTO_BUCKET).remove(photosToDelete);
      if (coversToDelete.length) void supabase.storage.from(SERVICE_PHOTO_BUCKET).remove(coversToDelete);
      void recordLegalConsent('editar-aviso');
      onSaved?.(kind, item.id);
      onClose?.();
    } catch (err) { setError(friendlyError(err.message)); }
    finally { setSaving(false); onBusyChange?.(false); }
  };

  const form = (
      <form className={`place-dlg admin-edit${embedded ? ' au-embedded-edit' : ''}`} role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : 'true'} aria-label="Editar publicación" onSubmit={save}>
        <div className="place-head">
          <h2>Editar {isJob ? 'aviso' : 'servicio'}</h2>
          <button type="button" className="x-sm" disabled={saving} onClick={onClose} aria-label="Cerrar edición">
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

        <div className="field">
          <span>Links (opcional)</span>
          {limits.links > 0 ? (
            <LinkFields links={links} onChange={setLinks} limit={limits.links} premium={premium} upgrade={premiumUpgrade} />
          ) : (
            <p className="premium-lock">Incluir links en la publicación es parte del premium.</p>
          )}
          <small>Google Maps, Instagram, Facebook, WhatsApp o tu sitio web. Se muestran dentro de “Ver más”.</small>
        </div>

        {!isJob && (
          <>
            <div className="field">
              <span>Imagen de la tarjeta</span>
              <div className="cover-pick">
                {cover ? (
                  <div className="cover-slot">
                    <img src={cover.url} alt="Imagen de la tarjeta" />
                    <button type="button" onClick={removeCover} disabled={saving || coverBusy} aria-label="Quitar imagen de la tarjeta">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="cover-add">
                    <ImagePlus size={20} aria-hidden="true" />
                    <span>{coverBusy ? 'Subiendo…' : 'Subir foto o logo'}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr" disabled={coverBusy || saving} onChange={onCover} />
                  </label>
                )}
              </div>
              {!cover && <EmotePicker value={f.icon} onChange={chooseEmote} />}
              <small>La foto, el logo o el emote que se ve en la tarjeta. Si no elegís una, se usa la primera foto de la publicación.</small>
            </div>

            <div className="field">
              <span>Fotos de la publicación</span>
              <div className="photo-pick">
                {photos.map((p, i) => (
                  <div className="photo-slot" key={p.path}>
                    <img src={p.url} alt={`Foto ${i + 1}`} />
                    <button type="button" onClick={() => removePhoto(p.path)} disabled={saving || photoBusy} aria-label={`Quitar foto ${i + 1}`}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {photos.length < limits.photos && (
                  <label className="photo-add">
                    <ImagePlus size={20} aria-hidden="true" />
                    <span>{photoBusy ? 'Subiendo…' : 'Agregar foto'}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr" disabled={photoBusy || saving} onChange={onPhotos} />
                  </label>
                )}
              </div>
              <small>
                Hasta {limits.photos} fotos. Se muestran dentro de “Ver más”; la imagen de la tarjeta no se repite.
                {premiumUpgrade && settings?.premium_include_photos ? ' Con premium podés sumar más.' : ''}
              </small>
            </div>
          </>
        )}

        {isJob && (
          <>
            <div className="field">
              <span>Requisitos (opcional)</span>
              <RequirementItems
                items={f.requirement_items}
                onChange={(items) => set({ requirement_items: items })}
                disabled={saving}
              />
            </div>
            <div className="field">
              <span>Email para recibir postulaciones</span>
              <input
                type="email"
                required
                placeholder="rrhh@tuempresa.com"
                value={f.apply_email}
                onChange={(e) => set({ apply_email: e.target.value })}
              />
              <small>Las postulaciones llegan a este correo. El postulante adjunta su CV y se envía desde la app.</small>
            </div>
          </>
        )}

        <div className="two">
          <label className="field">
            <span>Estado</span>
            <select value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="active">Activo</option>
              <option value="paused">Pausado</option>
              {isJob && <option value="filled">Cubierto</option>}
              {f.status === 'expired' && <option value="expired">Vencido</option>}
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

        {!isJob && (
          <p className="sheet-note">
            Las fotos que quedan publicadas tienen que ser tuyas o contar con permiso de las personas que aparecen.
          </p>
        )}
        <LegalConsent value={consent} onChange={setConsent} compact />

        <button className="btn btn-ink btn-lg btn-block" disabled={saving || photoBusy}>
          {saving ? 'Guardando…' : photoBusy ? 'Subiendo foto…' : 'Guardar cambios'}
        </button>
      </form>
  );
  return embedded ? form : <div className="overlay" onMouseDown={(e) => !saving && e.target === e.currentTarget && onClose?.()}>{form}</div>;
}
