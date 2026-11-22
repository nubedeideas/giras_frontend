<script setup lang="ts">
// Pie de la revisión (F1 §4.2): resumen de lo que hará `confirm`, "Descartar" y "Confirmar"
// (desactivado con el motivo si quedan filas por resolver). Fijo sobre la `MobileNav` en móvil y
// pegado al fondo del scroll en escritorio. Con `estimate` (D11), la estimación de WhatsApp.
// F2 (lote 3): con `noticesStep` el botón principal es "Ver avisos" (abre `?step=notices`) y, si
// el job trae actividades, el resumen cuenta contactos y actividades (`summaryAll`).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import ImportWhatsappEstimate from '@/components/import/ImportWhatsappEstimate.vue'
import type { ImportSummary, ImportWhatsappEstimate as Estimate } from '@/composables/useImportJobs'

const props = withDefaults(
  defineProps<{
    summary: ImportSummary
    canConfirm: boolean
    busy?: boolean
    estimate?: Estimate | null
    noticesStep?: boolean
  }>(),
  { busy: false, estimate: null, noticesStep: false }
)
const emit = defineEmits<{ confirm: []; discard: [] }>()

const { t } = useI18n()

const toImport = computed(() => props.summary.to_create + props.summary.to_link)
const summaryText = computed(() => {
  const s = props.summary
  const a = s.activities
  if (a && a.total > 0) {
    return t('importer.confirm.summaryAll', {
      contacts: s.to_create,
      activities: a.to_create,
      skipped: a.to_skip,
      replaced: a.to_replace,
    })
  }
  return t('importer.confirm.summary', {
    created: s.to_create,
    linked: s.to_link,
    group: s.in_group,
    skipped: s.to_skip,
  })
})

const reason = computed(() => {
  if (props.canConfirm) return ''
  if (props.summary.needs_action > 0) return t('importer.confirm.blocked')
  if (toImport.value === 0) return t('importer.confirm.empty')
  return ''
})
</script>

<template>
  <div
    class="fixed lg:sticky inset-x-0 bottom-[calc(63px+env(safe-area-inset-bottom))] lg:bottom-0 z-30 border-t border-line bg-bg-3 px-4 py-3 shadow-[0_-4px_16px_var(--shadow-sm)] lg:rounded-t lg:border-x"
    data-test="import-confirm-bar"
  >
    <div class="max-w-5xl mx-auto flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
      <div class="flex-1 min-w-0">
        <p
          class="hidden lg:block text-[14px] text-ink"
          data-test="import-confirm-summary"
        >
          {{ summaryText }}
        </p>
        <ImportWhatsappEstimate :estimate="estimate" />
        <p
          v-if="reason"
          id="import-confirm-reason"
          class="text-[13px] text-failed-fg"
          data-test="import-confirm-reason"
        >
          {{ reason }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <BtnSecondary
          type="button"
          class="disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="busy"
          data-test="import-discard"
          @click="emit('discard')"
        >
          {{ t('importer.discard.button') }}
        </BtnSecondary>
        <BtnPrimary
          type="button"
          class="flex-1 lg:flex-none justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canConfirm || busy"
          :aria-describedby="reason ? 'import-confirm-reason' : undefined"
          data-test="import-confirm"
          @click="emit('confirm')"
        >
          <span
            v-if="busy"
            class="w-3.5 h-3.5 rounded-full border-2 border-night border-t-transparent animate-spin"
            aria-hidden="true"
          />
          <template v-if="noticesStep">
            {{ t('importer.confirm.viewNotices') }}
          </template>
          <template v-else>
            <span class="lg:hidden">{{ t('importer.confirm.buttonCount', { n: toImport }) }}</span>
            <span class="hidden lg:inline">{{ t('importer.confirm.button') }}</span>
          </template>
        </BtnPrimary>
      </div>
    </div>
  </div>
</template>
