// Zonas de Argentina: localidades, provincias y "Usar mi ubicación".
// La lista sale de la API Georef (datos.gob.ar) y está guardada en public/geo/localidades.json.
// Una zona es { city, province }: con city es una localidad, solo province es la provincia entera,
// y las dos en null es toda Argentina.
import { useCallback, useEffect, useRef, useState } from 'react';

export const ALL_ZONE = { city: null, province: null };
const ZONE_KEY = 'lab_zone';
const GEOREF = 'https://apis.datos.gob.ar/georef/api';
const CABA = 'Ciudad Autónoma de Buenos Aires';

// Sin tildes ni mayúsculas, para comparar lo que escribe la persona
export const norm = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Georef devuelve "Tierra del Fuego, Antártida e Islas del Atlántico Sur"; guardamos el nombre corto
export const cleanProvince = (p) => (p && p.startsWith('Tierra del Fuego') ? 'Tierra del Fuego' : p || null);

export const isAll = (z) => !z || (!z.city && !z.province);
export const sameZone = (a, b) => (a?.city || null) === (b?.city || null) && (a?.province || null) === (b?.province || null);

// Texto corto para títulos: "Bragado", "Mendoza", "toda Argentina"
export function zoneShort(z) {
  if (isAll(z)) return 'toda Argentina';
  if (z.city) return z.city;
  return z.province === CABA ? 'CABA' : z.province;
}

// Texto para frases: "en Bragado", "en toda la provincia de Mendoza", "en toda Argentina"
export function zoneText(z) {
  if (isAll(z)) return 'toda Argentina';
  if (z.city) return z.city;
  return z.province === CABA ? 'toda la Ciudad de Buenos Aires' : `toda la provincia de ${z.province}`;
}

// "Bragado, Buenos Aires"
export const placeLabel = (city, province) => [city, province === CABA ? 'CABA' : province].filter(Boolean).join(', ');

// Aplica la zona a una consulta de Supabase. cityCol es "location" en jobs y "city" en el resto.
export function applyZone(q, zone, cityCol = 'city') {
  if (isAll(zone)) return q;
  if (zone.city) return q.eq(cityCol, zone.city).eq('province', zone.province);
  return q.eq('province', zone.province);
}

// ---------- lista de localidades (se baja una sola vez, cuando hace falta) ----------
let cache = null;
export function loadPlaces() {
  if (!cache) {
    cache = fetch('/geo/localidades.json')
      .then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar la lista de localidades');
        return r.json();
      })
      .then((d) => ({
        provinces: d.provincias,
        places: d.localidades.map(([city, i]) => ({ city, province: d.provincias[i], key: norm(city) })),
      }))
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

// Busca localidades (y provincias, si withProvinces) que empiecen o contengan lo escrito
export function searchPlaces(data, term, { withProvinces = false, max = 30 } = {}) {
  const t = norm(term);
  if (!data || !t) return [];
  const out = [];
  if (withProvinces) {
    for (const p of data.provinces) {
      const k = norm(p);
      if (k.startsWith(t) || k.includes(` ${t}`)) out.push({ city: null, province: p });
    }
  }
  const starts = [];
  const words = [];
  const inside = [];
  for (const p of data.places) {
    if (p.key.startsWith(t)) starts.push(p);
    else if (p.key.includes(` ${t}`)) words.push(p);
    else if (t.length > 2 && p.key.includes(t)) inside.push(p);
  }
  // Primero las que empiezan con lo escrito y tienen el nombre más corto (Córdoba antes que Cordón del Plata)
  starts.sort((x, y) => x.key.length - y.key.length);
  for (const p of [...starts, ...words, ...inside]) {
    if (out.length >= max) break;
    out.push({ city: p.city, province: p.province });
  }
  return out;
}

// ---------- "Usar mi ubicación" ----------
function position() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no permite compartir la ubicación.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      reject(
        new Error(
          err.code === 1
            ? 'No diste permiso para usar tu ubicación. Podés escribir tu ciudad.'
            : 'No pudimos saber dónde estás. Probá escribir tu ciudad.'
        )
      );
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
}

// Devuelve { city, province } de donde está la persona. Pide permiso al navegador.
export async function locateMe() {
  const pos = await position();
  const { latitude, longitude } = pos.coords;
  const r = await fetch(`${GEOREF}/ubicacion?lat=${latitude}&lon=${longitude}`);
  if (!r.ok) throw new Error('No pudimos saber dónde estás. Probá escribir tu ciudad.');
  const u = (await r.json()).ubicacion || {};
  const province = cleanProvince(u.provincia?.nombre);
  if (!province) throw new Error('Parece que no estás en Argentina. Escribí tu ciudad.');
  if (province === CABA) return { city: null, province };

  // El municipio de Georef no siempre coincide con el nombre de la localidad: buscamos el más parecido
  const data = await loadPlaces().catch(() => null);
  for (const name of [u.municipio?.nombre, u.departamento?.nombre]) {
    if (!name || !data) continue;
    const k = norm(name);
    const hit = data.places.find((p) => p.province === province && p.key === k);
    if (hit) return { city: hit.city, province };
  }
  const fallback = u.municipio?.nombre || u.departamento?.nombre;
  return fallback ? { city: fallback, province } : { city: null, province };
}

// ---------- zona elegida (se recuerda en este dispositivo) ----------
function readZone() {
  try {
    const z = JSON.parse(localStorage.getItem(ZONE_KEY) || 'null');
    return z && typeof z === 'object' ? { city: z.city || null, province: z.province || null } : null;
  } catch {
    return null;
  }
}

export function useZone() {
  const [stored] = useState(readZone);
  const [zone, setZoneState] = useState(stored || ALL_ZONE);
  const chosen = useRef(!!stored);

  const setZone = useCallback((z) => {
    const next = { city: z?.city || null, province: z?.province || null };
    setZoneState(next);
    chosen.current = true;
    try {
      localStorage.setItem(ZONE_KEY, JSON.stringify(next));
    } catch {
      /* sin almacenamiento disponible */
    }
  }, []);

  // Zona sugerida (la del perfil): solo se usa si la persona todavía no eligió una
  const suggestZone = useCallback((z) => {
    if (!chosen.current && z && (z.city || z.province)) setZoneState({ city: z.city || null, province: z.province || null });
  }, []);

  return [zone, setZone, suggestZone];
}

// Carga la lista al montar (para buscadores)
export function usePlaces(active = true) {
  const [state, setState] = useState({ data: null, error: '' });
  useEffect(() => {
    if (!active) return undefined;
    let off = false;
    loadPlaces()
      .then((data) => !off && setState({ data, error: '' }))
      .catch((e) => !off && setState({ data: null, error: e.message }));
    return () => {
      off = true;
    };
  }, [active]);
  return state;
}
