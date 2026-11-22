<script setup lang="ts">
// Estado `done` de la revisión (F1 §4.2): recuentos de `result`, "Ver contactos de la gira",
// "Importar más" y el aviso si el grupo por defecto de la gira no es el Equipo de la gira (D6).
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import type { ImportJob, ImportResult } from '@/composables/useImportJobs'

const props = defineProps<{ job: Pick<ImportJob, 'result' | 'team_group'> }>()
const emit = defineEmits<{ importMore: [] }>()

const { t } = useI18n()

const result = computed<Partial<ImportResult>>(() => props.job.result ?? {})
const n = (v: number | undefined) => v ?? 0

const linked = computed(() => n(result.value.contacts_linked) + n(result.value.linked_late))
const notDefault = computed(() => result.value.team_group_is_default === false)
const defaultGroupName = computed(() => props.job.team_group?.default_group_name ?? '')
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
    <div class="flex flex-wrap items-center gap-2">
      <RouterLink
        :to="{ name: 'contacts' }"
        class="inline-flex items-center min-h-[44px] lg:min-h-0 px-4 py-2.5 rounded-sm bg-acid text-night text-[14px] font-bold hover:bg-acid-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
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
