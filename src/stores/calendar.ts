import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { DayCell } from '@/types'
import type { ActivityListItem } from '@/composables/useActivities'
import { useToursStore } from '@/stores/tours'
import { useActivitiesStore } from '@/stores/activities'

// Local YYYY-MM-DD — deliberately NOT `date.toISOString()`, which converts
// through UTC first and shifts the date by a day in positive UTC-offset
// timezones (e.g. a local midnight becomes the previous day in UTC).
function toIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

// Matches an activity's `scheduled_at` (a full ISO datetime) to the same
// day-key format `daysGrid` uses for its cells — both go through the same
// local-date → toIso() conversion, so they always line up.
function dateKeyOf(iso: string): string {
  const d = new Date(iso)
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
}

export const useCalendarStore = defineStore('calendar', () => {
  const toursStore = useToursStore()
  const activitiesStore = useActivitiesStore()

  const currentYear = ref(new Date().getFullYear())
  const currentMonth = ref(new Date().getMonth())
  const selectedDate = ref<string | null>(null)
  const viewMode = ref<'grid' | 'list'>('grid')

  // filterTourId delegates to the global tours store (read-only computed)
  const filterTourId = computed(() => toursStore.activeTourId)

  // setFilterTour delegates to the global tours store
  function setFilterTour(id: number | null) {
    toursStore.setActiveTour(id)
  }

  const tourActivities = computed(() => activitiesStore.activities)

  const activitiesForSelectedDate = computed(() => {
    if (!selectedDate.value) return []
    return tourActivities.value.filter((a) => dateKeyOf(a.scheduled_at) === selectedDate.value)
  })

  const upcomingActivities = computed(() => {
    return [...tourActivities.value].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    )
  })

  const daysGrid = computed((): DayCell[] => {
    const year = currentYear.value
    const month = currentMonth.value
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Group activities by day-key once per recompute instead of filtering
    // the full list per cell (42×).
    const byDay = new Map<string, ActivityListItem[]>()
    for (const a of tourActivities.value) {
      const key = dateKeyOf(a.scheduled_at)
      if (!byDay.has(key)) byDay.set(key, [])
      byDay.get(key)!.push(a)
    }

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
        activities: byDay.get(iso) ?? [],
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
        activities: byDay.get(iso) ?? [],
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
        activities: byDay.get(iso) ?? [],
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

  // Defaults the displayed month to the active tour's start_date, or to the
  // real current month when no tour is selected. Parses the plain
  // YYYY-MM-DD string directly (not via `new Date(startDate)`) so it can't
  // shift a month boundary depending on the viewer's UTC offset.
  function resetToDefaultMonth() {
    const startDate = toursStore.activeTour?.start_date
    if (startDate) {
      const [year, month] = startDate.split('-').map(Number)
      currentYear.value = year
      currentMonth.value = month - 1
    } else {
      const now = new Date()
      currentYear.value = now.getFullYear()
      currentMonth.value = now.getMonth()
    }
  }

  // Re-center on tour switch and drop any day/activity selection that
  // belonged to the previous tour.
  watch(() => toursStore.activeTourId, () => {
    resetToDefaultMonth()
    selectedDate.value = null
  })

  return {
    currentYear,
    currentMonth,
    selectedDate,
    viewMode,
    filterTourId,
    daysGrid,
    activitiesForSelectedDate,
    upcomingActivities,
    prevMonth,
    nextMonth,
    selectDate,
    setFilterTour,
    resetToDefaultMonth,
  }
})
