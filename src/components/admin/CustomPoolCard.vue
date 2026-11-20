<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CustomPool } from '@/composables/useAdminCustomPools'

const { t } = useI18n()
defineProps<{ pool: CustomPool }>()
const emit = defineEmits<{ edit: []; delete: [] }>()
</script>

<template>
  <div class="bg-glass border border-line rounded-xl px-3 py-2.5">
    <div class="flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <p class="text-[12px] font-semibold text-ink truncate">
          {{ pool.user_email }}
        </p>
        <p class="text-[10px] text-ink-4 mt-0.5">
          {{
            t('admin.pools.cardSummary', {
              allocN: pool.allocated_notifications,
              totalN: pool.total_notifications,
              freeN: pool.remaining_notifications,
              allocS: pool.allocated_shows,
              totalS: pool.total_shows,
              freeS: pool.remaining_shows,
            })
          }}
        </p>
      </div>
      <span
        v-if="!pool.is_active"
        class="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
        style="background: rgba(239,68,68,0.12); color: #f87171"
      >{{ t('admin.common.inactive') }}</span>
      <button
        class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors flex-shrink-0"
        @click="emit('edit')"
      >
        {{ t('admin.common.edit') }}
      </button>
    </div>
    <p
      v-if="pool.notes"
      class="text-[10px] text-ink-4 mt-1.5"
    >
      {{ pool.notes }}
    </p>
  </div>
</template>
