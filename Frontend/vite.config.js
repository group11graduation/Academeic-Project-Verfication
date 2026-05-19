import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

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
  },
  preview: {
    historyApiFallback: true,
  },
})
