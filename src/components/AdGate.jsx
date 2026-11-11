import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Megaphone, Play, Volume2, VolumeX, X } from 'lucide-react';
import { lockScroll } from '../lib/scrollLock';
import { adVideoUrl } from '../lib/ads';

// Ventana que reproduce el anuncio antes de seguir con la acción.
// El botón Continuar se habilita a los segundos configurados (o al terminar).
export default function AdGate({ ad, skipSeconds = 5, onDone, onCancel }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [remaining, setRemaining] = useState(Math.max(0, Math.round(Number(skipSeconds) || 0)));
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => lockScroll(), []);

  // Cuenta regresiva para habilitar Continuar.
  useEffect(() => {
    if (remaining <= 0) return undefined;
    const t = window.setTimeout(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [remaining]);

  // Intento de reproducción automática (silenciado para que el navegador lo permita).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const play = video.play();
    if (play?.catch) play.catch(() => setBlocked(true));
  }, []);

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

  return (
    <div className="ad-overlay" role="dialog" aria-modal="true" aria-label="Anuncio">
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
          {!failed ? (
            <video
              ref={videoRef}
              className="ad-video"
              src={adVideoUrl(ad?.video_path)}
              autoPlay
              muted={muted}
              playsInline
              preload="auto"
              onTimeUpdate={onTime}
              onEnded={() => setProgress(100)}
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="ad-fallback">
              <Megaphone size={44} aria-hidden="true" />
              <b>{title}</b>
              {advertiser && <span>{advertiser}</span>}
              <small>No pudimos reproducir el video en este dispositivo.</small>
            </div>
          )}

          {blocked && !failed && (
            <button type="button" className="ad-play" onClick={play}>
              <Play size={26} aria-hidden="true" /> Reproducir anuncio
            </button>
          )}

          <div className="ad-progress" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>

          {!failed && (
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
              <a className="btn btn-line btn-sm" href={ad.target_url} target="_blank" rel="noreferrer noopener">
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
