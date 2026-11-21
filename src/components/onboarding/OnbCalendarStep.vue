<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

const props = defineProps<{ tourId: number | null }>()
const emit = defineEmits<{ next: []; skip: [] }>()

const { t, locale } = useI18n()
const calImport = useCalendarImport()
const authStore = useAuthStore()
const toursStore = useToursStore()
const googleStore = useGoogleStore()

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
    const tourId = props.tourId
    if (tourId !== null) {
      const tour = toursStore.tours.find((tr) => tr.id === tourId)
      if (tour) await toursStore.assignCalendar(tour.uuid, sub.id)
    }

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
      <p class="text-[12px] font-semibold text-ink-2">
        {{ t('onboarding.calendar.demoTitle') }}
      </p>
      <p class="text-[11px] text-ink-3">
        {{ t('onboarding.calendar.demoBody') }}
      </p>
      <button
        class="w-full mt-2 text-[11px] text-ink-4 hover:text-ink-2 transition-colors bg-transparent border-none cursor-pointer py-1"
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
          class="animate-spin text-acid mx-auto mb-3"
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
        <p class="text-[12px] text-ink-3">
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
          :onboarding="{ step: 'calendar', tourId }"
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
        <p class="text-[12px] text-red-400">
          {{ error }}
        </p>
        <BtnSecondary @click="load">
          {{ t('onboarding.retry') }}
        </BtnSecondary>
        <button
          class="block w-full text-[11px] text-ink-4 hover:text-ink-2 transition-colors bg-transparent border-none cursor-pointer py-1"
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
          class="bg-[rgba(168,216,0,0.06)] border border-[rgba(168,216,0,0.15)] rounded-xl px-3.5 py-2.5"
        >
          <p class="text-[10px] font-semibold text-acid mb-1.5">
            {{ t('onboarding.calendar.existingTitle') }}
          </p>
          <div class="space-y-1">
            <div
              v-for="cal in existingCals"
              :key="cal.id"
              class="flex items-center gap-2"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-acid flex-shrink-0" />
              <p class="text-[11px] text-ink-2 truncate">
                {{ cal.calendar_name }}
              </p>
              <span
                class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0"
                :class="cal.webhook_status === 'active'
                  ? 'bg-[rgba(31,173,90,0.1)] text-[#1fad5a] border-[rgba(31,173,90,0.2)]'
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
          <p class="text-[10px] text-ink-4 mt-2">
            {{ t('onboarding.calendar.existingHint') }}
          </p>
        </div>

        <!-- Google calendar picker -->
        <div>
          <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-2">
            {{ t('onboarding.calendar.pickLabel') }}
          </label>

          <div
            v-if="googleCals.length === 0"
            class="text-center py-4"
          >
            <p class="text-[11px] text-ink-3">
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
                  <p class="text-[12px] font-medium text-ink truncate">
                    {{ cal.summary }}
                  </p>
                  <span
                    v-if="cal.primary"
                    class="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[rgba(26,143,255,0.1)] text-[#1a8fff] border border-[rgba(26,143,255,0.2)]"
                  >
                    {{ t('onboarding.calendar.primary') }}
                  </span>
                </div>
                <p class="text-[9px] text-ink-4 font-mono truncate mt-0.5">
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
          <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-1.5">
            {{ t('onboarding.calendar.nameLabel') }}
          </label>
          <input
            v-model="selectedCalName"
            class="w-full bg-glass border border-line rounded-lg px-3 py-2 text-[12px] text-ink placeholder-ink-4 outline-none focus:border-line-acid transition-colors"
            :placeholder="t('onboarding.calendar.namePlaceholder')"
          >
        </div>

        <p
          v-if="error"
          class="text-[11px] text-red-400"
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
            class="text-[11px] text-ink-3 hover:text-ink transition-colors bg-transparent border-none cursor-pointer py-1"
            @click="emit('next')"
          >
            {{ t('onboarding.calendar.useExisting') }}
          </button>
          <button
            class="text-[11px] text-ink-4 hover:text-ink-2 transition-colors bg-transparent border-none cursor-pointer py-1"
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
          class="animate-spin text-acid mx-auto mb-3"
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
        <p class="text-[13px] font-semibold text-ink mb-1">
          {{ t('onboarding.calendar.connecting') }}
        </p>
        <p class="text-[11px] text-ink-3">
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
          <div class="w-9 h-9 rounded-xl bg-[rgba(31,173,90,0.12)] flex items-center justify-center flex-shrink-0">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1fad5a"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-semibold text-ink leading-tight">
              {{ subscription.calendar_name }}
            </p>
            <p class="text-[10px] text-ink-4 font-mono mt-0.5 truncate">
              {{ subscription.calendar_id }}
            </p>
            <div class="flex items-center gap-2 mt-1.5">
              <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[rgba(31,173,90,0.1)] text-[#1fad5a] border border-[rgba(31,173,90,0.2)]">
                {{ t('onboarding.calendar.connected') }}
              </span>
              <span class="text-[10px] text-ink-4">
                {{ t('onboarding.calendar.lastSync', { date: formatDate(subscription.last_synced_at) }) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Tour assignment confirmation -->
        <div
          v-if="tourId !== null"
          class="flex items-center gap-2 bg-[rgba(168,216,0,0.06)] border border-[rgba(168,216,0,0.15)] rounded-xl px-3.5 py-2.5"
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
          <p class="text-[11px] text-ink-2">
            {{ t('onboarding.calendar.assignedTo') }}
            <span class="font-semibold text-ink">
              {{
                toursStore.tours.find((tr) => tr.id === tourId)?.name ??
                  t('onboarding.calendar.yourTour')
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
  </div>
</template>
