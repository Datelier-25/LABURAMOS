import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import { lockScroll } from '../lib/scrollLock';
import { WELCOME_SLIDE_MS, welcomeImageUrl } from '../lib/welcome';

// Cartel que recibe a quien entra al sitio. Muestra una imagen o varias que se
// van alternando, y se cierra con la cruz (o con Escape) para seguir navegando.
export default function WelcomeBanner({ images = [], onClose }) {
  const list = images.map(welcomeImageUrl).filter(Boolean);
  const [index, setIndex] = useState(0);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const unlock = lockScroll();
    return unlock;
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  // Precargamos todas para que el cambio no muestre un hueco en blanco.
  useEffect(() => {
    list.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [list.join('|')]);

  useEffect(() => {
    if (list.length < 2) return undefined;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, WELCOME_SLIDE_MS);
    return () => window.clearInterval(t);
  }, [list.length]);

  if (!list.length) return null;

  return createPortal(
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-label="Novedades de LaburamosApp">
      <div className="welcome-card">
        <header className="welcome-head">
          <span className="welcome-tag">
            <Sparkles size={14} aria-hidden="true" /> Novedades
          </span>
          <div className="welcome-head-right">
            {list.length > 1 && (
              <span className="welcome-counter">
                {index + 1} / {list.length}
              </span>
            )}
            <button ref={closeRef} type="button" className="welcome-close" onClick={onClose} aria-label="Cerrar cartel">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="welcome-stage">
          <div
            className="welcome-stage-bg"
            style={{ backgroundImage: `url("${list[index]}")` }}
            aria-hidden="true"
          />
          <img key={list[index]} src={list[index]} alt={`Novedad ${index + 1} de ${list.length}`} />
        </div>

        {list.length > 1 && (
          <footer className="welcome-foot">
            <div className="welcome-dots" role="tablist" aria-label="Imágenes del cartel">
              {list.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Ver imagen ${i + 1}`}
                  className={i === index ? 'on' : ''}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
