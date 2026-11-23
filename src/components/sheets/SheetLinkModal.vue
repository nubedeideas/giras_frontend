<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import SheetLinkForm from '@/components/sheets/SheetLinkForm.vue'
import { useToursStore } from '@/stores/tours'
import { useImportsStore } from '@/stores/imports'
import type { SheetSubscription } from '@/composables/useSheetSubscriptions'

// Modal de alta (Ajustes › Calendarios y hojas). Sin gira fija, el formulario pinta el selector con
// las giras abiertas que el usuario administra (la API responde 403/400 al resto). La vuelta del
// OAuth de "Conectar Google Sheets" reabre este modal (`?sheets=new`).
const props = withDefaults(
  defineProps<{ show: boolean; tourUuid: string | null; returnTo?: string }>(),
  { returnTo: '/settings?tab=calendars&sheets=new' }
)
const emit = defineEmits<{ close: []; created: [sub: SheetSubscription] }>()

const { t } = useI18n()
const toursStore = useToursStore()
const importsStore = useImportsStore()

/** Se vinculó algo: al cerrar (aunque la lectura siga en segundo plano) se recarga el aviso. */
let createdTour: string | null = null

function onCreated(sub: SheetSubscription) {
  createdTour = sub.tour
  emit('created', sub)
}

function close() {
  if (createdTour) importsStore.invalidate(createdTour)
  createdTour = null
  emit('close')
}

const adminTours = computed(() =>
  toursStore.tours
    .filter(
      (tour) =>
        tour.current_user_is_admin === true &&
        tour.status !== 'completed' &&
        tour.status !== 'cancelled'
    )
    .map((tour) => ({ uuid: tour.uuid, name: tour.name }))
)
</script>

<template>
  <AppModal
    :show="show"
    persistent
    @close="close"
  >
    <button
      type="button"
      class="absolute top-3 right-3 flex items-center justify-center w-[44px] h-[44px] lg:w-8 lg:h-8 rounded-sm border border-line bg-bg-2 text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
      :aria-label="t('sheets.form.close')"
      data-test="sheet-modal-close"
      @click="close"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
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
    <SheetLinkForm
      v-if="show"
      :tour-uuid="props.tourUuid"
      :tours="adminTours"
      :return-to="props.returnTo"
      @created="onCreated"
      @cancel="close"
      @review="close"
    />
  </AppModal>
</template>
