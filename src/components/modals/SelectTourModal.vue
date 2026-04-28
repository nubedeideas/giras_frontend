<script setup lang="ts">
import { computed } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { useToursStore } from '@/stores/tours'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: []; selected: [] }>()

const toursStore = useToursStore()

const availableTours = computed(() =>
  toursStore.tours.filter((t) => t.status === 'active' || t.status === 'draft'),
)

const STATUS_LABEL: Record<string, string> = {
  active: 'Activa',
  draft: 'Borrador',
}

function selectTour(id: number) {
  toursStore.setActiveTour(id)
  emit('selected')
  emit('close')
}
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <!-- Close -->
    <button
      class="absolute top-3.5 right-3.5 flex items-center justify-center w-[26px] h-[26px] rounded-[7px] border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink"
      @click="emit('close')"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <!-- Header -->
    <div class="flex items-center gap-2.5 mb-[18px]">
      <div class="w-[34px] h-[34px] rounded-[9px] bg-[rgba(245,158,11,0.12)] text-[#f59e0b] flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div>
        <p class="text-[14px] font-bold text-ink">Selecciona una gira</p>
        <p class="text-[11px] text-ink-3 mt-px">Para agregar actividades necesitas tener una gira activa</p>
      </div>
    </div>

    <!-- No tours -->
    <div v-if="availableTours.length === 0" class="text-center py-6 space-y-2">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-ink-4 mx-auto">
        <circle cx="6" cy="19" r="3"/>
        <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
        <circle cx="18" cy="5" r="3"/>
      </svg>
      <p class="text-[12px] text-ink-3">No hay giras activas o en borrador</p>
      <p class="text-[11px] text-ink-4">Crea una gira desde el menú lateral primero</p>
    </div>

    <!-- Tour list -->
    <div v-else class="space-y-1.5">
      <button
        v-for="tour in availableTours"
        :key="tour.id"
        class="w-full flex items-center gap-3 bg-glass border border-line rounded-xl px-3.5 py-3 cursor-pointer hover:bg-glass-2 hover:border-line-2 transition-all duration-150 text-left group"
        @click="selectTour(tour.id)"
      >
        <!-- Color dot / Spotify image -->
        <div
          class="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
          :style="tour.spotify_image_url ? {} : { background: tour.color ?? '#a8d800' }"
        >
          <img
            v-if="tour.spotify_image_url"
            :src="tour.spotify_image_url"
            class="w-full h-full object-cover"
          />
          <span v-else class="text-[11px] font-bold text-black uppercase">
            {{ tour.name.charAt(0) }}
          </span>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 min-w-0">
            <p class="text-[13px] font-semibold text-ink truncate">{{ tour.name }}</p>
            <span
              class="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border"
              :class="tour.status === 'active'
                ? 'bg-[rgba(168,216,0,0.1)] text-acid border-[rgba(168,216,0,0.2)]'
                : 'bg-glass border-line text-ink-4'"
            >
              {{ STATUS_LABEL[tour.status] ?? tour.status }}
            </span>
          </div>
          <p class="text-[11px] text-ink-3 truncate">{{ tour.artist_name }}</p>
          <p v-if="tour.start_date" class="text-[10px] text-ink-4 mt-0.5">
            {{ tour.start_date }}{{ tour.end_date ? ` — ${tour.end_date}` : '' }}
          </p>
        </div>

        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-ink-4 group-hover:text-ink-2 transition-colors flex-shrink-0">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  </AppModal>
</template>
