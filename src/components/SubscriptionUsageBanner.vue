<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToursStore } from '@/stores/tours'
import { useSubscription, type SubscriptionUsage } from '@/composables/useSubscription'
import { useUIState } from '@/composables/useUIState'

/**
 * Aviso de cupo de WhatsApp de la gira activa: ámbar desde el 80 % y rojo al 100 %, con la frase
 * de degradación de los recordatorios automáticos (D7 de la spec de recordatorios por tipo).
 */
const tours = useToursStore()
const api = useSubscription()
const { openSettings } = useUIState()
const { t } = useI18n()

const WARNING_THRESHOLD = 80
const REACHED_THRESHOLD = 100

const usage = ref<SubscriptionUsage | null>(null)
const dismissedTourUuid = ref<string | null>(null)

watch(
  () => tours.activeTour?.uuid,
  async (tourUuid) => {
    usage.value = null
    if (!tourUuid) return
    try {
      usage.value = await api.usage(tourUuid)
    } catch {
      usage.value = null
    }
  },
  { immediate: true }
)

const level = computed<'warning' | 'reached' | null>(() => {
  const u = usage.value
  if (!u || u.is_unlimited) return null
  if (u.usage_percentage >= REACHED_THRESHOLD) return 'reached'
  if (u.usage_percentage >= WARNING_THRESHOLD) return 'warning'
  return null
})

const visible = computed(
  () => level.value !== null && dismissedTourUuid.value !== tours.activeTour?.uuid
)

const message = computed(() => {
  const u = usage.value
  if (!u || !level.value) return ''
  const named = { percentage: Math.round(u.usage_percentage), plan: u.plan_name }
  return level.value === 'reached'
    ? `${t('plan.banner.reached', named)} ${t('plan.automaticDegraded')}`
    : t('plan.banner.warning', named)
})

const tone = computed(() =>
  level.value === 'reached'
    ? { box: 'bg-failed-bg border-[#FCA5A5]', text: 'text-failed-fg', btn: 'bg-failed-bg' }
    : { box: 'bg-pending-bg border-[#FCD34D]', text: 'text-pending-fg', btn: 'bg-pending-bg' }
)

function dismiss() {
  dismissedTourUuid.value = tours.activeTour?.uuid ?? null
}

function goToSubscription() {
  openSettings('subscription')
}
</script>

<template>
  <div
    v-if="visible"
    class="flex-shrink-0 flex items-center gap-2.5 px-4 py-1.5 border-b"
    :class="tone.box"
    :data-level="level"
    data-test="usage-banner"
  >
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="flex-shrink-0"
      :class="tone.text"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line
        x1="12"
        y1="9"
        x2="12"
        y2="13"
      /><line
        x1="12"
        y1="17"
        x2="12.01"
        y2="17"
      />
    </svg>
    <p
      class="text-[13px] flex-1 min-w-0"
      :class="tone.text"
      data-test="usage-banner-text"
    >
      {{ message }}
    </p>
    <button
      class="text-[12px] font-bold px-2 py-1 rounded-md cursor-pointer border-none flex-shrink-0"
      :class="[tone.btn, tone.text]"
      @click="goToSubscription"
    >
      {{ t('plan.changePlan') }}
    </button>
    <button
      class="flex items-center justify-center w-[18px] h-[18px] rounded border-none bg-transparent cursor-pointer opacity-50 hover:opacity-90 flex-shrink-0"
      :class="tone.text"
      :title="t('plan.hide')"
      :aria-label="t('plan.hide')"
      @click="dismiss"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line
          x1="18"
          y1="6"
          x2="6"
          y2="18"
        /><line
          x1="6"
          y1="6"
          x2="18"
          y2="18"
        />
      </svg>
    </button>
  </div>
</template>
