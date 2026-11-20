import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Config separada de vite.config.ts para no arrastrar las opciones de vite-ssg (ssgOptions,
// onPageRendered) al runner de tests.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    env: {
      VITE_API_URL: 'http://api.test/api',
    },
  },
})
