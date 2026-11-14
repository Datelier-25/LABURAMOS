import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDollarSign, Crown, ExternalLink, FileText, ImagePlus, Pause, Pencil, Play, Search, Trash2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PAY_MODES as MODES, friendlyError, money } from '../lib/utils';
import { Empty } from './ui';
import { CvModal } from './Candidates';
import UsersPanel from './UsersPanel';
import EditListing from './EditListing';
import { isPremium } from '../lib/premium';
import { AD_IMAGE_BUCKET, AD_VIDEO_BUCKET, adImageUrl, adVideoUrl } from '../lib/ads';
import { WELCOME_BUCKET, WELCOME_MAX_FILE_MB, WELCOME_MAX_IMAGES, welcomeImageUrl } from '../lib/welcome';
import { compressImage } from '../lib/photos';

const STATUS = { approved: 'Aprobado', pending: 'Pendiente', rejected: 'Rechazado' };
const LISTING_STATUS = { active: 'Activo', paused: 'Pausado', filled: 'Cubierto', expired: 'Vencido' };
const TABS = [
  { id: 'config', label: 'Configuración' },
  { id: 'jobs', label: 'Avisos de empleo' },
  { id: 'services', label: 'Servicios' },
  { id: 'ads', label: 'Anuncios' },
  { id: 'cvs', label: 'CVs' },
  { id: 'users', label: 'Usuarios' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'recibidos', label: 'Recibidos' },
];
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const stateOf = (item) => (item.status === 'active' && new Date(item.expires_at) < new Date() ? 'expired' : item.status);

// ---------- cartel de bienvenida: imágenes ----------
function WelcomeImagesField({ value, onChange, onRemove }) {
  const list = Array.isArray(value) ? value : [];
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addFiles = async (files) => {
    const picked = Array.from(files || []);
    if (!picked.length) return;
    setError('');
    const room = WELCOME_MAX_IMAGES - list.length;
    if (room <= 0) {
      setError(`Ya tenés el máximo de ${WELCOME_MAX_IMAGES} imágenes. Quitá alguna para subir otra.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (picked.length > room) {
      setError(`Podés sumar ${room} imagen${room === 1 ? '' : 'es'} más.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setBusy(true);
    const paths = [];
    for (const file of picked) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Solo se aceptan imágenes JPG, PNG o WebP.');
        continue;
      }
      if (file.size > WELCOME_MAX_FILE_MB * 1024 * 1024) {
        setError(`Cada imagen puede pesar hasta ${WELCOME_MAX_FILE_MB} MB.`);
        continue;
      }
      try {
        const blob = await compressImage(file, 1600, 0.86);
        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const path = `welcome/${stamp}.jpg`;
        const { error: upErr } = await supabase.storage.from(WELCOME_BUCKET).upload(path, blob, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: false,
        });
        if (upErr) throw upErr;
        paths.push(path);
      } catch (e) {
        setError(friendlyError(e.message || 'No se pudo subir la imagen.'));
      }
    }
    if (paths.length) onChange([...list, ...paths]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const move = (index, dir) => {
    const next = [...list];
    const to = index + dir;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  return (
    <div className="welcome-field">
      <div className="welcome-upload">
        <label className={`btn btn-line welcome-pick${busy ? ' is-busy' : ''}`}>
          <ImagePlus size={18} aria-hidden="true" />
          {busy ? 'Subiendo…' : 'Subir imágenes'}
          <input
            ref={inputRef}
            className="sr"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
        <span className="welcome-count">
          {list.length} de {WELCOME_MAX_IMAGES}
        </span>
      </div>
      <p className="welcome-help">JPG, PNG o WebP de hasta {WELCOME_MAX_FILE_MB} MB. Se achican solas antes de subirlas y se muestran completas, sin recortes.</p>
      {error && <p className="note err">{error}</p>}
      {list.length > 0 && (
        <div className="welcome-grid">
          {list.map((path, i) => (
            <figure className="welcome-thumb" key={`${path}-${i}`}>
              <span className="welcome-thumb-num">{i + 1}</span>
              <img src={welcomeImageUrl(path)} alt={`Imagen ${i + 1} del cartel`} />
              <div className="welcome-thumb-acts">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover antes">
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Mover después">
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => onRemove(path)} aria-label="Quitar imagen">
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- configuración ----------
function SettingsTab({ notify, onSaved }) {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [welcomeDelete, setWelcomeDelete] = useState([]);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(friendlyError(err.message));
        setCfg({
          cv_paid_enabled: false,
          cv_price: 3000,
          cv_mode: 'por_dias',
          cv_days: 30,
          job_days: 30,
          service_days: 30,
          contact_email: 'laburamosapp@gmail.com',
          instagram_url: 'https://instagram.com/laburamosapp',
          legal_business_name: '',
          legal_cuit: '',
          legal_address: '',
          legal_email: 'laburamosapp@gmail.com',
          legal_last_update: '',
          application_email_from: 'laburamosapp@gmail.com',
          application_email_name: 'LaburamosApp',
          welcome_enabled: false,
          welcome_images: [],
          premium_enabled: false,
          premium_price: 3000,
          premium_days: 30,
          premium_include_links: true,
          premium_include_photos: true,
          free_links_limit: 1,
          premium_links_limit: 3,
          free_photos_limit: 5,
          premium_photos_limit: 10,
          ads_enabled: true,
          ads_price_per_second: 100,
          ads_price_image: 5000,
          ads_image_seconds: 8,
          ads_max_seconds: 30,
          ads_min_seconds: 5,
          ads_days: 30,
          ads_skip_seconds: 5,
          ads_max_per_user: 3,
          ...data,
        });
      });
  }, []);

  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const num = (v) => Number(String(v).replace(',', '.'));

  // La imagen sale de la lista al guardar; recién ahí se borra del bucket para
  // no dejar una referencia rota si el administrador cancela los cambios.
  const removeWelcomeImage = (path) => {
    setCfg((c) => ({
      ...c,
      welcome_images: (Array.isArray(c.welcome_images) ? c.welcome_images : []).filter((p) => p !== path),
    }));
    if (!/^(https?:|blob:|data:|\/)/i.test(path)) {
      setWelcomeDelete((list) => (list.includes(path) ? list : [...list, path]));
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const price = num(cfg.cv_price);
    const premiumPrice = num(cfg.premium_price);
    const days = [num(cfg.cv_days), num(cfg.job_days), num(cfg.service_days), num(cfg.premium_days)];
    const limits = [num(cfg.free_links_limit), num(cfg.premium_links_limit), num(cfg.free_photos_limit), num(cfg.premium_photos_limit)];
    const adsPrice = num(cfg.ads_price_per_second);
    const adsPriceImage = num(cfg.ads_price_image);
    const adsImageSeconds = num(cfg.ads_image_seconds);
    const adsMax = num(cfg.ads_max_seconds);
    const adsMin = num(cfg.ads_min_seconds);
    const adsDays = num(cfg.ads_days);
    const adsSkip = num(cfg.ads_skip_seconds);
    const adsPerUser = num(cfg.ads_max_per_user);
    const welcomeImages = (Array.isArray(cfg.welcome_images) ? cfg.welcome_images : []).filter((p) => typeof p === 'string' && p.trim());
    if (!(price > 0) || price > 1000000) return setError('Poné un precio mayor a $0.');
    if (!(premiumPrice >= 0) || premiumPrice > 1000000) return setError('El precio del premium tiene que ser $0 o más.');
    if (days.some((d) => !(d >= 1 && d <= 365))) return setError('Los días tienen que estar entre 1 y 365.');
    if (limits.some((n) => !(n >= 0 && n <= 20))) return setError('Los límites de links y fotos tienen que estar entre 0 y 20.');
    if (limits[1] < limits[0]) return setError('El premium no puede permitir menos links que el plan gratis.');
    if (limits[3] < limits[2]) return setError('El premium no puede permitir menos fotos que el plan gratis.');
    if (!(adsPrice > 0) || adsPrice > 1000000) return setError('El precio por segundo de los anuncios tiene que ser mayor a $0.');
    if (!(adsPriceImage > 0) || adsPriceImage > 10000000) return setError('El precio de la campaña de imagen tiene que ser mayor a $0.');
    if (!(adsImageSeconds >= 3 && adsImageSeconds <= 30)) return setError('Los segundos de una imagen en pantalla tienen que estar entre 3 y 30.');
    if (!(adsMax >= 5 && adsMax <= 30)) return setError('La duración máxima de los anuncios tiene que estar entre 5 y 30 segundos.');
    if (!(adsMin >= 1 && adsMin <= adsMax)) return setError('La duración mínima de los anuncios tiene que estar entre 1 y la máxima.');
    if (!(adsDays >= 1 && adsDays <= 365)) return setError('Los días de campaña tienen que estar entre 1 y 365.');
    if (!(adsSkip >= 0 && adsSkip <= adsMax)) return setError('Los segundos para continuar tienen que estar entre 0 y la duración máxima.');
    if (!(adsPerUser >= 1 && adsPerUser <= 20)) return setError('Los anuncios por usuario tienen que estar entre 1 y 20.');
    if (cfg.welcome_enabled && !welcomeImages.length) return setError('Para activar el cartel de bienvenida, subí al menos una imagen.');
    setSaving(true);
    const { error: err } = await supabase
      .from('app_settings')
      .update({
        cv_paid_enabled: cfg.cv_paid_enabled,
        cv_price: price,
        cv_mode: cfg.cv_mode,
        cv_days: days[0],
        job_days: days[1],
        service_days: days[2],
        contact_email: cfg.contact_email?.trim() || 'laburamosapp@gmail.com',
        instagram_url: cfg.instagram_url?.trim() || 'https://instagram.com/laburamosapp',
        legal_business_name: cfg.legal_business_name?.trim() || null,
        legal_cuit: cfg.legal_cuit?.trim() || null,
        legal_address: cfg.legal_address?.trim() || null,
        legal_email: cfg.legal_email?.trim() || cfg.contact_email?.trim() || 'laburamosapp@gmail.com',
        legal_last_update: cfg.legal_last_update || null,
        application_email_from: cfg.application_email_from?.trim() || 'laburamosapp@gmail.com',
        application_email_name: cfg.application_email_name?.trim() || 'LaburamosApp',
        welcome_enabled: !!cfg.welcome_enabled,
        welcome_images: welcomeImages,
        premium_enabled: cfg.premium_enabled,
        premium_price: premiumPrice,
        premium_days: days[3],
        premium_include_links: cfg.premium_include_links,
        premium_include_photos: cfg.premium_include_photos,
        free_links_limit: limits[0],
        premium_links_limit: limits[1],
        free_photos_limit: limits[2],
        premium_photos_limit: limits[3],
        ads_enabled: cfg.ads_enabled,
        ads_price_per_second: adsPrice,
        ads_price_image: adsPriceImage,
        ads_image_seconds: adsImageSeconds,
        ads_max_seconds: adsMax,
        ads_min_seconds: adsMin,
        ads_days: adsDays,
        ads_skip_seconds: adsSkip,
        ads_max_per_user: adsPerUser,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);
    if (err) setError(friendlyError(err.message));
    else {
      if (welcomeDelete.length) {
        void supabase.storage.from(WELCOME_BUCKET).remove(welcomeDelete);
        setWelcomeDelete([]);
      }
      notify('Configuración guardada');
      onSaved?.();
    }
  };

  if (!cfg) return <p className="count">Cargando…</p>;

  return (
    <form className="admin-card" onSubmit={save}>
      {error && <p className="note err">{error}</p>}

      <h2 className="block-title">Contacto</h2>
      <p className="lede">Correo donde llegan las sugerencias y denuncias del sitio.</p>
      <div className="field">
        <span>Correo de contacto</span>
        <input type="email" value={cfg.contact_email || ''} onChange={(e) => set({ contact_email: e.target.value })} />
      </div>

      <h2 className="block-title">Redes sociales</h2>
      <p className="lede">Links oficiales que se muestran en el pie de la app y en la pantalla de bienvenida.</p>
      <div className="field">
        <span>Instagram oficial</span>
        <input type="url" value={cfg.instagram_url || ''} onChange={(e) => set({ instagram_url: e.target.value })} placeholder="https://instagram.com/laburamosapp" />
        <small>Ejemplo: https://instagram.com/laburamosapp</small>
      </div>

      <h2 className="block-title">Datos legales</h2>
      <p className="lede">
        Se muestran en los Términos, la Política de Privacidad y la Política de Reembolsos. Completá razón social o nombre del
        responsable, CUIT y domicilio para que los documentos identifiquen al operador.
      </p>
      <div className="two">
        <label className="field">
          <span>Nombre o razón social</span>
          <input value={cfg.legal_business_name || ''} onChange={(e) => set({ legal_business_name: e.target.value })} placeholder="Ej: LaburamosApp" />
        </label>
        <label className="field">
          <span>CUIT</span>
          <input value={cfg.legal_cuit || ''} onChange={(e) => set({ legal_cuit: e.target.value })} placeholder="20-12345678-9" inputMode="numeric" />
        </label>
      </div>
      <label className="field">
        <span>Domicilio legal</span>
        <input value={cfg.legal_address || ''} onChange={(e) => set({ legal_address: e.target.value })} placeholder="Calle, número, localidad, provincia" />
      </label>
      <div className="two">
        <label className="field">
          <span>Correo legal</span>
          <input type="email" value={cfg.legal_email || ''} onChange={(e) => set({ legal_email: e.target.value })} placeholder="laburamosapp@gmail.com" />
        </label>
        <label className="field">
          <span>Última actualización de los documentos</span>
          <input type="date" value={cfg.legal_last_update || ''} onChange={(e) => set({ legal_last_update: e.target.value })} />
        </label>
      </div>

      <h2 className="block-title">Correo de postulaciones</h2>
      <p className="lede">
        Configuración del remitente cuando se envía una postulación por email. El correo se envía desde esta dirección (tu dominio verificado en Resend/SendGrid/Brevo) con Reply-To al postulante.
      </p>
      <div className="two">
        <label className="field">
          <span>Remitente (From)</span>
          <input type="email" value={cfg.application_email_from || ''} onChange={(e) => set({ application_email_from: e.target.value })} placeholder="laburamosapp@gmail.com" />
        </label>
        <label className="field">
          <span>Nombre visible (Display Name)</span>
          <input value={cfg.application_email_name || ''} onChange={(e) => set({ application_email_name: e.target.value })} placeholder="LaburamosApp" />
          <small>Se muestra como: "LaburamosApp - Juan Pérez" al empleador.</small>
        </label>
      </div>

      <h2 className="block-title">Cartel de bienvenida</h2>
      <p className="lede">
        Es lo primero que ve quien entra a la app. Ideal para novedades, promociones o publicidad. Podés subir una imagen o varias: si hay más de una, se van alternando solas y se ven completas, sin recortes. Cada persona lo cierra con la cruz y sigue navegando normalmente.
      </p>
      <label className="switch">
        <input className="sr" type="checkbox" checked={cfg.welcome_enabled} onChange={(e) => set({ welcome_enabled: e.target.checked })} />
        <span className="sw" aria-hidden="true" />
        <span>
          <b>Mostrar el cartel al entrar</b>
          <small>{cfg.welcome_enabled ? 'Se muestra una vez cada vez que se abre la app.' : 'El cartel está desactivado: no se muestra aunque haya imágenes cargadas.'}</small>
        </span>
      </label>
      <WelcomeImagesField
        value={cfg.welcome_images}
        onChange={(welcome_images) => set({ welcome_images })}
        onRemove={removeWelcomeImage}
      />

      <h2 className="block-title">Duración de las publicaciones</h2>
      <p className="lede">Se aplica a lo que se publique o renueve de ahora en adelante. Para cambiar una publicación puntual, editala en su pestaña.</p>
      <div className="two">
        <label className="field">
          <span>Avisos de empleo (días)</span>
          <input inputMode="numeric" value={cfg.job_days} onChange={(e) => set({ job_days: e.target.value.replace(/\D/g, '') })} />
        </label>
        <label className="field">
          <span>Servicios y pedidos (días)</span>
          <input inputMode="numeric" value={cfg.service_days} onChange={(e) => set({ service_days: e.target.value.replace(/\D/g, '') })} />
        </label>
      </div>

      <h2 className="block-title">Descarga del CV en PDF</h2>
      <label className="switch">
        <input className="sr" type="checkbox" checked={cfg.cv_paid_enabled} onChange={(e) => set({ cv_paid_enabled: e.target.checked })} />
        <span className="sw" aria-hidden="true" />
        <span>
          <b>Cobrar la descarga</b>
          <small>{cfg.cv_paid_enabled ? 'Para descargar el CV hay que pagar con Mercado Pago.' : 'Ahora la descarga es libre para todos.'}</small>
        </span>
      </label>
      <div className="two">
        <label className="field">
          <span>Precio (en pesos)</span>
          <input inputMode="decimal" value={cfg.cv_price} onChange={(e) => set({ cv_price: e.target.value.replace(/[^\d.,]/g, '') })} />
        </label>
        {cfg.cv_mode === 'por_dias' && (
          <label className="field">
            <span>Cantidad de días</span>
            <input inputMode="numeric" value={cfg.cv_days} onChange={(e) => set({ cv_days: e.target.value.replace(/\D/g, '') })} />
          </label>
        )}
      </div>
      <div className="field">
        <span>Qué compra la persona</span>
        <div className="tiles three">
          {Object.entries(MODES).map(([id, label]) => (
            <button key={id} type="button" className={`tile${cfg.cv_mode === id ? ' on' : ''}`} onClick={() => set({ cv_mode: id })} aria-pressed={cfg.cv_mode === id}>
              <b>{label}</b>
              <small>
                {id === 'por_descarga' && 'Cada PDF se paga. Puede repetir la descarga durante 24 horas.'}
                {id === 'por_dias' && `Descarga todas las veces que quiera durante ${cfg.cv_days || '…'} días.`}
                {id === 'para_siempre' && 'Paga una vez y descarga sin límite.'}
              </small>
            </button>
          ))}
        </div>
      </div>

      <h2 className="block-title">Premium por publicación</h2>
      <p className="lede">
        Permite sumar links y más fotos a un aviso. Por ahora se activa a mano desde “Avisos de empleo” o “Servicios”; el cobro con Mercado Pago queda para la próxima etapa.
      </p>
      <label className="switch">
        <input className="sr" type="checkbox" checked={cfg.premium_enabled} onChange={(e) => set({ premium_enabled: e.target.checked })} />
        <span className="sw" aria-hidden="true" />
        <span>
          <b>Ofrecer premium</b>
          <small>{cfg.premium_enabled ? 'El panel muestra la opción de activar premium en cada publicación.' : 'El premium está desactivado. Las publicaciones usan los límites gratis.'}</small>
        </span>
      </label>
      <div className="two">
        <label className="field">
          <span>Precio del premium (en pesos)</span>
          <input inputMode="decimal" value={cfg.premium_price} onChange={(e) => set({ premium_price: e.target.value.replace(/[^\d.,]/g, '') })} />
        </label>
        <label className="field">
          <span>Duración del premium (días)</span>
          <input inputMode="numeric" value={cfg.premium_days} onChange={(e) => set({ premium_days: e.target.value.replace(/\D/g, '') })} />
        </label>
      </div>

      <div className="premium-config">
        <label className="switch">
          <input className="sr" type="checkbox" checked={cfg.premium_include_links} onChange={(e) => set({ premium_include_links: e.target.checked })} />
          <span className="sw" aria-hidden="true" />
          <span>
            <b>Incluir links en el premium</b>
            <small>{cfg.premium_include_links ? 'Los links extra se desbloquean con el premium.' : 'Los links quedan disponibles para todos con el límite más alto.'}</small>
          </span>
        </label>
        <div className="two">
          <label className="field">
            <span>Links sin premium</span>
            <input inputMode="numeric" value={cfg.free_links_limit} onChange={(e) => set({ free_links_limit: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="field">
            <span>Links con premium</span>
            <input inputMode="numeric" value={cfg.premium_links_limit} onChange={(e) => set({ premium_links_limit: e.target.value.replace(/\D/g, '') })} />
          </label>
        </div>

        <label className="switch">
          <input className="sr" type="checkbox" checked={cfg.premium_include_photos} onChange={(e) => set({ premium_include_photos: e.target.checked })} />
          <span className="sw" aria-hidden="true" />
          <span>
            <b>Incluir fotos extra en el premium</b>
            <small>{cfg.premium_include_photos ? 'Las fotos extra se desbloquean con el premium.' : 'Las fotos quedan disponibles para todos con el límite más alto.'}</small>
          </span>
        </label>
        <div className="two">
          <label className="field">
            <span>Fotos sin premium</span>
            <input inputMode="numeric" value={cfg.free_photos_limit} onChange={(e) => set({ free_photos_limit: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="field">
            <span>Fotos con premium</span>
            <input inputMode="numeric" value={cfg.premium_photos_limit} onChange={(e) => set({ premium_photos_limit: e.target.value.replace(/\D/g, '') })} />
          </label>
        </div>
      </div>

      <h2 className="block-title">Anuncios</h2>
      <p className="lede">
        Los anuncios se muestran antes de publicar, postularse o contactar. Pueden ser videos cortos o imágenes. El cobro se acredita a mano desde la pestaña “Anuncios”.
      </p>
      <label className="switch">
        <input className="sr" type="checkbox" checked={cfg.ads_enabled} onChange={(e) => set({ ads_enabled: e.target.checked })} />
        <span className="sw" aria-hidden="true" />
        <span>
          <b>Mostrar anuncios</b>
          <small>{cfg.ads_enabled ? 'Los usuarios ven un anuncio antes de publicar, postularse o contactar.' : 'Los anuncios están desactivados: no se muestran ni se pueden crear nuevos.'}</small>
        </span>
      </label>

      <div className="ads-cfg-grid">
        <section className="ads-cfg-card">
          <h3>Precios</h3>
          <label className="field">
            <span>Video: precio por segundo ($)</span>
            <input inputMode="decimal" value={cfg.ads_price_per_second} onChange={(e) => set({ ads_price_per_second: e.target.value.replace(/[^\d.,]/g, '') })} />
          </label>
          <label className="field">
            <span>Imagen: precio fijo por campaña ($)</span>
            <input inputMode="decimal" value={cfg.ads_price_image} onChange={(e) => set({ ads_price_image: e.target.value.replace(/[^\d.,]/g, '') })} />
          </label>
          <label className="field">
            <span>Días de campaña</span>
            <input inputMode="numeric" value={cfg.ads_days} onChange={(e) => set({ ads_days: e.target.value.replace(/\D/g, '') })} />
          </label>
          <div className="ads-cfg-examples" aria-live="polite">
            <div>
              <small>Video de {cfg.ads_max_seconds || 0} s</small>
              <b>{money(Number(String(cfg.ads_price_per_second).replace(',', '.')) * Number(cfg.ads_max_seconds || 0))}</b>
            </div>
            <div>
              <small>Imagen</small>
              <b>{money(Number(String(cfg.ads_price_image).replace(',', '.')) || 0)}</b>
            </div>
          </div>
        </section>

        <section className="ads-cfg-card">
          <h3>Duración</h3>
          <label className="field">
            <span>Video: duración mínima (s)</span>
            <input inputMode="numeric" value={cfg.ads_min_seconds} onChange={(e) => set({ ads_min_seconds: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="field">
            <span>Video: duración máxima (s)</span>
            <input inputMode="numeric" value={cfg.ads_max_seconds} onChange={(e) => set({ ads_max_seconds: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="field">
            <span>Imagen: segundos en pantalla</span>
            <input inputMode="numeric" value={cfg.ads_image_seconds} onChange={(e) => set({ ads_image_seconds: e.target.value.replace(/\D/g, '') })} />
            <small>Tiempo que se ve la imagen antes de poder continuar.</small>
          </label>
        </section>

        <section className="ads-cfg-card">
          <h3>Reglas</h3>
          <label className="field">
            <span>Segundos para poder continuar</span>
            <input inputMode="numeric" value={cfg.ads_skip_seconds} onChange={(e) => set({ ads_skip_seconds: e.target.value.replace(/\D/g, '') })} />
            <small>Cuenta regresiva en videos, antes de habilitar “Continuar”.</small>
          </label>
          <label className="field">
            <span>Anuncios activos por usuario</span>
            <input inputMode="numeric" value={cfg.ads_max_per_user} onChange={(e) => set({ ads_max_per_user: e.target.value.replace(/\D/g, '') })} />
            <small>Cuenta los anuncios pendientes o aprobados que no vencieron.</small>
          </label>
        </section>
      </div>

      <button className="btn btn-ink btn-lg" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar configuración'}
      </button>
    </form>
  );
}

// ---------- avisos y servicios ----------
function ListingsTab({ kind, notify, settings }) {
  const isJob = kind === 'job';
  const table = isJob ? 'jobs' : 'services';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [editing, setEditing] = useState(null);
  const [premiumBusy, setPremiumBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from(table).select('*').order('created_at', { ascending: false }).limit(500);
    if (err) setError(friendlyError(err.message));
    setItems(data || []);
    setLoading(false);
  }, [table]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((i) => {
      const text = !t || [i.title, i.company_name, i.provider_name, i.description, i.location, i.city].some((v) => (v || '').toLowerCase().includes(t));
      return text && (!state || stateOf(i) === state);
    });
  }, [items, search, state]);

  const setStatus = async (item, status) => {
    const { error: err } = await supabase.rpc('admin_update_listing', { p_kind: kind, p_id: item.id, p: { status } });
    if (err) setError(friendlyError(err.message));
    else {
      notify(status === 'active' ? 'Publicación activada' : 'Publicación pausada');
      load();
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`¿Eliminar "${item.title}"? No se puede deshacer.`)) return;
    const { error: err } = await supabase.rpc('admin_delete_listing', { p_kind: kind, p_id: item.id });
    if (err) setError(friendlyError(err.message));
    else {
      notify('Publicación eliminada');
      load();
    }
  };

  const togglePremium = async (item) => {
    const enable = !isPremium(item);
    if (enable && !settings?.premium_enabled && !window.confirm('El premium está desactivado en Configuración. ¿Querés activarlo igual para esta publicación?')) return;
    setPremiumBusy(item.id);
    const { data, error: err } = await supabase.rpc('admin_set_listing_premium', { p_kind: kind, p_id: item.id, p_enabled: enable });
    setPremiumBusy(null);
    if (err) setError(friendlyError(err.message));
    else {
      notify(enable ? `Premium activo hasta el ${fmt(data)}` : 'Premium quitado');
      load();
    }
  };

  return (
    <>
      {error && <p className="note err">{error}</p>}
      <div className="admin-tools">
        <label className="search">
          <span className="sr">Buscar</span>
          <input type="search" placeholder="Buscá por título, nombre o localidad" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search size={22} aria-hidden="true" />
        </label>
        <select className="fbtn" value={state} onChange={(e) => setState(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(LISTING_STATUS)
            .filter(([id]) => isJob || id !== 'filled')
            .map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
        </select>
      </div>
      <p className="count">
        {filtered.length} de {items.length}
      </p>
      {loading ? (
        <p className="count">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Empty title="No hay publicaciones" text="Probá con otra búsqueda o sacá el filtro." />
      ) : (
        <div className="admin-table" role="table">
          <div className="admin-row list head" role="row">
            <span role="columnheader">Publicación</span>
            <span role="columnheader">Localidad</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader">Vence</span>
            <span role="columnheader">Acciones</span>
          </div>
          {filtered.map((i) => {
            const st = stateOf(i);
            return (
              <div className="admin-row list" role="row" key={i.id}>
                <span role="cell">
                  <b>
                    {!isJob && <span className={`kind-s ${i.intent === 'busca' ? 'busca' : ''}`}>{i.intent === 'busca' ? 'Busca' : 'Ofrece'}</span>}
                    {i.title}
                  </b>
                  <small>
                    {(isJob ? i.company_name : i.provider_name) || '—'} · {i.category}
                  </small>
                </span>
                <span role="cell">{(isJob ? i.location : i.city) || '—'}</span>
                <span role="cell">
                  <span className={`pill ${st}`}>{LISTING_STATUS[st]}</span>
                  {isPremium(i) && (
                    <span className="pill premium" title={`Premium hasta el ${fmt(i.premium_until)}`}>
                      <Crown size={11} aria-hidden="true" /> Premium
                    </span>
                  )}
                </span>
                <span role="cell">{fmt(i.expires_at)}</span>
                <span role="cell" className="admin-acts">
                  <button className="icon-sq" onClick={() => setEditing(i)} aria-label="Editar" title="Editar">
                    <Pencil size={16} />
                  </button>
                  <button
                    className={`icon-sq${isPremium(i) ? ' premium' : ''}`}
                    onClick={() => togglePremium(i)}
                    disabled={premiumBusy === i.id}
                    aria-label={isPremium(i) ? 'Quitar premium' : 'Activar premium'}
                    title={isPremium(i) ? `Quitar premium (vence el ${fmt(i.premium_until)})` : 'Activar premium'}
                  >
                    <Crown size={16} />
                  </button>
                  {i.status === 'active' ? (
                    <button className="icon-sq" onClick={() => setStatus(i, 'paused')} aria-label="Pausar" title="Pausar">
                      <Pause size={16} />
                    </button>
                  ) : (
                    <button className="icon-sq" onClick={() => setStatus(i, 'active')} aria-label="Activar" title="Activar">
                      <Play size={16} />
                    </button>
                  )}
                  <button className="icon-sq danger" onClick={() => remove(i)} aria-label="Eliminar" title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <EditListing
          kind={kind}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify('Cambios guardados');
            load();
          }}
        />
      )}
    </>
  );
}

// ---------- CVs ----------
function ResumesTab({ notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from('resumes').select('*').order('updated_at', { ascending: false }).limit(500);
    if (err) setError(friendlyError(err.message));
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((r) => !t || [r.full_name, r.profession, r.city].some((v) => (v || '').toLowerCase().includes(t)));
  }, [items, search]);

  const remove = async (r) => {
    if (!window.confirm(`¿Eliminar el CV de ${r.full_name}? No se puede deshacer.`)) return;
    const { error: err } = await supabase.rpc('admin_delete_resume', { p_user: r.user_id });
    if (err) setError(friendlyError(err.message));
    else {
      notify('CV eliminado');
      load();
    }
  };

  return (
    <>
      {error && <p className="note err">{error}</p>}
      <div className="admin-tools">
        <label className="search">
          <span className="sr">Buscar CVs</span>
          <input type="search" placeholder="Buscá por nombre, oficio o localidad" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search size={22} aria-hidden="true" />
        </label>
      </div>
      <p className="count">
        {filtered.length} de {items.length}
      </p>
      {loading ? (
        <p className="count">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Empty title="No hay CVs" text="Cuando alguien guarde su CV, va a aparecer acá." />
      ) : (
        <div className="admin-table" role="table">
          {filtered.map((r) => (
            <div className="admin-row list cvs" role="row" key={r.user_id}>
              <span role="cell">
                <b>{r.full_name}</b>
                <small>{r.profession}</small>
              </span>
              <span role="cell">{r.city || '—'}</span>
              <span role="cell">Actualizado {fmt(r.updated_at)}</span>
              <span role="cell" className="admin-acts">
                <button className="icon-sq" onClick={() => setOpen(r)} aria-label="Ver CV" title="Ver CV">
                  <FileText size={16} />
                </button>
                <button className="icon-sq danger" onClick={() => remove(r)} aria-label="Eliminar CV" title="Eliminar CV">
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      {open && <CvModal resume={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// ---------- pagos ----------
function PaymentsTab() {
  const [purchases, setPurchases] = useState(null);
  useEffect(() => {
    supabase
      .from('cv_purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setPurchases(data || []));
  }, []);
  if (!purchases) return <p className="count">Cargando…</p>;
  const approved = purchases.filter((p) => p.status === 'approved');
  const total = approved.reduce((acc, p) => acc + Number(p.amount), 0);
  return (
    <>
      <p className="count">
        {approved.length} aprobados · {money(total)} cobrados (de los últimos {purchases.length})
      </p>
      {purchases.length === 0 ? (
        <Empty title="Todavía no hay pagos" text="Cuando alguien pague la descarga de su CV, va a aparecer acá." />
      ) : (
        <div className="admin-table" role="table" aria-label="Últimos pagos">
          <div className="admin-row head" role="row">
            <span role="columnheader">Fecha</span>
            <span role="columnheader">Monto</span>
            <span role="columnheader">Modalidad</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader">Usuario</span>
          </div>
          {purchases.map((p) => (
            <div className="admin-row" role="row" key={p.id}>
              <span role="cell">{new Date(p.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span role="cell">{money(p.amount)}</span>
              <span role="cell">
                {MODES[p.mode]}
                {p.mode === 'por_dias' && p.days ? ` (${p.days})` : ''}
              </span>
              <span role="cell">
                <span className={`pill ${p.status === 'approved' ? 'active' : p.status === 'pending' ? 'paused' : 'expired'}`}>{STATUS[p.status]}</span>
              </span>
              <span role="cell" className="mono">
                {p.user_id.slice(0, 8)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Panel del administrador: control de la configuración y de todo el contenido de la app
function ReportsTab({ notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('reports')
      .select('id, type, job_id, message, status, created_at, jobs(title)')
      .order('created_at', { ascending: false });
    if (err) setError(friendlyError(err.message));
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const setStatus = async (id, status) => {
    const { error: err } = await supabase.from('reports').update({ status }).eq('id', id);
    if (err) notify(friendlyError(err.message));
    else {
      notify('Estado actualizado');
      load();
    }
  };
  if (loading) return <p className="count">Cargando…</p>;
  if (error) return <p className="note err">{error}</p>;
  if (rows.length === 0) return <p className="count">Todavía no hay sugerencias ni denuncias.</p>;
  return (
    <div className="admin-card">
      {rows.map((r) => (
        <div key={r.id} className="admin-row" style={{ gridTemplateColumns: '1fr' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="pill">{r.type === 'denuncia' ? 'Denuncia' : 'Sugerencia'}</span>
              <span className="pill">{r.status}</span>
              <small className="cv-hint">{new Date(r.created_at).toLocaleString('es-AR')}</small>
            </div>
            {r.jobs?.title && <p style={{ margin: '6px 0 4px' }}><b>{r.jobs.title}</b></p>}
            <p style={{ margin: '4px 0 8px', whiteSpace: 'pre-wrap' }}>{r.message}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {r.status !== 'enviada' && <button type="button" className="btn btn-line btn-xs" onClick={() => setStatus(r.id, 'enviada')}>Marcar enviada</button>}
              {r.status !== 'cerrada' && <button type="button" className="btn btn-ink btn-xs" onClick={() => setStatus(r.id, 'cerrada')}>Cerrar</button>}
              {r.status !== 'nueva' && <button type="button" className="btn btn-line btn-xs" onClick={() => setStatus(r.id, 'nueva')}>Reabrir</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- anuncios en video ----------
const AD_REVIEW = { pending: 'En revisión', approved: 'Aprobado', rejected: 'Rechazado' };
const AD_PAY = { pending: 'Sin pago', paid: 'Pagado' };
const AD_PILL = { pending: 'pending', approved: 'active', rejected: 'expired' };
const isLiveAd = (ad) =>
  ad.review_status === 'approved' &&
  ad.payment_status === 'paid' &&
  ad.active &&
  (!ad.ends_at || new Date(ad.ends_at) > new Date());

function AdEditor({ ad, onClose, onSaved, notify }) {
  const [form, setForm] = useState({
    title: ad.title || '',
    advertiser_name: ad.advertiser_name || '',
    target_url: ad.target_url || '',
    ends_at: ad.ends_at ? ad.ends_at.slice(0, 10) : '',
    active: !!ad.active,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const title = form.title.trim();
    if (title.length < 3) return setError('El título tiene que tener al menos 3 caracteres.');
    const target = form.target_url.trim();
    if (target && !/^https?:\/\/[^\s]+$/i.test(target)) return setError('El link tiene que empezar con http:// o https://.');
    setBusy(true);
    const { error: err } = await supabase.rpc('admin_update_ad_campaign', {
      p_id: ad.id,
      p: {
        title,
        advertiser_name: form.advertiser_name.trim() || null,
        target_url: target || null,
        ends_at: form.ends_at ? new Date(`${form.ends_at}T23:59:59`).toISOString() : null,
        active: !!form.active,
      },
    });
    setBusy(false);
    if (err) setError(friendlyError(err.message));
    else {
      notify('Anuncio actualizado');
      onSaved?.();
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Editar anuncio">
      <form className="fsheet ad-editor" onSubmit={save}>
        <div className="ads-form-head">
          <h2 className="block-title">Editar anuncio</h2>
          <button type="button" className="ad-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {error && <p className="note err">{error}</p>}
        <label className="field">
          <span>Título</span>
          <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label className="field">
          <span>Anunciante</span>
          <input value={form.advertiser_name} maxLength={120} onChange={(e) => setForm({ ...form, advertiser_name: e.target.value })} />
        </label>
        <label className="field">
          <span>Link de destino</span>
          <input type="url" value={form.target_url} maxLength={500} onChange={(e) => setForm({ ...form, target_url: e.target.value })} placeholder="https://..." />
        </label>
        <label className="field">
          <span>Vence el</span>
          <input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          <small>Dejalo vacío para que no tenga vencimiento propio.</small>
        </label>
        <label className="switch">
          <input className="sr" type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <span className="sw" aria-hidden="true" />
          <span>
            <b>Anuncio activo</b>
            <small>{form.active ? 'Puede mostrarse si está aprobado y pago.' : 'No se muestra aunque esté aprobado y pago.'}</small>
          </span>
        </label>
        <div className="ads-editor-acts">
          <button type="button" className="btn btn-line" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-ink" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AdsTab({ notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from('ad_campaigns').select('*').order('created_at', { ascending: false }).limit(500);
    if (err) setError(friendlyError(err.message));
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((ad) => {
      const text = !term || [ad.title, ad.advertiser_name, ad.user_id].some((v) => (v || '').toLowerCase().includes(term));
      if (!text) return false;
      if (filter === 'pending_review') return ad.review_status === 'pending';
      if (filter === 'pending_payment') return ad.review_status === 'approved' && ad.payment_status !== 'paid';
      if (filter === 'live') return isLiveAd(ad);
      if (filter === 'rejected') return ad.review_status === 'rejected';
      return true;
    });
  }, [items, search, filter]);

  const pendingReview = items.filter((ad) => ad.review_status === 'pending').length;
  const pendingPayment = items.filter((ad) => ad.review_status === 'approved' && ad.payment_status !== 'paid').length;
  const live = items.filter(isLiveAd).length;

  const review = async (ad, status) => {
    let note = null;
    if (status === 'rejected') {
      note = window.prompt('Motivo del rechazo (se le muestra al anunciante):', ad.review_note || '');
      if (note === null) return;
    }
    setBusy(ad.id);
    const { error: err } = await supabase.rpc('admin_review_ad_campaign', { p_id: ad.id, p_status: status, p_note: note });
    setBusy(null);
    if (err) setError(friendlyError(err.message));
    else {
      notify(status === 'approved' ? 'Anuncio aprobado' : status === 'rejected' ? 'Anuncio rechazado' : 'Anuncio pendiente');
      load();
    }
  };

  const setPaid = async (ad, paid) => {
    setBusy(ad.id);
    const { error: err } = await supabase.rpc('admin_set_ad_payment', { p_id: ad.id, p_paid: paid });
    setBusy(null);
    if (err) setError(friendlyError(err.message));
    else {
      notify(paid ? 'Pago acreditado' : 'Pago quitado');
      load();
    }
  };

  const toggleActive = async (ad) => {
    setBusy(ad.id);
    const { error: err } = await supabase.rpc('admin_update_ad_campaign', { p_id: ad.id, p: { active: !ad.active } });
    setBusy(null);
    if (err) setError(friendlyError(err.message));
    else {
      notify(ad.active ? 'Anuncio pausado' : 'Anuncio activado');
      load();
    }
  };

  const remove = async (ad) => {
    if (!window.confirm(`¿Eliminar el anuncio "${ad.title}"? Se borra también el video.`)) return;
    setBusy(ad.id);
    const { data: files, error: err } = await supabase.rpc('admin_delete_ad_campaign', { p_id: ad.id });
    setBusy(null);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    // Borra el archivo del bucket que corresponde (video o imagen)
    if (files?.video_path) await supabase.storage.from(AD_VIDEO_BUCKET).remove([files.video_path]);
    if (files?.image_path) await supabase.storage.from(AD_IMAGE_BUCKET).remove([files.image_path]);
    notify('Anuncio eliminado');
    load();
  };

  return (
    <>
      {error && <p className="note err">{error}</p>}
      <div className="admin-tools">
        <label className="search">
          <span className="sr">Buscar anuncios</span>
          <input type="search" placeholder="Buscá por título, anunciante o usuario" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search size={22} aria-hidden="true" />
        </label>
        <select className="fbtn" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar anuncios">
          <option value="">Todos los anuncios</option>
          <option value="pending_review">En revisión ({pendingReview})</option>
          <option value="pending_payment">Aprobados sin pago ({pendingPayment})</option>
          <option value="live">Mostrándose ({live})</option>
          <option value="rejected">Rechazados</option>
        </select>
      </div>
      <p className="count">
        {filtered.length} de {items.length} · {pendingReview} por revisar · {pendingPayment} sin pago · {live} mostrándose
      </p>

      {loading ? (
        <p className="count">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Empty title="No hay anuncios" text="Cuando alguien envíe un video o una imagen, va a aparecer acá para revisarlo." />
      ) : (
        <div className="admin-ads">
          {filtered.map((ad) => (
            <article className="admin-ad" key={ad.id}>
              {ad.media_type === 'image' ? (
                <img className="admin-ad-video admin-ad-img" src={adImageUrl(ad.image_path)} alt={ad.title} />
              ) : (
                <video className="admin-ad-video" src={adVideoUrl(ad.video_path)} controls playsInline preload="metadata" />
              )}
              <div className="admin-ad-body">
                <div className="admin-ad-head">
                  <b>{ad.title}</b>
                  <span className={`pill ${AD_PILL[ad.review_status] || 'paused'}`}>{AD_REVIEW[ad.review_status] || ad.review_status}</span>
                  <span className={`pill ${ad.payment_status === 'paid' ? 'active' : 'paused'}`}>{AD_PAY[ad.payment_status] || ad.payment_status}</span>
                  {!ad.active && <span className="pill paused">Pausado</span>}
                  {isLiveAd(ad) && <span className="pill active">Mostrándose</span>}
                </div>
                <p className="admin-ad-meta">
                  {ad.advertiser_name || 'Sin anunciante'} · Usuario {String(ad.user_id).slice(0, 8)} ·{' '}
                  {Number(ad.duration_seconds || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s · <b>{money(ad.amount)}</b>
                </p>
                <p className="admin-ad-meta">
                  Creado {fmt(ad.created_at)} · {ad.ends_at ? `Vence ${fmt(ad.ends_at)}` : 'Sin vencimiento'}
                  {ad.paid_at ? ` · Pagado ${fmt(ad.paid_at)}` : ''}
                </p>
                {ad.target_url && (
                  <a className="admin-ad-link" href={ad.target_url} target="_blank" rel="noreferrer noopener">
                    <ExternalLink size={14} aria-hidden="true" /> {ad.target_url}
                  </a>
                )}
                {ad.review_note && <p className="note err">{ad.review_note}</p>}
                <div className="admin-ad-acts">
                  {ad.review_status !== 'approved' && (
                    <button type="button" className="btn btn-success btn-xs" disabled={busy === ad.id} onClick={() => review(ad, 'approved')}>
                      <CheckCircle2 size={14} aria-hidden="true" /> Aprobar
                    </button>
                  )}
                  {ad.review_status !== 'rejected' && (
                    <button type="button" className="btn btn-danger btn-xs" disabled={busy === ad.id} onClick={() => review(ad, 'rejected')}>
                      Rechazar
                    </button>
                  )}
                  {ad.payment_status !== 'paid' ? (
                    <button type="button" className="btn btn-ink btn-xs" disabled={busy === ad.id} onClick={() => setPaid(ad, true)}>
                      <CircleDollarSign size={14} aria-hidden="true" /> Acreditar pago
                    </button>
                  ) : (
                    <button type="button" className="btn btn-line btn-xs" disabled={busy === ad.id} onClick={() => setPaid(ad, false)}>
                      Quitar pago
                    </button>
                  )}
                  <button type="button" className="btn btn-line btn-xs" disabled={busy === ad.id} onClick={() => toggleActive(ad)}>
                    {ad.active ? <><Pause size={14} aria-hidden="true" /> Pausar</> : <><Play size={14} aria-hidden="true" /> Activar</>}
                  </button>
                  <button type="button" className="btn btn-line btn-xs" onClick={() => setEditing(ad)}>
                    <Pencil size={14} aria-hidden="true" /> Editar
                  </button>
                  <button type="button" className="btn btn-danger btn-xs" disabled={busy === ad.id} onClick={() => remove(ad)}>
                    <Trash2 size={14} aria-hidden="true" /> Eliminar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <AdEditor
          ad={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          notify={notify}
        />
      )}
    </>
  );
}

export default function Admin({ notify, onSettingsSaved, currentUser, settings }) {
  const [tab, setTab] = useState('users');
  return (
    <section className="wrap page admin-page">
      <header className={tab === 'users' ? 'sr' : 'page-head admin-page-head'}>
        <div>
          <h1 className="page-title">Administración</h1>
          <p className="lede">Configurá duraciones y precios, y revisá, editá o eliminá cualquier publicación o CV de la app.</p>
        </div>
      </header>
      <nav className="admin-tabs" aria-label="Secciones de Administración">
        {TABS.map((t) => (
          <button type="button" key={t.id} aria-pressed={tab === t.id} aria-controls="admin-tab-content" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div id="admin-tab-content">
      {tab === 'config' && <SettingsTab notify={notify} onSaved={onSettingsSaved} />}
      {tab === 'jobs' && <ListingsTab key="jobs" kind="job" notify={notify} settings={settings} />}
      {tab === 'services' && <ListingsTab key="services" kind="service" notify={notify} settings={settings} />}
      {tab === 'ads' && <AdsTab notify={notify} />}
      {tab === 'cvs' && <ResumesTab notify={notify} />}
      {tab === 'users' && <UsersPanel notify={notify} currentUser={currentUser} />}
      {tab === 'pagos' && <PaymentsTab />}
      {tab === 'recibidos' && <ReportsTab notify={notify} />}
      </div>
    </section>
  );
}
