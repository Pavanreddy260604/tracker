import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()
function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
}

async function cleanupServiceWorkers() {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  if (!registrations.length) {
    sessionStorage.removeItem('sw-cleanup-reload');
    return false;
  }

  await Promise.all(
    registrations.map((registration) =>
      registration.unregister().catch((error) => {
        console.warn('Failed to unregister service worker:', error);
      })
    )
  );

  if ('caches' in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(
      cacheKeys.map((key) =>
        caches.delete(key).catch((error) => {
          console.warn('Failed to delete cache:', error);
          return false;
        })
      )
    );
  }

  if (!sessionStorage.getItem('sw-cleanup-reload')) {
    sessionStorage.setItem('sw-cleanup-reload', '1');
    window.location.reload();
    return true;
  }

  sessionStorage.removeItem('sw-cleanup-reload');
  return false;
}

cleanupServiceWorkers()
  .then((reloaded) => {
    if (!reloaded) {
      renderApp();
    }
  })
  .catch((error) => {
    console.warn('Service worker cleanup failed:', error);
    renderApp();
  })
