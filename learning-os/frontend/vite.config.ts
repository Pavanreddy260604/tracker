import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    modulePreload: {
      resolveDependencies: (_url, deps) =>
        deps.filter((dep) => !dep.includes('charts-') && !dep.includes('markdown-')),
    },
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          markdown: ['react-markdown', 'remark-gfm', 'react-syntax-highlighter'],
          flow: ['@xyflow/react'],
          editor: ['@monaco-editor/react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true, // Listen on all network interfaces (allows mobile device access)
    allowedHosts: true, // Allow ngrok and other tunnels to bypass the Host header check
    proxy: {
      // Script Writer Service Routes (Port 5003)
      '/api/script': { target: 'http://localhost:5003', changeOrigin: true },

      // Main Backend (Catch-all for other /api)
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
