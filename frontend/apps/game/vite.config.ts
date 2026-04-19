import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 3001 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    passWithNoTests: true,
  },
})
