import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useToursStore } from '@/stores/tours'
import { useActivities, type ActivityListItem, type Activity } from '@/composables/useActivities'

// ─── Date grouping helper ─────────────────────────────────────────────────────

function getDateGroup(scheduledAt: string): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const date = new Date(scheduledAt)
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffMs = dateOnly.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'Pasadas'
  if (diffDays === 0) {
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return `Hoy — ${date.getDate()} ${months[date.getMonth()]}`
  }
  if (diffDays <= 7) return 'Esta Semana'
  return 'Próximamente'
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useActivitiesStore = defineStore('activities', () => {
  const api = useActivities()
  const toursStore = useToursStore()

  const activities = ref<ActivityListItem[]>([])
  const selectedUuid = ref<string | null>(null)
  const selectedDetail = ref<Activity | null>(null)
  const loadingDetail = ref(false)

  const filterTab = ref<'all' | 'upcoming' | 'past'>('all')
  const filterCategory = ref<string[]>([])
  const searchQuery = ref('')

  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────────

  async function loadActivities() {
    const tourUuid = toursStore.activeTour?.uuid
    if (!tourUuid) {
      activities.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      activities.value = await api.listActivities({ tour: tourUuid })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar actividades'
    } finally {
      loading.value = false
    }
  }

  // Reload when active tour changes
  watch(() => toursStore.activeTourId, () => {
    selectedUuid.value = null
    selectedDetail.value = null
    loadActivities()
  })

  // ── Selection ─────────────────────────────────────────────────────────────

  async function selectActivity(uuid: string) {
    if (selectedUuid.value === uuid) return
    selectedUuid.value = uuid
    selectedDetail.value = null
    loadingDetail.value = true
    try {
      selectedDetail.value = await api.getActivity(uuid)
    } finally {
      loadingDetail.value = false
    }
  }

  function clearSelection() {
    selectedUuid.value = null
    selectedDetail.value = null
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  function addActivity(item: ActivityListItem) {
    activities.value.unshift(item)
  }

  function replaceActivity(updated: ActivityListItem) {
    const idx = activities.value.findIndex((a) => a.uuid === updated.uuid)
    if (idx >= 0) activities.value[idx] = updated
    if (selectedDetail.value?.uuid === updated.uuid) {
      // Patch detail fields that are in the list item
      Object.assign(selectedDetail.value, {
        title: updated.title,
        status: updated.status,
        priority: updated.priority,
        scheduled_at: updated.scheduled_at,
        end_at: updated.end_at,
      })
    }
  }

  function removeActivity(uuid: string) {
    activities.value = activities.value.filter((a) => a.uuid !== uuid)
    if (selectedUuid.value === uuid) clearSelection()
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const filtered = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayMs = today.getTime()

    let list = activities.value

    if (filterTab.value === 'upcoming') {
      list = list.filter((a) => new Date(a.scheduled_at).getTime() >= todayMs)
    } else if (filterTab.value === 'past') {
      list = list.filter((a) => new Date(a.scheduled_at).getTime() < todayMs)
    }

    if (filterCategory.value.length > 0) {
      list = list.filter((a) => filterCategory.value.includes(a.category))
    }

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.activity_type_name.toLowerCase().includes(q) ||
          a.location_name.toLowerCase().includes(q),
      )
    }

    return [...list].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    )
  })

  const groupedActivities = computed(() => {
    const map = new Map<string, ActivityListItem[]>()
    // Preserve display order: Pasadas first (if showing all/past), then chronological
    const ORDER = ['Pasadas', 'Hoy', 'Esta Semana', 'Próximamente']
    filtered.value.forEach((a) => {
      const g = getDateGroup(a.scheduled_at)
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(a)
    })
    // Sort groups in display order
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        const ai = ORDER.findIndex((o) => a.startsWith(o.split('—')[0].trim()))
        const bi = ORDER.findIndex((o) => b.startsWith(o.split('—')[0].trim()))
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })
      .map(([label, items]) => ({ label, items }))
  })

  function toggleCategory(value: string) {
    const idx = filterCategory.value.indexOf(value)
    if (idx >= 0) filterCategory.value.splice(idx, 1)
    else filterCategory.value.push(value)
  }

  return {
    activities,
    selectedUuid,
    selectedDetail,
    loadingDetail,
    filterTab,
    filterCategory,
    toggleCategory,
    searchQuery,
    loading,
    error,
    filtered,
    groupedActivities,
    loadActivities,
    selectActivity,
    clearSelection,
    addActivity,
    replaceActivity,
    removeActivity,
  }
})
