# Prompt para tu IA

Copiá todo lo que está dentro del bloque de abajo y pegalo en tu IA, en la carpeta del proyecto
(`laburamos_rediseno`, descomprimida desde el zip).

```text
Quiero que apliques las mejoras de LaburamosApp en mi proyecto de Supabase y que compruebes que todo funciona. Seguí el archivo PASO_A_PASO.md de esta carpeta, en orden, y no hagas nada que no esté ahí.

Reglas:
- Trabajá primero en el proyecto de DESARROLLO de Supabase. No toques producción hasta que yo te diga.
- No modifiques el código fuente, salvo que un paso lo pida explícitamente.
- No borres datos. Las migraciones 036, 037 y 038 solo agregan o cambian estructuras; la 037 agrega la función de eliminar cuenta, que no se ejecuta sola.
- Si una consulta de verificación no devuelve lo esperado, DETENETE y mostrame el resultado. No improvises correcciones.

Orden:
1. Paso 0: verificá que las migraciones 033, 034 y 035 ya estén aplicadas. Si falta alguna, avisame antes de seguir.
2. Paso 1: en la carpeta del proyecto, ejecutá `npm install` y `npm run build`. Tiene que terminar con "built in".
3. Paso 2: migración 036 (supabase/migrations/036_anuncios_metricas.sql). Comprobá primero si ya está aplicada con la consulta del paso. Si no, pegá el archivo completo en el SQL Editor y ejecutalo una vez. Después corré la verificación de permisos.
4. Paso 3: migración 037 (supabase/migrations/037_eliminar_mi_cuenta.sql). Mismo procedimiento y verificaciones.
5. Paso 4: migración 038 (supabase/migrations/038_anuncios_imagen.sql). Mismo procedimiento y verificaciones.
6. Paso 5: verificá la configuración de Supabase: buckets (cv-photos debe ser privado), políticas de storage de anuncios, valores de precios en app_settings, permisos de las funciones (ninguna para anon) y la Site URL de autenticación. Si algo no coincide, avisame sin cambiarlo.
7. Paso 6: no lo podés hacer vos (es una prueba en el navegador). Dejalo listado para que lo haga yo.

Al terminar, dame un informe con este formato:
- Migraciones: para 036, 037 y 038, si se aplicaron sin errores, si ya estaban aplicadas, y el resultado de cada verificación.
- Build: si terminó con "built in" y si hubo errores.
- Supabase: resultado de cada consulta del paso 5 (buckets, políticas, precios, permisos y Site URL).
- Pendientes: lo que quedó sin hacer y por qué.
- Errores: el mensaje completo de cualquier error, sin resumir.
```

## Antes de pasar a producción

Cuando el paso 6 esté probado en desarrollo, repetí el paso 2 al 5 en producción, en el mismo orden, y publicá el frontend (paso 7).
Antes de aplicar la 037 o la 038 en producción, pedí un respaldo a Supabase.
