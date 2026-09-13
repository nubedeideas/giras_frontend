import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import { createHead as createClientHead } from '@unhead/vue/client'
import { createHead as createServerHead } from '@unhead/vue/server'
import App from './App.vue'
import { routes, setupRouterGuards } from './router'
import i18n from './i18n'
import { useUIStore } from '@/stores/ui'
import './assets/main.css'
import 'flag-icons/css/flag-icons.min.css'

export const createApp = ViteSSG(
  App,
  {
    routes,
    scrollBehavior(to, _from, savedPosition) {
      if (savedPosition) return savedPosition
      if (to.hash) return { el: to.hash, behavior: 'smooth' }
      return { top: 0 }
    },
  },
  (ctx) => {
    const { app, router, isClient } = ctx
    const pinia = createPinia()
    app.use(pinia)
    app.use(i18n)

    const head = import.meta.env.SSR ? createServerHead() : createClientHead()
    app.use(head)
    // Exposed on the shared SSG context so vite.config.ts's onPageRendered hook can read the
    // collected tags back out and inject them into the prerendered HTML — vite-ssg doesn't do
    // this automatically, see https://github.com/antfu-collective/vite-ssg's head handling.
    ctx.head = head

    setupRouterGuards(router)

    if (isClient) {
      // Bootstrap theme — reads localStorage / OS preference. The store watcher applies
      // data-theme to <html> on init. Browser-only, must not run during the SSG render pass.
      useUIStore()
    }
  },
)
