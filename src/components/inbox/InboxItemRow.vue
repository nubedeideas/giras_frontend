<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { InboxItem } from '@/composables/useInbox'
import { formatInboxItem, isNoticeTarget } from '@/utils/inbox'
import { formatRelativeTime } from '@/utils/relativeTime'

const props = defineProps<{ item: InboxItem }>()
const emit = defineEmits<{
  (e: 'activate', item: InboxItem): void
  (e: 'dismiss', item: InboxItem): void
}>()

const { t, locale } = useI18n()

const text = computed(() => formatInboxItem(props.item, t))

const SEVERITY_BAR: Record<string, string> = {
  critical: 'bg-brand-orange',
  warning: 'bg-acid',
  info: 'bg-brand-blue',
}
// Solo mientras no se ha leído: al enviar el aviso, el backend marca leídos sus ítems.
const reviewAndSend = computed(() => isNoticeTarget(props.item) && !props.item.read_at)

const severityClass = computed(() => SEVERITY_BAR[props.item.severity] ?? SEVERITY_BAR.info)

const meta = computed(() => {
  const when = formatRelativeTime(props.item.occurred_at, locale.value, t('inbox.time.now'))
  return [props.item.tour?.name, when].filter(Boolean).join(' · ')
})
</script>

<template>
  <li
    class="relative flex items-start gap-1 bg-glass hover:bg-glass-hover rounded-sm overflow-hidden transition-colors"
    :data-unread="!item.is_read"
  >
    <span
      class="absolute left-0 inset-y-0 w-[3px]"
      :class="severityClass"
      aria-hidden="true"
    />
    <button
      type="button"
      data-testid="inbox-item"
      class="flex-1 min-w-0 flex items-start gap-2.5 p-3 pl-4 text-left bg-transparent border-none cursor-pointer"
      @click="emit('activate', item)"
    >
      <span
        class="mt-[5px] w-2 h-2 flex-shrink-0 rounded-full"
        :class="item.is_read ? 'bg-transparent' : 'bg-acid'"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1 flex flex-col gap-0.5">
        <span
          data-testid="inbox-item-title"
          class="text-ink text-[15px] font-semibold leading-snug break-words"
        >{{ text.title }}</span>
        <span
          v-if="text.body"
          data-testid="inbox-item-body"
          class="text-ink-2 text-[14px] leading-snug break-words whitespace-pre-line"
        >{{ text.body }}</span>
        <span
          v-if="reviewAndSend"
          data-testid="inbox-item-review"
          class="self-start mt-1 inline-flex items-center min-h-[28px] px-2.5 rounded-full bg-acid-dim text-olive text-[13px] font-bold"
        >{{ t('inbox.reviewAndSend') }} →</span>
        <span class="text-ink-3 text-[13px] mt-0.5 truncate">{{ meta }}</span>
      </span>
    </button>
    <button
      type="button"
      data-testid="inbox-dismiss"
      class="flex-shrink-0 w-8 h-8 mt-2 mr-2 flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-ink-4 hover:text-ink hover:bg-glass-hover transition-colors"
      :aria-label="t('inbox.dismiss')"
      :title="t('inbox.dismiss')"
      @click.stop="emit('dismiss', item)"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <line
          x1="18"
          y1="6"
          x2="6"
          y2="18"
        />
        <line
          x1="6"
          y1="6"
          x2="18"
          y2="18"
        />
      </svg>
    </button>
  </li>
</template>
