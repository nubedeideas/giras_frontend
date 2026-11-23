<script setup lang="ts">
// Pie de la revisión (F1 §4.2): resumen de lo que hará `confirm`, "Descartar" y "Confirmar"
// (desactivado con el motivo si quedan filas por resolver). Fijo sobre la `MobileNav` en móvil y
// pegado al fondo del scroll en escritorio. Con `estimate` (D11), la estimación de WhatsApp.
// F2 §4.3: con actividades, el resumen cuenta contactos y actividades y el botón pasa a "Ver avisos"
// (`mode="notices"`, emite `notices`: paso "Qué se va a enviar y a quién").
// F3 §4.4: con cancelaciones del calendario, "Nuevas: N · Actualizadas: M · Canceladas: K". Un
// borrador de calendario (`calendar`) con todo "Mantener" se confirma sin cambios: lo dice debajo.
// F4 §4.4: `calendar` vale para cualquier fuente en vivo (también una hoja, con `sheet` para el
// texto); "· se vincularán {n}" cuando `activities.to_link > 0` (vincular cuenta como cambio).
// F5a §4.2: en móvil, con filas por resolver, "Te quedan {n} por resolver" se puede tocar y emite
// `goPending` (la vista baja a la primera). El slot `notice` va encima, dentro de la barra fija
// (el "Omitida: … · Deshacer" de la vista).
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
    /** Filas por resolver (equipo + actividades). Por defecto, las del equipo del resumen. */
    pending?: number | null
    /** `notices`: el botón principal abre el paso de avisos en lugar de confirmar. */
    mode?: 'confirm' | 'notices'
    /**
     * F3: borrador de una fuente en vivo (calendario o, F4, hoja de Google): se puede confirmar sin
     * cambios para darlo por revisado.
     */
    calendar?: boolean
    /** F4: la fuente en vivo es una hoja de Google (texto de "confirmar sin cambios"). */
    sheet?: boolean
  }>(),
  { busy: false, estimate: null, pending: null, mode: 'confirm', calendar: false, sheet: false }
)
const emit = defineEmits<{ confirm: []; discard: []; notices: []; goPending: [] }>()
defineSlots<{ notice?: () => unknown }>()

const { t } = useI18n()

const activities = computed(() => props.summary.activities ?? null)
const hasActivities = computed(() => (activities.value?.total ?? 0) > 0)
const toCancel = computed(() => activities.value?.to_cancel ?? 0)
/** F4: duplicados que se vincularán a la hoja. */
const toLink = computed(() => activities.value?.to_link ?? 0)
/** Altas, sustituciones, cancelaciones y vínculos: todo lo que hará `confirm` con las actividades. */
const activitiesToImport = computed(() =>
  activities.value
    ? activities.value.to_create + activities.value.to_replace + toCancel.value + toLink.value
    : 0
)
/** Omitidas de verdad: `to_skip` incluye las filas que se vinculan (`skip` con `match.link`). */
const activitiesSkipped = computed(() =>
  activities.value ? Math.max(0, activities.value.to_skip - toLink.value) : 0
)
const linkedText = computed(() =>
  toLink.value > 0 ? ` ${t('importer.confirm.summaryLinked', { n: toLink.value }, toLink.value)}` : ''
)
const toImport = computed(
  () => props.summary.to_create + props.summary.to_link + activitiesToImport.value
)
const pendingCount = computed(() => props.pending ?? props.summary.needs_action)
const reason = computed(() => {
  if (props.canConfirm) return ''
  if (pendingCount.value > 0) return t('importer.confirm.blocked')
  if (toImport.value === 0) return t('importer.confirm.empty')
  return ''
})
/** Borrador de calendario que se confirma sin crear, cambiar ni cancelar nada. */
/** Móvil: el motivo pasa a ser el botón "Te quedan {n} por resolver". */
const pendingLeft = computed(() => !props.canConfirm && pendingCount.value > 0)
const reviewedOnly = computed(() => props.calendar && props.canConfirm && toImport.value === 0)

function onPrimary() {
  if (props.mode === 'notices') emit('notices')
  else emit('confirm')
}
</script>

<template>
  <div
    class="fixed lg:sticky inset-x-0 bottom-[calc(63px+env(safe-area-inset-bottom))] lg:bottom-0 z-30 border-t border-line bg-bg-3 px-4 py-3 shadow-[0_-4px_16px_var(--shadow-sm)] lg:rounded-t lg:border-x"
    data-test="import-confirm-bar"
  >
    <slot name="notice" />
    <div class="max-w-5xl mx-auto flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
      <div class="flex-1 min-w-0">
        <p
          v-if="hasActivities && activities && toCancel > 0"
          class="hidden lg:block text-[14px] text-ink"
          data-test="import-confirm-summary-calendar"
        >
          {{
            t('importer.confirm.summaryCalendar', {
              activities: activities.to_create,
              replaced: activities.to_replace,
              cancelled: toCancel,
            })
          }}{{ linkedText }}
        </p>
        <p
          v-else-if="hasActivities && activities"
          class="hidden lg:block text-[14px] text-ink"
          data-test="import-confirm-summary-all"
        >
          {{
            t('importer.confirm.summaryAll', {
              contacts: summary.to_create,
              activities: activities.to_create,
              skipped: activitiesSkipped,
              replaced: activities.to_replace,
            })
          }}{{ linkedText }}
        </p>
        <p
          v-else
          class="hidden lg:block text-[14px] text-ink"
          data-test="import-confirm-summary"
        >
          {{
            t('importer.confirm.summary', {
              created: summary.to_create,
              linked: summary.to_link,
              group: summary.in_group,
              skipped: summary.to_skip,
            })
          }}
        </p>
        <ImportWhatsappEstimate :estimate="estimate" />
        <p
          v-if="reviewedOnly"
          id="import-confirm-reviewed-only"
          class="text-[13px] text-ink-2"
          data-test="import-confirm-reviewed-only"
        >
          {{ sheet ? t('importer.confirm.reviewedOnlySheet') : t('importer.confirm.reviewedOnly') }}
        </p>
        <p
          v-if="reason"
          id="import-confirm-reason"
          class="text-[13px] text-failed-fg"
          :class="pendingLeft ? 'hidden lg:block' : ''"
          data-test="import-confirm-reason"
        >
          {{ reason }}
        </p>
        <button
          v-if="pendingLeft"
          type="button"
          class="lg:hidden inline-flex items-center gap-1 min-h-[44px] text-left text-[14px] font-semibold text-failed-fg bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
          data-test="import-confirm-pending-left"
          @click="emit('goPending')"
        >
          {{ t('importer.mobile.pendingLeft', { n: pendingCount }, pendingCount) }}
          <span aria-hidden="true">↓</span>
        </button>
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
          :aria-describedby="
            reason
              ? 'import-confirm-reason'
              : reviewedOnly
                ? 'import-confirm-reviewed-only'
                : undefined
          "
          :data-mode="mode"
          data-test="import-confirm"
          @click="onPrimary"
        >
          <span
            v-if="busy"
            class="w-3.5 h-3.5 rounded-full border-2 border-night border-t-transparent animate-spin"
            aria-hidden="true"
          />
          <template v-if="mode === 'notices'">
            <span class="lg:hidden">{{ t('importer.activities.reviewNoticesCount', { n: toImport }) }}</span>
            <span class="hidden lg:inline">{{ t('importer.confirm.viewNotices') }} →</span>
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
