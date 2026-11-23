<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import ImportDropZone from '@/components/import/ImportDropZone.vue'
import ImportProgress from '@/components/import/ImportProgress.vue'
import IcalSubscribeForm from '@/components/ical/IcalSubscribeForm.vue'
import SheetLinkForm from '@/components/sheets/SheetLinkForm.vue'
import { isPickerConfigured } from '@/composables/useGooglePicker'
import { sheetsReturnTo } from '@/composables/useImportReturn'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import type { ImportSendableEntryPoint, ImportExpected, ImportJob } from '@/composables/useImportJobs'
import { errorKey } from '@/utils/importReview'

// `expected` (F2): `team` desde Contactos, `itinerary` desde las entradas de actividades y `any`
// (genérico) desde Mi Gira. Elige título, subtítulo y ayuda del texto pegado y va al backend.
const props = withDefaults(
  defineProps<{
    show: boolean
    tourUuid: string
    entryPoint?: ImportSendableEntryPoint
    expected?: ImportExpected
    /** F4: abrir directamente en "Vincular Google Sheets" (vuelta del OAuth, `?import=sheets`). */
    startWithSheets?: boolean
  }>(),
  { entryPoint: 'tour', expected: 'any', startWithSheets: false }
)
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const toursStore = useToursStore()

/**
 * F3 (§4.5): "Suscribir iCal (URL)" sustituye la zona por el alta de la suscripción. No en el
 * importador de equipo, solo para admins de la gira y fuera de la demo.
 */
const canSubscribeIcal = computed(
  () =>
    props.expected !== 'team' &&
    !auth.isDemoMode &&
    toursStore.tours.some((tour) => tour.uuid === props.tourUuid && tour.current_user_is_admin === true)
)
const showIcal = ref(false)

const isTourAdmin = computed(() =>
  toursStore.tours.some((tour) => tour.uuid === props.tourUuid && tour.current_user_is_admin === true)
)
/**
 * F4 (§4.5): "Vincular Google Sheets" sustituye la zona por el alta de la hoja. Solo admins de la
 * gira, fuera de la demo y con el selector de Google configurado; también en el importador de
 * equipo (una hoja de equipo viva tiene sentido).
 */
const canLinkSheets = computed(() => isPickerConfigured() && !auth.isDemoMode && isTourAdmin.value)
const showSheets = ref(props.show && props.startWithSheets)
/** Vuelta de "Conectar Google Sheets": esta misma vista, que reabre el formulario. */
const sheetsReturn = computed(() => sheetsReturnTo(route.fullPath, props.tourUuid))

/** Job en curso: con valor se pinta el progreso en vez de la zona de subida. */
const jobUuid = ref<string | null>(null)
const failedJob = ref<ImportJob | null>(null)

const failedText = computed(() => {
  const j = failedJob.value
  if (!j) return ''
  return t(j.status === 'discarded' && j.error_code !== 'expired' ? 'importer.errors.generic' : errorKey(j.error_code))
})

function reset() {
  jobUuid.value = null
  failedJob.value = null
  showIcal.value = false
  showSheets.value = false
}

function onIcalReview() {
  emit('close')
  reset()
}

function openIcal() {
  showSheets.value = false
  showIcal.value = true
}

function openSheets() {
  showIcal.value = false
  showSheets.value = true
}

// Cerrar mientras procesa no cancela nada: el job sigue y aparece en el aviso de `TourView`.
watch(
  () => props.show,
  (open) => {
    if (!open) reset()
    else if (props.startWithSheets) showSheets.value = true
  }
)

function onCreated(job: ImportJob) {
  failedJob.value = null
  jobUuid.value = job.uuid
}

function onReady(job: ImportJob) {
  emit('close')
  reset()
  void router.push({ name: 'tour-import', params: { jobUuid: job.uuid } })
}

function onFailed(job: ImportJob) {
  failedJob.value = job
}
</script>

<template>
  <AppModal
    :show="show"
    persistent
    @close="emit('close')"
  >
    <button
      type="button"
      class="absolute top-3 right-3 flex items-center justify-center w-[44px] h-[44px] lg:w-8 lg:h-8 rounded-sm border border-line bg-bg-2 text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
      :aria-label="t('importer.close')"
      data-test="import-modal-close"
      @click="emit('close')"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <line
          x1="18"
          y1="6"
          x2="6"
          y2="18"
        /><line
          x1="6"
          y1="6"
          x2="18"
          y2="18"
        />
      </svg>
    </button>

    <div
      v-if="showIcal && !jobUuid"
      class="pr-12 mb-4"
    >
      <p class="text-[17px] font-bold text-ink">
        {{ t('ical.form.title') }}
      </p>
    </div>
    <div
      v-else-if="showSheets && canLinkSheets && !jobUuid"
      class="pr-12 mb-4"
    >
      <p class="text-[17px] font-bold text-ink">
        {{ t('sheets.form.title') }}
      </p>
    </div>
    <div
      v-else
      class="pr-12 mb-4"
    >
      <p class="text-[17px] font-bold text-ink">
        {{ t(`importer.modal.${expected}.title`) }}
      </p>
      <p class="text-[14px] text-ink-2 mt-0.5">
        {{ t(`importer.modal.${expected}.sub`) }}
      </p>
    </div>

    <IcalSubscribeForm
      v-if="!jobUuid && showIcal"
      :tour-uuid="tourUuid"
      compact
      @cancel="showIcal = false"
      @review="onIcalReview"
    />

    <SheetLinkForm
      v-else-if="!jobUuid && showSheets && canLinkSheets"
      :tour-uuid="tourUuid"
      :return-to="sheetsReturn"
      compact
      @cancel="showSheets = false"
      @review="onIcalReview"
    />

    <template v-else-if="!jobUuid">
      <ImportDropZone
        :tour-uuid="tourUuid"
        :entry-point="entryPoint"
        :expected="expected"
        @created="onCreated"
      />
      <div
        v-if="canSubscribeIcal || canLinkSheets"
        class="mt-3 flex flex-wrap items-center gap-x-5"
      >
        <button
          v-if="canSubscribeIcal"
          type="button"
          class="inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-0 text-[14px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
          data-test="import-ical-toggle"
          @click="openIcal"
        >
          {{ t('ical.subscribe') }}
        </button>
        <button
          v-if="canLinkSheets"
          type="button"
          class="inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-0 text-[14px] font-medium text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
          data-test="import-sheets-toggle"
          @click="openSheets"
        >
          {{ t('sheets.link') }}
        </button>
      </div>
    </template>

    <div
      v-else-if="failedJob"
      class="flex flex-col items-start gap-3"
    >
      <p
        class="text-[14px] text-failed-fg rounded-sm bg-failed-bg px-3 py-2 w-full"
        role="alert"
        data-test="import-failed"
      >
        {{ failedText }}
      </p>
      <BtnSecondary
        type="button"
        data-test="import-retry"
        @click="reset"
      >
        {{ t('importer.retry') }}
      </BtnSecondary>
    </div>

    <div
      v-else
      class="flex flex-col gap-3"
    >
      <ImportProgress
        :job-uuid="jobUuid"
        :expected="expected"
        @ready="onReady"
        @failed="onFailed"
      />
      <p class="text-[13px] text-ink-2">
        {{ t('importer.progress.background') }}
      </p>
    </div>
  </AppModal>
</template>
