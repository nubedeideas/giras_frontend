import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { NotifEvent, NewNotifForm } from '@/types'
import { mockEvents, MOCK_TODAY } from '@/data/mock'
import { useToursStore } from '@/stores/tours'

export const useNotificationsStore = defineStore('notifications', () => {
  const events = ref<NotifEvent[]>([...mockEvents])
  const selectedId = ref<number | null>(1)
  const filterTab = ref<'all' | 'pending'>('all')
  const searchQuery = ref('')

  const toursStore = useToursStore()

  // Clear selection when active tour changes
  watch(
    () => toursStore.activeTourId,
    () => {
      selectedId.value = null
    },
  )

  const filtered = computed(() => {
    let list = events.value

    // Global tour filter
    if (toursStore.activeTourId) {
      list = list.filter((e) => e.tourId === toursStore.activeTourId)
    }

    // Chronological filter: "pending" = today onwards (>= mock reference date)
    if (filterTab.value === 'pending') {
      list = list.filter((e) => e.isoDate >= MOCK_TODAY)
    }

    // Search
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.city.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q),
      )
    }

    return list
  })

  const groupedEvents = computed(() => {
    const map = new Map<string, NotifEvent[]>()
    filtered.value.forEach((e) => {
      if (!map.has(e.dateGroup)) map.set(e.dateGroup, [])
      map.get(e.dateGroup)!.push(e)
    })
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
  })

  const selectedEvent = computed(
    () => events.value.find((e) => e.id === selectedId.value) ?? null,
  )

  function selectEvent(id: number) {
    selectedId.value = id
  }

  function clearSelection() {
    selectedId.value = null
  }

  function saveNotification(eventId: number, form: NewNotifForm) {
    const ev = events.value.find((e) => e.id === eventId)
    if (!ev) return
    console.log('Saved notification for event', eventId, form)
  }

  return {
    events,
    selectedId,
    filterTab,
    searchQuery,
    filtered,
    groupedEvents,
    selectedEvent,
    selectEvent,
    clearSelection,
    saveNotification,
  }
})
