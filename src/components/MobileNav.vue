<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { userInitials } from '@/utils/userInitials'

const route = useRoute()
const { t } = useI18n()
const auth = useAuthStore()

// 5 pestañas: Inicio · Actividades · Calendario · Contactos · Ajustes (avatar).
// El selector de gira está en el header; Informes se abre desde el dashboard y el sidebar.
const navItems = [
  {
    to: '/home',
    label: 'nav.home',
    icon: `<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>`,
  },
  {
    to: '/events',
    label: 'nav.events',
    icon: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>`,
  },
  {
    to: '/calendar',
    label: 'nav.cal',
    icon: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  },
  {
    to: '/contacts',
    label: 'nav.contacts',
    icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>`,
  },
]

function isActive(to: string) {
  // Inicio exacto por nombre de ruta (no startsWith) frente a futuras rutas /home/*.
  if (to === '/home') return route.name === 'home'
  return route.path.startsWith(to)
}

const settingsActive = computed(() => route.path.startsWith('/settings'))

const initials = computed(() => userInitials(auth.user))
</script>

<template>
  <nav
    class="sidebar-dark lg:hidden fixed bottom-0 left-0 right-0 bg-bg-3 border-t border-line flex z-[100]"
    style="padding-bottom: env(safe-area-inset-bottom)"
    data-test="mobile-nav"
  >
    <RouterLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="flex-1 min-w-0 min-h-[56px] py-2 flex flex-col items-center justify-center gap-1 no-underline transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-acid"
      :class="isActive(item.to) ? 'text-ink' : 'text-ink-2 hover:text-ink'"
      data-test="mobile-nav-link"
    >
      <span
        class="flex items-center justify-center w-10 h-7 rounded-full transition-colors duration-200"
        :class="isActive(item.to) ? 'bg-acid text-night' : ''"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          v-html="item.icon"
        />
      </span>
      <span
        class="text-[12px] leading-tight truncate max-w-full px-0.5"
        :class="isActive(item.to) ? 'font-semibold' : 'font-medium'"
      >{{ t(item.label) }}</span>
    </RouterLink>

    <!-- Ajustes: avatar del usuario en lugar del engranaje -->
    <RouterLink
      to="/settings"
      class="flex-1 min-w-0 min-h-[56px] py-2 flex flex-col items-center justify-center gap-1 no-underline transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-acid"
      :class="settingsActive ? 'text-ink' : 'text-ink-2 hover:text-ink'"
      data-test="mobile-nav-link"
    >
      <span class="flex items-center justify-center h-7">
        <span
          class="w-[26px] h-[26px] rounded-full overflow-hidden bg-acid flex items-center justify-center flex-shrink-0"
          :class="settingsActive ? 'ring-2 ring-acid ring-offset-2 ring-offset-night' : ''"
          data-test="mobile-nav-avatar"
        >
          <img
            v-if="auth.user?.avatar"
            :src="auth.user.avatar"
            alt=""
            class="w-full h-full object-cover"
          >
          <span
            v-else
            class="text-[11px] font-bold text-night"
          >{{ initials }}</span>
        </span>
      </span>
      <span
        class="text-[12px] leading-tight truncate max-w-full px-0.5"
        :class="settingsActive ? 'font-semibold' : 'font-medium'"
      >{{ t('header.settings') }}</span>
    </RouterLink>
  </nav>
</template>
