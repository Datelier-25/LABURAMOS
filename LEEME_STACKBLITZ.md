# Pasar LaburamosApp a StackBlitz

El proyecto **no está subido** a StackBlitz todavía. Esta carpeta ya está
preparada para importarla; solo falta crear el proyecto y pegar la
configuración de Supabase.

## 1. Crear el proyecto en StackBlitz

1. Entrá a <https://stackblitz.com/> e iniciá sesión.
2. Creá un proyecto **Vite** (o un proyecto JavaScript en blanco).
3. En el explorador de archivos de StackBlitz, borrá los archivos de ejemplo.
4. Descomprimí `LaburamosApp_stackblitz.zip` en tu computadora.
5. Abrí la carpeta descomprimida y **arrastrá todo su contenido** al
   explorador de archivos de StackBlitz (raíz del proyecto). StackBlitz acepta
   arrastrar archivos y carpetas; no hace falta GitHub.
6. Esperá a que termine `npm install`.
7. En la terminal de StackBlitz ejecutá:

   ```bash
   npm run dev
   ```

   StackBlitz suele abrir el preview solo. Si no, usá el botón de preview.

> Si preferís GitHub: subí esta carpeta a un repositorio y abrí
> `https://stackblitz.com/github/TU_USUARIO/TU_REPO?startScript=dev`.

## 2. Crear el Supabase nuevo

Seguí **[supabase/INSTALACION_NUEVA.md](supabase/INSTALACION_NUEVA.md)**.
Resumen:

1. Crear un proyecto Supabase nuevo y vacío (no el de Workeo).
2. En el SQL Editor, ejecutar una de estas dos opciones:
   - **Rápida:** `supabase/migrations/000_instalacion_completa.sql`.
   - **Por partes, en orden:** `001_base_laburamos.sql`, `003_...sql`,
     `004_...sql` y `005_grants_laburamos.sql`.
3. Configurar Auth (Site URL y Redirect URLs con la URL del preview de
   StackBlitz).
4. Copiar la URL y la clave pública `anon` del proyecto nuevo.

## 3. Crear el `.env` en StackBlitz

En la raíz del proyecto (al lado de `package.json`), creá un archivo `.env`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_PUBLIC_KEY
```

Reiniciá el preview o el proyecto de StackBlitz. La pantalla "Falta conectar
Supabase" tiene que desaparecer y la app tiene que permitir registro/login.

**No pongas la `service_role`.** La app solo usa la clave pública.

## 4. Probar

1. Registrate con una cuenta.
2. En Supabase → SQL Editor, hacete administrador:

   ```sql
   update public.profiles
      set is_admin = true
    where id = (select id from auth.users where email = 'TU_EMAIL');
   ```

3. Cerrá sesión y volvé a entrar.
4. Probá publicar, postularte, ver postulantes, editar el CV y entrar a Admin.

## Notas

- La vista previa local con datos de ejemplo sigue funcionando con
  `npm run preview:mock`; no usa Supabase.
- StackBlitz genera una URL distinta cada vez. Si cambiás de preview, actualizá
  **Site URL** y **Redirect URLs** en Supabase Auth.
- El cobro del CV y Mercado Pago quedan desactivados hasta que el resto esté
  probado. No publiques las Edge Functions todavía.
