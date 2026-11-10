// Service worker mínimo: habilita la instalación de la app en el celular.
// No guarda respuestas en caché para no mostrar datos viejos.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
