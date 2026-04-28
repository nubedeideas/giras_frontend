<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToursStore } from '@/stores/tours'
import { mockCalendarEvents } from '@/data/mock'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const toursStore = useToursStore()

const calEvts = reactive(mockCalendarEvents.map((e) => ({ ...e, sel: false })))
const selectedCount = () => calEvts.filter((e) => e.sel).length

function doImport() {
  emit('close')
}
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <button class="absolute top-3.5 right-3.5 flex items-center justify-center w-[26px] h-[26px] rounded-[7px] border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink" @click="emit('close')">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>

    <div class="flex items-center gap-2.5 mb-[18px]">
      <div class="w-[34px] h-[34px] rounded-[9px] bg-brand-blue-dim text-brand-blue flex items-center justify-center flex-shrink-0">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div>
        <p class="text-[14px] font-bold text-ink">{{ t('modal.importCal') }}</p>
        <p class="text-[11px] text-ink-2 mt-px">{{ t('modal.importCalSub') }}</p>
      </div>
    </div>

    <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-[5px]">{{ t('modal.linkTour') }}</label>
    <select class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none focus:border-acid mb-3 cursor-pointer">
      <option v-for="tour in toursStore.activeTours" :key="tour.id">{{ tour.artist_name }} — {{ tour.name }}</option>
    </select>

    <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-[5px]">{{ t('modal.calendar') }}</label>
    <select class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none focus:border-acid mb-3 cursor-pointer">
      <option>oscar@gigsync.io — Gig Sync Tour Cal</option>
      <option>oscar@gmail.com — Personal</option>
    </select>

    <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-2">{{ t('modal.availableEvts') }}</label>
    <div class="max-h-56 overflow-y-auto space-y-1.5 mb-4">
      <div
        v-for="ev in calEvts"
        :key="ev.id"
        class="flex items-center gap-2.5 px-2.5 py-2.5 rounded-[9px] border cursor-pointer transition-all duration-200"
        :class="ev.sel ? 'bg-glass-active border-line-acid' : 'border-line hover:bg-glass'"
        @click="ev.sel = !ev.sel"
      >
        <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: ev.color }" />
        <div class="flex-1">
          <p class="text-[12px] text-ink">{{ ev.name }}</p>
          <p class="text-[10px] text-ink-3">{{ ev.date }} · {{ ev.loc }}</p>
        </div>
        <div class="w-[17px] h-[17px] rounded-[5px] border-[1.5px] flex items-center justify-center flex-shrink-0"
          :class="ev.sel ? 'bg-acid border-acid' : 'border-line-2'">
          <svg v-if="ev.sel" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
    </div>

    <div class="flex gap-[7px]">
      <BtnPrimary full @click="doImport">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
        {{ t('modal.importSel') }} ({{ selectedCount() }})
      </BtnPrimary>
      <BtnSecondary @click="emit('close')">{{ t('common.cancel') }}</BtnSecondary>
    </div>
  </AppModal>
</template>
