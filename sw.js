// sw.js — SW seguro: NUNCA serve JS/CSS do cache (sempre rede, no-store), evitando misturar
// arquivos novos com antigos. Só a "casca" HTML tem cache para abrir offline. Ao ativar (ex.:
// substituindo uma versão antiga que cacheava JS), limpa tudo e recarrega as abas — transição limpa.
const CACHE = 'gpr-shell-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));   // remove caches de JS antigos
  await self.clients.claim();
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const c of clients) { try { c.navigate(c.url); } catch (e) {} }            // recarrega já sob o SW novo
})()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // CDNs seguem o fluxo normal do navegador
  const ehNavegacao = req.mode === 'navigate';
  e.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((resp) => {
        if (ehNavegacao && resp && resp.ok) { const cl = resp.clone(); caches.open(CACHE).then((c) => c.put('/', cl)); }
        return resp;
      })
      .catch(() => ehNavegacao ? caches.match('/') : Promise.reject(new Error('offline')))
  );
});
