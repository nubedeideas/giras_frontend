<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import Pill from '@/components/ui/Pill.vue'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import { useTours } from '@/composables/useTours'
import {
  useCrewLinks,
  type CrewLinkRow,
  type CrewLinkState,
} from '@/composables/useCrewLinks'
import { copyText } from '@/utils/clipboard'
import type { PillVariant } from '@/types'

const props = withDefaults(
  defineProps<{
    tourUuid: string
    /**
     * Admin de la gira fuera de la demo (F1, lote 3). La pestaña también la ve el staff no
     * admin, que no puede importar: por eso el botón no depende de que la pestaña sea visible.
     */
    canImport?: boolean
  }>(),
  { canImport: false }
)
const emit = defineEmits<{ importTeam: [] }>()
const { t, locale } = useI18n()
const toursApi = useTours()
const linksApi = useCrewLinks()

// ─── Ajustes del portal (PATCH de la gira) ───────────────────────────────────

const settingsLoaded = ref(false)
const enabled = ref(true)
const days = ref(7)
const savingSettings = ref(false)
const settingsError = ref('')
const tourStatus = ref<string | null>(null)
const expiresOn = ref<string | null>(null)
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1)

// Contadores de petición: al cambiar de gira se descartan las respuestas de la anterior.
let settingsRequest = 0
let linksRequest = 0

async function loadSettings() {
  const req = ++settingsRequest
  settingsLoaded.value = false
  settingsError.value = ''
  tourStatus.value = null
  expiresOn.value = null
  try {
    const tour = await toursApi.getTour(props.tourUuid)
    if (req !== settingsRequest) return
    enabled.value = tour.crew_portal_enabled ?? true
    days.value = tour.crew_portal_days ?? 7
    tourStatus.value = tour.status
    expiresOn.value = tour.crew_portal_expires_on ?? null
    settingsLoaded.value = true
  } catch (e) {
    if (req !== settingsRequest) return
    settingsError.value = e instanceof Error ? e.message : t('tourHub.crew.saveError')
  }
}

/**
 * Motivo por el que ningún enlace puede funcionar ahora mismo (gira cancelada o portal
 * caducado), o null. El backend responde 400 `portal_unavailable` en esos casos.
 */
const blockedReason = computed<'cancelled' | 'expired' | null>(() => {
  if (tourStatus.value === 'cancelled') return 'cancelled'
  const today = DateTime.now().toISODate()
  if (expiresOn.value && today && expiresOn.value < today) return 'expired'
  return null
})

async function saveSettings(patch: { crew_portal_enabled?: boolean; crew_portal_days?: number }) {
  const tourUuid = props.tourUuid
  const prev = { enabled: enabled.value, days: days.value }
  if (patch.crew_portal_enabled !== undefined) enabled.value = patch.crew_portal_enabled
  if (patch.crew_portal_days !== undefined) days.value = patch.crew_portal_days
  savingSettings.value = true
  settingsError.value = ''
  try {
    const updated = await toursApi.updateTour(tourUuid, patch)
    if (tourUuid !== props.tourUuid) return
    enabled.value = updated.crew_portal_enabled ?? enabled.value
    days.value = updated.crew_portal_days ?? days.value
    // El estado de cada enlace depende de si el portal está encendido.
    if (patch.crew_portal_enabled !== undefined) await loadLinks()
  } catch (e) {
    if (tourUuid !== props.tourUuid) return
    enabled.value = prev.enabled
    days.value = prev.days
    settingsError.value = e instanceof Error ? e.message : t('tourHub.crew.saveError')
  } finally {
    savingSettings.value = false
  }
}

function toggleEnabled() {
  if (savingSettings.value) return
  saveSettings({ crew_portal_enabled: !enabled.value })
}

function onDaysChange(e: Event) {
  const value = Number((e.target as HTMLSelectElement).value)
  if (value >= 1 && value <= 31 && value !== days.value) saveSettings({ crew_portal_days: value })
}

// ─── Enlaces ─────────────────────────────────────────────────────────────────

const rows = ref<CrewLinkRow[]>([])
const total = ref(0)
const nextPage = ref<number | null>(null)
const loadingLinks = ref(false)
const linksError = ref('')

async function loadLinks(page = 1) {
  const req = ++linksRequest
  loadingLinks.value = true
  linksError.value = ''
  try {
    const data = await linksApi.listCrewLinks(props.tourUuid, page)
    if (req !== linksRequest) return
    rows.value = page === 1 ? data.results : [...rows.value, ...data.results]
    total.value = data.count
    nextPage.value = data.next ? page + 1 : null
  } catch (e) {
    if (req !== linksRequest) return
    linksError.value = e instanceof Error ? e.message : t('tourHub.crew.loadError')
  } finally {
    if (req === linksRequest) loadingLinks.value = false
  }
}

function load() {
  // Nada de la gira anterior debe quedar a la vista mientras carga la nueva.
  rows.value = []
  total.value = 0
  nextPage.value = null
  feedback.value = null
  pending.value = null
  loadSettings()
  loadLinks()
}

onMounted(load)
watch(() => props.tourUuid, load)

function replaceRow(row: CrewLinkRow) {
  const idx = rows.value.findIndex((r) => r.contact.uuid === row.contact.uuid)
  if (idx >= 0) rows.value[idx] = row
}

const STATE_VARIANT: Record<CrewLinkState, PillVariant> = {
  active: 'g',
  revoked: 'o',
  not_crew: 'o',
  expired: 'n',
  disabled: 'n',
  unavailable: 'n',
  none: 'n',
}

/** Estados de fila en los que ni copiar ni regenerar dan un enlace que funcione. */
const DEAD_STATES: ReadonlySet<CrewLinkState> = new Set(['disabled', 'expired', 'unavailable'])

function portalUsable(): boolean {
  return enabled.value && blockedReason.value === null
}

function canCopy(row: CrewLinkRow): boolean {
  return portalUsable() && (row.state === 'active' || row.state === 'none')
}

function canRotate(row: CrewLinkRow): boolean {
  return portalUsable() && row.sources.length > 0 && !!row.link && !DEAD_STATES.has(row.state)
}

function canRevoke(row: CrewLinkRow): boolean {
  return !!row.link && row.state !== 'revoked'
}

function formatWhen(iso: string): string {
  const dt = DateTime.fromISO(iso)
  return dt.isValid ? dt.setLocale(locale.value).toFormat('d LLL, HH:mm') : iso
}

// ─── Acciones ────────────────────────────────────────────────────────────────

const busyUuid = ref<string | null>(null)
const feedback = ref<{ uuid: string; kind: 'ok' | 'error' | 'manual'; text: string } | null>(
  null
)
let feedbackTimer: ReturnType<typeof setTimeout> | undefined

function showFeedback(uuid: string, kind: 'ok' | 'error' | 'manual', text: string) {
  feedback.value = { uuid, kind, text }
  clearTimeout(feedbackTimer)
  if (kind === 'ok') feedbackTimer = setTimeout(() => (feedback.value = null), 2500)
}

/**
 * Sustituye la fila por la respuesta de la API (si sigue siendo la misma gira) y devuelve su
 * URL. Sin URL, falla con el estado del enlace, que es lo que explica por qué no la hay.
 */
function urlFrom(tourUuid: string) {
  return (r: CrewLinkRow): string => {
    if (tourUuid === props.tourUuid) replaceRow(r)
    if (!r.link?.url) throw new Error(t(`tourHub.crew.states.${r.state}`))
    return r.link.url
  }
}

/**
 * Copia el enlace. Si aún no existe, se crea con `ensureCrewLink` y la promesa se pasa al
 * portapapeles en el mismo clic (Safari no deja copiar tras un `await`).
 */
async function copy(row: CrewLinkRow, urlPromise?: Promise<string>) {
  const uuid = row.contact.uuid
  const source: string | Promise<string> =
    urlPromise ??
    row.link?.url ??
    linksApi.ensureCrewLink(props.tourUuid, uuid).then(urlFrom(props.tourUuid))
  busyUuid.value = uuid
  try {
    await copyText(source)
    showFeedback(uuid, 'ok', t('tourHub.crew.copied'))
  } catch (e) {
    // Si la API respondió bien pero el navegador no deja copiar, se muestra el enlace a mano.
    const url = typeof source === 'string' ? source : await source.catch(() => null)
    if (url) showFeedback(uuid, 'manual', url)
    else showFeedback(uuid, 'error', e instanceof Error ? e.message : t('tourHub.crew.loadError'))
  } finally {
    busyUuid.value = null
  }
}

const pending = ref<{ action: 'rotate' | 'revoke'; row: CrewLinkRow } | null>(null)

function askRotate(row: CrewLinkRow) {
  pending.value = { action: 'rotate', row }
}

function askRevoke(row: CrewLinkRow) {
  pending.value = { action: 'revoke', row }
}

const confirmText = computed(() =>
  pending.value?.action === 'rotate'
    ? t('tourHub.crew.rotateConfirm')
    : t('tourHub.crew.revokeConfirm')
)

async function confirmPending() {
  const p = pending.value
  if (!p) return
  pending.value = null
  const uuid = p.row.contact.uuid
  if (p.action === 'rotate') {
    // Se copia el enlace nuevo con la promesa en el mismo gesto del botón "Confirmar".
    await copy(p.row, linksApi.rotateCrewLink(props.tourUuid, uuid).then(urlFrom(props.tourUuid)))
    return
  }
  busyUuid.value = uuid
  const tourUuid = props.tourUuid
  try {
    const updated = await linksApi.revokeCrewLink(tourUuid, uuid)
    if (tourUuid === props.tourUuid) replaceRow(updated)
  } catch (e) {
    showFeedback(uuid, 'error', e instanceof Error ? e.message : t('tourHub.crew.loadError'))
  } finally {
    busyUuid.value = null
  }
}
</script>

<template>
  <div>
    <!-- Ajustes -->
    <div class="bg-bg-3 border border-line rounded-lg shadow-[0_1px_3px_var(--shadow-sm)] p-5 mb-4">
      <p class="text-[11px] font-bold text-ink-2 tracking-[1px] uppercase mb-3">
        {{ t('tourHub.crew.title') }}
      </p>
      <div
        v-if="settingsLoaded"
        class="flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <button
          type="button"
          role="switch"
          data-testid="crew-enabled"
          :aria-checked="enabled"
          :disabled="savingSettings"
          class="flex items-center gap-2.5 bg-transparent border-none p-0 cursor-pointer text-left disabled:opacity-60"
          @click="toggleEnabled"
        >
          <span
            class="relative w-7 h-4 rounded-full flex-shrink-0 border transition-colors"
            :class="enabled ? 'bg-acid border-line-acid' : 'bg-glass-2 border-line'"
          >
            <span
              class="absolute top-[1px] w-3 h-3 rounded-full transition-all"
              :class="enabled ? 'left-[13px] bg-bg' : 'left-[1px] bg-ink-3'"
            />
          </span>
          <span class="text-[14px] text-ink-2">{{ t('tourHub.crew.enabled') }}</span>
        </button>
        <label class="flex items-center gap-2 sm:ml-auto">
          <span class="text-[13px] text-ink-3">{{ t('tourHub.crew.days') }}</span>
          <select
            data-testid="crew-days"
            :value="days"
            :disabled="savingSettings"
            class="bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive cursor-pointer"
            @change="onDaysChange"
          >
            <option
              v-for="n in DAY_OPTIONS"
              :key="n"
              :value="n"
            >
              {{ t('tourHub.crew.daysOption', { n }, n) }}
            </option>
          </select>
        </label>
      </div>
      <p class="text-[12px] text-ink-4 leading-relaxed mt-3">
        {{ t('tourHub.crew.help') }}
      </p>
      <p
        v-if="settingsLoaded && blockedReason"
        data-testid="crew-blocked"
        class="text-[12px] text-brand-orange bg-brand-orange-dim border border-line rounded px-2.5 py-1.5 mt-2"
      >
        {{ t(blockedReason === 'cancelled' ? 'tourHub.crew.cancelledNotice' : 'tourHub.crew.expiredNotice') }}
      </p>
      <p
        v-else-if="settingsLoaded && !enabled"
        class="text-[12px] text-brand-orange bg-brand-orange-dim border border-line rounded px-2.5 py-1.5 mt-2"
      >
        {{ t('tourHub.crew.disabledNotice') }}
      </p>
      <p
        v-if="settingsError"
        class="text-[12px] text-failed-fg mt-2"
      >
        {{ settingsError }}
      </p>
    </div>

    <!-- Lista -->
    <div
      v-if="loadingLinks && !rows.length"
      class="flex items-center justify-center py-16"
      data-testid="crew-links-loading"
    >
      <svg
        class="animate-spin text-ink-4"
        width="20"
        height="20"
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
    </div>

    <div
      v-else-if="linksError && !rows.length"
      class="py-10 text-center"
    >
      <p class="text-[14px] text-failed-fg mb-2">
        {{ linksError }}
      </p>
      <button
        class="text-[13px] text-ink-3 hover:text-ink cursor-pointer border-none bg-transparent underline"
        @click="loadLinks()"
      >
        {{ t('crewPortal.retry') }}
      </button>
    </div>

    <div
      v-else-if="!rows.length"
      data-testid="crew-links-empty"
      class="py-10 text-center"
    >
      <p class="text-[14px] text-ink-3 max-w-md mx-auto leading-relaxed">
        {{ t('tourHub.crew.empty') }}
      </p>
      <BtnSecondary
        v-if="canImport"
        type="button"
        class="mt-4"
        data-testid="crew-links-empty-import"
        @click="emit('importTeam')"
      >
        {{ t('importer.cta.importTeam') }}
      </BtnSecondary>
    </div>

    <div
      v-else
      class="space-y-2"
    >
      <p class="text-[12px] text-ink-4 mb-1">
        {{ t('tourHub.crew.people', { n: total }, total) }}
      </p>
      <div
        v-for="row in rows"
        :key="row.contact.uuid"
        data-testid="crew-link-row"
        class="bg-bg-3 border border-line rounded-lg p-3.5"
      >
        <div class="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-1.5 mb-1">
              <p class="text-[14px] font-semibold text-ink truncate">
                {{ row.contact.display_name }}
              </p>
              <Pill :variant="STATE_VARIANT[row.state]">
                {{ t(`tourHub.crew.states.${row.state}`) }}
              </Pill>
            </div>
            <p class="text-[12px] text-ink-3">
              <span
                v-for="(s, i) in row.sources"
                :key="s"
              >{{ i > 0 ? ', ' : '' }}{{ t(`tourHub.crew.sources.${s}`) }}</span>
              <span v-if="row.sources.length"> · </span>
              <span>{{ t('tourHub.crew.views', { n: row.link?.view_count ?? 0 }, row.link?.view_count ?? 0) }}</span>
              <span> · </span>
              <span v-if="row.link?.last_viewed_at">{{ t('tourHub.crew.lastView', { date: formatWhen(row.link.last_viewed_at) }) }}</span>
              <span v-else>{{ t('tourHub.crew.never') }}</span>
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-1.5 flex-shrink-0">
            <BtnPrimary
              v-if="canCopy(row)"
              small
              data-testid="crew-copy"
              :disabled="busyUuid === row.contact.uuid"
              @click="copy(row)"
            >
              {{ t('tourHub.crew.copy') }}
            </BtnPrimary>
            <BtnSecondary
              v-if="canRotate(row)"
              small
              data-testid="crew-rotate"
              :disabled="busyUuid === row.contact.uuid"
              @click="askRotate(row)"
            >
              {{ t('tourHub.crew.rotate') }}
            </BtnSecondary>
            <BtnSecondary
              v-if="canRevoke(row)"
              small
              data-testid="crew-revoke"
              :disabled="busyUuid === row.contact.uuid"
              @click="askRevoke(row)"
            >
              {{ t('tourHub.crew.revoke') }}
            </BtnSecondary>
          </div>
        </div>

        <div
          v-if="feedback && feedback.uuid === row.contact.uuid"
          data-testid="crew-feedback"
          class="mt-2 text-[13px]"
        >
          <p
            v-if="feedback.kind === 'ok'"
            class="text-olive"
          >
            {{ feedback.text }}
          </p>
          <p
            v-else-if="feedback.kind === 'error'"
            class="text-failed-fg"
          >
            {{ feedback.text }}
          </p>
          <template v-else>
            <p class="text-ink-3 mb-1">
              {{ t('tourHub.crew.copyFailed') }}
            </p>
            <input
              readonly
              :value="feedback.text"
              class="w-full bg-glass border border-line rounded px-2 py-1 text-ink text-[13px]"
              @focus="($event.target as HTMLInputElement).select()"
            >
          </template>
        </div>
      </div>

      <div
        v-if="nextPage"
        class="text-center pt-2"
      >
        <BtnSecondary
          small
          :disabled="loadingLinks"
          @click="loadLinks(nextPage)"
        >
          {{ t('tourHub.crew.loadMore') }}
        </BtnSecondary>
      </div>
    </div>

    <AppModal
      :show="!!pending"
      @close="pending = null"
    >
      <p
        data-testid="crew-confirm-text"
        class="text-[15px] text-ink mb-4"
      >
        {{ confirmText }}
      </p>
      <div class="flex justify-end gap-2">
        <BtnSecondary @click="pending = null">
          {{ t('common.cancel') }}
        </BtnSecondary>
        <BtnPrimary
          data-testid="crew-confirm"
          @click="confirmPending"
        >
          {{ t('tourHub.crew.confirm') }}
        </BtnPrimary>
      </div>
    </AppModal>
  </div>
</template>
