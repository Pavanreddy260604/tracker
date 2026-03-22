// Basic Service Worker to satisfy PWA installability requirements
const CACHE_NAME = 'learning-os-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() => {
            if (event.request.mode === 'navigate') {
                return new Response('Offline', {
                    status: 503,
                    statusText: 'Offline',
                    headers: { 'Content-Type': 'text/plain' },
                });
            }

            return new Response('', {
                status: 503,
                statusText: 'Offline',
            });
        })
    );
});
