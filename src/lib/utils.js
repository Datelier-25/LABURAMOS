// Constantes y funciones compartidas de Laburamos

export const JOB_CATEGORIES = ['Comercio', 'Gastronomía', 'Agro / Campo', 'Oficios / Técnico', 'Administración', 'Salud y cuidados', 'Transporte', 'Moda', 'Otros'];
export const JOB_TYPES = ['Full-time', 'Part-time', 'Por horas', 'Temporal', 'Changa'];
// Formas de cobro que acepta el aviso laboral. "A convenir" es explícito y no
// exige monto.
export const JOB_PAY_TYPES = ['Por hora', 'Por día', 'Por semana', 'Por mes', 'Por trabajo', 'A convenir'];
export const SERVICE_CATEGORIES = ['Oficios', 'Profesionales', 'Clases particulares', 'Cuidados', 'Limpieza', 'Tecnología', 'Eventos', 'Moda', 'Otros'];
// Un servicio puede ser alguien que ofrece su oficio o alguien que busca quién le haga un trabajo
export const INTENTS = { ofrece: 'Ofrece', busca: 'Busca' };
export const intentOf = (s) => (s?.intent === 'busca' ? 'busca' : 'ofrece');
// Modalidades de cobro de la descarga del CV (las define el administrador)
export const PAY_MODES = {
  por_descarga: 'Una descarga por pago',
  por_dias: 'Descargas ilimitadas por días',
  para_siempre: 'Pago único para siempre',
};
export const money = (n) => `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

export const AVAILABILITY = ['Jornada completa', 'Media jornada', 'Turno mañana', 'Turno tarde', 'Fines de semana', 'Por horas / changas'];

// Color de cada rubro (clases t-* definidas en index.css)
const TONES = {
  Comercio: 'ultra',
  Gastronomía: 'tomato',
  'Agro / Campo': 'field',
  'Oficios / Técnico': 'sun',
  Administración: 'violet',
  'Salud y cuidados': 'pink',
  Transporte: 'sky',
  Oficios: 'sun',
  Profesionales: 'ultra',
  'Clases particulares': 'violet',
  Cuidados: 'pink',
  Limpieza: 'sky',
  Tecnología: 'field',
  Eventos: 'tomato',
  Moda: 'pink',
};
export const toneOf = (category) => `t-${TONES[category] || 'stone'}`;

// Emoji del frente de la tarjeta cuando el aviso no tiene foto ni emote elegido.
// Cuando llegue el set de 60 PNGs, este valor se reemplaza por el emote elegido.
const CATEGORY_EMOJI = {
  Comercio: '🏪',
  Gastronomía: '🍳',
  'Agro / Campo': '🌾',
  'Oficios / Técnico': '🔧',
  Administración: '🧾',
  'Salud y cuidados': '🩺',
  Transporte: '🚚',
  Moda: '🧵',
  Oficios: '🔧',
  Profesionales: '💼',
  'Clases particulares': '📚',
  Cuidados: '🤝',
  Limpieza: '🧽',
  Tecnología: '💻',
  Eventos: '🎉',
};
export const emojiOf = (category) => CATEGORY_EMOJI[category] || '✨';

const NAME_TONES = ['ultra', 'sun', 'tomato', 'field', 'violet', 'pink', 'sky'];
export function toneFromName(name = '') {
  const n = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return `t-${NAME_TONES[n % NAME_TONES.length]}`;
}

export function initials(name = '') {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] ? w[0].toUpperCase() : ''))
    .join('');
  return letters || '?';
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Edad a partir de la fecha de nacimiento (AAAA-MM-DD)
export function ageFrom(birth) {
  if (!birth) return null;
  const b = new Date(`${birth}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

// Deja solo los 10 dígitos nacionales: sin +54, sin 9, sin 0 inicial y sin el 15.
// Ej: "0 2342 15-112233" -> "2342112233"
export function cleanPhone(raw = '') {
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('549')) d = d.slice(3);
  else if (d.startsWith('54')) d = d.slice(2);
  d = d.replace(/^0+/, '');
  if (d.length === 12) {
    for (const area of [4, 3, 2]) {
      if (d.slice(area, area + 2) === '15') {
        d = d.slice(0, area) + d.slice(area + 2);
        break;
      }
    }
  }
  return d;
}

export const isValidPhone = (raw) => /^\d{10}$/.test(cleanPhone(raw));

// Enlace de WhatsApp con el texto correctamente codificado
export function waLink(phone, text = '') {
  return `https://wa.me/549${cleanPhone(phone)}?text=${encodeURIComponent(text)}`;
}

// Enlace de correo con asunto y cuerpo ya codificados.
export function mailtoLink(email, subject = '', body = '') {
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${email}${params.length ? `?${params.join('&')}` : ''}`;
}

export const isValidEmail = (raw = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw).trim());

// Requisitos del aviso: texto limpio, sin ítems vacíos y con un tope de 10.
export const cleanRequirementItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({ text: String(item?.text ?? '').trim(), required: !!item?.required }))
    .filter((item) => item.text)
    .slice(0, 10);

// Compartir el aviso con quien uno quiera: link público (no el WhatsApp de quien
// publica). Usa el menú nativo del sistema si existe; si no, copia el link y abre
// WhatsApp sin destinatario para elegir el contacto.
export async function shareListing({ title, text, url }) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancel';
      // si el menú nativo falla, seguimos con el respaldo
    }
  }
  let copied = false;
  try {
    await navigator.clipboard.writeText(url);
    copied = true;
  } catch {
    // sin permiso de portapapeles: el mensaje de WhatsApp lleva el link igual
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener');
  return copied ? 'copied' : 'opened';
}

export function timeAgo(iso) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return 'hace un rato';
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  const m = Math.floor(d / 30);
  return `hace ${m} ${m === 1 ? 'mes' : 'meses'}`;
}

export function daysLeft(iso) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

// Traduce errores técnicos a mensajes claros
export function friendlyError(message = '') {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Tenés que confirmar tu email antes de ingresar. Revisá tu bandeja de entrada y el spam.';
  if (m.includes('already registered')) return 'Ese email ya está registrado. Probá iniciar sesión.';
  if (m.includes('at least 6')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('rate limit')) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
  if (m.includes('permission denied')) return 'No tenés permiso para hacer esto. Si el problema sigue, avisanos.';
  if (m.includes('no_permitido')) return 'No tenés permiso para modificar este aviso.';
  if (m.includes('no_podes_bloquearte')) return 'No podés bloquear tu propia cuenta.';
  if (m.includes('duplicate key')) return 'Ya calificaste esta postulación.';
  if (m.includes('estado_invalido') || m.includes('tipo_invalido')) return 'No se pudo cambiar el aviso. Probá de nuevo.';
  if (m.includes('row-level security')) return 'Tu cuenta no tiene permiso para hacer esto.';
  if (m.includes('aviso_no_disponible')) return 'Este aviso ya no está disponible.';
  if (m.includes('email_invalido')) return 'Revisá el email: tiene que ser una dirección válida.';
  if (m.includes('requisito')) return 'Revisá los requisitos: cada uno tiene que tener un texto de hasta 200 caracteres.';
  if (m.includes('medio_invalido')) return 'Elegí WhatsApp o email para recibir las postulaciones.';
  if (m.includes('no_encontrado')) return 'No encontramos esa publicación: puede que ya la hayan eliminado.';
  if (m.includes('phone')) return 'Revisá el número de WhatsApp.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sin conexión. Revisá tu internet e intentá de nuevo.';
  return message || 'Ocurrió un error inesperado.';
}
