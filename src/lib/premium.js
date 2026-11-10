// Premium por publicación: límites de links y fotos.
// Los mismos valores se validan en la base (migración 028).
import { DEFAULT_SETTINGS } from './settings';

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

// Una publicación es premium mientras premium_until esté en el futuro.
export function isPremium(item) {
  const until = item?.premium_until;
  return !!until && new Date(until).getTime() > Date.now();
}

// Devuelve cuántos links y fotos puede mostrar/guardar la publicación.
export function listingLimits(settings, premium) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  let links = premium ? int(s.premium_links_limit, 3) : int(s.free_links_limit, 1);
  let photos = premium ? int(s.premium_photos_limit, 10) : int(s.free_photos_limit, 5);

  // Si el administrador no incluyó links o fotos en el premium, ese beneficio
  // queda disponible para todos con el límite más alto.
  if (!s.premium_include_links) links = Math.max(int(s.free_links_limit, 1), int(s.premium_links_limit, 3));
  if (!s.premium_include_photos) photos = Math.max(int(s.free_photos_limit, 5), int(s.premium_photos_limit, 10));

  return { links: Math.max(0, links), photos: Math.max(0, photos) };
}

// Links que corresponde mostrar según el estado premium de la publicación.
export function visibleLinks(item, settings) {
  const { links } = listingLimits(settings, isPremium(item));
  return (item?.links || []).filter(Boolean).slice(0, links);
}

// Acepta "instagram.com/x" y lo completa con https://. Devuelve '' si no es
// una URL http(s) válida.
export function normalizeLink(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch {
    return '';
  }
}

export function linkKind(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return 'web';
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (host === 'maps.app.goo.gl' || (host.endsWith('google.com') && path.startsWith('/maps')) || (host === 'goo.gl' && path.startsWith('/maps'))) {
    return 'maps';
  }
  if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') return 'instagram';
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com') return 'facebook';
  if (host === 'wa.me' || host === 'api.whatsapp.com' || host === 'whatsapp.com' || host.endsWith('.whatsapp.com')) return 'whatsapp';
  return 'web';
}

export function linkLabel(value) {
  const kind = linkKind(value);
  if (kind === 'maps') return 'Google Maps';
  if (kind === 'instagram') return 'Instagram';
  if (kind === 'facebook') return 'Facebook';
  if (kind === 'whatsapp') return 'WhatsApp';
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'Sitio web';
  }
}
