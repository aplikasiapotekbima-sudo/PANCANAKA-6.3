import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // Listen on all network interfaces (LAN access)
    port: 5173,
    strictPort: false,  // Auto-increment port if 5173 is busy
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
