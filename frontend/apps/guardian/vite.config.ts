import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'WISH Guardian',
        short_name: 'WISH',
        theme_color: '#ffffff',
        icons: [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 3002 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    passWithNoTests: true,
  },
})
