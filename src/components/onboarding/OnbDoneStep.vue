<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useToursStore } from '@/stores/tours'
import { useContactsStore } from '@/stores/contacts'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'

const props = defineProps<{ tourId: number | null }>()
const emit = defineEmits<{ finish: [] }>()

const toursStore = useToursStore()
const contactsStore = useContactsStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)

const tour = computed(() =>
  props.tourId ? toursStore.tours.find((t) => t.id === props.tourId) ?? null : null,
)

const stats = computed(() => {
  const t = tour.value
  if (!t) return { shows: 0, cities: 0, crew: 0, days: 0, startCity: '', endCity: '' }
  const start = new Date(t.start_date)
  const end = new Date(t.end_date)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))
  const settings = (t as unknown as { settings?: Record<string, string> }).settings ?? {}
  return {
    shows: t.events_count ?? 0,
    cities: t.events_count ?? 0,
    crew: contactsStore.contacts.length,
    days,
    startCity: settings.start_city ?? '',
    endCity: settings.end_city ?? '',
  }
})

// ─── Canvas confetti ──────────────────────────────────────────────────────────

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  color: string
  angle: number
  spin: number
  decay: number
}

const COLORS = ['#a8d800', '#1a8fff', '#e85d00', '#e91e8c', '#ffffff', '#9b5de5']

function launchConfetti() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight

  const particles: Particle[] = Array.from({ length: 120 }, () => ({
    x: canvas.width / 2,
    y: canvas.height * 0.35,
    vx: (Math.random() - 0.5) * 12,
    vy: -(Math.random() * 10 + 4),
    r: Math.random() * 5 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.3,
    decay: Math.random() * 0.01 + 0.012,
  }))

  let alive = particles.length

  function frame() {
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    alive = 0
    for (const p of particles) {
      p.vy += 0.25
      p.vx *= 0.99
      p.x += p.vx
      p.y += p.vy
      p.angle += p.spin
      p.r -= p.decay
      if (p.r <= 0) continue
      alive++
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle)
      ctx.fillStyle = p.color
      ctx.globalAlpha = Math.min(1, p.r / 3)
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
      ctx.restore()
    }
    if (alive > 0) requestAnimationFrame(frame)
    else ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  requestAnimationFrame(frame)
}

onMounted(() => {
  setTimeout(launchConfetti, 120)
})
</script>

<template>
  <div class="relative">
    <!-- Confetti canvas -->
    <canvas
      ref="canvasRef"
      class="absolute inset-0 w-full h-full pointer-events-none z-10"
    />

    <div class="relative z-20 text-center pb-2">
      <!-- Icon -->
      <div class="w-14 h-14 rounded-2xl bg-acid flex items-center justify-center mx-auto mb-4">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>

      <p class="text-[22px] font-bold tracking-[-0.5px] text-ink mb-1">¡Todo listo!</p>
      <p class="text-[13px] text-ink-3 mb-6">Tu gira está configurada y lista para despegar.</p>

      <!-- Stats card -->
      <div
        v-if="tour"
        class="bg-glass border border-line-2 rounded-2xl p-4 mb-5 text-left"
      >
        <!-- Tour identity -->
        <div class="flex items-center gap-3 mb-4 pb-4 border-b border-line">
          <div
            class="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-[13px] font-bold text-white"
            :style="tour.spotify_image_url ? {} : { background: 'linear-gradient(135deg,#a8d800,#5a7a00)' }"
          >
            <img
              v-if="tour.spotify_image_url"
              :src="tour.spotify_image_url"
              class="w-full h-full object-cover"
              :alt="tour.artist_name"
            >
            <span v-else>{{ tour.artist_name.charAt(0) }}</span>
          </div>
          <div class="min-w-0">
            <p class="text-[14px] font-bold text-ink leading-tight">{{ tour.artist_name }}</p>
            <p class="text-[11px] text-ink-3 truncate">{{ tour.name }}</p>
          </div>
        </div>

        <!-- Stats grid -->
        <div class="grid grid-cols-4 gap-2 mb-4">
          <div class="text-center">
            <p class="text-[20px] font-bold text-acid leading-none">{{ stats.shows }}</p>
            <p class="text-[9px] text-ink-4 mt-0.5 uppercase tracking-[0.5px]">Shows</p>
          </div>
          <div class="text-center">
            <p class="text-[20px] font-bold text-acid leading-none">{{ stats.cities }}</p>
            <p class="text-[9px] text-ink-4 mt-0.5 uppercase tracking-[0.5px]">Ciudades</p>
          </div>
          <div class="text-center">
            <p class="text-[20px] font-bold text-acid leading-none">{{ stats.crew }}</p>
            <p class="text-[9px] text-ink-4 mt-0.5 uppercase tracking-[0.5px]">Crew</p>
          </div>
          <div class="text-center">
            <p class="text-[20px] font-bold text-acid leading-none">{{ stats.days }}</p>
            <p class="text-[9px] text-ink-4 mt-0.5 uppercase tracking-[0.5px]">Días</p>
          </div>
        </div>

        <!-- Route -->
        <div
          v-if="stats.startCity || stats.endCity"
          class="flex items-center gap-2 justify-center bg-bg-2 rounded-xl px-3 py-2.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--acid-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 8 16 12 12 16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span class="text-[12px] font-semibold text-ink">
            {{ stats.startCity || '—' }}
          </span>
          <span class="text-ink-4 text-[11px]">→</span>
          <span class="text-[12px] font-semibold text-ink">
            {{ stats.endCity || '—' }}
          </span>
        </div>
      </div>

      <BtnPrimary full @click="emit('finish')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        Ir al dashboard
      </BtnPrimary>
    </div>
  </div>
</template>
