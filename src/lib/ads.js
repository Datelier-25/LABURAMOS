// Anuncios en video: bucket, validaciones y selección aleatoria.
// El precio y los límites se validan otra vez en la base (migración 033).
import { supabase } from '../supabaseClient';

export const AD_VIDEO_BUCKET = 'ad-videos';
export const MAX_AD_BYTES = 52428800; // 50 MB, igual que el bucket
export const AD_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// Ruta guardada en la base -> URL pública. Si ya es una URL (vista previa) la
// devuelve tal cual.
export function adVideoUrl(path) {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  return supabase.storage.from(AD_VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
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
  return { enabled: s.ads_enabled !== false, price, max, min, skip, days, perUser };
}

// Precio de la campaña: segundos por el valor configurado.
export function adPrice(duration, settings) {
  const { price } = adConfig(settings);
  return Math.round(Number(duration || 0) * price * 100) / 100;
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

// Elegir un anuncio al azar. La base devuelve null si no hay ninguno vigente.
export async function pickRandomAd() {
  const { data, error } = await supabase.rpc('pick_random_ad');
  if (error) return null;
  return data || null;
}
