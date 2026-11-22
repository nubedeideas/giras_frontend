<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

/** Gira sin actividades: CTA para crear la primera o traerlas de Google Calendar. */
const emit = defineEmits<{ add: []; connectCalendar: [] }>()
const { t } = useI18n()
</script>

<template>
  <section
    class="bg-bg-3 border border-line rounded-2xl px-5 py-8 sm:px-8 sm:py-10 flex flex-col items-center text-center gap-4"
    data-testid="dashboard-empty-tour"
  >
    <div
      class="w-12 h-12 rounded-xl bg-lime-soft border border-line flex items-center justify-center text-olive"
      aria-hidden="true"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect
          x="3"
          y="4"
          width="18"
          height="18"
          rx="2"
        />
        <line
          x1="16"
          y1="2"
          x2="16"
          y2="6"
        />
        <line
          x1="8"
          y1="2"
          x2="8"
          y2="6"
        />
        <line
          x1="3"
          y1="10"
          x2="21"
          y2="10"
        />
      </svg>
    </div>
    <div class="max-w-[420px]">
      <h3 class="text-[18px] font-bold text-ink mb-1">
        {{ t('dashboard.empty.title') }}
      </h3>
      <p class="text-[15px] text-ink-2">
        {{ t('dashboard.empty.body') }}
      </p>
    </div>
    <div class="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
      <BtnPrimary
        class="justify-center"
        data-testid="empty-add"
        @click="emit('add')"
      >
        {{ t('dashboard.empty.add') }}
      </BtnPrimary>
      <BtnSecondary
        class="justify-center"
        data-testid="empty-calendar"
        @click="emit('connectCalendar')"
      >
        {{ t('dashboard.empty.connectCalendar') }}
      </BtnSecondary>
    </div>
  </section>
</template>
