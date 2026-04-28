<script setup lang="ts">
import { ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: []; openCreate: []; openImportCal: [] }>()

const choice = ref<'cal' | 'manual' | null>(null)

watch(
  () => props.show,
  (val) => {
    if (!val) setTimeout(() => (choice.value = null), 300)
  },
)

function select(opt: 'cal' | 'manual') {
  choice.value = opt
}

function confirm() {
  if (choice.value === 'cal') {
    emit('close')
    emit('openImportCal')
  } else if (choice.value === 'manual') {
    emit('close')
    emit('openCreate')
  }
}
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <!-- Close button -->
    <button
      class="absolute top-3.5 right-3.5 flex items-center justify-center w-[26px] h-[26px] rounded-[7px] border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink"
      @click="emit('close')"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <!-- Header -->
    <div class="flex items-center gap-2.5 mb-[18px]">
      <div class="w-[34px] h-[34px] rounded-[9px] bg-acid-dim text-acid-muted flex items-center justify-center flex-shrink-0">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="12" y1="14" x2="12" y2="18"/>
          <line x1="10" y1="16" x2="14" y2="16"/>
        </svg>
      </div>
      <div>
        <p class="text-[14px] font-bold text-ink">Agregar actividad</p>
        <p class="text-[11px] text-ink-2 mt-px">Elige cómo quieres agregar la actividad</p>
      </div>
    </div>

    <!-- Option cards -->
    <div class="grid grid-cols-2 gap-2 mb-5">
      <!-- Google Calendar -->
      <div
        class="bg-glass border rounded-xl p-4 text-center cursor-pointer transition-all duration-200"
        :class="choice === 'cal' ? 'border-line-acid bg-glass-active' : 'border-line hover:bg-glass-2'"
        @click="select('cal')"
      >
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2.5 transition-colors duration-200"
          :class="choice === 'cal' ? 'bg-[rgba(26,143,255,0.15)]' : 'bg-glass-2'"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>
        <p class="text-[11px] font-semibold text-ink leading-snug">Google Calendar</p>
        <p class="text-[9px] text-ink-3 mt-0.5">Importar eventos</p>
      </div>

      <!-- Manual -->
      <div
        class="bg-glass border rounded-xl p-4 text-center cursor-pointer transition-all duration-200"
        :class="choice === 'manual' ? 'border-line-acid bg-glass-active' : 'border-line hover:bg-glass-2'"
        @click="select('manual')"
      >
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2.5 transition-colors duration-200"
          :class="choice === 'manual' ? 'bg-acid-dim' : 'bg-glass-2'"
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            :stroke="choice === 'manual' ? 'var(--acid-muted)' : 'var(--ink-3)'"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>
        <p class="text-[11px] font-semibold text-ink leading-snug">Manual</p>
        <p class="text-[9px] text-ink-3 mt-0.5">Crear formulario</p>
      </div>
    </div>

    <!-- Action -->
    <button
      class="w-full py-2.5 rounded-[8px] border-none text-[12px] font-semibold cursor-pointer transition-all duration-200"
      :class="
        choice
          ? 'bg-acid text-black hover:bg-[#b8e800]'
          : 'bg-glass border border-line text-ink-4 cursor-not-allowed'
      "
      :disabled="!choice"
      @click="confirm"
    >
      Continuar
    </button>
  </AppModal>
</template>
