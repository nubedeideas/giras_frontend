<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import logoIcon from '@/assets/logo-icon.svg'

const { t, locale } = useI18n()
const auth = useAuthStore()
const router = useRouter()

// ─── Magic Link state ─────────────────────────────────────────────────────────

const magicEmail = ref('')
const magicSent = ref(false)
const magicError = ref('')

async function sendMagicLink() {
  magicError.value = ''
  if (!magicEmail.value.trim()) {
    magicError.value = 'Ingresa tu email'
    return
  }
  try {
    await auth.requestMagicLink(magicEmail.value.trim())
    magicSent.value = true
  } catch {
    magicError.value = auth.error ?? 'No se pudo enviar el link'
  }
}

function resetMagicLink() {
  magicSent.value = false
  magicError.value = ''
}

// ─── Google ───────────────────────────────────────────────────────────────────

function doGoogleLogin() {
  auth.error = null
  auth.startGoogleLogin()
}

// ─── Demo ─────────────────────────────────────────────────────────────────────

function doDemo() {
  auth.loginDemo()
  router.push('/notifs')
}
</script>

<template>
  <div class="fixed inset-0 bg-bg flex items-center justify-center p-5">
    <div class="relative bg-bg-3 border border-line-2 rounded-lg w-full max-w-[400px] px-10 py-12 text-center overflow-hidden">
      <!-- Glow -->
      <div class="absolute top-[-60px] left-1/2 -translate-x-1/2 w-[200px] h-[200px] bg-[radial-gradient(circle,rgba(168,216,0,0.12)_0%,transparent_70%)] pointer-events-none" />

      <!-- Logo -->
      <img
        :src="logoIcon"
        class="w-[52px] h-[52px] mx-auto mb-5"
        alt="Giras Pro"
      >

      <p class="text-[24px] font-bold tracking-[-0.5px] mb-1.5 text-ink">
        Giras Pro
      </p>
      <p class="text-[13px] text-ink-2 mb-8 leading-relaxed">
        {{ t('loginTagline') }}
      </p>

      <!-- Google OAuth button -->
      <button
        class="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-glass-2 border border-line-2 rounded-sm text-[13px] font-medium text-ink cursor-pointer transition-all duration-200 hover:bg-glass-hover hover:-translate-y-px mb-2.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
        :disabled="auth.loading"
        @click="doGoogleLogin"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
        >
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {{ t('continueGoogle') }}
      </button>

      <!-- Google error (e.g. Client ID not set) -->
      <p
        v-if="auth.error && !auth.loading"
        class="text-[11px] text-red-400 mb-2 -mt-1"
      >
        {{ auth.error }}
      </p>

      <!-- Divider -->
      <div class="flex items-center gap-3 my-5">
        <div class="flex-1 h-px bg-line" />
        <span class="text-[11px] text-ink-3">{{ t('or') }}</span>
        <div class="flex-1 h-px bg-line" />
      </div>

      <!-- ── Magic Link form ─────────────────────────────────────────────────── -->

      <!-- Sent confirmation -->
      <div
        v-if="magicSent"
        class="bg-glass border border-line rounded-sm px-4 py-3.5 mb-4 text-left"
      >
        <div class="flex items-start gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-acid/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a8d800"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-semibold text-ink mb-0.5">
              Revisa tu email
            </p>
            <p class="text-[11px] text-ink-3 leading-relaxed">
              Enviamos un link de acceso a <span class="text-ink font-medium">{{ magicEmail }}</span>
            </p>
          </div>
        </div>
        <button
          class="mt-3 text-[11px] text-ink-4 hover:text-acid-muted transition-colors cursor-pointer border-none bg-transparent"
          @click="resetMagicLink"
        >
          Usar otro email →
        </button>
      </div>

      <!-- Email input -->
      <div
        v-else
        class="text-left mb-1"
      >
        <label class="text-[11px] font-semibold text-ink-3 block mb-1.5 tracking-[0.2px]">
          Link de acceso por email
        </label>
        <div class="flex gap-2">
          <input
            v-model="magicEmail"
            type="email"
            placeholder="tu@email.com"
            class="flex-1 bg-glass border border-line rounded-sm px-3 py-2.5 text-ink text-[13px] outline-none focus:border-acid transition-colors placeholder:text-ink-4"
            :disabled="auth.loading"
            @keydown.enter="sendMagicLink"
          >
          <button
            class="flex-shrink-0 px-3.5 py-2.5 bg-glass-2 border border-line-2 rounded-sm text-[12px] font-medium text-ink-2 hover:text-ink hover:bg-glass-hover transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="auth.loading || !magicEmail.trim()"
            @click="sendMagicLink"
          >
            <svg
              v-if="auth.loading"
              class="animate-spin"
              width="14"
              height="14"
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
            <span v-else>Enviar</span>
          </button>
        </div>
        <p
          v-if="magicError"
          class="text-[11px] text-red-400 mt-1.5"
        >
          {{ magicError }}
        </p>
      </div>

      <!-- Divider -->
      <div class="flex items-center gap-3 my-5">
        <div class="flex-1 h-px bg-line" />
        <span class="text-[11px] text-ink-3">{{ t('or') }}</span>
        <div class="flex-1 h-px bg-line" />
      </div>

      <!-- Demo button -->
      <button
        class="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-glass-2 border border-line-2 rounded-sm text-[13px] font-medium text-ink cursor-pointer transition-all duration-200 hover:bg-glass-hover hover:-translate-y-px"
        @click="doDemo"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-acid-muted"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        {{ t('viewDemo') }}
      </button>

      <!-- Lang toggle -->
      <div class="flex justify-center mt-4">
        <div class="flex gap-[3px] bg-glass border border-line rounded-[7px] p-0.5">
          <button
            v-for="l in ['es', 'en']"
            :key="l"
            class="px-2 py-[3px] rounded-[5px] border-none text-[10px] font-semibold cursor-pointer transition-all duration-150 tracking-[0.3px]"
            :class="locale === l ? 'bg-acid text-black' : 'bg-transparent text-ink-3'"
            @click="locale = l"
          >
            {{ l.toUpperCase() }}
          </button>
        </div>
      </div>

      <p class="text-[11px] text-ink-3 mt-5">
        {{ t('loginNote') }}
        <a
          href="#"
          class="text-acid-muted no-underline hover:underline"
        >{{ t('privacy') }}</a>
        {{ t('and') }}
        <a
          href="#"
          class="text-acid-muted no-underline hover:underline"
        >{{ t('terms') }}</a>
      </p>
    </div>
  </div>
</template>
