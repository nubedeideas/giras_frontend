<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToursStore } from '@/stores/tours'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'

// `compact`: just the select, no icon/heading/background/button — activates
// immediately on change. Used where screen space is tight (mobile Events'
// main list panel). Full mode (default) is the same design as the post-login
// splash (HomeView.vue) — icon chip, heading, select + confirm button.
defineProps<{ compact?: boolean }>()
const emit = defineEmits<{ confirmed: [id: number] }>()

const { t } = useI18n()
const toursStore = useToursStore()
const selectedTourId = ref<number | null>(null)

function confirmTour() {
  if (!selectedTourId.value) return
  toursStore.setActiveTour(selectedTourId.value)
  emit('confirmed', selectedTourId.value)
}

function onCompactChange(e: Event) {
  const id = Number((e.target as HTMLSelectElement).value)
  if (!id) return
  toursStore.setActiveTour(id)
  emit('confirmed', id)
}
</script>

<template>
  <!-- Compact: just the select -->
  <div
    v-if="compact"
    class="px-4 py-6"
  >
    <template v-if="toursStore.activeTours.length > 0">
      <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1.5">
        {{ t('home.selectLabel') }}
      </label>
      <select
        class="w-full bg-glass border border-line rounded-lg px-3 py-2.5 text-ink text-[13px] outline-none focus:border-acid cursor-pointer transition-colors"
        :value="''"
        @change="onCompactChange"
      >
        <option
          value=""
          disabled
        >
          {{ t('home.selectPlaceholder') }}
        </option>
        <option
          v-for="tour in toursStore.activeTours"
          :key="tour.uuid"
          :value="tour.id"
        >
          {{ tour.artist_name }} — {{ tour.name }}
        </option>
      </select>
    </template>
    <p
      v-else
      class="text-[12px] text-ink-3 text-center"
    >
      {{ t('home.noTours') }}
    </p>
  </div>

  <!-- Full: same design as the post-login splash -->
  <div
    v-else
    class="relative h-full overflow-y-auto"
  >
    <svg
      class="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0,660 C100,610 150,710 250,650 C320,610 360,670 400,640 L400,800 L0,800 Z"
        fill="var(--acid)"
        opacity="0.07"
      />
      <path
        d="M0,730 C120,690 200,770 400,710 L400,800 L0,800 Z"
        fill="#1a8fff"
        opacity="0.05"
      />
      <path
        d="M40,520 L92,430 L144,520 Z"
        fill="var(--acid)"
        opacity="0.05"
      />
      <path
        d="M230,540 L292,420 L354,540 Z"
        fill="var(--acid)"
        opacity="0.04"
      />
      <circle
        cx="70"
        cy="360"
        r="2.5"
        fill="var(--acid)"
        opacity="0.35"
      />
      <circle
        cx="330"
        cy="300"
        r="2"
        fill="var(--acid)"
        opacity="0.25"
      />
    </svg>

    <div class="relative min-h-full flex flex-col items-center justify-center gap-6 px-5 py-12">
      <!-- Icon -->
      <div class="w-12 h-12 rounded-[15px] bg-glass border border-line flex items-center justify-center">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-acid"
        >
          <circle
            cx="6"
            cy="19"
            r="3"
          /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle
            cx="18"
            cy="5"
            r="3"
          />
        </svg>
      </div>

      <!-- Heading -->
      <div class="text-center space-y-2 max-w-xs">
        <p class="text-[10px] font-bold text-acid tracking-[0.35em] uppercase">
          {{ t('home.eyebrow') }}
        </p>
        <h1 class="text-2xl font-bold text-ink tracking-[-0.3px]">
          {{ t('home.heading') }}
        </h1>
        <p class="text-[13px] text-ink-3 leading-relaxed">
          {{ t('home.subheading') }}
        </p>
      </div>

      <!-- Tour picker -->
      <div class="w-full max-w-sm bg-bg-3 border border-line rounded-2xl p-5 shadow-[0_4px_20px_var(--shadow-sm)]">
        <template v-if="toursStore.activeTours.length > 0">
          <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1.5">
            {{ t('home.selectLabel') }}
          </label>
          <select
            v-model="selectedTourId"
            class="w-full bg-glass border border-line rounded-lg px-3 py-2.5 text-ink text-[13px] outline-none focus:border-acid cursor-pointer transition-colors mb-3"
          >
            <option
              :value="null"
              disabled
            >
              {{ t('home.selectPlaceholder') }}
            </option>
            <option
              v-for="tour in toursStore.activeTours"
              :key="tour.uuid"
              :value="tour.id"
            >
              {{ tour.artist_name }} — {{ tour.name }}
            </option>
          </select>
          <BtnPrimary
            full
            :disabled="!selectedTourId"
            class="disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            @click="confirmTour"
          >
            {{ t('home.continue') }}
          </BtnPrimary>
        </template>
        <p
          v-else
          class="text-[12px] text-ink-3 text-center"
        >
          {{ t('home.noTours') }}
        </p>
      </div>
    </div>
  </div>
</template>
