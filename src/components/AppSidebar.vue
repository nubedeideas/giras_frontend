<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import logoIcon from '@/assets/logo-icon.svg'
import { useUIState } from '@/composables/useUIState'

const route = useRoute()
const auth = useAuthStore()
const { t } = useI18n()

const emit = defineEmits<{ openSettings: [] }>()
const { openWizard } = useUIState()

// El selector de gira vive en el header (TourSelect); aquí solo navegación.
const navItems = [
  {
    to: '/home',
    key: 'home',
    icon: `<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>`,
  },
  {
    to: '/events',
    key: 'events',
    icon: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="15" x2="8" y2="15"/><line x1="12" y1="15" x2="12" y2="15"/><line x1="16" y1="15" x2="16" y2="15"/>`,
  },
  {
    to: '/calendar',
    key: 'cal',
    icon: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  },
  {
    to: '/contacts',
    key: 'contacts',
    icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  },
  {
    to: '/tour',
    key: 'tourHub',
    icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  },
  {
    to: '/reports',
    key: 'reports',
    icon: `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
  },
]

function isActive(to: string) {
  // Inicio exacto por nombre de ruta: evita que futuras rutas /home/* lo marquen.
  if (to === '/home') return route.name === 'home'
  return route.path.startsWith(to)
}

// Activo: relleno lima con texto night (#111). `text-ink` aquí sería on-night (claro) por
// .sidebar-dark y no se leería sobre lima.
const ACTIVE = 'bg-acid text-night font-semibold'
const INACTIVE = 'text-ink-2 hover:bg-glass-hover hover:text-ink'
</script>

<template>
  <aside
    class="sidebar-dark hidden lg:flex w-60 flex-shrink-0 bg-bg-3 border-r border-line flex-col py-4 px-3 gap-0.5 z-50"
    data-test="app-sidebar"
  >
    <!-- Logo + wordmark -->
    <div class="flex items-center gap-2 px-2 mb-2">
      <RouterLink
        to="/home"
        class="flex items-center gap-2 no-underline flex-1 min-w-0"
      >
        <img
          :src="logoIcon"
          class="w-8 h-8 flex-shrink-0"
          alt="Giras Pro"
        >
        <span class="text-[15px] font-bold text-ink tracking-[-0.2px] truncate">Giras</span>
      </RouterLink>

      <!-- New tour wizard button -->
      <button
        class="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-[10px] border border-dashed border-line-2 text-ink-3 bg-transparent cursor-pointer transition-all duration-200 hover:border-acid hover:text-acid hover:bg-glass-active group"
        :title="t('tours.newTour')"
        @click="openWizard()"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-transform duration-200 group-hover:rotate-90"
        >
          <line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
          />
          <line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
          />
        </svg>
      </button>
    </div>

    <!-- Nav items -->
    <RouterLink
      v-for="item in navItems"
      :key="item.key"
      :to="item.to"
      class="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors duration-200 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid"
      :class="isActive(item.to) ? ACTIVE : INACTIVE"
      :data-test="`sidebar-nav-${item.key}`"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="flex-shrink-0"
        v-html="item.icon"
      />
      <span class="text-[15px] font-medium truncate">{{ t(`nav.${item.key}`) }}</span>
    </RouterLink>

    <div class="flex-1" />

    <!-- Panel Admin (solo superusers) -->
    <RouterLink
      v-if="auth.user?.is_superuser"
      to="/admin"
      class="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors duration-200 no-underline text-[#F4B26B] hover:bg-[rgba(244,178,107,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid"
      data-test="sidebar-admin"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="flex-shrink-0"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <span class="text-[15px] font-medium truncate">Panel Admin</span>
    </RouterLink>

    <!-- Configuración: última entrada del sidebar (la cuenta vive en el avatar del header) -->
    <button
      type="button"
      class="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors duration-200 border-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid"
      :class="isActive('/settings') ? ACTIVE : `bg-transparent ${INACTIVE}`"
      data-test="sidebar-settings"
      @click="emit('openSettings')"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="flex-shrink-0"
      >
        <circle
          cx="12"
          cy="12"
          r="3"
        />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
      <span class="text-[15px] font-medium truncate">{{ t('settings.title') }}</span>
    </button>
  </aside>
</template>
