<script setup lang="ts">
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { BadgeStatus } from '@/utils/statusBadge'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import { ref } from 'vue'
import { useAdminAllowlist, type AllowedEmail, type AllowlistStatus } from '@/composables/useAdminAllowlist'

const { t, locale } = useI18n()
const props = defineProps<{ item: AllowedEmail }>()
const emit = defineEmits<{ refresh: [] }>()

const api = useAdminAllowlist()
const expanded = ref(false)
const loading = ref(false)
const error = ref('')
const showRevokeConfirm = ref(false)

const STATUS_BADGE: Record<AllowlistStatus, BadgeStatus> = {
  pending: 'pending',
  approved: 'sent',
  revoked: 'failed',
}


function formatDate(iso: string | null) {
  if (!iso) return '—'
  return DateTime.fromISO(iso)
    .setLocale(locale.value)
    .toLocaleString({ day: '2-digit', month: 'short', year: 'numeric' })
}

async function revoke() {
  loading.value = true
  error.value = ''
  try {
    await api.revoke(props.item.uuid)
    showRevokeConfirm.value = false
    emit('refresh')
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.allowlist.revokeError')
  } finally {
    loading.value = false
  }
}

async function approve() {
  loading.value = true
  error.value = ''
  try {
    await api.approve(props.item.uuid)
    emit('refresh')
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('admin.allowlist.approveError')
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
      <div class="flex-1 min-w-0">
        <p class="text-[14px] font-medium text-ink truncate">
          {{ item.email }}
        </p>
        <p class="text-[12px] text-ink-4">
          {{
            t('admin.allowlist.invitedBy', {
              email: item.invited_by_email ?? '—',
              date: formatDate(item.created_at),
            })
          }}
        </p>
      </div>
      <StatusBadge
        class="flex-shrink-0"
        :status="STATUS_BADGE[item.status]"
        :label="t(`admin.allowlistStatus.${item.status}`)"
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
      <p
        v-if="item.notes"
        class="text-[13px] text-ink-3"
      >
        {{ item.notes }}
      </p>
      <p
        v-if="item.approved_at"
        class="text-[12px] text-ink-4"
      >
        {{ t('admin.allowlist.approvedOn', { date: formatDate(item.approved_at) }) }}
      </p>
      <p
        v-if="error"
        class="text-[13px] text-failed-fg"
      >
        {{ error }}
      </p>

      <div class="flex flex-wrap gap-1.5">
        <button
          v-if="item.status !== 'approved'"
          class="px-2.5 py-1 rounded-lg text-[13px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer transition-colors disabled:opacity-50"
          :disabled="loading"
          @click="approve"
        >
          {{ t('admin.allowlist.approve') }}
        </button>

        <template v-if="item.status === 'approved'">
          <button
            v-if="!showRevokeConfirm"
            class="px-2.5 py-1 rounded-lg text-[13px] font-medium bg-glass border border-line text-ink-4 hover:text-failed-fg hover:border-[#FCA5A5] cursor-pointer transition-colors"
            @click="showRevokeConfirm = true"
          >
            {{ t('admin.allowlist.revoke') }}
          </button>
          <div
            v-else
            class="flex gap-1"
          >
            <button
              class="px-2.5 py-1 rounded-lg text-[13px] font-semibold cursor-pointer border-none disabled:opacity-50"
              style="background: var(--failed-bg); color: var(--failed-fg)"
              :disabled="loading"
              @click="revoke"
            >
              {{ loading ? '…' : t('admin.common.confirm') }}
            </button>
            <button
              class="px-2.5 py-1 rounded-lg text-[13px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
              @click="showRevokeConfirm = false"
            >
              {{ t('admin.common.cancel') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
