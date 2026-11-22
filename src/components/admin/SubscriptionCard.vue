<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { BadgeStatus } from '@/utils/statusBadge'
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { useAdminSubscriptions, type Subscription, type SubscriptionStatus } from '@/composables/useAdminSubscriptions'

const { t } = useI18n()
const props = defineProps<{ subscription: Subscription }>()
const emit = defineEmits<{ refresh: []; changePlan: [] }>()

const api = useAdminSubscriptions()
const expanded = ref(false)
const loading = ref(false)
const error = ref('')
const showCancelConfirm = ref(false)
const cancelReason = ref('')

const STATUS_BADGE: Record<SubscriptionStatus, BadgeStatus> = {
  pending: 'pending',
  active: 'sent',
  cancelled: 'off',
}

async function activate() {
  loading.value = true
  error.value = ''
  try {
    await api.activate(props.subscription.uuid)
    emit('refresh')
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.subscriptions.activateError')
  } finally {
    loading.value = false
  }
}

async function cancel() {
  loading.value = true
  error.value = ''
  try {
    await api.cancel(props.subscription.uuid, cancelReason.value.trim() || undefined)
    showCancelConfirm.value = false
    emit('refresh')
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.subscriptions.cancelError')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="bg-glass border border-line rounded-xl overflow-hidden">
    <button
      class="w-full flex items-center gap-3 px-3 py-2.5 text-left border-none bg-transparent cursor-pointer hover:bg-glass-hover transition-colors"
      @click="expanded = !expanded"
    >
      <span class="text-[12px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 bg-glass-2 text-ink-2 uppercase tracking-[0.4px]">
        {{ subscription.plan.code }}
      </span>
      <div class="flex-1 min-w-0">
        <p class="text-[14px] font-medium text-ink truncate">
          {{ subscription.tour_name }}
        </p>
        <p class="text-[12px] text-ink-4 truncate">
          {{ subscription.user_email }}
        </p>
      </div>
      <div class="flex-shrink-0 text-right">
        <p class="text-[13px] text-ink-2">
          {{
            t('admin.subscriptions.remaining', {
              n:
                subscription.remaining_notifications === -1
                  ? '∞'
                  : subscription.remaining_notifications,
            })
          }}
        </p>
        <p class="text-[12px] text-ink-4">
          {{ t('admin.subscriptions.used', { pct: subscription.usage_percentage }) }}
        </p>
      </div>
      <StatusBadge
        class="flex-shrink-0"
        :status="STATUS_BADGE[subscription.status]"
        :label="t(`admin.subscriptionStatus.${subscription.status}`)"
        size="sm"
      />
      <svg
        class="flex-shrink-0 text-ink-4 transition-transform"
        :class="expanded ? 'rotate-180' : ''"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div
      v-if="expanded"
      class="border-t border-line px-3 py-2.5 space-y-2"
    >
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] text-ink-3">
        <p>{{ t('admin.subscriptions.notificationsUsed', { n: subscription.notifications_used }) }}</p>
        <p>
          {{
            t('admin.subscriptions.shows', {
              used: subscription.shows_used,
              limit: subscription.shows_limit,
            })
          }}
        </p>
        <p>{{ t('admin.subscriptions.payments', { n: subscription.payments_count }) }}</p>
        <p>{{ t('admin.subscriptions.totalPaid', { amount: subscription.total_paid }) }}</p>
      </div>

      <p
        v-if="error"
        class="text-[13px] text-failed-fg"
      >
        {{ error }}
      </p>

      <div class="flex flex-wrap gap-1.5">
        <button
          class="px-2.5 py-1 rounded-lg text-[13px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors"
          @click="emit('changePlan')"
        >
          {{ t('admin.subscriptions.changePlan') }}
        </button>
        <button
          v-if="subscription.status === 'pending'"
          class="px-2.5 py-1 rounded-lg text-[13px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors disabled:opacity-50"
          :disabled="loading"
          @click="activate"
        >
          {{ t('admin.subscriptions.activate') }}
        </button>
        <button
          v-if="subscription.status === 'active' && !showCancelConfirm"
          class="px-2.5 py-1 rounded-lg text-[13px] font-medium bg-glass border border-line text-ink-4 hover:text-failed-fg hover:border-[#FCA5A5] cursor-pointer transition-colors"
          @click="showCancelConfirm = true"
        >
          {{ t('admin.subscriptions.cancel') }}
        </button>
      </div>

      <div
        v-if="showCancelConfirm"
        class="space-y-1.5"
      >
        <input
          v-model="cancelReason"
          :placeholder="t('admin.subscriptions.reasonPlaceholder')"
          class="w-full bg-bg-3 border border-line rounded-lg px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-line-2"
        >
        <div class="flex gap-1">
          <button
            class="px-2.5 py-1 rounded-lg text-[13px] font-semibold cursor-pointer border-none disabled:opacity-50"
            style="background: var(--failed-bg); color: var(--failed-fg)"
            :disabled="loading"
            @click="cancel"
          >
            {{ loading ? '…' : t('admin.subscriptions.confirmCancel') }}
          </button>
          <button
            class="px-2.5 py-1 rounded-lg text-[13px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
            @click="showCancelConfirm = false"
          >
            {{ t('admin.common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
