import type { RouteRecordRaw, Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingView.vue'),
    meta: { public: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('@/views/AuthCallbackView.vue'),
    meta: { public: true },
  },
  {
    path: '/auth/magic-link',
    name: 'auth-magic-link',
    component: () => import('@/views/MagicLinkView.vue'),
    meta: { public: true },
  },
  {
    path: '/landing',
    name: 'marketing-landing',
    component: () => import('@/views/MarketingLandingView.vue'),
    meta: { public: true },
  },
  {
    // /terms and /privacy are the URLs registered in the Google OAuth consent screen: they
    // must answer 200 with the full page (prerendered), so the Spanish paths are aliases that
    // render the same view instead of redirects. Canonical points at the primary path.
    path: '/terms',
    alias: ['/terminos-y-condiciones'],
    name: 'terms',
    component: () => import('@/views/TermsView.vue'),
    meta: { public: true },
  },
  {
    path: '/privacy',
    alias: ['/politica-de-privacidad', '/privacidad'],
    name: 'privacy',
    component: () => import('@/views/PrivacyView.vue'),
    meta: { public: true },
  },
  {
    path: '/soporte',
    name: 'support',
    component: () => import('@/views/SupportView.vue'),
    meta: { public: true },
  },
  {
    // Portal del crew: enlace personal firmado, sin cuenta. Fuera de AppLayout, sin sesión,
    // sin page_view a GTM (el token va en la URL) y sin prerender (no está en includedRoutes).
    path: '/crew/:token',
    name: 'crew-portal',
    component: () => import('@/views/CrewPortalView.vue'),
    meta: { public: true, crew: true },
  },
  {
    // `/crew/` sin token o con sufijos: misma vista, que muestra "enlace no válido" sin llamar
    // a la API. Mismo meta: sin sesión ni page_view.
    path: '/crew/:pathMatch(.*)*',
    name: 'crew-portal-invalid',
    component: () => import('@/views/CrewPortalView.vue'),
    meta: { public: true, crew: true },
  },
  {
    // Enlaces antiguos de WhatsApp/email (`tours/{uuid}/...`) que no tienen ruta propia: en vez
    // de una página en blanco, al dashboard (o a /login sin sesión, por el guard de /home).
    path: '/tours/:pathMatch(.*)*',
    redirect: '/home',
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminView.vue'),
    meta: { requiresAuth: true, requiresSuperuser: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: 'home', name: 'home', component: () => import('@/views/DashboardView.vue') },
      { path: 'events', name: 'events', component: () => import('@/views/EventsView.vue') },
      { path: 'calendar', name: 'calendar', component: () => import('@/views/CalendarView.vue') },
      { path: 'contacts', name: 'contacts', component: () => import('@/views/ContactsView.vue') },
      { path: 'tour', name: 'tour', component: () => import('@/views/TourView.vue') },
      {
        // Revisión de una importación (F1). La vista la completa el lote 2.
        path: 'tour/import/:jobUuid',
        name: 'tour-import',
        component: () => import('@/views/ImportReviewView.vue'),
      },
      { path: 'reports', name: 'reports', component: () => import('@/views/ReportsView.vue') },
      { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    ],
  },
]

/** Registered from main.ts's ViteSSG setup callback, against the router instance it creates. */
export function setupRouterGuards(router: Router) {
  router.beforeEach(async (to) => {
    // Static prerender pass (vite-ssg) — auth state doesn't exist/matter for a static build,
    // the client re-runs this guard for real once it hydrates in the browser.
    if (import.meta.env.SSR) return
    // El portal del crew no toca la sesión: ni fetchMe ni redirecciones por login.
    if (to.meta.crew) return

    const auth = useAuthStore()

    // If we have a token but no user yet, validate with the API before routing
    if (auth.accessToken && !auth.user && !auth.isDemoMode) {
      await auth.fetchMe()
    }

    if (to.meta.requiresAuth && !auth.isLoggedIn) return '/login'
    if (to.meta.requiresSuperuser && !auth.user?.is_superuser) return '/home'
    if ((to.name === 'login' || to.name === 'landing') && auth.isLoggedIn) return '/home'
  })

  // Virtual pageviews for GTM — SPA navigations don't trigger a native page load
  router.afterEach((to) => {
    if (import.meta.env.SSR) return
    // El token del portal del crew no puede llegar a GTM.
    if (to.meta.crew) return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'page_view',
      // El callback de OAuth lleva `code` y `state` de Google en la query: no pueden llegar a GTM.
      page_path: to.name === 'auth-callback' ? to.path : to.fullPath,
      page_title: document.title,
    })
  })
}
