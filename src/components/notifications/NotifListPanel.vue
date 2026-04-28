<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '@/stores/notifications'
import NotifCard from './NotifCard.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'

const { t } = useI18n()
const store = useNotificationsStore()

defineEmits<{ openImportCal: [] }>()
</script>

<template>
  <div class="w-80 flex-shrink-0 bg-bg-2 border-r border-line flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="px-3.5 pt-[18px] pb-2.5 border-b border-line flex-shrink-0">
      <div class="flex items-center justify-between mb-3">
        <p class="text-base font-bold tracking-[-0.2px] text-ink">{{ t('notif.eventsTitle') }}</p>
        <BtnPrimary small @click="$emit('openImportCal')">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {{ t('notif.import') }}
        </BtnPrimary>
      </div>

      <!-- Search -->
      <div
        class="flex items-center gap-[7px] bg-glass border border-line rounded-sm px-[11px] py-[7px] mb-2.5"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-ink-4 flex-shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="store.searchQuery"
          :placeholder="t('notif.search')"
          class="flex-1 bg-transparent border-none outline-none text-ink text-[12px] placeholder:text-ink-4"
        />
      </div>

      <!-- Filter tabs: Todos / Pendientes -->
      <div class="flex gap-[3px]">
        <button
          v-for="tab in [
            { key: 'all', label: t('notif.all') },
            { key: 'pending', label: t('notif.pending') },
          ]"
          :key="tab.key"
          class="flex-1 py-[5px] border-none rounded-[7px] text-[11px] font-medium cursor-pointer transition-all duration-200 tracking-[0.2px]"
          :class="
            store.filterTab === tab.key
              ? 'bg-glass-active text-acid'
              : 'bg-transparent text-ink-3 hover:bg-glass hover:text-ink-2'
          "
          @click="store.filterTab = tab.key as typeof store.filterTab"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Event list -->
    <div class="flex-1 overflow-y-auto px-2 py-1.5">
      <template v-for="group in store.groupedEvents" :key="group.label">
        <p
          class="text-[9px] font-bold text-ink-4 tracking-[1.2px] uppercase px-1 pt-2.5 pb-1.5"
          :class="group.label === 'Pasados' ? 'text-ink-4 opacity-60' : ''"
        >
          {{ group.label }}
        </p>
        <NotifCard
          v-for="ev in group.items"
          :key="ev.id"
          :event="ev"
          :selected="store.selectedId === ev.id"
          :dimmed="group.label === 'Pasados'"
          @select="store.selectEvent"
        />
      </template>

      <div
        v-if="store.groupedEvents.length === 0"
        class="text-center py-8 text-ink-4 text-xs"
      >
        {{ t('notif.noResults') }}
      </div>
    </div>
  </div>
</template>
