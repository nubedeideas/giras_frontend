<script setup lang="ts">
// Revisión de una importación (F1 §4.3), ruta `tour-import` (`/tour/import/:jobUuid`).
// Estados: carga, 404/403, procesando (ImportProgress), `failed`, `discarded`/caducado, `done`
// (ImportResultSummary) y `ready` (avisos, diferidos, "N cosas por resolver", bloques Equipo y
// Actividades en el orden de `expected` y barra Confirmar). F2 §4.3: supuestos en bloque, bloque
// Actividades por día con resolutores en línea, editor y "ver origen"; con actividades (o equipo
// que entra al grupo) la barra lleva al paso `?step=notices` ("Qué se va a enviar y a quién",
// ImportNotificationsPreview), que confirma con `{pause_notifications, activate_tour: true}`.
// Los PATCH van en cola secuencial; cada respuesta sustituye al job entero.
// F3 §4.4: cabecera "Cambios de {calendario}" en jobs de suscripción, avisos `ics_*` con recuento,
// filas que ya no están en el feed (`detected.ical.removed`) y cancelaciones en el paso de avisos.
// F4 §4.4: cabecera "Cambios de la hoja {nombre}" + "Ver vinculación" en jobs de una hoja de Google;
// el job se confirma sin cambios como uno de calendario y "Ver origen" recibe la hoja (`open_url`).
// F5a §4.2: en móvil, "Por resolver ({n})" une arriba las filas por resolver de equipo y actividades
// (con "Siguiente") y debajo quedan los bloques con sus "Listas" plegadas; omitir una fila (botón o
// gesto) deja 5 s "Omitida: {título} · Deshacer" en la barra fija, que la recupera con otro PATCH.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DateTime } from 'luxon'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import MobileDetailOverlay from '@/components/ui/MobileDetailOverlay.vue'
import ImportActivityEditor from '@/components/import/ImportActivityEditor.vue'
import ImportActivityList from '@/components/import/ImportActivityList.vue'
import ImportAssumptionsBar from '@/components/import/ImportAssumptionsBar.vue'
import ImportConfirmBar from '@/components/import/ImportConfirmBar.vue'
import ImportDeferredNotice from '@/components/import/ImportDeferredNotice.vue'
import ImportDropModal from '@/components/import/ImportDropModal.vue'
import ImportMatchResolver from '@/components/import/ImportMatchResolver.vue'
import ImportNotificationsPreview from '@/components/import/ImportNotificationsPreview.vue'
import ImportProgress from '@/components/import/ImportProgress.vue'
import ImportResultSummary from '@/components/import/ImportResultSummary.vue'
import ImportTeamRowEditor from '@/components/import/ImportTeamRowEditor.vue'
import ImportTeamTable from '@/components/import/ImportTeamTable.vue'
import { useActivityTypes, type ActivityType } from '@/composables/useActivityTypes'
import { useContactRoles, type ContactRole } from '@/composables/useContactRoles'
import {
  confirmImportJob,
  discardImportJob,
  getImportJob,
  patchImportDraft,
  type ImportActivityRow,
  type ImportAssumptionsPatch,
  type ImportConfirmOptions,
  type ImportDraftPatch,
  type ImportJob,
  type ImportResult,
  type ImportRowPatch,
  type ImportTeamRow,
} from '@/composables/useImportJobs'
import { isImportProcessing } from '@/composables/useImportJobPolling'
import { useIsMobile } from '@/composables/useIsMobile'
import { useActivitiesStore } from '@/stores/activities'
import { useContactsStore } from '@/stores/contacts'
import { useReminderCatalogStore } from '@/stores/reminderCatalog'
import { useToursStore } from '@/stores/tours'
import { apiErrorCodes } from '@/utils/notificationErrors'
import {
  activityTypeOptions,
  apiErrorRows,
  canConfirm,
  isLiveSourceJob,
  isSheetJob,
  detectedActivities,
  detectedTeam,
  errorKey,
  hasDayNumbers,
  importErrorKey,
  isHotelRow,
  needsResolver,
  pendingCounts,
  rowDisplayName,
  removedActivityUuids,
  warningKey,
  type ImportSourceDocument,
} from '@/utils/importReview'
import { FALLBACK_TOUR_ZONE } from '@/utils/timezones'
import { calendarCountsText } from '@/utils/icalSubscriptions'
import { sheetCountsText } from '@/utils/sheetSubscriptions'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toursStore = useToursStore()
const contactsStore = useContactsStore()
const activitiesStore = useActivitiesStore()
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
  assumptionsError.value = ''
  discardError.value = ''
  discardOpen.value = false
  pushedNotices = false
  clearUndo()
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

// ─── Tipos de actividad de la gira (una vez por gira) ──────────────────────────

const activityTypes = ref<ActivityType[]>([])
const typesError = ref(false)
let typesRequest = 0

watch(
  () => job.value?.tour,
  async (tourUuid, prev) => {
    if (!tourUuid || tourUuid === prev) return
    const id = ++typesRequest
    typesError.value = false
    try {
      const list = await useActivityTypes().listActivityTypes(tourUuid)
      if (id === typesRequest) activityTypes.value = list
    } catch {
      if (id === typesRequest) {
        activityTypes.value = []
        typesError.value = true
      }
    }
  },
  { immediate: true }
)

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

// ─── Paso "Qué se va a enviar y a quién" (`?step=notices`, F2 §4.4) ────────────

/**
 * Se pinta el paso con `?step=notices` solo si la barra lleva a él y el borrador se puede confirmar
 * (al recargar con filas por resolver se ve la revisión).
 */
const showNotices = computed(
  () =>
    state.value === 'ready' &&
    confirmMode.value === 'notices' &&
    confirmable.value &&
    route.query.step === 'notices'
)

/**
 * Se entró al paso con `push` desde la revisión (la entrada anterior del historial es la
 * revisión). Al salir se vuelve con `back()` en vez de `replace` para no dejar la revisión repetida
 * en el historial; al recargar con `?step=notices` no hay entrada previa propia y se usa `replace`.
 */
let pushedNotices = false

/** `push`: el botón atrás del navegador vuelve a la revisión. */
function openNotices() {
  if (!confirmable.value) return
  pushedNotices = true
  void router.push({ query: { ...route.query, step: 'notices' } })
}

function closeNotices() {
  if (route.query.step === undefined) return
  if (pushedNotices) {
    pushedNotices = false
    router.back()
    return
  }
  const query = { ...route.query }
  delete query.step
  void router.replace({ query })
}

// En móvil la barra de confirmar es fija: el contenido deja sitio para ella (más alta con la
// estimación de WhatsApp y su aviso).
const readyPadding = computed(() => {
  if (state.value !== 'ready' || showNotices.value) return 'pb-28 lg:pb-6'
  const e = whatsappEstimate.value
  if (e && e.people > 0) {
    return e.exceeds
      ? 'pb-[calc(260px+env(safe-area-inset-bottom))] lg:pb-0'
      : 'pb-[calc(190px+env(safe-area-inset-bottom))] lg:pb-0'
  }
  return 'pb-[calc(160px+env(safe-area-inset-bottom))] lg:pb-0'
})
const pending = computed(() => pendingCounts(job.value))
const needsAction = computed(() => pending.value.total)
const confirmable = computed(() => canConfirm(job.value))
/** Calendario o hoja de Google: se puede confirmar sin cambios para darlo por revisado. */
const liveJob = computed(() => isLiveSourceJob(job.value))
const sheetJob = computed(() => isSheetJob(job.value))

const teamRows = computed(() => job.value?.draft?.team ?? [])
const activityRows = computed(() => job.value?.draft?.activities ?? [])
const hasTeam = computed(() => teamRows.value.length > 0)
const hasActivities = computed(() => activityRows.value.length > 0)

/**
 * Orden de los bloques (F2 §4.3): `itinerary` → Actividades primero; `team` → Equipo primero;
 * `any` (o jobs de F1) → el que tenga más filas por resolver (a igualdad, Equipo).
 */
const blocks = computed<('team' | 'activities')[]>(() => {
  const d = job.value?.detected
  const expected = d && 'expected' in d ? d.expected : undefined
  let activitiesFirst = false
  if (expected === 'itinerary') activitiesFirst = true
  else if (expected !== 'team') activitiesFirst = pending.value.activities > pending.value.team
  const list: ('team' | 'activities')[] = activitiesFirst ? ['activities', 'team'] : ['team', 'activities']
  return list.filter((b) => (b === 'team' ? hasTeam.value : hasActivities.value))
})

/** Con actividades que entran o equipo que entra al grupo, la barra lleva al paso de avisos. */
const confirmMode = computed<'confirm' | 'notices'>(() => {
  const a = summary.value?.activities
  const activitiesIn = a
    ? a.to_create + a.to_replace + (a.to_cancel ?? 0)
    : activityRows.value.filter((r) => r.action !== 'skip').length
  return activitiesIn > 0 || (summary.value?.in_group ?? 0) > 0 ? 'notices' : 'confirm'
})

const jobTour = computed(() => toursStore.tours.find((tr) => tr.uuid === job.value?.tour) ?? null)
const assumptions = computed(() => job.value?.draft?.assumptions ?? null)
const tourTimezone = computed(
  () => jobTour.value?.timezone || assumptions.value?.default_timezone || FALLBACK_TOUR_ZONE
)
const baseYear = computed(() => {
  const start = jobTour.value?.start_date
  const dt = start ? DateTime.fromISO(start) : null
  return dt?.isValid ? dt.year : null
})
const typeOptions = computed(() => activityTypeOptions(activityTypes.value, activityRows.value))
/** "Abrir documento" descarga con el token (`download_url` exige JWT: no sirve como enlace). */
const sourceDocuments = computed<Record<string, ImportSourceDocument>>(() => {
  const j = job.value
  if (!j) return {}
  return Object.fromEntries(
    (j.documents ?? []).map((d) => [d.uuid, { tourUuid: j.tour, uuid: d.uuid, filename: d.filename }])
  )
})
const showDayOne = computed(() =>
  hasDayNumbers(activityRows.value, assumptions.value?.day_one_date ?? null)
)
const showHotels = computed(() => activityRows.value.some(isHotelRow))

const failedText = computed(() => t(errorKey(job.value?.error_code)))

const detectedItems = computed(() => [
  ...detectedTeam(job.value).map((d) => ({
    key: `t-${d.key}`,
    text: t('importer.detectedTeam', { file: d.filename || t('importer.pastedText'), n: d.people }),
  })),
  ...detectedActivities(job.value).map((d) => ({
    key: `a-${d.key}`,
    text: t(
      'importer.detectedActivities',
      { file: d.filename || t('importer.pastedText'), n: d.activities },
      d.activities
    ),
  })),
])

/** Avisos del borrador con texto propio (uno desconocido no se pinta en crudo); F3 con `count`. */
const warnings = computed(() =>
  (job.value?.draft?.warnings ?? []).flatMap((w, i) => {
    const key = warningKey(w.code)
    if (!key) return []
    const params = { limit: w.limit ?? '', count: w.count ?? 0, source: w.source ?? '' }
    const text = w.count !== undefined ? t(key, params, w.count) : t(key, params)
    return [{ key: `${i}-${w.code}`, text }]
  })
)

/** F3: job de una suscripción iCal (calendario y recuentos de la sincronización). */
const calendar = computed(() => job.value?.calendar ?? null)
const calendarLink = { name: 'settings', query: { tab: 'calendars' } }
/** "Cambios de {calendario}: 3 nuevas · 1 cambiada" (solo los recuentos mayores que 0). */
const calendarHeader = computed(() => {
  const c = calendar.value
  if (!c) return ''
  const counts = calendarCountsText((key, named, n) => t(key, named, n), c)
  return counts
    ? t('importer.calendar.header', { name: c.name, counts })
    : t('importer.calendar.headerNoCounts', { name: c.name })
})
/** F4: job de una hoja de Google vinculada (nombre, recuentos y `open_url` para quien la lee). */
const sheet = computed(() => job.value?.sheet ?? null)
/** "Cambios de la hoja {nombre}: 3 nuevas · 1 ya no está" (solo los recuentos mayores que 0). */
const sheetHeader = computed(() => {
  const sh = sheet.value
  if (!sh) return ''
  const name = sh.name || t('importer.activities.fromSheetOnly')
  const counts = sheetCountsText((key, named, n) => t(key, named, n), sh)
  return counts
    ? t('importer.sheet.header', { name, counts })
    : t('importer.sheet.headerNoCounts', { name })
})
const removedUuids = computed(() => removedActivityUuids(job.value))
const toCancel = computed(() => summary.value?.activities?.to_cancel ?? 0)

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

// ─── Móvil: "Por resolver" unificado (F5a §4.2) ──────────────────────────────

/** Bloques con filas por resolver, en el orden de `blocks` (equipo primero si `expected=team`). */
const pendingBlocks = computed(() =>
  blocks.value.filter((b) => (b === 'team' ? pending.value.team : pending.value.activities) > 0)
)
const showMobilePending = computed(() => isMobile.value && needsAction.value > 0)
/** En móvil los bloques solo pintan sus "Listas": lo pendiente va arriba, unido. */
const blockSection = computed<'all' | 'ready'>(() => (isMobile.value ? 'ready' : 'all'))

const scroller = ref<HTMLElement | null>(null)
const pendingSection = ref<HTMLElement | null>(null)
const pendingHeader = ref<HTMLElement | null>(null)

/**
 * Lleva a la siguiente fila por resolver por debajo de la cabecera fija (o a la primera, con
 * `fromStart` o al llegar al final) y le pasa el foco.
 */
function goNextPending(fromStart = false) {
  const root = pendingSection.value
  if (!root) return
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-needs-action="true"]'))
  if (!items.length) return
  const edge = pendingHeader.value?.getBoundingClientRect().bottom ?? 0
  const target = fromStart
    ? items[0]
    : (items.find((el) => el.getBoundingClientRect().top > edge + 16) ?? items[0])
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const top = target.getBoundingClientRect().top - edge - 8
  scroller.value?.scrollBy?.({ top, behavior: reduced ? 'auto' : 'smooth' })
  target.focus({ preventScroll: true })
}

/** "Te quedan {n} por resolver" de la barra: a la primera. */
function onGoPending() {
  onlyPending.value = false
  goNextPending(true)
}

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

// ─── Supuestos de las actividades (F2) ───────────────────────────────────────

const assumptionsSaving = ref(false)
const assumptionsError = ref('')

/** PATCH de supuestos: recalcula todas las filas; la lista queda bloqueada hasta la respuesta. */
function patchAssumptions(patch: ImportAssumptionsPatch) {
  assumptionsSaving.value = true
  assumptionsError.value = ''
  void enqueue(jobUuid.value, { assumptions: patch }, (e) => {
    assumptionsError.value = rowErrorText(e)
  }).finally(() => (assumptionsSaving.value = false))
}

/** "Aplicar a todas las de {ciudad}" del resolutor: la zona de la ciudad en los supuestos. */
function onCityZone(payload: { key: string; timezone: string }) {
  patchAssumptions({ cities: { [payload.key]: payload.timezone } })
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
  const omitted = patch.action === 'skip' && undoCandidate?.clientId === id ? undoCandidate : null
  if (omitted) undoCandidate = null
  saving.value.add(id)
  return enqueue(jobUuid.value, { rows: [patch] }, (e) => {
    // `details.rows` dice a qué filas se refiere el error; la editada siempre se marca.
    const text = rowErrorText(e)
    const marked = Object.fromEntries([id, ...apiErrorRows(e)].map((r) => [r, text]))
    rowErrors.value = { ...rowErrors.value, ...marked }
  }).then((ok) => {
    saving.value.delete(id)
    if (ok && omitted) showUndo(omitted)
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

// ─── Omitir y "Deshacer" (F5a §4.2) ───────────────────────────────────────────

const UNDO_MS = 5000

interface UndoEntry {
  clientId: string
  title: string
  /** PATCH que devuelve la fila a como estaba antes de omitirla. */
  revert: ImportRowPatch
}

const undo = ref<UndoEntry | null>(null)
/** La fila que la tarjeta acaba de omitir: el aviso sale cuando su PATCH ha ido bien. */
let undoCandidate: UndoEntry | null = null
let undoTimer: ReturnType<typeof setTimeout> | null = null

function clearUndo() {
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = null
  undo.value = null
  undoCandidate = null
}

function isActivityRow(row: ImportTeamRow | ImportActivityRow): row is ImportActivityRow {
  return 'activity_type_code' in row
}

/** Omitir con el botón o el gesto de una tarjeta (no la "Mantener" de un resolutor). */
function onOmit(row: ImportTeamRow | ImportActivityRow) {
  const revert = {
    client_id: row.client_id,
    action: row.action,
    ...(row.reviewed ? { reviewed: true } : {}),
  } as ImportRowPatch
  const title = isActivityRow(row) ? row.title : rowDisplayName(row)
  undoCandidate = { clientId: row.client_id, title, revert }
}

function showUndo(entry: UndoEntry) {
  if (undoTimer) clearTimeout(undoTimer)
  undo.value = entry
  undoTimer = setTimeout(() => {
    undoTimer = null
    undo.value = null
  }, UNDO_MS)
}

function onUndo() {
  const entry = undo.value
  if (!entry) return
  clearUndo()
  void patchRow(entry.revert)
}

onBeforeUnmount(clearUndo)

// ─── Editor ───────────────────────────────────────────────────────────────────

const selectedId = ref<string | null>(null)
const selectedRow = computed<ImportTeamRow | null>(
  () => job.value?.draft?.team?.find((r) => r.client_id === selectedId.value) ?? null
)
const selectedActivity = computed<ImportActivityRow | null>(
  () => job.value?.draft?.activities?.find((r) => r.client_id === selectedId.value) ?? null
)

function onEdit(row: ImportTeamRow | ImportActivityRow) {
  selectedId.value = selectedId.value === row.client_id ? null : row.client_id
}

function onEditorPatch(patch: ImportRowPatch) {
  void patchRow(patch, { closeEditor: true })
}

// ─── Confirmar ────────────────────────────────────────────────────────────────

const confirming = ref(false)
const confirmError = ref('')
const busy = computed(
  () =>
    confirming.value || regionSaving.value || assumptionsSaving.value || saving.value.size > 0
)

/**
 * Confirma el borrador. Desde el paso de avisos con `{pause_notifications, activate_tour: true}`;
 * sin paso (ni actividades ni equipo que entre al grupo), sin cuerpo, como F1.
 */
async function confirm(opts: ImportConfirmOptions = {}) {
  const uuid = jobUuid.value
  if (!confirmable.value || confirming.value) return
  confirming.value = true
  confirmError.value = ''
  try {
    await queue
    const j = await confirmImportJob(uuid, opts)
    if (uuid !== jobUuid.value) return
    const hadTeam = (job.value?.draft?.team?.length ?? 0) > 0
    job.value = j
    selectedId.value = null
    closeNotices()
    refreshAfterConfirm(j, hadTeam)
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
    // Estos errores devuelven a la revisión y recargan el job (si ya estaba confirmado, el estado
    // final lo pinta el job recargado); con filas por resolver, se abre con el filtro "Por resolver".
    const reload = ['unresolved_rows', 'already_confirmed', 'job_not_ready', 'activity_gone']
    if (reload.some((c) => codes.includes(c))) {
      closeNotices()
      await refresh()
      if (uuid === jobUuid.value && needsAction.value > 0) onlyPending.value = true
    }
  } finally {
    confirming.value = false
  }
}

/** Tras `confirm`: contactos, catálogo de recordatorios, gira (estado y pausa) y actividades. */
function refreshAfterConfirm(j: ImportJob, hadTeam: boolean) {
  const r = j.result as Partial<ImportResult>
  // F3: las cancelaciones del calendario también cambian la agenda (y cancelan sus avisos).
  const activities =
    (r.activities_created ?? 0) + (r.activities_replaced ?? 0) + (r.activities_cancelled ?? 0)
  // Cambian los contactos de la gira y los destinatarios del Equipo de la gira.
  if (hadTeam || activities === 0) void contactsStore.fetchContacts()
  void reminderCatalog.invalidate(j.tour)
  if (activities > 0 || r.tour_activated || r.notifications_paused) void toursStore.loadTours()
  // F4: vincular cambia el origen de actividades existentes (lo pinta su detalle).
  const touched = activities + (r.activities_linked ?? 0)
  if (touched > 0 && toursStore.activeTour?.uuid === j.tour) void activitiesStore.loadActivities()
}

function onNoticesConfirm(pause: boolean) {
  void confirm({ pause_notifications: pause, activate_tour: true })
}

function onNoticesBack() {
  confirmError.value = ''
  closeNotices()
}

/** La vista previa respondió 409 `job_not_ready`: vuelve a la revisión con el job recargado. */
function onNoticesNotReady() {
  closeNotices()
  void refresh()
}

function onResultUpdated(j: ImportJob) {
  if (j.uuid === jobUuid.value) job.value = j
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
  <div
    ref="scroller"
    class="h-full overflow-y-auto bg-bg"
  >
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
            :expected="job.expected ?? 'any'"
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
          @updated="onResultUpdated"
        />

        <!-- Qué se va a enviar y a quién (?step=notices, F2 §4.4) -->
        <ImportNotificationsPreview
          v-else-if="showNotices"
          :job-uuid="job.uuid"
          :timezone="tourTimezone"
          :busy="confirming"
          :confirm-error="confirmError"
          :to-cancel="toCancel"
          @back="onNoticesBack"
          @confirm="onNoticesConfirm"
          @not-ready="onNoticesNotReady"
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
              v-if="calendar"
              class="flex flex-wrap items-center gap-x-2 text-[14px] text-ink"
              data-test="import-calendar-header"
            >
              <span>{{ calendarHeader }}</span>
              <RouterLink
                :to="calendarLink"
                class="inline-flex items-center min-h-[44px] lg:min-h-0 font-medium text-olive hover:text-olive-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
                data-test="import-calendar-link"
              >
                {{ t('importer.calendar.viewSubscription') }}
              </RouterLink>
            </p>
            <p
              v-if="sheet"
              class="flex flex-wrap items-center gap-x-2 text-[14px] text-ink"
              data-test="import-sheet-header"
            >
              <span>{{ sheetHeader }}</span>
              <RouterLink
                :to="calendarLink"
                class="inline-flex items-center min-h-[44px] lg:min-h-0 font-medium text-olive hover:text-olive-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
                data-test="import-sheet-link"
              >
                {{ t('importer.sheet.viewLink') }}
              </RouterLink>
            </p>
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

          <!-- N cosas por resolver (equipo + actividades) -->
          <div
            v-if="needsAction > 0 && !isMobile"
            class="flex flex-wrap items-center gap-2"
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

          <!-- Móvil: "Por resolver" de equipo y actividades en una sola lista (F5a §4.2) -->
          <section
            v-if="showMobilePending"
            ref="pendingSection"
            class="flex flex-col gap-3"
            data-test="import-mobile-pending"
          >
            <div
              ref="pendingHeader"
              class="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-1 flex items-center justify-between gap-2 border-b border-line bg-bg"
            >
              <h2
                class="text-[15px] font-semibold text-failed-fg"
                data-test="import-mobile-to-resolve"
              >
                {{ t('importer.mobile.toResolve', { n: needsAction }) }}
              </h2>
              <button
                type="button"
                class="inline-flex items-center gap-1 min-h-[44px] px-3 text-[14px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
                data-test="import-mobile-next"
                @click="goNextPending()"
              >
                {{ t('importer.mobile.next') }}
                <span aria-hidden="true">↓</span>
              </button>
            </div>
            <template
              v-for="block in pendingBlocks"
              :key="`pending-${block}`"
            >
              <ImportTeamTable
                v-if="block === 'team'"
                section="pending"
                :job="job"
                :roles="roles"
                :saving="saving"
                :row-errors="rowErrors"
                :selected-id="null"
                @patch="patchRow"
                @edit="onEdit"
                @omit="onOmit"
              />
              <ImportActivityList
                v-else
                section="pending"
                :rows="activityRows"
                :tour-timezone="tourTimezone"
                :types="typeOptions"
                :cities="assumptions?.cities ?? {}"
                :saving="saving"
                :row-errors="rowErrors"
                :selected-id="null"
                :source-documents="sourceDocuments"
                :recalculating="assumptionsSaving"
                :removed-uuids="removedUuids"
                :sheet="sheet"
                @patch="patchRow"
                @city="onCityZone"
                @edit="onEdit"
                @omit="onOmit"
              />
            </template>
          </section>

          <template
            v-for="block in blocks"
            :key="block"
          >
            <!-- Equipo (F1) -->
            <section
              v-if="block === 'team'"
              class="flex flex-col gap-4"
              data-block="team"
              data-test="import-block-team"
            >
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

              <div class="flex flex-col gap-2">
                <h2 class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
                  {{ t('importer.team.title') }}
                </h2>
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
                  :section="blockSection"
                  @patch="patchRow"
                  @edit="onEdit"
                  @omit="onOmit"
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
              </div>
            </section>

            <!-- Actividades (F2) -->
            <section
              v-else
              class="flex flex-col gap-3"
              data-block="activities"
              data-test="import-block-activities"
            >
              <h2 class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase">
                {{ t('importer.activities.title') }}
              </h2>
              <ImportAssumptionsBar
                v-if="assumptions"
                :assumptions="assumptions"
                :saving="assumptionsSaving"
                :base-year="baseYear"
                :show-day-one="showDayOne"
                :show-hotels="showHotels"
                :error="assumptionsError"
                @patch="patchAssumptions"
              />
              <p
                v-if="typesError"
                class="text-[13px] text-ink-2"
                data-test="import-types-error"
              >
                {{ t('importer.activities.typesError') }}
              </p>
              <ImportActivityList
                :rows="activityRows"
                :tour-timezone="tourTimezone"
                :types="typeOptions"
                :cities="assumptions?.cities ?? {}"
                :saving="saving"
                :row-errors="rowErrors"
                :only-pending="onlyPending"
                :selected-id="isMobile ? null : selectedId"
                :source-documents="sourceDocuments"
                :recalculating="assumptionsSaving"
                :removed-uuids="removedUuids"
                :sheet="sheet"
                :section="blockSection"
                @patch="patchRow"
                @city="onCityZone"
                @edit="onEdit"
                @omit="onOmit"
              >
                <template #expanded="{ row }">
                  <ImportActivityEditor
                    :row="row"
                    :types="typeOptions"
                    :saving="saving.has(row.client_id)"
                    :error="rowErrors[row.client_id]"
                    @patch="onEditorPatch"
                    @close="selectedId = null"
                  />
                </template>
              </ImportActivityList>
            </section>
          </template>

          <p
            v-if="!blocks.length"
            class="text-[14px] text-ink-2 py-4"
            data-test="import-empty"
          >
            {{ t('importer.team.empty') }}
          </p>

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
            :pending="needsAction"
            :mode="confirmMode"
            :calendar="liveJob"
            :sheet="sheetJob"
            @confirm="confirm()"
            @notices="openNotices"
            @discard="openDiscard"
            @go-pending="onGoPending"
          >
            <template #notice>
              <div
                class="max-w-5xl mx-auto"
                role="status"
                aria-live="polite"
                data-test="import-undo-region"
              >
                <div
                  v-if="undo"
                  class="mb-2 flex items-center justify-between gap-3 rounded-sm border border-line bg-bg-2 pl-3"
                  data-test="import-undo"
                >
                  <span class="min-w-0 truncate text-[14px] text-ink">
                    {{ t('importer.mobile.skipped', { title: undo.title }) }}
                  </span>
                  <button
                    type="button"
                    class="shrink-0 min-h-[44px] lg:min-h-[36px] px-3 text-[14px] font-semibold text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
                    data-test="import-undo-action"
                    @click="onUndo"
                  >
                    {{ t('importer.mobile.undo') }}
                  </button>
                </div>
              </div>
            </template>
          </ImportConfirmBar>
        </div>
      </template>
    </div>

    <!-- Editor en móvil -->
    <MobileDetailOverlay
      :show="isMobile && (!!selectedRow || !!selectedActivity)"
      @close="selectedId = null"
    >
      <div
        v-if="selectedActivity"
        class="flex-1 overflow-y-auto p-4 flex flex-col gap-4"
      >
        <ImportActivityEditor
          :row="selectedActivity"
          :types="typeOptions"
          :saving="saving.has(selectedActivity.client_id)"
          :error="rowErrors[selectedActivity.client_id]"
          @patch="onEditorPatch"
          @close="selectedId = null"
        />
      </div>
      <div
        v-else-if="selectedRow"
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
