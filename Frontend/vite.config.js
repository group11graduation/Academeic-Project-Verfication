import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

/** Docker Compose service name; override with INTERNAL_API_URL at preview runtime. */
const apiTarget = process.env.INTERNAL_API_URL || 'http://127.0.0.1:5000'

/** Large ZIP uploads + consistency check can take several minutes. */
const longProxy = {
  target: apiTarget,
  changeOrigin: true,
  secure: false,
  timeout: 600_000,
  proxyTimeout: 600_000,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  appType: 'spa',
  server: {
    // Deep links like /teacher/classes/:id/students/:userId must serve index.html
    historyApiFallback: true,
    proxy: {
      '/api': longProxy,
      '/uploads': longProxy,
    },
  },
  preview: {
    historyApiFallback: true,
    // Same-origin /api when PUBLIC_API_URL is empty (browser → :4173 → node-backend)
    proxy: {
      '/api': longProxy,
      '/uploads': longProxy,
    },
  },
})
