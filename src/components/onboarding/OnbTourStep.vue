<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiError } from '@/utils/apiClient'
import { searchSpotifyArtists, formatFollowers, type SpotifyArtist } from '@/composables/useSpotifySearch'
import { useToursStore } from '@/stores/tours'
import type { CreateTourPayload } from '@/composables/useTours'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import { defaultTourZone, zoneOptions } from '@/utils/timezones'

const emit = defineEmits<{ next: [tourId: number] }>()

const { t } = useI18n()
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
    // 502/503: el proveedor de datos de artistas no responde → modo manual
    if (e instanceof ApiError && (e.status === 502 || e.status === 503)) {
      spotifyUnavailable.value = true
      manualArtistInput.value = query.value.trim()
    } else {
      searchError.value = t('onboarding.tour.spotifyError')
    }
    artists.value = []
  } finally {
    searching.value = false
  }
}

function selectArtist(a: SpotifyArtist) {
  selectedArtist.value = a
  form.name = t('onboarding.tour.defaultName', { artist: a.name })
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
  if (!form.name) form.name = t('onboarding.tour.defaultName', { artist: name })
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
  timezone: defaultTourZone(),
})

const timezoneOptions = computed(() => zoneOptions(form.timezone))

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
      timezone: form.timezone,
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
    submitError.value = e instanceof Error ? e.message : t('onboarding.tour.createError')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <!-- Artist search -->
    <div class="mb-4">
      <label class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-1.5">
        {{ t('onboarding.tour.searchLabel') }}
      </label>

      <!-- Selected artist card -->
      <div
        v-if="selectedArtist"
        class="flex items-center gap-3 bg-glass border border-line-acid rounded-xl px-3 py-2.5 mb-3"
      >
        <!-- Avatar -->
        <div
          class="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-[15px] font-bold text-white overflow-hidden"
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
          <p class="text-[15px] font-bold text-ink leading-tight">
            {{ selectedArtist.name }}
          </p>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span
              v-if="selectedArtist.followers.total > 0"
              class="text-[12px] px-1.5 py-0.5 rounded bg-acid-dim text-acid-muted font-medium"
            >
              {{ t('onboarding.tour.followers', { count: formatFollowers(selectedArtist.followers.total) }) }}
            </span>
            <span
              v-else
              class="text-[12px] px-1.5 py-0.5 rounded bg-glass border border-line text-ink-4 font-medium"
            >
              {{ t('onboarding.tour.manualArtist') }}
            </span>
            <span
              v-for="g in selectedArtist.genres.slice(0, 2)"
              :key="g"
              class="text-[12px] px-1.5 py-0.5 rounded bg-glass border border-line text-ink-3"
            >
              {{ g }}
            </span>
          </div>
        </div>
        <button
          class="text-ink-4 hover:text-ink transition-colors bg-transparent border-none cursor-pointer p-1"
          :title="t('onboarding.tour.clearArtist')"
          :aria-label="t('onboarding.tour.clearArtist')"
          @click="clearArtist"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line
              x1="18"
              y1="6"
              x2="6"
              y2="18"
            /><line
              x1="6"
              y1="6"
              x2="18"
              y2="18"
            />
          </svg>
        </button>
      </div>

      <!-- Manual mode (Spotify unavailable) -->
      <div
        v-else-if="spotifyUnavailable"
        class="space-y-2"
      >
        <div class="flex items-center gap-2 rounded-lg bg-pending-bg border border-[#FCD34D] px-3 py-2">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--pending-fg)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="flex-shrink-0"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line
              x1="12"
              y1="9"
              x2="12"
              y2="13"
            /><line
              x1="12"
              y1="17"
              x2="12.01"
              y2="17"
            />
          </svg>
          <p class="text-[13px] text-pending-fg leading-tight">
            {{ t('onboarding.tour.spotifyUnavailable') }}
          </p>
        </div>
        <div class="flex gap-2">
          <input
            v-model="manualArtistInput"
            :placeholder="t('onboarding.tour.artistPlaceholder')"
            class="flex-1 bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
            @keydown.enter="confirmManualArtist"
          >
          <button
            class="flex-shrink-0 px-3 py-2 rounded bg-acid text-ink text-[13px] font-bold disabled:opacity-40 transition-opacity"
            :disabled="!manualArtistInput.trim()"
            @click="confirmManualArtist"
          >
            {{ t('onboarding.tour.add') }}
          </button>
        </div>
      </div>

      <!-- Search input -->
      <div v-else>
        <div class="flex items-center gap-2 bg-glass border border-line rounded px-2.5 py-2 focus-within:border-olive transition-colors">
          <svg
            v-if="!searching"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-ink-4 flex-shrink-0"
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            /><line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
            />
          </svg>
          <svg
            v-else
            class="animate-spin text-olive flex-shrink-0"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="3"
              stroke-dasharray="40 22"
              stroke-linecap="round"
            />
          </svg>
          <input
            v-model="query"
            :placeholder="t('onboarding.tour.searchPlaceholder')"
            class="flex-1 bg-transparent border-none outline-none text-ink text-[14px] placeholder:text-ink-4"
            @input="onQueryInput"
          >
        </div>

        <!-- Results -->
        <div
          v-if="artists.length"
          class="mt-2 grid grid-cols-3 gap-2"
        >
          <button
            v-for="a in artists"
            :key="a.id"
            class="flex flex-col items-center gap-1.5 bg-glass border border-line rounded-xl p-2.5 cursor-pointer hover:border-line-acid hover:bg-glass-hover transition-all duration-150 text-center group"
            @click="selectArtist(a)"
          >
            <div
              class="w-12 h-12 rounded-lg flex items-center justify-center text-[15px] font-bold text-white overflow-hidden flex-shrink-0"
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
            <p class="text-[13px] font-semibold text-ink leading-tight group-hover:text-olive transition-colors line-clamp-2">
              {{ a.name }}
            </p>
            <span class="text-[12px] text-ink-4">{{ formatFollowers(a.followers.total) }}</span>
          </button>
        </div>

        <p
          v-if="searchError"
          class="text-[13px] text-ink-3 mt-1.5 text-center"
        >
          {{ t('onboarding.tour.searchErrorHint', { error: searchError }) }}
        </p>
      </div>
    </div>

    <!-- Tour form -->
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-1">
            {{ t('onboarding.tour.name') }} *
          </label>
          <input
            v-model="form.name"
            :placeholder="t('onboarding.tour.namePlaceholder')"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
          >
        </div>
        <div>
          <label class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-1">
            {{ t('onboarding.tour.artist') }} *
          </label>
          <input
            v-model="form.artist_name"
            :placeholder="t('onboarding.tour.artistPlaceholder')"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
          >
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-1">
            {{ t('onboarding.tour.start') }} *
          </label>
          <input
            v-model="form.start_date"
            type="date"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors"
          >
        </div>
        <div>
          <label class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-1">
            {{ t('onboarding.tour.end') }} *
          </label>
          <input
            v-model="form.end_date"
            type="date"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors"
          >
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-1">
            {{ t('onboarding.tour.startCity') }}
          </label>
          <input
            v-model="form.start_city"
            :placeholder="t('onboarding.tour.startCityPlaceholder')"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
          >
        </div>
        <div>
          <label class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-1">
            {{ t('onboarding.tour.endCity') }}
          </label>
          <input
            v-model="form.end_city"
            :placeholder="t('onboarding.tour.endCityPlaceholder')"
            class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4"
          >
        </div>
      </div>

      <div>
        <label
          for="onb-tour-timezone"
          class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-1"
        >
          {{ t('onboarding.tour.timezone') }}
        </label>
        <select
          id="onb-tour-timezone"
          v-model="form.timezone"
          data-testid="onb-tour-timezone"
          class="w-full min-h-[44px] lg:min-h-0 bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors cursor-pointer"
        >
          <option
            v-for="tz in timezoneOptions"
            :key="tz"
            :value="tz"
          >
            {{ tz }}
          </option>
        </select>
        <p class="text-[12px] text-ink-2 mt-1">
          {{ t('onboarding.tour.timezoneHelp') }}
        </p>
      </div>

      <div>
        <label class="text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-1">
          {{ t('onboarding.tour.notes') }}
        </label>
        <textarea
          v-model="form.notes"
          rows="2"
          :placeholder="t('onboarding.tour.notesPlaceholder')"
          class="w-full bg-glass border border-line rounded px-2.5 py-2 text-ink text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-olive transition-colors placeholder:text-ink-4 resize-none"
        />
      </div>
    </div>

    <p
      v-if="submitError"
      class="text-[13px] text-failed-fg mt-2"
    >
      {{ submitError }}
    </p>

    <div class="mt-5">
      <BtnPrimary
        full
        :disabled="!formValid || submitting"
        @click="submit"
      >
        <svg
          v-if="submitting"
          class="animate-spin"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="3"
            stroke-dasharray="40 22"
            stroke-linecap="round"
          />
        </svg>
        <svg
          v-else
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {{ submitting ? t('onboarding.tour.creating') : t('onboarding.continue') }}
      </BtnPrimary>
    </div>
  </div>
</template>
