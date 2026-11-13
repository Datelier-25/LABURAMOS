import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock3, Eye, EyeOff, ImageIcon, Plus, ShieldCheck, Trash2, Video, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { friendlyError, money } from '../lib/utils';
import {
  AD_IMAGE_BUCKET,
  AD_VIDEO_BUCKET,
  adConfig,
  adImageExtension,
  adImageUrl,
  adPrice,
  adPriceImage,
  adVideoExtension,
  adVideoUrl,
  fetchMyAdStats,
  probeImage,
  probeVideo,
  validateAdDuration,
  validateAdFile,
  validateAdImageFile,
} from '../lib/ads';
import { Empty } from './ui';
import LegalConsent from './LegalConsent';
import { consentReady, recordLegalConsent } from '../lib/legal';

const REVIEW = { pending: 'En revisión', approved: 'Aprobado', rejected: 'Rechazado' };
const PAYMENT = { pending: 'Pago pendiente', paid: 'Pago acreditado' };
// Estados: pendiente = ámbar (espera algo), aprobado/pagado = verde, rechazado = rojo
const REVIEW_CLASS = { pending: 'pending', approved: 'active', rejected: 'expired' };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const secs = (n) => `${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s`;
const isImage = (ad) => ad?.media_type === 'image';

function statusNote(ad) {
  if (ad.review_status === 'rejected') return 'El anuncio no fue aprobado.';
  if (ad.review_status === 'pending') return `Estamos revisando ${isImage(ad) ? 'la imagen' : 'el video'}. Te avisamos cuando esté aprobado.`;
  if (ad.payment_status !== 'paid') return 'Está aprobado. Falta acreditar el pago para que empiece a mostrarse.';
  if (ad.paused_by_user) return 'Ocultaste este anuncio. No se está mostrando hasta que toques “Mostrar”.';
  if (!ad.active) return 'El administrador pausó este anuncio.';
  if (ad.ends_at && new Date(ad.ends_at) < new Date()) return 'La campaña venció. Podés crear un anuncio nuevo.';
  return ad.ends_at ? `Se está mostrando hasta el ${fmtDate(ad.ends_at)}.` : 'Se está mostrando en la app.';
}

export default function MyAds({ user, settings, notify }) {
  const cfg = adConfig(settings);
  const [ads, setAds] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('video'); // 'video' | 'image'
  const [form, setForm] = useState({ title: '', advertiser_name: '', target_url: '' });
  const [file, setFile] = useState(null);
  const [video, setVideo] = useState(null);
  const [image, setImage] = useState(null); // { file, url, width, height }
  const [fileError, setFileError] = useState('');
  const [probing, setProbing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [acting, setActing] = useState(''); // id de la campaña que se está ocultando o eliminando
  const [consent, setConsent] = useState({ terms: false, privacy: false });
  const fileRef = useRef(null);
  const previewUrl = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('ad_campaigns')
      .select('*')
      .eq('user_id', user.id)
      .eq('hidden_by_user', false)
      .order('created_at', { ascending: false });
    if (err) setError(friendlyError(err.message));
    setAds(data || []);
    setStats(await fetchMyAdStats());
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    []
  );

  const clearMedia = () => {
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = '';
    }
    if (image?.url) URL.revokeObjectURL(image.url);
    setFile(null);
    setVideo(null);
    setImage(null);
    setFileError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const resetForm = () => {
    clearMedia();
    setKind('video');
    setForm({ title: '', advertiser_name: '', target_url: '' });
    setProbing(false);
  };

  const changeKind = (next) => {
    if (next === kind) return;
    clearMedia();
    setKind(next);
  };

  const onFile = async (e) => {
    const picked = e.target.files?.[0];
    setFileError('');
    setResult(null);
    if (!picked) return;
    const fileMsg = validateAdFile(picked);
    if (fileMsg) {
      clearMedia();
      setFileError(fileMsg);
      return;
    }
    setProbing(true);
    try {
      const info = await probeVideo(picked);
      // La base guarda la duración con dos decimales y calcula el precio con
      // ese valor; redondeamos acá para que la vista previa coincida.
      const duration = Math.round(info.duration * 100) / 100;
      const durationMsg = validateAdDuration(duration, settings);
      if (durationMsg) {
        clearMedia();
        setFileError(durationMsg);
      } else {
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = URL.createObjectURL(picked);
        setFile(picked);
        setVideo({ ...info, duration, url: previewUrl.current });
      }
    } catch {
      clearMedia();
      setFileError('No pudimos leer el video. Probá con un archivo MP4, WebM o MOV.');
    }
    setProbing(false);
  };

  const onImage = async (e) => {
    const picked = e.target.files?.[0];
    setFileError('');
    setResult(null);
    if (!picked) return;
    const msg = validateAdImageFile(picked);
    if (msg) {
      clearMedia();
      setFileError(msg);
      return;
    }
    setProbing(true);
    try {
      const info = await probeImage(picked);
      if (info.width < 600 || info.height < 600) {
        URL.revokeObjectURL(info.url);
        clearMedia();
        setFileError('La imagen es muy chica. Usá una de al menos 600 × 600 píxeles.');
      } else {
        setFile(picked);
        setImage({ file: picked, url: info.url, width: info.width, height: info.height });
      }
    } catch {
      clearMedia();
      setFileError('No pudimos leer la imagen. Probá con un JPG, PNG o WebP.');
    }
    setProbing(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setFileError('');
    const hasMedia = kind === 'video' ? !!(file && video) : !!(file && image);
    if (!hasMedia) {
      setFileError(kind === 'video' ? 'Elegí un video válido antes de enviar.' : 'Elegí una imagen válida antes de enviar.');
      return;
    }
    const title = form.title.trim();
    if (title.length < 3) {
      setError('Poné un título de al menos 3 caracteres.');
      return;
    }
    const target = form.target_url.trim();
    if (target && !/^https?:\/\/[^\s]+$/i.test(target)) {
      setError('El link tiene que empezar con http:// o https://.');
      return;
    }
    if (!consentReady(consent)) {
      setError('Para enviar el anuncio, aceptá los Términos y la Política de Privacidad.');
      return;
    }

    setBusy(true);
    const isVid = kind === 'video';
    const bucket = isVid ? AD_VIDEO_BUCKET : AD_IMAGE_BUCKET;
    const ext = isVid ? adVideoExtension(file) : adImageExtension(file);
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) {
      setBusy(false);
      setError(friendlyError(upErr.message));
      return;
    }

    const common = {
      p_title: title,
      p_advertiser_name: form.advertiser_name.trim() || null,
      p_target_url: target || null,
    };
    const { data, error: rpcErr } = isVid
      ? await supabase.rpc('submit_ad_campaign', {
          ...common,
          p_video_path: path,
          p_duration_seconds: Math.round(video.duration * 100) / 100,
          p_video_mime: file.type,
          p_video_size: file.size,
        })
      : await supabase.rpc('submit_ad_image_campaign', {
          ...common,
          p_image_path: path,
          p_image_mime: file.type,
          p_image_size: file.size,
        });
    if (rpcErr) {
      // Si la base rechaza el anuncio, no dejamos el archivo huérfano en el bucket.
      await supabase.storage.from(bucket).remove([path]);
      setBusy(false);
      setError(friendlyError(rpcErr.message));
      return;
    }

    setBusy(false);
    void recordLegalConsent('anuncio');
    setOpen(false);
    resetForm();
    setResult(
      data || (isVid
        ? { amount: adPrice(video.duration, settings), duration_seconds: video.duration, media_type: 'video' }
        : { amount: cfg.priceImage, duration_seconds: cfg.imageSeconds, media_type: 'image' })
    );
    notify('Anuncio enviado: queda pendiente de revisión');
    load();
  };

  const togglePause = async (ad) => {
    setError('');
    setActing(ad.id);
    const { error: err } = await supabase.rpc('set_my_ad_paused', { p_id: ad.id, p_paused: !ad.paused_by_user });
    setActing('');
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    notify(ad.paused_by_user ? 'Anuncio visible de nuevo' : 'Anuncio oculto');
    load();
  };

  const remove = async (ad) => {
    // Las campañas pagas se dan de baja sin borrar el registro del pago.
    if (ad.payment_status === 'paid') {
      if (!window.confirm(`¿Eliminar el anuncio "${ad.title}" de tu lista?\n\nDeja de mostrarse y no lo vas a ver más. El registro del pago queda guardado.`)) return;
      setActing(ad.id);
      const { error: err } = await supabase.rpc('hide_my_ad', { p_id: ad.id });
      setActing('');
      if (err) {
        setError(friendlyError(err.message));
        return;
      }
      notify('Anuncio eliminado de tu lista');
      load();
      return;
    }

    if (!window.confirm(`¿Eliminar el anuncio "${ad.title}"? No se puede deshacer.`)) return;
    setActing(ad.id);
    const { error: err } = await supabase.from('ad_campaigns').delete().eq('id', ad.id);
    if (err) {
      setActing('');
      setError(friendlyError(err.message));
      return;
    }
    if (isImage(ad)) await supabase.storage.from(AD_IMAGE_BUCKET).remove([ad.image_path]);
    else await supabase.storage.from(AD_VIDEO_BUCKET).remove([ad.video_path]);
    setActing('');
    notify('Anuncio eliminado');
    load();
  };

  const price = kind === 'video' && video ? adPrice(video.duration, settings) : kind === 'image' ? cfg.priceImage : null;

  return (
    <section className="wrap page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Mis anuncios</h1>
          <p className="lede">
            Mostrá tu comercio en la app: con un video corto o con una imagen. Se muestran antes de publicar, postularse o contactar a un servicio.
          </p>
        </div>
        {cfg.enabled && (
          <button type="button" className="btn btn-ink" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus size={18} aria-hidden="true" /> Crear anuncio
          </button>
        )}
      </header>

      {error && <p className="note err">{error}</p>}

      {result && (
        <div className="note ok ads-result">
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>
            <b>Anuncio enviado.</b> Queda pendiente de revisión. Precio: {money(result.amount)}
            {result.media_type === 'image' ? ` (campaña de imagen, se muestra ${secs(result.duration_seconds)})` : ` por ${secs(result.duration_seconds)} de video`}.
            Cuando el administrador apruebe el anuncio y acredite el pago, empieza a mostrarse.
          </span>
          <button type="button" className="btn btn-line btn-sm" onClick={() => setResult(null)}>
            Cerrar
          </button>
        </div>
      )}

      {!cfg.enabled && (
        <p className="note">
          Los anuncios están desactivados por el administrador. Podés seguir viendo tus campañas, pero no crear nuevas por ahora.
        </p>
      )}

      <div className="ads-how">
        <div>
          <Video size={20} aria-hidden="true" />
          <b>1. Elegí el formato</b>
          <small>
            Video de {cfg.min} a {cfg.max} segundos (MP4, WebM o MOV, hasta 50 MB) o una imagen JPG, PNG o WebP de hasta 5 MB.
          </small>
        </div>
        <div>
          <ShieldCheck size={20} aria-hidden="true" />
          <b>2. Lo revisamos</b>
          <small>El administrador aprueba el contenido antes de que se publique.</small>
        </div>
        <div>
          <CircleDollarSign size={20} aria-hidden="true" />
          <b>3. Acreditás el pago</b>
          <small>
            Video: {money(cfg.price)} por segundo. Imagen: {money(cfg.priceImage)} por campaña. Duran {cfg.days} días desde que quedan pagas.
          </small>
        </div>
      </div>

      {open && cfg.enabled && (
        <form className="admin-card ads-form" onSubmit={submit}>
          <div className="ads-form-head">
            <div>
              <h2 className="block-title">Nuevo anuncio</h2>
              <p className="lede">Se muestra en forma aleatoria antes de publicar, postularse o contactar.</p>
            </div>
            <button type="button" className="ad-close" onClick={() => { setOpen(false); resetForm(); }} aria-label="Cerrar formulario">
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="seg ads-kind" role="group" aria-label="Formato del anuncio">
            <button type="button" className={kind === 'video' ? 'on' : ''} aria-pressed={kind === 'video'} onClick={() => changeKind('video')}>
              <Video size={16} aria-hidden="true" /> Video
            </button>
            <button type="button" className={kind === 'image' ? 'on' : ''} aria-pressed={kind === 'image'} onClick={() => changeKind('image')}>
              <ImageIcon size={16} aria-hidden="true" /> Imagen
            </button>
          </div>

          {fileError && <p className="note err">{fileError}</p>}

          {kind === 'video' ? (
            <label className="field">
              <span>Video del anuncio</span>
              <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onFile} />
              <small>Duración permitida: entre {cfg.min} y {cfg.max} segundos. Tamaño máximo: 50 MB.</small>
            </label>
          ) : (
            <label className="field">
              <span>Imagen del anuncio</span>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onImage} />
              <small>Horizontal o vertical, al menos 600 × 600 píxeles. Se muestra {cfg.imageSeconds} segundos. Tamaño máximo: 5 MB.</small>
            </label>
          )}

          {probing && <p className="count">{kind === 'video' ? 'Leyendo el video…' : 'Leyendo la imagen…'}</p>}

          {kind === 'video' && video && (
            <div className="ads-preview-wrap">
              <video className="ads-preview" src={video.url} controls playsInline preload="metadata" />
              <div className="ads-preview-meta">
                <span className="chip-s">
                  <Clock3 size={14} aria-hidden="true" /> {secs(video.duration)}
                </span>
                <span className="chip-s">
                  <CircleDollarSign size={14} aria-hidden="true" /> {money(adPrice(video.duration, settings))}
                </span>
                <small>
                  {money(cfg.price)} por segundo · {cfg.days} días de campaña
                </small>
              </div>
            </div>
          )}

          {kind === 'image' && image && (
            <div className="ads-preview-wrap">
              <img className="ads-preview ads-preview-img" src={image.url} alt="Vista previa de la imagen del anuncio" />
              <div className="ads-preview-meta">
                <span className="chip-s">
                  <Clock3 size={14} aria-hidden="true" /> {cfg.imageSeconds} s en pantalla
                </span>
                <span className="chip-s">
                  <CircleDollarSign size={14} aria-hidden="true" /> {money(cfg.priceImage)}
                </span>
                <small>
                  {image.width} × {image.height} px · {cfg.days} días de campaña
                </small>
              </div>
            </div>
          )}

          <div className="two">
            <label className="field">
              <span>Título del anuncio</span>
              <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Tu comercio en video" />
            </label>
            <label className="field">
              <span>Nombre del anunciante (opcional)</span>
              <input value={form.advertiser_name} maxLength={120} onChange={(e) => setForm({ ...form, advertiser_name: e.target.value })} placeholder="Ej: Comercio El Sol" />
            </label>
          </div>

          <label className="field">
            <span>Link de destino (opcional)</span>
            <input type="url" value={form.target_url} maxLength={500} onChange={(e) => setForm({ ...form, target_url: e.target.value })} placeholder="https://..." />
            <small>Se muestra como “Conocer más” durante el anuncio.</small>
          </label>

          <p className="ads-price">
            <CircleDollarSign size={18} aria-hidden="true" />
            {price !== null && (file ? (
              <span>
                Total a abonar: <b>{money(price)}</b>
                {kind === 'video' && video ? ` (${secs(video.duration)} × ${money(cfg.price)})` : ' (precio fijo de la campaña de imagen)'}
              </span>
            ) : (
              <span>
                {kind === 'video'
                  ? `El precio se calcula con la duración real del video: ${money(cfg.price)} por segundo.`
                  : `Campaña de imagen: ${money(adPriceImage(settings))} de precio fijo.`}
              </span>
            ))}
          </p>

          <p className="sheet-note">
            Subí solo imágenes o videos propios o con permiso de las personas que aparecen. El anunciante es responsable del contenido y
            de los derechos de imagen.
          </p>

          <LegalConsent value={consent} onChange={setConsent} compact />

          <button className="btn btn-ink btn-lg" disabled={busy || probing || !file}>
            {busy ? 'Subiendo…' : 'Enviar para revisión'}
          </button>
        </form>
      )}

      <h2 className="block-title">Tus campañas</h2>
      {loading ? (
        <p className="count">Cargando…</p>
      ) : ads.length === 0 ? (
        <Empty title="No tenés anuncios en tu lista" text="Subí un video corto o una imagen y mostrala a quienes usan LaburamosApp.">
          {cfg.enabled && (
            <button type="button" className="btn btn-ink" onClick={() => { resetForm(); setOpen(true); }}>
              <Plus size={18} aria-hidden="true" /> Crear anuncio
            </button>
          )}
        </Empty>
      ) : (
        <div className="ads-list">
          {ads.map((ad) => (
            <article className="ad-card" key={ad.id}>
              {isImage(ad) ? (
                <img className="ad-card-video ad-card-img" src={adImageUrl(ad.image_path)} alt={ad.title} />
              ) : (
                <video className="ad-card-video" src={adVideoUrl(ad.video_path)} controls playsInline preload="metadata" />
              )}
              <div className="ad-card-body">
                <div className="ad-card-head">
                  <h3>{ad.title}</h3>
                  <span className="chip-s">{isImage(ad) ? 'Imagen' : 'Video'}</span>
                  <span className={`pill ${REVIEW_CLASS[ad.review_status] || 'paused'}`}>{REVIEW[ad.review_status] || ad.review_status}</span>
                  <span className={`pill ${ad.payment_status === 'paid' ? 'active' : 'pending'}`}>{PAYMENT[ad.payment_status] || ad.payment_status}</span>
                  {ad.paused_by_user && <span className="pill paused">Oculto</span>}
                  {!ad.active && <span className="pill paused">Pausado</span>}
                </div>
                {ad.advertiser_name && <p className="ad-card-advertiser">{ad.advertiser_name}</p>}
                <p className="ad-card-meta">
                  <Clock3 size={15} aria-hidden="true" /> {secs(ad.duration_seconds)}
                  <span>·</span>
                  <CircleDollarSign size={15} aria-hidden="true" /> {money(ad.amount)}
                  <span>·</span> Creado el {fmtDate(ad.created_at)}
                  {ad.ends_at ? <><span>·</span> Vence el {fmtDate(ad.ends_at)}</> : null}
                </p>
                {ad.review_status === 'approved' && ad.payment_status === 'paid' && (
                  <p className="ad-card-stats" aria-label="Estadísticas de la campaña">
                    <b>{(stats[ad.id]?.shown ?? 0).toLocaleString('es-AR')}</b> vistas
                    <span>·</span>
                    <b>{(stats[ad.id]?.clicked ?? 0).toLocaleString('es-AR')}</b> clics en “Conocer más”
                    {stats[ad.id]?.last_shown ? <small>Última vista el {fmtDate(stats[ad.id].last_shown)}</small> : null}
                  </p>
                )}
                <p className="ad-card-note">{statusNote(ad)}</p>
                {ad.review_status === 'rejected' && ad.review_note && (
                  <p className="note err">
                    <AlertTriangle size={16} aria-hidden="true" /> {ad.review_note}
                  </p>
                )}
                <div className="ad-card-acts">
                  {ad.target_url && (
                    <a className="btn btn-line btn-sm" href={ad.target_url} target="_blank" rel="noreferrer noopener">
                      Ver link
                    </a>
                  )}
                  {ad.review_status === 'approved' && ad.payment_status === 'paid' && (!ad.ends_at || new Date(ad.ends_at) > new Date()) && (
                    <button type="button" className="btn btn-line btn-sm" disabled={acting === ad.id} onClick={() => togglePause(ad)}>
                      {ad.paused_by_user ? (
                        <>
                          <Eye size={15} aria-hidden="true" /> Mostrar
                        </>
                      ) : (
                        <>
                          <EyeOff size={15} aria-hidden="true" /> Ocultar
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`btn btn-sm ${ad.payment_status === 'paid' ? 'btn-line' : 'btn-danger'}`}
                    disabled={acting === ad.id}
                    onClick={() => remove(ad)}
                  >
                    <Trash2 size={15} aria-hidden="true" /> Eliminar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
