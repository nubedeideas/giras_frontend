<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToursStore } from '@/stores/tours'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const toursStore = useToursStore()

const form = reactive({
  name: '',
  artist_name: '',
  description: '',
  genre: '',
  start_date: '',
  end_date: '',
  budget: '',
  currency: 'EUR',
  team_size: undefined as number | undefined,
  notes: '',
})

function submit() {
  if (!form.name || !form.artist_name) return
  toursStore.createTour({ ...form })
  emit('close')
  Object.assign(form, {
    name: '',
    artist_name: '',
    description: '',
    genre: '',
    start_date: '',
    end_date: '',
    budget: '',
    currency: 'EUR',
    team_size: undefined,
    notes: '',
  })
}
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <!-- Close -->
    <button
      class="absolute top-3.5 right-3.5 flex items-center justify-center w-[26px] h-[26px] rounded-[7px] border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink"
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
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>

    <div class="flex items-center gap-2.5 mb-[18px]">
      <div
        class="w-[34px] h-[34px] rounded-[9px] bg-acid-dim text-acid-muted flex items-center justify-center flex-shrink-0"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <circle cx="18" cy="5" r="3" />
        </svg>
      </div>
      <div>
        <p class="text-[14px] font-bold text-ink">{{ t('modal.createTour') }}</p>
        <p class="text-[11px] text-ink-2 mt-px">{{ t('modal.createTourSub') }}</p>
      </div>
    </div>

    <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-[5px]">
      {{ t('modal.tourName') }}
    </label>
    <input
      v-model="form.name"
      :placeholder="t('modal.tourNamePh')"
      class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none focus:border-acid mb-3 transition-colors"
    />

    <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-[5px]">
      {{ t('modal.artist') }}
    </label>
    <input
      v-model="form.artist_name"
      :placeholder="t('modal.artistPh')"
      class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none focus:border-acid mb-3 transition-colors"
    />

    <div class="grid grid-cols-2 gap-2.5 mb-3">
      <div>
        <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-[5px]">
          {{ t('modal.genre') }}
        </label>
        <input
          v-model="form.genre"
          :placeholder="t('modal.genrePh')"
          class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors"
        />
      </div>
      <div>
        <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-[5px]">
          {{ t('modal.teamSize') }}
        </label>
        <input
          v-model.number="form.team_size"
          type="number"
          min="1"
          max="500"
          :placeholder="t('modal.teamSizePh')"
          class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2.5 mb-3">
      <div>
        <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-[5px]">
          {{ t('modal.startDate') }}
        </label>
        <input
          v-model="form.start_date"
          type="date"
          class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors"
        />
      </div>
      <div>
        <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-[5px]">
          {{ t('modal.endDate') }}
        </label>
        <input
          v-model="form.end_date"
          type="date"
          class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2.5 mb-3">
      <div>
        <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-[5px]">
          {{ t('modal.budget') }}
        </label>
        <input
          v-model="form.budget"
          type="number"
          min="0"
          step="0.01"
          :placeholder="t('modal.budgetPh')"
          class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors"
        />
      </div>
      <div>
        <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-[5px]">
          {{ t('modal.currency') }}
        </label>
        <select
          v-model="form.currency"
          class="w-full bg-glass border border-line rounded-sm px-[11px] py-2 text-ink text-[12px] outline-none focus:border-acid cursor-pointer"
        >
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="MXN">MXN</option>
          <option value="GBP">GBP</option>
          <option value="ARS">ARS</option>
        </select>
      </div>
    </div>

    <div class="flex gap-[7px] mt-1">
      <BtnPrimary full @click="submit">
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
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {{ t('modal.createTour') }}
      </BtnPrimary>
      <BtnSecondary @click="emit('close')">{{ t('common.cancel') }}</BtnSecondary>
    </div>
  </AppModal>
</template>
