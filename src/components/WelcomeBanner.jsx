import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { lockScroll } from '../lib/scrollLock';
import { WELCOME_SLIDE_MS, welcomeImageUrl } from '../lib/welcome';

// Cartel que recibe a quien entra al sitio. Muestra la imagen completa, sin
// recortes ni marcos extra, y se cierra con la cruz (o con Escape). Si hay
// varias imágenes, se van alternando solas.
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
    <div className={`welcome-overlay${list.length > 1 ? ' multi' : ''}`} role="dialog" aria-modal="true" aria-label="Cartel de bienvenida">
      <div className="welcome-card">
        <button ref={closeRef} type="button" className="welcome-close" onClick={onClose} aria-label="Cerrar cartel">
          <X size={22} aria-hidden="true" />
        </button>
        <img
          key={list[index]}
          className="welcome-image"
          src={list[index]}
          alt=""
          onClick={() => list.length > 1 && setIndex((i) => (i + 1) % list.length)}
        />
      </div>
    </div>,
    document.body
  );
}
