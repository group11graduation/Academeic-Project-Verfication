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
  /** Avoid buffering entire multipart bodies in the proxy (large screenshot batches). */
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq, req) => {
      // Ensure long-lived upload sockets are not cut early by Node defaults.
      if (req.socket) {
        req.socket.setTimeout(600_000);
      }
      if (proxyReq.socket) {
        proxyReq.socket.setTimeout(600_000);
      }
    });
    proxy.on('error', (err, _req, res) => {
      if (res && !res.headersSent && typeof res.writeHead === 'function') {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            message:
              'Upload proxy lost connection to the API. Wait a few seconds and try again with smaller screenshot files (under 10 MB each).',
          })
        );
      }
      console.error('[vite proxy]', err?.message || err);
    });
  },
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
    host: '0.0.0.0',
    port: 4173,
    // Do not block proxied API hosts (node-backend) when Host header is an IP/domain.
    allowedHosts: true,
    historyApiFallback: true,
    // Same-origin /api when API_URL is empty (browser → :4173 → node-backend)
    proxy: {
      '/api': longProxy,
      '/uploads': longProxy,
      '/health': longProxy,
    },
  },
})
