<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToursStore } from '@/stores/tours'
import { useTours as useToursApi } from '@/composables/useTours'
import type { Tour, TourStatus } from '@/types'
import { searchSpotifyArtists, formatFollowers } from '@/composables/useSpotifySearch'
import type { SpotifyArtist } from '@/composables/useSpotifySearch'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import AssignCalendarModal from '@/components/modals/AssignCalendarModal.vue'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const toursStore = useToursStore()
const toursApi = useToursApi()

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = ['#a8d800', '#1a8fff', '#e85d00', '#9b5de5', '#e91e8c', '#1fad5a']

const STATUS_OPTIONS: { value: TourStatus; labelKey: string; dot: string }[] = [
  { value: 'draft',     labelKey: 'tours.statusDraft',     dot: '#50505e' },
  { value: 'active',    labelKey: 'tours.statusActive',    dot: '#a8d800' },
  { value: 'completed', labelKey: 'tours.statusCompleted', dot: '#1a8fff' },
  { value: 'cancelled', labelKey: 'tours.statusCancelled', dot: '#e85d00' },
]

const CURRENCIES = ['EUR', 'USD', 'MXN', 'GBP', 'ARS', 'COP', 'CLP', 'BRL']

// ─── Panel mode ───────────────────────────────────────────────────────────────

type Mode = 'list' | 'create' | 'edit'
const mode = ref<Mode>('list')
const editTarget = ref<Tour | null>(null)
const deletingUuid = ref<string | null>(null)
const assignCalTour = ref<Tour | null>(null)

// ─── Shared form ──────────────────────────────────────────────────────────────

const form = reactive({
  name: '',
  artist_name: '',
  description: '',
  genre: '',
  start_date: '',
  end_date: '',
  status: 'draft' as TourStatus,
  budget: '',
  currency: 'EUR',
  team_size: '' as number | '',
  notes: '',
  color: COLORS[0],
  spotify_artist_id: '',
  spotify_artist_url: '',
  spotify_image_url: '',
  spotify_followers: undefined as number | undefined,
  spotify_synced_at: '',
})

const formError = ref('')
const saving = ref(false)
const loadingEdit = ref(false)

// ─── Spotify search ───────────────────────────────────────────────────────────

const spotifyResults = ref<SpotifyArtist[]>([])
const spotifyLoading = ref(false)
const spotifyError = ref('')
const showDropdown = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function clearSpotifyLink() {
  form.spotify_artist_id = ''
  form.spotify_artist_url = ''
  form.spotify_image_url = ''
  form.spotify_followers = undefined
  form.spotify_synced_at = ''
  spotifyError.value = ''
}

function handleArtistInput() {
  if (form.spotify_artist_id) clearSpotifyLink()
  if (debounceTimer) clearTimeout(debounceTimer)
  spotifyError.value = ''
  const q = form.artist_name.trim()
  if (q.length < 4) {
    spotifyResults.value = []
    showDropdown.value = false
    return
  }
  debounceTimer = setTimeout(async () => {
    spotifyLoading.value = true
    showDropdown.value = true
    try {
      spotifyResults.value = await searchSpotifyArtists(q)
    } catch (err) {
      console.error('[Spotify]', err)
      spotifyResults.value = []
      spotifyError.value = err instanceof Error ? err.message : 'Error al buscar en Spotify'
    } finally {
      spotifyLoading.value = false
    }
  }, 350)
}

function selectArtist(artist: SpotifyArtist) {
  form.artist_name = artist.name
  form.spotify_artist_id = artist.id
  form.spotify_artist_url = artist.external_urls.spotify
  form.spotify_image_url = artist.images[0]?.url ?? ''
  form.spotify_followers = artist.followers.total
  form.spotify_synced_at = new Date().toISOString()
  showDropdown.value = false
  spotifyResults.value = []
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
}

function closeDropdown() {
  setTimeout(() => { showDropdown.value = false }, 200)
}

const isFormValid = computed(
  () => form.name.trim().length > 0 && form.artist_name.trim().length > 0,
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusLabel(status: TourStatus) {
  return t(STATUS_OPTIONS.find((s) => s.value === status)?.labelKey ?? 'tours.statusDraft')
}

function statusDot(status: TourStatus) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.dot ?? '#50505e'
}

function resetForm() {
  Object.assign(form, {
    name: '', artist_name: '', description: '', genre: '',
    start_date: '', end_date: '', status: 'draft',
    budget: '', currency: 'EUR', team_size: '', notes: '',
    color: COLORS[0],
    spotify_artist_id: '', spotify_artist_url: '', spotify_image_url: '',
    spotify_followers: undefined, spotify_synced_at: '',
  })
  formError.value = ''
  spotifyError.value = ''
  spotifyResults.value = []
  showDropdown.value = false
}

function validateDates(): boolean {
  if (form.start_date && form.end_date && form.end_date < form.start_date) {
    formError.value = 'La fecha de fin debe ser posterior a la fecha de inicio'
    return false
  }
  formError.value = ''
  return true
}

// ─── List mode actions ────────────────────────────────────────────────────────

function selectTour(id: number | null) {
  toursStore.setActiveTour(id)
}

function openCreate() {
  resetForm()
  mode.value = 'create'
  deletingUuid.value = null
}

async function openEdit(tour: Tour) {
  deletingUuid.value = null
  loadingEdit.value = true
  mode.value = 'edit'
  editTarget.value = tour
  // Pre-fill from list data while fetching full detail
  Object.assign(form, {
    name: tour.name,
    artist_name: tour.artist_name,
    description: tour.description ?? '',
    genre: tour.genre ?? '',
    start_date: tour.start_date,
    end_date: tour.end_date,
    status: tour.status,
    budget: tour.budget ?? '',
    currency: tour.currency || 'EUR',
    team_size: tour.team_size ?? '',
    notes: tour.notes ?? '',
    color: tour.color,
    spotify_artist_id: tour.spotify_artist_id ?? '',
    spotify_artist_url: tour.spotify_artist_url ?? '',
    spotify_image_url: tour.spotify_image_url ?? '',
    spotify_followers: tour.spotify_followers,
    spotify_synced_at: tour.spotify_synced_at ?? '',
  })
  formError.value = ''
  spotifyResults.value = []
  showDropdown.value = false

  // Fetch full detail from API for complete fields
  try {
    const full = await toursApi.getTour(tour.uuid)
    Object.assign(form, {
      description: full.description ?? '',
      genre: full.genre ?? '',
      budget: full.budget ?? '',
      currency: full.currency || 'EUR',
      team_size: full.team_size ?? '',
      notes: full.notes ?? '',
      spotify_artist_id: full.spotify_artist_id ?? '',
      spotify_artist_url: full.spotify_artist_url ?? '',
      spotify_followers: full.spotify_followers ?? undefined,
      spotify_synced_at: full.spotify_synced_at ?? '',
      color: (full.settings?.color as string) || tour.color,
    })
  } catch {
    // Silently continue with list data if detail fetch fails
  } finally {
    loadingEdit.value = false
  }
}

function backToList() {
  mode.value = 'list'
  editTarget.value = null
  formError.value = ''
  saving.value = false
}

// ─── Create ───────────────────────────────────────────────────────────────────

async function submitCreate() {
  if (!isFormValid.value || !validateDates() || saving.value) return
  saving.value = true
  formError.value = ''
  try {
    const tour = await toursStore.createTour(
      {
        name: form.name.trim(),
        artist_name: form.artist_name.trim(),
        description: form.description.trim() || undefined,
        genre: form.genre.trim() || undefined,
        start_date: form.start_date,
        end_date: form.end_date,
        budget: form.budget || undefined,
        currency: form.currency,
        team_size: form.team_size !== '' ? Number(form.team_size) : undefined,
        notes: form.notes.trim() || undefined,
        spotify_artist_url: form.spotify_artist_url || undefined,
        spotify_artist_id: form.spotify_artist_id || undefined,
        spotify_image_url: form.spotify_image_url || undefined,
        spotify_followers: form.spotify_followers,
        spotify_synced_at: form.spotify_synced_at || undefined,
      },
      form.color,
    )
    toursStore.setActiveTour(tour.id)
    backToList()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Error al crear gira'
  } finally {
    saving.value = false
  }
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

async function submitEdit() {
  if (!editTarget.value || !isFormValid.value || !validateDates() || saving.value) return
  saving.value = true
  formError.value = ''
  try {
    await toursStore.updateTour(
      editTarget.value.uuid,
      {
        name: form.name.trim(),
        artist_name: form.artist_name.trim(),
        description: form.description.trim() || undefined,
        genre: form.genre.trim() || undefined,
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        budget: form.budget || undefined,
        currency: form.currency,
        team_size: form.team_size !== '' ? Number(form.team_size) : undefined,
        notes: form.notes.trim() || undefined,
        spotify_artist_url: form.spotify_artist_url || null,
        spotify_artist_id: form.spotify_artist_id || null,
        spotify_image_url: form.spotify_image_url || null,
        spotify_followers: form.spotify_followers ?? null,
        spotify_synced_at: form.spotify_synced_at || null,
      },
      form.color,
    )
    backToList()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Error al guardar gira'
  } finally {
    saving.value = false
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

const deleteError = ref('')
const deleting = ref(false)

async function confirmDelete(uuid: string) {
  deleting.value = true
  deleteError.value = ''
  try {
    await toursStore.deleteTour(uuid)
    deletingUuid.value = null
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Error al eliminar'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="tp-fade">
      <div v-if="show" class="fixed inset-0 z-[55]" @click="emit('close')" />
    </Transition>

    <!-- Panel -->
    <Transition name="tp-slide">
      <div
        v-if="show"
        class="sidebar-dark fixed left-16 top-0 h-screen w-[256px] bg-bg-2 border-r border-line z-[56] flex flex-col"
        style="box-shadow: 4px 0 28px var(--shadow-md)"
      >
        <!-- ═══════════════════════════════ LIST MODE ═══════════════════════════════ -->
        <template v-if="mode === 'list'">
          <!-- Header -->
          <div class="flex items-center justify-between px-3.5 py-3 border-b border-line flex-shrink-0">
            <span class="text-[11px] font-bold text-ink tracking-[0.5px] uppercase">
              {{ t('tours.title') }}
            </span>
            <div class="flex items-center gap-1.5">
              <BtnPrimary small @click="openCreate">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {{ t('tours.newTour') }}
              </BtnPrimary>
              <button
                class="w-[22px] h-[22px] flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent"
                @click="emit('close')"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Loading -->
          <div v-if="toursStore.loading" class="flex-1 flex items-center justify-center">
            <svg class="animate-spin text-ink-4" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
            </svg>
          </div>

          <template v-else>
            <!-- Tour list -->
            <div class="flex-1 overflow-y-auto py-1">
              <!-- All tours -->
              <button
                class="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-glass-hover cursor-pointer border-none bg-transparent"
                :class="!toursStore.activeTourId ? 'text-acid' : 'text-ink-2'"
                @click="selectTour(null)"
              >
                <div
                  class="w-2 h-2 rounded-full flex-shrink-0 border transition-colors"
                  :class="!toursStore.activeTourId ? 'bg-acid border-acid' : 'border-line-2'"
                />
                <span class="text-[12px] font-medium flex-1 text-left">{{ t('tours.allTours') }}</span>
                <svg v-if="!toursStore.activeTourId" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>

              <div class="h-px bg-line mx-3 my-0.5" />

              <!-- Tour rows -->
              <div v-for="tour in toursStore.activeTours" :key="tour.uuid">
                <!-- Delete confirm -->
                <div v-if="deletingUuid === tour.uuid" class="px-3.5 py-3 bg-glass-hover">
                  <p class="text-[11px] font-medium text-ink-2 mb-1">{{ t('tours.deleteConfirm') }}</p>
                  <p class="text-[10px] text-ink-3 mb-2 truncate">{{ tour.artist_name }} — {{ tour.name }}</p>
                  <p v-if="deleteError" class="text-[10px] text-red-400 mb-2">{{ deleteError }}</p>
                  <div class="flex gap-1.5">
                    <button
                      class="flex-1 py-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer border-none"
                      style="background: rgba(239,68,68,0.2); color: #f87171"
                      :class="deleting ? 'opacity-50' : ''"
                      :disabled="deleting"
                      @click="confirmDelete(tour.uuid)"
                    >
                      {{ deleting ? '…' : t('tours.deleteYes') }}
                    </button>
                    <button
                      class="flex-1 py-1.5 rounded text-[11px] font-medium bg-glass text-ink-2 hover:bg-glass-hover transition-colors cursor-pointer border border-line"
                      @click="deletingUuid = null; deleteError = ''"
                    >
                      {{ t('common.cancel') }}
                    </button>
                  </div>
                </div>

                <!-- Normal row -->
                <div v-else class="group/row">
                  <button
                    class="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-glass-hover cursor-pointer border-none bg-transparent"
                    :class="toursStore.activeTourId === tour.id ? 'bg-glass' : ''"
                    @click="selectTour(tour.id)"
                  >
                    <div class="w-2 h-2 rounded-full flex-shrink-0 mt-0.5" :style="{ background: tour.color }" />
                    <div class="flex-1 min-w-0">
                      <p class="text-[12px] font-medium text-ink truncate leading-snug">
                        {{ tour.artist_name }} — {{ tour.name }}
                      </p>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" :style="{ background: statusDot(tour.status) }" />
                        <p class="text-[10px] text-ink-3 leading-tight">{{ statusLabel(tour.status) }}</p>
                        <span v-if="tour.members_count" class="text-[10px] text-ink-4">
                          · {{ tour.members_count }} miembros
                        </span>
                      </div>
                    </div>
                    <svg v-if="toursStore.activeTourId === tour.id" class="flex-shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <!-- Hover actions -->
                  <div class="hidden group-hover/row:flex items-center gap-0.5 px-3.5 pb-2 -mt-1">
                    <button
                      class="flex items-center gap-1 text-[10px] text-ink-3 hover:text-ink-2 transition-colors px-1.5 py-1 rounded hover:bg-glass cursor-pointer border-none bg-transparent"
                      @click.stop="openEdit(tour)"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      {{ t('tours.edit') }}
                    </button>
                    <button
                      class="flex items-center gap-1 text-[10px] transition-colors px-1.5 py-1 rounded hover:bg-glass cursor-pointer border-none bg-transparent"
                      :class="tour.default_calendar_id ? 'text-acid hover:text-acid' : 'text-ink-3 hover:text-ink-2'"
                      @click.stop="assignCalTour = tour"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                        <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
                      </svg>
                      {{ tour.default_calendar_id ? 'Cal ●' : 'Cal' }}
                    </button>
                    <button
                      class="flex items-center gap-1 text-[10px] text-ink-3 hover:text-red-400 transition-colors px-1.5 py-1 rounded hover:bg-glass cursor-pointer border-none bg-transparent"
                      @click.stop="deletingUuid = tour.uuid; deleteError = ''"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" /><path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                      {{ t('tours.delete') }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div v-if="!toursStore.activeTours.length && !toursStore.loading" class="px-3.5 py-8 text-center">
                <p class="text-[11px] text-ink-3">{{ t('tours.noTours') }}</p>
              </div>

              <!-- API error -->
              <div v-if="toursStore.error" class="px-3.5 py-2 text-center">
                <p class="text-[10px] text-red-400">{{ toursStore.error }}</p>
                <button
                  class="mt-1 text-[10px] text-ink-3 hover:text-ink cursor-pointer border-none bg-transparent underline"
                  @click="toursStore.loadTours()"
                >
                  Reintentar
                </button>
              </div>
            </div>

          </template>
        </template>

        <!-- ══════════════════════════ CREATE / EDIT FORM ══════════════════════════ -->
        <template v-else>
          <!-- Form header -->
          <div class="flex items-center gap-2 px-3.5 py-3.5 border-b border-line flex-shrink-0">
            <button
              class="flex items-center justify-center w-[22px] h-[22px] rounded-md text-ink-3 hover:text-ink hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent flex-shrink-0"
              @click="backToList"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span class="text-[12px] font-bold text-ink flex-1 truncate">
              {{ mode === 'create' ? t('tours.newTour') : t('tours.editTitle') }}
            </span>
            <div class="w-[10px] h-[10px] rounded-full flex-shrink-0" :style="{ background: form.color }" />
          </div>

          <!-- Loading full detail -->
          <div v-if="loadingEdit" class="flex-1 flex items-center justify-center">
            <svg class="animate-spin text-ink-4" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
            </svg>
          </div>

          <!-- Form body -->
          <div v-else class="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
            <!-- Name -->
            <div>
              <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1">
                {{ t('modal.tourName') }} *
              </label>
              <input
                v-model="form.name"
                :placeholder="t('modal.tourNamePh')"
                class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
              />
            </div>

            <!-- Artist + Spotify search -->
            <div>
              <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1">
                {{ t('modal.artist') }} *
              </label>
              <div class="relative">
                <input
                  v-model="form.artist_name"
                  :placeholder="t('modal.artistPh')"
                  class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
                  :class="form.spotify_artist_id ? 'pr-7' : spotifyLoading ? 'pr-7' : ''"
                  @input="handleArtistInput"
                  @blur="closeDropdown"
                />
                <div v-if="form.spotify_artist_id" class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" title="Vinculado con Spotify">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="#1fad5a">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                </div>
                <div v-else-if="spotifyLoading" class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg class="animate-spin text-ink-4" width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
                  </svg>
                </div>
                <!-- Results dropdown -->
                <div
                  v-if="showDropdown && (spotifyResults.length > 0 || spotifyLoading)"
                  class="absolute left-0 right-0 top-full mt-1 bg-bg border border-line rounded-lg overflow-hidden z-[60]"
                  style="box-shadow: 0 8px 24px var(--shadow-md)"
                >
                  <div v-if="spotifyLoading && !spotifyResults.length" class="px-3 py-3 text-[11px] text-ink-3 text-center">
                    Buscando artistas...
                  </div>
                  <button
                    v-for="artist in spotifyResults"
                    :key="artist.id"
                    type="button"
                    class="w-full flex items-center gap-2.5 px-2.5 py-2 hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent text-left border-b border-line last:border-b-0"
                    @mousedown.prevent="selectArtist(artist)"
                  >
                    <div class="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden bg-glass-2 border border-line flex items-center justify-center">
                      <img v-if="artist.images[0]" :src="artist.images[0].url" :alt="artist.name" class="w-full h-full object-cover" />
                      <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-ink-4">
                        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-[12px] font-medium text-ink truncate leading-snug">{{ artist.name }}</p>
                      <p class="text-[10px] text-ink-3 leading-tight">{{ formatFollowers(artist.followers.total) }} seguidores</p>
                    </div>
                  </button>
                </div>
              </div>
              <p v-if="spotifyError" class="text-[10px] text-red-400 mt-1">{{ spotifyError }}</p>
              <div v-if="form.spotify_artist_id" class="flex items-center gap-1.5 mt-1">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="#1fad5a" class="flex-shrink-0">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                <p class="text-[10px] text-ink-3">
                  <span style="color: #1fad5a">{{ formatFollowers(form.spotify_followers!) }}</span> seguidores · Spotify
                </p>
                <button class="ml-auto text-[9px] text-ink-4 hover:text-red-400 cursor-pointer border-none bg-transparent" @click="clearSpotifyLink">
                  desvincular
                </button>
              </div>
            </div>

            <!-- Genre -->
            <div>
              <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1">{{ t('modal.genre') }}</label>
              <input v-model="form.genre" :placeholder="t('modal.genrePh')" class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors" />
            </div>

            <!-- Description -->
            <div>
              <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1">{{ t('modal.description') }}</label>
              <textarea v-model="form.description" :placeholder="t('modal.descriptionPh')" rows="2" class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors resize-none" />
            </div>

            <!-- Dates -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1">{{ t('modal.startDate') }}</label>
                <input v-model="form.start_date" type="date" class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[10px] outline-none focus:border-acid transition-colors" />
              </div>
              <div>
                <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1">{{ t('modal.endDate') }}</label>
                <input v-model="form.end_date" type="date" class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[10px] outline-none focus:border-acid transition-colors" />
              </div>
            </div>

            <!-- Status (edit only) -->
            <div v-if="mode === 'edit'">
              <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1">{{ t('modal.status') }}</label>
              <select v-model="form.status" class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid cursor-pointer transition-colors">
                <option v-for="s in STATUS_OPTIONS" :key="s.value" :value="s.value">
                  {{ t(s.labelKey) }}
                </option>
              </select>
            </div>

            <!-- Budget + Currency -->
            <div class="grid grid-cols-[1fr_80px] gap-2">
              <div>
                <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1">{{ t('modal.budget') }}</label>
                <input v-model="form.budget" type="number" min="0" step="0.01" :placeholder="t('modal.budgetPh')" class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors" />
              </div>
              <div>
                <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1">{{ t('modal.currency') }}</label>
                <select v-model="form.currency" class="w-full bg-glass border border-line rounded px-2 py-1.5 text-ink text-[11px] outline-none focus:border-acid cursor-pointer transition-colors">
                  <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
            </div>

            <!-- Team size -->
            <div>
              <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1">{{ t('modal.teamSize') }}</label>
              <input v-model.number="form.team_size" type="number" min="1" max="500" :placeholder="t('modal.teamSizePh')" class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors" />
            </div>

            <!-- Notes -->
            <div>
              <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1">{{ t('modal.notes') }}</label>
              <textarea v-model="form.notes" :placeholder="t('modal.notesPh')" rows="2" class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors resize-none" />
            </div>

            <!-- Color -->
            <div>
              <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1.5">{{ t('modal.color') }}</label>
              <div class="flex gap-2">
                <button
                  v-for="c in COLORS"
                  :key="c"
                  class="w-5 h-5 rounded-full cursor-pointer border-2 transition-all flex-shrink-0"
                  :class="form.color === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'"
                  :style="{ background: c }"
                  @click="form.color = c"
                />
              </div>
            </div>

            <p v-if="formError" class="text-[10px] text-red-400">{{ formError }}</p>
          </div>

          <!-- Form footer -->
          <div class="border-t border-line flex-shrink-0 px-3.5 py-3 flex gap-2">
            <button
              class="flex-1 py-2 rounded text-[12px] font-bold bg-acid text-black hover:opacity-90 transition-opacity cursor-pointer border-none disabled:opacity-40"
              :disabled="!isFormValid || saving || loadingEdit"
              @click="mode === 'create' ? submitCreate() : submitEdit()"
            >
              <span v-if="saving" class="flex items-center justify-center gap-1.5">
                <svg class="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
                </svg>
                {{ mode === 'create' ? 'Creando…' : 'Guardando…' }}
              </span>
              <span v-else>{{ mode === 'create' ? t('tours.create') : t('common.save') }}</span>
            </button>
            <button
              class="py-2 px-3.5 rounded text-[12px] font-medium bg-glass text-ink-2 hover:bg-glass-hover transition-colors cursor-pointer border border-line"
              @click="backToList"
            >
              {{ t('common.cancel') }}
            </button>
          </div>
        </template>
      </div>
    </Transition>
  </Teleport>

  <!-- Assign Calendar Modal -->
  <AssignCalendarModal
    :show="assignCalTour !== null"
    :tour="assignCalTour"
    @close="assignCalTour = null"
  />
</template>

<style scoped>
.tp-fade-enter-active,
.tp-fade-leave-active {
  transition: opacity 0.15s ease;
}
.tp-fade-enter-from,
.tp-fade-leave-to {
  opacity: 0;
}

.tp-slide-enter-active,
.tp-slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.tp-slide-enter-from,
.tp-slide-leave-to {
  transform: translateX(-10px);
  opacity: 0;
}
</style>
