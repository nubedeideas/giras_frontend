import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { transformHtmlTemplate } from '@unhead/vue/server'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  preview: {
    allowedHosts: ['giras.pro', 'www.giras.pro'],
    port: 4173,
    host: true,
  },
  ssgOptions: {
    // Only prerender the public marketing/content routes — everything else needs a live
    // session (dashboard) or is a transient redirect target (auth callbacks), neither of
    // which makes sense as a static snapshot.
    includedRoutes() {
      return ['/', '/terminos-y-condiciones', '/soporte', '/landing']
    },
    // "nested" writes e.g. dist/soporte/index.html instead of dist/soporte.html — required
    // for a standard SPA-fallback static host (nginx `try_files $uri $uri/ /index.html`) to
    // actually serve the prerendered file instead of falling through to the SPA shell.
    dirStyle: 'nested',
    // vite-ssg does not inject @unhead/vue's collected tags into the rendered HTML on its
    // own — main.ts exposes the per-request head client on the shared context (ctx.head) so
    // this hook can merge it into the output (title, meta, canonical, OG, JSON-LD, etc).
    async onPageRendered(_route, renderedHTML, appCtx) {
      if (!appCtx.head) return renderedHTML
      return transformHtmlTemplate(appCtx.head, renderedHTML)
    },
  },
})
