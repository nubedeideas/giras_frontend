<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { isGooglePurpose, type GooglePurpose } from '@/utils/googleOAuth'

/**
 * Aviso del resultado de una conexión con Google, a partir de la query que deja el callback
 * (`google_connect=ok|partial|denied|error`, `purpose`, `reason`). Al cerrarlo o a los 6 s
 * quita esos parámetros de la URL. Con `purpose` solo se muestra para ese propósito.
 */
const props = defineProps<{ purpose?: GooglePurpose }>()

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()

type Outcome = 'ok' | 'partial' | 'denied' | 'error'
const OUTCOMES: Outcome[] = ['ok', 'partial', 'denied', 'error']
const QUERY_KEYS = ['google_connect', 'purpose', 'reason']

const dismissed = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function q(key: string): string | undefined {
  const v = route.query[key]
  return typeof v === 'string' && v ? v : undefined
}

const outcome = computed<Outcome | null>(() => {
  const v = q('google_connect') as Outcome | undefined
  return v && OUTCOMES.includes(v) ? v : null
})

const queryPurpose = computed<GooglePurpose | null>(() => {
  const p = q('purpose')
  return isGooglePurpose(p) ? p : null
})

const visible = computed(
  () =>
    !dismissed.value &&
    outcome.value !== null &&
    (!props.purpose || props.purpose === queryPurpose.value)
)

const service = computed(() =>
  queryPurpose.value ? t(`googleIntegration.service.${queryPurpose.value}`) : 'Google'
)

const message = computed(() => {
  switch (outcome.value) {
    case 'ok':
      return t('googleIntegration.notice.ok', { service: service.value })
    case 'partial':
      return t('googleIntegration.notice.partial', { service: service.value })
    case 'denied':
      return t('googleIntegration.notice.denied')
    case 'error': {
      const reason = q('reason')
      const key = `googleIntegration.errors.${reason}`
      return reason && te(key) ? t(key) : t('googleIntegration.notice.error')
    }
    default:
      return ''
  }
})

const tone = computed(() =>
  outcome.value === 'ok'
    ? 'bg-acid-dim border-line-acid text-olive'
    : outcome.value === 'error'
      ? 'bg-glass border-line text-failed-fg'
      : 'bg-glass border-line text-ink-2'
)

function close() {
  dismissed.value = true
  if (timer) clearTimeout(timer)
  timer = null
  const query = { ...route.query }
  let changed = false
  for (const k of QUERY_KEYS) {
    if (k in query) {
      delete query[k]
      changed = true
    }
  }
  if (changed) router.replace({ query })
}

onMounted(() => {
  if (visible.value) timer = setTimeout(close, 6000)
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div
    v-if="visible"
    class="flex items-start gap-2 border rounded-xl px-3.5 py-2.5 mb-4"
    :class="tone"
    role="status"
    data-testid="google-connect-notice"
    :data-outcome="outcome"
  >
    <p class="flex-1 text-[13px] leading-relaxed">
      {{ message }}
    </p>
    <button
      type="button"
      class="flex-shrink-0 text-ink-4 hover:text-ink bg-transparent border-none cursor-pointer p-0"
      :aria-label="t('googleIntegration.notice.close')"
      @click="close"
    >
      <svg
        width="11"
        height="11"
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
</template>
