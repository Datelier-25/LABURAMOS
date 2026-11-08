// Ajusta las URLs absolutas del build (canonical, og:url, sitemap y robots)
// al dominio donde se publica. Se ejecuta solo, después de `npm run build`.
//
// En Netlify y Cloudflare Pages se define `VITE_SITE_URL` como variable de
// entorno del sitio, por ejemplo https://laburamosapp.pages.dev.
// Si no está definida, se usa el dominio productivo actual.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const FALLBACK = 'https://laburamosapp.laburos-y-oficios.workers.dev';
const site = (process.env.VITE_SITE_URL || FALLBACK).replace(/\/+$/, '');
const dist = new URL('../dist/', import.meta.url);

const archivos = ['index.html', 'sitemap.xml', 'robots.txt'];
let cambios = 0;

for (const nombre of archivos) {
  const url = new URL(nombre, dist);
  if (!existsSync(url)) continue;
  const original = readFileSync(url, 'utf8');
  const actualizado = original.replaceAll(FALLBACK, site);
  if (actualizado !== original) {
    writeFileSync(url, actualizado);
    cambios++;
  }
}

console.log(`[postbuild] Dominio público: ${site} (${cambios} archivo/s actualizado/s)`);
