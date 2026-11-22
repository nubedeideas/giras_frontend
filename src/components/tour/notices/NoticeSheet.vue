<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useNotices,
  type NoticeDetail,
  type NoticeEdit,
  type NoticeSelection,
} from '@/composables/useNotices'
import { useToursStore } from '@/stores/tours'
import { useNoticesStore } from '@/stores/notices'
import { ApiError } from '@/utils/apiClient'
import type { ReminderChannel } from '@/utils/reminders'
import {
  blankRequiredTexts,
  expiresInLabel,
  isExpiredByClock,
  isStaleNotice,
  keepDirtyDrafts,
  noticeErrorMessage,
  noticeHeadline,
  noticeStatusLine,
  noticeSummary,
  normalizeSelection,
  originLabel,
  originTone,
  selectionEdit,
  textEdit,
  whatsappQuotaBlocked,
} from '@/utils/notices'
import NoticeSheetShell from './NoticeSheetShell.vue'
import NoticeComposer from './NoticeComposer.vue'

/**
 * Hoja de un aviso (C2.2). Pendiente: canal, plantilla y destinatarios se guardan al momento
 * (PATCH solo del campo cambiado, para que la vista previa y el coste se recalculen); los textos
 * son borradores locales que guarda el padre por uuid (sobreviven a cerrar y reabrir) y viajan
 * con "Enviar ahora" o con "Guardar textos". Cerrar con textos sin guardar pide confirmación.
 * Antes de enviar se confirma con el recuento y el canal. Enviado, descartado o caducado: solo
 * lectura con el motivo. Un 409 recarga el aviso y conserva los borradores aplicables.
 */
const props = defineProps<{
  show: boolean
  noticeUuid: string | null
  tourUuid: string
  /** Borradores de texto de este aviso (por clave). */
  drafts?: Record<string, string>
}>()
const emit = defineEmits<{
  close: []
  changed: [NoticeDetail]
  'update:drafts': [uuid: string, drafts: Record<string, string>]
}>()

const { t, locale } = useI18n()
const api = useNotices()
const toursStore = useToursStore()
const noticesStore = useNoticesStore()

const detail = ref<NoticeDetail | null>(null)
const loading = ref(false)
const loadError = ref('')
const busy = ref(false)
const actionError = ref('')
const confirm = ref<'send' | 'discard' | 'close' | null>(null)
const justSent = ref(false)

const drafts = computed(() => props.drafts ?? {})

function setDrafts(next: Record<string, string>) {
  const uuid = props.noticeUuid
  if (uuid) emit('update:drafts', uuid, next)
}

let request = 0

/**
 * Detalle desde `useNoticesStore`: el de la caché si lo hay (sin petición) o una petición
 * compartida con las tarjetas del panel. `force` (tras un 409/404) siempre lo pide de nuevo.
 */
async function load({
  keepError = false,
  force = false,
}: { keepError?: boolean; force?: boolean } = {}) {
  const uuid = props.noticeUuid
  if (!uuid) return
  const req = ++request
  loading.value = true
  loadError.value = ''
  if (!keepError) actionError.value = ''
  try {
    const data = await noticesStore.fetchDetail(uuid, { force })
    if (req !== request) return
    setDetail(data)
    if (force) emit('changed', data)
  } catch (e) {
    if (req !== request) return
    detail.value = null
    loadError.value = noticeErrorMessage(e, t, 'notices.errors.load')
    if (e instanceof ApiError && e.status === 403) void toursStore.loadTours()
  } finally {
    if (req === request) loading.value = false
  }
}

/** Nuevo estado del servidor sin perder los textos que el usuario aún no ha guardado. */
function setDetail(data: NoticeDetail) {
  detail.value = data
  const kept = data.preview ? keepDirtyDrafts(data.preview.editable_keys, drafts.value) : {}
  if (!sameDrafts(kept, drafts.value)) setDrafts(kept)
  if (data.status !== 'pending') confirm.value = null
}

function sameDrafts(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k])
}

watch(
  () => [props.show, props.noticeUuid] as const,
  ([show, uuid]) => {
    if (!show || !uuid) return
    confirm.value = null
    justSent.value = false
    actionError.value = ''
    if (detail.value?.uuid !== uuid) detail.value = null
    void load()
  },
  { immediate: true }
)

// ─── Derivados ────────────────────────────────────────────────────────────────

const preview = computed(() => detail.value?.preview ?? null)
const isPending = computed(() => detail.value?.status === 'pending' && !!preview.value)
const expiredByClock = computed(() => isExpiredByClock(detail.value?.expires_at ?? null))
const editable = computed(() => isPending.value && !expiredByClock.value)
const selection = computed(() => normalizeSelection(detail.value?.selection))
const channel = computed<ReminderChannel>(
  () => preview.value?.channel ?? detail.value?.channel ?? 'whatsapp'
)
const pendingTextEdit = computed(() =>
  preview.value ? textEdit(preview.value.editable_keys, drafts.value) : {}
)
const hasTextDrafts = computed(
  () => editable.value && Object.keys(pendingTextEdit.value).length > 0
)
const hasBlankTexts = computed(() => blankRequiredTexts(drafts.value).length > 0)
const reachable = computed(() => preview.value?.counts.reachable ?? 0)
const quotaBlocked = computed(() => whatsappQuotaBlocked(preview.value, channel.value))
const canSend = computed(
  () =>
    editable.value &&
    reachable.value > 0 &&
    !busy.value &&
    !hasBlankTexts.value &&
    !quotaBlocked.value
)

const tone = computed(() =>
  originTone(detail.value?.origin ?? '') === 'orange'
    ? 'bg-brand-orange-dim text-brand-orange'
    : 'bg-acid-dim text-olive'
)
const expiresIn = computed(() =>
  detail.value && isPending.value ? expiresInLabel(detail.value.expires_at, t, locale.value) : null
)
const statusLine = computed(() =>
  detail.value ? noticeStatusLine(detail.value, t, locale.value) : ''
)
const channelName = computed(() => t(`reminders.channels.${channel.value}`))

// ─── Acciones ─────────────────────────────────────────────────────────────────

async function run(fn: () => Promise<NoticeDetail>): Promise<boolean> {
  if (!detail.value || busy.value) return false
  busy.value = true
  actionError.value = ''
  try {
    const data = await fn()
    setDetail(data)
    emit('changed', data)
    return true
  } catch (e) {
    actionError.value = noticeErrorMessage(e, t, 'notices.errors.action')
    const status = e instanceof ApiError ? e.status : 0
    // 403: ya no administra la gira; se recargan las giras (el panel dejará de verse).
    if (status === 403) void toursStore.loadTours()
    // 409: el aviso ya no está como creíamos (enviado por otro admin, caducado...). 404: ya no
    // existe. En ambos casos se recarga para enseñar su estado real.
    if (isStaleNotice(e) || status === 404) await load({ keepError: true, force: true })
    return false
  } finally {
    busy.value = false
  }
}

function patch(edit: NoticeEdit) {
  const uuid = detail.value?.uuid
  if (!uuid) return
  return run(() => api.update(uuid, edit))
}

function onChannel(ch: ReminderChannel) {
  void patch({ channel: ch })
}

function onTemplate(slug: string) {
  void patch({ template_slug: slug })
}

function onSelection(next: NoticeSelection) {
  const diff = selectionEdit(selection.value, next)
  if (diff) void patch({ selection: diff })
}

function onDraft(key: string, value: string) {
  setDrafts({ ...drafts.value, [key]: value })
}

async function saveTexts(): Promise<boolean> {
  if (!hasTextDrafts.value || hasBlankTexts.value) return false
  return (await patch({ ...pendingTextEdit.value })) ?? false
}

async function send() {
  const uuid = detail.value?.uuid
  if (!uuid || hasBlankTexts.value) return
  const edit = pendingTextEdit.value
  const ok = await run(() => api.send(uuid, Object.keys(edit).length ? { ...edit } : undefined))
  confirm.value = null
  if (ok) justSent.value = true
}

async function discard() {
  const uuid = detail.value?.uuid
  if (!uuid) return
  await run(() => api.discard(uuid))
  confirm.value = null
}

/** Cualquier vía de cierre (×, overlay móvil, Esc...). Con textos sin guardar, se confirma. */
function requestClose() {
  if (hasTextDrafts.value && confirm.value !== 'close') {
    confirm.value = 'close'
    return
  }
  forceClose()
}

function forceClose() {
  confirm.value = null
  emit('close')
}

async function saveAndClose() {
  if (await saveTexts()) forceClose()
}
</script>

<template>
  <NoticeSheetShell
    :show="show"
    :persistent="hasTextDrafts"
    @close="requestClose"
  >
    <div data-test="notice-sheet">
      <!-- Cabecera (en móvil el cierre lo pone el overlay) -->
      <div class="flex items-start gap-3 mb-4">
        <div class="flex-1 min-w-0">
          <template v-if="detail">
            <span
              class="inline-block text-[12px] font-bold px-2 py-0.5 rounded-full mb-1.5"
              :class="tone"
              data-test="notice-origin"
            >{{ originLabel(detail.origin, t) }}</span>
            <p class="text-[16px] font-bold text-ink leading-snug break-words">
              {{ noticeHeadline(detail) }}
            </p>
            <p
              class="text-[15px] text-ink-2 mt-0.5 break-words"
              data-test="notice-summary"
            >
              {{ noticeSummary(detail, t) }}
            </p>
            <p
              v-if="expiresIn"
              class="text-[13px] text-ink-3 mt-1"
              data-test="notice-expires"
            >
              {{ expiresIn }}
            </p>
          </template>
          <p
            v-else
            class="text-[16px] font-bold text-ink"
          >
            {{ t('notices.sheetTitle') }}
          </p>
        </div>
        <button
          type="button"
          class="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink flex-shrink-0"
          :aria-label="t('notices.close')"
          @click="requestClose"
        >
          ×
        </button>
      </div>

      <!-- Cargando -->
      <div
        v-if="loading && !detail"
        class="space-y-2"
        data-test="notice-sheet-loading"
      >
        <div class="h-10 bg-glass-2 rounded animate-pulse" />
        <div class="h-24 bg-glass-2 rounded animate-pulse" />
        <div class="h-16 bg-glass-2 rounded animate-pulse" />
      </div>

      <!-- Error de carga -->
      <div
        v-else-if="loadError && !detail"
        class="text-center py-4"
        data-test="notice-sheet-error"
      >
        <p class="text-[14px] text-failed-fg">
          {{ loadError }}
        </p>
        <button
          type="button"
          class="min-h-[44px] mt-1 text-[14px] font-semibold text-olive bg-transparent border-none cursor-pointer"
          data-test="notice-sheet-retry"
          @click="load({ force: true })"
        >
          {{ t('notices.retry') }}
        </button>
      </div>

      <template v-else-if="detail">
        <p
          v-if="actionError"
          class="text-[14px] text-failed-fg mb-3"
          role="alert"
          data-test="notice-action-error"
        >
          {{ actionError }}
        </p>

        <!-- Pendiente: editable -->
        <template v-if="isPending && preview">
          <p
            v-if="expiredByClock"
            class="text-[14px] text-brand-orange mb-3"
            data-test="notice-expired-clock"
          >
            {{ t('notices.errors.notice_expired') }}
          </p>
          <NoticeComposer
            :preview="preview"
            :channel="channel"
            :template-slug="preview.template_slug"
            :drafts="drafts"
            :selection="selection"
            :tour-uuid="tourUuid"
            :disabled="!editable || busy"
            :refreshing="busy"
            @update:channel="onChannel"
            @update:template-slug="onTemplate"
            @update:draft="onDraft"
            @update:selection="onSelection"
          />
          <button
            v-if="hasTextDrafts && editable"
            type="button"
            class="mt-3 min-h-[44px] lg:min-h-0 text-[14px] font-semibold text-olive bg-transparent border-none cursor-pointer p-0"
            :disabled="busy || hasBlankTexts"
            data-test="notice-save-texts"
            @click="saveTexts"
          >
            {{ t('notices.saveTexts') }}
          </button>
        </template>

        <!-- Solo lectura -->
        <div
          v-else
          class="space-y-3"
          data-test="notice-readonly"
        >
          <p
            v-if="justSent && detail.status === 'sent'"
            class="text-[15px] font-semibold text-olive"
            data-test="notice-sent-ok"
          >
            {{ t('notices.sentOk', { n: detail.recipients_count }, detail.recipients_count) }}
          </p>
          <p
            class="text-[14px] text-ink-2"
            data-test="notice-status-line"
          >
            {{ statusLine }}
          </p>
          <p
            v-if="detail.status === 'sent'"
            class="text-[14px] text-ink-3"
          >
            {{ t('notices.sentTo', { n: detail.recipients_count, channel: channelName }, detail.recipients_count) }}
          </p>
          <div
            v-if="detail.title || detail.message"
            class="bg-glass border border-line rounded-sm p-3"
          >
            <p
              v-if="detail.title"
              class="text-[15px] font-semibold text-ink mb-1 break-words"
            >
              {{ detail.title }}
            </p>
            <p class="text-[14px] text-ink-2 whitespace-pre-line break-words">
              {{ detail.message }}
            </p>
          </div>
        </div>
      </template>
    </div>

    <template
      v-if="detail && isPending"
      #footer
    >
      <!-- Cerrar con textos sin guardar -->
      <div
        v-if="confirm === 'close'"
        data-test="notice-confirm-close"
      >
        <p class="text-[15px] text-ink mb-2.5">
          {{ t('notices.closeConfirm') }}
        </p>
        <div class="flex flex-col lg:flex-row-reverse gap-2">
          <button
            type="button"
            class="w-full lg:flex-1 min-h-[48px] lg:min-h-[38px] rounded-sm bg-acid text-ink text-[15px] font-bold border-none cursor-pointer hover:bg-acid-light disabled:opacity-50"
            :disabled="busy || hasBlankTexts"
            data-test="notice-close-save"
            @click="saveAndClose"
          >
            {{ t('notices.saveAndClose') }}
          </button>
          <button
            type="button"
            class="w-full lg:flex-1 min-h-[44px] lg:min-h-[38px] rounded-sm bg-glass border border-line text-ink-2 text-[15px] font-medium cursor-pointer hover:text-ink"
            :disabled="busy"
            data-test="notice-close-anyway"
            @click="forceClose"
          >
            {{ t('notices.closeWithoutSaving') }}
          </button>
          <button
            type="button"
            class="w-full lg:flex-1 min-h-[44px] lg:min-h-[38px] rounded-sm bg-transparent border-none text-ink-3 text-[15px] cursor-pointer hover:text-ink"
            data-test="notice-close-cancel"
            @click="confirm = null"
          >
            {{ t('notices.keepEditing') }}
          </button>
        </div>
      </div>

      <!-- Confirmación de envío: recuento y canal -->
      <div
        v-else-if="confirm === 'send'"
        data-test="notice-confirm-send"
      >
        <p class="text-[15px] text-ink mb-2.5">
          {{ t('notices.confirmSend', { n: reachable, channel: channelName }, reachable) }}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 min-h-[48px] lg:min-h-[38px] rounded-sm bg-glass border border-line text-ink-2 text-[15px] font-medium cursor-pointer hover:text-ink"
            :disabled="busy"
            @click="confirm = null"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="flex-[2] min-h-[48px] lg:min-h-[38px] rounded-sm bg-acid text-ink text-[15px] font-bold border-none cursor-pointer hover:bg-acid-light disabled:opacity-50"
            :disabled="!canSend"
            data-test="notice-confirm-send-yes"
            @click="send"
          >
            {{ busy ? t('notices.sending') : t('notices.send') }}
          </button>
        </div>
      </div>

      <!-- Confirmación de descarte -->
      <div
        v-else-if="confirm === 'discard'"
        data-test="notice-confirm-discard"
      >
        <p class="text-[15px] text-ink mb-2.5">
          {{ t('notices.discardConfirm') }}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 min-h-[48px] lg:min-h-[38px] rounded-sm bg-glass border border-line text-ink-2 text-[15px] font-medium cursor-pointer hover:text-ink"
            :disabled="busy"
            @click="confirm = null"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="flex-1 min-h-[48px] lg:min-h-[38px] rounded-sm bg-failed-bg text-failed-fg border border-[#FCA5A5] text-[15px] font-bold cursor-pointer disabled:opacity-50"
            :disabled="busy"
            data-test="notice-confirm-discard-yes"
            @click="discard"
          >
            {{ t('notices.discard') }}
          </button>
        </div>
      </div>

      <div
        v-else
        class="flex flex-col lg:flex-row-reverse gap-2"
      >
        <button
          type="button"
          class="w-full lg:flex-[2] min-h-[52px] lg:min-h-[38px] rounded-sm bg-acid text-ink text-[15px] lg:text-[14px] font-bold border-none cursor-pointer hover:bg-acid-light disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canSend"
          data-test="notice-send"
          @click="confirm = 'send'"
        >
          {{ t('notices.send') }}
        </button>
        <button
          type="button"
          class="w-full lg:flex-1 min-h-[44px] lg:min-h-[38px] rounded-sm bg-glass border border-line text-ink-2 text-[15px] font-medium cursor-pointer hover:text-ink disabled:opacity-50"
          :disabled="busy"
          data-test="notice-discard"
          @click="confirm = 'discard'"
        >
          {{ t('notices.discard') }}
        </button>
      </div>
    </template>
  </NoticeSheetShell>
</template>
