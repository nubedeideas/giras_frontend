<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '@/stores/notifications'
import { useContactsStore } from '@/stores/contacts'
import { useToursStore } from '@/stores/tours'
import ChannelBreakdown from '@/components/reports/ChannelBreakdown.vue'
import ActivityList from '@/components/reports/ActivityList.vue'
import ReportsSummaryPanel from '@/components/reports/ReportsSummaryPanel.vue'

const { t } = useI18n()
const notifStore = useNotificationsStore()
const contactStore = useContactsStore()
const toursStore = useToursStore()

const selectedTourId = ref<number | null>(null)

const filteredEvents = computed(() => {
  if (!selectedTourId.value) return notifStore.events
  return notifStore.events.filter((e) => e.tourId === selectedTourId.value)
})

const totalSent = computed(() => filteredEvents.value.reduce((s, e) => s + e.stats.sent, 0))
const totalOpened = computed(() => filteredEvents.value.reduce((s, e) => s + e.stats.opened, 0))
const totalClicked = computed(() => filteredEvents.value.reduce((s, e) => s + e.stats.clicked, 0))
const openRate = computed(() =>
  totalSent.value > 0 ? Math.round((totalOpened.value / totalSent.value) * 100) : 0,
)
const clickRate = computed(() =>
  totalSent.value > 0 ? Math.round((totalClicked.value / totalSent.value) * 100) : 0,
)

const channelStats = computed(() => {
  const channels: Record<string, { name: string; sent: number; opened: number; clicked: number; color: string }> = {
    wa: { name: t('reports.whatsapp'), sent: 0, opened: 0, clicked: 0, color: '#1fad5a' },
    sms: { name: t('reports.sms'), sent: 0, opened: 0, clicked: 0, color: '#a8d800' },
    email: { name: t('reports.email'), sent: 0, opened: 0, clicked: 0, color: '#1a8fff' },
  }
  filteredEvents.value.forEach((e) => {
    channels[e.type].sent += e.stats.sent
    channels[e.type].opened += e.stats.opened
    channels[e.type].clicked += e.stats.clicked
  })
  const maxSent = Math.max(...Object.values(channels).map((c) => c.sent), 1)
  return Object.values(channels).map((c) => ({
    ...c,
    pct: Math.round((c.sent / maxSent) * 100),
  }))
})
</script>

<template>
  <div class="h-full overflow-y-auto bg-bg-3">
    <div class="max-w-6xl mx-auto px-6 py-6">
      <!-- Sub-header: subtitle + tour filter -->
      <div class="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <p class="text-[12px] text-ink-3">Resumen de actividad de notificaciones</p>

        <!-- Tour filter -->
        <select
          class="bg-bg-3 border border-line rounded-full px-4 py-2 text-[12px] font-medium text-ink outline-none focus:border-acid cursor-pointer"
          :value="selectedTourId ?? ''"
          @change="selectedTourId = ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null"
        >
          <option value="">{{ t('reports.allTours') }}</option>
          <option v-for="tour in toursStore.tours" :key="tour.id" :value="tour.id">
            {{ tour.artist_name }} — {{ tour.name }}
          </option>
        </select>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Left column: tables -->
        <div class="lg:col-span-2 space-y-4">
          <ChannelBreakdown
            :channels="channelStats"
            :title="t('reports.byChannel')"
            :labels="{
              sent: t('reports.sentLabel'),
              opened: t('reports.openedLabel'),
              clicked: t('reports.clickedLabel'),
            }"
          />

          <!-- Tour breakdown -->
          <div class="bg-bg-3 border border-line rounded-lg shadow-[0_1px_3px_var(--shadow-sm)] p-5">
            <p class="text-[9px] font-bold text-ink-3 tracking-[1px] uppercase mb-4">{{ t('reports.byTour') }}</p>
            <div class="space-y-3">
              <div
                v-for="tour in toursStore.tours"
                :key="tour.id"
                class="p-3 rounded-lg bg-bg-2 border border-line cursor-pointer transition-all hover:border-line-2"
                :class="selectedTourId === tour.id ? 'border-line-acid bg-glass-active' : ''"
                @click="selectedTourId = selectedTourId === tour.id ? null : tour.id"
              >
                <div class="flex items-center gap-2 mb-1.5">
                  <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: tour.color }" />
                  <p class="text-[12px] font-semibold text-ink truncate">{{ tour.artist_name }}</p>
                </div>
                <p class="text-[10px] text-ink-3 mb-2">{{ tour.name }}</p>
                <div class="flex gap-3 text-[10px]">
                  <span class="text-ink-3">{{ notifStore.events.filter(e => e.tourId === tour.id).length }} eventos</span>
                  <span class="text-acid font-semibold">
                    {{ notifStore.events.filter(e => e.tourId === tour.id).reduce((s, e) => s + e.stats.sent, 0) }} env.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Activity list -->
          <ActivityList
            :events="filteredEvents"
            :title="t('reports.recentActivity')"
            :labels="{
              sent: t('reports.sentLabel'),
              opened: t('reports.openedLabel'),
              clicked: t('reports.clickedLabel'),
            }"
          />
        </div>

        <!-- Right column: summary -->
        <div>
          <ReportsSummaryPanel
            :title="t('reports.title')"
            :total-sent="totalSent"
            :open-rate="openRate"
            :click-rate="clickRate"
            :total-contacts="contactStore.contacts.length"
            :labels="{
              totalSent: t('reports.totalSent'),
              openRate: t('reports.openRate'),
              clickRate: t('reports.clickRate'),
              totalContacts: t('reports.totalContacts'),
            }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
