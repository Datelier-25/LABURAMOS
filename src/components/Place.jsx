import { useEffect, useRef, useState } from 'react';
import { lockScroll } from '../lib/scrollLock';
import { createPortal } from 'react-dom';
import { ChevronDown, LocateFixed, MapPin, X } from 'lucide-react';
import { ALL_ZONE, isAll, locateMe, placeLabel, sameZone, searchPlaces, usePlaces, zoneShort, zoneText } from '../lib/geo';

// Buscador de localidades en una ventana. Con withProvinces también ofrece provincias y "Toda Argentina".
function PlaceDialog({ title, current, withProvinces, onPick, onClose }) {
  const { data, error } = usePlaces();
  const [term, setTerm] = useState('');
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const input = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    input.current?.focus();
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Que el Escape no cierre también la ventana de publicar que está debajo
      e.stopImmediatePropagation();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    const unlock = lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      unlock();
    };
  }, []);

  const useMyLocation = async () => {
    setLocError('');
    setLocating(true);
    try {
      const z = await locateMe();
      if (!z.city && !withProvinces) {
        setLocError('Encontramos tu provincia, pero no tu localidad. Escribila acá arriba.');
        setTerm('');
      } else onPick(z);
    } catch (e) {
      setLocError(e.message);
    }
    setLocating(false);
  };

  const results = searchPlaces(data, term, { withProvinces });
  // Sin texto: atajos a la provincia de la zona actual y a toda Argentina
  const shortcuts = [];
  if (withProvinces && !term) {
    if (current?.province && current.city) shortcuts.push({ city: null, province: current.province });
    shortcuts.push(ALL_ZONE);
  }
  const list = term ? results : shortcuts;

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="place-dlg" role="dialog" aria-modal="true" aria-label={title}>
        <div className="place-head">
          <h2>{title}</h2>
          <button type="button" className="x-sm" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <label className="place-search">
          <span className="sr">Buscar localidad</span>
          <MapPin size={20} aria-hidden="true" />
          <input
            ref={input}
            type="search"
            placeholder={withProvinces ? 'Escribí una ciudad o provincia' : 'Escribí tu ciudad o localidad'}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            autoComplete="off"
          />
        </label>

        <button type="button" className="locate" onClick={useMyLocation} disabled={locating}>
          <LocateFixed size={18} /> {locating ? 'Buscando dónde estás…' : 'Usar mi ubicación'}
        </button>
        {locError && <p className="place-msg err">{locError}</p>}
        {error && <p className="place-msg err">{error}</p>}

        <ul className="place-list" role="listbox" aria-label="Resultados">
          {list.map((z) => (
            <li key={`${z.city}|${z.province}`}>
              <button
                type="button"
                role="option"
                aria-selected={sameZone(z, current)}
                className={sameZone(z, current) ? 'on' : ''}
                onClick={() => onPick(z)}
              >
                {z.city ? (
                  <>
                    <b>{z.city}</b>
                    <small>{z.province}</small>
                  </>
                ) : isAll(z) ? (
                  <b>Toda Argentina</b>
                ) : (
                  <>
                    <b>{zoneText(z).replace(/^t/, 'T')}</b>
                    <small>{z.province.startsWith('Ciudad') ? 'Ciudad entera' : 'Provincia entera'}</small>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
        {term && data && results.length === 0 && <p className="place-msg">No encontramos “{term}”. Probá con otra forma de escribirla.</p>}
        {!data && !error && term && <p className="place-msg">Cargando localidades…</p>}
      </div>
    </div>,
    document.body
  );
}

// Zona dentro de los títulos: "Laburos en Bragado ▾"
export function ZonePicker({ zone, setZone, dark = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`zonePick${dark ? ' dark' : ''}`} onClick={() => setOpen(true)} aria-label={`Zona: ${zoneText(zone)}. Cambiar`}>
        <span>{zoneShort(zone)}</span>
        <ChevronDown className="zp-chev" aria-hidden="true" />
      </button>
      {open && (
        <PlaceDialog
          title="¿Dónde querés buscar?"
          current={zone}
          withProvinces
          onClose={() => setOpen(false)}
          onPick={(z) => {
            setZone(z);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

// Campo de formulario para elegir una localidad: value = { city, province }
export function PlaceField({ label = 'Localidad', value, onChange, required = false }) {
  const [open, setOpen] = useState(false);
  const has = !!value?.city;
  return (
    <div className="field">
      <span>{label}</span>
      <button type="button" className={`place-input${has ? '' : ' is-empty'}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <MapPin size={18} aria-hidden="true" />
        <span>{has ? placeLabel(value.city, value.province) : 'Elegí tu localidad'}</span>
      </button>
      {/* Para que el formulario no se envíe sin localidad */}
      {required && <input className="sr" tabIndex={-1} required value={has ? value.city : ''} onChange={() => {}} aria-hidden="true" />}
      {open && (
        <PlaceDialog
          title="¿Dónde estás?"
          current={value}
          onClose={() => setOpen(false)}
          onPick={(z) => {
            onChange(z);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
