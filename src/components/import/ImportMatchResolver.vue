<script setup lang="ts">
// Resolutor de coincidencias (F1 §4.2): con `name_suggestion` o `multiple_matches`, un botón
// "Es {name} ({phone})" por contacto (→ `link` + `link_contact_uuid`) y "Es otra persona"
// (→ `create` + `reviewed`).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImportRowPatch, ImportTeamRow } from '@/composables/useImportJobs'
import { linkedContactUuid, matchCandidates } from '@/utils/importReview'

const props = defineProps<{ row: ImportTeamRow; saving?: boolean }>()
const emit = defineEmits<{ patch: [patch: ImportRowPatch] }>()

const { t } = useI18n()

const candidates = computed(() => matchCandidates(props.row))
const multiple = computed(
  () => props.row.match?.status !== 'name_suggestion' && props.row.issues.includes('multiple_matches')
)
const linked = computed(() => linkedContactUuid(props.row))
// "Es otra persona" ya elegido: la fila se crea y está revisada.
const isOther = computed(() => props.row.action === 'create' && props.row.reviewed)

function pickContact(uuid: string) {
  emit('patch', { client_id: props.row.client_id, action: 'link', link_contact_uuid: uuid })
}

function pickOther() {
  emit('patch', { client_id: props.row.client_id, action: 'create', reviewed: true })
}

const BTN =
  'min-h-[44px] lg:min-h-[36px] px-3 rounded-sm border text-left text-[13px] font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50 disabled:cursor-not-allowed'
</script>

<template>
  <div
    v-if="candidates.length"
    class="flex flex-col gap-2"
    data-test="import-match-resolver"
  >
    <p class="text-[13px] font-semibold text-ink">
      {{ multiple ? t('importer.match.multipleTitle') : t('importer.match.title') }}
    </p>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="c in candidates"
        :key="c.contact_uuid"
        type="button"
        :class="[
          BTN,
          linked === c.contact_uuid
            ? 'border-olive bg-glass-active text-ink'
            : 'border-line-2 bg-bg-3 text-ink hover:bg-glass-hover',
        ]"
        :aria-pressed="linked === c.contact_uuid"
        :disabled="saving"
        data-test="import-row-link"
        :data-contact="c.contact_uuid"
        @click="pickContact(c.contact_uuid)"
      >
        {{ t('importer.match.isSame', { name: c.contact_name }) }}
        <span
          v-if="c.contact_phone"
          class="font-time tnum text-ink-2"
        >({{ c.contact_phone }})</span>
      </button>
      <button
        type="button"
        :class="[
          BTN,
          isOther ? 'border-olive bg-glass-active text-ink' : 'border-line-2 bg-bg-3 text-ink hover:bg-glass-hover',
        ]"
        :aria-pressed="isOther"
        :disabled="saving"
        data-test="import-row-other"
        @click="pickOther"
      >
        {{ t('importer.match.isOther') }}
      </button>
    </div>
  </div>
</template>
