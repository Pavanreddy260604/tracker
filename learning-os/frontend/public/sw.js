// Basic Service Worker to satisfy PWA installability requirements
const CACHE_NAME = 'learning-os-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Pass-through fetch to satisfy requirement without complex caching yet
    event.respondWith(fetch(event.request));
});
