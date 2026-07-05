import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy API + auth routes to the backend so the httpOnly auth cookie is
// treated as same-origin (avoids CORS and lets credentials flow through).
const backend = 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': { target: backend, changeOrigin: true },
      '/repositories': { target: backend, changeOrigin: true },
      '/rules': { target: backend, changeOrigin: true },
    },
  },
})
