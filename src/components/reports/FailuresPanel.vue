<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type {
  ReportsFailedContact,
  ReportsFailureReason,
} from '@/composables/useNotificationReports'
import { browserZone, formatInZoneShort } from '@/utils/datetime'
import GlassBlock from '@/components/ui/GlassBlock.vue'

defineProps<{
  contacts: ReportsFailedContact[]
  reasons: ReportsFailureReason[]
}>()

const { t } = useI18n()

function when(iso: string): string {
  return formatInZoneShort(iso, browserZone())
}
</script>

<template>
  <GlassBlock :title="t('reports.failures.title')">
    <p
      v-if="!contacts.length && !reasons.length"
      class="text-[14px] text-ink-3 text-center py-2"
    >
      {{ t('reports.failures.none') }}
    </p>

    <template v-else>
      <p class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] mb-2">
        {{ t('reports.failures.topContacts') }}
      </p>
      <div class="flex flex-col gap-1.5 mb-4">
        <div
          v-for="(c, i) in contacts"
          :key="`${c.contact_uuid ?? ''}-${c.phone ?? ''}-${c.email ?? ''}-${i}`"
          class="p-2.5 rounded-lg bg-bg-2 border border-line"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-[14px] font-semibold text-ink truncate">
                {{ c.name }}
              </p>
              <p
                v-if="c.phone || c.email"
                class="text-[12px] text-ink-4 truncate"
              >
                {{ c.phone || c.email }}
              </p>
            </div>
            <span class="text-[12px] font-bold text-failed-fg flex-shrink-0">
              {{ t('reports.failures.count', c.failed_count) }}
            </span>
          </div>
          <p class="text-[12px] text-ink-3 mt-1 break-words">
            <span class="text-ink-4">{{ t('reports.failures.lastError') }}:</span>
            {{ c.last_error || t('reports.failures.noMessage') }}
            <span class="text-ink-3">· <span class="font-time tnum">{{ when(c.last_failed_at) }}</span></span>
          </p>
        </div>
      </div>

      <p class="text-[12px] font-semibold text-ink-2 uppercase tracking-[0.5px] mb-2">
        {{ t('reports.failures.reasons') }}
      </p>
      <div class="flex flex-col gap-1">
        <div
          v-for="r in reasons"
          :key="r.error_message"
          class="flex items-start justify-between gap-3 text-[13px]"
        >
          <span class="text-ink-2 break-words min-w-0">
            {{ r.error_message || t('reports.failures.noMessage') }}
          </span>
          <span class="font-bold text-ink flex-shrink-0">{{ r.count }}</span>
        </div>
      </div>
    </template>
  </GlassBlock>
</template>
