<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useUIState } from '@/composables/useUIState'
import { useIsMobile } from '@/composables/useIsMobile'
import InboxBell from '@/components/inbox/InboxBell.vue'
import InboxPanel from '@/components/inbox/InboxPanel.vue'
import TourSelect from '@/components/TourSelect.vue'
import TourMenuPanel from '@/components/TourMenuPanel.vue'
import logoIcon from '@/assets/logo-icon.svg'
import { userInitials } from '@/utils/userInitials'

const route = useRoute()
const { t } = useI18n()
const auth = useAuthStore()
const { openSettings } = useUIState()
const { isMobile } = useIsMobile()

const TITLE_KEYS: Record<string, string> = {
  home: 'nav.home',
  events: 'nav.events',
  calendar: 'calendar.title',
  contacts: 'contacts.title',
  tour: 'nav.tourHub',
  reports: 'reports.title',
  settings: 'settings.title',
}

const title = computed(() => t(TITLE_KEYS[route.name as string] ?? 'nav.home'))

// Selector de gira: el header abre TourMenuPanel anclado bajo el pill (escritorio)
// o como hoja inferior sobre el MobileNav (móvil).
const showTours = ref(false)
const toursAnchor = ref<{ top: number; left: number; bottom: number; width: number } | null>(null)

function toggleTours(rect: DOMRect) {
  if (!showTours.value) {
    toursAnchor.value = { top: rect.top, left: rect.left, bottom: rect.bottom, width: rect.width }
  }
  showTours.value = !showTours.value
}

const initials = computed(() => userInitials(auth.user))
</script>

<template>
  <header
    class="flex-shrink-0 flex items-center justify-between gap-2 lg:gap-4 min-h-[56px] px-4 lg:px-6 py-2 bg-bg-3 border-b border-line"
  >
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
      <!-- Desktop already shows the logo in AppSidebar — mobile-only here -->
      <img
        :src="logoIcon"
        alt="Giras"
        class="lg:hidden w-7 h-7 flex-shrink-0"
      >
      <h1 class="text-[17px] font-bold text-ink tracking-[-0.3px] truncate">
        {{ title }}
      </h1>
    </div>

    <div class="flex items-center gap-1 lg:gap-2 flex-shrink-0">
      <TourSelect
        :open="showTours"
        @toggle="toggleTours"
      />

      <!-- Sin inbox en modo demo: no hay sesión contra la API -->
      <InboxBell v-if="!auth.isDemoMode" />

      <button
        type="button"
        class="w-11 h-11 lg:w-8 lg:h-8 flex-shrink-0 flex items-center justify-center rounded-full border-none bg-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
        :aria-label="t('header.openSettings')"
        :title="auth.user?.full_name"
        data-test="header-avatar"
        @click="openSettings('general')"
      >
        <span
          class="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-acid"
        >
          <img
            v-if="auth.user?.avatar"
            :src="auth.user.avatar"
            alt=""
            class="w-full h-full object-cover"
          >
          <span
            v-else
            class="text-[12px] font-bold text-ink"
          >{{ initials }}</span>
        </span>
      </button>
    </div>

    <InboxPanel v-if="!auth.isDemoMode" />

    <TourMenuPanel
      :show="showTours"
      :anchor="toursAnchor"
      :mobile="isMobile"
      align="end"
      @close="showTours = false"
    />
  </header>
</template>
