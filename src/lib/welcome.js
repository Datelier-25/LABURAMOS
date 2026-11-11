// Cartel de bienvenida: imágenes que el administrador carga desde Configuración.
// Se guardan como rutas dentro del bucket público welcome-images.
import { supabase } from '../supabaseClient';

export const WELCOME_BUCKET = 'welcome-images';
export const WELCOME_MAX_IMAGES = 8;
export const WELCOME_MAX_FILE_MB = 12;
export const WELCOME_SLIDE_MS = 5000;

// Ruta guardada en la base -> URL pública. También acepta URLs ya armadas
// (vista previa) y rutas absolutas del sitio.
export function welcomeImageUrl(path) {
  if (!path) return '';
  if (/^(https?:|blob:|data:|\/)/i.test(path)) return path;
  return supabase.storage.from(WELCOME_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Limpia la lista que viene de app_settings: solo textos, sin repetidos y
// con el máximo que permite la interfaz.
export function welcomeImageList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const path = item.trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
    if (out.length >= WELCOME_MAX_IMAGES) break;
  }
  return out;
}
