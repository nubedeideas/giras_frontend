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
    path: '/terminos-y-condiciones',
    name: 'terms',
    component: () => import('@/views/TermsView.vue'),
    meta: { public: true },
  },
  {
    path: '/soporte',
    name: 'support',
    component: () => import('@/views/SupportView.vue'),
    meta: { public: true },
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
      {
        path: 'notifs',
        name: 'notifs',
        component: () => import('@/views/NotificationsView.vue'),
      },
      { path: 'events', name: 'events', component: () => import('@/views/EventsView.vue') },
      { path: 'calendar', name: 'calendar', component: () => import('@/views/CalendarView.vue') },
      { path: 'contacts', name: 'contacts', component: () => import('@/views/ContactsView.vue') },
      { path: 'tour', name: 'tour', component: () => import('@/views/TourView.vue') },
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

    const auth = useAuthStore()

    // If we have a token but no user yet, validate with the API before routing
    if (auth.accessToken && !auth.user && !auth.isDemoMode) {
      await auth.fetchMe()
    }

    if (to.meta.requiresAuth && !auth.isLoggedIn) return '/login'
    if (to.meta.requiresSuperuser && !auth.user?.is_superuser) return '/notifs'
    if ((to.name === 'login' || to.name === 'landing') && auth.isLoggedIn) return '/notifs'
  })

  // Virtual pageviews for GTM — SPA navigations don't trigger a native page load
  router.afterEach((to) => {
    if (import.meta.env.SSR) return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'page_view',
      page_path: to.fullPath,
      page_title: document.title,
    })
  })
}
