import { createClient } from '@supabase/supabase-js';

// Configuración obligatoria. No dejamos una URL de respaldo: la base anterior
// es la de Workeo y su esquema NO es compatible con LaburamosApp.
// En Vite `import.meta.env` existe; en la vista previa con datos mock el módulo
// de Supabase se reemplaza completo, así que esto no afecta esa vista.
const env = import.meta.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// En Vite `import.meta.env` existe. En la vista previa con el harness de datos
// mock no existe; ahí no mostramos la pantalla de configuración.
const hasViteEnv = typeof import.meta !== 'undefined' && Boolean(import.meta.env);
export const supabaseConfigMissing = hasViteEnv && !supabaseConfigured;

if (hasViteEnv && !supabaseConfigured) {
  console.warn(
    'LaburamosApp: faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. ' +
      'Creá un archivo .env en la raíz (copiá .env.example) y reiniciá Vite. ' +
      'La app no va a poder iniciar sesión ni leer datos hasta configurarlo.'
  );
}

// El cliente necesita valores no vacíos para construirse. Si falta la
// configuración usamos un destino inerte y mostramos el aviso de arriba; así la
// app puede renderizar la pantalla de ingreso en lugar de quedar en blanco.
export const supabase = createClient(
  supabaseUrl || 'https://configuracion-pendiente.supabase.co',
  supabaseAnonKey || 'configuracion-pendiente'
);
