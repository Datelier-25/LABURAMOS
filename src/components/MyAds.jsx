import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock3, Plus, ShieldCheck, Trash2, Video, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { friendlyError, money } from '../lib/utils';
import { AD_VIDEO_BUCKET, adConfig, adPrice, adVideoExtension, adVideoUrl, probeVideo, validateAdDuration, validateAdFile } from '../lib/ads';
import { Empty } from './ui';

const REVIEW = { pending: 'En revisión', approved: 'Aprobado', rejected: 'Rechazado' };
const PAYMENT = { pending: 'Pago pendiente', paid: 'Pago acreditado' };
const REVIEW_CLASS = { pending: 'paused', approved: 'active', rejected: 'expired' };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const secs = (n) => `${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s`;

function statusNote(ad) {
  if (ad.review_status === 'rejected') return 'El anuncio no fue aprobado.';
  if (ad.review_status === 'pending') return 'Estamos revisando el video. Te avisamos cuando esté aprobado.';
  if (ad.payment_status !== 'paid') return 'Está aprobado. Falta acreditar el pago para que empiece a mostrarse.';
  if (!ad.active) return 'El administrador pausó este anuncio.';
  if (ad.ends_at && new Date(ad.ends_at) < new Date()) return 'La campaña venció. Podés crear un anuncio nuevo.';
  return ad.ends_at ? `Se está mostrando hasta el ${fmtDate(ad.ends_at)}.` : 'Se está mostrando en la app.';
}

export default function MyAds({ user, settings, notify }) {
  const cfg = adConfig(settings);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', advertiser_name: '', target_url: '' });
  const [file, setFile] = useState(null);
  const [video, setVideo] = useState(null);
  const [fileError, setFileError] = useState('');
  const [probing, setProbing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const previewUrl = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('ad_campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (err) setError(friendlyError(err.message));
    setAds(data || []);
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

  const clearVideo = () => {
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = '';
    }
    setFile(null);
    setVideo(null);
    setFileError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const resetForm = () => {
    clearVideo();
    setForm({ title: '', advertiser_name: '', target_url: '' });
    setProbing(false);
  };

  const onFile = async (e) => {
    const picked = e.target.files?.[0];
    setFileError('');
    setResult(null);
    if (!picked) return;
    const fileMsg = validateAdFile(picked);
    if (fileMsg) {
      clearVideo();
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
        clearVideo();
        setFileError(durationMsg);
      } else {
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = URL.createObjectURL(picked);
        setFile(picked);
        setVideo({ ...info, duration, url: previewUrl.current });
      }
    } catch {
      clearVideo();
      setFileError('No pudimos leer el video. Probá con un archivo MP4, WebM o MOV.');
    }
    setProbing(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setFileError('');
    if (!file || !video) {
      setFileError('Elegí un video válido antes de enviar.');
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

    setBusy(true);
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${adVideoExtension(file)}`;
    const { error: upErr } = await supabase.storage.from(AD_VIDEO_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) {
      setBusy(false);
      setError(friendlyError(upErr.message));
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc('submit_ad_campaign', {
      p_title: title,
      p_video_path: path,
      p_duration_seconds: Math.round(video.duration * 100) / 100,
      p_advertiser_name: form.advertiser_name.trim() || null,
      p_target_url: target || null,
      p_video_mime: file.type,
      p_video_size: file.size,
    });
    if (rpcErr) {
      // Si la base rechaza el anuncio, no dejamos el video huérfano en el bucket.
      await supabase.storage.from(AD_VIDEO_BUCKET).remove([path]);
      setBusy(false);
      setError(friendlyError(rpcErr.message));
      return;
    }

    setBusy(false);
    setOpen(false);
    resetForm();
    setResult(data || { amount: adPrice(video.duration, settings), duration_seconds: video.duration });
    notify('Anuncio enviado: queda pendiente de revisión');
    load();
  };

  const remove = async (ad) => {
    if (!window.confirm(`¿Eliminar el anuncio "${ad.title}"? No se puede deshacer.`)) return;
    const { error: err } = await supabase.from('ad_campaigns').delete().eq('id', ad.id);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    await supabase.storage.from(AD_VIDEO_BUCKET).remove([ad.video_path]);
    notify('Anuncio eliminado');
    load();
  };

  return (
    <section className="wrap page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Mis anuncios</h1>
          <p className="lede">
            Subí un video de hasta {cfg.max} segundos y mostralo cuando alguien publica, se postula o contacta a un servicio.
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
            <b>Anuncio enviado.</b> Queda pendiente de revisión. Precio: {money(result.amount)} por {secs(result.duration_seconds)}. Cuando el administrador apruebe el video y acredite el pago, empieza a mostrarse.
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
          <b>1. Subí tu video</b>
          <small>MP4, WebM o MOV de hasta 50 MB y entre {cfg.min} y {cfg.max} segundos.</small>
        </div>
        <div>
          <ShieldCheck size={20} aria-hidden="true" />
          <b>2. Lo revisamos</b>
          <small>El administrador aprueba el contenido antes de que se publique.</small>
        </div>
        <div>
          <CircleDollarSign size={20} aria-hidden="true" />
          <b>3. Acreditás el pago</b>
          <small>{money(cfg.price)} por segundo. La campaña dura {cfg.days} días desde que queda paga.</small>
        </div>
      </div>

      {open && cfg.enabled && (
        <form className="admin-card ads-form" onSubmit={submit}>
          <div className="ads-form-head">
            <div>
              <h2 className="block-title">Nuevo anuncio</h2>
              <p className="lede">El video se muestra en forma aleatoria antes de publicar, postularse o contactar.</p>
            </div>
            <button type="button" className="ad-close" onClick={() => { setOpen(false); resetForm(); }} aria-label="Cerrar formulario">
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {fileError && <p className="note err">{fileError}</p>}

          <label className="field">
            <span>Video del anuncio</span>
            <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onFile} />
            <small>Duración permitida: entre {cfg.min} y {cfg.max} segundos. Tamaño máximo: 50 MB.</small>
          </label>

          {probing && <p className="count">Leyendo el video…</p>}

          {video && (
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
            {video ? (
              <span>
                Total a abonar: <b>{money(adPrice(video.duration, settings))}</b> ({secs(video.duration)} × {money(cfg.price)})
              </span>
            ) : (
              <span>El precio se calcula con la duración real del video: {money(cfg.price)} por segundo.</span>
            )}
          </p>

          <button className="btn btn-ink btn-lg" disabled={busy || probing || !video}>
            {busy ? 'Subiendo…' : 'Enviar para revisión'}
          </button>
        </form>
      )}

      <h2 className="block-title">Tus campañas</h2>
      {loading ? (
        <p className="count">Cargando…</p>
      ) : ads.length === 0 ? (
        <Empty title="Todavía no creaste ningún anuncio" text="Subí un video corto y mostralo a quienes usan LaburamosApp.">
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
              <video className="ad-card-video" src={adVideoUrl(ad.video_path)} controls playsInline preload="metadata" />
              <div className="ad-card-body">
                <div className="ad-card-head">
                  <h3>{ad.title}</h3>
                  <span className={`pill ${REVIEW_CLASS[ad.review_status] || 'paused'}`}>{REVIEW[ad.review_status] || ad.review_status}</span>
                  <span className={`pill ${ad.payment_status === 'paid' ? 'active' : 'paused'}`}>{PAYMENT[ad.payment_status] || ad.payment_status}</span>
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
                  {ad.payment_status !== 'paid' ? (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(ad)}>
                      <Trash2 size={15} aria-hidden="true" /> Eliminar
                    </button>
                  ) : (
                    <span className="chip-s">Campaña paga: para cambios, escribinos desde Sugerencias.</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
