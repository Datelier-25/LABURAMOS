import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { lockScroll } from '../lib/scrollLock';
import { WELCOME_SLIDE_MS, welcomeImageUrl } from '../lib/welcome';
import useFocusTrap from '../lib/useFocusTrap';

// Cartel que recibe a quien entra al sitio. Muestra la imagen completa, sin
// recortes ni marcos extra. Se cierra con la cruz, con Escape o tocando el fondo.
// Si hay varias imágenes, rotan solas (se pausan al pasar el mouse o al usar el
// teclado) y se pueden cambiar con flechas, con los puntos o tocando la imagen.
export default function WelcomeBanner({ images = [], onClose }) {
  const list = images.map(welcomeImageUrl).filter(Boolean);
  const total = list.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef);

  useEffect(() => lockScroll(), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose?.();
      }
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
    if (total < 2 || paused) return undefined;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % total), WELCOME_SLIDE_MS);
    return () => window.clearInterval(t);
  }, [total, paused]);

  if (!total) return null;

  const go = (step) => setIndex((i) => (i + step + total) % total);
  const onArrowKeys = (e) => {
    if (total < 2) return;
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  };

  return createPortal(
    <div
      className={`welcome-overlay${total > 1 ? ' multi' : ''}`}
      role="presentation"
      onMouseDown={(e) => {
        // Tocar el fondo cierra; tocar la imagen o los controles no.
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className="welcome-card"
        role="dialog"
        aria-modal="true"
        aria-label="Cartel de bienvenida"
        tabIndex={-1}
        onKeyDown={onArrowKeys}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
        }}
      >
        <button type="button" className="welcome-close" onClick={onClose} aria-label="Cerrar cartel">
          <X size={22} aria-hidden="true" />
        </button>

        <img
          key={list[index]}
          className="welcome-image"
          src={list[index]}
          alt={total > 1 ? `Cartel de bienvenida ${index + 1} de ${total}` : 'Cartel de bienvenida'}
          onClick={() => total > 1 && go(1)}
        />

        {total > 1 && (
          <div className="welcome-nav">
            <button type="button" className="welcome-arrow" onClick={() => go(-1)} aria-label="Cartel anterior">
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <div className="welcome-dots" role="group" aria-label="Elegir cartel">
              {list.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`welcome-dot${i === index ? ' on' : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Ir al cartel ${i + 1}`}
                  aria-current={i === index ? 'true' : undefined}
                />
              ))}
            </div>
            <button type="button" className="welcome-arrow" onClick={() => go(1)} aria-label="Cartel siguiente">
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
