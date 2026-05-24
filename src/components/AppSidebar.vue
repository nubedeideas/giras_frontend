<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { useI18n } from 'vue-i18n'
import TourMenuPanel from '@/components/TourMenuPanel.vue'
import logoIcon from '@/assets/logo-icon.svg'
import { useUIState } from '@/composables/useUIState'

const route = useRoute()
const auth = useAuthStore()
const toursStore = useToursStore()
const { t } = useI18n()

const emit = defineEmits<{ openSettings: [] }>()
const { openWizard } = useUIState()
const showTours = ref(false)

const navItems = [
  {
    to: '/notifs',
    key: 'notif',
    icon: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
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
    to: '/reports',
    key: 'reports',
    icon: `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
  },
]

function isActive(to: string) {
  return route.path.startsWith(to)
}
</script>

<template>
  <aside
    class="sidebar-dark hidden md:flex w-16 flex-shrink-0 bg-bg-2 border-r border-line flex-col items-center py-4 gap-0.5 z-50"
  >
    <!-- Logo -->
    <RouterLink to="/notifs" class="w-9 h-9 flex-shrink-0 block no-underline">
      <img
        :src="logoIcon"
        class="w-full h-full"
        alt="Giras Pro"
      >
    </RouterLink>

    <!-- New tour wizard button -->
    <button
      class="w-9 h-9 mb-[14px] mt-2 flex-shrink-0 flex items-center justify-center rounded-[11px] border border-dashed border-line-2 text-ink-4 bg-transparent cursor-pointer transition-all duration-200 hover:border-acid hover:text-acid hover:bg-glass-active group"
      title="Nueva gira"
      @click="openWizard"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="transition-transform duration-200 group-hover:rotate-90"
      >
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>

    <!-- Nav items -->
    <div v-for="item in navItems" :key="item.key" class="relative group">
      <RouterLink
        :to="item.to"
        class="flex items-center justify-center w-[42px] h-[42px] rounded-xl transition-all duration-200 no-underline"
        :class="
          isActive(item.to)
            ? 'bg-glass-active text-acid'
            : 'text-acid-nav hover:bg-glass-hover hover:text-acid'
        "
      >
        <!-- Active indicator bar -->
        <div
          v-if="isActive(item.to)"
          class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-acid rounded-r"
        />
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          v-html="item.icon"
        />
      </RouterLink>
      <!-- Tooltip -->
      <div
        class="absolute left-[52px] top-1/2 -translate-y-1/2 bg-bg-4 border border-line-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap text-ink pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[100]"
      >
        {{ t(`nav.${item.key}`) }}
      </div>
    </div>

    <!-- Divider -->
    <div class="w-[28px] h-px bg-line my-1.5" />

    <!-- Giras (tour switcher) button -->
    <div class="relative group">
      <button
        class="flex items-center justify-center w-[42px] h-[42px] rounded-xl transition-all duration-200 relative border-none cursor-pointer"
        :class="
          showTours || toursStore.activeTourId
            ? 'bg-glass-active text-acid'
            : 'text-acid-nav hover:bg-glass-hover hover:text-acid'
        "
        @click="showTours = !showTours"
      >
        <!-- Active indicator bar (uses tour color) -->
        <div
          v-if="toursStore.activeTourId"
          class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r"
          :style="{ background: toursStore.activeTour?.color ?? 'var(--acid)' }"
        />
        <!-- Route / tour icon -->
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <circle cx="18" cy="5" r="3" />
        </svg>
        <!-- Active tour color dot -->
        <div
          v-if="toursStore.activeTourId"
          class="absolute top-[7px] right-[7px] w-[6px] h-[6px] rounded-full border border-bg-2"
          :style="{ background: toursStore.activeTour?.color }"
        />
      </button>
      <!-- Tooltip -->
      <div
        class="absolute left-[52px] top-1/2 -translate-y-1/2 bg-bg-4 border border-line-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap text-ink pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[100]"
      >
        {{
          toursStore.activeTour
            ? `${toursStore.activeTour.artist_name} — ${toursStore.activeTour.name}`
            : t('nav.tours')
        }}
      </div>
    </div>

    <div class="flex-1" />

    <!-- User avatar (links to settings) -->
    <button
      class="w-9 h-9 rounded-full overflow-hidden cursor-pointer border-2 transition-colors duration-200 flex-shrink-0 flex items-center justify-center bg-acid"
      :class="isActive('/settings') ? 'border-acid' : 'border-transparent hover:border-acid'"
      @click="emit('openSettings')"
    >
      <img v-if="auth.user?.avatar" :src="auth.user.avatar" :alt="auth.user.full_name" class="w-full h-full object-cover" />
      <span v-else class="text-[12px] font-bold text-black">{{ auth.user?.first_name?.charAt(0) }}{{ auth.user?.last_name?.charAt(0) }}</span>
    </button>

    <!-- Settings button -->
    <div class="relative group">
      <button
        class="flex items-center justify-center w-[42px] h-[42px] rounded-xl cursor-pointer transition-all duration-200 border-none mt-0.5 relative"
        :class="
          isActive('/settings')
            ? 'bg-glass-active text-acid'
            : 'bg-transparent text-acid-nav hover:bg-glass-hover hover:text-acid'
        "
        @click="emit('openSettings')"
      >
        <!-- Active indicator bar -->
        <div
          v-if="isActive('/settings')"
          class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-acid rounded-r"
        />
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
      </button>
      <!-- Tooltip -->
      <div
        class="absolute left-[52px] top-1/2 -translate-y-1/2 bg-bg-4 border border-line-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap text-ink pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[100]"
      >
        {{ t('settings.title') }}
      </div>
    </div>
  </aside>

  <!-- Tour menu panel (Teleported to body) -->
  <TourMenuPanel :show="showTours" @close="showTours = false" />
</template>
