<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DashboardBlock from './DashboardBlock.vue'
import type { SubscriptionUsage } from '@/composables/useSubscription'
import { useUIState } from '@/composables/useUIState'
import { planBarWidth, planLevel } from '@/utils/dashboard'

/** "Cupo del plan": el consumo lo carga la vista (una llamada) y lo comparte con "Por resolver". */
const props = defineProps<{ usage: SubscriptionUsage | null; loading: boolean; error: boolean }>()
const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
const { openSettings } = useUIState()

const level = computed(() => planLevel(props.usage))
const width = computed(() => (props.usage ? planBarWidth(props.usage) : 0))

const BAR: Record<string, string> = {
  ok: 'bg-olive',
  warning: 'bg-pending-fg',
  reached: 'bg-failed-fg',
}
</script>

<template>
  <DashboardBlock
    :title="t('dashboard.plan.title')"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !usage"
    data-testid="dashboard-plan"
    @retry="emit('retry')"
  >
    <template #empty>
      <p class="min-h-[44px] flex items-center text-[15px] text-ink-2">
        {{ t('dashboard.plan.none') }}
      </p>
    </template>

    <div
      v-if="usage"
      class="flex flex-col gap-3"
    >
      <p
        v-if="level === 'unlimited'"
        class="text-[15px] text-ink"
        data-testid="plan-unlimited"
      >
        {{ t('dashboard.plan.unlimited', { plan: usage.plan_name }) }}
      </p>
      <template v-else>
        <div class="flex items-baseline justify-between gap-2">
          <p
            class="text-[15px] text-ink min-w-0"
            data-testid="plan-messages"
          >
            <span class="font-time tnum font-bold">{{ usage.notifications_used }}</span>
            {{ t('dashboard.plan.of') }}
            <span class="font-time tnum">{{ usage.notification_limit }}</span>
            {{ t('dashboard.plan.whatsapp') }}
          </p>
          <span class="text-[13px] text-ink-2 truncate">{{ usage.plan_name }}</span>
        </div>
        <div
          class="h-2 rounded-full bg-bg-4 overflow-hidden"
          role="progressbar"
          :aria-valuenow="Math.round(width)"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="t('dashboard.plan.title')"
        >
          <div
            class="h-full rounded-full"
            :class="BAR[level ?? 'ok']"
            :data-level="level"
            :style="{ width: `${width}%` }"
          />
        </div>
      </template>
      <p
        v-if="usage.shows_limit"
        class="text-[13px] text-ink-2"
      >
        {{
          t('dashboard.plan.shows', { used: usage.shows_used, limit: usage.shows_limit })
        }}
      </p>
      <button
        type="button"
        class="self-start inline-flex items-center min-h-[44px] lg:min-h-[36px] px-3.5 rounded-sm bg-bg-3 border border-line-2 text-ink text-[14px] font-medium cursor-pointer hover:bg-glass-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
        @click="openSettings('subscription')"
      >
        {{ t('dashboard.plan.manage') }}
      </button>
    </div>
  </DashboardBlock>
</template>
