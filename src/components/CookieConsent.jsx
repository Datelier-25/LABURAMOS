import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Cookie, Settings2, X } from 'lucide-react';
import { lockScroll } from '../lib/scrollLock';
import {
  COOKIE_CATEGORIES,
  hasCookieDecision,
  readCookiePrefs,
  saveCookiePrefs,
} from '../lib/cookies';

// Aviso de cookies y panel de preferencias.
// Solo se muestra si todavía no hay una decisión guardada. Nada opcional se
// activa sin que la persona lo elija.
export default function CookieConsent({ suppressBanner = false }) {
  const [prefs, setPrefs] = useState(readCookiePrefs);
  const [banner, setBanner] = useState(() => !hasCookieDecision(readCookiePrefs()));
  const [panel, setPanel] = useState(false);
  const [draft, setDraft] = useState(readCookiePrefs);

  // El pie y las políticas abren el panel con este evento.
  useEffect(() => {
    const open = () => {
      setDraft(readCookiePrefs());
      setPanel(true);
    };
    window.addEventListener('laburamos:cookies-open', open);
    return () => window.removeEventListener('laburamos:cookies-open', open);
  }, []);

  useEffect(() => {
    if (!panel) return undefined;
    return lockScroll();
  }, [panel]);

  useEffect(() => {
    if (!panel) return undefined;
    const onKey = (e) => e.key === 'Escape' && setPanel(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);

  const decide = (next, method) => {
    const saved = saveCookiePrefs(next, method);
    setPrefs(saved);
    setBanner(false);
    setPanel(false);
  };

  const acceptAll = () => decide({ ...draft, analytics: true, marketing: true }, 'banner');
  const onlyNecessary = () => decide({ ...draft, analytics: false, marketing: false }, 'banner');

  if (!banner && !panel) return null;

  const UI = (
    <>
      {banner && !panel && !suppressBanner && (
        <div className="cookie-banner" role="region" aria-label="Aviso de cookies">
          <div className="cookie-banner-txt">
            <Cookie size={20} aria-hidden="true" />
            <p>
              Usamos almacenamiento necesario para que la app funcione y recuerde tu sesión. Las cookies de analítica y publicidad
              están desactivadas. Podés aceptarlas o seguir solo con las necesarias.{' '}
              <a href="/cookies">Saber más</a>
            </p>
          </div>
          <div className="cookie-banner-acts">
            <button type="button" className="btn btn-line btn-sm" onClick={() => setPanel(true)}>
              <Settings2 size={15} aria-hidden="true" /> Configurar
            </button>
            <button type="button" className="btn btn-line btn-sm" onClick={onlyNecessary}>
              Solo necesarias
            </button>
            <button type="button" className="btn btn-ink btn-sm" onClick={acceptAll}>
              <Check size={15} aria-hidden="true" /> Aceptar todas
            </button>
          </div>
        </div>
      )}

      {panel &&
        createPortal(
          <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setPanel(false)}>
            <div className="place-dlg cookie-dlg" role="dialog" aria-modal="true" aria-labelledby="cookie-title">
              <div className="place-head">
                <h2 id="cookie-title">
                  <Cookie size={19} aria-hidden="true" /> Preferencias de cookies
                </h2>
                <button type="button" className="x-sm" onClick={() => setPanel(false)} aria-label="Cerrar">
                  <X size={18} />
                </button>
              </div>

              <p className="lede">
                Elegí qué querés permitir. Las necesarias no se pueden desactivar porque sin ellas no podés iniciar sesión ni guardar
                tus preferencias.
              </p>

              <div className="cookie-opts">
                {COOKIE_CATEGORIES.map((category) => {
                  const on = category.required ? true : !!draft[category.id];
                  return (
                    <label key={category.id} className={`cookie-opt${category.required ? ' fixed' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={category.required}
                        onChange={(e) => setDraft((value) => ({ ...value, [category.id]: e.target.checked }))}
                      />
                      <span>
                        <b>
                          {category.title}
                          {category.required ? ' · siempre activas' : ''}
                        </b>
                        <small>{category.text}</small>
                      </span>
                    </label>
                  );
                })}
              </div>

              <p className="note">
                Guardamos tu decisión en este navegador. Podés cambiarla cuando quieras desde el pie de página o la{' '}
                <a href="/cookies" onClick={() => setPanel(false)}>
                  Política de Cookies
                </a>
                .
              </p>

              <div className="cookie-acts">
                <button type="button" className="btn btn-line" onClick={() => decide(draft, 'settings')}>
                  Guardar mis preferencias
                </button>
                <button type="button" className="btn btn-sun" onClick={() => decide({ ...draft, analytics: true, marketing: true }, 'settings')}>
                  <Check size={16} aria-hidden="true" /> Aceptar todas
                </button>
              </div>
              {prefs.decidedAt && (
                <p className="cookie-when">
                  Última decisión: {new Date(prefs.decidedAt).toLocaleString('es-AR')}
                  {prefs.method ? ` (${prefs.method === 'banner' ? 'aviso' : 'configuración'})` : ''}.
                </p>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );

  return UI;
}
