<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Translation as I18nT, useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { useTours, type TourFull } from '@/composables/useTours'
import TourInsightsPanel from '@/components/tour/TourInsightsPanel.vue'
import TourDocumentsPanel from '@/components/tour/TourDocumentsPanel.vue'
import ScheduleConflictsPanel from '@/components/tour/ScheduleConflictsPanel.vue'
import TourSelectPrompt from '@/components/tour/TourSelectPrompt.vue'
import CrewPortalPanel from '@/components/tour/CrewPortalPanel.vue'
import TourRemindersPanel from '@/components/tour/TourRemindersPanel.vue'
import NoticesPanel from '@/components/tour/notices/NoticesPanel.vue'
import { useNoticesStore } from '@/stores/notices'
import { DateTime } from 'luxon'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ImportDropModal from '@/components/import/ImportDropModal.vue'
import {
  listImportJobs,
  type ImportExpected,
  type ImportJobListItem,
} from '@/composables/useImportJobs'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toursStore = useToursStore()
const toursApi = useTours()

type Tab = 'insights' | 'documents' | 'conflicts' | 'crew' | 'reminders' | 'notices'
const activeTab = ref<Tab>('insights')

const BASE_TABS: { key: Tab; labelKey: string }[] = [
  { key: 'insights', labelKey: 'tourHub.tabs.insights' },
  { key: 'documents', labelKey: 'tourHub.tabs.documents' },
  { key: 'conflicts', labelKey: 'tourHub.tabs.conflicts' },
]

const hasTourUuid = computed(() => !!toursStore.activeTour?.uuid)

// Rol real del usuario en la gira: `current_user_is_admin` del detalle (staff, owner o miembro
// activo admin/tour_manager), igual que el backend. El listado también lo trae
// (`TourListSerializer`, ya mapeado en `toursStore`), pero aquí se refresca con el detalle;
// mientras falte (o si el backend aún no lo expone) se aproxima por owner/superuser.
const tourDetail = ref<TourFull | null>(null)
let detailRequest = 0

// uuid de la gira cuyo detalle ya ha respondido (bien o mal): hasta entonces los permisos salen
// del fallback y no son fiables para decidir la pestaña `crew` pedida por query.
const detailSettledFor = ref<string | null>(null)

async function loadDetail(uuid: string | undefined) {
  const req = ++detailRequest
  tourDetail.value = null
  detailSettledFor.value = null
  if (!uuid) return
  try {
    const full = await toursApi.getTour(uuid)
    if (req === detailRequest) tourDetail.value = full
  } catch {
    // Sin detalle se queda el fallback.
  } finally {
    if (req === detailRequest) detailSettledFor.value = uuid
  }
}

watch(() => toursStore.activeTour?.uuid, loadDetail, { immediate: true })

const fallbackIsAdmin = computed(
  () =>
    !!auth.user?.is_superuser ||
    (!!auth.user?.email && auth.user.email === toursStore.activeTour?.owner_email)
)

const isAdmin = computed(() => {
  const detail = tourDetail.value
  if (detail && detail.uuid === toursStore.activeTour?.uuid) {
    if (typeof detail.current_user_is_admin === 'boolean') return detail.current_user_is_admin
  }
  return fallbackIsAdmin.value
})

// Gestión del portal del crew y de la visibilidad de documentos: admin de la gira o staff
// (`can_manage_crew` del detalle); si el backend no lo expone, se usa `isAdmin`.
const canManageCrew = computed(() => {
  const detail = tourDetail.value
  if (detail && detail.uuid === toursStore.activeTour?.uuid) {
    if (typeof detail.can_manage_crew === 'boolean') return detail.can_manage_crew
  }
  return isAdmin.value
})

// La pestaña del portal del crew solo la ven quienes pueden gestionarlo (el backend da 403 al resto).
// La de recordatorios, solo los admins de la gira (`current_user_is_admin`; staff no cuenta).
const TABS = computed(() => {
  const tabs = [...BASE_TABS]
  if (isAdmin.value) {
    tabs.push({ key: 'notices', labelKey: 'tourHub.tabs.notices' })
    tabs.push({ key: 'reminders', labelKey: 'tourHub.tabs.reminders' })
  }
  if (canManageCrew.value) tabs.push({ key: 'crew', labelKey: 'tourHub.tabs.crew' })
  return tabs
})
watch(canManageCrew, (can) => {
  if (!can && activeTab.value === 'crew') activeTab.value = 'insights'
})
watch(isAdmin, (admin) => {
  if (!admin && (activeTab.value === 'reminders' || activeTab.value === 'notices')) {
    activeTab.value = 'insights'
  }
})

// Contador de avisos pendientes en la pestaña (R2): una petición al entrar en la gira siendo
// admin, en `useNoticesStore`, que reutiliza el panel (sin pedirlo otra vez) y mantiene al día
// con su polling. Sin dato (error), no se pinta.
const noticesStore = useNoticesStore()
const pendingNotices = computed(() =>
  noticesStore.tourUuid === toursStore.activeTour?.uuid ? noticesStore.pendingCount : null
)

watch(
  [() => toursStore.activeTour?.uuid, isAdmin],
  ([uuid, admin]) => {
    if (!uuid || !admin) {
      if (noticesStore.tourUuid !== null) noticesStore.reset(null)
      return
    }
    if (noticesStore.isLoadingOrLoaded(uuid)) return
    noticesStore.load(uuid).catch(() => {
      // Sin contador; el panel enseña el error si se abre.
    })
  },
  { immediate: true }
)

// ─── Importar (F1) ────────────────────────────────────────────────────────────
// Botón "Importar" y aviso de borradores sin revisar (`status=ready`), solo para admins y fuera
// de la demo. Protección frente a respuestas atrasadas al cambiar de gira.
const canImport = computed(() => isAdmin.value && !auth.isDemoMode)
const showImport = ref(false)
/**
 * F2: el botón "Importar" abre el modal genérico (`any`, C1); "Importar equipo" de Crew y
 * Recordatorios y el deep link `?import=team` lo abren para el equipo (C8-C10).
 */
const importExpected = ref<ImportExpected>('any')

function openImport(expected: ImportExpected) {
  importExpected.value = expected
  showImport.value = true
}
const pendingImports = ref<ImportJobListItem[]>([])
let importsRequest = 0

async function loadPendingImports() {
  const req = ++importsRequest
  pendingImports.value = []
  const uuid = toursStore.activeTour?.uuid
  if (!uuid || !canImport.value) return
  try {
    const jobs = await listImportJobs(uuid, 'ready')
    if (req !== importsRequest) return
    pendingImports.value = [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at))
  } catch {
    // Sin aviso: no bloquea la gira.
  }
}

watch([() => toursStore.activeTour?.uuid, canImport], loadPendingImports, { immediate: true })

const latestImport = computed(() => pendingImports.value[0] ?? null)

/**
 * F3: un borrador de una suscripción iCal (`source_kind="ical_sync"`) se anuncia como cambios del
 * calendario, con su nombre y los eventos por revisar, en vez del nombre de archivo.
 */
const latestCalendar = computed(() => {
  const job = latestImport.value
  if (!job || (job.source_kind !== 'ical_sync' && !job.calendar)) return null
  const cal = job.calendar
  const n = cal ? cal.new + cal.changed + cal.cancelled : (job.activities_found ?? 0)
  return { name: cal?.name || job.filenames[0] || t('ical.card.unnamed'), n }
})

function importFileLabel(job: ImportJobListItem): string {
  return job.filenames[0] ?? t('importer.pastedText')
}

function importDate(iso: string): string {
  return DateTime.fromISO(iso)
    .setLocale(locale.value)
    .toLocaleString({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function closeImport() {
  showImport.value = false
  // Un job cerrado a medias puede haber terminado ya: se refresca el aviso.
  void loadPendingImports()
}

// Deep links `/tour?tab=<pestaña>` (inbox → Conflictos), `?tab=notices&notice=<uuid>` (inbox →
// aviso) y `?tab=reminders&import=team` (Hoy → "Añadir equipo"): solo pestañas visibles; luego se
// limpian `tab`, `notice` e `import` en un único `replace`. `crew`, `reminders`, `notices` y el
// importador dependen del permiso real: esperan al detalle de la gira. `import=team` solo abre el
// modal con `canImport` (admin fuera de la demo); cualquier otro valor se ignora.
const requestedTab = ref<string | null>(null)
const pendingNotice = ref<string | null>(null)
const requestedNotice = ref<string | null>(null)
const pendingImport = ref(false)

function applyRequestedTab() {
  const tab = requestedTab.value
  if (tab === null) return
  const needsDetail =
    tab === 'crew' || tab === 'reminders' || tab === 'notices' || pendingImport.value
  const detailReady =
    !!toursStore.activeTour?.uuid && detailSettledFor.value === toursStore.activeTour.uuid
  if (needsDetail && !detailReady) return
  const match = TABS.value.find((x) => x.key === tab)
  if (match) activeTab.value = match.key
  requestedNotice.value = match?.key === 'notices' ? pendingNotice.value : null
  if (pendingImport.value && canImport.value) openImport('team')
  requestedTab.value = null
  pendingNotice.value = null
  pendingImport.value = false
  void router.replace({
    query: { ...route.query, tab: undefined, notice: undefined, import: undefined },
  })
}

function onInitialNoticeConsumed() {
  requestedNotice.value = null
}

watch(
  () => [route.query.tab, route.query.notice, route.query.import] as const,
  ([tab, notice, importParam]) => {
    if (tab === undefined && notice === undefined && importParam === undefined) return
    pendingNotice.value = typeof notice === 'string' && notice ? notice : null
    pendingImport.value = importParam === 'team'
    // Un `notice` sin `tab` también lleva a la pestaña de avisos; un `import` solo, a ninguna.
    requestedTab.value =
      typeof tab === 'string' ? tab : tab === undefined && notice !== undefined ? 'notices' : ''
    applyRequestedTab()
  },
  { immediate: true }
)
watch([TABS, detailSettledFor], applyRequestedTab)
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg">
    <!-- No tour selected -->
    <TourSelectPrompt v-if="!toursStore.activeTourId" />

    <!-- No UUID (mock tour) -->
    <div
      v-else-if="!hasTourUuid"
      class="h-full flex flex-col items-center justify-center gap-2 px-4 text-center"
    >
      <p class="text-[14px] text-ink-4">
        Esta gira aún no tiene datos del servidor
      </p>
    </div>

    <div
      v-else
      class="max-w-6xl mx-auto px-4 sm:px-6 py-6"
    >
      <!-- Importar (F1) -->
      <div
        v-if="canImport"
        class="flex flex-col-reverse sm:flex-row sm:items-center gap-3 mb-4"
      >
        <div
          v-if="latestImport"
          class="flex-1 min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded border border-line bg-bg-3 px-3.5 py-2"
          data-test="import-pending-banner"
        >
          <StatusBadge
            status="pending"
            size="sm"
            :label="t('importer.pendingBadge')"
          />
          <I18nT
            v-if="latestCalendar"
            keypath="importer.pendingBannerCalendar"
            tag="span"
            class="min-w-0 text-[14px] text-ink break-words"
            data-test="import-pending-calendar"
          >
            <template #name>
              <span class="font-semibold">{{ latestCalendar.name }}</span>
            </template>
            <template #n>
              <span class="font-time tnum">{{ latestCalendar.n }}</span>
            </template>
          </I18nT>
          <I18nT
            v-else-if="latestImport.activities_found"
            keypath="importer.pendingBannerActivities"
            :plural="latestImport.activities_found"
            tag="span"
            class="min-w-0 text-[14px] text-ink break-words"
            data-test="import-pending-activities"
          >
            <template #file>
              <span class="font-semibold">{{ importFileLabel(latestImport) }}</span>
            </template>
            <template #n>
              <span class="font-time tnum">{{ latestImport.activities_found }}</span>
            </template>
          </I18nT>
          <I18nT
            v-else
            keypath="importer.pendingBanner"
            tag="span"
            class="min-w-0 text-[14px] text-ink break-words"
          >
            <template #file>
              <span class="font-semibold">{{ importFileLabel(latestImport) }}</span>
            </template>
            <template #date>
              <span class="font-time tnum text-ink-2">{{ importDate(latestImport.created_at) }}</span>
            </template>
          </I18nT>
          <span
            v-if="pendingImports.length > 1"
            class="text-[13px] text-ink-2"
          >{{ t('importer.pendingMore', { n: pendingImports.length - 1 }) }}</span>
          <RouterLink
            :to="{ name: 'tour-import', params: { jobUuid: latestImport.uuid } }"
            class="ml-auto inline-flex items-center min-h-[44px] lg:min-h-0 text-[14px] font-semibold text-olive hover:text-olive-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
            data-test="import-pending-link"
          >
            {{ t('importer.review') }}
          </RouterLink>
        </div>
        <BtnSecondary
          type="button"
          class="sm:ml-auto self-start sm:self-auto"
          data-test="import-open"
          @click="openImport('any')"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line
              x1="12"
              y1="3"
              x2="12"
              y2="15"
            />
          </svg>
          {{ t('importer.open') }}
        </BtnSecondary>
      </div>

      <!-- Tabs -->
      <div
        class="flex items-center gap-1 p-1 mb-6 rounded-[10px] bg-glass-hover overflow-x-auto max-w-full w-fit"
      >
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="flex-shrink-0 whitespace-nowrap inline-flex items-center min-h-[44px] lg:min-h-[32px] px-3.5 py-1.5 rounded-[7px] text-[13px] transition-colors cursor-pointer border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
          :class="activeTab === tab.key ? 'bg-bg-3 text-ink shadow-sm font-semibold' : 'bg-transparent text-ink-2 font-medium hover:text-ink'"
          @click="activeTab = tab.key"
        >
          {{ t(tab.labelKey) }}
          <span
            v-if="tab.key === 'notices' && pendingNotices"
            class="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-pending-bg text-pending-fg text-[12px] font-bold"
            data-test="notices-tab-count"
            :aria-label="t('notices.pendingCount', { n: pendingNotices }, pendingNotices)"
          >{{ pendingNotices }}</span>
        </button>
      </div>

      <TourInsightsPanel
        v-if="activeTab === 'insights'"
        :tour-uuid="toursStore.activeTour!.uuid"
      />
      <TourDocumentsPanel
        v-else-if="activeTab === 'documents'"
        :tour-uuid="toursStore.activeTour!.uuid"
        :is-admin="isAdmin"
        :can-manage-crew="canManageCrew"
      />
      <ScheduleConflictsPanel
        v-else-if="activeTab === 'conflicts'"
        :tour-uuid="toursStore.activeTour!.uuid"
      />
      <CrewPortalPanel
        v-else-if="activeTab === 'crew' && canManageCrew"
        :tour-uuid="toursStore.activeTour!.uuid"
        :can-import="canImport"
        @import-team="openImport('team')"
      />
      <TourRemindersPanel
        v-else-if="activeTab === 'reminders' && isAdmin"
        :tour-uuid="toursStore.activeTour!.uuid"
        :can-import="canImport"
        @import-team="openImport('team')"
      />
      <NoticesPanel
        v-else-if="activeTab === 'notices' && isAdmin"
        :tour-uuid="toursStore.activeTour!.uuid"
        :initial-notice="requestedNotice"
        @initial-consumed="onInitialNoticeConsumed"
      />
    </div>

    <ImportDropModal
      v-if="canImport && toursStore.activeTour?.uuid"
      :show="showImport"
      :tour-uuid="toursStore.activeTour.uuid"
      entry-point="tour"
      :expected="importExpected"
      @close="closeImport"
    />
  </div>
</template>
