<script setup lang="ts">
// Revisión compacta del onboarding (F1 §4.4.3): lista de filas con su estado y confianza,
// omitir/recuperar, "Dar por buena" y el resolutor de "¿Es la misma persona?" en línea.
// La revisión completa (editar campos, rol, "en el grupo", región) vive en `ImportReviewView`.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { ImportJob, ImportMatchCandidate, ImportRowPatch, ImportTeamRow } from '@/composables/useImportJobs'
import { confidenceTone, rowStatusKey, sortRows } from '@/utils/importReview'
import { importConfidenceBadge } from '@/utils/statusBadge'

const props = defineProps<{
  job: ImportJob
  saving: Set<string>
  /** Mensaje ya traducido por `client_id` cuando su último PATCH ha fallado. */
  rowErrors: Record<string, string>
}>()
const emit = defineEmits<{ patch: [patch: ImportRowPatch] }>()

const { t } = useI18n()

const rows = computed(() => sortRows(props.job.draft?.team ?? []))
const needsAction = computed(() => props.job.summary?.needs_action ?? 0)

function rowName(r: ImportTeamRow): string {
  return (
    r.display_name ||
    [r.first_name, r.last_name].filter(Boolean).join(' ') ||
    r.company ||
    r.role_text ||
    r.source_ref?.row ||
    r.client_id
  )
}

function candidates(r: ImportTeamRow): ImportMatchCandidate[] {
  if (r.match?.status !== 'name_suggestion') return []
  if (r.match.candidates?.length) return r.match.candidates
  if (r.match.contact_uuid) {
    return [
      {
        contact_uuid: r.match.contact_uuid,
        contact_name: r.match.contact_name ?? '',
        contact_phone: r.match.contact_phone,
      },
    ]
  }
  return []
}

function issueText(r: ImportTeamRow, issue: string): string {
  return t(`importer.issues.${issue}`, { name: r.match?.contact_name ?? '' })
}

function isSaving(r: ImportTeamRow): boolean {
  return props.saving.has(r.client_id)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p
      v-if="needsAction > 0"
      class="text-[14px] font-semibold text-ink"
      data-test="import-to-resolve"
    >
      {{ t('importer.toResolve', { n: needsAction }, needsAction) }}
    </p>

    <ul class="flex flex-col gap-2">
      <li
        v-for="r in rows"
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
              :class="r.action === 'skip' ? 'text-ink-2 line-through' : 'text-ink'"
            >
              {{ rowName(r) }}
            </p>
            <p class="text-[13px] text-ink-2 flex flex-wrap gap-x-2">
              <span
                v-if="r.phone || r.phone_raw"
                class="font-time tnum"
              >{{ r.phone || r.phone_raw }}</span>
              <span v-if="r.role_name || r.role_text">{{ r.role_name || r.role_text }}</span>
            </p>
          </div>
          <StatusBadge
            v-if="r.action !== 'skip'"
            size="sm"
            :status="importConfidenceBadge(r.confidence)"
            :label="t(`importer.confidence.${confidenceTone(r.confidence)}`)"
          />
          <StatusBadge
            v-else
            size="sm"
            status="off"
            :label="t('importer.status.skipped')"
          />
        </div>

        <p
          v-if="r.action !== 'skip'"
          class="text-[13px] text-ink-2 mt-1"
        >
          {{ t(rowStatusKey(r)) }}
        </p>
        <ul
          v-if="r.action !== 'skip' && r.issues.length"
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

        <div class="flex flex-wrap items-center gap-2 mt-2">
          <template v-if="r.action !== 'skip' && r.needs_action">
            <button
              v-for="c in candidates(r)"
              :key="c.contact_uuid"
              type="button"
              class="min-h-[44px] lg:min-h-[32px] px-3 rounded-sm border border-line-2 bg-bg-3 text-[13px] font-medium text-ink hover:bg-glass-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50"
              :disabled="isSaving(r)"
              data-test="import-row-link"
              @click="emit('patch', { client_id: r.client_id, action: 'link', link_contact_uuid: c.contact_uuid })"
            >
              {{ t('importer.match.isSame', { name: c.contact_name }) }}
              <span
                v-if="c.contact_phone"
                class="font-time tnum text-ink-2"
              >({{ c.contact_phone }})</span>
            </button>
            <button
              v-if="candidates(r).length"
              type="button"
              class="min-h-[44px] lg:min-h-[32px] px-3 rounded-sm border border-line-2 bg-bg-3 text-[13px] font-medium text-ink hover:bg-glass-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50"
              :disabled="isSaving(r)"
              data-test="import-row-other"
              @click="emit('patch', { client_id: r.client_id, action: 'create', reviewed: true })"
            >
              {{ t('importer.match.isOther') }}
            </button>
            <button
              v-else
              type="button"
              class="min-h-[44px] lg:min-h-[32px] px-3 rounded-sm border border-line-2 bg-bg-3 text-[13px] font-medium text-ink hover:bg-glass-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50"
              :disabled="isSaving(r)"
              data-test="import-row-reviewed"
              @click="emit('patch', { client_id: r.client_id, reviewed: true })"
            >
              {{ t('importer.team.markReviewed') }}
            </button>
          </template>
          <button
            type="button"
            class="min-h-[44px] lg:min-h-[32px] px-2 text-[13px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm disabled:opacity-50"
            :disabled="isSaving(r)"
            :data-test="r.action === 'skip' ? 'import-row-restore' : 'import-row-skip'"
            @click="
              emit('patch', {
                client_id: r.client_id,
                action: r.action === 'skip' ? (r.match?.contact_uuid && r.match.status !== 'name_suggestion' ? 'link' : 'create') : 'skip',
              })
            "
          >
            {{ r.action === 'skip' ? t('importer.team.restore') : t('importer.team.skip') }}
          </button>
          <span
            v-if="isSaving(r)"
            class="w-3.5 h-3.5 rounded-full border-2 border-line-2 border-t-olive animate-spin"
            aria-hidden="true"
          />
        </div>
        <p
          v-if="rowErrors[r.client_id]"
          class="text-[13px] text-failed-fg mt-1"
          role="alert"
        >
          {{ rowErrors[r.client_id] }}
        </p>
      </li>
    </ul>
  </div>
</template>
