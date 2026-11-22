<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useToursStore } from '@/stores/tours'
import type { Rule, RuleOptions } from '@/composables/useNotificationRules'
import { formatRelativeTime } from '@/utils/relativeTime'
import { outcomeLabel, ruleSummary, ruleWarningsLabel } from '@/utils/notificationRules'

const props = defineProps<{
  rule: Rule
  options: RuleOptions | null
  /** Acción en curso sobre esta regla (toggle, duplicar, borrar). */
  busy?: boolean
}>()
const emit = defineEmits<{
  toggle: [rule: Rule]
  edit: [rule: Rule]
  duplicate: [rule: Rule]
  preview: [rule: Rule]
  delete: [rule: Rule]
}>()

const { t, locale } = useI18n()
const router = useRouter()
const toursStore = useToursStore()

/** D4: los avisos "N antes de la actividad" se configuran ahora en Recordatorios. */
const movedToReminders = computed(() => props.rule.trigger === 'activity_upcoming')

/**
 * A la pestaña Recordatorios de la gira de la regla. Si la regla no tiene gira o la gira no está en
 * la lista, a la plantilla del usuario (Configuración → Recordatorios), no a la gira activa.
 */
function goToReminders() {
  if (props.rule.tour && toursStore.setActiveTourByUuid(props.rule.tour)) {
    void router.push({ path: '/tour', query: { tab: 'reminders' } })
    return
  }
  void router.push({ path: '/settings', query: { tab: 'reminders' } })
}

const confirmingDelete = ref(false)

/** Una regla antigua solo se puede desactivar o borrar: no se reactiva. */
const toggleLocked = computed(() => !props.rule.is_editable && !props.rule.is_active)

const summary = computed(() => ruleSummary(props.rule, props.options, t))

const CHANNEL_CLASS: Record<string, string> = {
  whatsapp: 'bg-wa-green-dim text-wa-green',
  email: 'bg-brand-blue-dim text-brand-blue',
  in_app: 'bg-acid-dim text-olive',
}

const channelLabel = computed(() => {
  const key = `rules.channels.${props.rule.channel}`
  const s = t(key)
  return s === key ? props.rule.channel : s
})

const lastFired = computed(() => {
  if (!props.rule.last_fired_at) return t('rules.list.neverFired')
  const when = formatRelativeTime(props.rule.last_fired_at, locale.value, t('rules.list.now'))
  return `${t('rules.list.lastFired', { when })} · ${outcomeLabel(props.rule.last_outcome, t)}`
})

function confirmDelete() {
  confirmingDelete.value = false
  emit('delete', props.rule)
}
</script>

<template>
  <div
    class="bg-glass border border-line rounded-sm px-3 py-2.5"
    :class="rule.is_active ? '' : 'opacity-70'"
    :data-test="`rule-${rule.uuid}`"
  >
    <div class="flex items-start gap-2.5">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
          <p class="text-[14px] font-semibold text-ink truncate max-w-full">
            {{ rule.name }}
          </p>
          <!-- Mismo formato que Pill, con el color del canal -->
          <span
            class="text-[12px] font-bold px-1.5 py-0.5 rounded-full tracking-[0.4px]"
            :class="CHANNEL_CLASS[rule.channel] ?? 'bg-glass-2 text-ink-2'"
            data-test="rule-channel"
          >{{ channelLabel }}</span>
        </div>
        <p
          class="text-[13px] text-ink-2"
          data-test="rule-summary"
        >
          {{ summary }}
        </p>
        <p
          class="text-[12px] text-ink-4 mt-1"
          data-test="rule-last-fired"
        >
          {{ lastFired }}
        </p>
        <p
          v-for="w in rule.warnings"
          :key="w"
          class="text-[12px] text-brand-orange mt-0.5"
          data-test="rule-warning"
        >
          ⚠ {{ ruleWarningsLabel(w, t) }}
        </p>
        <p
          v-if="!rule.is_editable"
          class="text-[12px] text-ink-3 mt-0.5"
          data-test="rule-legacy"
        >
          {{ t('rules.list.legacy') }}
        </p>
        <p
          v-if="movedToReminders"
          class="text-[12px] text-ink-2 mt-0.5"
          data-test="rule-moved-to-reminders"
        >
          {{ t('rules.list.movedToReminders') }}
          <button
            type="button"
            class="text-olive font-semibold bg-transparent border-none p-0 cursor-pointer"
            data-test="rule-go-to-reminders"
            @click="goToReminders"
          >
            {{ t('rules.list.goToReminders') }}
          </button>
        </p>
      </div>

      <!-- Interruptor activa / inactiva -->
      <button
        type="button"
        role="switch"
        :aria-checked="rule.is_active"
        :aria-label="rule.is_active ? t('rules.list.active') : t('rules.list.inactive')"
        :title="rule.is_active ? t('rules.list.active') : t('rules.list.inactive')"
        class="relative flex-shrink-0 w-9 h-5 rounded-full border-none cursor-pointer transition-colors"
        :class="[rule.is_active ? 'bg-acid' : 'bg-line-2', busy || toggleLocked ? 'opacity-50' : '']"
        :disabled="busy || toggleLocked"
        data-test="rule-toggle"
        @click="emit('toggle', rule)"
      >
        <span
          class="absolute top-0.5 w-4 h-4 rounded-full transition-all"
          :class="rule.is_active ? 'left-[18px] bg-ink' : 'left-0.5 bg-bg-3'"
        />
      </button>
    </div>

    <!-- Acciones -->
    <div
      v-if="!confirmingDelete"
      class="flex flex-wrap gap-x-3 gap-y-1 mt-2"
    >
      <button
        v-if="rule.is_editable"
        class="text-[13px] text-ink-3 hover:text-ink bg-transparent border-none p-0 cursor-pointer"
        data-test="rule-edit"
        @click="emit('edit', rule)"
      >
        {{ t('rules.list.edit') }}
      </button>
      <button
        v-if="rule.is_editable"
        class="text-[13px] text-ink-3 hover:text-ink bg-transparent border-none p-0 cursor-pointer"
        :disabled="busy"
        data-test="rule-duplicate"
        @click="emit('duplicate', rule)"
      >
        {{ t('rules.list.duplicate') }}
      </button>
      <button
        v-if="rule.is_editable"
        class="text-[13px] text-ink-3 hover:text-ink bg-transparent border-none p-0 cursor-pointer"
        data-test="rule-preview"
        @click="emit('preview', rule)"
      >
        {{ t('rules.list.preview') }}
      </button>
      <button
        class="text-[13px] text-ink-3 hover:text-failed-fg bg-transparent border-none p-0 cursor-pointer"
        :disabled="busy"
        data-test="rule-delete"
        @click="confirmingDelete = true"
      >
        {{ t('rules.list.delete') }}
      </button>
    </div>
    <div
      v-else
      class="mt-2"
    >
      <p class="text-[13px] text-ink-2 mb-1.5">
        {{ t('rules.list.confirmDelete') }}
      </p>
      <div class="flex gap-1.5">
        <button
          class="px-3 py-1.5 rounded-sm text-[13px] font-semibold cursor-pointer border-none bg-failed-bg text-failed-fg hover:bg-failed-bg"
          data-test="rule-delete-confirm"
          @click="confirmDelete"
        >
          {{ t('rules.list.delete') }}
        </button>
        <button
          class="px-3 py-1.5 rounded-sm text-[13px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover cursor-pointer"
          @click="confirmingDelete = false"
        >
          {{ t('rules.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>
