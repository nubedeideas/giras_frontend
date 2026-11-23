<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import IcalSubscribeForm from '@/components/ical/IcalSubscribeForm.vue'
import { useToursStore } from '@/stores/tours'
import type { IcalSubscription } from '@/composables/useIcalSubscriptions'

// Modal de alta (Ajustes › Calendarios y Mis giras › Cal). Sin gira fija, el formulario pinta el
// selector con las giras abiertas que el usuario administra (la API responde 403/400 al resto).
const props = defineProps<{ show: boolean; tourUuid: string | null }>()
const emit = defineEmits<{ close: []; created: [sub: IcalSubscription] }>()

const { t } = useI18n()
const toursStore = useToursStore()

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
    @close="emit('close')"
  >
    <button
      type="button"
      class="absolute top-3 right-3 flex items-center justify-center w-[44px] h-[44px] lg:w-8 lg:h-8 rounded-sm border border-line bg-bg-2 text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
      :aria-label="t('ical.form.close')"
      data-test="ical-modal-close"
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
    <IcalSubscribeForm
      v-if="show"
      :tour-uuid="props.tourUuid"
      :tours="adminTours"
      @created="emit('created', $event)"
      @cancel="emit('close')"
      @review="emit('close')"
    />
  </AppModal>
</template>
