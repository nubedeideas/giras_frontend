<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NotificationRecipient } from '@/composables/useNotifications'
import { pendingDetail, recipientChipKind, type RecipientChipKind } from '@/utils/confirmations'

const props = defineProps<{
  recipient: Pick<
    NotificationRecipient,
    'status' | 'confirmed_at' | 'delivered_at' | 'read_at' | 'error_message'
  > &
    Partial<Pick<NotificationRecipient, 'reminder_count' | 'last_reminder_error'>>
  confirmable: boolean
}>()

const { t } = useI18n()

const kind = computed(() => recipientChipKind(props.recipient, props.confirmable))

const CHIP_CLASS: Record<RecipientChipKind, string> = {
  confirmed: 'bg-sent-bg text-sent-fg',
  failed: 'bg-failed-bg text-failed-fg',
  pending: 'bg-pending-bg text-pending-fg',
  notSent: 'bg-off-bg text-off-fg',
  sent: 'bg-scheduled-bg text-scheduled-fg',
  delivered: 'bg-wa-bg text-wa-fg',
  read: 'bg-sent-bg text-sent-fg',
}

const label = computed(() => t(`confirmations.${kind.value}`))

const subtitle = computed(() => {
  if (kind.value !== 'pending') return ''
  const parts: string[] = []
  const detail = pendingDetail(props.recipient)
  if (detail) parts.push(t(`confirmations.${detail}`))
  const reminders = props.recipient.reminder_count ?? 0
  if (reminders > 0) parts.push(t('confirmations.remindedTimes', reminders))
  return parts.join(' · ')
})

const tooltip = computed(() => {
  const lines: string[] = []
  if (props.recipient.error_message) {
    lines.push(props.recipient.error_message)
  }
  if (props.recipient.last_reminder_error) {
    lines.push(t('confirmations.lastReminderError', { error: props.recipient.last_reminder_error }))
  }
  return lines.join('\n') || undefined
})
</script>

<template>
  <span
    class="inline-flex flex-col items-end flex-shrink-0 max-w-[140px]"
    :title="tooltip"
  >
    <span
      class="text-[12px] font-bold px-1.5 py-0.5 rounded-full tracking-[0.3px] whitespace-nowrap"
      :class="CHIP_CLASS[kind]"
    >
      {{ label }}
    </span>
    <span
      v-if="subtitle"
      class="text-[12px] text-ink-4 mt-0.5 truncate max-w-full"
    >
      {{ subtitle }}
    </span>
  </span>
</template>
