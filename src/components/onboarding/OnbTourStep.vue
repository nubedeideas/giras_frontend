<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { searchSpotifyArtists, formatFollowers, type SpotifyArtist } from '@/composables/useSpotifySearch'
import { useToursStore } from '@/stores/tours'
import type { CreateTourPayload } from '@/composables/useTours'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'

const emit = defineEmits<{ next: [tourId: number] }>()

const toursStore = useToursStore()

// ─── Spotify search ───────────────────────────────────────────────────────────

const query = ref('')
const artists = ref<SpotifyArtist[]>([])
const searching = ref(false)
const searchError = ref('')
const selectedArtist = ref<SpotifyArtist | null>(null)
const spotifyUnavailable = ref(false)
const manualArtistInput = ref('')

let debounceTimer: ReturnType<typeof setTimeout>

function onQueryInput() {
  clearTimeout(debounceTimer)
  searchError.value = ''
  if (!query.value.trim()) {
    artists.value = []
    return
  }
  debounceTimer = setTimeout(doSearch, 320)
}

async function doSearch() {
  searching.value = true
  try {
    artists.value = await searchSpotifyArtists(query.value.trim())
    spotifyUnavailable.value = false
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('502') || msg.includes('503')) {
      spotifyUnavailable.value = true
      manualArtistInput.value = query.value.trim()
    } else {
      searchError.value = 'No se pudo conectar con Spotify'
    }
    artists.value = []
  } finally {
    searching.value = false
  }
}

function selectArtist(a: SpotifyArtist) {
  selectedArtist.value = a
  form.name = `${a.name} Tour`
  form.artist_name = a.name
  artists.value = []
  query.value = ''
}

function clearArtist() {
  selectedArtist.value = null
  form.artist_name = ''
  if (spotifyUnavailable.value) manualArtistInput.value = form.artist_name
}

function confirmManualArtist() {
  const name = manualArtistInput.value.trim()
  if (!name) return
  selectedArtist.value = {
    id: '',
    name,
    external_urls: { spotify: '' },
    images: [],
    followers: { total: 0 },
    genres: [],
  }
  form.artist_name = name
  if (!form.name) form.name = `${name} Tour`
  manualArtistInput.value = ''
}

// deterministic gradient from artist name
function artistGradient(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  const h1 = Math.abs(h) % 360
  const h2 = (h1 + 45) % 360
  return `linear-gradient(135deg, hsl(${h1},65%,42%), hsl(${h2},75%,30%))`
}

function artistInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ─── Tour form ────────────────────────────────────────────────────────────────

const form = reactive({
  name: '',
  artist_name: '',
  start_date: '',
  end_date: '',
  start_city: '',
  end_city: '',
  notes: '',
})

const submitting = ref(false)
const submitError = ref('')

const formValid = computed(
  () => form.name.trim() && form.artist_name.trim() && form.start_date && form.end_date,
)

async function submit() {
  if (!formValid.value) return
  submitting.value = true
  submitError.value = ''
  try {
    const payload: CreateTourPayload = {
      name: form.name.trim(),
      artist_name: form.artist_name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      notes: form.notes.trim() || undefined,
      settings: {
        start_city: form.start_city.trim(),
        end_city: form.end_city.trim(),
      },
    }
    if (selectedArtist.value?.id) {
      payload.spotify_artist_id = selectedArtist.value.id
      payload.spotify_artist_url = selectedArtist.value.external_urls.spotify
      payload.spotify_followers = selectedArtist.value.followers.total
      if (selectedArtist.value.images[0]?.url) {
        payload.spotify_image_url = selectedArtist.value.images[0].url
      }
    }
    const tour = await toursStore.createTour(payload)
    emit('next', tour.id)
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Error al crear la gira'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <!-- Artist search -->
    <div class="mb-4">
      <label class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase block mb-1.5">
        Buscar artista en Spotify
      </label>

      <!-- Selected artist card -->
      <div
        v-if="selectedArtist"
        class="flex items-center gap-3 bg-glass border border-line-acid rounded-xl px-3 py-2.5 mb-3"
      >
        <!-- Avatar -->
        <div
          class="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-[13px] font-bold text-white overflow-hidden"
          :style="selectedArtist.images[0] ? {} : { background: artistGradient(selectedArtist.name) }"
        >
          <img
            v-if="selectedArtist.images[0]"
            :src="selectedArtist.images[0].url"
            class="w-full h-full object-cover"
            :alt="selectedArtist.name"
          >
          <span v-else>{{ artistInitials(selectedArtist.name) }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-bold text-ink leading-tight">{{ selectedArtist.name }}</p>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span v-if="selectedArtist.followers.total > 0" class="text-[10px] px-1.5 py-0.5 rounded bg-acid-dim text-acid-muted font-medium">
              {{ formatFollowers(selectedArtist.followers.total) }} seguidores
            </span>
            <span v-else class="text-[10px] px-1.5 py-0.5 rounded bg-glass border border-line text-ink-4 font-medium">
              Artista manual
            </span>
            <span
              v-for="g in selectedArtist.genres.slice(0, 2)"
              :key="g"
              class="text-[10px] px-1.5 py-0.5 rounded bg-glass border border-line text-ink-3"
            >
              {{ g }}
            </span>
          </div>
        </div>
        <button
          class="text-ink-4 hover:text-ink transition-colors bg-transparent border-none cursor-pointer p-1"
          @click="clearArtist"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Manual mode (Spotify unavailable) -->
      <div v-else-if="spotifyUnavailable" class="space-y-2">
        <div class="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p class="text-[11px] text-amber-400 leading-tight">
            Spotify no disponible — ingresa el nombre del artista manualmente
          </p>
        </div>
        <div class="flex gap-2">
          <input
            v-model="manualArtistInput"
            placeholder="Nombre del artista"
            class="flex-1 bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4"
            @keydown.enter="confirmManualArtist"
          >
          <button
            class="flex-shrink-0 px-3 py-2 rounded bg-acid text-black text-[11px] font-bold disabled:opacity-40 transition-opacity"
            :disabled="!manualArtistInput.trim()"
            @click="confirmManualArtist"
          >
            Agregar
          </button>
        </div>
      </div>

      <!-- Search input -->
      <div v-else>
        <div class="flex items-center gap-2 bg-glass border border-line rounded px-2.5 py-2 focus-within:border-acid transition-colors">
          <svg
            v-if="!searching"
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ink-4 flex-shrink-0"
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <svg
            v-else
            class="animate-spin text-acid flex-shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
          </svg>
          <input
            v-model="query"
            placeholder="Duki, Bizarrap, Bad Bunny..."
            class="flex-1 bg-transparent border-none outline-none text-ink text-[12px] placeholder:text-ink-4"
            @input="onQueryInput"
          >
        </div>

        <!-- Results -->
        <div v-if="artists.length" class="mt-2 grid grid-cols-3 gap-2">
          <button
            v-for="a in artists"
            :key="a.id"
            class="flex flex-col items-center gap-1.5 bg-glass border border-line rounded-xl p-2.5 cursor-pointer hover:border-line-acid hover:bg-glass-hover transition-all duration-150 text-center group"
            @click="selectArtist(a)"
          >
            <div
              class="w-12 h-12 rounded-lg flex items-center justify-center text-[14px] font-bold text-white overflow-hidden flex-shrink-0"
              :style="a.images[0] ? {} : { background: artistGradient(a.name) }"
            >
              <img
                v-if="a.images[0]"
                :src="a.images[0].url"
                class="w-full h-full object-cover"
                :alt="a.name"
              >
              <span v-else>{{ artistInitials(a.name) }}</span>
            </div>
            <p class="text-[11px] font-semibold text-ink leading-tight group-hover:text-acid transition-colors line-clamp-2">
              {{ a.name }}
            </p>
            <span class="text-[9px] text-ink-4">{{ formatFollowers(a.followers.total) }}</span>
          </button>
        </div>

        <p v-if="searchError" class="text-[11px] text-ink-3 mt-1.5 text-center">
          {{ searchError }} — puedes continuar sin seleccionar
        </p>
      </div>
    </div>

    <!-- Tour form -->
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase block mb-1">
            Nombre de la gira *
          </label>
          <input
            v-model="form.name"
            placeholder="MTZ Tour 2025"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4"
          >
        </div>
        <div>
          <label class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase block mb-1">
            Artista *
          </label>
          <input
            v-model="form.artist_name"
            placeholder="Nombre del artista"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4"
          >
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase block mb-1">
            Inicio *
          </label>
          <input
            v-model="form.start_date"
            type="date"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors"
          >
        </div>
        <div>
          <label class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase block mb-1">
            Fin *
          </label>
          <input
            v-model="form.end_date"
            type="date"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors"
          >
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase block mb-1">
            Ciudad de inicio
          </label>
          <input
            v-model="form.start_city"
            placeholder="Ciudad de México"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4"
          >
        </div>
        <div>
          <label class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase block mb-1">
            Ciudad de fin
          </label>
          <input
            v-model="form.end_city"
            placeholder="Buenos Aires"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4"
          >
        </div>
      </div>

      <div>
        <label class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase block mb-1">
          Notas
        </label>
        <textarea
          v-model="form.notes"
          rows="2"
          placeholder="Información adicional sobre la gira..."
          class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[12px] outline-none focus:border-acid transition-colors placeholder:text-ink-4 resize-none"
        />
      </div>
    </div>

    <p v-if="submitError" class="text-[11px] text-red-400 mt-2">{{ submitError }}</p>

    <div class="mt-5">
      <BtnPrimary full :disabled="!formValid || submitting" @click="submit">
        <svg
          v-if="submitting"
          class="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
        </svg>
        <svg
          v-else
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        {{ submitting ? 'Creando gira...' : 'Continuar' }}
      </BtnPrimary>
    </div>
  </div>
</template>
