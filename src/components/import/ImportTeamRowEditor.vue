<script setup lang="ts">
// Editor de una fila del equipo (F1 §4.2): nombre, apellidos, empresa, teléfono, email, rol,
// "en el grupo" y "Dar por buena". Solo manda los campos cambiados, en un único PATCH.
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import type { ContactRole } from '@/composables/useContactRoles'
import type { ImportRowFields, ImportTeamRowPatch, ImportTeamRow } from '@/composables/useImportJobs'
import { rowDisplayName } from '@/utils/importReview'

const props = withDefaults(
  defineProps<{ row: ImportTeamRow; roles?: ContactRole[]; saving?: boolean; error?: string }>(),
  { roles: () => [], saving: false, error: '' }
)
const emit = defineEmits<{ patch: [patch: ImportTeamRowPatch]; close: [] }>()

const { t } = useI18n()

type Form = Pick<
  ImportRowFields,
  'first_name' | 'last_name' | 'company' | 'phone' | 'email' | 'role_uuid' | 'in_group'
>

function fromRow(r: ImportTeamRow): Form {
  return {
    first_name: r.first_name ?? '',
    last_name: r.last_name ?? '',
    company: r.company ?? '',
    phone: r.phone || r.phone_raw || '',
    email: r.email ?? '',
    role_uuid: r.role_uuid ?? '',
    in_group: r.in_group,
  }
}

const form = reactive<Form>(fromRow(props.row))

// La respuesta del PATCH sustituye la fila (teléfono normalizado, issues...): el formulario
// vuelve a partir de ella. Se compara por valor: un PATCH de otra fila también sustituye el job
// (y este objeto) y no debe borrar lo que se está escribiendo aquí.
watch(
  () => JSON.stringify([props.row.client_id, fromRow(props.row)]),
  () => Object.assign(form, fromRow(props.row))
)

const changed = computed<Partial<ImportRowFields>>(() => {
  const base = fromRow(props.row)
  const out: Partial<ImportRowFields> = {}
  for (const key of Object.keys(base) as (keyof Form)[]) {
    const value = typeof form[key] === 'string' ? (form[key] as string).trim() : form[key]
    if (value !== base[key]) (out as Record<string, unknown>)[key] = value
  }
  // El servidor ignora `in_group` si ya está en el grupo; no se manda.
  if (props.row.already_in_group) delete out.in_group
  return out
})
const dirty = computed(() => Object.keys(changed.value).length > 0)
const showReviewed = computed(() => props.row.needs_action && props.row.action !== 'skip')

function save(reviewed = false) {
  const patch: ImportTeamRowPatch = { client_id: props.row.client_id }
  if (dirty.value) patch.fields = { ...changed.value }
  if (reviewed) patch.reviewed = true
  if (!patch.fields && !patch.reviewed) return
  emit('patch', patch)
}

const sourceText = computed(() => {
  const s = props.row.source_ref
  if (!s) return ''
  return t('importer.editor.source', { file: s.filename || t('importer.pastedText'), row: s.row })
})

const INPUT =
  'w-full min-h-[44px] lg:min-h-[36px] rounded-sm border border-line-2 bg-bg-3 px-3 text-[15px] lg:text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50'
const LABEL = 'flex flex-col gap-1 text-[13px] font-medium text-ink-2'
</script>

<template>
  <form
    class="flex flex-col gap-3"
    data-test="import-row-editor"
    @submit.prevent="save(false)"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-[15px] font-semibold text-ink truncate">
          {{ t('importer.editor.title') }} · {{ rowDisplayName(row) }}
        </p>
        <p
          v-if="sourceText"
          class="text-[12px] text-ink-2"
        >
          {{ sourceText }}
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label :class="LABEL">
        {{ t('importer.editor.firstName') }}
        <input
          v-model="form.first_name"
          type="text"
          :class="INPUT"
          autocomplete="off"
          data-test="editor-first-name"
        >
      </label>
      <label :class="LABEL">
        {{ t('importer.editor.lastName') }}
        <input
          v-model="form.last_name"
          type="text"
          :class="INPUT"
          autocomplete="off"
          data-test="editor-last-name"
        >
      </label>
      <label :class="LABEL">
        {{ t('importer.editor.company') }}
        <input
          v-model="form.company"
          type="text"
          :class="INPUT"
          autocomplete="off"
          data-test="editor-company"
        >
      </label>
      <label :class="LABEL">
        {{ t('importer.editor.role') }}
        <select
          v-model="form.role_uuid"
          :class="INPUT"
          :disabled="!roles.length"
          data-test="editor-role"
        >
          <option
            v-if="!row.role_uuid"
            value=""
          >
            {{ t('importer.editor.noRole') }}
          </option>
          <option
            v-if="row.role_uuid && !roles.some((r) => r.uuid === row.role_uuid)"
            :value="row.role_uuid"
          >
            {{ row.role_name || row.role_text }}
          </option>
          <option
            v-for="role in roles"
            :key="role.uuid"
            :value="role.uuid"
          >
            {{ role.name }}
          </option>
        </select>
      </label>
      <label :class="LABEL">
        {{ t('importer.editor.phone') }}
        <input
          v-model="form.phone"
          type="tel"
          inputmode="tel"
          :class="[INPUT, 'font-time tnum']"
          autocomplete="off"
          data-test="editor-phone"
        >
        <span
          v-if="row.phone_raw && row.phone_raw !== row.phone"
          class="text-[12px] text-ink-2 font-normal"
        >
          {{ t('importer.editor.phoneRead', { raw: row.phone_raw }) }}
        </span>
      </label>
      <label :class="LABEL">
        {{ t('importer.editor.email') }}
        <input
          v-model="form.email"
          type="email"
          inputmode="email"
          :class="INPUT"
          autocomplete="off"
          data-test="editor-email"
        >
      </label>
    </div>

    <label class="flex items-center gap-2 min-h-[44px] lg:min-h-0 text-[14px] text-ink cursor-pointer">
      <input
        v-model="form.in_group"
        type="checkbox"
        class="w-4 h-4 accent-[var(--olive)]"
        :disabled="row.already_in_group"
        data-test="editor-in-group"
      >
      {{ row.already_in_group ? t('importer.editor.inGroupLocked') : t('importer.editor.inGroup') }}
    </label>

    <ul
      v-if="row.issues.length"
      class="flex flex-col gap-0.5"
    >
      <li
        v-for="issue in row.issues"
        :key="issue"
        class="text-[13px] text-ink-2"
      >
        {{ t(`importer.issues.${issue}`, { name: row.match?.contact_name ?? '' }) }}
      </li>
    </ul>

    <p
      v-if="error"
      class="text-[13px] text-failed-fg"
      role="alert"
      data-test="editor-error"
    >
      {{ error }}
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <BtnPrimary
        v-if="showReviewed"
        type="button"
        small
        class="disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="saving"
        data-test="editor-save-reviewed"
        @click="save(true)"
      >
        {{ dirty ? t('importer.editor.saveReviewed') : t('importer.team.markReviewed') }}
      </BtnPrimary>
      <component
        :is="showReviewed ? BtnSecondary : BtnPrimary"
        type="submit"
        small
        class="disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="saving || !dirty"
        data-test="editor-save"
      >
        {{ t('importer.editor.save') }}
      </component>
      <BtnSecondary
        type="button"
        small
        data-test="editor-close"
        @click="emit('close')"
      >
        {{ t('importer.editor.close') }}
      </BtnSecondary>
      <span
        v-if="saving"
        class="text-[13px] text-ink-2"
        role="status"
      >{{ t('importer.team.saving') }}</span>
    </div>
  </form>
</template>
