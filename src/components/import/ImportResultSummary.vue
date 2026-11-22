<script setup lang="ts">
// Estado `done` de la revisión (F1 §4.2): recuentos de `result`, "Ver contactos de la gira",
// "Importar más", el aviso si el grupo por defecto de la gira no es el Equipo de la gira (D6) y el
// de quien confirma sin contacto en la gira (D10, `confirmer_in_team=false`).
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { BTN_PRIMARY_CLASS } from '@/components/ui/btnClasses'
import type { ImportJob, ImportResult } from '@/composables/useImportJobs'

const props = defineProps<{ job: Pick<ImportJob, 'result' | 'team_group'> }>()
const emit = defineEmits<{ importMore: [] }>()

const { t } = useI18n()

const result = computed<Partial<ImportResult>>(() => props.job.result ?? {})
const n = (v: number | undefined) => v ?? 0

// `contacts_linked` ya incluye `linked_late` (commit_team): no se suman.
const linked = computed(() => n(result.value.contacts_linked))
const notDefault = computed(() => result.value.team_group_is_default === false)
const defaultGroupName = computed(() => props.job.team_group?.default_group_name ?? '')
// Solo con `false` explícito: los jobs confirmados antes de D10 no traen el campo.
const confirmerOutside = computed(() => result.value.confirmer_in_team === false)
</script>

<template>
  <div
    class="flex flex-col gap-4 rounded-lg border border-line bg-bg-3 p-5"
    data-test="import-result"
  >
    <div class="flex items-center gap-2">
      <StatusBadge
        status="sent"
        :label="t('importer.result.title')"
      />
    </div>
    <p
      class="text-[15px] text-ink"
      data-test="import-result-summary"
    >
      {{
        t('importer.result.summary', {
          created: n(result.contacts_created),
          linked,
          group: n(result.added_to_group),
        })
      }}
    </p>
    <ul
      v-if="n(result.already_in_tour) || n(result.skipped)"
      class="flex flex-col gap-0.5 text-[14px] text-ink-2"
    >
      <li v-if="n(result.already_in_tour)">
        {{ t('importer.result.alreadyInTour', { n: n(result.already_in_tour) }, n(result.already_in_tour)) }}
      </li>
      <li v-if="n(result.skipped)">
        {{ t('importer.result.skipped', { n: n(result.skipped) }, n(result.skipped)) }}
      </li>
    </ul>
    <p
      v-if="notDefault && defaultGroupName"
      class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
      data-test="import-result-not-default"
    >
      {{ t('importer.result.notDefaultGroup', { group: defaultGroupName }) }}
    </p>
    <p
      v-if="confirmerOutside"
      class="text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
      data-test="import-result-confirmer-outside"
    >
      {{ t('importer.result.confirmerOutside') }}
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <RouterLink
        :to="{ name: 'contacts' }"
        :class="BTN_PRIMARY_CLASS"
        data-test="import-result-contacts"
      >
        {{ t('importer.result.viewContacts') }}
      </RouterLink>
      <BtnSecondary
        type="button"
        data-test="import-result-more"
        @click="emit('importMore')"
      >
        {{ t('importer.result.importMore') }}
      </BtnSecondary>
    </div>
  </div>
</template>
