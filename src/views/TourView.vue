<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import TourInsightsPanel from '@/components/tour/TourInsightsPanel.vue'
import TourDocumentsPanel from '@/components/tour/TourDocumentsPanel.vue'
import ScheduleConflictsPanel from '@/components/tour/ScheduleConflictsPanel.vue'

const { t } = useI18n()
const auth = useAuthStore()
const toursStore = useToursStore()

type Tab = 'insights' | 'documents' | 'conflicts'
const activeTab = ref<Tab>('insights')

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'insights', labelKey: 'tourHub.tabs.insights' },
  { key: 'documents', labelKey: 'tourHub.tabs.documents' },
  { key: 'conflicts', labelKey: 'tourHub.tabs.conflicts' },
]

const hasTourUuid = computed(() => !!toursStore.activeTour?.uuid)

// Frontend has no per-tour membership/role model yet — approximate "admin of
// this tour" via ownership. The backend still enforces IsTourAdmin for real,
// this only controls whether the upload/delete controls are shown.
const isAdmin = computed(
  () => !!auth.user?.is_superuser || (!!auth.user?.email && auth.user.email === toursStore.activeTour?.owner_email),
)
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg-3">
    <!-- No tour selected -->
    <div
      v-if="!toursStore.activeTourId"
      class="h-full flex flex-col items-center justify-center gap-2 px-4 text-center"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="text-ink-4"
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
      <p class="text-[12px] text-ink-4">
        {{ t('tourHub.noActiveTour') }}
      </p>
    </div>

    <!-- No UUID (mock tour) -->
    <div
      v-else-if="!hasTourUuid"
      class="h-full flex flex-col items-center justify-center gap-2 px-4 text-center"
    >
      <p class="text-[12px] text-ink-4">
        Esta gira aún no tiene datos del servidor
      </p>
    </div>

    <div
      v-else
      class="max-w-6xl mx-auto px-6 py-6"
    >
      <!-- Tabs -->
      <div class="flex items-center gap-1.5 mb-6">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="px-3.5 py-2 rounded-full text-[12px] font-medium transition-colors cursor-pointer border-none"
          :class="activeTab === tab.key ? 'bg-glass-active text-acid' : 'bg-glass text-ink-2 hover:text-ink'"
          @click="activeTab = tab.key"
        >
          {{ t(tab.labelKey) }}
        </button>
      </div>

      <TourInsightsPanel
        v-if="activeTab === 'insights'"
        :tour-uuid="toursStore.activeTour!.uuid"
      />
      <TourDocumentsPanel
        v-else-if="activeTab === 'documents'"
        :tour-uuid="toursStore.activeTour!.uuid"
        :is-admin="isAdmin"
      />
      <ScheduleConflictsPanel
        v-else
        :tour-uuid="toursStore.activeTour!.uuid"
      />
    </div>
  </div>
</template>
