<script setup lang="ts">
import { ref } from 'vue'
import { useNotificationsStore } from '@/stores/notifications'
import NotifListPanel from '@/components/notifications/NotifListPanel.vue'
import NotifDetail from '@/components/notifications/NotifDetail.vue'
import ImportCalModal from '@/components/modals/ImportCalModal.vue'
import ImportContactsModal from '@/components/modals/ImportContactsModal.vue'

const store = useNotificationsStore()
const showImportCal = ref(false)
const showImportContacts = ref(false)
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- List panel -->
    <NotifListPanel @open-import-cal="showImportCal = true" />

    <!-- Detail panel -->
    <div class="flex-1 overflow-hidden">
      <Transition name="fade">
        <NotifDetail
          v-if="store.selectedEvent"
          :event="store.selectedEvent"
          @close="store.clearSelection()"
          @open-import-contacts="showImportContacts = true"
        />
        <div
          v-else
          class="flex-1 h-full bg-bg-3 flex flex-col items-center justify-center gap-2.5 text-ink-3"
        >
          <div
            class="w-12 h-12 rounded-[15px] bg-glass border border-line flex items-center justify-center"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-ink-4"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <p class="text-[12px]">
            {{ $t('notif.selectEvent') }}
          </p>
        </div>
      </Transition>
    </div>

    <!-- Modals -->
    <ImportCalModal
      :show="showImportCal"
      @close="showImportCal = false"
    />
    <ImportContactsModal
      :show="showImportContacts"
      @close="showImportContacts = false"
    />
  </div>
</template>
