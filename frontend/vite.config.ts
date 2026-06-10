import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy: /api -> uvicorn, so the browser stays same-origin (no CORS, and the
// session cookie stays first-party). nginx does the same in the Docker build.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 127.0.0.1, not "localhost": Node 18 prefers IPv6 (::1) but uvicorn binds
        // IPv4, which would ECONNREFUSED.
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
