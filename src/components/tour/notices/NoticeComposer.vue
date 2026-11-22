<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NoticePreview, NoticeSelection } from '@/composables/useNotices'
import { channelMeta, type ReminderChannel } from '@/utils/reminders'
import {
  blankRequiredTexts,
  editableKeyLabel,
  shownRemaining,
  templateLabel,
  variableLabel,
} from '@/utils/notices'
import NoticeRecipientsEditor from './NoticeRecipientsEditor.vue'

/**
 * Cuerpo editable de un aviso, común a la hoja de un borrador (C2.2) y al aviso urgente (C2.4):
 * canal, plantilla, textos permitidos (D14), destinatarios, vista previa y coste. No llama a la
 * API: emite cada cambio y el padre decide.
 */
const props = defineProps<{
  preview: NoticePreview
  channel: ReminderChannel
  templateSlug: string | null
  /** Borradores locales de los textos editables, por clave. */
  drafts: Record<string, string>
  selection: NoticeSelection
  tourUuid: string
  activityTypeName?: string
  disabled?: boolean
  /** Hay una vista previa nueva en camino. */
  refreshing?: boolean
}>()

const emit = defineEmits<{
  'update:channel': [ReminderChannel]
  'update:templateSlug': [string]
  'update:draft': [key: string, value: string]
  'update:selection': [NoticeSelection]
}>()

const { t, locale } = useI18n()

const channels = computed(() =>
  props.preview.allowed_channels.length ? props.preview.allowed_channels : [props.channel]
)

const templates = computed(() =>
  props.channel === 'whatsapp' ? props.preview.allowed_templates : []
)

function value(key: string, fallback: string): string {
  return props.drafts[key] ?? fallback
}

function isLong(maxLength: number): boolean {
  return maxLength > 200
}

/**
 * Variables de WhatsApp con los borradores aplicados (mismo nombre de clave), en el orden en que
 * aparecen en la plantilla (`variable_positions`); sin posición, al final.
 */
const variables = computed(() => {
  const vars = props.preview.variables
  if (!vars) return []
  const positions = props.preview.variable_positions ?? {}
  const pos = (k: string) => {
    const n = Number(positions[k])
    return positions[k] == null || Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n
  }
  return Object.entries(vars)
    .sort(([a], [b]) => pos(a) - pos(b))
    .map(([key, v]) => ({
      key,
      label: variableLabel(key, t),
      value: props.drafts[key] ?? v,
    }))
})

const rendered = computed(() => {
  const r = props.preview.rendered
  if (!r) return null
  return {
    title: props.drafts.title ?? r.title,
    body: props.drafts.message ?? r.body,
  }
})

const counts = computed(() => props.preview.counts)

const unreachable = computed(() => {
  const c = counts.value
  if (props.channel === 'whatsapp') return c.no_phone
  if (props.channel === 'email') return c.no_email
  return c.no_account
})

const costText = computed(() => {
  const c = props.preview.cost
  const cost = new Intl.NumberFormat(locale.value === 'en' ? 'en-GB' : 'es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(c.cost_usd ?? 0)
  const remaining = shownRemaining(c.remaining)
  // Plan ilimitado o gira sin suscripción: no hay "te quedan".
  if (remaining === null) return t('notices.costNoLimit', { count: c.whatsapp, cost })
  return t('notices.cost', { count: c.whatsapp, cost, remaining })
})

const blank = computed(() => new Set(blankRequiredTexts(props.drafts)))
</script>

<template>
  <div
    class="space-y-4"
    data-test="notice-composer"
  >
    <!-- Canal -->
    <section>
      <p class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase mb-1.5">
        {{ t('notices.fields.channel') }}
      </p>
      <div class="grid grid-cols-3 gap-1.5">
        <button
          v-for="ch in channels"
          :key="ch"
          type="button"
          class="min-h-[44px] lg:min-h-[34px] flex items-center justify-center gap-1.5 px-2 rounded-sm border text-[13px] font-semibold cursor-pointer transition-colors disabled:opacity-50"
          :class="
            ch === channel
              ? `${channelMeta(ch).bgClass} ${channelMeta(ch).colorClass} border-line-2`
              : 'bg-glass text-ink-3 border-line hover:text-ink'
          "
          :aria-pressed="ch === channel"
          :disabled="disabled || channels.length < 2"
          :data-test="`notice-channel-${ch}`"
          @click="ch !== channel && emit('update:channel', ch)"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            v-html="channelMeta(ch).iconPath"
          />
          <span class="truncate">{{ t(`reminders.channels.${ch}`) }}</span>
        </button>
      </div>
      <p
        v-if="channel === 'in_app'"
        class="text-[12px] text-ink-4 mt-1.5"
      >
        {{ t('reminders.channels.inAppHint') }}
      </p>
    </section>

    <!-- Plantilla (WhatsApp) -->
    <section v-if="templates.length > 1">
      <p class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase mb-1.5">
        {{ t('notices.fields.template') }}
      </p>
      <div class="flex flex-col gap-1.5">
        <button
          v-for="tpl in templates"
          :key="tpl.slug"
          type="button"
          class="min-h-[44px] lg:min-h-[34px] flex items-center justify-between gap-2 px-3 rounded-sm border text-left text-[14px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          :class="
            tpl.slug === templateSlug
              ? 'bg-glass-active text-ink border-line-acid'
              : 'bg-glass text-ink-2 border-line hover:text-ink'
          "
          :aria-pressed="tpl.slug === templateSlug"
          :disabled="disabled || !tpl.approved"
          :data-test="`notice-template-${tpl.slug}`"
          @click="tpl.slug !== templateSlug && emit('update:templateSlug', tpl.slug)"
        >
          <span class="truncate">{{ templateLabel(tpl, t, activityTypeName) }}</span>
          <span
            v-if="!tpl.approved"
            class="text-[12px] text-ink-4 flex-shrink-0"
          >{{ t('notices.templateNotApproved') }}</span>
        </button>
      </div>
    </section>

    <!-- Textos editables (D14) -->
    <section
      v-if="preview.editable_keys.length"
      class="space-y-2.5"
    >
      <label
        v-for="k in preview.editable_keys"
        :key="k.key"
        class="block"
      >
        <span class="flex items-center justify-between text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase mb-1">
          <span>{{ editableKeyLabel(k.key, t) }}</span>
          <span class="font-normal normal-case tracking-normal text-ink-4">
            {{ value(k.key, k.value).length }}/{{ k.max_length }}
          </span>
        </span>
        <textarea
          v-if="isLong(k.max_length)"
          :value="value(k.key, k.value)"
          :maxlength="k.max_length"
          rows="4"
          class="w-full px-2.5 py-2 rounded-sm bg-bg-2 border border-line text-[15px] text-ink outline-none focus:border-line-acid resize-y"
          :disabled="disabled"
          :data-test="`notice-field-${k.key}`"
          @input="emit('update:draft', k.key, ($event.target as HTMLTextAreaElement).value)"
        />
        <input
          v-else
          type="text"
          :value="value(k.key, k.value)"
          :maxlength="k.max_length"
          class="w-full h-11 lg:h-9 px-2.5 rounded-sm bg-bg-2 border border-line text-[15px] text-ink outline-none focus:border-line-acid"
          :disabled="disabled"
          :data-test="`notice-field-${k.key}`"
          @input="emit('update:draft', k.key, ($event.target as HTMLInputElement).value)"
        >
        <span
          v-if="blank.has(k.key)"
          class="block text-[13px] text-brand-orange mt-1"
          :data-test="`notice-field-blank-${k.key}`"
        >{{ t('notices.fields.blank') }}</span>
      </label>
      <p
        v-if="channel === 'whatsapp'"
        class="text-[12px] text-ink-4"
      >
        {{ t('notices.whatsappHint') }}
      </p>
    </section>

    <!-- Destinatarios -->
    <section>
      <div class="flex items-baseline justify-between gap-2 mb-1.5">
        <p class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase">
          {{ t('notices.recipients.title') }}
        </p>
        <p
          class="text-[13px] text-ink-2"
          data-test="notice-reach"
        >
          {{ t('notices.recipients.reach', { reachable: counts.reachable, total: counts.total }) }}
        </p>
      </div>
      <p
        v-if="unreachable > 0"
        class="text-[13px] text-brand-orange mb-1.5"
        data-test="notice-unreachable"
      >
        {{ t(`notices.recipients.unreachable.${channel}`, { n: unreachable }, unreachable) }}
      </p>
      <NoticeRecipientsEditor
        :people="preview.people"
        :selection="selection"
        :tour-uuid="tourUuid"
        :channel="channel"
        :disabled="disabled"
        @update:selection="(s) => emit('update:selection', s)"
      />
    </section>

    <!-- Vista previa -->
    <section>
      <p class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase mb-1.5">
        {{ t('notices.urgent.preview') }}
      </p>
      <div
        class="bg-glass border border-line rounded-sm p-3 transition-opacity"
        :class="refreshing ? 'opacity-60' : ''"
        data-test="notice-preview"
      >
        <template v-if="rendered">
          <p class="text-[15px] font-semibold text-ink mb-1 break-words">
            {{ rendered.title }}
          </p>
          <p class="text-[14px] text-ink-2 whitespace-pre-line break-words">
            {{ rendered.body }}
          </p>
        </template>
        <dl
          v-else-if="variables.length"
          class="space-y-1"
        >
          <div
            v-for="v in variables"
            :key="v.key"
            class="text-[14px] break-words"
          >
            <dt
              v-if="v.label"
              class="inline text-ink-4"
            >
              {{ v.label }}:
            </dt>
            <dd class="inline text-ink ml-0">
              {{ v.value }}
            </dd>
          </div>
        </dl>
        <p
          v-else
          class="text-[13px] text-ink-4"
        >
          {{ t('notices.noPreview') }}
        </p>
      </div>
    </section>

    <!-- Coste (WhatsApp) -->
    <section v-if="channel === 'whatsapp'">
      <p
        class="text-[13px] text-ink-2"
        data-test="notice-cost"
      >
        {{ costText }}
      </p>
      <p
        v-if="preview.cost.over_quota"
        class="text-[13px] text-brand-orange mt-1"
        data-test="notice-over-quota"
      >
        {{ t('notices.overQuota') }}
      </p>
    </section>
  </div>
</template>
