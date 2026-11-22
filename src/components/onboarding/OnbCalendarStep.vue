<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import { useCalendarImport, type CalendarSubscription, type GoogleCalendarItem } from '@/composables/useCalendarImport'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { useGoogleStore } from '@/stores/google'
import { isGoogleScopeMissing } from '@/composables/useGoogleIntegration'
import GoogleConnectCta from '@/components/settings/GoogleConnectCta.vue'
import GoogleConnectNotice from '@/components/settings/GoogleConnectNotice.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import ImportDropZone from '@/components/import/ImportDropZone.vue'
import ImportProgress from '@/components/import/ImportProgress.vue'
import type { ImportJob } from '@/composables/useImportJobs'
import { errorKey } from '@/utils/importReview'

const props = defineProps<{ tourId: number | null }>()
/** `reviewImport`: "Revisar ahora"; el asistente se cierra y navega a la revisión del job. */
const emit = defineEmits<{ next: []; skip: []; reviewImport: [jobUuid: string] }>()

const { t, locale } = useI18n()
const calImport = useCalendarImport()
const authStore = useAuthStore()
const toursStore = useToursStore()
const googleStore = useGoogleStore()

/** Gira del asistente (id sintético de esta sesión → uuid). El retorno del OAuth guarda el uuid. */
const tour = computed(() =>
  props.tourId !== null ? (toursStore.tours.find((tr) => tr.id === props.tourId) ?? null) : null
)
const tourUuid = computed(() => tour.value?.uuid ?? null)

// ─── State machine ────────────────────────────────────────────────────────────

// 'disconnected': sin permiso de Google Calendar; se ofrece conectar o saltar (es opcional).
type Step = 'loading' | 'disconnected' | 'selecting' | 'connecting' | 'connected' | 'error'
const step = ref<Step>('loading')
const error = ref('')

// Google calendars available to select
const googleCals = ref<GoogleCalendarItem[]>([])
const selectedCalId = ref('')
const selectedCalName = ref('')

// Connected subscription
const subscription = ref<CalendarSubscription | null>(null)

// Already-connected calendars (to show if user has some)
const existingCals = ref<CalendarSubscription[]>([])

// ─── Load ─────────────────────────────────────────────────────────────────────

async function load() {
  step.value = 'loading'
  error.value = ''
  await googleStore.load()
  if (googleStore.knownMissing('calendar')) {
    step.value = 'disconnected'
    return
  }
  try {
    const [gcals, existing] = await Promise.all([
      calImport.listGoogleCalendars(),
      calImport.listCalendars(),
    ])
    googleCals.value = gcals
    existingCals.value = existing

    // Pre-select primary
    const primary = gcals.find((c) => c.primary)
    if (primary) {
      selectedCalId.value = primary.id
      selectedCalName.value = primary.summary
    }

    step.value = 'selecting'
  } catch (e) {
    if (isGoogleScopeMissing(e)) {
      googleStore.load(true)
      step.value = 'disconnected'
      return
    }
    error.value = e instanceof Error ? e.message : t('onboarding.calendar.loadError')
    step.value = 'error'
  }
}

function onSelectCal(id: string) {
  selectedCalId.value = id
  const cal = googleCals.value.find((c) => c.id === id)
  if (cal) selectedCalName.value = cal.summary
}

// ─── Connect ──────────────────────────────────────────────────────────────────

async function connectCalendar() {
  if (!selectedCalId.value) return
  step.value = 'connecting'
  error.value = ''
  try {
    const sub = await calImport.createCalendar(
      selectedCalId.value,
      selectedCalName.value || selectedCalId.value,
    )
    subscription.value = sub

    // Assign to the tour created in step 1
    if (tourUuid.value) await toursStore.assignCalendar(tourUuid.value, sub.id)

    step.value = 'connected'
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('onboarding.calendar.connectError')
    step.value = 'selecting'
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return t('onboarding.calendar.never')
  return DateTime.fromISO(iso)
    .setLocale(locale.value)
    .toLocaleString({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  if (!authStore.isDemoMode) load()
})

// ─── Archivo o foto (F2 A9) ───────────────────────────────────────────────────
// El paso "Agenda" ofrece Google Calendar o el importador (`entry_point=onboarding`,
// `expected=itinerary`). La revisión no se hace en el asistente: al estar listo se ofrece
// "Revisar ahora" (cierra el asistente y abre la revisión) o "Revisar después" (sigue; el job
// queda en el aviso de pendientes de Mi Gira).

type Source = 'google' | 'file'
const source = ref<Source>('google')

type FileStep = 'drop' | 'progress' | 'ready' | 'failed'
const fileStep = ref<FileStep>('drop')
const importJobUuid = ref<string | null>(null)
const importJob = ref<ImportJob | null>(null)
const importError = ref('')

/** Actividades encontradas: resumen del borrador, filas o recuento de la lista. */
const activitiesFound = computed(() => {
  const j = importJob.value
  if (!j) return 0
  return j.summary?.activities?.total ?? j.draft?.activities?.length ?? j.activities_found ?? 0
})

/** Personas del equipo encontradas (filas del borrador o recuento de la lista). */
const teamFound = computed(() => {
  const j = importJob.value
  if (!j) return 0
  return j.draft?.team?.length ?? j.people_found ?? 0
})

/** Sin agenda no se dice "Hemos encontrado 0 actividades": el equipo, si lo hay, o que no hay. */
const foundText = computed(() => {
  const n = activitiesFound.value
  if (n > 0) return t('onboarding.calendar.found', { n }, n)
  const people = teamFound.value
  if (people > 0) return t('onboarding.calendar.foundTeamOnly', { n: people }, people)
  return t('onboarding.calendar.foundNone')
})
const foundHint = computed(() => {
  if (activitiesFound.value > 0) return t('onboarding.calendar.reviewHint')
  return teamFound.value > 0 ? t('onboarding.calendar.reviewHintTeam') : ''
})

function onImportCreated(job: ImportJob) {
  importJobUuid.value = job.uuid
  importJob.value = null
  fileStep.value = 'progress'
}

function onImportReady(job: ImportJob) {
  importJob.value = job
  fileStep.value = 'ready'
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

function resetFileImport() {
  importJobUuid.value = null
  importJob.value = null
  importError.value = ''
  fileStep.value = 'drop'
}

function reviewNow() {
  if (importJob.value) emit('reviewImport', importJob.value.uuid)
}
</script>

<template>
  <div>
    <!-- Demo mode notice -->
    <div
      v-if="authStore.isDemoMode"
      class="bg-glass border border-line rounded-xl px-4 py-5 text-center space-y-2"
    >
      <svg
        class="mx-auto text-ink-4"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect
          x="3"
          y="4"
          width="18"
          height="18"
          rx="2"
        /><line
          x1="3"
          y1="10"
          x2="21"
          y2="10"
        />
        <line
          x1="8"
          y1="2"
          x2="8"
          y2="6"
        /><line
          x1="16"
          y1="2"
          x2="16"
          y2="6"
        />
      </svg>
      <p class="text-[14px] font-semibold text-ink-2">
        {{ t('onboarding.calendar.demoTitle') }}
      </p>
      <p class="text-[13px] text-ink-3">
        {{ t('onboarding.calendar.demoBody') }}
      </p>
      <button
        class="w-full mt-2 text-[13px] text-ink-4 hover:text-ink-2 transition-colors bg-transparent border-none cursor-pointer py-1"
        @click="emit('skip')"
      >
        {{ t('onboarding.skip') }}
      </button>
    </div>

    <template v-else>
      <!-- Fuente: Google Calendar o archivo -->
      <div
        class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5"
        role="radiogroup"
        :aria-label="t('onboarding.steps.calendar')"
      >
        <button
          v-for="opt in [
            { key: 'google', label: 'Google Calendar', sub: t('onboarding.calendar.googleSourceSub') },
            { key: 'file', label: t('onboarding.calendar.fileSource'), sub: t('onboarding.calendar.fileSourceSub') },
          ]"
          :key="opt.key"
          type="button"
          role="radio"
          :aria-checked="source === opt.key"
          class="min-h-[44px] border rounded p-3 text-center cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
          :class="source === opt.key ? 'border-olive bg-glass-active' : 'border-line bg-bg-2 hover:bg-glass-hover'"
          :data-test="`calendar-source-${opt.key}`"
          @click="source = opt.key as Source"
        >
          <span class="block text-[14px] font-semibold text-ink">{{ opt.label }}</span>
          <span class="block text-[13px] text-ink-2 mt-0.5">{{ opt.sub }}</span>
        </button>
      </div>

      <!-- ── Archivo o foto ──────────────────────────────────────────────────── -->
      <div
        v-if="source === 'file'"
        data-test="calendar-file"
      >
        <p
          v-if="!tourUuid"
          class="text-[14px] text-ink-2 rounded-sm bg-bg-2 border border-line px-3.5 py-3"
        >
          {{ t('onboarding.calendar.noTour') }}
        </p>
        <template v-else>
          <ImportDropZone
            v-if="fileStep === 'drop'"
            :tour-uuid="tourUuid"
            entry-point="onboarding"
            expected="itinerary"
            compact
            @created="onImportCreated"
          />
          <ImportProgress
            v-else-if="fileStep === 'progress'"
            :job-uuid="importJobUuid"
            expected="itinerary"
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
              data-test="calendar-import-failed"
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
            v-else
            class="flex flex-col gap-3"
            data-test="calendar-import-ready"
          >
            <p
              class="text-[15px] font-semibold text-ink"
              data-test="calendar-import-found"
            >
              {{ foundText }}
            </p>
            <p
              v-if="foundHint"
              class="text-[14px] text-ink-2"
            >
              {{ foundHint }}
            </p>
            <div class="flex flex-col sm:flex-row gap-2">
              <BtnPrimary
                type="button"
                class="justify-center"
                data-test="calendar-review-now"
                @click="reviewNow"
              >
                {{ t('onboarding.calendar.reviewNow') }}
              </BtnPrimary>
              <BtnSecondary
                type="button"
                class="justify-center"
                data-test="calendar-review-later"
                @click="emit('next')"
              >
                {{ t('onboarding.calendar.reviewLater') }}
              </BtnSecondary>
            </div>
          </div>
        </template>
        <button
          v-if="fileStep === 'drop' || fileStep === 'failed'"
          type="button"
          class="w-full mt-3 min-h-[44px] lg:min-h-0 text-[13px] text-ink-2 hover:text-ink transition-colors bg-transparent border-none cursor-pointer py-1"
          data-test="calendar-file-skip"
          @click="emit('skip')"
        >
          {{ t('onboarding.skip') }}
        </button>
      </div>

      <template v-else>
        <GoogleConnectNotice purpose="calendar" />

        <!-- LOADING -->
        <div
          v-if="step === 'loading'"
          class="text-center py-8"
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
          <p class="text-[14px] text-ink-3">
            {{ t('onboarding.calendar.loading') }}
          </p>
        </div>

        <!-- SIN CONECTAR (opcional: conectar o saltar) -->
        <div
          v-else-if="step === 'disconnected'"
          class="space-y-3"
          data-testid="onb-calendar-disconnected"
        >
          <GoogleConnectCta
            purpose="calendar"
            return-to="/home"
            :intro="t('onboarding.calendar.connectIntro')"
            :onboarding="{ step: 'calendar', tourUuid }"
          />
          <BtnSecondary
            full
            data-testid="onb-calendar-skip"
            @click="emit('skip')"
          >
            {{ t('onboarding.skip') }}
          </BtnSecondary>
        </div>

        <!-- ERROR -->
        <div
          v-else-if="step === 'error'"
          class="text-center py-6 space-y-3"
        >
          <p class="text-[14px] text-failed-fg">
            {{ error }}
          </p>
          <BtnSecondary @click="load">
            {{ t('onboarding.retry') }}
          </BtnSecondary>
          <button
            class="block w-full text-[13px] text-ink-4 hover:text-ink-2 transition-colors bg-transparent border-none cursor-pointer py-1"
            @click="emit('skip')"
          >
            {{ t('onboarding.skip') }}
          </button>
        </div>

        <!-- SELECTING -->
        <div
          v-else-if="step === 'selecting'"
          class="space-y-4"
        >
          <!-- Already connected calendars (optional info) -->
          <div
            v-if="existingCals.length > 0"
            class="bg-acid-dim border border-line-acid rounded-xl px-3.5 py-2.5"
          >
            <p class="text-[12px] font-semibold text-olive mb-1.5">
              {{ t('onboarding.calendar.existingTitle') }}
            </p>
            <div class="space-y-1">
              <div
                v-for="cal in existingCals"
                :key="cal.id"
                class="flex items-center gap-2"
              >
                <div class="w-1.5 h-1.5 rounded-full bg-acid flex-shrink-0" />
                <p class="text-[13px] text-ink-2 truncate">
                  {{ cal.calendar_name }}
                </p>
                <span
                  class="text-[12px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0"
                  :class="cal.webhook_status === 'active'
                    ? 'bg-wa-bg text-wa-fg border-wa-bg'
                    : 'bg-glass border-line text-ink-4'"
                >
                  {{
                    cal.webhook_status === 'active'
                      ? t('onboarding.calendar.active')
                      : t('onboarding.calendar.inactive')
                  }}
                </span>
              </div>
            </div>
            <p class="text-[12px] text-ink-4 mt-2">
              {{ t('onboarding.calendar.existingHint') }}
            </p>
          </div>

          <!-- Google calendar picker -->
          <div>
            <label class="text-[11px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-2">
              {{ t('onboarding.calendar.pickLabel') }}
            </label>

            <div
              v-if="googleCals.length === 0"
              class="text-center py-4"
            >
              <p class="text-[13px] text-ink-3">
                {{ t('onboarding.calendar.noCalendars') }}
              </p>
            </div>

            <div
              v-else
              class="space-y-1.5"
            >
              <button
                v-for="cal in googleCals"
                :key="cal.id"
                type="button"
                class="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 border cursor-pointer transition-all duration-150 text-left"
                :class="selectedCalId === cal.id
                  ? 'bg-glass-active border-line-acid'
                  : 'bg-glass border-line hover:bg-glass-2'"
                @click="onSelectCal(cal.id)"
              >
                <!-- Google logo -->
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  class="flex-shrink-0"
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

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <p class="text-[14px] font-medium text-ink truncate">
                      {{ cal.summary }}
                    </p>
                    <span
                      v-if="cal.primary"
                      class="flex-shrink-0 text-[12px] font-semibold px-1.5 py-0.5 rounded-full bg-scheduled-bg text-scheduled-fg border border-[rgba(26,143,255,0.2)]"
                    >
                      {{ t('onboarding.calendar.primary') }}
                    </span>
                  </div>
                  <p class="text-[12px] text-ink-4 font-mono truncate mt-0.5">
                    {{ cal.id }}
                  </p>
                </div>

                <!-- Radio -->
                <div
                  class="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                  :class="selectedCalId === cal.id ? 'border-acid bg-acid' : 'border-line-2 bg-transparent'"
                >
                  <div
                    v-if="selectedCalId === cal.id"
                    class="w-1 h-1 rounded-full bg-black"
                  />
                </div>
              </button>
            </div>
          </div>

          <!-- Name override -->
          <div v-if="selectedCalId">
            <label class="text-[11px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-1.5">
              {{ t('onboarding.calendar.nameLabel') }}
            </label>
            <input
              v-model="selectedCalName"
              class="w-full bg-glass border border-line rounded-lg px-3 py-2 text-[14px] text-ink placeholder-ink-4 outline-none focus:border-line-acid transition-colors"
              :placeholder="t('onboarding.calendar.namePlaceholder')"
            >
          </div>

          <p
            v-if="error"
            class="text-[13px] text-failed-fg"
          >
            {{ error }}
          </p>

          <div class="flex flex-col gap-2 pt-1">
            <BtnPrimary
              full
              :disabled="!selectedCalId"
              @click="connectCalendar"
            >
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                class="flex-shrink-0"
              >
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
              </svg>
              {{ t('onboarding.calendar.connect') }}
            </BtnPrimary>
            <button
              v-if="existingCals.length > 0"
              class="text-[13px] text-ink-3 hover:text-ink transition-colors bg-transparent border-none cursor-pointer py-1"
              @click="emit('next')"
            >
              {{ t('onboarding.calendar.useExisting') }}
            </button>
            <button
              class="text-[13px] text-ink-4 hover:text-ink-2 transition-colors bg-transparent border-none cursor-pointer py-1"
              @click="emit('skip')"
            >
              {{ t('onboarding.skip') }}
            </button>
          </div>
        </div>

        <!-- CONNECTING -->
        <div
          v-else-if="step === 'connecting'"
          class="text-center py-8"
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
          <p class="text-[15px] font-semibold text-ink mb-1">
            {{ t('onboarding.calendar.connecting') }}
          </p>
          <p class="text-[13px] text-ink-3">
            {{ t('onboarding.calendar.connectingHint') }}
          </p>
        </div>

        <!-- CONNECTED -->
        <div
          v-else-if="step === 'connected' && subscription"
          class="space-y-4"
        >
          <!-- Success card -->
          <div class="bg-glass border border-line rounded-xl px-4 py-4 flex items-start gap-3">
            <div class="w-9 h-9 rounded-xl bg-wa-bg flex items-center justify-center flex-shrink-0">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--wa-fg)"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[15px] font-semibold text-ink leading-tight">
                {{ subscription.calendar_name }}
              </p>
              <p class="text-[12px] text-ink-4 font-mono mt-0.5 truncate">
                {{ subscription.calendar_id }}
              </p>
              <div class="flex items-center gap-2 mt-1.5">
                <span class="text-[12px] font-semibold px-1.5 py-0.5 rounded-full bg-wa-bg text-wa-fg border border-wa-bg">
                  {{ t('onboarding.calendar.connected') }}
                </span>
                <span class="text-[12px] text-ink-4">
                  {{ t('onboarding.calendar.lastSync', { date: formatDate(subscription.last_synced_at) }) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Tour assignment confirmation -->
          <div
            v-if="tourId !== null"
            class="flex items-center gap-2 bg-acid-dim border border-line-acid rounded-xl px-3.5 py-2.5"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--acid-muted)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <p class="text-[13px] text-ink-2">
              {{ t('onboarding.calendar.assignedTo') }}
              <span class="font-semibold text-ink">
                {{
                  tour?.name ?? t('onboarding.calendar.yourTour')
                }}
              </span>
            </p>
          </div>

          <BtnPrimary
            full
            @click="emit('next')"
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
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {{ t('onboarding.continue') }}
          </BtnPrimary>
        </div>
      </template>
    </template>
  </div>
</template>
