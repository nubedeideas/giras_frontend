<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useGoogleStore } from '@/stores/google'
import { googleErrorCode, googleIntegrationApi } from '@/composables/useGoogleIntegration'
import {
  clearOnboardingResume,
  DEFAULT_RETURN_TO,
  isSafeReturnTo,
  oauthRedirectUri,
  takePending,
  withQuery,
  type GoogleOAuthPending,
} from '@/utils/googleOAuth'

/**
 * Vuelta de Google (`/auth/callback`), compartida por el login y por la conexión de Calendar o
 * Contactos. Qué era lo decide el `pending` guardado en `sessionStorage` antes de salir, cuyo
 * `state` tiene que coincidir con el de la query; si no, no se llama a la API.
 */

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()
const googleStore = useGoogleStore()

const kind = ref<GoogleOAuthPending['kind'] | null>(null)
const errorMsg = ref('')

const title = computed(() =>
  t(kind.value === 'connect' ? 'googleAuth.callback.connecting' : 'googleAuth.callback.signingIn')
)

function queryString(key: string): string | undefined {
  const v = route.query[key]
  return typeof v === 'string' && v ? v : undefined
}

function failAndGo(message: string, target: string) {
  errorMsg.value = message
  setTimeout(() => router.replace(target), 3000)
}

async function handleLogin(code: string | undefined, oauthError: string | undefined) {
  if (oauthError || !code) {
    failAndGo(
      oauthError === 'access_denied'
        ? t('googleAuth.callback.denied')
        : t('googleAuth.callback.noCode'),
      '/login'
    )
    return
  }
  try {
    await auth.loginWithGoogle(code, oauthRedirectUri())
    router.replace('/home')
  } catch {
    failAndGo(auth.error ?? t('googleAuth.callback.loginError'), '/login')
  }
}

async function handleConnect(
  pending: GoogleOAuthPending,
  code: string | undefined,
  state: string,
  oauthError: string | undefined
) {
  const purpose = pending.purpose
  const returnTo = isSafeReturnTo(pending.returnTo) ? pending.returnTo : DEFAULT_RETURN_TO

  if (oauthError) {
    router.replace(withQuery(returnTo, { google_connect: 'denied', purpose }))
    return
  }
  if (!code) {
    router.replace(withQuery(returnTo, { google_connect: 'error', purpose, reason: 'no_code' }))
    return
  }
  try {
    const result = await googleIntegrationApi.connect(code, state, oauthRedirectUri())
    if (result?.status) googleStore.setStatus(result.status)
    else await googleStore.load(true)
    const target = isSafeReturnTo(result?.return_to) ? result.return_to : DEFAULT_RETURN_TO
    router.replace(
      withQuery(target, {
        google_connect: result?.purpose_granted === false ? 'partial' : 'ok',
        purpose: result?.purpose ?? purpose,
      })
    )
  } catch (e) {
    router.replace(
      withQuery(returnTo, { google_connect: 'error', purpose, reason: googleErrorCode(e) })
    )
  }
}

onMounted(async () => {
  // Se borra siempre: un `pending` solo vale para una vuelta.
  const pending = takePending()
  const state = queryString('state')
  const code = queryString('code')
  const oauthError = queryString('error')
  // Fuera de la URL `code` y `state` antes de nada (historial, GTM, Referer), también si falla.
  await router.replace({ path: route.path })

  if (!pending || !state || pending.state !== state) {
    kind.value = pending?.kind ?? null
    // Sin esto, AppLayout reabriría el asistente encima de Ajustes.
    clearOnboardingResume()
    failAndGo(
      t('googleAuth.callback.stateMismatch'),
      pending?.kind === 'login' ? '/login' : DEFAULT_RETURN_TO
    )
    return
  }

  kind.value = pending.kind
  if (pending.kind === 'login') await handleLogin(code, oauthError)
  else await handleConnect(pending, code, state, oauthError)
})
</script>

<template>
  <div class="fixed inset-0 bg-bg flex items-center justify-center">
    <div class="text-center">
      <!-- Logo -->
      <div
        class="w-12 h-12 rounded-[16px] bg-acid flex items-center justify-center mx-auto mb-5"
        :class="errorMsg ? 'bg-failed-bg' : 'bg-acid'"
      >
        <svg
          v-if="!errorMsg"
          class="animate-spin"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="#000"
            stroke-width="3"
            stroke-dasharray="40 22"
            stroke-linecap="round"
          />
        </svg>
        <svg
          v-else
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--failed-fg)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
          />
          <line
            x1="15"
            y1="9"
            x2="9"
            y2="15"
          />
          <line
            x1="9"
            y1="9"
            x2="15"
            y2="15"
          />
        </svg>
      </div>

      <template v-if="!errorMsg">
        <p class="text-[15px] font-semibold text-ink mb-1">
          {{ title }}
        </p>
        <p class="text-[14px] text-ink-3">
          {{ t('googleAuth.callback.wait') }}
        </p>
      </template>
      <template v-else>
        <p class="text-[15px] font-semibold text-failed-fg mb-1">
          {{ t('googleAuth.callback.errorTitle') }}
        </p>
        <p
          class="text-[14px] text-ink-3 max-w-[280px]"
          data-testid="callback-error"
        >
          {{ errorMsg }}
        </p>
        <p class="text-[13px] text-ink-4 mt-3">
          {{ t('googleAuth.callback.redirecting') }}
        </p>
      </template>
    </div>
  </div>
</template>
