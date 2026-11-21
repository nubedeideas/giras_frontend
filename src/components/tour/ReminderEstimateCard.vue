<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ReminderEstimate, ReminderPlanUsage } from '@/composables/useReminderSettings'

/** Resumen "Qué se va a enviar" y barra de cupo de WhatsApp (C1.3, D3 y D7). */
const props = defineProps<{
  /** `null`: gira sin suscripción, sin límite de cupo (no se pinta la barra). */
  plan: ReminderPlanUsage | null
  estimate?: ReminderEstimate | null
}>()

const { t, locale } = useI18n()

const cost = computed(() =>
  new Intl.NumberFormat(locale.value === 'en' ? 'en-GB' : 'es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(props.estimate?.cost_usd ?? 0)
)

const percentage = computed(() => {
  const plan = props.plan
  if (!plan || plan.is_unlimited || plan.limit <= 0) return 0
  return Math.min(100, Math.round((plan.used / plan.limit) * 100))
})

const barClass = computed(() => {
  if (percentage.value >= 100) return 'bg-red-400'
  if (percentage.value >= 80) return 'bg-amber-400'
  return 'bg-acid'
})

const overQuota = computed(
  () =>
    !!props.estimate &&
    !!props.plan &&
    !props.plan.is_unlimited &&
    props.estimate.whatsapp > props.plan.remaining
)

const hasActivities = computed(() => !!props.estimate && props.estimate.activities > 0)
</script>

<template>
  <div
    class="bg-glass border border-line rounded-lg px-4 py-3.5"
    data-test="reminder-estimate"
  >
    <p class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-2">
      {{ t('reminders.estimate.title') }}
    </p>

    <template v-if="estimate">
      <p
        v-if="hasActivities"
        class="text-[13px] text-ink leading-snug"
        data-test="estimate-body"
      >
        {{
          t('reminders.estimate.body', {
            whatsapp: estimate.whatsapp,
            email: estimate.email,
            inApp: estimate.in_app,
            cost,
          })
        }}
      </p>
      <p
        v-else
        class="text-[12px] text-ink-3"
        data-test="estimate-none"
      >
        {{ t('reminders.estimate.none') }}
      </p>
      <p
        v-if="hasActivities"
        class="text-[10px] text-ink-4 mt-1"
      >
        {{ t('reminders.estimate.approx') }}
      </p>
    </template>

    <!-- Cupo del plan -->
    <div
      v-if="plan"
      class="mt-3"
    >
      <p
        v-if="plan.is_unlimited"
        class="text-[11px] text-ink-3"
        data-test="quota-unlimited"
      >
        {{ t('reminders.estimate.unlimited') }}
      </p>
      <template v-else>
        <div class="flex items-center justify-between text-[11px] text-ink-2 mb-1">
          <span data-test="quota-text">{{
            t('reminders.estimate.quota', { used: plan.used, limit: plan.limit })
          }}</span>
          <span class="text-ink-3">{{ percentage }} %</span>
        </div>
        <div
          class="h-1.5 rounded-full bg-glass-2 overflow-hidden"
          role="progressbar"
          :aria-valuenow="percentage"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full rounded-full transition-all"
            :class="barClass"
            :style="{ width: `${percentage}%` }"
            data-test="quota-bar"
          />
        </div>
      </template>
    </div>

    <p
      v-if="overQuota"
      class="text-[11px] text-brand-orange mt-2.5"
      data-test="estimate-over-quota"
    >
      {{ t('reminders.estimate.overQuota') }}
    </p>
  </div>
</template>
