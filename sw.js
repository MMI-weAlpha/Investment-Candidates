// Minimaler Service Worker: Netzwerk zuerst, damit Daten immer aktuell sind.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
