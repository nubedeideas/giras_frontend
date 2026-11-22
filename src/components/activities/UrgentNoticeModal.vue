<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useNotices,
  type NoticeDetail,
  type NoticePreview,
  type NoticeSelection,
  type UrgentRequest,
} from '@/composables/useNotices'
import type { ReminderChannel } from '@/utils/reminders'
import {
  blankRequiredTexts,
  emptySelection,
  noticeErrorMessage,
  selectionEdit,
  whatsappQuotaBlocked,
} from '@/utils/notices'
import NoticeSheetShell from '@/components/tour/notices/NoticeSheetShell.vue'
import NoticeComposer from '@/components/tour/notices/NoticeComposer.vue'

/**
 * "Aviso urgente" desde una actividad (C2.4, D13). Todo en una hoja: canal → plantilla → textos
 * → destinatarios (los de la actividad, preseleccionados por el backend) → vista previa sin
 * efectos (`dry_run`) → confirmación con recuento y canal → envío. Cada vista previa y el envío
 * mandan solo lo que el usuario ha cambiado; el resto lo decide el backend.
 */
const props = defineProps<{
  show: boolean
  activityUuid: string
  tourUuid: string
  activityTitle?: string
  activityTypeName?: string
}>()
const emit = defineEmits<{ close: []; sent: [NoticeDetail] }>()

const { t } = useI18n()
const api = useNotices()

const preview = ref<NoticePreview | null>(null)
const loading = ref(false)
const loadError = ref('')
const actionError = ref('')
const sending = ref(false)
const confirming = ref(false)
const confirmClose = ref(false)
const sent = ref<NoticeDetail | null>(null)

// Elecciones del usuario (`null` = lo que proponga el backend).
const channelChoice = ref<ReminderChannel | null>(null)
const templateChoice = ref<string | null>(null)
/** Solo las claves que el usuario ha escrito. */
const drafts = ref<Record<string, string>>({})
const selection = ref<NoticeSelection>(emptySelection())

let request = 0

function reset() {
  preview.value = null
  loadError.value = ''
  actionError.value = ''
  confirming.value = false
  confirmClose.value = false
  sent.value = null
  channelChoice.value = null
  templateChoice.value = null
  drafts.value = {}
  selection.value = emptySelection()
}

/** Cuerpo de la petición con lo cambiado por el usuario y nada más. */
function buildRequest(): Omit<UrgentRequest, 'dry_run'> {
  const body: Omit<UrgentRequest, 'dry_run'> = { activity: props.activityUuid }
  if (channelChoice.value) body.channel = channelChoice.value
  if (templateChoice.value) body.template_slug = templateChoice.value
  const editable = new Set((preview.value?.editable_keys ?? []).map((k) => k.key))
  const overrides: Record<string, string> = {}
  for (const [key, value] of Object.entries(drafts.value)) {
    if (!editable.has(key)) continue
    if (key === 'title') body.title = value
    else if (key === 'message') body.message = value
    else overrides[key] = value
  }
  if (Object.keys(overrides).length) body.text_overrides = overrides
  const sel = selectionEdit(emptySelection(), selection.value)
  if (sel) body.selection = sel
  return body
}

async function loadPreview() {
  const req = ++request
  loading.value = true
  loadError.value = ''
  try {
    const data = await api.urgentPreview(buildRequest())
    if (req !== request) return
    preview.value = data
    // Un borrador de un texto que ya no es editable (cambió el canal) no se manda.
    const keys = new Set(data.editable_keys.map((k) => k.key))
    drafts.value = Object.fromEntries(Object.entries(drafts.value).filter(([k]) => keys.has(k)))
  } catch (e) {
    if (req !== request) return
    const msg = noticeErrorMessage(e, t, 'notices.errors.preview')
    // Con una vista previa ya pintada, el error va encima y se conserva lo anterior.
    if (preview.value) actionError.value = msg
    else loadError.value = msg
  } finally {
    if (req === request) loading.value = false
  }
}

watch(
  () => [props.show, props.activityUuid] as const,
  ([show]) => {
    if (!show) return
    reset()
    void loadPreview()
  },
  { immediate: true }
)

const channel = computed<ReminderChannel>(
  () => preview.value?.channel ?? channelChoice.value ?? 'whatsapp'
)
const reachable = computed(() => preview.value?.counts.reachable ?? 0)
const busy = computed(() => loading.value || sending.value)
const hasBlankTexts = computed(() => blankRequiredTexts(drafts.value).length > 0)
const quotaBlocked = computed(() => whatsappQuotaBlocked(preview.value, channel.value))
const canSend = computed(
  () =>
    !!preview.value &&
    reachable.value > 0 &&
    !busy.value &&
    !hasBlankTexts.value &&
    !quotaBlocked.value
)
const dirty = computed(
  () =>
    Object.keys(drafts.value).length > 0 ||
    !!channelChoice.value ||
    !!templateChoice.value ||
    !!selectionEdit(emptySelection(), selection.value)
)
const channelName = computed(() => t(`reminders.channels.${channel.value}`))

function onChannel(ch: ReminderChannel) {
  actionError.value = ''
  channelChoice.value = ch
  // La plantilla es de WhatsApp: al cambiar de canal la vuelve a proponer el backend.
  templateChoice.value = null
  confirming.value = false
  void loadPreview()
}

function onTemplate(slug: string) {
  actionError.value = ''
  templateChoice.value = slug
  confirming.value = false
  void loadPreview()
}

function onDraft(key: string, value: string) {
  drafts.value = { ...drafts.value, [key]: value }
}

function onSelection(next: NoticeSelection) {
  actionError.value = ''
  selection.value = next
  confirming.value = false
  void loadPreview()
}

async function send() {
  if (!canSend.value) return
  sending.value = true
  actionError.value = ''
  try {
    const data = await api.sendUrgent(buildRequest())
    sent.value = data
    confirming.value = false
    emit('sent', data)
  } catch (e) {
    actionError.value = noticeErrorMessage(e, t, 'notices.errors.send')
    confirming.value = false
    // Algo ha cambiado (destinatarios, actividad, plantilla): se enseña el estado real.
    const status = (e as { status?: number }).status
    if (status === 400 || status === 409) {
      sending.value = false
      await loadPreview()
    }
  } finally {
    sending.value = false
  }
}

/** Cualquier vía de cierre (×, overlay móvil...). Con cambios sin enviar, se confirma. */
function requestClose() {
  if (dirty.value && !sent.value && !confirmClose.value) {
    confirming.value = false
    confirmClose.value = true
    return
  }
  close()
}

function close() {
  confirming.value = false
  confirmClose.value = false
  emit('close')
}
</script>

<template>
  <NoticeSheetShell
    :show="show"
    :persistent="dirty && !sent"
    @close="requestClose"
  >
    <div data-test="urgent-notice">
      <div class="flex items-start gap-3 mb-4">
        <div class="flex-1 min-w-0">
          <span
            class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 bg-brand-orange-dim text-brand-orange"
          >{{ t('notices.urgent.title') }}</span>
          <p
            v-if="activityTitle"
            class="text-[16px] font-bold text-ink leading-snug break-words"
          >
            {{ activityTitle }}
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

      <!-- Enviado -->
      <div
        v-if="sent"
        class="py-2"
        data-test="urgent-sent"
      >
        <p class="text-[14px] font-semibold text-acid">
          {{ t('notices.sentOk', { n: sent.recipients_count }, sent.recipients_count) }}
        </p>
        <button
          type="button"
          class="mt-4 w-full min-h-[48px] lg:min-h-[38px] rounded-sm bg-glass border border-line text-ink text-[13px] font-medium cursor-pointer"
          @click="close"
        >
          {{ t('notices.close') }}
        </button>
      </div>

      <!-- Cargando -->
      <div
        v-else-if="loading && !preview"
        class="space-y-2"
        data-test="urgent-loading"
      >
        <div class="h-10 bg-glass-2 rounded animate-pulse" />
        <div class="h-24 bg-glass-2 rounded animate-pulse" />
        <div class="h-16 bg-glass-2 rounded animate-pulse" />
      </div>

      <!-- Error sin vista previa -->
      <div
        v-else-if="loadError && !preview"
        class="text-center py-4"
        data-test="urgent-error"
      >
        <p class="text-[12px] text-red-400">
          {{ loadError }}
        </p>
        <button
          type="button"
          class="min-h-[44px] mt-1 text-[12px] font-semibold text-acid bg-transparent border-none cursor-pointer"
          data-test="urgent-retry"
          @click="loadPreview"
        >
          {{ t('notices.retry') }}
        </button>
      </div>

      <template v-else-if="preview">
        <p
          v-if="actionError"
          class="text-[12px] text-red-400 mb-3"
          role="alert"
          data-test="urgent-action-error"
        >
          {{ actionError }}
        </p>
        <NoticeComposer
          :preview="preview"
          :channel="channel"
          :template-slug="preview.template_slug"
          :drafts="drafts"
          :selection="selection"
          :tour-uuid="tourUuid"
          :activity-type-name="activityTypeName"
          :disabled="sending"
          :refreshing="loading"
          @update:channel="onChannel"
          @update:template-slug="onTemplate"
          @update:draft="onDraft"
          @update:selection="onSelection"
        />
      </template>
    </div>

    <template
      v-if="preview && !sent"
      #footer
    >
      <div
        v-if="confirmClose"
        data-test="urgent-confirm-close"
      >
        <p class="text-[13px] text-ink mb-2.5">
          {{ t('notices.urgent.closeConfirm') }}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 min-h-[48px] lg:min-h-[38px] rounded-sm bg-glass border border-line text-ink-2 text-[13px] font-medium cursor-pointer hover:text-ink"
            data-test="urgent-close-cancel"
            @click="confirmClose = false"
          >
            {{ t('notices.keepEditing') }}
          </button>
          <button
            type="button"
            class="flex-1 min-h-[48px] lg:min-h-[38px] rounded-sm bg-red-500/15 text-red-400 border border-red-500/30 text-[13px] font-bold cursor-pointer"
            data-test="urgent-close-anyway"
            @click="close"
          >
            {{ t('notices.urgent.closeDiscard') }}
          </button>
        </div>
      </div>
      <div
        v-else-if="confirming"
        data-test="urgent-confirm"
      >
        <p class="text-[13px] text-ink mb-2.5">
          {{ t('notices.confirmSend', { n: reachable, channel: channelName }, reachable) }}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 min-h-[48px] lg:min-h-[38px] rounded-sm bg-glass border border-line text-ink-2 text-[13px] font-medium cursor-pointer hover:text-ink"
            :disabled="sending"
            @click="confirming = false"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="flex-[2] min-h-[48px] lg:min-h-[38px] rounded-sm bg-brand-orange text-ink text-[13px] font-bold border-none cursor-pointer disabled:opacity-50"
            :disabled="!canSend"
            data-test="urgent-confirm-yes"
            @click="send"
          >
            {{ sending ? t('notices.sending') : t('notices.send') }}
          </button>
        </div>
      </div>
      <button
        v-else
        type="button"
        class="w-full min-h-[52px] lg:min-h-[38px] rounded-sm bg-brand-orange text-ink text-[14px] lg:text-[13px] font-bold border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!canSend"
        data-test="urgent-send"
        @click="confirming = true"
      >
        {{ t('notices.send') }}
      </button>
    </template>
  </NoticeSheetShell>
</template>
