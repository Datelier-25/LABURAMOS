import { useEffect, useRef, useState } from 'react';
import { lockScroll } from '../lib/scrollLock';
import { ImagePlus, Star, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  JOB_CATEGORIES,
  JOB_PAY_TYPES,
  JOB_TYPES,
  SERVICE_CATEGORIES,
  friendlyError,
} from '../lib/utils';
import { PROFESSION_PREFIXES } from '../lib/prefixes';
import { SERVICE_PHOTO_BUCKET, compressImage, servicePhotoUrl } from '../lib/photos';
import { isPremium, listingLimits, normalizeLink } from '../lib/premium';
import { useSettings } from '../lib/settings';
import LinkFields from './LinkFields';

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
    requirements: item.requirements || '',
    phone: item.phone || '',
    status: item.status || 'active',
    expires: item.expires_at ? item.expires_at.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const [links, setLinks] = useState(() => (item.links || []).filter(Boolean));

  // Fotos del servicio: la primera es la portada de la tarjeta.
  const [photos, setPhotos] = useState(() =>
    isJob ? [] : (item.photos || []).filter(Boolean).map((path) => ({ path, url: servicePhotoUrl(path) }))
  );
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photosToDelete, setPhotosToDelete] = useState([]);
  const addedRef = useRef(new Set()); // rutas subidas en esta edición
  const savedRef = useRef(false);

  // Si se cierra sin guardar, borramos las fotos nuevas para no dejar archivos sueltos.
  useEffect(() => () => {
    if (savedRef.current) return;
    const pendientes = [...addedRef.current];
    if (pendientes.length) void supabase.storage.from(SERVICE_PHOTO_BUCKET).remove(pendientes);
  }, []);

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

  // La primera foto se usa como imagen principal de la publicación.
  const makeCover = (path) => {
    setPhotos((prev) => {
      const chosen = prev.find((p) => p.path === path);
      if (!chosen) return prev;
      return [chosen, ...prev.filter((p) => p.path !== path)];
    });
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
          <div className="field">
            <span>Fotos de la publicación</span>
            <div className="photo-pick">
              {photos.map((p, i) => (
                <div className="photo-slot" key={p.path}>
                  <img src={p.url} alt={`Foto ${i + 1}`} />
                  <button type="button" onClick={() => removePhoto(p.path)} disabled={saving || photoBusy} aria-label={`Quitar foto ${i + 1}`}>
                    <X size={14} />
                  </button>
                  {i === 0 ? (
                    <span className="photo-cover">Portada</span>
                  ) : (
                    <button type="button" className="photo-cover-btn" onClick={() => makeCover(p.path)} disabled={saving || photoBusy} aria-label={`Usar la foto ${i + 1} como portada`}>
                      <Star size={12} aria-hidden="true" /> Portada
                    </button>
                  )}
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
              La primera foto es la portada de la tarjeta. Hasta {limits.photos} fotos; se achican solas para que carguen rápido.
              {premiumUpgrade && settings?.premium_include_photos ? ' Con premium podés sumar más.' : ''}
            </small>
          </div>
        )}

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

        <button className="btn btn-ink btn-lg btn-block" disabled={saving || photoBusy}>
          {saving ? 'Guardando…' : photoBusy ? 'Subiendo foto…' : 'Guardar cambios'}
        </button>
      </form>
  );
  return embedded ? form : <div className="overlay" onMouseDown={(e) => !saving && e.target === e.currentTarget && onClose?.()}>{form}</div>;
}
