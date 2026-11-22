<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useInboxStore } from '@/stores/inbox'

const { t } = useI18n()
const inbox = useInboxStore()
</script>

<template>
  <button
    id="inbox-bell"
    type="button"
    class="relative w-11 h-11 lg:w-9 lg:h-9 flex-shrink-0 flex items-center justify-center bg-transparent hover:bg-glass-hover rounded-full border-none cursor-pointer transition-colors"
    :class="inbox.isOpen ? 'text-olive' : 'text-ink-2 hover:text-ink'"
    :aria-label="t('inbox.bellLabel', inbox.unreadCount)"
    :aria-expanded="inbox.isOpen"
    aria-haspopup="dialog"
    aria-controls="inbox-panel"
    @click="inbox.toggle()"
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
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
    <span
      v-if="inbox.badgeLabel"
      data-testid="inbox-badge"
      class="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-acid text-black text-[10px] font-bold leading-[17px] text-center"
      aria-hidden="true"
    >{{ inbox.badgeLabel }}</span>
  </button>
</template>
