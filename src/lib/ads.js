// Anuncios de video e imagen: buckets, validaciones y selección aleatoria.
// El precio y los límites se validan otra vez en la base (migraciones 033 y 038).
import { supabase } from '../supabaseClient';

export const AD_VIDEO_BUCKET = 'ad-videos';
export const MAX_AD_BYTES = 52428800; // 50 MB, igual que el bucket
export const AD_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export const AD_IMAGE_BUCKET = 'ad-images';
export const MAX_AD_IMAGE_BYTES = 5242880; // 5 MB, igual que el bucket
export const AD_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Ruta guardada en la base -> URL pública. Si ya es una URL (vista previa) la
// devuelve tal cual.
export function adVideoUrl(path) {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  return supabase.storage.from(AD_VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function adImageUrl(path) {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  return supabase.storage.from(AD_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Valida una imagen antes de subirla.
export function validateAdImageFile(file) {
  if (!file) return 'Elegí la imagen del anuncio.';
  if (!AD_IMAGE_MIME_TYPES.includes(file.type)) return 'La imagen tiene que ser JPG, PNG o WebP.';
  if (file.size > MAX_AD_IMAGE_BYTES) return 'La imagen no puede superar los 5 MB.';
  if (file.size <= 0) return 'El archivo está vacío. Probá con otra imagen.';
  return '';
}

// Medidas de la imagen en el navegador (para mostrar la vista previa y avisar si es muy chica).
export function probeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const info = { width: img.naturalWidth, height: img.naturalHeight, url };
      resolve(info);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagen_invalida'));
    };
    img.src = url;
  });
}

export function adImageExtension(file) {
  if (file?.type === 'image/png') return 'png';
  if (file?.type === 'image/webp') return 'webp';
  return 'jpg';
}

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

// Lee la configuración de anuncios con valores seguros para la pantalla.
export function adConfig(settings) {
  const s = settings || {};
  const max = Math.min(Math.max(int(s.ads_max_seconds, 30), 5), 30);
  const min = Math.min(Math.max(int(s.ads_min_seconds, 5), 1), max);
  const skip = Math.min(Math.max(int(s.ads_skip_seconds, 5), 0), max);
  const days = Math.min(Math.max(int(s.ads_days, 30), 1), 365);
  const perUser = Math.min(Math.max(int(s.ads_max_per_user, 3), 1), 20);
  const rawPrice = Number(s.ads_price_per_second);
  const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 100;
  const rawImage = Number(s.ads_price_image);
  const priceImage = Number.isFinite(rawImage) && rawImage > 0 ? rawImage : 5000;
  const imageSeconds = Math.min(Math.max(int(s.ads_image_seconds, 8), 3), 30);
  return { enabled: s.ads_enabled !== false, price, priceImage, imageSeconds, max, min, skip, days, perUser };
}

// Precio de la campaña de video: segundos por el valor configurado.
export function adPrice(duration, settings) {
  const { price } = adConfig(settings);
  return Math.round(Number(duration || 0) * price * 100) / 100;
}

// Precio de la campaña de imagen: monto fijo configurado por el admin.
export function adPriceImage(settings) {
  return adConfig(settings).priceImage;
}

// Valida el archivo antes de subirlo.
export function validateAdFile(file) {
  if (!file) return 'Elegí el video del anuncio.';
  if (!AD_MIME_TYPES.includes(file.type)) return 'El video tiene que ser MP4, WebM o MOV.';
  if (file.size > MAX_AD_BYTES) return 'El video no puede superar los 50 MB.';
  if (file.size <= 0) return 'El archivo está vacío. Probá con otro video.';
  return '';
}

// Valida la duración real del video contra la configuración.
export function validateAdDuration(duration, settings) {
  const { min, max } = adConfig(settings);
  if (!Number.isFinite(Number(duration)) || Number(duration) <= 0) return 'No pudimos leer la duración del video.';
  if (Number(duration) < min || Number(duration) > max) {
    return `El video tiene que durar entre ${min} y ${max} segundos.`;
  }
  return '';
}

// Lee la duración y el tamaño del video en el navegador, sin subirlo.
export function probeVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const duration = Number(video.duration);
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(duration) || duration <= 0) reject(new Error('duracion_invalida'));
      else resolve({ duration, width, height });
    };
    const fail = () => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      reject(new Error('video_invalido'));
    };
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) finish();
      else {
        // Algunos navegadores informan Infinity hasta hacer un seek.
        video.ontimeupdate = () => {
          video.ontimeupdate = null;
          finish();
        };
        try {
          video.currentTime = 1e101;
        } catch {
          finish();
        }
      }
    };
    video.onerror = fail;
    video.src = url;
  });
}

// Extensión para guardar el archivo en el bucket.
export function adVideoExtension(file) {
  const name = String(file?.name || '');
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (['mp4', 'webm', 'mov'].includes(ext)) return ext;
  if (file?.type === 'video/webm') return 'webm';
  if (file?.type === 'video/quicktime') return 'mov';
  return 'mp4';
}

// Frecuencia: después de mostrar un anuncio, este navegador no vuelve a mostrar otro
// durante AD_COOLDOWN_MINUTES (0 = siempre). Así no aparece un video antes de cada acción.
export const AD_COOLDOWN_MINUTES = 10;
const LAST_SHOWN_KEY = 'laburamos_anuncio_ultimo';

export function adCooldownActive() {
  try {
    const last = Number(localStorage.getItem(LAST_SHOWN_KEY) || 0);
    return !!last && Date.now() - last < AD_COOLDOWN_MINUTES * 60 * 1000;
  } catch {
    return false;
  }
}

export function markAdShown() {
  try {
    localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
  } catch {
    /* sin almacenamiento: se muestra cada vez */
  }
}

// Últimos anuncios mostrados en este navegador (para no repetir el mismo dos veces seguidas).
const SEEN_KEY = 'laburamos_anuncios_vistos';
const RECENT_KEEP = 3; // no repetir ninguno de los últimos 3
const PICK_TRIES = 4; // intentos máximos para encontrar uno distinto

function recentIds() {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Elegir un anuncio al azar. La base devuelve null si no hay ninguno vigente.
// Si la base devuelve uno de los últimos vistos y hay otros, vuelve a sortear
// (la base no expone la lista, así que se reintenta un número limitado de veces).
export async function pickRandomAd() {
  const recent = recentIds();
  let first = null;
  for (let i = 0; i < PICK_TRIES; i++) {
    const { data, error } = await supabase.rpc('pick_random_ad');
    if (error || !data) break;
    if (!first) first = data;
    if (!recent.includes(data.id)) {
      rememberAd(data.id, recent);
      return data;
    }
  }
  // Si todos los sorteos repitieron, mostramos el primero igual (hay pocos anuncios).
  if (first) rememberAd(first.id, recent);
  return first;
}

function rememberAd(id, recent) {
  try {
    const next = [id, ...recent.filter((x) => x !== id)].slice(0, RECENT_KEEP);
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* sin almacenamiento: no pasa nada, solo no se recuerda */
  }
}

// Métricas: se registran sin bloquear la pantalla. Si la migración 036 todavía no
// está aplicada en la base, el error se ignora y el anuncio igual funciona.
export function registerAdEvent(adId, kind) {
  if (!adId) return;
  supabase.rpc('register_ad_event', { p_ad: adId, p_kind: kind }).then(
    () => {},
    () => {}
  );
}

// Totales por campaña del usuario actual: { [ad_id]: { shown, clicked, last_shown } }
export async function fetchMyAdStats() {
  const { data, error } = await supabase.rpc('my_ad_stats');
  if (error || !Array.isArray(data)) return {};
  return Object.fromEntries(data.map((r) => [r.ad_id, r]));
}
