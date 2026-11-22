<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DateTime } from 'luxon'
import { RouterLink } from 'vue-router'
import DashboardBlock from './DashboardBlock.vue'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import { useActivitiesStore } from '@/stores/activities'
import { useNoticesStore } from '@/stores/notices'
import { useReminderCatalogStore } from '@/stores/reminderCatalog'
import { useActivities } from '@/composables/useActivities'
import { useRecipientOverrides } from '@/composables/useRecipientOverrides'
import type { SubscriptionUsage } from '@/composables/useSubscription'
import { isForbidden } from '@/utils/reminders'
import { buildPendingItems, joinTypeNames, type PendingItem } from '@/utils/dashboard'

/**
 * "Por resolver" (spec Paleta B §6.3). El cupo llega por prop (lo carga la vista); los avisos,
 * la revisión de la IA y los avisos de audiencia del catálogo solo se piden si eres admin de la
 * gira. Un 403/404 de esas fuentes es "no aplica": sin error visible.
 */
const props = defineProps<{ usage: SubscriptionUsage | null; now: DateTime }>()

const { t, te } = useI18n()
const tours = useToursStore()
const auth = useAuthStore()
const activitiesStore = useActivitiesStore()
const noticesStore = useNoticesStore()
const catalogStore = useReminderCatalogStore()
const activitiesApi = useActivities()
const overridesApi = useRecipientOverrides()

const tourUuid = computed(() => tours.activeTour?.uuid ?? null)
const isAdmin = computed(() => !!tours.activeTour?.current_user_is_admin && !auth.isDemoMode)

const aiPending = ref<number | null>(null)
const aiSuggestions = ref<number | null>(null)
const aiError = ref(false)
const loading = ref(false)

let request = 0

function failed(reason: unknown): boolean {
  return !isForbidden(reason)
}

async function load(uuid: string | null, force = false) {
  const req = ++request
  aiPending.value = null
  aiSuggestions.value = null
  aiError.value = false
  if (!uuid || !isAdmin.value) {
    loading.value = false
    return
  }
  loading.value = true
  const [, acts, sugg] = await Promise.allSettled([
    force || !noticesStore.isLoadingOrLoaded(uuid) ? noticesStore.load(uuid) : Promise.resolve(),
    activitiesApi.listPendingAiReview(uuid),
    overridesApi.listSuggested(uuid),
    catalogStore.load(uuid, { force }),
  ])
  if (req !== request) return
  if (acts.status === 'fulfilled') {
    // El backend ya filtra; se vuelve a comprobar como en AiReviewList.
    aiPending.value = acts.value.filter((a) => a.ai_review?.status === 'pending').length
  } else if (failed(acts.reason)) {
    aiError.value = true
  }
  if (sugg.status === 'fulfilled') {
    aiSuggestions.value = sugg.value.filter((s) => s.status === 'suggested').length
  } else if (failed(sugg.reason)) {
    aiError.value = true
  }
  loading.value = false
}

watch(
  () => [tourUuid.value, isAdmin.value] as const,
  ([uuid]) => void load(uuid),
  { immediate: true }
)

// Avisos y catálogo viven en stores compartidos (TourView y calendario): se leen de ahí.
const pendingNotices = computed(() => {
  const uuid = tourUuid.value
  if (!isAdmin.value || !uuid || noticesStore.tourUuid !== uuid) return null
  return noticesStore.pendingCount === null ? null : noticesStore.pending
})
const noticesError = computed(
  () =>
    isAdmin.value &&
    noticesStore.tourUuid === tourUuid.value &&
    !!noticesStore.error &&
    failed(noticesStore.error)
)
const catalogTypes = computed(() => {
  if (!isAdmin.value || catalogStore.tourUuid !== tourUuid.value) return null
  return catalogStore.catalog?.types ?? null
})
const catalogError = computed(
  () =>
    isAdmin.value &&
    catalogStore.tourUuid === tourUuid.value &&
    !!catalogStore.error &&
    failed(catalogStore.error)
)

const partialError = computed(() => aiError.value || noticesError.value || catalogError.value)

const items = computed(() =>
  buildPendingItems({
    isAdmin: isAdmin.value,
    usage: props.usage,
    pendingNotices: pendingNotices.value,
    aiPending: aiPending.value,
    aiSuggestions: aiSuggestions.value,
    catalogTypes: catalogTypes.value,
    // Solo las de esta gira: mientras el store tenga las de otra, como si no hubiera.
    activities:
      activitiesStore.loadedTourUuid === tourUuid.value ? activitiesStore.activities : [],
    now: props.now,
    selfMissingPhone: !auth.user?.phone_number?.trim(),
  })
)

function itemText(item: PendingItem): string {
  const n = item.count ?? 0
  switch (item.kind) {
    case 'plan-reached':
      return `${t('plan.banner.reached', { plan: item.plan })} ${t('plan.automaticDegraded')}`
    case 'plan-warning':
      return t('plan.banner.warning', { percentage: item.percentage, plan: item.plan })
    case 'notices':
      return t('dashboard.pending.notices', { n }, n)
    case 'ai-types':
      return t('dashboard.pending.aiTypes', { n }, n)
    case 'ai-suggestions':
      return t('dashboard.pending.aiSuggestions', { n }, n)
    case 'audience': {
      const key = `recipients.warnings.${item.code}`
      // Nunca un código crudo: un aviso desconocido cae en un texto genérico.
      const label = te(key) ? t(key) : t('dashboard.pending.audienceUnknown')
      const names = item.typeNames?.length ? ` · ${joinTypeNames(item.typeNames)}` : ''
      return `${label}${names}`
    }
  }
  return ''
}

const ICON_TONE: Record<PendingItem['severity'], string> = {
  critical: 'text-failed-fg',
  warning: 'text-pending-fg',
  info: 'text-olive',
}

function retry() {
  void load(tourUuid.value, true)
}

const showLoading = computed(() => loading.value && items.value.length === 0)
</script>

<template>
  <DashboardBlock
    :title="t('dashboard.pending.title')"
    :count="items.length"
    :loading="showLoading"
    :empty="!showLoading && items.length === 0 && !partialError"
    data-testid="dashboard-pending"
  >
    <template #empty>
      <p class="flex items-center gap-2.5 min-h-[44px] text-[15px] text-ink">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-sent-fg flex-shrink-0"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {{ t('dashboard.pending.allClear') }}
      </p>
    </template>

    <ul
      v-if="items.length"
      class="flex flex-col divide-y divide-line"
    >
      <li
        v-for="item in items"
        :key="item.key"
        :data-testid="`pending-item-${item.key}`"
        :data-severity="item.severity"
        class="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 py-2.5 min-h-[44px]"
      >
        <span
          class="flex-shrink-0"
          :class="ICON_TONE[item.severity]"
          aria-hidden="true"
        >
          <svg
            v-if="item.severity === 'info'"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
            />
            <line
              x1="12"
              y1="16"
              x2="12"
              y2="12"
            />
            <line
              x1="12"
              y1="8"
              x2="12.01"
              y2="8"
            />
          </svg>
          <svg
            v-else
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            />
            <line
              x1="12"
              y1="9"
              x2="12"
              y2="13"
            />
            <line
              x1="12"
              y1="17"
              x2="12.01"
              y2="17"
            />
          </svg>
        </span>
        <p class="flex-1 min-w-0 basis-[calc(100%-30px)] sm:basis-auto text-[15px] text-ink break-words">
          {{ itemText(item) }}
        </p>
        <RouterLink
          :to="item.to"
          data-testid="pending-cta"
          class="ml-[30px] sm:ml-0 flex-shrink-0 inline-flex items-center gap-1 min-h-[44px] lg:min-h-[36px] px-3.5 rounded-sm text-[14px] font-bold no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors"
          :class="
            item.severity === 'info'
              ? 'bg-bg-3 border border-line-2 text-ink hover:bg-glass-hover'
              : 'bg-acid text-night hover:bg-acid-light'
          "
        >
          {{ t(item.ctaKey) }}
          <span aria-hidden="true">→</span>
        </RouterLink>
      </li>
    </ul>

    <div
      v-if="partialError"
      data-testid="pending-partial-error"
      class="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-line"
      role="alert"
    >
      <p class="flex-1 min-w-0 text-[14px] text-failed-fg">
        {{ t('dashboard.pending.partialError') }}
      </p>
      <button
        type="button"
        class="min-h-[44px] px-4 rounded-sm bg-bg-3 border border-line-2 text-ink text-[14px] font-medium cursor-pointer hover:bg-glass-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
        @click="retry"
      >
        {{ t('dashboard.retry') }}
      </button>
    </div>
  </DashboardBlock>
</template>
