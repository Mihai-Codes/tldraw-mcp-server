import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy REST API calls to the canvas server
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      // Proxy WebSocket connections to the canvas server
      '/ws': {
        target: 'ws://127.0.0.1:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    // Output into dist/public so the Express server can serve it
    outDir: '../dist/public',
    emptyOutDir: true,
  },
  optimizeDeps: {
    // tldraw uses some ESM-only packages
    include: ['react', 'react-dom'],
  },
})
