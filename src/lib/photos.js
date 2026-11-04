// Fotos de los avisos de servicios: se guardan como ruta dentro del bucket público service-photos.
import { supabase } from '../supabaseClient';

export const SERVICE_PHOTO_BUCKET = 'service-photos';
export const MAX_SERVICE_PHOTOS = 5;

// Ruta guardada en la base -> URL pública. Si ya es una URL (vista previa) la devuelve tal cual.
export function servicePhotoUrl(path) {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  return supabase.storage.from(SERVICE_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Reduce la foto en el navegador antes de subirla (máx. 1400 px, JPEG)
export async function compressImage(file, max = 1400, quality = 0.82) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', quality)
  );
}
