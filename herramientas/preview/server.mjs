/**
 * Servidor de vista previa sin Vite (equivalente a server.py).
 * Sirve el proyecto y entrega el arnés de `herramientas/preview/harness.html`
 * en `/` y `/__preview.html`. Si un archivo no está en la raíz, lo busca en `public/`.
 *
 * Uso: node herramientas/preview/server.mjs [carpeta] [puerto]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(process.argv[2] || join(HERE, '..', '..'));
const PORT = Number(process.argv[3] || 5199);

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/plain; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safePath(root, pathname) {
  const decoded = decodeURIComponent(pathname);
  const path = normalize(join(root, decoded));
  const rel = relative(root, path);
  if (rel.startsWith('..') || rel.includes(`..${sep}`)) return null;
  return path;
}

async function fileOrPublic(pathname) {
  // El arnés pide imports sin extensión (`./components/Home`); Vite los resuelve.
  // Hacemos lo mismo para que la consola no se llene de 404 esperables.
  const candidates = [pathname];
  if (!/\.[a-z0-9]+$/i.test(pathname)) {
    candidates.push(`${pathname}.jsx`, `${pathname}.js`);
  }

  for (const candidate of candidates) {
    const direct = safePath(ROOT, candidate);
    if (direct) {
      try {
        if ((await stat(direct)).isFile()) return direct;
      } catch {}
    }

    const inPublic = safePath(join(ROOT, 'public'), candidate);
    if (inPublic) {
      try {
        if ((await stat(inPublic)).isFile()) return inPublic;
      } catch {}
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  res.setHeader('Cache-Control', 'no-store');

  if (pathname === '/' || pathname === '/__preview.html') {
    try {
      const body = await readFile(join(HERE, 'harness.html'));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': body.length,
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`No se pudo leer harness.html: ${error.message}`);
    }
    return;
  }

  const file = await fileOrPublic(pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`No se pudo leer ${file}: ${error.message}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Vista previa: http://127.0.0.1:${PORT}/`);
  console.log(`Carpeta: ${ROOT}`);
});
