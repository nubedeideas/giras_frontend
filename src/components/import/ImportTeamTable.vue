<script setup lang="ts">
// Bloque Equipo de la revisión (F1 §4.2). Escritorio (≥ 1024 px): tabla con nombre, teléfono,
// rol, estado, confianza, "en el grupo" y omitir; la fila elegida se despliega con el slot
// `expanded` (editor de la vista). Móvil y `compact` (onboarding): tarjetas, primero
// "Por resolver (n)" y luego "Listas (n)", plegadas mientras quede algo por resolver.
import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ImportMatchResolver from '@/components/import/ImportMatchResolver.vue'
import type { ContactRole } from '@/composables/useContactRoles'
import type { ImportJob, ImportRowPatch, ImportTeamRow } from '@/composables/useImportJobs'
import { useIsMobile } from '@/composables/useIsMobile'
import {
  confidenceTone,
  needsResolver,
  restoreAction,
  rowDisplayName,
  rowStatus,
  rowStatusKey,
  sortRows,
} from '@/utils/importReview'
import { importConfidenceBadge, importRowBadge } from '@/utils/statusBadge'

const props = withDefaults(
  defineProps<{
    job: ImportJob
    compact?: boolean
    roles?: ContactRole[]
    saving: Set<string>
    /** Mensaje ya traducido por `client_id` cuando su último PATCH ha fallado. */
    rowErrors?: Record<string, string>
    /** Solo las filas que piden acción (filtro "por resolver" de la vista). */
    onlyPending?: boolean
    /** Fila desplegada con el slot `expanded` (escritorio). */
    selectedId?: string | null
  }>(),
  { compact: false, roles: () => [], rowErrors: () => ({}), onlyPending: false, selectedId: null }
)
const emit = defineEmits<{ patch: [patch: ImportRowPatch]; edit: [row: ImportTeamRow] }>()
defineSlots<{ expanded?: (props: { row: ImportTeamRow }) => unknown }>()

const { t } = useI18n()
// `compact` siempre pinta tarjetas: no hace falta (ni conviene, en el asistente) mirar el ancho.
const isMobile: Ref<boolean> = props.compact ? ref(true) : useIsMobile().isMobile
const cards = computed(() => props.compact || isMobile.value)

const allRows = computed(() => sortRows(props.job.draft?.team ?? []))
const rows = computed(() =>
  props.onlyPending ? allRows.value.filter((r) => r.needs_action) : allRows.value
)
const pendingRows = computed(() => rows.value.filter((r) => r.needs_action))
const readyRows = computed(() => rows.value.filter((r) => !r.needs_action))

// Plegadas mientras quede algo por resolver; el usuario puede abrirlas.
const readyOpenChoice = ref<boolean | null>(null)
const readyOpen = computed(() => readyOpenChoice.value ?? pendingRows.value.length === 0)

const rolesByUuid = computed(() => new Map(props.roles.map((r) => [r.uuid, r])))

function roleLabel(r: ImportTeamRow): string {
  return r.role_name || (r.role_uuid && rolesByUuid.value.get(r.role_uuid)?.name) || r.role_text || ''
}

function phoneText(r: ImportTeamRow): string {
  return r.phone || r.phone_raw || ''
}

function issueText(r: ImportTeamRow, issue: string): string {
  return t(`importer.issues.${issue}`, { name: r.match?.contact_name ?? '' })
}

function isSaving(r: ImportTeamRow): boolean {
  return props.saving.has(r.client_id)
}

function isSkipped(r: ImportTeamRow): boolean {
  return r.action === 'skip'
}

function toggleSkip(r: ImportTeamRow) {
  emit('patch', { client_id: r.client_id, action: isSkipped(r) ? restoreAction(r) : 'skip' })
}

// "En el grupo": el valor marcado vive aquí mientras su PATCH está en curso. Al terminar se suelta
// y manda la fila: si el PATCH ha fallado, `in_group` no ha cambiado y la casilla vuelve a su valor
// (con solo `:checked` Vue no tocaría el DOM, porque el valor enlazado no cambia).
const pendingInGroup = ref<Record<string, boolean>>({})

function inGroupChecked(r: ImportTeamRow): boolean {
  return r.already_in_group || (pendingInGroup.value[r.client_id] ?? r.in_group)
}

function setInGroup(r: ImportTeamRow, e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  pendingInGroup.value = { ...pendingInGroup.value, [r.client_id]: checked }
  emit('patch', { client_id: r.client_id, fields: { in_group: checked } })
}

watch(
  () => [...props.saving],
  (ids) => {
    const stale = Object.keys(pendingInGroup.value).filter((id) => !ids.includes(id))
    if (!stale.length) return
    const rest = { ...pendingInGroup.value }
    for (const id of stale) delete rest[id]
    pendingInGroup.value = rest
  }
)

function setRole(r: ImportTeamRow, e: Event) {
  const uuid = (e.target as HTMLSelectElement).value
  if (!uuid || uuid === r.role_uuid) return
  emit('patch', { client_id: r.client_id, fields: { role_uuid: uuid } })
}

function markReviewed(r: ImportTeamRow) {
  emit('patch', { client_id: r.client_id, reviewed: true })
}

const LINK_BTN =
  'min-h-[44px] lg:min-h-[32px] px-2 text-[13px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm disabled:opacity-50 disabled:cursor-not-allowed'
const SOFT_BTN =
  'min-h-[44px] lg:min-h-[32px] px-3 rounded-sm border border-line-2 bg-bg-3 text-[13px] font-medium text-ink hover:bg-glass-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50 disabled:cursor-not-allowed'
</script>

<template>
  <div
    class="flex flex-col gap-2"
    data-test="import-team-table"
  >
    <p
      v-if="!rows.length"
      class="text-[14px] text-ink-2 py-4"
      data-test="import-team-empty"
    >
      {{ onlyPending ? t('importer.team.emptyFilter') : t('importer.team.empty') }}
    </p>

    <!-- ─── Tarjetas (móvil y compacto) ─────────────────────────────────────── -->
    <template v-else-if="cards">
      <template
        v-for="section in (['pending', 'ready'] as const)"
        :key="section"
      >
        <template v-if="section === 'pending' ? pendingRows.length : readyRows.length">
          <p
            v-if="section === 'pending'"
            class="text-[14px] font-semibold text-ink"
            data-test="import-section-pending"
          >
            {{ t('importer.team.pending', { n: pendingRows.length }) }}
          </p>
          <button
            v-else
            type="button"
            class="flex items-center justify-between gap-2 min-h-[44px] lg:min-h-[36px] text-left text-[14px] font-semibold text-ink bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
            :aria-expanded="readyOpen"
            data-test="import-section-ready"
            @click="readyOpenChoice = !readyOpen"
          >
            <span>{{ t('importer.team.ready', { n: readyRows.length }) }}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="transition-transform text-ink-2"
              :class="readyOpen ? 'rotate-180' : 'rotate-0'"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <ul
            v-if="section === 'pending' || readyOpen"
            class="flex flex-col gap-2"
          >
            <li
              v-for="r in section === 'pending' ? pendingRows : readyRows"
              :key="r.client_id"
              class="rounded border bg-bg-3 px-3 py-2.5"
              :class="r.needs_action ? 'border-failed-fg' : 'border-line'"
              :data-row="r.client_id"
              :data-needs-action="r.needs_action ? 'true' : 'false'"
            >
              <div class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                  <p
                    class="text-[15px] font-semibold truncate"
                    :class="isSkipped(r) ? 'text-ink-2 line-through' : 'text-ink'"
                  >
                    {{ rowDisplayName(r) }}
                  </p>
                  <p class="text-[13px] text-ink-2 flex flex-wrap gap-x-2">
                    <span
                      v-if="phoneText(r)"
                      class="font-time tnum"
                    >{{ phoneText(r) }}</span>
                    <span v-else>{{ t('importer.team.noPhone') }}</span>
                    <span v-if="roleLabel(r)">{{ roleLabel(r) }}</span>
                  </p>
                </div>
                <StatusBadge
                  v-if="!isSkipped(r)"
                  size="sm"
                  :status="importConfidenceBadge(r.confidence)"
                  :label="t(`importer.confidence.${confidenceTone(r.confidence)}`)"
                  data-test="import-row-confidence"
                />
                <StatusBadge
                  v-else
                  size="sm"
                  status="off"
                  :label="t('importer.status.skipped')"
                />
              </div>

              <p
                v-if="!isSkipped(r)"
                class="text-[13px] text-ink-2 mt-1"
                data-test="import-row-status"
              >
                {{ t(rowStatusKey(r)) }}
              </p>
              <ul
                v-if="!isSkipped(r) && r.issues.length"
                class="mt-1 flex flex-col gap-0.5"
              >
                <li
                  v-for="issue in r.issues"
                  :key="issue"
                  class="text-[13px] text-ink-2"
                >
                  {{ issueText(r, issue) }}
                </li>
              </ul>

              <ImportMatchResolver
                v-if="needsResolver(r)"
                class="mt-2"
                :row="r"
                :saving="isSaving(r)"
                @patch="emit('patch', $event)"
              />

              <label
                v-if="!isSkipped(r)"
                class="flex items-center gap-2 mt-2 min-h-[44px] lg:min-h-[32px] text-[13px] text-ink cursor-pointer"
              >
                <input
                  type="checkbox"
                  class="w-4 h-4 accent-[var(--olive)]"
                  :checked="inGroupChecked(r)"
                  :disabled="r.already_in_group || isSaving(r)"
                  data-test="import-row-ingroup"
                  @change="setInGroup(r, $event)"
                >
                {{ r.already_in_group ? t('importer.editor.inGroupLocked') : t('importer.editor.inGroup') }}
              </label>

              <div class="flex flex-wrap items-center gap-2 mt-1">
                <button
                  v-if="!isSkipped(r) && r.needs_action && !needsResolver(r)"
                  type="button"
                  :class="SOFT_BTN"
                  :disabled="isSaving(r)"
                  data-test="import-row-reviewed"
                  @click="markReviewed(r)"
                >
                  {{ t('importer.team.markReviewed') }}
                </button>
                <button
                  v-if="!compact && !isSkipped(r)"
                  type="button"
                  :class="LINK_BTN"
                  :disabled="isSaving(r)"
                  data-test="import-row-edit"
                  @click="emit('edit', r)"
                >
                  {{ t('importer.team.edit') }}
                </button>
                <button
                  type="button"
                  :class="LINK_BTN"
                  :disabled="isSaving(r)"
                  :data-test="isSkipped(r) ? 'import-row-restore' : 'import-row-skip'"
                  @click="toggleSkip(r)"
                >
                  {{ isSkipped(r) ? t('importer.team.restore') : t('importer.team.skip') }}
                </button>
                <span
                  v-if="isSaving(r)"
                  class="w-3.5 h-3.5 rounded-full border-2 border-line-2 border-t-olive animate-spin"
                  role="status"
                  :aria-label="t('importer.team.saving')"
                />
              </div>
              <p
                v-if="rowErrors[r.client_id]"
                class="text-[13px] text-failed-fg mt-1"
                role="alert"
                data-test="import-row-error"
              >
                {{ rowErrors[r.client_id] }}
              </p>
            </li>
          </ul>
        </template>
      </template>
    </template>

    <!-- ─── Tabla (escritorio) ──────────────────────────────────────────────── -->
    <div
      v-else
      class="overflow-x-auto rounded border border-line bg-bg-3"
    >
      <table class="w-full text-left text-[13px]">
        <thead>
          <tr class="border-b border-line text-[11px] uppercase tracking-[1px] text-ink-2">
            <th class="px-3 py-2 font-bold">
              {{ t('importer.team.name') }}
            </th>
            <th class="px-3 py-2 font-bold">
              {{ t('importer.team.phone') }}
            </th>
            <th class="px-3 py-2 font-bold">
              {{ t('importer.team.role') }}
            </th>
            <th class="px-3 py-2 font-bold">
              {{ t('importer.team.status') }}
            </th>
            <th class="px-3 py-2 font-bold">
              {{ t('importer.team.confidence') }}
            </th>
            <th class="px-3 py-2 font-bold text-center">
              {{ t('importer.team.inGroup') }}
            </th>
            <th class="px-3 py-2 font-bold text-right">
              {{ t('importer.team.actions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="r in rows"
            :key="r.client_id"
          >
            <tr
              class="border-b border-line-soft align-top"
              :class="selectedId === r.client_id ? 'bg-glass-active' : r.needs_action ? 'bg-failed-bg' : 'bg-bg-3'"
              :data-row="r.client_id"
              :data-needs-action="r.needs_action ? 'true' : 'false'"
            >
              <td class="px-3 py-2 min-w-[180px]">
                <p
                  class="text-[14px] font-semibold"
                  :class="isSkipped(r) ? 'text-ink-2 line-through' : 'text-ink'"
                >
                  {{ rowDisplayName(r) }}
                </p>
                <p
                  v-if="r.role_text && r.role_text !== roleLabel(r)"
                  class="text-[12px] text-ink-2"
                >
                  {{ r.role_text }}
                </p>
                <ul
                  v-if="!isSkipped(r) && r.issues.length"
                  class="mt-0.5 flex flex-col"
                >
                  <li
                    v-for="issue in r.issues"
                    :key="issue"
                    class="text-[12px] text-ink-2"
                  >
                    {{ issueText(r, issue) }}
                  </li>
                </ul>
                <p
                  v-if="rowErrors[r.client_id]"
                  class="text-[12px] text-failed-fg mt-0.5"
                  role="alert"
                  data-test="import-row-error"
                >
                  {{ rowErrors[r.client_id] }}
                </p>
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <span
                  v-if="phoneText(r)"
                  class="font-time tnum text-ink"
                >{{ phoneText(r) }}</span>
                <span
                  v-else
                  class="text-ink-2"
                >{{ t('importer.team.noPhone') }}</span>
              </td>
              <td class="px-3 py-2">
                <select
                  v-if="roles.length && !isSkipped(r)"
                  class="max-w-[160px] rounded-sm border border-line-2 bg-bg-3 px-2 py-1 text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
                  :value="r.role_uuid ?? ''"
                  :disabled="isSaving(r)"
                  :aria-label="t('importer.team.role')"
                  data-test="import-row-role"
                  @change="setRole(r, $event)"
                >
                  <option
                    v-if="!r.role_uuid"
                    value=""
                  >
                    {{ t('importer.team.noRole') }}
                  </option>
                  <option
                    v-for="role in roles"
                    :key="role.uuid"
                    :value="role.uuid"
                  >
                    {{ role.name }}
                  </option>
                </select>
                <span
                  v-else
                  class="text-ink-2"
                >{{ roleLabel(r) || t('importer.team.noRole') }}</span>
              </td>
              <td class="px-3 py-2">
                <StatusBadge
                  size="sm"
                  :status="importRowBadge(rowStatus(r))"
                  :label="t(rowStatusKey(r))"
                  data-test="import-row-status"
                />
              </td>
              <td class="px-3 py-2">
                <StatusBadge
                  v-if="!isSkipped(r)"
                  size="sm"
                  :status="importConfidenceBadge(r.confidence)"
                  :label="t(`importer.confidence.${confidenceTone(r.confidence)}`)"
                  data-test="import-row-confidence"
                />
              </td>
              <td class="px-3 py-2 text-center">
                <input
                  v-if="!isSkipped(r)"
                  type="checkbox"
                  class="w-4 h-4 accent-[var(--olive)] cursor-pointer disabled:cursor-not-allowed"
                  :checked="inGroupChecked(r)"
                  :disabled="r.already_in_group || isSaving(r)"
                  :title="r.already_in_group ? t('importer.editor.inGroupLocked') : undefined"
                  :aria-label="t('importer.team.inGroup')"
                  data-test="import-row-ingroup"
                  @change="setInGroup(r, $event)"
                >
              </td>
              <td class="px-3 py-2">
                <div class="flex items-center justify-end gap-1 whitespace-nowrap">
                  <span
                    v-if="isSaving(r)"
                    class="w-3.5 h-3.5 rounded-full border-2 border-line-2 border-t-olive animate-spin"
                    role="status"
                    :aria-label="t('importer.team.saving')"
                  />
                  <button
                    v-if="!isSkipped(r) && r.needs_action && !needsResolver(r)"
                    type="button"
                    :class="LINK_BTN"
                    :disabled="isSaving(r)"
                    data-test="import-row-reviewed"
                    @click="markReviewed(r)"
                  >
                    {{ t('importer.team.markReviewed') }}
                  </button>
                  <button
                    v-if="!isSkipped(r)"
                    type="button"
                    :class="LINK_BTN"
                    :disabled="isSaving(r)"
                    data-test="import-row-edit"
                    @click="emit('edit', r)"
                  >
                    {{ t('importer.team.edit') }}
                  </button>
                  <button
                    type="button"
                    :class="LINK_BTN"
                    :disabled="isSaving(r)"
                    :data-test="isSkipped(r) ? 'import-row-restore' : 'import-row-skip'"
                    @click="toggleSkip(r)"
                  >
                    {{ isSkipped(r) ? t('importer.team.restore') : t('importer.team.skip') }}
                  </button>
                </div>
              </td>
            </tr>
            <tr
              v-if="selectedId === r.client_id && $slots.expanded"
              class="border-b border-line bg-bg-2"
              data-test="import-row-expanded"
            >
              <td
                colspan="7"
                class="px-3 py-3"
              >
                <slot
                  name="expanded"
                  :row="r"
                />
              </td>
            </tr>
            <tr
              v-else-if="needsResolver(r)"
              class="border-b border-line-soft bg-bg-3"
            >
              <td
                colspan="7"
                class="px-3 pb-3"
              >
                <ImportMatchResolver
                  :row="r"
                  :saving="isSaving(r)"
                  @patch="emit('patch', $event)"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
