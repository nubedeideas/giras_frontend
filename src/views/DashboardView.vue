<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import TourSelectPrompt from '@/components/tour/TourSelectPrompt.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import AddActivityModal from '@/components/modals/AddActivityModal.vue'
import CreateActivityModal from '@/components/modals/CreateActivityModal.vue'
import ImportCalActivitiesModal from '@/components/modals/ImportCalActivitiesModal.vue'
import DashboardPendingBlock from '@/components/dashboard/DashboardPendingBlock.vue'
import DashboardUpcomingBlock from '@/components/dashboard/DashboardUpcomingBlock.vue'
import DashboardSendsBlock from '@/components/dashboard/DashboardSendsBlock.vue'
import DashboardInboxBlock from '@/components/dashboard/DashboardInboxBlock.vue'
import DashboardPlanBlock from '@/components/dashboard/DashboardPlanBlock.vue'
import DashboardEmptyTour from '@/components/dashboard/DashboardEmptyTour.vue'
import ImportDropModal from '@/components/import/ImportDropModal.vue'
import NotificationsPauseToggle from '@/components/tour/NotificationsPauseToggle.vue'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import { useActivitiesStore } from '@/stores/activities'
import { useSubscription, type SubscriptionUsage } from '@/composables/useSubscription'
import { isForbidden } from '@/utils/reminders'
import { browserZone } from '@/utils/datetime'
import { dashboardZone } from '@/utils/dashboard'

/**
 * Dashboard "Hoy" (spec Paleta B §6). Cada bloque pide lo suyo al cambiar de gira, con guard de
 * petición; la vista solo carga el cupo (lo comparten "Por resolver" y "Cupo del plan") y, si el
 * store aún no las tiene, las actividades de la gira.
 */
const { t, locale } = useI18n()
const tours = useToursStore()
const auth = useAuthStore()
const activities = useActivitiesStore()
const subscriptionApi = useSubscription()

const tour = computed(() => tours.activeTour)
const tourUuid = computed(() => tour.value?.uuid ?? null)

// ── Reloj (cada 60 s) ─────────────────────────────────────────────────────────
const now = shallowRef(DateTime.now())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => (now.value = DateTime.now()), 60_000)
})

// Actividades de la gira: se piden ya en `setup` (no en `onMounted`) para no pintar un frame de
// "sin actividades". Al cambiar de gira las recarga el propio store. Sin gira o en demo, nada.
if (
  !import.meta.env.SSR &&
  tourUuid.value &&
  !auth.isDemoMode &&
  !activities.loading &&
  activities.loadedTourUuid !== tourUuid.value
) {
  void activities.loadActivities()
}

/** El store tiene las actividades de la gira activa (en demo, lo que haya). */
const activitiesReady = computed(
  () => auth.isDemoMode || (!!tourUuid.value && activities.loadedTourUuid === tourUuid.value)
)
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// ── Cupo ──────────────────────────────────────────────────────────────────────
const usage = ref<SubscriptionUsage | null>(null)
const usageLoading = ref(false)
const usageError = ref(false)
let usageRequest = 0

async function loadUsage(uuid: string | null) {
  const req = ++usageRequest
  usage.value = null
  usageError.value = false
  if (!uuid || auth.isDemoMode) {
    usageLoading.value = false
    return
  }
  usageLoading.value = true
  try {
    const data = await subscriptionApi.usage(uuid)
    if (req !== usageRequest) return
    usage.value = data
  } catch (e) {
    if (req !== usageRequest) return
    // 403/404 = no aplica (sin error visible); el resto, error del bloque con "Reintentar".
    usageError.value = !isForbidden(e)
  } finally {
    if (req === usageRequest) usageLoading.value = false
  }
}

watch(tourUuid, (uuid) => void loadUsage(uuid), { immediate: true })

// ── Estados de la vista ───────────────────────────────────────────────────────
const tourIsEmpty = computed(
  () =>
    !!tourUuid.value &&
    !auth.isDemoMode &&
    activitiesReady.value &&
    !activities.loading &&
    !activities.error &&
    activities.activities.length === 0
)

// ── Cabecera ──────────────────────────────────────────────────────────────────
const firstName = computed(
  () => auth.user?.first_name?.trim() || auth.user?.full_name?.trim().split(/\s+/)[0] || ''
)
/**
 * Zona de la gira (la de su próxima actividad): `null` mientras no hay actividades de esta gira;
 * si su carga falla, la del navegador. La usan la cabecera y el rango de "Envíos".
 */
const tourZone = computed<string | null>(() => {
  if (activitiesReady.value) return dashboardZone(activities.activities, now.value)
  return activities.error && !activities.loading ? browserZone() : null
})
const zone = computed(() => tourZone.value ?? browserZone())
const todayLabel = computed(() => {
  const d = now.value.setZone(zone.value).setLocale(locale.value === 'es' ? 'es-ES' : 'en-GB')
  const date = d.toLocaleString({ weekday: 'long', day: 'numeric', month: 'long' })
  const city = (zone.value.split('/').pop() ?? zone.value).replace(/_/g, ' ')
  return `${date} · ${city} (${d.toFormat('ZZZZ')})`
})

// ── Modales ───────────────────────────────────────────────────────────────────
const showAdd = ref(false)
const showCreate = ref(false)
const showImportCal = ref(false)

// Importar agenda (F2 A3-A5, A7): solo admins de la gira fuera de la demo.
const canImport = computed(() => tour.value?.current_user_is_admin === true && !auth.isDemoMode)
const showImport = ref(false)

function openImportFromCreate() {
  showCreate.value = false
  showImport.value = true
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg">
    <TourSelectPrompt v-if="!tour" />

    <div
      v-else
      class="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 lg:py-6 pb-28 lg:pb-6"
    >
      <header class="mb-5 flex items-start gap-4">
        <div class="min-w-0 flex-1">
          <p
            class="font-time tnum text-[13px] text-ink-2 first-letter:uppercase truncate"
            data-testid="dashboard-today"
          >
            {{ todayLabel }}
          </p>
          <h2
            class="text-[24px] font-bold text-ink leading-tight truncate"
            data-testid="dashboard-greeting"
          >
            {{ firstName ? t('dashboard.greeting', { name: firstName }) : t('dashboard.title') }}
          </h2>
          <p class="text-[15px] text-ink-2 truncate">
            {{ tour.artist_name }} · {{ tour.name }}
          </p>
          <NotificationsPauseToggle
            :tour="tour"
            class="mt-1"
            data-testid="dashboard-notif-pause"
          />
        </div>
        <BtnPrimary
          class="hidden lg:inline-flex flex-shrink-0"
          data-testid="dashboard-add"
          @click="showAdd = true"
        >
          <span aria-hidden="true">+</span>
          {{ t('dashboard.empty.add') }}
        </BtnPrimary>
      </header>

      <DashboardEmptyTour
        v-if="tourIsEmpty"
        :can-import="canImport"
        @import="showImport = true"
        @add="showCreate = true"
        @connect-calendar="showImportCal = true"
      />

      <div
        v-else
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-start"
      >
        <div class="contents lg:flex lg:flex-col lg:gap-4 lg:col-span-8 min-w-0">
          <DashboardPendingBlock
            class="order-1 lg:order-none md:col-span-2"
            :usage="usage"
            :now="now"
          />
          <DashboardUpcomingBlock
            class="order-2 lg:order-none"
            :class="auth.isDemoMode ? 'md:col-span-2' : ''"
            :now="now"
          />
        </div>
        <div class="contents lg:flex lg:flex-col lg:gap-4 lg:col-span-4 min-w-0">
          <DashboardSendsBlock
            class="order-4 lg:order-none"
            :zone="tourZone"
          />
          <DashboardPlanBlock
            class="order-5 lg:order-none"
            :usage="usage"
            :loading="usageLoading"
            :error="usageError"
            @retry="loadUsage(tourUuid)"
          />
          <DashboardInboxBlock
            v-if="!auth.isDemoMode"
            class="order-3 lg:order-none"
          />
        </div>
      </div>

      <!-- Móvil: botón flotante sobre el MobileNav -->
      <button
        type="button"
        class="lg:hidden fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 w-14 h-14 rounded-full bg-acid text-night shadow-[0_8px_24px_var(--shadow-md)] flex items-center justify-center border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
        :aria-label="t('dashboard.empty.add')"
        :title="t('dashboard.empty.add')"
        data-testid="dashboard-add-fab"
        @click="showAdd = true"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
          />
          <line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
          />
        </svg>
      </button>
    </div>

    <AddActivityModal
      :show="showAdd"
      :can-import="canImport"
      @close="showAdd = false"
      @open-create="showCreate = true"
      @open-import-cal="showImportCal = true"
      @open-import="showImport = true"
    />
    <CreateActivityModal
      :show="showCreate"
      :can-import="canImport"
      @close="showCreate = false"
      @open-import="openImportFromCreate"
    />
    <ImportDropModal
      v-if="canImport && tourUuid"
      :show="showImport"
      :tour-uuid="tourUuid"
      entry-point="dashboard"
      expected="itinerary"
      @close="showImport = false"
    />
    <ImportCalActivitiesModal
      :show="showImportCal"
      @close="showImportCal = false"
    />
  </div>
</template>
