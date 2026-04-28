<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NotifEvent } from '@/types'
import GlassBlock from '@/components/ui/GlassBlock.vue'
import Pill from '@/components/ui/Pill.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import NotifForm from './NotifForm.vue'

defineProps<{ event: NotifEvent }>()
const emit = defineEmits<{ close: []; openImportContacts: [] }>()
const { t } = useI18n()

const showForm = ref(false)
</script>

<template>
  <div class="flex-1 bg-bg-3 flex flex-col overflow-hidden">
    <!-- Detail header -->
    <div class="px-[22px] pt-[18px] pb-3.5 border-b border-line flex-shrink-0 flex items-start justify-between">
      <div>
        <p class="text-[9px] font-bold text-acid-muted tracking-[1px] uppercase mb-[5px]">
          {{ event.type.toUpperCase() }} · {{ event.city }}
        </p>
        <p class="text-lg font-bold tracking-[-0.3px] mb-1 text-ink">{{ event.title }}</p>
        <div class="flex flex-wrap gap-2.5 text-[11px] text-ink-2">
          <span class="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {{ event.fullDate }}
          </span>
          <span class="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {{ event.startTime }} – {{ event.endTime }}
          </span>
          <span class="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {{ event.venue }}
          </span>
        </div>
      </div>

      <button
        class="flex items-center justify-center w-7 h-7 rounded-lg border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink ml-3.5 flex-shrink-0"
        @click="emit('close')"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto px-[22px] py-[18px]">
      <!-- Actions -->
      <div v-if="!showForm" class="flex gap-[7px] mb-3">
        <BtnPrimary @click="showForm = true">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {{ t('notif.newNotif') }}
        </BtnPrimary>
        <BtnSecondary @click="emit('openImportContacts')">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/>
          </svg>
          {{ t('notif.addContacts') }}
        </BtnSecondary>
      </div>

      <!-- Notification form -->
      <Transition name="up">
        <NotifForm
          v-if="showForm"
          :event-id="event.id"
          @close="showForm = false"
          @saved="showForm = false"
        />
      </Transition>

      <!-- Event info -->
      <GlassBlock :title="t('notif.eventInfo')">
        <div class="grid grid-cols-2 gap-2">
          <div v-for="(item, idx) in [
            { k: t('notif.venue'), v: event.venue },
            { k: t('notif.city'), v: event.city },
            { k: t('notif.callTime'), v: event.callTime },
            { k: t('notif.doors'), v: event.doors },
            { k: t('notif.showTime'), v: event.startTime },
            { k: t('notif.curfew'), v: event.endTime },
          ]" :key="idx" class="flex flex-col gap-0.5">
            <span class="text-[9px] font-semibold text-ink-3 tracking-[0.5px] uppercase">{{ item.k }}</span>
            <span class="text-[12px] text-ink">{{ item.v }}</span>
          </div>
        </div>
      </GlassBlock>

      <!-- Message -->
      <GlassBlock :title="t('notif.notifMsg')">
        <p class="text-[12px] leading-7 text-ink whitespace-pre-line">{{ event.message }}</p>
      </GlassBlock>

      <!-- Stats -->
      <GlassBlock :title="t('notif.stats')">
        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="(s, idx) in [
              { val: event.stats.sent, lbl: t('notif.sent'), cls: 'text-acid' },
              { val: event.stats.opened, lbl: t('notif.opened'), cls: 'text-brand-blue' },
              { val: event.stats.clicked, lbl: t('notif.clicked'), cls: 'text-brand-orange' },
            ]"
            :key="idx"
            class="bg-bg-2 border border-line rounded-[10px] px-2.5 py-3 text-center"
          >
            <p class="text-[22px] font-bold tracking-[-0.5px]" :class="s.cls">{{ s.val }}</p>
            <p class="text-[10px] text-ink-3 mt-px">{{ s.lbl }}</p>
          </div>
        </div>
      </GlassBlock>

      <!-- Recipients -->
      <GlassBlock>
        <div class="flex items-center justify-between mb-2.5">
          <p class="text-[9px] font-bold text-ink-3 tracking-[1px] uppercase">{{ t('notif.recipients') }}</p>
          <Pill variant="n">{{ event.contacts.length }} {{ t('notif.contacts') }}</Pill>
        </div>
        <div class="flex flex-col gap-1.5">
          <div
            v-for="c in event.contacts"
            :key="c.uuid"
            class="flex items-center gap-2.5 px-2.5 py-[7px] rounded-[9px] transition-colors duration-150 hover:bg-glass-hover"
          >
            <div class="w-[30px] h-[30px] rounded-full overflow-hidden flex-shrink-0 border border-line flex items-center justify-center text-[11px] font-bold text-ink-2"
              :style="{ background: c.avatar ? 'transparent' : (c.role?.color ?? 'var(--avatar-bg)') }">
              <img v-if="c.avatar" :src="c.avatar" :alt="c.full_name" class="w-full h-full object-cover" />
              <span v-else>{{ c.first_name.charAt(0) }}{{ c.last_name.charAt(0) }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[12px] font-medium text-ink">{{ c.full_name }}</p>
              <p class="text-[10px] text-ink-3">{{ c.role?.name ?? c.job_title ?? '—' }}</p>
            </div>
            <div class="w-[7px] h-[7px] rounded-full flex-shrink-0 bg-acid" />
          </div>
        </div>
      </GlassBlock>
    </div>
  </div>
</template>
