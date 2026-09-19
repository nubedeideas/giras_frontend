<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import TourMenuPanel from '@/components/TourMenuPanel.vue'

const route = useRoute()
const { t } = useI18n()

const showTours = ref(false)

const navItems = [
  {
    to: '/events',
    key: 'events',
    icon: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>`,
  },
  {
    to: '/calendar',
    key: 'cal',
    icon: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  },
  {
    to: '/contacts',
    key: 'contacts',
    icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>`,
  },
  {
    to: '/reports',
    key: 'reports',
    icon: `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
  },
  {
    to: '/settings',
    key: 'settings',
    icon: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  },
]
</script>

<template>
  <nav
    class="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-2 border-t border-line flex z-[100]"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <!-- Giras button (tour selector) -->
    <button
      class="flex-1 py-2.5 flex flex-col items-center gap-[3px] transition-colors duration-200 bg-transparent border-none cursor-pointer"
      :class="showTours ? 'text-acid' : 'text-acid-nav hover:text-acid'"
      @click="showTours = !showTours"
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle
          cx="6"
          cy="19"
          r="3"
        /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle
          cx="18"
          cy="5"
          r="3"
        />
      </svg>
      <span class="text-[9px] font-medium">{{ t('nav.tours') }}</span>
    </button>

    <!-- Regular nav links -->
    <RouterLink
      v-for="item in navItems"
      :key="item.key"
      :to="item.to"
      class="flex-1 py-2.5 flex flex-col items-center gap-[3px] no-underline text-acid-nav transition-colors duration-200"
      :class="route.path.startsWith(item.to) ? 'text-acid' : 'hover:text-acid'"
    >
      <span
        class="flex items-center justify-center w-8 h-6 rounded-full transition-colors duration-200"
        :class="route.path.startsWith(item.to) ? 'bg-acid text-black' : ''"
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
          v-html="item.icon"
        />
      </span>
      <span class="text-[9px] font-medium">{{ t(`nav.${item.key}`) }}</span>
    </RouterLink>
  </nav>

  <!-- Tour selector panel (mobile bottom sheet) -->
  <TourMenuPanel
    :show="showTours"
    :mobile="true"
    @close="showTours = false"
  />
</template>
