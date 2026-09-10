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
const toursTriggerRef = ref<HTMLButtonElement | null>(null)
const toursAnchor = ref<{ top: number; left: number; bottom: number; width: number } | null>(null)

function toggleTours() {
  if (!showTours.value && toursTriggerRef.value) {
    const r = toursTriggerRef.value.getBoundingClientRect()
    toursAnchor.value = { top: r.top, left: r.left, bottom: r.bottom, width: r.width }
  }
  showTours.value = !showTours.value
}

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
    class="hidden lg:flex w-60 flex-shrink-0 bg-bg-3 flex-col py-4 px-3 gap-0.5 z-50"
  >
    <!-- Logo + wordmark -->
    <div class="flex items-center gap-2 px-2 mb-2">
      <RouterLink to="/notifs" class="flex items-center gap-2 no-underline flex-1 min-w-0">
        <img :src="logoIcon" class="w-8 h-8 flex-shrink-0" alt="Giras Pro" />
        <span class="text-[14px] font-bold text-ink tracking-[-0.2px] truncate">Giras</span>
      </RouterLink>

      <!-- New tour wizard button -->
      <button
        class="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-[10px] border border-dashed border-line-2 text-ink-4 bg-transparent cursor-pointer transition-all duration-200 hover:border-acid hover:text-acid hover:bg-glass-active group"
        :title="t('tours.newTour')"
        @click="openWizard"
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
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <!-- Nav items -->
    <RouterLink
      v-for="item in navItems"
      :key="item.key"
      :to="item.to"
      class="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 no-underline"
      :class="
        isActive(item.to)
          ? 'bg-acid text-black shadow-[0_4px_14px_var(--acid-glow)]'
          : 'text-ink-2 hover:bg-glass-hover hover:text-ink'
      "
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
      <span class="text-[13px] font-medium truncate">{{ t(`nav.${item.key}`) }}</span>
    </RouterLink>

    <!-- Divider -->
    <div class="h-px bg-line my-2 mx-1" />

    <!-- Giras (tour switcher) button -->
    <button
      ref="toursTriggerRef"
      class="relative flex items-center gap-2.5 px-3 py-2.5 my-1 rounded-xl border transition-all duration-200 cursor-pointer bg-transparent text-left"
      :class="!toursStore.activeTourId ? 'border-line-2 border-dashed text-ink-2 hover:border-acid hover:text-acid' : 'border-transparent'"
      :style="
        toursStore.activeTourId
          ? {
              background: `color-mix(in srgb, ${toursStore.activeTour?.color} 14%, var(--bg-3))`,
              borderColor: `color-mix(in srgb, ${toursStore.activeTour?.color} 30%, transparent)`,
              color: toursStore.activeTour?.color,
            }
          : {}
      "
      @click="toggleTours"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="flex-shrink-0"
      >
        <circle cx="6" cy="19" r="3" />
        <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
        <circle cx="18" cy="5" r="3" />
      </svg>
      <span class="text-[13px] font-semibold truncate flex-1 min-w-0">
        {{
          toursStore.activeTour
            ? `${toursStore.activeTour.artist_name} — ${toursStore.activeTour.name}`
            : t('nav.tours')
        }}
      </span>
      <!-- Active tour color dot -->
      <div
        v-if="toursStore.activeTourId"
        class="w-[7px] h-[7px] rounded-full flex-shrink-0"
        :style="{ background: toursStore.activeTour?.color }"
      />
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="flex-shrink-0 opacity-60 transition-transform duration-200"
        :class="showTours ? 'rotate-180' : ''"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div class="h-px bg-line my-2 mx-1" />

    <div class="flex-1" />

    <!-- Settings -->
    <button
      class="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border-none bg-transparent text-left"
      :class="
        isActive('/settings')
          ? 'bg-acid text-black shadow-[0_4px_14px_var(--acid-glow)]'
          : 'text-ink-2 hover:bg-glass-hover hover:text-ink'
      "
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
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
      <span class="text-[13px] font-medium truncate">{{ t('settings.title') }}</span>
    </button>

    <!-- User footer -->
    <button
      class="flex items-center gap-2.5 px-2 py-2 mt-1 rounded-xl cursor-pointer transition-colors duration-200 border-none bg-transparent text-left hover:bg-glass-hover"
      @click="emit('openSettings')"
    >
      <div
        class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-acid"
      >
        <img
          v-if="auth.user?.avatar"
          :src="auth.user.avatar"
          :alt="auth.user.full_name"
          class="w-full h-full object-cover"
        />
        <span v-else class="text-[11px] font-bold text-black"
          >{{ auth.user?.first_name?.charAt(0) }}{{ auth.user?.last_name?.charAt(0) }}</span
        >
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[12px] font-semibold text-ink truncate">{{ auth.user?.full_name }}</p>
        <p class="text-[10px] text-ink-3 truncate">{{ auth.user?.email }}</p>
      </div>
    </button>
  </aside>

  <!-- Tour menu panel (Teleported to body) -->
  <TourMenuPanel :show="showTours" :anchor="toursAnchor" @close="showTours = false" />
</template>
