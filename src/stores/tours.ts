import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tour, TourStatus } from '@/types'
import { useTours as useToursApi } from '@/composables/useTours'
import { useAuthStore } from '@/stores/auth'
import { useReminderCatalogStore } from '@/stores/reminderCatalog'
import type {
  TourFull,
  TourListItem,
  TourUpdateResponse,
  CreateTourPayload,
  UpdateTourPayload,
  TourPauseResponse,
} from '@/composables/useTours'

// ─── Synthetic ID helpers ─────────────────────────────────────────────────────
// Se mantiene un activeTourId numérico por compatibilidad con la selección por id
// numérico que siguen usando varias vistas. Un mapa UUID → entero estable durante la
// sesión evita que el índice cambie al recargar la lista.

let _nextId = 100
const _uuidToId = new Map<string, number>()

function syntheticId(uuid: string): number {
  if (!_uuidToId.has(uuid)) _uuidToId.set(uuid, _nextId++)
  return _uuidToId.get(uuid)!
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapTour(
  data: TourFull | TourUpdateResponse | TourListItem,
  currentUserEmail?: string | null,
  previous?: Tour
): Tour {
  const full = data as Partial<TourFull>
  // `current_user_is_admin` viene en el listado y en el detalle, no en la respuesta del PATCH:
  // ahí se conserva el valor anterior. Último respaldo: el owner siempre es admin de su gira.
  const fromApi = (data as Partial<TourListItem>).current_user_is_admin
  const isAdmin =
    typeof fromApi === 'boolean'
      ? fromApi
      : (previous?.current_user_is_admin ??
        (!!currentUserEmail && data.owner_email === currentUserEmail))
  // La respuesta del PATCH no trae el estado de la pausa (solo lectura): se conserva el anterior.
  const raw = data as Partial<TourListItem>
  const enableNotifications =
    typeof raw.enable_notifications === 'boolean'
      ? raw.enable_notifications
      : (previous?.enable_notifications ?? true)
  const pausedAt =
    raw.notifications_paused_at !== undefined
      ? raw.notifications_paused_at
      : (previous?.notifications_paused_at ?? null)
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
    owner_email: data.owner_email,
    current_user_is_admin: isAdmin,
    timezone: raw.timezone || previous?.timezone || 'Europe/Madrid',
    enable_notifications: enableNotifications,
    notifications_paused_at: enableNotifications ? null : pausedAt,
    default_calendar_id: full.default_calendar ?? null,
    default_notification_group_id: full.default_notification_group ?? null,
    default_notification_group_name: full.default_notification_group_name ?? null,
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
  const auth = useAuthStore()

  function toTour(data: TourFull | TourUpdateResponse | TourListItem): Tour {
    const previous = tours.value.find((t) => t.uuid === data.uuid)
    return mapTour(data, auth.user?.email, previous)
  }

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
      tours.value = items.map(toTour)
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

  /** Activa la gira por uuid (deep links del inbox). `false` si no está en la lista. */
  function setActiveTourByUuid(uuid: string): boolean {
    const tour = tours.value.find((t) => t.uuid === uuid)
    if (!tour) return false
    setActiveTour(tour.id)
    return true
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async function createTour(payload: CreateTourPayload, color = '#a8d800'): Promise<Tour> {
    const full = await api.createTour({
      ...payload,
      settings: { ...(payload.settings ?? {}), color },
    })
    const tour = toTour(full)
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
    const updated = toTour(full)
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

  // ── Pausar / reanudar avisos ─────────────────────────────────────────────

  function applyPause(uuid: string, res: TourPauseResponse) {
    const tour = tours.value.find((t) => t.uuid === uuid)
    if (!tour) return
    tour.enable_notifications = res.enable_notifications
    tour.notifications_paused_at = res.enable_notifications
      ? null
      : (res.notifications_paused_at ?? null)
  }

  /** POST pause-notifications/: actualiza la gira en `tours` (y `activeTour`). */
  async function pauseNotifications(uuid: string): Promise<TourPauseResponse> {
    const res = await api.pauseNotifications(uuid)
    applyPause(uuid, res)
    return res
  }

  /**
   * POST resume-notifications/. Reanudar cancela lo vencido y reconcilia los recordatorios: el
   * catálogo de la gira queda obsoleto.
   */
  async function resumeNotifications(uuid: string): Promise<TourPauseResponse> {
    const res = await api.resumeNotifications(uuid)
    applyPause(uuid, res)
    void useReminderCatalogStore().invalidate(uuid)
    return res
  }

  // ── Calendar assignment ────────────────────────────────────────────────────

  async function assignCalendar(uuid: string, subscriptionId: number | null): Promise<void> {
    const full = await api.updateTour(uuid, { default_calendar: subscriptionId })
    const updated = toTour(full)
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
    setActiveTourByUuid,
    createTour,
    updateTour,
    deleteTour,
    assignCalendar,
    pauseNotifications,
    resumeNotifications,
  }
})
