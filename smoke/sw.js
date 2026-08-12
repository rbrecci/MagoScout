// Service worker mínimo. Só existe para provar que o host serve .js com o MIME
// certo e que o registro funciona sob HTTPS. O SW de verdade vem na fase 1.

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (e) {
  // Repassa tudo. Nenhum cache nesta fase.
});
