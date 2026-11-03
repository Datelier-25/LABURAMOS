import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe2, LocateFixed, MapPin, X } from 'lucide-react';
import { ALL_ZONE, locateMe } from '../lib/geo';
import { PlaceField } from './Place';

// Bienvenida a primera visita: invitamos a elegir la localidad antes de ver avisos.
// El cierre (X, Escape o tocar afuera) equivale a "ver todo el país".
export default function ZoneWelcome({ onPick, onClose }) {
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, []);

  const useMyLocation = async () => {
    setLocError('');
    setLocating(true);
    try {
      const z = await locateMe();
      onPick(z);
    } catch (e) {
      setLocError(e.message);
    }
    setLocating(false);
  };

  const pickAll = () => {
    if (typeof onClose === 'function') onClose();
    else onPick?.(ALL_ZONE);
  };

  return createPortal(
    <div className="overlay zone-welcome" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="place-dlg zone-dlg" role="dialog" aria-modal="true" aria-label="Elegí tu localidad">
        <div className="place-head">
          <h2>¿Dónde buscás?</h2>
          <button type="button" className="x-sm" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <span className="zone-ic" aria-hidden="true">
          <MapPin size={22} />
        </span>
        <p className="zone-lede">Elegí la localidad para que veamos primero los laburos y oficios de tu zona.</p>

        <button type="button" className="locate" onClick={useMyLocation} disabled={locating}>
          <LocateFixed size={18} /> {locating ? 'Buscando dónde estás…' : 'Usar mi ubicación'}
        </button>
        {locError && <p className="place-msg err">{locError}</p>}

        <div className="zone-or">
          <span>o elegí a mano</span>
        </div>

        <PlaceField label="Tu localidad" value={null} onChange={(z) => onPick(z)} />

        <button type="button" className="zone-all" onClick={pickAll}>
          <Globe2 size={16} aria-hidden="true" /> Ver todo el país
        </button>

        <p className="zone-note">Todo el sitio es público: sin cuenta podés mirar avisos, y te pedimos registro solo para postular, guardar, contactar o publicar.</p>
      </div>
    </div>,
    document.body
  );
}
