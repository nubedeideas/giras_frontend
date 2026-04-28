<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

type Status = 'loading' | 'success' | 'error'
const status = ref<Status>('loading')
const errorMsg = ref('')

onMounted(async () => {
  const token = route.query.token as string | undefined
  if (!token) {
    status.value = 'error'
    errorMsg.value = 'Link inválido. No se encontró el token de acceso.'
    return
  }
  try {
    await auth.verifyMagicLink(token)
    status.value = 'success'
    setTimeout(() => router.replace('/notifs'), 1500)
  } catch {
    status.value = 'error'
    errorMsg.value = auth.error ?? 'El link de acceso es inválido o ha expirado.'
  }
})
</script>

<template>
  <div class="fixed inset-0 bg-bg flex items-center justify-center">
    <div class="text-center">
      <!-- Icon -->
      <div
        class="w-12 h-12 rounded-[16px] flex items-center justify-center mx-auto mb-5"
        :class="{
          'bg-acid': status === 'loading' || status === 'success',
          'bg-red-500/20': status === 'error',
        }"
      >
        <!-- Loading spinner -->
        <svg
          v-if="status === 'loading'"
          class="animate-spin"
          width="22" height="22"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle cx="12" cy="12" r="10" stroke="#000" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round" />
        </svg>
        <!-- Success check -->
        <svg
          v-else-if="status === 'success'"
          width="22" height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <!-- Error X -->
        <svg
          v-else
          width="22" height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f87171"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>

      <!-- Loading -->
      <template v-if="status === 'loading'">
        <p class="text-[14px] font-semibold text-ink mb-1">Verificando link de acceso</p>
        <p class="text-[12px] text-ink-3">Un momento...</p>
      </template>

      <!-- Success -->
      <template v-else-if="status === 'success'">
        <p class="text-[14px] font-semibold text-ink mb-1">¡Acceso confirmado!</p>
        <p class="text-[12px] text-ink-3">Entrando a GigSync...</p>
      </template>

      <!-- Error -->
      <template v-else>
        <p class="text-[14px] font-semibold text-red-400 mb-1">Link inválido</p>
        <p class="text-[12px] text-ink-3 max-w-[280px]">{{ errorMsg }}</p>
        <button
          class="mt-4 text-[12px] text-acid-muted hover:text-acid transition-colors cursor-pointer border-none bg-transparent"
          @click="$router.replace('/login')"
        >
          Volver al login →
        </button>
      </template>
    </div>
  </div>
</template>
