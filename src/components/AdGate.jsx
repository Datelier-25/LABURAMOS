import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Megaphone, Play, Volume2, VolumeX, X } from 'lucide-react';
import { lockScroll } from '../lib/scrollLock';
import { adImageUrl, adVideoUrl, registerAdEvent } from '../lib/ads';
import useFocusTrap from '../lib/useFocusTrap';

// Ventana que muestra el anuncio antes de seguir con la acción.
// - Video: se reproduce y "Continuar" se habilita a los segundos configurados o al terminar.
// - Imagen: se muestra durante la duración de la campaña (ads_image_seconds) y después se habilita "Continuar".
// El foco queda dentro de la ventana mientras está abierta.
export default function AdGate({ ad, skipSeconds = 5, onDone, onCancel }) {
  const isImage = ad?.media_type === 'image';
  const total = isImage
    ? Math.max(1, Math.round(Number(ad?.duration_seconds) || 8))
    : Math.max(0, Math.round(Number(skipSeconds) || 0));

  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  useFocusTrap(overlayRef);
  const [muted, setMuted] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [remaining, setRemaining] = useState(total);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => lockScroll(), []);

  // Una vista por apertura (la base descarta repetidos del mismo usuario en 10 minutos)
  useEffect(() => {
    registerAdEvent(ad?.id, 'shown');
  }, [ad?.id]);

  // Cuenta regresiva para habilitar Continuar (y progreso para las imágenes).
  useEffect(() => {
    if (remaining <= 0) return undefined;
    const t = window.setTimeout(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [remaining]);

  useEffect(() => {
    if (!isImage) return;
    setProgress(total ? Math.min(100, ((total - remaining) / total) * 100) : 100);
  }, [isImage, remaining, total]);

  // Intento de reproducción automática (silenciado para que el navegador lo permita).
  useEffect(() => {
    if (isImage) return;
    const video = videoRef.current;
    if (!video) return;
    const play = video.play();
    if (play?.catch) play.catch(() => setBlocked(true));
  }, [isImage]);

  // Escape cancela la acción, igual que la cruz.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    video.muted = next;
    setMuted(next);
    if (!next) video.play().catch(() => {});
  };

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    setBlocked(false);
    video.play().catch(() => setBlocked(true));
  };

  const onTime = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    setProgress(Math.min(100, (video.currentTime / video.duration) * 100));
  };

  const canContinue = remaining <= 0;
  const title = ad?.title || 'Anuncio';
  const advertiser = ad?.advertiser_name;
  const mediaUrl = isImage ? adImageUrl(ad?.image_path) : adVideoUrl(ad?.video_path);

  return (
    <div ref={overlayRef} className="ad-overlay" role="dialog" aria-modal="true" aria-label={`Anuncio: ${title}`}>
      <div className="ad-box">
        <div className="ad-head">
          <span className="ad-tag">
            <Megaphone size={14} aria-hidden="true" /> Publicidad
          </span>
          <span className="ad-title">
            {title}
            {advertiser ? <small>{advertiser}</small> : null}
          </span>
          <button type="button" className="ad-close" onClick={onCancel} aria-label="Cerrar anuncio">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="ad-stage">
          {failed ? (
            <div className="ad-fallback">
              <Megaphone size={44} aria-hidden="true" />
              <b>{title}</b>
              {advertiser && <span>{advertiser}</span>}
              <small>No pudimos mostrar el anuncio en este dispositivo.</small>
            </div>
          ) : isImage ? (
            <img className="ad-image" src={mediaUrl} alt={title} onError={() => setFailed(true)} />
          ) : (
            <video
              ref={videoRef}
              className="ad-video"
              src={mediaUrl}
              autoPlay
              muted={muted}
              playsInline
              preload="auto"
              onTimeUpdate={onTime}
              onEnded={() => {
                // Si el video termina antes del tiempo de espera, no dejamos al usuario esperando en vacío
                setProgress(100);
                setRemaining(0);
              }}
              onError={() => setFailed(true)}
            />
          )}

          {blocked && !failed && !isImage && (
            <button type="button" className="ad-play" onClick={play}>
              <Play size={26} aria-hidden="true" /> Reproducir anuncio
            </button>
          )}

          <div className="ad-progress" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>

          {!failed && !isImage && (
            <button type="button" className="ad-sound" onClick={toggleSound} aria-label={muted ? 'Activar sonido' : 'Silenciar anuncio'}>
              {muted ? <VolumeX size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
              {muted ? 'Activar sonido' : 'Silenciar'}
            </button>
          )}
        </div>

        <div className="ad-foot">
          <span className="ad-count" aria-live="polite">
            {canContinue ? 'Ya podés continuar.' : `Podés continuar en ${remaining} s.`}
          </span>
          <div className="ad-actions">
            {ad?.target_url && (
              <a className="btn btn-line btn-sm" href={ad.target_url} target="_blank" rel="noreferrer noopener" onClick={() => registerAdEvent(ad.id, 'clicked')}>
                <ExternalLink size={15} aria-hidden="true" /> Conocer más
              </a>
            )}
            <button type="button" className="btn btn-ink" disabled={!canContinue} onClick={onDone}>
              {canContinue ? 'Continuar' : `Continuar en ${remaining} s`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
