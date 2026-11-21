<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import RulePreviewPanel from './RulePreviewPanel.vue'
import {
  RULE_TRIGGERS,
  RuleApiError,
  useNotificationRules,
  type Rule,
  type RuleChannel,
  type RuleGroupOption,
  type RuleOptions,
  type RulePreviewDraft,
  type RuleRecipientsType,
  type RuleTemplateOption,
  type RuleTrigger,
  type RuleWrite,
} from '@/composables/useNotificationRules'
import {
  allowedChannels,
  allowedRecipientTypes,
  compatibleTemplates,
  defaultOffset,
  formatOffset,
  hasApprovedTemplate,
  isRecommendedTemplate,
  offsetLimits,
  offsetToParts,
  partsToOffset,
  ruleErrorLabel,
  ruleSummary,
  type OffsetUnit,
} from '@/utils/notificationRules'

/**
 * Constructor encadenado de una regla (spec 3.6, C5.3):
 * Cuando… → Avisar a… → Por… → Con… → Antelación… → Nombre.
 * Cada paso se habilita cuando el anterior es válido; al cambiar uno se limpian los valores
 * dependientes que ya no valen.
 */
const props = defineProps<{
  tourUuid: string
  options: RuleOptions
  /** Regla a editar; `null` para crear. */
  rule?: Rule | null
}>()
const emit = defineEmits<{
  saved: [rule: Rule]
  cancel: []
}>()

const { t } = useI18n()
const api = useNotificationRules()

type Step = 'when' | 'notify' | 'via' | 'with' | 'offset' | 'name'

const NAME_MAX = 255
const UNITS: OffsetUnit[] = ['minutes', 'hours', 'days']

// ─── Estado del formulario ────────────────────────────────────────────────────

const initial = props.rule
const initialParts = offsetToParts(initial?.offset_minutes ?? 0)

const trigger = ref<RuleTrigger | ''>((initial?.trigger as RuleTrigger) ?? '')
const codes = ref<string[]>([...(initial?.activity_type_codes ?? [])])
const replaces = ref<boolean>(initial?.replaces_default_reminders ?? false)
/** Al editar, o si el usuario toca la casilla, deja de recalcularse el valor por defecto. */
const replacesTouched = ref<boolean>(!!initial)
const recipientsType = ref<RuleRecipientsType | ''>(
  (initial?.recipients_type as RuleRecipientsType) ?? ''
)
const group = ref<string>(initial?.group ?? '')
const channel = ref<RuleChannel | ''>((initial?.channel as RuleChannel) ?? '')
const template = ref<string>(initial?.template ?? '')
const offsetValue = ref<number>(initialParts.value)
const offsetUnit = ref<OffsetUnit>(initialParts.unit)
const name = ref<string>(initial?.name ?? '')
const description = ref<string>(initial?.description ?? '')
const nameTouched = ref<boolean>(!!initial)

const saving = ref(false)
const generalError = ref('')
const fieldErrors = ref<Partial<Record<string, string>>>({})
const previewDraft = ref<RulePreviewDraft | null>(null)

const isUnconfirmed = computed(() => trigger.value === 'notification_unconfirmed')
const isImmediate = computed(
  () => trigger.value === 'activity_created' || trigger.value === 'activity_updated'
)

// ─── Opciones derivadas ───────────────────────────────────────────────────────

function triggerOption(code: string) {
  return props.options.triggers.find((tr) => tr.code === code)
}

/** Disparadores del catálogo; si el catálogo no los trae, los 4 del editor. */
const triggerChoices = computed<RuleTrigger[]>(() =>
  props.options.triggers.length ? props.options.triggers.map((tr) => tr.code) : RULE_TRIGGERS
)

const recipientChoices = computed<RuleRecipientsType[]>(() => {
  if (!trigger.value) return []
  const allowed = allowedRecipientTypes(trigger.value)
  const fromCatalog = triggerOption(trigger.value)?.recipients_types
  return fromCatalog ? allowed.filter((r) => fromCatalog.includes(r)) : allowed
})

/**
 * Grupo y plantilla guardados que no están en el catálogo del usuario (los eligió otro admin):
 * se ofrecen como opción "actual" para no invalidar la regla al editarla.
 */
const foreignGroup = computed<RuleGroupOption | null>(() => {
  if (!initial?.group || props.options.groups.some((g) => g.uuid === initial.group)) return null
  return {
    uuid: initial.group,
    name: initial.group_name ?? initial.group,
    tour: props.tourUuid,
    contact_count: initial.group_contact_count ?? 0,
  }
})

const foreignTemplate = computed<RuleTemplateOption | null>(() => {
  if (!initial?.template) return null
  if (props.options.templates.some((x) => x.uuid === initial.template)) return null
  return {
    uuid: initial.template,
    name: initial.template_name ?? initial.template,
    slug: '',
    channel: initial.channel as RuleChannel,
    notification_type: '',
    is_system: !!initial.template_is_system,
    approved: true,
    compatible_triggers: [initial.trigger as RuleTrigger],
    recommended_for: [],
  }
})

/** La plantilla ajena sigue valiendo mientras no cambien el disparador ni el canal. */
const foreignTemplateApplies = computed(
  () =>
    !!foreignTemplate.value &&
    trigger.value === initial?.trigger &&
    channel.value === initial?.channel
)

const tourGroups = computed<RuleGroupOption[]>(() => {
  const list = props.options.groups.filter(
    (g) => g.tour === null || g.tour === props.tourUuid
  )
  return foreignGroup.value ? [foreignGroup.value, ...list] : list
})

const defaultGroup = computed(() => props.options.tour.default_group)

const channelChoices = computed(() => {
  if (!trigger.value) return []
  const allowed = allowedChannels(trigger.value, recipientsType.value || null)
  const fromCatalog = triggerOption(trigger.value)?.channels
  return allowed
    .filter((c) => !fromCatalog || fromCatalog.includes(c))
    .map((c) => ({
      code: c,
      // WhatsApp solo con una plantilla aprobada compatible (en `unconfirmed` se reenvía la original).
      disabled:
        c === 'whatsapp' &&
        !isUnconfirmed.value &&
        !hasApprovedTemplate(props.options, trigger.value, c, codes.value) &&
        !(foreignTemplate.value && initial?.channel === c && trigger.value === initial?.trigger),
    }))
})

const whatsappBlocked = computed(() =>
  channelChoices.value.some((c) => c.code === 'whatsapp' && c.disabled)
)

const templateChoices = computed<RuleTemplateOption[]>(() => {
  if (!trigger.value || !channel.value || isUnconfirmed.value) return []
  const list = compatibleTemplates(props.options, trigger.value, channel.value, codes.value)
  return foreignTemplateApplies.value && foreignTemplate.value
    ? [foreignTemplate.value, ...list]
    : list
})

function isCurrentForeign(uuid: string) {
  return !!foreignTemplate.value && foreignTemplate.value.uuid === uuid
}

function templateSelectable(tpl: RuleTemplateOption) {
  return tpl.channel !== 'whatsapp' || tpl.approved
}

const limits = computed(() => offsetLimits(trigger.value, props.options))

const offsetMinutes = computed(() =>
  isImmediate.value ? 0 : partsToOffset({ value: offsetValue.value, unit: offsetUnit.value })
)

const selectedTypes = computed(() =>
  props.options.activity_types.filter((at) => codes.value.includes(at.code))
)

/** La casilla de sustituir solo tiene sentido si algún tipo afectado tiene recordatorios. */
const showReplaces = computed(() => {
  if (trigger.value !== 'activity_upcoming') return false
  const types = codes.value.length ? selectedTypes.value : props.options.activity_types
  return types.some((at) => at.has_default_reminders)
})

const selectedGroup = computed(() => tourGroups.value.find((g) => g.uuid === group.value))

// ─── Validez por paso ─────────────────────────────────────────────────────────

const whenValid = computed(() => !!trigger.value)
const notifyValid = computed(() => {
  if (!whenValid.value) return false
  if (isUnconfirmed.value) return true
  if (!recipientsType.value || !recipientChoices.value.includes(recipientsType.value)) return false
  return recipientsType.value !== 'group' || !!group.value
})
const viaValid = computed(
  () =>
    notifyValid.value &&
    !!channel.value &&
    channelChoices.value.some((c) => c.code === channel.value && !c.disabled)
)
const withValid = computed(() => {
  if (!viaValid.value) return false
  if (isUnconfirmed.value) return true
  const tpl = templateChoices.value.find((x) => x.uuid === template.value)
  return !!tpl && templateSelectable(tpl)
})
const offsetValid = computed(() => {
  if (!withValid.value) return false
  if (isImmediate.value) return true
  const m = offsetMinutes.value
  return Number.isFinite(m) && m >= limits.value.min && m <= limits.value.max
})
const nameValid = computed(() => !!name.value.trim() && name.value.length <= NAME_MAX)
const canSave = computed(() => offsetValid.value && nameValid.value && !saving.value)

// ─── Limpieza de dependientes ─────────────────────────────────────────────────

function normalize() {
  if (recipientsType.value && !recipientChoices.value.includes(recipientsType.value)) {
    recipientsType.value = ''
  }
  if (recipientsType.value !== 'group') group.value = ''
  if (
    channel.value &&
    !channelChoices.value.some((c) => c.code === channel.value && !c.disabled)
  ) {
    channel.value = ''
  }
  if (isUnconfirmed.value) {
    template.value = ''
  } else if (template.value) {
    const tpl = templateChoices.value.find((x) => x.uuid === template.value)
    if (!tpl || !templateSelectable(tpl)) template.value = ''
  }
}

watch(trigger, (next, prev) => {
  if (next === 'notification_unconfirmed') {
    recipientsType.value = 'original_recipients'
    channel.value = 'whatsapp'
  } else if (prev === 'notification_unconfirmed') {
    recipientsType.value = ''
    channel.value = ''
  }
  const parts = offsetToParts(defaultOffset(next))
  offsetValue.value = parts.value
  offsetUnit.value = parts.unit
  normalize()
})
watch([codes, recipientsType, channel], normalize, { deep: true })

/**
 * Valor por defecto de "sustituir recordatorios" (decisión de la sesión principal, review 3.6):
 * marcada solo con tipos elegidos explícitamente y canal WhatsApp, el mismo que los
 * recordatorios por defecto. Con "Todos los tipos" o email/in_app, desmarcada.
 */
const replacesDefault = computed(
  () =>
    trigger.value === 'activity_upcoming' && codes.value.length > 0 && channel.value === 'whatsapp'
)
watch(replacesDefault, (v) => {
  if (!replacesTouched.value) replaces.value = v
})

/** Tipos cuyos recordatorios por defecto sustituiría la regla. */
const replacedTypes = computed(() =>
  (codes.value.length ? selectedTypes.value : props.options.activity_types).filter(
    (at) => at.has_default_reminders
  )
)

const replacesHint = computed(() => {
  const n = replacedTypes.value.length
  return t(
    'rules.builder.replacesHint',
    { count: n, types: replacedTypes.value.map((at) => at.name).join(', ') },
    n
  )
})

// ─── Nombre prerrellenado con la frase ────────────────────────────────────────

const draftSummary = computed(() => {
  if (!trigger.value) return ''
  const tpl = props.options.templates.find((x) => x.uuid === template.value)
  return ruleSummary(
    {
      trigger: trigger.value,
      activity_type_codes: codes.value,
      recipients_type: recipientsType.value,
      group_name: selectedGroup.value?.name ?? null,
      channel: channel.value,
      template_name: tpl?.name ?? null,
      offset_minutes: offsetMinutes.value,
    },
    props.options,
    t
  ).slice(0, NAME_MAX)
})

watch(draftSummary, (s) => {
  if (!nameTouched.value) name.value = s
})

function onNameInput() {
  nameTouched.value = true
}

// ─── Acciones ─────────────────────────────────────────────────────────────────

function toggleCode(code: string) {
  codes.value = codes.value.includes(code)
    ? codes.value.filter((c) => c !== code)
    : [...codes.value, code]
}

function buildPayload(): RuleWrite {
  return {
    name: name.value.trim(),
    description: description.value.trim(),
    tour: props.tourUuid,
    trigger: trigger.value as RuleTrigger,
    activity_type_codes: [...codes.value],
    recipients_type: recipientsType.value as RuleRecipientsType,
    group: recipientsType.value === 'group' ? group.value || null : null,
    channel: channel.value as RuleChannel,
    template: isUnconfirmed.value ? null : template.value || null,
    offset_minutes: offsetMinutes.value,
    replaces_default_reminders: showReplaces.value && replaces.value,
  }
}

function openPreview() {
  if (!offsetValid.value) return
  previewDraft.value = {
    ...buildPayload(),
    name: name.value.trim() || draftSummary.value,
    // Al editar, sus propias notificaciones no cuentan como solape.
    ...(props.rule ? { rule: props.rule.uuid } : {}),
  }
}

const STEP_OF_FIELD: Record<string, Step> = {
  trigger: 'when',
  activity_type_codes: 'when',
  replaces_default_reminders: 'when',
  recipients_type: 'notify',
  group: 'notify',
  channel: 'via',
  template: 'with',
  offset_minutes: 'offset',
  name: 'name',
  description: 'name',
}

const stepErrors = computed(() => {
  const out: Partial<Record<Step, string[]>> = {}
  for (const [field, msg] of Object.entries(fieldErrors.value)) {
    const step = STEP_OF_FIELD[field]
    if (!step || !msg) continue
    ;(out[step] ??= []).push(msg)
  }
  return out
})

function applyError(e: unknown) {
  fieldErrors.value = {}
  generalError.value = ''
  if (e instanceof RuleApiError) {
    const fields = Object.keys(e.fieldErrors)
    const codeLabel = ruleErrorLabel(e.code, t)
    const errs: Record<string, string> = {}
    for (const f of fields) {
      // El `code` es de un solo campo: se traduce cuando no hay ambigüedad.
      errs[f] = (fields.length === 1 && codeLabel) || e.fieldMessage(f) || e.message
    }
    fieldErrors.value = errs
    const unmapped = fields.filter((f) => !STEP_OF_FIELD[f])
    if (unmapped.length || !fields.length) {
      generalError.value = unmapped.map((f) => errs[f]).join(' ') || codeLabel || e.message
    }
    return
  }
  generalError.value = e instanceof Error ? e.message : t('rules.builder.saveError')
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  fieldErrors.value = {}
  generalError.value = ''
  try {
    const payload = buildPayload()
    let saved: Rule
    if (props.rule) {
      // `tour` es inmutable: no se manda en el PATCH.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tour: _tour, ...update } = payload
      saved = await api.updateRule(props.rule.uuid, update)
    } else {
      saved = await api.createRule(payload)
    }
    emit('saved', saved)
  } catch (e) {
    applyError(e)
  } finally {
    saving.value = false
  }
}

// ─── Etiquetas ────────────────────────────────────────────────────────────────

const CHANNEL_ACTIVE: Record<RuleChannel, string> = {
  whatsapp: 'border-wa-green text-wa-green bg-wa-green-dim',
  email: 'border-brand-blue text-brand-blue bg-brand-blue-dim',
  in_app: 'border-line-acid text-acid bg-acid-dim',
}

const offsetDirectionLabel = computed(() =>
  limits.value.direction === 'after' ? t('rules.builder.after') : t('rules.builder.before')
)

const offsetRangeLabel = computed(() =>
  t('rules.builder.offsetRange', {
    min: formatOffset(limits.value.min, t),
    max: formatOffset(limits.value.max, t),
  })
)

function shortIcon(icon: string) {
  return icon && [...icon].length <= 2 ? icon : ''
}
</script>

<template>
  <div
    class="space-y-4"
    data-test="rule-builder"
  >
    <h3 class="text-[14px] font-bold text-ink tracking-[-0.2px]">
      {{ rule ? t('rules.editRule') : t('rules.newRule') }}
    </h3>

    <!-- 1. Cuando… -->
    <fieldset
      class="space-y-2 border-none p-0 m-0"
      data-test="step-when"
    >
      <legend class="text-[10px] font-bold text-ink-3 tracking-[0.5px] uppercase mb-1.5">
        1 · {{ t('rules.builder.when') }}
      </legend>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <button
          v-for="code in triggerChoices"
          :key="code"
          type="button"
          class="text-left rounded-sm border px-2.5 py-2 cursor-pointer transition-colors"
          :class="
            trigger === code
              ? 'border-line-acid bg-acid-dim'
              : 'border-line bg-glass hover:bg-glass-hover'
          "
          :aria-pressed="trigger === code"
          :data-test="`trigger-${code}`"
          @click="trigger = code"
        >
          <span
            class="block text-[12px] font-semibold"
            :class="trigger === code ? 'text-acid' : 'text-ink'"
          >{{ t(`rules.triggers.${code}`) }}</span>
          <span class="block text-[10px] text-ink-3 mt-0.5">{{
            t(`rules.triggerHints.${code}`)
          }}</span>
        </button>
      </div>

      <div
        v-if="trigger"
        class="flex flex-wrap gap-1.5 pt-1"
        data-test="type-chips"
      >
        <button
          type="button"
          class="text-[11px] px-2 py-1 rounded-full border cursor-pointer"
          :class="
            !codes.length ? 'border-line-acid text-acid bg-acid-dim' : 'border-line text-ink-3 bg-glass'
          "
          data-test="type-all"
          @click="codes = []"
        >
          {{ t('rules.builder.allTypes') }}
        </button>
        <button
          v-for="at in options.activity_types"
          :key="at.code"
          type="button"
          class="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border cursor-pointer"
          :class="
            codes.includes(at.code)
              ? 'border-line-acid text-ink bg-acid-dim'
              : 'border-line text-ink-3 bg-glass'
          "
          :aria-pressed="codes.includes(at.code)"
          :data-test="`type-${at.code}`"
          @click="toggleCode(at.code)"
        >
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{ background: at.color }"
          />
          <span v-if="shortIcon(at.icon)">{{ shortIcon(at.icon) }}</span>
          {{ at.name }}
        </button>
      </div>

      <label
        v-if="showReplaces"
        class="flex items-start gap-2 pt-1 cursor-pointer"
        data-test="replaces"
      >
        <input
          v-model="replaces"
          type="checkbox"
          class="mt-0.5 accent-[var(--acid)]"
          @change="replacesTouched = true"
        >
        <span>
          <span class="block text-[12px] text-ink">{{ t('rules.builder.replaces') }}</span>
          <span class="block text-[10px] text-ink-3">{{ t('rules.builder.replacesHelp') }}</span>
          <span
            class="block text-[10px] text-ink-2 mt-0.5"
            data-test="replaces-hint"
          >{{ replacesHint }}</span>
        </span>
      </label>
      <p
        v-for="msg in stepErrors.when"
        :key="msg"
        class="text-[11px] text-red-400"
        data-test="error-when"
      >
        {{ msg }}
      </p>
    </fieldset>

    <!-- 2. Avisar a… -->
    <fieldset
      class="space-y-2 border-none p-0 m-0"
      :class="whenValid ? '' : 'opacity-50'"
      :disabled="!whenValid"
      data-test="step-notify"
    >
      <legend class="text-[10px] font-bold text-ink-3 tracking-[0.5px] uppercase mb-1.5">
        2 · {{ t('rules.builder.notify') }}
      </legend>
      <p
        v-if="isUnconfirmed"
        class="text-[12px] text-ink-2"
        data-test="original-recipients"
      >
        {{
          t('rules.builder.originalRecipients', {
            max: options.limits.max_reminders_per_recipient,
          })
        }}
      </p>
      <template v-else-if="whenValid">
        <div class="flex flex-col gap-1">
          <label
            v-for="r in recipientChoices"
            :key="r"
            class="flex items-center gap-2 text-[12px] text-ink cursor-pointer"
          >
            <input
              v-model="recipientsType"
              type="radio"
              name="rule-recipients"
              :value="r"
              class="accent-[var(--acid)]"
              :data-test="`recipients-${r}`"
            >
            {{ t(`rules.recipients.${r}`) }}
          </label>
        </div>

        <div v-if="recipientsType === 'group'">
          <p
            v-if="!tourGroups.length"
            class="text-[11px] text-brand-orange"
          >
            {{ t('rules.builder.noGroups') }}
          </p>
          <select
            v-else
            v-model="group"
            class="w-full bg-bg-4 border border-line rounded-sm px-2 py-1.5 text-[12px] text-ink"
            data-test="group-select"
          >
            <option value="">
              {{ t('rules.builder.pickGroup') }}
            </option>
            <option
              v-for="g in tourGroups"
              :key="g.uuid"
              :value="g.uuid"
            >
              {{ g.name }} ({{ t('rules.builder.groupContacts', g.contact_count) }})
            </option>
          </select>
          <p
            v-if="selectedGroup && selectedGroup.contact_count === 0"
            class="text-[11px] text-brand-orange mt-1"
          >
            {{ t('rules.builder.groupEmpty') }}
          </p>
        </div>

        <div
          v-if="recipientsType === 'default_group'"
          class="text-[11px]"
        >
          <p
            v-if="defaultGroup"
            class="text-ink-3"
          >
            {{
              t('rules.builder.defaultGroupName', {
                name: defaultGroup.name,
                contacts: t('rules.builder.groupContacts', defaultGroup.contact_count),
              })
            }}
          </p>
          <p
            v-else
            class="text-brand-orange"
            data-test="default-group-missing"
          >
            {{ t('rules.builder.defaultGroupMissing') }}
            <RouterLink
              :to="{ path: '/settings', query: { tab: 'groups' } }"
              class="text-acid underline ml-1"
            >
              {{ t('rules.builder.goToGroups') }}
            </RouterLink>
          </p>
        </div>
      </template>
      <p
        v-for="msg in stepErrors.notify"
        :key="msg"
        class="text-[11px] text-red-400"
        data-test="error-notify"
      >
        {{ msg }}
      </p>
    </fieldset>

    <!-- 3. Por… -->
    <fieldset
      class="space-y-2 border-none p-0 m-0"
      :class="notifyValid ? '' : 'opacity-50'"
      :disabled="!notifyValid"
      data-test="step-via"
    >
      <legend class="text-[10px] font-bold text-ink-3 tracking-[0.5px] uppercase mb-1.5">
        3 · {{ t('rules.builder.via') }}
      </legend>
      <div
        v-if="notifyValid"
        class="flex flex-wrap gap-1.5"
      >
        <button
          v-for="c in channelChoices"
          :key="c.code"
          type="button"
          class="text-[12px] font-semibold px-3 py-1.5 rounded-sm border transition-colors"
          :class="[
            channel === c.code ? CHANNEL_ACTIVE[c.code] : 'border-line text-ink-2 bg-glass',
            c.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
          ]"
          :disabled="c.disabled"
          :aria-pressed="channel === c.code"
          :data-test="`channel-${c.code}`"
          @click="channel = c.code"
        >
          {{ t(`rules.channels.${c.code}`) }}
        </button>
      </div>
      <p
        v-if="notifyValid && whatsappBlocked"
        class="text-[11px] text-brand-orange"
        data-test="no-approved-whatsapp"
      >
        {{ t('rules.builder.noApprovedWhatsapp') }}
      </p>
      <p
        v-for="msg in stepErrors.via"
        :key="msg"
        class="text-[11px] text-red-400"
        data-test="error-via"
      >
        {{ msg }}
      </p>
    </fieldset>

    <!-- 4. Con… -->
    <fieldset
      class="space-y-2 border-none p-0 m-0"
      :class="viaValid ? '' : 'opacity-50'"
      :disabled="!viaValid"
      data-test="step-with"
    >
      <legend class="text-[10px] font-bold text-ink-3 tracking-[0.5px] uppercase mb-1.5">
        4 · {{ t('rules.builder.with') }}
      </legend>
      <p
        v-if="isUnconfirmed"
        class="text-[12px] text-ink-2"
        data-test="same-template"
      >
        {{ t('rules.builder.sameTemplate') }}
      </p>
      <template v-else-if="viaValid">
        <p
          v-if="!templateChoices.length"
          class="text-[11px] text-brand-orange"
        >
          {{ t('rules.builder.noTemplates') }}
        </p>
        <div
          v-else
          class="flex flex-col gap-1"
          data-test="template-list"
        >
          <label
            v-for="tpl in templateChoices"
            :key="tpl.uuid"
            class="flex items-center gap-2 text-[12px] px-2 py-1.5 rounded-sm border"
            :class="[
              template === tpl.uuid ? 'border-line-acid bg-acid-dim' : 'border-line bg-glass',
              templateSelectable(tpl) ? 'cursor-pointer text-ink' : 'opacity-50 text-ink-3',
            ]"
          >
            <input
              v-model="template"
              type="radio"
              name="rule-template"
              :value="tpl.uuid"
              :disabled="!templateSelectable(tpl)"
              class="accent-[var(--acid)]"
              :data-test="`template-${tpl.uuid}`"
            >
            <span class="flex-1 min-w-0 truncate">{{ tpl.name }}</span>
            <span
              v-if="isCurrentForeign(tpl.uuid)"
              class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-glass-2 text-ink-2"
            >{{ t('rules.builder.current') }}</span>
            <span
              v-if="isRecommendedTemplate(tpl, codes)"
              class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-acid-dim text-acid"
            >{{ t('rules.builder.recommended') }}</span>
            <span
              v-if="tpl.is_system"
              class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-glass-2 text-ink-2"
            >{{ t('rules.builder.system') }}</span>
            <span
              v-if="!templateSelectable(tpl)"
              class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-orange-dim text-brand-orange"
            >{{ t('rules.builder.notApproved') }}</span>
          </label>
        </div>
      </template>
      <p
        v-for="msg in stepErrors.with"
        :key="msg"
        class="text-[11px] text-red-400"
        data-test="error-with"
      >
        {{ msg }}
      </p>
    </fieldset>

    <!-- 5. Antelación… -->
    <fieldset
      class="space-y-2 border-none p-0 m-0"
      :class="withValid ? '' : 'opacity-50'"
      :disabled="!withValid"
      data-test="step-offset"
    >
      <legend class="text-[10px] font-bold text-ink-3 tracking-[0.5px] uppercase mb-1.5">
        5 · {{ t('rules.builder.offset') }}
      </legend>
      <p
        v-if="isImmediate"
        class="text-[12px] text-ink-2"
        data-test="offset-immediately"
      >
        {{ t('rules.builder.immediately') }}
      </p>
      <template v-else-if="trigger">
        <div class="flex items-center gap-1.5 flex-wrap">
          <input
            v-model.number="offsetValue"
            type="number"
            min="1"
            class="w-20 bg-bg-4 border border-line rounded-sm px-2 py-1.5 text-[12px] text-ink"
            data-test="offset-value"
          >
          <select
            v-model="offsetUnit"
            class="bg-bg-4 border border-line rounded-sm px-2 py-1.5 text-[12px] text-ink"
            data-test="offset-unit"
          >
            <option
              v-for="u in UNITS"
              :key="u"
              :value="u"
            >
              {{ t(`rules.builder.units.${u}`) }}
            </option>
          </select>
          <span class="text-[12px] text-ink-3">{{ offsetDirectionLabel }}</span>
        </div>
        <p
          class="text-[10px]"
          :class="withValid && !offsetValid ? 'text-red-400' : 'text-ink-4'"
          data-test="offset-range"
        >
          {{ offsetRangeLabel }}
        </p>
      </template>
      <p
        v-for="msg in stepErrors.offset"
        :key="msg"
        class="text-[11px] text-red-400"
        data-test="error-offset"
      >
        {{ msg }}
      </p>
    </fieldset>

    <!-- 6. Nombre y descripción -->
    <fieldset
      class="space-y-2 border-none p-0 m-0"
      data-test="step-name"
    >
      <label class="block">
        <span class="text-[11px] text-ink-3">{{ t('rules.builder.name') }}</span>
        <input
          v-model="name"
          type="text"
          :maxlength="NAME_MAX"
          class="mt-1 w-full bg-bg-4 border border-line rounded-sm px-2 py-1.5 text-[12px] text-ink"
          data-test="rule-name"
          @input="onNameInput"
        >
      </label>
      <label class="block">
        <span class="text-[11px] text-ink-3">{{ t('rules.builder.description') }}</span>
        <textarea
          v-model="description"
          rows="2"
          class="mt-1 w-full bg-bg-4 border border-line rounded-sm px-2 py-1.5 text-[12px] text-ink resize-none"
        />
      </label>
      <p
        v-for="msg in stepErrors.name"
        :key="msg"
        class="text-[11px] text-red-400"
      >
        {{ msg }}
      </p>
    </fieldset>

    <p
      v-if="generalError"
      class="text-[11px] text-red-400"
      data-test="error-general"
    >
      {{ generalError }}
    </p>

    <RulePreviewPanel
      v-if="previewDraft"
      :tour-uuid="tourUuid"
      :draft="previewDraft"
      :trigger="previewDraft.trigger"
      :activity-type-codes="previewDraft.activity_type_codes"
    />

    <div class="flex flex-wrap justify-end gap-2 pt-1">
      <BtnSecondary
        type="button"
        @click="emit('cancel')"
      >
        {{ t('rules.cancel') }}
      </BtnSecondary>
      <BtnSecondary
        type="button"
        :disabled="!offsetValid"
        :class="offsetValid ? '' : 'opacity-50 pointer-events-none'"
        data-test="open-preview"
        @click="openPreview"
      >
        {{ t('rules.builder.preview') }}
      </BtnSecondary>
      <BtnPrimary
        type="button"
        :disabled="!canSave"
        :class="canSave ? '' : 'opacity-50 pointer-events-none'"
        data-test="save-rule"
        @click="save"
      >
        {{ saving ? t('rules.builder.saving') : t('rules.builder.save') }}
      </BtnPrimary>
    </div>
  </div>
</template>
