<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActivitiesStore } from '@/stores/activities'
import { useToursStore } from '@/stores/tours'
import { useIsMobile } from '@/composables/useIsMobile'
import ActivityCard from './ActivityCard.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import TourSelectPrompt from '@/components/tour/TourSelectPrompt.vue'

const store = useActivitiesStore()
const toursStore = useToursStore()
const { isMobile } = useIsMobile()

// `canImport` (F2 A6): admin de la gira fuera de la demo.
defineProps<{ canImport?: boolean }>()
const emit = defineEmits<{ openAdd: []; openImport: [] }>()
const { t } = useI18n()

const CATEGORIES = [
  { value: 'logistics', label: 'Logística',  color: '#1a8fff' },
  { value: 'production', label: 'Producción', color: 'var(--pending-fg)' },
  { value: 'media',      label: 'Medios',     color: '#9b5de5' },
  { value: 'meetings',   label: 'Reuniones',  color: '#06b6d4' },
  { value: 'fan',        label: 'Fan',        color: '#e91e8c' },
  { value: 'personal',   label: 'Personal',   color: '#1fad5a' },
  { value: 'other',      label: 'Otro',       color: '#64748b' },
]

const hasTourUuid = computed(() => !!toursStore.activeTour?.uuid)
const showCategoryFilter = ref(false)

const hasFilters = computed(
  () =>
    store.filterTab !== 'all' ||
    store.filterCategory.length > 0 ||
    store.searchQuery.trim().length > 0
)
/** La gira no tiene ninguna actividad y no hay filtros: CTA de importar o añadir a mano. */
const tourIsEmpty = computed(
  () => !store.loading && !store.error && store.activities.length === 0 && !hasFilters.value
)
</script>

<template>
  <div
    class="w-full m-3 lg:w-80 lg:flex-shrink-0 lg:my-3 lg:ml-3 lg:mr-1.5 bg-bg-3 rounded-2xl border border-line shadow-[0_4px_20px_var(--shadow-sm)] flex flex-col overflow-hidden"
  >
    <!-- Header -->
    <div class="px-3.5 pt-[18px] pb-2.5 border-b border-line flex-shrink-0">
      <div class="flex items-center justify-between mb-3">
        <p class="text-base font-bold tracking-[-0.2px] text-ink">
          Actividades
        </p>
        <BtnPrimary
          small
          @click="emit('openAdd')"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line
              x1="12"
              y1="5"
              x2="12"
              y2="19"
            /><line
              x1="5"
              y1="12"
              x2="19"
              y2="12"
            />
          </svg>
          Agregar
        </BtnPrimary>
      </div>

      <!-- Search -->
      <div class="flex items-center gap-[7px] bg-glass border border-line rounded-sm px-[11px] py-[7px]">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-ink-4 flex-shrink-0"
        >
          <circle
            cx="11"
            cy="11"
            r="8"
          /><line
            x1="21"
            y1="21"
            x2="16.65"
            y2="16.65"
          />
        </svg>
        <input
          v-model="store.searchQuery"
          placeholder="Buscar actividades..."
          class="flex-1 bg-transparent border-none outline-none text-ink text-[14px] placeholder:text-ink-4"
        >
      </div>

      <!-- Category filter (dropdown multi-select) -->
      <div class="relative mt-2">
        <button
          class="w-full flex items-center gap-2 bg-glass border rounded-sm px-[11px] py-[7px] cursor-pointer transition-all duration-150 text-left"
          :class="store.filterCategory.length > 0 ? 'border-line-acid' : 'border-line hover:border-line-2'"
          @click="showCategoryFilter = !showCategoryFilter"
        >
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <template v-if="store.filterCategory.length > 0">
              <span
                v-for="val in store.filterCategory"
                :key="val"
                class="w-2 h-2 rounded-full flex-shrink-0"
                :style="{ background: CATEGORIES.find((c) => c.value === val)?.color }"
              />
              <span class="text-[13px] text-ink truncate">
                {{
                  store.filterCategory.length === 1
                    ? CATEGORIES.find((c) => c.value === store.filterCategory[0])?.label
                    : `${store.filterCategory.length} categorías`
                }}
              </span>
            </template>
            <span
              v-else
              class="text-[13px] text-ink-4"
            >Filtrar por categoría</span>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span
              v-if="store.filterCategory.length > 0"
              class="text-[12px] text-ink-4 hover:text-ink leading-none"
              @click.stop="store.filterCategory.splice(0)"
            >✕</span>
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-ink-4 transition-transform duration-150"
              :class="showCategoryFilter ? 'rotate-180' : ''"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        <!-- Dropdown -->
        <div
          v-if="showCategoryFilter"
          class="absolute top-full left-0 right-0 mt-1 bg-bg-4 border border-line rounded-sm z-50 py-1 shadow-lg"
        >
          <button
            v-for="cat in CATEGORIES"
            :key="cat.value"
            class="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-glass cursor-pointer transition-colors border-none bg-transparent text-left"
            @click="store.toggleCategory(cat.value)"
          >
            <div
              class="w-[13px] h-[13px] rounded-[3px] border flex items-center justify-center flex-shrink-0 transition-all duration-150"
              :class="store.filterCategory.includes(cat.value) ? 'border-transparent' : 'border-line-2'"
              :style="store.filterCategory.includes(cat.value) ? { background: cat.color } : {}"
            >
              <svg
                v-if="store.filterCategory.includes(cat.value)"
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000"
                stroke-width="3.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span
              class="w-2 h-2 rounded-full flex-shrink-0"
              :style="{ background: cat.color }"
            />
            <span class="text-[14px] text-ink">{{ cat.label }}</span>
          </button>
        </div>

        <!-- Backdrop -->
        <div
          v-if="showCategoryFilter"
          class="fixed inset-0 z-40"
          @click="showCategoryFilter = false"
        />
      </div>

      <!-- Filter tabs -->
      <div class="flex gap-1 p-1 mt-2 rounded-[10px] bg-glass-hover">
        <button
          v-for="tab in [
            { key: 'all', label: 'Todas' },
            { key: 'upcoming', label: 'Próximas' },
            { key: 'past', label: 'Pasadas' },
          ]"
          :key="tab.key"
          class="flex-1 min-h-[44px] lg:min-h-[32px] border-none rounded-[7px] text-[13px] cursor-pointer transition-all duration-200 tracking-[0.2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
          :class="
            store.filterTab === tab.key
              ? 'bg-bg-3 text-ink shadow-sm font-semibold'
              : 'bg-transparent text-ink-2 font-medium hover:text-ink'
          "
          @click="store.filterTab = tab.key as typeof store.filterTab"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- No tour selected — mobile shows the compact select right here (this
    panel is the only one visible on mobile); desktop shows the full picker
    in the central column instead (EventsView.vue), so this stays minimal. -->
    <div
      v-if="!toursStore.activeTourId"
      class="flex-1 overflow-hidden"
    >
      <TourSelectPrompt
        v-if="isMobile"
        compact
      />
      <div
        v-else
        class="h-full flex items-center justify-center px-4 text-center"
      >
        <p class="text-[13px] text-ink-4">
          Elige una gira para ver sus actividades
        </p>
      </div>
    </div>

    <!-- No UUID (mock tour) -->
    <div
      v-else-if="toursStore.activeTourId && !hasTourUuid"
      class="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center"
    >
      <p class="text-[13px] text-ink-4">
        Esta gira aún no tiene datos del servidor
      </p>
    </div>

    <!-- Loading -->
    <div
      v-else-if="store.loading"
      class="flex-1 flex items-center justify-center"
    >
      <svg
        class="animate-spin text-ink-4"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="3"
          stroke-dasharray="40 22"
          stroke-linecap="round"
        />
      </svg>
    </div>

    <!-- List -->
    <div
      v-else
      class="flex-1 overflow-y-auto px-2 py-1.5"
    >
      <template
        v-for="group in store.groupedActivities"
        :key="group.label"
      >
        <p
          class="text-[11px] font-bold text-ink-2 tracking-[1.2px] uppercase px-1 pt-2.5 pb-1.5"
        >
          {{ group.label }}
        </p>
        <ActivityCard
          v-for="act in group.items"
          :key="act.uuid"
          :activity="act"
          :selected="store.selectedUuid === act.uuid"
          :past="group.label === 'Pasadas'"
          @select="store.selectActivity"
        />
      </template>

      <div
        v-if="tourIsEmpty"
        class="flex flex-col items-center text-center gap-3 px-3 py-8"
        data-test="activities-empty-tour"
      >
        <p class="text-[15px] font-semibold text-ink">
          {{ t('activities.list.emptyTour') }}
        </p>
        <p
          v-if="canImport"
          class="text-[14px] text-ink-2"
        >
          {{ t('activities.list.emptyTourBody') }}
        </p>
        <div class="flex flex-col gap-2 w-full">
          <BtnPrimary
            v-if="canImport"
            type="button"
            full
            data-test="activities-empty-import"
            @click="emit('openImport')"
          >
            {{ t('importer.cta.importSchedule') }}
          </BtnPrimary>
          <BtnSecondary
            type="button"
            full
            data-test="activities-empty-add"
            @click="emit('openAdd')"
          >
            {{ t('activities.list.manual') }}
          </BtnSecondary>
        </div>
      </div>
      <div
        v-else-if="store.groupedActivities.length === 0 && !store.loading"
        class="text-center py-8 text-ink-2 text-[14px]"
        data-test="activities-no-results"
      >
        {{ t('activities.list.noResults') }}
      </div>
    </div>
  </div>
</template>
