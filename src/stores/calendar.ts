import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CalendarEvent, DayCell } from '@/types'
import { mockCalendarEvents } from '@/data/mock'
import { useToursStore } from '@/stores/tours'

function toIso(date: Date): string {
  return date.toISOString().split('T')[0]
}

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

export const useCalendarStore = defineStore('calendar', () => {
  const calendarEvents = ref<CalendarEvent[]>([...mockCalendarEvents])
  // Start on April 2025 to match mock data
  const currentYear = ref(2025)
  const currentMonth = ref(3) // 0-indexed: 3 = April
  const selectedDate = ref<string | null>('2025-04-05')

  const toursStore = useToursStore()

  // filterTourId delegates to the global tours store (read-only computed)
  const filterTourId = computed(() => toursStore.activeTourId)

  // setFilterTour delegates to the global tours store
  function setFilterTour(id: number | null) {
    toursStore.setActiveTour(id)
  }

  const filteredEvents = computed(() => {
    if (!filterTourId.value) return calendarEvents.value
    return calendarEvents.value.filter((e) => e.tourId === filterTourId.value)
  })

  const eventsForSelectedDate = computed(() => {
    if (!selectedDate.value) return []
    return filteredEvents.value.filter((e) => e.isoDate === selectedDate.value)
  })

  const upcomingEvents = computed(() => {
    return [...filteredEvents.value].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
  })

  const daysGrid = computed((): DayCell[] => {
    const year = currentYear.value
    const month = currentMonth.value
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Monday-first: 0=Mon … 6=Sun
    const startDow = (firstDay.getDay() + 6) % 7

    const cells: DayCell[] = []

    // Padding — previous month
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      const iso = toIso(d)
      cells.push({
        isoDate: iso,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: isToday(d),
        events: filteredEvents.value.filter((e) => e.isoDate === iso),
      })
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i)
      const iso = toIso(d)
      cells.push({
        isoDate: iso,
        dayNum: i,
        isCurrentMonth: true,
        isToday: isToday(d),
        events: filteredEvents.value.filter((e) => e.isoDate === iso),
      })
    }

    // Padding — next month (fill to 42 cells = 6 rows)
    const remaining = 42 - cells.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      const iso = toIso(d)
      cells.push({
        isoDate: iso,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: isToday(d),
        events: filteredEvents.value.filter((e) => e.isoDate === iso),
      })
    }

    return cells
  })

  function prevMonth() {
    if (currentMonth.value === 0) {
      currentMonth.value = 11
      currentYear.value--
    } else {
      currentMonth.value--
    }
  }

  function nextMonth() {
    if (currentMonth.value === 11) {
      currentMonth.value = 0
      currentYear.value++
    } else {
      currentMonth.value++
    }
  }

  function selectDate(iso: string) {
    selectedDate.value = selectedDate.value === iso ? null : iso
  }

  return {
    calendarEvents,
    currentYear,
    currentMonth,
    selectedDate,
    filterTourId,
    daysGrid,
    eventsForSelectedDate,
    upcomingEvents,
    prevMonth,
    nextMonth,
    selectDate,
    setFilterTour,
  }
})
