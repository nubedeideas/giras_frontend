<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Notice, NoticeDetail } from '@/composables/useNotices'
import { useNoticesStore } from '@/stores/notices'
import { useToursStore } from '@/stores/tours'
import { ApiError } from '@/utils/apiClient'
import {
  expiresInLabel,
  noticeErrorMessage,
  noticeHeadline,
  noticeStatusLine,
  noticeSummary,
  originLabel,
  originTone,
} from '@/utils/notices'
import NoticeSheet from './NoticeSheet.vue'

/**
 * Pestaña "Avisos" del hub de gira (C2.2), solo admins: borradores pendientes (Cirium y
 * urgencias) arriba y el historial debajo. El listado y la caché de detalles viven en
 * `useNoticesStore` (los comparte el contador de la pestaña en `TourView`). Una sola petición por
 * recarga: al volver a la pestaña del navegador y cada 60 s mientras haya pendientes.
 * `initialNotice` (deep link del inbox) abre su hoja. Los borradores de texto se guardan aquí por
 * uuid para no perderlos al cerrar y reabrir un aviso.
 */
const props = defineProps<{ tourUuid: string; initialNotice?: string | null }>()
const emit = defineEmits<{ 'initial-consumed': [] }>()

const { t, locale } = useI18n()
const store = useNoticesStore()
const toursStore = useToursStore()

const NOTICES_POLL_MS = 60_000
/** Intervalo mínimo entre recargas al volver a la pestaña del navegador. */
const VISIBILITY_MIN_MS = 15_000
/** Detalles pedidos para enseñar destinatarios y coste en las tarjetas. */
const DETAIL_LIMIT = 10

const errorMessage = ref('')
const forbidden = ref(false)
const openUuid = ref<string | null>(null)
const drafts = ref(new Map<string, Record<string, string>>())

const pending = computed(() => (store.tourUuid === props.tourUuid ? store.pending : []))
const history = computed(() => (store.tourUuid === props.tourUuid ? store.history : []))
const loaded = computed(() => store.tourUuid === props.tourUuid && store.loaded)
const loading = computed(() => store.tourUuid === props.tourUuid && store.loading)

let lastLoadAt = 0

async function load({ quiet = false }: { quiet?: boolean } = {}) {
  lastLoadAt = Date.now()
  try {
    await store.load(props.tourUuid, { quiet })
    errorMessage.value = ''
    forbidden.value = false
    void loadDetails()
  } catch (e) {
    const denied = e instanceof ApiError && (e.status === 403 || e.status === 404)
    if (denied) {
      forbidden.value = true
      errorMessage.value = noticeErrorMessage(e, t, 'notices.errors.load', { load: true })
      void toursStore.loadTours()
    } else if (!quiet || !loaded.value) {
      errorMessage.value = noticeErrorMessage(e, t, 'notices.errors.load', { load: true })
    }
  } finally {
    schedule()
  }
}

/** Destinatarios y coste de las tarjetas: un detalle por aviso, solo si no está en caché. */
async function loadDetails() {
  const missing = pending.value.filter((n) => !store.details.has(n.uuid)).slice(0, DETAIL_LIMIT)
  await Promise.all(missing.map((n) => store.ensureDetail(n.uuid)))
}

function cardMeta(n: Notice): string {
  const d = store.details.get(n.uuid)
  const parts: string[] = []
  const exp = expiresInLabel(n.expires_at, t, locale.value)
  if (exp) parts.push(exp)
  if (d?.preview) {
    const c = d.preview.counts.reachable
    parts.push(t('notices.recipientsCount', { n: c }, c))
    if (d.preview.channel === 'whatsapp' && d.preview.cost.whatsapp > 0) {
      const cost = new Intl.NumberFormat(locale.value === 'en' ? 'en-GB' : 'es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(d.preview.cost.cost_usd)
      parts.push(t('notices.costShort', { cost }))
    }
  }
  return parts.join(' · ')
}

function toneClass(n: Notice): string {
  return originTone(n.origin) === 'orange'
    ? 'bg-brand-orange-dim text-brand-orange'
    : 'bg-acid-dim text-acid'
}

const isEmpty = computed(() => loaded.value && pending.value.length === 0)
const showError = computed(() => !!errorMessage.value && (!loaded.value || forbidden.value))

// ─── Hoja ─────────────────────────────────────────────────────────────────────

function open(uuid: string) {
  openUuid.value = uuid
}

const openDrafts = computed(() => (openUuid.value ? drafts.value.get(openUuid.value) ?? {} : {}))

function onDrafts(uuid: string, next: Record<string, string>) {
  if (Object.keys(next).length) drafts.value.set(uuid, next)
  else drafts.value.delete(uuid)
}

function onChanged(d: NoticeDetail) {
  const before = store.items.find((n) => n.uuid === d.uuid)?.status
  store.setDetail(d)
  if (d.status !== 'pending') drafts.value.delete(d.uuid)
  // Enviado, descartado o caducado: el listado cambia de sección (y puede haber otro pendiente).
  // Sin listado cargado (deep link) o con una carga en curso, no se pide otra.
  if (before !== undefined && before !== d.status && loaded.value && !store.loading) {
    void load({ quiet: true })
  }
}

watch(
  () => props.initialNotice,
  (uuid) => {
    if (!uuid) return
    open(uuid)
    emit('initial-consumed')
  },
  { immediate: true }
)

// ─── Recarga ──────────────────────────────────────────────────────────────────

let timer: ReturnType<typeof setTimeout> | null = null
let mounted = false

function clearTimer() {
  if (timer !== null) clearTimeout(timer)
  timer = null
}

function schedule() {
  clearTimer()
  if (!mounted || forbidden.value || pending.value.length === 0) return
  if (document.visibilityState === 'hidden') return
  timer = setTimeout(() => void load({ quiet: true }), NOTICES_POLL_MS)
}

function onVisibility() {
  if (document.visibilityState === 'hidden') {
    clearTimer()
    return
  }
  if (forbidden.value) return
  // Cambiar de app y volver varias veces seguidas no dispara una petición cada vez.
  if (store.loading || Date.now() - lastLoadAt < VISIBILITY_MIN_MS) {
    schedule()
    return
  }
  void load({ quiet: true })
}

watch(
  () => props.tourUuid,
  (uuid, old) => {
    errorMessage.value = ''
    forbidden.value = false
    if (old !== undefined) drafts.value = new Map()
    // `TourView` ya lo ha pedido para el contador: no se repite la petición.
    if (store.isLoadingOrLoaded(uuid)) {
      if (store.loaded) void loadDetails()
      return
    }
    void load()
  },
  { immediate: true }
)

// Si la carga la lanzó `TourView`, al terminar se programan detalles y polling.
watch(
  () => store.loading,
  (now, before) => {
    if (before && !now && store.tourUuid === props.tourUuid) {
      lastLoadAt = Math.max(lastLoadAt, Date.now())
      if (store.error) {
        const e = store.error
        const denied = e instanceof ApiError && (e.status === 403 || e.status === 404)
        if (!loaded.value || denied) {
          errorMessage.value = noticeErrorMessage(e, t, 'notices.errors.load', { load: true })
          forbidden.value = denied
        }
      } else {
        void loadDetails()
      }
      schedule()
    }
  }
)

// Todo el acceso a `document` va en `onMounted` (vite-ssg).
onMounted(() => {
  mounted = true
  document.addEventListener('visibilitychange', onVisibility)
  schedule()
})

onUnmounted(() => {
  mounted = false
  clearTimer()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div
    class="max-w-3xl"
    data-test="notices-panel"
  >
    <div class="mb-4">
      <h2 class="text-[16px] font-bold text-ink">
        {{ t('notices.title') }}
      </h2>
      <p class="text-[12px] text-ink-3 mt-0.5">
        {{ t('notices.subtitle') }}
      </p>
    </div>

    <!-- Cargando -->
    <div
      v-if="loading && !loaded"
      class="space-y-2"
      data-test="notices-loading"
    >
      <div class="h-20 bg-glass-2 rounded-sm animate-pulse" />
      <div class="h-20 bg-glass-2 rounded-sm animate-pulse" />
    </div>

    <!-- Error -->
    <div
      v-else-if="showError"
      class="bg-bg-3 border border-line rounded-lg p-4 text-center"
      data-test="notices-error"
    >
      <p class="text-[12px] text-red-400">
        {{ errorMessage }}
      </p>
      <button
        v-if="!forbidden"
        type="button"
        class="min-h-[44px] mt-1 text-[12px] font-semibold text-acid bg-transparent border-none cursor-pointer"
        data-test="notices-retry"
        @click="load()"
      >
        {{ t('notices.retry') }}
      </button>
    </div>

    <template v-else-if="loaded">
      <!-- Pendientes -->
      <section class="mb-6">
        <p class="text-[10px] font-bold text-ink-3 tracking-[1px] uppercase mb-2">
          {{ t('notices.pending') }}
          <span
            v-if="pending.length"
            class="ml-1 text-acid"
          >({{ pending.length }})</span>
        </p>
        <p
          v-if="isEmpty"
          class="text-[12px] text-ink-4 bg-bg-3 border border-line rounded-lg p-4"
          data-test="notices-empty"
        >
          {{ t('notices.empty') }}
        </p>
        <ul
          v-else
          class="space-y-2"
        >
          <li
            v-for="n in pending"
            :key="n.uuid"
          >
            <button
              type="button"
              class="w-full text-left bg-bg-3 border border-line hover:border-line-2 rounded-lg p-3.5 cursor-pointer transition-colors min-h-[64px]"
              data-test="notice-card"
              @click="open(n.uuid)"
            >
              <div class="flex items-start gap-2.5">
                <div class="flex-1 min-w-0">
                  <span
                    class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1"
                    :class="toneClass(n)"
                  >{{ originLabel(n.origin, t) }}</span>
                  <p class="text-[14px] font-semibold text-ink truncate">
                    {{ noticeHeadline(n) }}
                  </p>
                  <p
                    class="text-[12px] text-ink-2 break-words"
                    data-test="notice-card-summary"
                  >
                    {{ noticeSummary(n, t) }}
                  </p>
                  <p
                    v-if="cardMeta(n)"
                    class="text-[11px] text-ink-3 mt-1"
                    data-test="notice-card-meta"
                  >
                    {{ cardMeta(n) }}
                  </p>
                </div>
                <span class="flex-shrink-0 self-center text-[12px] font-bold text-acid">
                  <span class="hidden sm:inline">{{ t('inbox.reviewAndSend') }} </span>→
                </span>
              </div>
            </button>
          </li>
        </ul>
      </section>

      <!-- Historial -->
      <section v-if="history.length">
        <p class="text-[10px] font-bold text-ink-3 tracking-[1px] uppercase mb-2">
          {{ t('notices.history') }}
        </p>
        <ul class="space-y-1.5">
          <li
            v-for="n in history"
            :key="n.uuid"
          >
            <button
              type="button"
              class="w-full text-left bg-glass hover:bg-glass-hover border border-line rounded-sm px-3 py-2.5 cursor-pointer min-h-[44px]"
              data-test="notice-history-row"
              @click="open(n.uuid)"
            >
              <div class="flex items-baseline gap-2">
                <span class="text-[11px] font-semibold text-ink-2 flex-shrink-0">{{ originLabel(n.origin, t) }}</span>
                <span class="text-[12px] text-ink truncate flex-1 min-w-0">{{ noticeHeadline(n) }}</span>
              </div>
              <p
                class="text-[11px] text-ink-3 mt-0.5"
                data-test="notice-history-status"
              >
                {{ noticeStatusLine(n, t, locale) }}
              </p>
            </button>
          </li>
        </ul>
      </section>
    </template>

    <NoticeSheet
      :show="!!openUuid"
      :notice-uuid="openUuid"
      :tour-uuid="tourUuid"
      :drafts="openDrafts"
      @close="openUuid = null"
      @changed="onChanged"
      @update:drafts="onDrafts"
    />
  </div>
</template>
