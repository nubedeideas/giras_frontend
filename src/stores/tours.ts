import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tour, TourStatus } from '@/types'
import { useTours as useToursApi } from '@/composables/useTours'
import type { TourFull, TourListItem, CreateTourPayload, UpdateTourPayload } from '@/composables/useTours'

// ─── Synthetic ID helpers ─────────────────────────────────────────────────────
// We keep a numeric activeTourId for backward-compat with the notifications
// store (which filters mock events by numeric tourId). A session-stable map
// from UUID → synthetic int avoids index-drift on reload.

let _nextId = 100
const _uuidToId = new Map<string, number>()

function syntheticId(uuid: string): number {
  if (!_uuidToId.has(uuid)) _uuidToId.set(uuid, _nextId++)
  return _uuidToId.get(uuid)!
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapTour(data: TourFull | TourListItem): Tour {
  const full = data as TourFull
  return {
    id: syntheticId(data.uuid),
    uuid: data.uuid,
    name: data.name,
    artist_name: data.artist_name,
    description: full.description || undefined,
    genre: full.genre || undefined,
    start_date: data.start_date,
    end_date: data.end_date,
    status: data.status as TourStatus,
    budget: full.budget || undefined,
    currency: full.currency || 'EUR',
    team_size: full.team_size || undefined,
    notes: full.notes || undefined,
    // color is stored in settings JSONField
    color: (full.settings?.color as string) || '#a8d800',
    default_calendar_id: full.default_calendar ?? null,
    spotify_artist_id: full.spotify_artist_id || undefined,
    spotify_artist_url: full.spotify_artist_url || undefined,
    spotify_image_url: data.spotify_image_url || undefined,
    spotify_followers: full.spotify_followers || undefined,
    spotify_synced_at: full.spotify_synced_at || undefined,
    members_count: data.members_count,
    events_count: data.events_count,
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useToursStore = defineStore('tours', () => {
  const api = useToursApi()

  const tours = ref<Tour[]>([])
  const activeTourId = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Computed ──────────────────────────────────────────────────────────────

  const activeTours = computed(() => tours.value)

  const activeTour = computed(() =>
    activeTourId.value
      ? activeTours.value.find((t) => t.id === activeTourId.value) ?? null
      : null,
  )

  const tourOptions = computed(() => [
    { id: null, label: 'Todas las Giras' },
    ...activeTours.value.map((t) => ({
      id: t.id,
      label: `${t.artist_name} — ${t.name}`,
    })),
  ])

  // ── Load ──────────────────────────────────────────────────────────────────

  async function loadTours() {
    loading.value = true
    error.value = null
    try {
      const items = await api.listTours()
      tours.value = items.map(mapTour)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error al cargar giras'
    } finally {
      loading.value = false
    }
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  function setActiveTour(id: number | null) {
    activeTourId.value = id
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async function createTour(payload: CreateTourPayload, color = '#a8d800'): Promise<Tour> {
    const full = await api.createTour({
      ...payload,
      settings: { ...(payload.settings ?? {}), color },
    })
    const tour = mapTour(full)
    tours.value.push(tour)
    return tour
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async function updateTour(
    uuid: string,
    payload: UpdateTourPayload,
    color?: string,
  ): Promise<void> {
    const patchPayload: UpdateTourPayload = { ...payload }
    if (color !== undefined) {
      const existing = tours.value.find((t) => t.uuid === uuid)
      patchPayload.settings = { color }
      if (existing?.color) patchPayload.settings = { color }
    }
    const full = await api.updateTour(uuid, patchPayload)
    const updated = mapTour(full)
    const idx = tours.value.findIndex((t) => t.uuid === uuid)
    if (idx >= 0) tours.value[idx] = updated
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function deleteTour(uuid: string): Promise<void> {
    await api.deleteTour(uuid)
    const idx = tours.value.findIndex((t) => t.uuid === uuid)
    if (idx >= 0) {
      if (activeTour.value?.uuid === uuid) activeTourId.value = null
      tours.value.splice(idx, 1)
    }
  }

  // ── Calendar assignment ────────────────────────────────────────────────────

  async function assignCalendar(uuid: string, subscriptionId: number | null): Promise<void> {
    const full = await api.updateTour(uuid, { default_calendar: subscriptionId })
    const updated = mapTour(full)
    const idx = tours.value.findIndex((t) => t.uuid === uuid)
    if (idx >= 0) tours.value[idx] = updated
  }

  return {
    tours,
    activeTours,
    activeTourId,
    activeTour,
    tourOptions,
    loading,
    error,
    loadTours,
    setActiveTour,
    createTour,
    updateTour,
    deleteTour,
    assignCalendar,
  }
})
