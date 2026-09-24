import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    host: '0.0.0.0', port: 5173,
    allowedHosts: ['.e2b.app', 'localhost'],
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } },
  },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 900 },
})
