<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import type { NotificationUsageEntry } from '@/composables/useAdminNotificationUsage'

const { t, locale } = useI18n()
defineProps<{ entry: NotificationUsageEntry }>()

function formatDate(iso: string) {
  return DateTime.fromISO(iso)
    .setLocale(locale.value)
    .toLocaleString({ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="bg-glass border border-line rounded-xl px-3 py-2.5 flex items-center gap-3">
    <span
      class="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
      style="background: rgba(168,216,0,0.1); color: #a8d800"
    >
      {{ entry.channel }}
    </span>
    <div class="flex-1 min-w-0">
      <p class="text-[12px] text-ink">
        {{ t('admin.usage.recipients', entry.recipients_count) }}
        · {{ t('admin.usage.plan', { plan: entry.plan_code }) }}
      </p>
      <p class="text-[10px] text-ink-4">
        {{ t('admin.usage.usage') }}: {{ entry.notifications_used_before }} →
        {{ entry.notifications_used_after }}
        / {{ entry.notification_limit === 0 ? '∞' : entry.notification_limit }}
      </p>
    </div>
    <p class="text-[10px] text-ink-4 flex-shrink-0">
      {{ formatDate(entry.created_at) }}
    </p>
  </div>
</template>
