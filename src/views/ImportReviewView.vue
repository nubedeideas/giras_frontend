<script setup lang="ts">
// Revisión de una importación (F1 §4.3), ruta `tour-import` (`/tour/import/:jobUuid`).
// Estados: carga, 404/403, procesando (ImportProgress), `failed`, `discarded`/caducado, `done`
// (ImportResultSummary) y `ready` (región, avisos, diferidos, bloque Equipo y barra Confirmar).
// Los PATCH van en cola secuencial; cada respuesta sustituye al job entero.
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import MobileDetailOverlay from '@/components/ui/MobileDetailOverlay.vue'
import ImportConfirmBar from '@/components/import/ImportConfirmBar.vue'
import ImportDeferredNotice from '@/components/import/ImportDeferredNotice.vue'
import ImportDropModal from '@/components/import/ImportDropModal.vue'
import ImportMatchResolver from '@/components/import/ImportMatchResolver.vue'
import ImportProgress from '@/components/import/ImportProgress.vue'
import ImportResultSummary from '@/components/import/ImportResultSummary.vue'
import ImportTeamRowEditor from '@/components/import/ImportTeamRowEditor.vue'
import ImportTeamTable from '@/components/import/ImportTeamTable.vue'
import { useContactRoles, type ContactRole } from '@/composables/useContactRoles'
import {
  confirmImportJob,
  discardImportJob,
  getImportJob,
  patchImportDraft,
  type ImportDraftPatch,
  type ImportJob,
  type ImportRowPatch,
  type ImportTeamRow,
} from '@/composables/useImportJobs'
import { isImportProcessing } from '@/composables/useImportJobPolling'
import { useIsMobile } from '@/composables/useIsMobile'
import { useContactsStore } from '@/stores/contacts'
import { useReminderCatalogStore } from '@/stores/reminderCatalog'
import { useToursStore } from '@/stores/tours'
import { apiErrorCodes } from '@/utils/notificationErrors'
import {
  apiErrorRows,
  canConfirm,
  detectedTeam,
  errorKey,
  importErrorKey,
  needsResolver,
} from '@/utils/importReview'

const { t, locale } = useI18n()
const route = useRoute()
const toursStore = useToursStore()
const contactsStore = useContactsStore()
const reminderCatalog = useReminderCatalogStore()
const { isMobile } = useIsMobile()

const jobUuid = computed(() => String(route.params.jobUuid ?? ''))
const job = ref<ImportJob | null>(null)
const loading = ref(true)
const loadErrorKey = ref('')

// ─── Carga (con protección frente a respuestas atrasadas) ─────────────────────

let request = 0

async function load() {
  const id = ++request
  const uuid = jobUuid.value
  loading.value = true
  loadErrorKey.value = ''
  job.value = null
  selectedId.value = null
  onlyPending.value = false
  rowErrors.value = {}
  // Los errores de otro job no se arrastran al nuevo.
  confirmError.value = ''
  regionError.value = ''
  discardError.value = ''
  discardOpen.value = false
  try {
    const j = await getImportJob(uuid)
    if (id !== request) return
    job.value = j
  } catch (e) {
    if (id !== request) return
    loadErrorKey.value = importErrorKey(e)
  } finally {
    if (id === request) loading.value = false
  }
}

/** Recarga sin esqueleto (tras un 409/400 de confirmar o descartar). */
async function refresh() {
  const id = request
  const uuid = jobUuid.value
  try {
    const j = await getImportJob(uuid)
    if (id === request && uuid === jobUuid.value) job.value = j
  } catch {
    // Se queda el job que había; el error ya se ha mostrado.
  }
}

onMounted(load)
watch(jobUuid, (uuid, prev) => {
  if (uuid && uuid !== prev) void load()
})

// La gira del job pasa a ser la activa una sola vez por job: cuando llega el job o, si el listado
// de giras aún no estaba, cuando llega (el usuario puede cambiar de gira después sin que se
// le imponga otra vez la del job al recargarse el listado).
let tourAppliedFor: string | null = null
watch(
  [() => job.value?.uuid, () => job.value?.tour, () => toursStore.tours.length],
  ([uuid, tourUuid]) => {
    if (!uuid || !tourUuid || tourAppliedFor === uuid) return
    if (toursStore.activeTour?.uuid === tourUuid || toursStore.setActiveTourByUuid(tourUuid)) {
      tourAppliedFor = uuid
    }
  },
  { immediate: true }
)

// ─── Roles (una vez) ──────────────────────────────────────────────────────────

const roles = ref<ContactRole[]>([])
const rolesError = ref(false)

onMounted(async () => {
  try {
    roles.value = (await useContactRoles().listRoles()).filter((r) => r.is_active !== false)
  } catch {
    rolesError.value = true
  }
})

// ─── Estado derivado ──────────────────────────────────────────────────────────

type ViewState = 'processing' | 'failed' | 'discarded' | 'expired' | 'done' | 'ready'

const state = computed<ViewState | null>(() => {
  const j = job.value
  if (!j) return null
  if (isImportProcessing(j)) return 'processing'
  if (j.status === 'done') return 'done'
  if (j.status === 'failed') return 'failed'
  if (j.status === 'discarded') return j.error_code === 'expired' ? 'expired' : 'discarded'
  if (j.purged_at) return 'expired'
  return 'ready'
})

const summary = computed(() => job.value?.summary ?? null)
const whatsappEstimate = computed(() => job.value?.whatsapp_estimate ?? null)
// En móvil la barra de confirmar es fija: el contenido deja sitio para ella (más alta con la
// estimación de WhatsApp y su aviso).
const readyPadding = computed(() => {
  if (state.value !== 'ready') return 'pb-28 lg:pb-6'
  const e = whatsappEstimate.value
  if (e && e.people > 0) {
    return e.exceeds
      ? 'pb-[calc(260px+env(safe-area-inset-bottom))] lg:pb-0'
      : 'pb-[calc(190px+env(safe-area-inset-bottom))] lg:pb-0'
  }
  return 'pb-[calc(160px+env(safe-area-inset-bottom))] lg:pb-0'
})
const needsAction = computed(() => summary.value?.needs_action ?? 0)
const confirmable = computed(() => canConfirm(job.value))

const failedText = computed(() => t(errorKey(job.value?.error_code)))

const detectedItems = computed(() =>
  detectedTeam(job.value).map((d) => ({
    key: d.key,
    text: t('importer.detectedTeam', { file: d.filename || t('importer.pastedText'), n: d.people }),
  }))
)

const warnings = computed(() =>
  (job.value?.draft?.warnings ?? []).map((w, i) => ({
    key: `${i}-${w.code}`,
    text: t(`importer.warnings.${w.code}`, { limit: w.limit ?? '' }),
  }))
)

const groupLine = computed(() => {
  const g = job.value?.team_group
  const n = summary.value?.in_group ?? 0
  if (!g) return ''
  if (!g.exists) {
    // Con el grupo sin crear el backend da siempre `is_default=false`: queda como grupo por defecto
    // si la gira no tiene otro (`default_group_name` vacío).
    return g.default_group_name
      ? t('importer.group.willCreatePlain', { n }, n)
      : t('importer.group.willCreate')
  }
  return t('importer.group.exists', { n }, n)
})

const groupNotDefault = computed(() => {
  const g = job.value?.team_group
  return g && !g.is_default && g.default_group_name ? g.default_group_name : ''
})

// ─── Filtro "por resolver" ────────────────────────────────────────────────────

const onlyPending = ref(false)
watch(needsAction, (n) => {
  if (n === 0) onlyPending.value = false
})

// ─── Región por defecto ───────────────────────────────────────────────────────

/** Países frecuentes con su prefijo (§4.3), más el actual si no está. */
const FREQUENT_REGIONS: Record<string, string> = {
  ES: '+34',
  MX: '+52',
  CO: '+57',
  AR: '+54',
  CL: '+56',
  PE: '+51',
  US: '+1',
  GB: '+44',
  FR: '+33',
  DE: '+49',
  IT: '+39',
  PT: '+351',
}

const currentRegion = computed(() => job.value?.draft?.assumptions?.default_region ?? 'ES')
const regionValue = ref('ES')
watch(currentRegion, (r) => (regionValue.value = r), { immediate: true })
const regionSaving = ref(false)
const regionError = ref('')

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([locale.value], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

const regionOptions = computed(() => {
  const codes = Object.keys(FREQUENT_REGIONS)
  if (!codes.includes(currentRegion.value)) codes.push(currentRegion.value)
  return codes.map((code) => {
    const prefix = FREQUENT_REGIONS[code]
    const country = countryName(code)
    return {
      code,
      label: prefix ? t('importer.region.option', { prefix, country }) : country,
    }
  })
})

function onRegionChange() {
  const region = regionValue.value
  if (region === currentRegion.value) return
  regionSaving.value = true
  regionError.value = ''
  void enqueue(jobUuid.value, { assumptions: { default_region: region } })
    .then((ok) => {
      if (ok) return
      regionError.value = t('importer.errors.saveRegion')
      regionValue.value = currentRegion.value
    })
    .finally(() => (regionSaving.value = false))
}

// ─── Guardado por fila (cola secuencial) ──────────────────────────────────────

const saving = ref(new Set<string>())
const rowErrors = ref<Record<string, string>>({})
let queue: Promise<unknown> = Promise.resolve()

/** Encola un PATCH; `true` si ha ido bien. La respuesta sustituye al job entero. */
function enqueue(uuid: string, body: ImportDraftPatch, onError?: (e: unknown) => void): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    try {
      const j = await patchImportDraft(uuid, body)
      if (uuid === jobUuid.value) job.value = j
      return true
    } catch (e) {
      if (uuid === jobUuid.value) onError?.(e)
      return false
    }
  }
  const next = queue.then(run, run)
  queue = next
  return next
}

function rowErrorText(e: unknown): string {
  const key = importErrorKey(e)
  const generic = ['importer.errors.generic', 'importer.errors.network', 'importer.errors.throttled']
  return t(generic.includes(key) ? 'importer.errors.saveRow' : key)
}

function patchRow(patch: ImportRowPatch, opts: { closeEditor?: boolean } = {}): Promise<boolean> {
  const id = patch.client_id
  saving.value.add(id)
  return enqueue(jobUuid.value, { rows: [patch] }, (e) => {
    // `details.rows` dice a qué filas se refiere el error; la editada siempre se marca.
    const text = rowErrorText(e)
    const marked = Object.fromEntries([id, ...apiErrorRows(e)].map((r) => [r, text]))
    rowErrors.value = { ...rowErrors.value, ...marked }
  }).then((ok) => {
    saving.value.delete(id)
    if (ok) {
      if (id in rowErrors.value) {
        const rest = { ...rowErrors.value }
        delete rest[id]
        rowErrors.value = rest
      }
      if (opts.closeEditor && selectedId.value === id) selectedId.value = null
    }
    return ok
  })
}

// ─── Editor ───────────────────────────────────────────────────────────────────

const selectedId = ref<string | null>(null)
const selectedRow = computed<ImportTeamRow | null>(
  () => job.value?.draft?.team?.find((r) => r.client_id === selectedId.value) ?? null
)

function onEdit(row: ImportTeamRow) {
  selectedId.value = selectedId.value === row.client_id ? null : row.client_id
}

function onEditorPatch(patch: ImportRowPatch) {
  void patchRow(patch, { closeEditor: true })
}

// ─── Confirmar ────────────────────────────────────────────────────────────────

const confirming = ref(false)
const confirmError = ref('')
const busy = computed(() => confirming.value || regionSaving.value || saving.value.size > 0)

async function confirm() {
  const uuid = jobUuid.value
  if (!confirmable.value || confirming.value) return
  confirming.value = true
  confirmError.value = ''
  try {
    await queue
    const j = await confirmImportJob(uuid)
    if (uuid !== jobUuid.value) return
    job.value = j
    selectedId.value = null
    // Cambian los contactos de la gira y los destinatarios del Equipo de la gira.
    void contactsStore.fetchContacts()
    void reminderCatalog.invalidate(j.tour)
  } catch (e) {
    if (uuid !== jobUuid.value) return
    confirmError.value = t(importErrorKey(e))
    const codes = apiErrorCodes(e)
    // `unresolved_rows` trae en `details.rows` las filas que faltan: se marcan en la tabla.
    const rows = apiErrorRows(e)
    if (rows.length) {
      const text = t('importer.errors.unresolvedRow')
      rowErrors.value = { ...rowErrors.value, ...Object.fromEntries(rows.map((r) => [r, text])) }
    }
    if (['unresolved_rows', 'already_confirmed', 'job_not_ready'].some((c) => codes.includes(c))) {
      await refresh()
    }
  } finally {
    confirming.value = false
  }
}

// ─── Descartar ────────────────────────────────────────────────────────────────

const discardOpen = ref(false)
const deleteDocs = ref(false)
const discarding = ref(false)
const discardError = ref('')

function openDiscard() {
  deleteDocs.value = false
  discardError.value = ''
  discardOpen.value = true
}

async function discard() {
  const uuid = jobUuid.value
  discarding.value = true
  discardError.value = ''
  try {
    await queue
    const j = await discardImportJob(uuid, { deleteDocuments: deleteDocs.value })
    if (uuid !== jobUuid.value) return
    job.value = j
    discardOpen.value = false
  } catch (e) {
    if (uuid !== jobUuid.value) return
    discardError.value = t(importErrorKey(e))
    if (apiErrorCodes(e).includes('already_confirmed')) {
      discardOpen.value = false
      await refresh()
    }
  } finally {
    discarding.value = false
  }
}

// ─── Importar otra vez ────────────────────────────────────────────────────────

const dropOpen = ref(false)

function onProcessed(j: ImportJob) {
  if (j.uuid === jobUuid.value) job.value = j
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg">
    <div
      class="max-w-5xl mx-auto px-4 sm:px-6 py-5 lg:py-6"
      :class="readyPadding"
    >
      <RouterLink
        :to="{ name: 'tour' }"
        class="inline-flex items-center gap-1 min-h-[44px] lg:min-h-0 mb-3 text-[14px] font-medium text-olive hover:text-olive-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
        data-test="import-back"
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
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {{ t('importer.back') }}
      </RouterLink>

      <!-- Carga -->
      <div
        v-if="loading"
        class="flex flex-col gap-3"
        aria-busy="true"
        data-test="import-loading"
      >
        <span class="sr-only">{{ t('common.loading') }}</span>
        <div class="h-6 w-64 max-w-full rounded-sm bg-bg-4 animate-pulse" />
        <div class="h-4 w-80 max-w-full rounded-sm bg-bg-4 animate-pulse" />
        <div class="h-40 w-full rounded bg-bg-4 animate-pulse" />
      </div>

      <!-- 404 / 403 / red -->
      <p
        v-else-if="loadErrorKey"
        class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
        role="alert"
        data-test="import-load-error"
      >
        {{ t(loadErrorKey) }}
      </p>

      <template v-else-if="job">
        <!-- Procesando (se entra por el aviso de la gira) -->
        <div
          v-if="state === 'processing'"
          class="rounded-lg border border-line bg-bg-3 p-5"
        >
          <ImportProgress
            :job-uuid="job.uuid"
            @ready="onProcessed"
            @failed="onProcessed"
          />
        </div>

        <!-- Fallido -->
        <div
          v-else-if="state === 'failed'"
          class="flex flex-col items-start gap-3"
        >
          <p
            class="w-full text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
            role="alert"
            data-test="import-failed"
          >
            {{ failedText }}
          </p>
          <BtnSecondary
            type="button"
            data-test="import-retry"
            @click="dropOpen = true"
          >
            {{ t('importer.retry') }}
          </BtnSecondary>
        </div>

        <!-- Descartado o caducado -->
        <div
          v-else-if="state === 'discarded' || state === 'expired'"
          class="flex flex-col items-start gap-3"
        >
          <p
            class="w-full text-[14px] text-ink-2 rounded-sm bg-off-bg px-3 py-2"
            data-test="import-closed"
          >
            {{ state === 'expired' ? t('importer.errors.expired') : t('importer.discarded') }}
          </p>
          <BtnSecondary
            type="button"
            data-test="import-retry"
            @click="dropOpen = true"
          >
            {{ t('importer.result.importMore') }}
          </BtnSecondary>
        </div>

        <!-- Confirmado -->
        <ImportResultSummary
          v-else-if="state === 'done'"
          :job="job"
          @import-more="dropOpen = true"
        />

        <!-- Borrador listo para revisar -->
        <div
          v-else-if="state === 'ready'"
          class="flex flex-col gap-4"
        >
          <header class="flex flex-col gap-1.5">
            <h1 class="text-[20px] font-bold text-ink">
              {{ t('importer.title') }}
            </h1>
            <p
              v-if="detectedItems.length"
              class="text-[14px] text-ink-2"
              data-test="import-detected"
            >
              <span class="font-semibold text-ink">{{ t('importer.detected') }}</span>
              {{ detectedItems.map((d) => d.text).join(' · ') }}
            </p>
          </header>

          <ul
            v-if="warnings.length"
            class="flex flex-col gap-1"
            data-test="import-warnings"
          >
            <li
              v-for="w in warnings"
              :key="w.key"
              class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
            >
              {{ w.text }}
            </li>
          </ul>

          <ImportDeferredNotice :job="job" />

          <div class="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
            <label class="flex flex-col gap-1 text-[13px] font-medium text-ink-2">
              {{ t('importer.region.label') }}
              <select
                v-model="regionValue"
                class="min-h-[44px] lg:min-h-[36px] w-full sm:w-64 rounded-sm border border-line-2 bg-bg-3 px-3 text-[15px] lg:text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50"
                :disabled="regionSaving || confirming"
                data-test="import-region"
                @change="onRegionChange"
              >
                <option
                  v-for="o in regionOptions"
                  :key="o.code"
                  :value="o.code"
                >
                  {{ o.label }}
                </option>
              </select>
              <span class="text-[12px] font-normal text-ink-2">
                {{ regionSaving ? t('importer.region.saving') : t('importer.region.help') }}
              </span>
              <span
                v-if="regionError"
                class="text-[13px] font-normal text-failed-fg"
                role="alert"
                data-test="import-region-error"
              >{{ regionError }}</span>
            </label>
          </div>

          <div class="flex flex-col gap-1">
            <p
              class="text-[14px] text-ink"
              data-test="import-group-line"
            >
              {{ groupLine }}
            </p>
            <p
              v-if="groupNotDefault"
              class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
              data-test="import-group-not-default"
            >
              {{ t('importer.group.notDefault', { group: groupNotDefault }) }}
            </p>
          </div>

          <section class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
                {{ t('importer.team.title') }}
              </h2>
              <div
                v-if="needsAction > 0"
                class="flex items-center gap-2"
              >
                <span
                  class="text-[14px] font-semibold text-failed-fg"
                  data-test="import-to-resolve"
                >
                  {{ t('importer.toResolve', { n: needsAction }, needsAction) }}
                </span>
                <button
                  type="button"
                  class="min-h-[44px] lg:min-h-0 px-2 text-[13px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
                  :aria-pressed="onlyPending"
                  data-test="import-filter"
                  @click="onlyPending = !onlyPending"
                >
                  {{ onlyPending ? t('importer.filterAll') : t('importer.filterPending') }}
                </button>
              </div>
            </div>
            <p
              v-if="rolesError"
              class="text-[13px] text-ink-2"
            >
              {{ t('importer.errors.loadRoles') }}
            </p>

            <ImportTeamTable
              :job="job"
              :roles="roles"
              :saving="saving"
              :row-errors="rowErrors"
              :only-pending="onlyPending"
              :selected-id="isMobile ? null : selectedId"
              @patch="patchRow"
              @edit="onEdit"
            >
              <template #expanded="{ row }">
                <div class="flex flex-col gap-3">
                  <ImportMatchResolver
                    v-if="needsResolver(row)"
                    :row="row"
                    :saving="saving.has(row.client_id)"
                    @patch="patchRow"
                  />
                  <ImportTeamRowEditor
                    :row="row"
                    :roles="roles"
                    :saving="saving.has(row.client_id)"
                    :error="rowErrors[row.client_id]"
                    @patch="onEditorPatch"
                    @close="selectedId = null"
                  />
                </div>
              </template>
            </ImportTeamTable>
          </section>

          <p
            v-if="confirmError"
            class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
            role="alert"
            data-test="import-confirm-error"
          >
            {{ confirmError }}
          </p>

          <ImportConfirmBar
            v-if="summary"
            :summary="summary"
            :can-confirm="confirmable"
            :busy="busy"
            :estimate="whatsappEstimate"
            @confirm="confirm"
            @discard="openDiscard"
          />
        </div>
      </template>
    </div>

    <!-- Editor en móvil -->
    <MobileDetailOverlay
      :show="isMobile && !!selectedRow"
      @close="selectedId = null"
    >
      <div
        v-if="selectedRow"
        class="flex-1 overflow-y-auto p-4 flex flex-col gap-4"
      >
        <ImportMatchResolver
          v-if="needsResolver(selectedRow)"
          :row="selectedRow"
          :saving="saving.has(selectedRow.client_id)"
          @patch="patchRow"
        />
        <ImportTeamRowEditor
          :row="selectedRow"
          :roles="roles"
          :saving="saving.has(selectedRow.client_id)"
          :error="rowErrors[selectedRow.client_id]"
          @patch="onEditorPatch"
          @close="selectedId = null"
        />
      </div>
    </MobileDetailOverlay>

    <!-- Descartar -->
    <AppModal
      :show="discardOpen"
      @close="discardOpen = false"
    >
      <div
        class="flex flex-col gap-4"
        data-test="import-discard-modal"
      >
        <p class="text-[16px] font-semibold text-ink">
          {{ t('importer.discard.confirm') }}
        </p>
        <label class="flex items-start gap-2 min-h-[44px] lg:min-h-0 text-[14px] text-ink cursor-pointer">
          <input
            v-model="deleteDocs"
            type="checkbox"
            class="mt-0.5 w-4 h-4 accent-[var(--olive)]"
            data-test="import-discard-docs"
          >
          <span>
            {{ t('importer.discard.deleteDocs') }}
            <span class="block text-[13px] text-ink-2">{{ t('importer.discard.keepDocsHint') }}</span>
          </span>
        </label>
        <p
          v-if="discardError"
          class="text-[13px] text-failed-fg"
          role="alert"
        >
          {{ discardError }}
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <BtnSecondary
            type="button"
            :disabled="discarding"
            @click="discardOpen = false"
          >
            {{ t('importer.discard.cancel') }}
          </BtnSecondary>
          <BtnPrimary
            type="button"
            class="disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="discarding"
            data-test="import-discard-confirm"
            @click="discard"
          >
            {{ t('importer.discard.action') }}
          </BtnPrimary>
        </div>
      </div>
    </AppModal>

    <ImportDropModal
      v-if="job"
      :show="dropOpen"
      :tour-uuid="job.tour"
      entry-point="tour"
      @close="dropOpen = false"
    />
  </div>
</template>
