import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase.
// La URL y la clave "publishable" (anon) son públicas: viajan en el bundle del
// navegador y la seguridad la dan las políticas RLS de la base. Las dejamos como
// respaldo para que la app funcione en cualquier entorno (StackBlitz, previews,
// builds sin .env) sin mostrar la pantalla de "Falta conectar Supabase".
// Si hay variables de entorno, siempre tienen prioridad.
const DEFAULT_SUPABASE_URL = 'https://fcfomffkmxcakqmbugje.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_9u1GPSGLEnJ5lUy71wFw1Q_rYZZfr8G';

const env = import.meta.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Sólo se muestra la pantalla de configuración si no hay ni variables de entorno
// ni valores por defecto (por ejemplo, si alguien vacía los de arriba).
const hasViteEnv = typeof import.meta !== 'undefined' && Boolean(import.meta.env);
export const supabaseConfigMissing = hasViteEnv && !supabaseConfigured;

if (hasViteEnv && !supabaseConfigured) {
  console.warn(
    'LaburamosApp: faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. ' +
      'Creá un archivo .env en la raíz (copiá .env.example) y reiniciá Vite. ' +
      'La app no va a poder iniciar sesión ni leer datos hasta configurarlo.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
