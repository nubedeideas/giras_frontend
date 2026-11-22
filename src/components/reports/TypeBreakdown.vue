<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ReportsTypeRow } from '@/composables/useNotificationReports'
import GlassBlock from '@/components/ui/GlassBlock.vue'

defineProps<{ types: ReportsTypeRow[] }>()

const { t, te } = useI18n()

function typeLabel(type: string): string {
  const key = `reports.types.${type}`
  return te(key) ? t(key) : type
}

/** Confirmados sobre enviados con botón de confirmar; "—" si el tipo no tiene ninguno. */
function confirmationRate(row: ReportsTypeRow): string {
  return row.confirmable_sent > 0
    ? `${Math.round((row.confirmed / row.confirmable_sent) * 100)}%`
    : '—'
}
</script>

<template>
  <GlassBlock :title="t('reports.byType')">
    <div class="overflow-x-auto -mx-1">
      <table class="w-full text-[13px] min-w-[320px]">
        <thead>
          <tr class="text-[11px] text-ink-2 uppercase tracking-[0.5px]">
            <th class="text-left font-semibold py-1 px-1">
              {{ t('reports.type') }}
            </th>
            <th class="text-right font-semibold py-1 px-1">
              {{ t('reports.notifications') }}
            </th>
            <th class="text-right font-semibold py-1 px-1">
              {{ t('reports.sent') }}
            </th>
            <th
              class="text-right font-semibold py-1 px-1"
              :title="t('reports.confirmationRateHint')"
            >
              {{ t('reports.confirmationRate') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr
            v-for="row in types"
            :key="row.notification_type"
          >
            <td class="py-1.5 px-1 text-ink">
              {{ typeLabel(row.notification_type) }}
            </td>
            <td class="py-1.5 px-1 text-right text-ink-2">
              {{ row.notifications }}
            </td>
            <td class="py-1.5 px-1 text-right text-ink-2">
              {{ row.sent }}
            </td>
            <td class="py-1.5 px-1 text-right font-semibold text-olive">
              {{ confirmationRate(row) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </GlassBlock>
</template>
