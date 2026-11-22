<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { DateTime } from 'luxon'
import { useContactsStore } from '@/stores/contacts'
import { useAuthStore } from '@/stores/auth'
import {
  useGoogleContactsImport,
  type ImportContact,
  type ImportRole,
  type ContactSubscription,
  type SyncStats,
} from '@/composables/useGoogleContactsImport'
import { useGoogleStore } from '@/stores/google'
import { useToursStore } from '@/stores/tours'
import { useContacts } from '@/composables/useContacts'
import { isGoogleScopeMissing } from '@/composables/useGoogleIntegration'
import GoogleConnectCta from '@/components/settings/GoogleConnectCta.vue'
import GoogleConnectNotice from '@/components/settings/GoogleConnectNotice.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import ImportDropZone from '@/components/import/ImportDropZone.vue'
import ImportProgress from '@/components/import/ImportProgress.vue'
import ImportTeamTable from '@/components/import/ImportTeamTable.vue'
import {
  confirmImportJob,
  getImportJob,
  patchImportDraft,
  type ImportJob,
  type ImportRowPatch,
} from '@/composables/useImportJobs'
import { canConfirm, errorKey, importErrorKey } from '@/utils/importReview'
import { hasApiErrorCode } from '@/utils/notificationErrors'
import { useReminderCatalogStore } from '@/stores/reminderCatalog'

const props = defineProps<{ tourId?: number | null }>()
const emit = defineEmits<{ next: []; skip: [] }>()

const { t, locale } = useI18n()
const contactsStore = useContactsStore()
const authStore = useAuthStore()
const api = useGoogleContactsImport()
const googleStore = useGoogleStore()
const toursStore = useToursStore()
const contactsApi = useContacts()
const route = useRoute()

/** Uuid de la gira del asistente (el paso recibe el id sintético del store). */
const tourUuid = computed(
  () => toursStore.tours.find((tr) => tr.id === props.tourId)?.uuid ?? null
)

// Al volver del OAuth se reabre por uuid (el id sintético cambia con la recarga).
const onboardingResume = computed(() => ({ step: 'crew' as const, tourUuid: tourUuid.value }))

/** Máximo de peticiones simultáneas al vincular contactos importados. */
const LINK_CONCURRENCY = 4

/** Vincula el contacto a la gira (y al Equipo). Sin gira no hace nada: `true` = vinculado. */
async function linkToTour(uuid: string, roleUuid?: string): Promise<boolean> {
  const tour = tourUuid.value
  if (!tour) {
    console.warn('[OnbCrewStep] sin gira: el contacto no se vincula', uuid)
    return false
  }
  await contactsApi.addToTour(uuid, tour, { roleUuid: roleUuid || undefined })
  return true
}

// Sin permiso de Contactos se ofrece conectar (opcional: la pestaña manual sigue disponible).
const scopeMissing = ref(false)
const needsConnect = computed(
  () => !authStore.isDemoMode && (scopeMissing.value || googleStore.knownMissing('contacts'))
)

// ─── Source tab ───────────────────────────────────────────────────────────────

const source = ref<'google' | 'manual' | 'file'>('google')

// ─── Shared roles ─────────────────────────────────────────────────────────────

const roles = ref<ImportRole[]>([])

async function loadRoles() {
  if (roles.value.length === 0) roles.value = await api.fetchRoles()
}

// ─── Google state machine ─────────────────────────────────────────────────────

type GoogleStep = 'idle' | 'loading' | 'syncing' | 'selecting' | 'importing' | 'done'
const gStep = ref<GoogleStep>('idle')
const subscription = ref<ContactSubscription | null>(null)
const syncStats = ref<SyncStats | null>(null)
const contacts = ref<ImportContact[]>([])
const gError = ref('')
const searchFilter = ref('')
const contactState = ref<Record<string, { selected: boolean; roleUuid: string }>>({})

const filteredContacts = computed(() => {
  const q = searchFilter.value.toLowerCase().trim()
  if (!q) return contacts.value
  return contacts.value.filter(
    (c) =>
      c.full_name.toLowerCase().includes(q) ||
      c.primary_email.toLowerCase().includes(q) ||
      (c.company_name ?? '').toLowerCase().includes(q) ||
      (c.job_title ?? '').toLowerCase().includes(q),
  )
})

const selectedUuids = computed(() =>
  Object.entries(contactState.value)
    .filter(([, s]) => s.selected)
    .map(([uuid]) => uuid),
)

const selectableContacts = computed(() => filteredContacts.value.filter((c) => !c.is_confirmed))

const allFilteredSelected = computed(
  () =>
    selectableContacts.value.length > 0 &&
    selectableContacts.value.every((c) => contactState.value[c.uuid]?.selected),
)

function toggleAll() {
  const val = !allFilteredSelected.value
  selectableContacts.value.forEach((c) => {
    if (contactState.value[c.uuid]) contactState.value[c.uuid].selected = val
  })
}

function initContactState(list: ImportContact[]) {
  const state: Record<string, { selected: boolean; roleUuid: string }> = {}
  list.forEach((c) => {
    state[c.uuid] = { selected: false, roleUuid: c.role?.uuid ?? '' }
  })
  contactState.value = state
}

async function startSync() {
  gError.value = ''
  gStep.value = 'loading'
  try {
    const sub = await api.getOrCreateSubscription()
    subscription.value = sub
    await loadRoles()
    gStep.value = 'syncing'
    const stats = await api.syncNow(sub.id)
    syncStats.value = stats
    const list = await api.fetchGoogleContacts()
    contacts.value = list
    initContactState(list)
    gStep.value = 'selecting'
  } catch (e) {
    if (isGoogleScopeMissing(e)) {
      scopeMissing.value = true
      googleStore.load(true)
    } else {
      gError.value = e instanceof Error ? e.message : t('onboarding.crew.unknownError')
    }
    gStep.value = 'idle'
  }
}

onMounted(async () => {
  if (authStore.isDemoMode) return
  await googleStore.load()
  // Vuelta de "Conectar Google Contactos" desde este paso: sincroniza sola.
  if (
    route.query.google_connect === 'ok' &&
    route.query.purpose === 'contacts' &&
    !needsConnect.value &&
    gStep.value === 'idle'
  ) {
    startSync()
  }
})

/** Contactos que no se han podido añadir a la gira en la última importación o alta. */
const linkFailed = ref(0)
/** Contactos importados de verdad (los fallidos no cuentan). */
const importedOk = computed(() => Math.max(0, selectedUuids.value.length - linkFailed.value))

/**
 * Confirma (PATCH, con su rol) y después vincula a la gira cada contacto elegido: `add-to-tour`
 * no ve contactos sin confirmar. Por lotes de `LINK_CONCURRENCY`; un fallo no para al resto.
 */
async function importOne(uuid: string): Promise<void> {
  const roleUuid = contactState.value[uuid]?.roleUuid || null
  await api.patchContactRole(uuid, roleUuid)
  await linkToTour(uuid, roleUuid ?? undefined)
}

async function doImport() {
  if (selectedUuids.value.length === 0) return
  gStep.value = 'importing'
  gError.value = ''
  linkFailed.value = 0
  const uuids = [...selectedUuids.value]
  let failed = 0
  for (let i = 0; i < uuids.length; i += LINK_CONCURRENCY) {
    const batch = uuids.slice(i, i + LINK_CONCURRENCY)
    const results = await Promise.allSettled(batch.map((uuid) => importOne(uuid)))
    results.forEach((r, j) => {
      if (r.status === 'rejected') {
        failed++
        console.error('[OnbCrewStep] importar contacto', batch[j], r.reason)
      }
    })
  }
  linkFailed.value = failed
  await contactsStore.fetchContacts()
  gStep.value = 'done'
}

function formatDate(iso: string | null) {
  if (!iso) return t('onboarding.crew.never')
  return DateTime.fromISO(iso)
    .setLocale(locale.value)
    .toLocaleString({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── Manual state machine ─────────────────────────────────────────────────────

type ManualStep = 'form' | 'saving' | 'done'
const manualStep = ref<ManualStep>('form')
const manualError = ref('')
const createdContact = ref<ImportContact | null>(null)

const form = reactive({
  contact_type: 'person' as 'person' | 'company',
  first_name: '',
  last_name: '',
  company_name: '',
  job_title: '',
  role: '',
  primary_email: '',
  primary_phone: '',
  city: '',
  country: '',
  website: '',
  notes: '',
  is_favorite: false,
  is_emergency: false,
})

function resetManualForm() {
  Object.assign(form, {
    contact_type: 'person',
    first_name: '',
    last_name: '',
    company_name: '',
    job_title: '',
    role: '',
    primary_email: '',
    primary_phone: '',
    city: '',
    country: '',
    website: '',
    notes: '',
    is_favorite: false,
    is_emergency: false,
  })
  manualStep.value = 'form'
  manualError.value = ''
  createdContact.value = null
  linkFailed.value = 0
}

const manualValid = computed(() => {
  if (form.contact_type === 'person') return !!(form.first_name.trim() || form.last_name.trim())
  return !!form.company_name.trim()
})

async function submitManual() {
  if (!manualValid.value) return
  manualStep.value = 'saving'
  manualError.value = ''
  try {
    await loadRoles()
    const payload: Record<string, unknown> = {
      contact_type: form.contact_type,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      company_name: form.company_name.trim(),
      job_title: form.job_title.trim(),
      primary_email: form.primary_email.trim(),
      primary_phone: form.primary_phone.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      website: form.website.trim(),
      notes: form.notes.trim(),
      is_favorite: form.is_favorite,
      is_emergency: form.is_emergency,
    }
    if (form.role) payload.role = form.role
    const created = await api.createContact(payload)
    createdContact.value = created
    // Si falla el vínculo, el contacto ya existe: se avisa sin volver al formulario.
    linkFailed.value = 0
    try {
      await linkToTour(created.uuid, form.role || undefined)
    } catch (e) {
      console.error('[OnbCrewStep] add-to-tour', created.uuid, e)
      linkFailed.value = 1
    }
    await contactsStore.fetchContacts()
    manualStep.value = 'done'
  } catch (e) {
    manualError.value = e instanceof Error ? e.message : t('onboarding.crew.createError')
    manualStep.value = 'form'
  }
}

watch(source, (val) => {
  if (val === 'manual' && !authStore.isDemoMode) loadRoles()
})

// ─── Hoja o foto (importador F1) ──────────────────────────────────────────────
// Subir → progreso → revisión compacta en el propio paso → "Añadir al equipo" (confirm).

type FileStep = 'drop' | 'progress' | 'review' | 'confirming' | 'done' | 'failed'
const fileStep = ref<FileStep>('drop')
const importJobUuid = ref<string | null>(null)
const importJob = ref<ImportJob | null>(null)
const importError = ref('')
const savingRows = ref(new Set<string>())
const rowErrors = ref<Record<string, string>>({})
const reminderCatalog = useReminderCatalogStore()

const importCanConfirm = computed(() => canConfirm(importJob.value))
const importAllSkipped = computed(
  () =>
    !!importJob.value &&
    (importJob.value.draft?.team ?? []).every((r) => r.action === 'skip')
)
const importAdded = computed(() => {
  const r = importJob.value?.result
  return r && 'added_to_group' in r ? r.added_to_group : 0
})

function resetFileImport() {
  fileStep.value = 'drop'
  importJobUuid.value = null
  importJob.value = null
  importError.value = ''
  savingRows.value = new Set()
  rowErrors.value = {}
}

function onImportCreated(job: ImportJob) {
  importError.value = ''
  importJobUuid.value = job.uuid
  fileStep.value = 'progress'
}

function onImportReady(job: ImportJob) {
  importJob.value = job
  fileStep.value = job.status === 'done' ? 'done' : 'review'
}

function onImportFailed(job: ImportJob) {
  importJob.value = job
  importError.value = t(
    job.status === 'discarded' && job.error_code !== 'expired'
      ? 'importer.errors.generic'
      : errorKey(job.error_code)
  )
  fileStep.value = 'failed'
}

// PATCH uno a uno (cola secuencial): cada respuesta sustituye al job entero.
let patchQueue: Promise<void> = Promise.resolve()

function patchRow(patch: ImportRowPatch) {
  const uuid = importJobUuid.value
  if (!uuid) return
  const id = patch.client_id
  savingRows.value.add(id)
  patchQueue = patchQueue.then(async () => {
    try {
      const job = await patchImportDraft(uuid, { rows: [patch] })
      if (importJobUuid.value !== uuid) return
      importJob.value = job
      if (id in rowErrors.value) {
        const rest = { ...rowErrors.value }
        delete rest[id]
        rowErrors.value = rest
      }
    } catch {
      if (importJobUuid.value === uuid) {
        rowErrors.value = { ...rowErrors.value, [id]: t('importer.errors.saveRow') }
      }
    } finally {
      savingRows.value.delete(id)
    }
  })
}

async function confirmFileImport() {
  const uuid = importJobUuid.value
  if (!uuid || !importCanConfirm.value) return
  await patchQueue
  fileStep.value = 'confirming'
  importError.value = ''
  try {
    importJob.value = await confirmImportJob(uuid)
    fileStep.value = 'done'
    await contactsStore.fetchContacts()
    if (tourUuid.value) void reminderCatalog.invalidate(tourUuid.value)
  } catch (e) {
    importError.value = t(importErrorKey(e))
    fileStep.value = 'review'
    if (hasApiErrorCode(e, 'unresolved_rows') || hasApiErrorCode(e, 'already_confirmed')) {
      try {
        const job = await getImportJob(uuid)
        importJob.value = job
        if (job.status === 'done') fileStep.value = 'done'
      } catch {
        // Se queda el error visible.
      }
    }
  }
}
</script>

<template>
  <div>
    <!-- Source toggle -->
    <div class="grid grid-cols-3 gap-2 mb-5">
      <div
        v-for="opt in [
          { key: 'google', label: 'Google Contacts', sub: t('onboarding.crew.googleSub') },
          { key: 'manual', label: t('onboarding.crew.manual'), sub: t('onboarding.crew.manualSub') },
          { key: 'file', label: t('onboarding.crew.fileSource'), sub: t('onboarding.crew.fileSourceSub') },
        ]"
        :key="opt.key"
        class="bg-glass border rounded-xl p-3 text-center cursor-pointer transition-all duration-200"
        :class="source === opt.key ? 'border-line-acid bg-glass-active' : 'border-line hover:bg-glass-2'"
        :data-test="`crew-source-${opt.key}`"
        @click="source = opt.key as 'google' | 'manual' | 'file'"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          :stroke="source === opt.key ? 'var(--acid-muted)' : 'var(--ink-3)'"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="mx-auto mb-1.5"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle
            cx="9"
            cy="7"
            r="4"
          />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <p class="text-[13px] font-semibold text-ink">
          {{ opt.label }}
        </p>
        <p class="text-[12px] text-ink-3 mt-0.5">
          {{ opt.sub }}
        </p>
      </div>
    </div>

    <!-- ── Google tab ──────────────────────────────────────────────────────────── -->
    <template v-if="source === 'google'">
      <div
        v-if="authStore.isDemoMode"
        class="bg-glass border border-line rounded-lg px-3.5 py-4 text-center mb-4"
      >
        <p class="text-[14px] font-semibold text-ink-2 mb-0.5">
          {{ t('onboarding.calendar.demoTitle') }}
        </p>
        <p class="text-[13px] text-ink-3">
          {{ t('onboarding.crew.demoBody') }}
        </p>
      </div>

      <template v-else>
        <GoogleConnectNotice purpose="contacts" />

        <!-- IDLE sin permiso de Google Contactos -->
        <GoogleConnectCta
          v-if="gStep === 'idle' && needsConnect"
          purpose="contacts"
          return-to="/home"
          :intro="t('onboarding.crew.connectIntro')"
          :onboarding="onboardingResume"
        />

        <!-- IDLE -->
        <div
          v-else-if="gStep === 'idle'"
          class="text-center"
        >
          <div class="bg-glass border border-line rounded-xl p-5 mb-4">
            <div class="w-10 h-10 rounded-xl bg-scheduled-bg flex items-center justify-center mx-auto mb-3">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>
            <p class="text-[15px] font-semibold text-ink mb-1">
              Google Contacts
            </p>
            <p
              v-if="subscription"
              class="text-[13px] text-ink-3"
            >
              {{ t('onboarding.crew.lastSync', { date: formatDate(subscription.last_synced_at) }) }}
            </p>
            <p
              v-else
              class="text-[13px] text-ink-3"
            >
              {{ t('onboarding.crew.googleIntro') }}
            </p>
          </div>
          <p
            v-if="gError"
            class="text-[13px] text-failed-fg mb-3"
          >
            {{ gError }}
          </p>
          <BtnPrimary
            full
            data-testid="crew-sync"
            @click="startSync"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            {{ subscription ? t('onboarding.crew.resync') : t('onboarding.crew.sync') }}
          </BtnPrimary>
        </div>

        <!-- LOADING / SYNCING -->
        <div
          v-else-if="gStep === 'loading' || gStep === 'syncing'"
          class="text-center py-6"
        >
          <svg
            class="animate-spin text-olive mx-auto mb-3"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="3"
              stroke-dasharray="40 22"
              stroke-linecap="round"
            />
          </svg>
          <p class="text-[15px] font-semibold text-ink mb-1">
            {{ gStep === 'loading' ? t('onboarding.crew.connecting') : t('onboarding.crew.syncing') }}
          </p>
          <p class="text-[13px] text-ink-3">
            {{ t('onboarding.calendar.connectingHint') }}
          </p>
        </div>

        <!-- SELECTING -->
        <div v-else-if="gStep === 'selecting'">
          <div
            v-if="syncStats"
            class="flex items-center gap-3 mb-3 flex-wrap"
          >
            <span class="text-[12px] text-ink-3"><strong class="text-olive">+{{ syncStats.created }}</strong> {{ t('onboarding.crew.statNew') }}</span>
            <span class="text-[12px] text-ink-3"><strong class="text-ink">{{ syncStats.updated }}</strong> {{ t('onboarding.crew.statUpdated') }}</span>
            <span class="text-[12px] text-ink-3"><strong class="text-ink">{{ contacts.length }}</strong> {{ t('onboarding.crew.statTotal') }}</span>
          </div>
          <div class="flex items-center gap-[7px] bg-glass border border-line rounded px-2.5 py-2 mb-2.5">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-ink-4 flex-shrink-0"
            >
              <circle
                cx="11"
                cy="11"
                r="8"
              /><line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
              />
            </svg>
            <input
              v-model="searchFilter"
              :placeholder="t('onboarding.crew.filterPlaceholder')"
              class="flex-1 bg-transparent border-none outline-none text-ink text-[14px] placeholder:text-ink-4"
            >
            <button
              v-if="searchFilter"
              class="text-ink-4 hover:text-ink border-none bg-transparent cursor-pointer"
              @click="searchFilter = ''"
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
              ><line
                x1="18"
                y1="6"
                x2="6"
                y2="18"
              /><line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
              /></svg>
            </button>
          </div>
          <div class="flex items-center gap-2 px-1 mb-1.5">
            <button
              class="w-4 h-4 rounded border-[1.5px] flex items-center justify-center flex-shrink-0 cursor-pointer p-0"
              :class="allFilteredSelected ? 'bg-acid border-acid' : 'border-line-2 bg-glass'"
              data-testid="crew-select-all"
              @click="toggleAll"
            >
              <svg
                v-if="allFilteredSelected"
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000"
                stroke-width="3.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><polyline points="20 6 9 17 4 12" /></svg>
            </button>
            <span class="text-[12px] text-ink-3">
              {{ allFilteredSelected ? t('onboarding.crew.deselectAll') : t('onboarding.crew.selectAll') }}
              ({{ selectableContacts.length }})
            </span>
            <span class="ml-auto text-[12px] text-olive font-semibold">{{ t('onboarding.crew.selectedCount', { count: selectedUuids.length }) }}</span>
          </div>
          <div class="max-h-48 overflow-y-auto mb-4 border border-line rounded-lg overflow-hidden">
            <div
              v-if="filteredContacts.length === 0"
              class="py-6 text-center text-[14px] text-ink-3"
            >
              {{ t('onboarding.crew.noMatches') }}
            </div>
            <div
              v-for="c in filteredContacts"
              :key="c.uuid"
              class="flex items-center gap-2 px-2.5 py-2 transition-colors border-b border-line last:border-b-0"
              :class="c.is_confirmed ? 'cursor-default' : contactState[c.uuid]?.selected ? 'bg-glass-active' : 'hover:bg-glass cursor-pointer'"
              @click="!c.is_confirmed && contactState[c.uuid] && (contactState[c.uuid].selected = !contactState[c.uuid].selected)"
            >
              <div
                class="w-4 h-4 rounded border-[1.5px] flex items-center justify-center flex-shrink-0"
                :class="c.is_confirmed ? 'bg-wa-bg border-wa-fg' : contactState[c.uuid]?.selected ? 'bg-acid border-acid' : 'border-line-2 bg-glass'"
              >
                <svg
                  v-if="c.is_confirmed"
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--wa-fg)"
                  stroke-width="3.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ><polyline points="20 6 9 17 4 12" /></svg>
                <svg
                  v-else-if="contactState[c.uuid]?.selected"
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#000"
                  stroke-width="3.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div
                class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-bold text-ink-2 border border-line"
                :style="{ background: c.role?.color ?? 'var(--bg4)' }"
              >
                {{ c.first_name.charAt(0) }}{{ c.last_name.charAt(0) }}
              </div>
              <div class="flex-1 min-w-0">
                <p
                  class="text-[14px] font-medium truncate leading-snug"
                  :class="c.is_confirmed ? 'text-ink-2' : 'text-ink'"
                >
                  {{ c.full_name }}
                </p>
                <p class="text-[12px] text-ink-3 truncate">
                  {{ c.primary_email || c.job_title || '—' }}
                </p>
              </div>
              <div
                class="flex-shrink-0"
                @click.stop
              >
                <StatusBadge
                  v-if="c.is_confirmed"
                  status="off"
                  :label="t('onboarding.crew.alreadyImported')"
                  size="sm"
                  data-test="already-imported"
                />
                <div
                  v-else-if="contactState[c.uuid]"
                  class="relative flex items-center gap-1"
                >
                  <div
                    v-if="contactState[c.uuid].roleUuid"
                    class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    :style="{ background: roles.find((r) => r.uuid === contactState[c.uuid].roleUuid)?.color ?? '#888' }"
                  />
                  <select
                    v-model="contactState[c.uuid].roleUuid"
                    class="bg-glass border border-line rounded px-1.5 py-1 text-ink-3 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors appearance-none cursor-pointer max-w-[90px]"
                  >
                    <option value="">
                      {{ t('onboarding.crew.noRole') }}
                    </option>
                    <option
                      v-for="r in roles"
                      :key="r.uuid"
                      :value="r.uuid"
                    >
                      {{ r.name }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <BtnPrimary
              full
              :disabled="selectedUuids.length === 0"
              data-testid="crew-import"
              @click="doImport"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><polyline points="20 6 9 17 4 12" /></svg>
              {{
                selectedUuids.length > 0
                  ? t('onboarding.crew.importN', selectedUuids.length)
                  : t('onboarding.crew.importSelected')
              }}
            </BtnPrimary>
            <BtnSecondary @click="gStep = 'idle'">
              ↩
            </BtnSecondary>
          </div>
        </div>

        <!-- IMPORTING -->
        <div
          v-else-if="gStep === 'importing'"
          class="text-center py-6"
        >
          <svg
            class="animate-spin text-olive mx-auto mb-3"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="3"
              stroke-dasharray="40 22"
              stroke-linecap="round"
            />
          </svg>
          <p class="text-[15px] text-ink-2">
            {{ t('onboarding.crew.importing') }}
          </p>
        </div>

        <!-- DONE (google) -->
        <div
          v-else-if="gStep === 'done'"
          class="text-center py-3"
        >
          <div class="w-10 h-10 rounded-xl bg-acid flex items-center justify-center mx-auto mb-3">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#000"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <p class="text-[15px] font-bold text-ink mb-1">
            {{ t('onboarding.crew.importedTitle') }}
          </p>
          <p class="text-[13px] text-ink-3 mb-5">
            {{ t('onboarding.crew.importedCount', importedOk) }}
          </p>
          <p
            v-if="linkFailed > 0"
            role="alert"
            class="text-[13px] text-failed-fg -mt-3 mb-5"
            data-testid="crew-link-error"
          >
            {{ t('onboarding.crew.linkError', { n: linkFailed }, linkFailed) }}
          </p>
          <BtnPrimary
            full
            @click="emit('next')"
          >
            {{ t('onboarding.continue') }}
          </BtnPrimary>
        </div>
      </template>
    </template>

    <!-- ── Hoja o foto (importador F1) ───────────────────────────────────────────── -->
    <template v-else-if="source === 'file'">
      <div
        v-if="authStore.isDemoMode"
        class="bg-glass border border-line rounded-lg px-3.5 py-4 text-center mb-4"
      >
        <p class="text-[14px] font-semibold text-ink-2 mb-0.5">
          {{ t('onboarding.calendar.demoTitle') }}
        </p>
        <p class="text-[13px] text-ink-3">
          {{ t('onboarding.crew.importDemo') }}
        </p>
      </div>
      <p
        v-else-if="!tourUuid"
        class="text-[14px] text-ink-2 rounded-sm bg-bg-2 border border-line px-3.5 py-3"
      >
        {{ t('importer.contactsTab.noTour') }}
      </p>
      <template v-else>
        <ImportDropZone
          v-if="fileStep === 'drop'"
          :tour-uuid="tourUuid"
          entry-point="onboarding"
          compact
          @created="onImportCreated"
        />

        <ImportProgress
          v-else-if="fileStep === 'progress'"
          :job-uuid="importJobUuid"
          @ready="onImportReady"
          @failed="onImportFailed"
        />

        <div
          v-else-if="fileStep === 'failed'"
          class="flex flex-col items-start gap-3"
        >
          <p
            class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2 w-full"
            role="alert"
            data-test="crew-import-failed"
          >
            {{ importError }}
          </p>
          <BtnSecondary
            type="button"
            @click="resetFileImport"
          >
            {{ t('importer.retry') }}
          </BtnSecondary>
        </div>

        <div
          v-else-if="(fileStep === 'review' || fileStep === 'confirming') && importJob"
          class="flex flex-col gap-3"
          data-test="crew-import-review"
        >
          <p class="text-[13px] text-ink-2">
            {{ t('onboarding.crew.importReviewHint') }}
          </p>
          <ImportTeamTable
            compact
            :job="importJob"
            :saving="savingRows"
            :row-errors="rowErrors"
            @patch="patchRow"
          />
          <p
            v-if="importAllSkipped"
            class="text-[13px] text-ink-2"
          >
            {{ t('onboarding.crew.importEmpty') }}
          </p>
          <p
            v-if="importError"
            class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2"
            role="alert"
          >
            {{ importError }}
          </p>
          <div class="flex flex-col sm:flex-row gap-2">
            <BtnPrimary
              type="button"
              full
              data-test="crew-import-confirm"
              :disabled="!importCanConfirm || fileStep === 'confirming'"
              :class="importCanConfirm && fileStep !== 'confirming' ? 'opacity-100' : 'opacity-50 cursor-not-allowed'"
              @click="confirmFileImport"
            >
              {{ t('onboarding.crew.importConfirm') }}
            </BtnPrimary>
            <BtnSecondary
              type="button"
              :disabled="fileStep === 'confirming'"
              @click="resetFileImport"
            >
              {{ t('onboarding.crew.importAnother') }}
            </BtnSecondary>
          </div>
          <p
            v-if="!importCanConfirm && !importAllSkipped && (importJob.summary?.needs_action ?? 0) > 0"
            class="text-[13px] text-ink-2"
          >
            {{ t('importer.errors.unresolved_rows') }}
          </p>
        </div>

        <div
          v-else-if="fileStep === 'done'"
          class="text-center"
          data-test="crew-import-done"
        >
          <div class="bg-glass border border-line rounded-xl p-5 mb-4">
            <p class="text-[15px] font-semibold text-ink">
              {{ t('onboarding.crew.importDone', { n: importAdded }, importAdded) }}
            </p>
          </div>
          <BtnPrimary
            full
            type="button"
            data-test="crew-import-next"
            @click="emit('next')"
          >
            {{ t('onboarding.continue') }}
          </BtnPrimary>
        </div>
      </template>
    </template>

    <!-- ── Manual tab ──────────────────────────────────────────────────────────── -->
    <template v-else>
      <!-- SAVING -->
      <div
        v-if="manualStep === 'saving'"
        class="text-center py-6"
      >
        <svg
          class="animate-spin text-olive mx-auto mb-3"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="3"
            stroke-dasharray="40 22"
            stroke-linecap="round"
          />
        </svg>
        <p class="text-[15px] text-ink-2">
          {{ t('onboarding.crew.creating') }}
        </p>
      </div>

      <!-- DONE (manual) -->
      <div
        v-else-if="manualStep === 'done'"
        class="text-center py-3"
      >
        <div class="w-10 h-10 rounded-xl bg-acid flex items-center justify-center mx-auto mb-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <p class="text-[15px] font-bold text-ink mb-1">
          {{ t('onboarding.crew.createdTitle') }}
        </p>
        <p class="text-[13px] text-ink-3 mb-5">
          {{ t('onboarding.crew.createdBody', { name: createdContact?.full_name ?? '' }) }}
        </p>
        <p
          v-if="linkFailed > 0"
          role="alert"
          class="text-[13px] text-failed-fg -mt-3 mb-5"
          data-testid="crew-link-error"
        >
          {{ t('onboarding.crew.linkError', { n: linkFailed }, linkFailed) }}
        </p>
        <div class="flex gap-2">
          <BtnPrimary
            full
            @click="resetManualForm"
          >
            {{ t('onboarding.crew.addAnother') }}
          </BtnPrimary>
          <BtnSecondary
            full
            @click="emit('next')"
          >
            {{ t('onboarding.continue') }}
          </BtnSecondary>
        </div>
      </div>

      <!-- FORM -->
      <div
        v-else
        class="space-y-3"
      >
        <div class="flex gap-[3px] bg-glass border border-line rounded-[7px] p-0.5">
          <button
            v-for="ct in [
              { key: 'person', label: t('onboarding.crew.person') },
              { key: 'company', label: t('onboarding.crew.company') },
            ]"
            :key="ct.key"
            class="flex-1 py-[5px] rounded-[5px] border-none text-[13px] font-semibold cursor-pointer transition-all duration-150"
            :class="form.contact_type === ct.key ? 'bg-acid text-ink' : 'bg-transparent text-ink-3 hover:text-ink'"
            @click="form.contact_type = ct.key as 'person' | 'company'"
          >
            {{ ct.label }}
          </button>
        </div>

        <div
          v-if="form.contact_type === 'person'"
          class="grid grid-cols-2 gap-2"
        >
          <div>
            <label class="text-[12px] font-semibold text-ink-3 block mb-1">{{ t('onboarding.crew.firstName') }} *</label>
            <input
              v-model="form.first_name"
              :placeholder="t('onboarding.crew.firstNamePlaceholder')"
              class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
            >
          </div>
          <div>
            <label class="text-[12px] font-semibold text-ink-3 block mb-1">{{ t('onboarding.crew.lastName') }}</label>
            <input
              v-model="form.last_name"
              :placeholder="t('onboarding.crew.lastNamePlaceholder')"
              class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
            >
          </div>
        </div>
        <div v-else>
          <label class="text-[12px] font-semibold text-ink-3 block mb-1">{{ t('onboarding.crew.company') }} *</label>
          <input
            v-model="form.company_name"
            :placeholder="t('onboarding.crew.companyPlaceholder')"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
          >
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[12px] font-semibold text-ink-3 block mb-1">{{ t('onboarding.crew.role') }}</label>
            <div class="relative flex items-center">
              <div
                v-if="form.role"
                class="absolute left-2.5 w-2 h-2 rounded-full pointer-events-none"
                :style="{ background: roles.find((r) => r.uuid === form.role)?.color ?? '#888' }"
              />
              <select
                v-model="form.role"
                data-testid="crew-manual-role"
                class="w-full bg-glass border border-line rounded py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors appearance-none cursor-pointer"
                :class="form.role ? 'pl-7 pr-2.5' : 'px-2.5'"
              >
                <option value="">
                  {{ t('onboarding.crew.noRole') }}
                </option>
                <option
                  v-for="r in roles"
                  :key="r.uuid"
                  :value="r.uuid"
                >
                  {{ r.name }}
                </option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-[12px] font-semibold text-ink-3 block mb-1">{{ t('onboarding.crew.jobTitle') }}</label>
            <input
              v-model="form.job_title"
              :placeholder="t('onboarding.crew.jobTitlePlaceholder')"
              class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
            >
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[12px] font-semibold text-ink-3 block mb-1">{{ t('onboarding.crew.email') }}</label>
            <input
              v-model="form.primary_email"
              type="email"
              :placeholder="t('onboarding.crew.emailPlaceholder')"
              class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
            >
          </div>
          <div>
            <label class="text-[12px] font-semibold text-ink-3 block mb-1">{{ t('onboarding.crew.phone') }}</label>
            <input
              v-model="form.primary_phone"
              type="tel"
              :placeholder="t('onboarding.crew.phonePlaceholder')"
              class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
            >
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[12px] font-semibold text-ink-3 block mb-1">{{ t('onboarding.crew.city') }}</label>
            <input
              v-model="form.city"
              :placeholder="t('onboarding.crew.cityPlaceholder')"
              class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
            >
          </div>
          <div>
            <label class="text-[12px] font-semibold text-ink-3 block mb-1">{{ t('onboarding.crew.country') }}</label>
            <input
              v-model="form.country"
              :placeholder="t('onboarding.crew.countryPlaceholder')"
              class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
            >
          </div>
        </div>

        <div>
          <label class="text-[12px] font-semibold text-ink-3 block mb-1">{{ t('onboarding.crew.notes') }}</label>
          <textarea
            v-model="form.notes"
            rows="2"
            :placeholder="t('onboarding.crew.notesPlaceholder')"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4 resize-none"
          />
        </div>

        <div class="flex gap-2">
          <button
            class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded border transition-all cursor-pointer"
            :class="form.is_favorite ? 'border-olive bg-glass-active text-olive' : 'border-line bg-glass text-ink-3 hover:border-line-2 hover:text-ink'"
            @click="form.is_favorite = !form.is_favorite"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              :fill="form.is_favorite ? 'currentColor' : 'none'"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span class="text-[13px] font-medium">{{ t('onboarding.crew.favorite') }}</span>
          </button>
          <button
            class="flex-1 flex items-center gap-2 px-3 py-2.5 rounded border transition-all cursor-pointer"
            :class="form.is_emergency ? 'border-brand-orange bg-glass-active text-brand-orange' : 'border-line bg-glass text-ink-3 hover:border-line-2 hover:text-ink'"
            @click="form.is_emergency = !form.is_emergency"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
              <line
                x1="12"
                y1="8"
                x2="12"
                y2="12"
              /><line
                x1="12"
                y1="16"
                x2="12.01"
                y2="16"
              />
            </svg>
            <span class="text-[13px] font-medium">{{ t('onboarding.crew.emergency') }}</span>
          </button>
        </div>

        <p
          v-if="manualError"
          class="text-[13px] text-failed-fg"
        >
          {{ manualError }}
        </p>

        <div class="flex gap-2 pt-1">
          <BtnPrimary
            full
            :disabled="!manualValid"
            data-testid="crew-manual-create"
            @click="submitManual"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle
                cx="9"
                cy="7"
                r="4"
              />
              <line
                x1="23"
                y1="11"
                x2="17"
                y2="11"
              /><line
                x1="20"
                y1="8"
                x2="20"
                y2="14"
              />
            </svg>
            {{ t('onboarding.crew.create') }}
          </BtnPrimary>
        </div>
      </div>
    </template>

    <!-- Skip -->
    <button
      v-if="(source === 'google' && (gStep === 'idle' || gStep === 'selecting')) || (source === 'manual' && manualStep === 'form') || (source === 'file' && (fileStep === 'drop' || fileStep === 'failed'))"
      class="w-full mt-3 text-[13px] text-ink-4 hover:text-ink-2 transition-colors bg-transparent border-none cursor-pointer py-1"
      @click="emit('skip')"
    >
      {{ t('onboarding.skip') }}
    </button>
  </div>
</template>
