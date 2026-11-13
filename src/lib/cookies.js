// Preferencias de cookies de LaburamosApp.
// Solo se guardan en el navegador (localStorage) y se registran, sin datos
// sensibles, para dejar constancia de la decisión.
import { LEGAL_VERSION, recordLegalAcceptance } from './legal';

export const COOKIE_STORAGE_KEY = 'laburamos_cookies_v1';
export const COOKIE_POLICY_VERSION = LEGAL_VERSION;

export const COOKIE_CATEGORIES = [
  {
    id: 'necessary',
    title: 'Necesarias',
    text: 'Mantienen la sesión, la zona elegida, los avisos guardados y las preferencias del sitio. Sin ellas la app no funciona.',
    required: true,
  },
  {
    id: 'analytics',
    title: 'Analítica',
    text: 'Nos ayudarían a entender qué se usa más para mejorar la app. Hoy no hay herramientas de analítica activas.',
    required: false,
  },
  {
    id: 'marketing',
    title: 'Publicidad',
    text: 'Permitirían medir o personalizar anuncios. Hoy no hay cookies ni píxeles publicitarios de terceros.',
    required: false,
  },
];

export const DEFAULT_COOKIE_PREFS = {
  version: COOKIE_POLICY_VERSION,
  necessary: true,
  analytics: false,
  marketing: false,
  decidedAt: null,
  method: '',
};

export function readCookiePrefs() {
  if (typeof window === 'undefined') return { ...DEFAULT_COOKIE_PREFS };
  try {
    const raw = window.localStorage.getItem(COOKIE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COOKIE_PREFS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_COOKIE_PREFS,
      necessary: true,
      analytics: !!parsed.analytics,
      marketing: !!parsed.marketing,
      decidedAt: parsed.decidedAt || null,
      method: parsed.method || '',
      version: parsed.version || COOKIE_POLICY_VERSION,
    };
  } catch {
    return { ...DEFAULT_COOKIE_PREFS };
  }
}

export function saveCookiePrefs(prefs, method = 'settings') {
  const next = {
    ...DEFAULT_COOKIE_PREFS,
    ...prefs,
    necessary: true,
    decidedAt: new Date().toISOString(),
    method,
    version: COOKIE_POLICY_VERSION,
  };
  try {
    window.localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* modo privado o almacenamiento bloqueado: la decisión vale para esta visita */
  }
  // El registro legal es best effort: no frena la navegación.
  const context = method === 'banner'
    ? `cookies:${next.analytics || next.marketing ? 'opcionales' : 'necesarias'}`
    : `cookies:${method}`;
  void recordLegalAcceptance('cookies', context, method === 'banner' ? 'banner' : 'settings');
  return next;
}

export function hasCookieDecision(prefs = readCookiePrefs()) {
  return !!prefs.decidedAt;
}
