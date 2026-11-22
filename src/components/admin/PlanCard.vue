<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { useAdminPlans, type Plan } from '@/composables/useAdminPlans'

const { t } = useI18n()
const props = defineProps<{ plan: Plan }>()
const emit = defineEmits<{ edit: []; deleted: [] }>()

const api = useAdminPlans()
const showDeleteConfirm = ref(false)
const deleting = ref(false)
const error = ref('')

async function doDelete() {
  deleting.value = true
  error.value = ''
  try {
    await api.remove(props.plan.uuid)
    emit('deleted')
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.common.deleteError')
    showDeleteConfirm.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="bg-glass border border-line rounded-xl px-3 py-2.5">
    <div class="flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="text-[14px] font-semibold text-ink truncate">
            {{ plan.name }}
          </p>
          <span class="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-glass-2 text-ink-2 uppercase tracking-[0.4px]">{{ plan.code }}</span>
          <span
            v-if="plan.is_default"
            class="text-[12px] font-bold px-1.5 py-0.5 rounded-full bg-acid-dim text-acid-muted"
          >{{ t('admin.common.default') }}</span>
          <span
            v-if="!plan.is_active"
            class="text-[12px] font-bold px-1.5 py-0.5 rounded-full"
            style="background: var(--failed-bg); color: var(--failed-fg)"
          >{{ t('admin.common.inactive') }}</span>
        </div>
        <p class="text-[12px] text-ink-4 mt-0.5">
          {{
            plan.is_unlimited_notifications
              ? t('admin.plans.unlimitedNotifications')
              : t('admin.plans.notifications', { n: plan.notification_limit })
          }}
          ·
          {{
            plan.is_unlimited_shows
              ? t('admin.plans.unlimitedShows')
              : t('admin.plans.shows', { n: plan.max_shows })
          }}
          ·
          {{ plan.price }} {{ plan.currency }}
        </p>
      </div>
      <button
        class="px-2.5 py-1 rounded-lg text-[13px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors flex-shrink-0"
        @click="emit('edit')"
      >
        {{ t('admin.common.edit') }}
      </button>
      <button
        v-if="!showDeleteConfirm"
        class="px-2.5 py-1 rounded-lg text-[13px] font-medium bg-glass border border-line text-ink-4 hover:text-failed-fg hover:border-[#FCA5A5] cursor-pointer transition-colors flex-shrink-0"
        @click="showDeleteConfirm = true"
      >
        {{ t('admin.common.delete') }}
      </button>
    </div>

    <div
      v-if="showDeleteConfirm"
      class="mt-2 pt-2 border-t border-line space-y-1.5"
    >
      <p class="text-[13px] text-ink-3">
        {{ t('admin.plans.deleteWarning') }}
      </p>
      <p
        v-if="error"
        class="text-[13px] text-failed-fg"
      >
        {{ error }}
      </p>
      <div class="flex gap-1">
        <button
          class="px-2.5 py-1 rounded-lg text-[13px] font-semibold cursor-pointer border-none disabled:opacity-50"
          style="background: var(--failed-bg); color: var(--failed-fg)"
          :disabled="deleting"
          @click="doDelete"
        >
          {{ deleting ? '…' : t('admin.plans.deleteAnyway') }}
        </button>
        <button
          class="px-2.5 py-1 rounded-lg text-[13px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
          @click="showDeleteConfirm = false"
        >
          {{ t('admin.common.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>
