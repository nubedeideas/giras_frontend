<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isPlanLimitError } from '@/utils/notificationErrors'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import {
  useNotifications,
  type RemindUnconfirmedExcluded,
  type RemindUnconfirmedResult,
} from '@/composables/useNotifications'
import {
  EXPLAINED_EXCLUSIONS,
  isBlockingRemindError,
  remindErrorMessage,
} from '@/utils/confirmations'

const props = defineProps<{ notificationUuid: string }>()
const emit = defineEmits<{ queued: [n: number] }>()

const { t } = useI18n()
const api = useNotifications()

const checking = ref(false)
const sending = ref(false)
const showConfirm = ref(false)
const preview = ref<RemindUnconfirmedResult | null>(null)
const error = ref('')
const notice = ref('')
/** Motivo por el que no hay a quién recordar (botón desactivado con tooltip). */
const blockedReason = ref('')

watch(
  () => props.notificationUuid,
  () => {
    preview.value = null
    error.value = ''
    notice.value = ''
    blockedReason.value = ''
    showConfirm.value = false
  }
)

// Los límites vienen en la respuesta (settings del backend), no se fijan en el texto.
function exclusionLines(result: RemindUnconfirmedResult): string[] {
  const excluded: RemindUnconfirmedExcluded = result.excluded
  return EXPLAINED_EXCLUSIONS.filter((k) => excluded[k] > 0).map((k) =>
    t(`confirmations.excluded.${k}`, {
      n: excluded[k],
      max: result.max_reminders_per_recipient,
      minutes: result.min_interval_minutes,
    })
  )
}

const previewExclusions = computed(() => (preview.value ? exclusionLines(preview.value) : []))

function markNobody(result: RemindUnconfirmedResult) {
  blockedReason.value = [t('confirmations.nobodyToRemind'), ...exclusionLines(result)].join('\n')
}

/** Muestra el error y, si es definitivo (400 con código bloqueante), desactiva el botón. */
function handleError(e: unknown) {
  const message = isPlanLimitError(e)
    ? t('notif.planLimitReached')
    : remindErrorMessage(e, t('confirmations.throttled'), t('confirmations.remindError'))
  if (isBlockingRemindError(e)) {
    blockedReason.value = message
    error.value = ''
  } else {
    error.value = message
  }
}

async function startDryRun() {
  checking.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await api.remindUnconfirmed(props.notificationUuid, true)
    if (result.eligible === 0) {
      markNobody(result)
      return
    }
    preview.value = result
    showConfirm.value = true
  } catch (e) {
    handleError(e)
  } finally {
    checking.value = false
  }
}

async function confirmSend() {
  sending.value = true
  error.value = ''
  try {
    const result = await api.remindUnconfirmed(props.notificationUuid)
    showConfirm.value = false
    if (result.queued === 0) {
      markNobody(result)
      return
    }
    notice.value = t('confirmations.remindQueued', result.queued)
    emit('queued', result.queued)
  } catch (e) {
    showConfirm.value = false
    handleError(e)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="space-y-1">
    <span
      class="inline-block"
      :title="blockedReason || undefined"
    >
      <button
        class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors"
        :class="
          blockedReason || checking
            ? 'bg-glass border-line text-ink-4 cursor-not-allowed'
            : 'bg-acid-dim border-line-acid text-acid hover:bg-glass-hover cursor-pointer'
        "
        :disabled="!!blockedReason || checking"
        @click="startDryRun"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {{ checking ? t('confirmations.remindChecking') : t('confirmations.remindButton') }}
      </button>
    </span>

    <p
      v-if="blockedReason && !notice"
      class="text-[10px] text-ink-4 whitespace-pre-line"
    >
      {{ blockedReason }}
    </p>
    <p
      v-if="notice"
      class="text-[11px] text-acid"
    >
      {{ notice }}
    </p>
    <p
      v-if="error"
      class="text-[11px] text-red-400 whitespace-pre-line"
    >
      {{ error }}
    </p>

    <AppModal
      :show="showConfirm"
      @close="showConfirm = false"
    >
      <p class="text-base font-bold text-ink tracking-[-0.2px] mb-3">
        {{ t('confirmations.remindConfirmTitle') }}
      </p>
      <p
        v-if="preview"
        class="text-[12px] text-ink-2 leading-relaxed"
      >
        {{ t('confirmations.remindConfirmBody', preview.eligible) }}
      </p>
      <div
        v-if="previewExclusions.length"
        class="mt-3 rounded-lg border border-line bg-glass px-3 py-2"
      >
        <p class="text-[10px] font-semibold text-ink-3 uppercase tracking-[0.5px] mb-1">
          {{ t('confirmations.remindExcludedTitle') }}
        </p>
        <ul class="space-y-0.5">
          <li
            v-for="line in previewExclusions"
            :key="line"
            class="text-[11px] text-ink-3"
          >
            {{ line }}
          </li>
        </ul>
      </div>
      <div class="flex flex-wrap gap-2 mt-4">
        <BtnPrimary
          :disabled="sending"
          :class="sending ? 'opacity-60 cursor-not-allowed' : ''"
          @click="confirmSend"
        >
          {{ sending ? t('confirmations.remindSending') : t('confirmations.remindSend') }}
        </BtnPrimary>
        <BtnSecondary @click="showConfirm = false">
          {{ t('confirmations.remindCancel') }}
        </BtnSecondary>
      </div>
    </AppModal>
  </div>
</template>
