import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      // Script Writer Service Routes (Port 5003)
      '/api/script': { target: 'http://localhost:5003', changeOrigin: true },
      '/api/voice': { target: 'http://localhost:5003', changeOrigin: true },
      '/api/bible': { target: 'http://localhost:5003', changeOrigin: true },
      '/api/scene': { target: 'http://localhost:5003', changeOrigin: true },
      '/api/character': { target: 'http://localhost:5003', changeOrigin: true },
      '/api/treatment': { target: 'http://localhost:5003', changeOrigin: true },

      // Main Backend (Catch-all for other /api)
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
