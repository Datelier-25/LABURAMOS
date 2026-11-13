// Documentos legales y registro de consentimiento.
// La versión se cambia cuando cambia el texto de los documentos: queda guardada
// junto con cada aceptación para poder demostrar qué se aceptó y cuándo.
import { supabase } from '../supabaseClient';

export const LEGAL_VERSION = '2026-11-12';

export const LEGAL_DOCS = {
  terms: {
    id: 'terms',
    path: '/terminos',
    title: 'Términos y Condiciones',
    short: 'Términos',
    description: 'Condiciones de uso de LaburamosApp, publicaciones, anuncios, pagos y responsabilidades.',
  },
  privacy: {
    id: 'privacy',
    path: '/privacidad',
    title: 'Política de Privacidad',
    short: 'Privacidad',
    description: 'Qué datos personales tratamos, para qué, por cuánto tiempo y cómo ejercer tus derechos.',
  },
  cookies: {
    id: 'cookies',
    path: '/cookies',
    title: 'Política de Cookies',
    short: 'Cookies',
    description: 'Qué almacenamiento usa LaburamosApp y cómo podés configurar tus preferencias.',
  },
  refund: {
    id: 'refund',
    path: '/reembolsos',
    title: 'Política de Reembolsos y Arrepentimiento',
    short: 'Reembolsos',
    description: 'Cómo pedir un reembolso o ejercer el derecho de arrepentimiento en compras y anuncios.',
  },
};

export const LEGAL_LINKS = [
  { id: 'terms', label: 'Términos y Condiciones' },
  { id: 'privacy', label: 'Política de Privacidad' },
  { id: 'cookies', label: 'Política de Cookies' },
  { id: 'refund', label: 'Reembolsos y arrepentimiento' },
];

// Datos del responsable que el administrador carga en Configuración.
export function legalOperator(settings) {
  return {
    name: (settings?.legal_business_name || '').trim(),
    cuit: (settings?.legal_cuit || '').trim(),
    address: (settings?.legal_address || '').trim(),
    email: (settings?.legal_email || settings?.contact_email || 'laburamosapp@gmail.com').trim(),
    lastUpdate: settings?.legal_last_update || LEGAL_VERSION,
  };
}

export function legalDate(value) {
  const raw = String(value || LEGAL_VERSION);
  const date = new Date(`${raw.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Las dos casillas de cada formulario: Términos y Privacidad, separadas.
export function consentReady(consent) {
  return !!(consent?.terms && consent?.privacy);
}

// Metadatos que viajan con el alta. El trigger handle_new_user los convierte en
// dos filas de legal_acceptances aunque la cuenta quede pendiente de confirmar.
export function registrationLegalData() {
  return {
    legal_terms_version: LEGAL_VERSION,
    legal_privacy_version: LEGAL_VERSION,
    legal_accepted_at: new Date().toISOString(),
  };
}

// Registra una aceptación. Nunca bloquea la acción principal: si falla la red,
// la persona sigue usando la app y el error queda solo en la consola.
export async function recordLegalAcceptance(document, context, method = 'checkbox') {
  if (!document || !context) return false;
  try {
    const { error } = await supabase.rpc('record_legal_acceptance', {
      p_document: document,
      p_version: LEGAL_VERSION,
      p_context: context,
      p_method: method,
    });
    if (error) {
      console.warn('No se pudo registrar la aceptación legal:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('No se pudo registrar la aceptación legal:', error?.message || error);
    return false;
  }
}

// Registra las dos casillas de un formulario. Se llama después de que la acción
// salió bien, para no guardar una aceptación de algo que no llegó a enviarse.
export async function recordLegalConsent(context) {
  await Promise.allSettled([
    recordLegalAcceptance('terms', context),
    recordLegalAcceptance('privacy', context),
  ]);
}

// Abre el panel de preferencias de cookies desde cualquier lugar (pie, política).
export function openCookieSettings() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('laburamos:cookies-open'));
  }
}

export function mailtoLegal(email, subject, body) {
  const to = email || 'laburamosapp@gmail.com';
  const params = new URLSearchParams({ subject, body });
  return `mailto:${to}?${params.toString()}`;
}
