<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const errorMsg = ref('')

onMounted(async () => {
  const code = route.query.code as string | undefined
  const oauthError = route.query.error as string | undefined

  if (oauthError || !code) {
    errorMsg.value =
      oauthError === 'access_denied'
        ? 'Acceso denegado. Puedes cerrar esta ventana e intentarlo de nuevo.'
        : 'No se recibió un código de autorización de Google.'
    setTimeout(() => router.replace('/login'), 3000)
    return
  }

  try {
    const redirectUri = `${window.location.origin}/auth/callback`
    await auth.loginWithGoogle(code, redirectUri)
    router.replace('/notifs')
  } catch {
    errorMsg.value = auth.error ?? 'Error al autenticar con Google'
    setTimeout(() => router.replace('/login'), 3000)
  }
})
</script>

<template>
  <div class="fixed inset-0 bg-bg flex items-center justify-center">
    <div class="text-center">
      <!-- Logo -->
      <div
        class="w-12 h-12 rounded-[16px] bg-acid flex items-center justify-center mx-auto mb-5"
        :class="errorMsg ? 'bg-red-500/20' : 'bg-acid'"
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
            cx="12" cy="12" r="10"
            stroke="#000" stroke-width="3"
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
          stroke="#f87171"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>

      <template v-if="!errorMsg">
        <p class="text-[14px] font-semibold text-ink mb-1">Autenticando con Google</p>
        <p class="text-[12px] text-ink-3">Un momento...</p>
      </template>
      <template v-else>
        <p class="text-[14px] font-semibold text-red-400 mb-1">Error de autenticación</p>
        <p class="text-[12px] text-ink-3 max-w-[280px]">{{ errorMsg }}</p>
        <p class="text-[11px] text-ink-4 mt-3">Redirigiendo al login...</p>
      </template>
    </div>
  </div>
</template>
