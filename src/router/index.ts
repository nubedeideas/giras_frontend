import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/notifs' },
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
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: 'notifs',    name: 'notifs',    component: () => import('@/views/NotificationsView.vue') },
        { path: 'events',    name: 'events',    component: () => import('@/views/EventsView.vue') },
        { path: 'calendar',  name: 'calendar',  component: () => import('@/views/CalendarView.vue') },
        { path: 'contacts',  name: 'contacts',  component: () => import('@/views/ContactsView.vue') },
        { path: 'reports',   name: 'reports',   component: () => import('@/views/ReportsView.vue') },
        { path: 'settings',  name: 'settings',  component: () => import('@/views/SettingsView.vue') },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // If we have a token but no user yet, validate with the API before routing
  if (auth.accessToken && !auth.user && !auth.isDemoMode) {
    await auth.fetchMe()
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) return '/login'
  if (to.name === 'login' && auth.isLoggedIn) return '/notifs'
})

export default router
