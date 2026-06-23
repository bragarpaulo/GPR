// sw.js — KILL-SWITCH (service worker desativado de propósito).
// Service workers estavam deixando versões antigas "presas" no navegador (o site abria
// atualizado em janela anônima, mas não no navegador normal, nem com refresh forçado).
// Este SW se autodestrói: ao ativar, limpa TODOS os caches, cancela o próprio registro e
// recarrega as abas. Depois disso não há SW: o site é servido direto da rede e um
// Ctrl+Shift+R sempre pega a versão nova. Sem handler de fetch = nada é interceptado/cacheado.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));   // apaga todo cache antigo (inclusive JS/CSS presos)
    await self.registration.unregister();                  // remove o próprio SW
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) { try { c.navigate(c.url); } catch (_) {} }   // recarrega já sem SW
  } catch (_) {}
})()));
