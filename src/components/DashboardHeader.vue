<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useUIState } from '@/composables/useUIState'

const route = useRoute()
const { t } = useI18n()
const auth = useAuthStore()
const { openSettings } = useUIState()

const TITLE_KEYS: Record<string, string> = {
  notifs: 'notif.title',
  events: 'nav.events',
  calendar: 'calendar.title',
  contacts: 'contacts.title',
  reports: 'reports.title',
  settings: 'settings.title',
}

const title = computed(() => t(TITLE_KEYS[route.name as string] ?? 'notif.title'))
</script>

<template>
  <header
    class="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-3.5 bg-bg-3 border-b border-line"
  >
    <h1 class="text-[15px] font-bold text-ink tracking-[-0.3px] truncate">{{ title }}</h1>

    <button
      class="flex items-center gap-2.5 flex-shrink-0 border-none bg-transparent cursor-pointer rounded-full pr-1 hover:bg-glass-hover transition-colors"
      @click="openSettings('general')"
    >
      <div class="text-right hidden sm:block">
        <p class="text-[12px] font-semibold text-ink leading-tight truncate max-w-[160px]">
          {{ auth.user?.full_name }}
        </p>
        <p class="text-[10px] text-ink-3 leading-tight truncate max-w-[160px]">
          {{ auth.user?.email }}
        </p>
      </div>
      <div
        class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-acid"
      >
        <img
          v-if="auth.user?.avatar"
          :src="auth.user.avatar"
          :alt="auth.user.full_name"
          class="w-full h-full object-cover"
        />
        <span v-else class="text-[12px] font-bold text-black"
          >{{ auth.user?.first_name?.charAt(0) }}{{ auth.user?.last_name?.charAt(0) }}</span
        >
      </div>
    </button>
  </header>
</template>
