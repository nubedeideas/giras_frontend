<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NewNotifForm } from '@/types'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

defineProps<{ eventId: number }>()
const emit = defineEmits<{ close: []; saved: [form: NewNotifForm] }>()
const { t } = useI18n()

const form = reactive<NewNotifForm>({
  ch: 'WhatsApp',
  msg: '',
  timing: '',
})

function save() {
  emit('saved', { ...form })
  emit('close')
}
</script>

<template>
  <div class="bg-glass border border-line-acid rounded p-[14px_16px] mb-3 animate-slide-up">
    <div class="flex items-center justify-between mb-3">
      <p class="text-[12px] font-bold text-ink">{{ t('notif.newNotif') }}</p>
      <button
        class="flex items-center justify-center w-7 h-7 rounded-lg border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink"
        @click="emit('close')"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Channel selector -->
    <p class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase mb-[5px]">{{ t('notif.channel') }}</p>
    <div class="flex gap-1 mb-3">
      <button
        v-for="ch in ['WhatsApp', 'SMS', 'Email']"
        :key="ch"
        class="flex-1 py-[5px] rounded-[7px] border text-[11px] font-medium cursor-pointer transition-all duration-200"
        :class="form.ch === ch
          ? 'bg-glass-active text-acid-muted border-line-acid'
          : 'bg-transparent text-ink-2 border-line hover:bg-glass'"
        @click="form.ch = ch as NewNotifForm['ch']"
      >
        {{ ch }}
      </button>
    </div>

    <!-- Message -->
    <p class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase mb-[5px]">{{ t('notif.message') }}</p>
    <textarea
      v-model="form.msg"
      :placeholder="t('notif.msgPlaceholder')"
      class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none transition-colors duration-200 focus:border-acid resize-y min-h-[70px] leading-relaxed mb-3"
    />

    <!-- Send timing -->
    <p class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase mb-[5px]">{{ t('notif.sendWhen') }}</p>
    <select
      v-model="form.timing"
      class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none focus:border-acid mb-3 cursor-pointer"
    >
      <option value="">{{ t('notif.h24') }}</option>
      <option value="2h">{{ t('notif.h2') }}</option>
      <option value="start">{{ t('notif.atStart') }}</option>
    </select>

    <div class="flex gap-[7px]">
      <BtnPrimary full @click="save">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        {{ t('notif.save') }}
      </BtnPrimary>
      <BtnSecondary @click="emit('close')">{{ t('notif.cancel') }}</BtnSecondary>
    </div>
  </div>
</template>
