<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import logoIcon from '@/assets/logo-icon.svg'
import '@/assets/landing.css'

const { t, locale } = useI18n()
const auth = useAuthStore()
const router = useRouter()

// ─── Magic Link ───────────────────────────────────────────────────────────────

const magicEmail = ref('')
const magicSent = ref(false)
const magicError = ref('')

async function sendMagicLink() {
  magicError.value = ''
  if (!magicEmail.value.trim()) { magicError.value = 'Ingresa tu email'; return }
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
  <div class="landing-body fixed inset-0 flex items-center justify-center p-5 grid-bg overflow-auto">
    <!-- Background glow -->
    <div class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[rgba(192,255,0,0.04)] blur-[120px] rounded-full pointer-events-none" />

    <!-- Card -->
    <div class="relative glass w-full max-w-[420px] px-8 py-10 text-center flex-shrink-0">
      <!-- Acid-green top accent line -->
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-acid-green" />

      <!-- Back to landing -->
      <a
        href="/"
        class="absolute top-4 left-5 flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-[0.3em] text-white/30 hover:text-acid-green transition-colors no-underline"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Inicio
      </a>

      <!-- Logo + heading -->
      <div class="mb-8 mt-2">
        <img :src="logoIcon" class="w-12 h-12 mx-auto mb-5" alt="Giras Pro" />
        <h1 class="font-header text-5xl uppercase leading-none tracking-tight mb-2">
          Giras Pro
        </h1>
        <p class="text-[10px] uppercase tracking-[0.35em] text-white/40 leading-relaxed">
          {{ t('loginTagline') }}
        </p>
      </div>

      <!-- Google OAuth -->
      <button
        class="w-full flex items-center justify-center gap-3 px-4 py-3.5 border border-white/10 bg-white/5 text-[11px] font-bold uppercase tracking-widest text-white hover:border-acid-green hover:bg-acid-green/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="auth.loading"
        @click="doGoogleLogin"
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {{ t('continueGoogle') }}
      </button>

      <p v-if="auth.error && !auth.loading" class="text-[10px] text-red-400 mt-2 uppercase tracking-wider">
        {{ auth.error }}
      </p>

      <!-- Divider -->
      <div class="flex items-center gap-3 my-6">
        <div class="flex-1 h-px bg-white/[0.08]" />
        <span class="text-[9px] uppercase tracking-[0.4em] text-white/30">{{ t('or') }}</span>
        <div class="flex-1 h-px bg-white/[0.08]" />
      </div>

      <!-- Magic link — sent confirmation -->
      <div
        v-if="magicSent"
        class="border border-acid-green/30 bg-acid-green/5 px-4 py-4 mb-4 text-left"
      >
        <div class="flex items-start gap-3">
          <div class="w-7 h-7 border border-acid-green/40 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c0ff00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-widest text-acid-green mb-1">Revisa tu email</p>
            <p class="text-[10px] text-white/50 leading-relaxed">
              Enviamos un link a <span class="text-white font-bold">{{ magicEmail }}</span>
            </p>
          </div>
        </div>
        <button
          class="mt-3 text-[9px] uppercase tracking-[0.3em] text-white/30 hover:text-acid-green transition-colors cursor-pointer border-none bg-transparent font-bold"
          @click="resetMagicLink"
        >
          Usar otro email →
        </button>
      </div>

      <!-- Magic link — email input -->
      <div v-else class="text-left">
        <label class="text-[9px] font-bold uppercase tracking-[0.35em] text-white/40 block mb-2">
          Link de acceso por email
        </label>
        <div class="flex gap-2">
          <input
            v-model="magicEmail"
            type="email"
            placeholder="tu@email.com"
            class="flex-1 bg-white/5 border border-white/10 px-3 py-3 text-white text-[12px] outline-none focus:border-acid-green transition-colors placeholder:text-white/20 uppercase font-mono disabled:opacity-40"
            :disabled="auth.loading"
            @keydown.enter="sendMagicLink"
          />
          <button
            class="flex-shrink-0 px-4 py-3 bg-acid-green text-black text-[11px] font-bold uppercase tracking-widest shadow-hard hover:translate-x-px hover:translate-y-px hover:!shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-hard"
            :disabled="auth.loading || !magicEmail.trim()"
            @click="sendMagicLink"
          >
            <svg v-if="auth.loading" class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round" />
            </svg>
            <span v-else>Enviar</span>
          </button>
        </div>
        <p v-if="magicError" class="text-[10px] text-red-400 mt-2 uppercase tracking-wider">
          {{ magicError }}
        </p>
      </div>

      <!-- Divider -->
      <div class="flex items-center gap-3 my-6">
        <div class="flex-1 h-px bg-white/[0.08]" />
        <span class="text-[9px] uppercase tracking-[0.4em] text-white/30">{{ t('or') }}</span>
        <div class="flex-1 h-px bg-white/[0.08]" />
      </div>

      <!-- Demo -->
      <button
        class="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 border border-white/10 bg-transparent text-[11px] font-bold uppercase tracking-widest text-white/50 hover:border-acid-green hover:text-acid-green transition-all duration-200"
        @click="doDemo"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        {{ t('viewDemo') }}
      </button>

      <!-- Lang toggle -->
      <div class="flex justify-center mt-6">
        <div class="flex gap-px border border-white/10 p-px">
          <button
            v-for="l in ['es', 'en']"
            :key="l"
            class="px-3 py-1.5 border-none text-[9px] font-bold cursor-pointer transition-all duration-150 tracking-[0.3em] uppercase"
            :class="locale === l ? 'bg-acid-green text-black' : 'bg-transparent text-white/30 hover:text-white/60'"
            @click="locale = l"
          >
            {{ l.toUpperCase() }}
          </button>
        </div>
      </div>

      <!-- Legal -->
      <p class="text-[9px] text-white/25 mt-5 leading-relaxed uppercase tracking-wider">
        {{ t('loginNote') }}
        <a href="/politica-de-privacidad" class="text-acid-green/60 hover:text-acid-green no-underline transition-colors">{{ t('privacy') }}</a>
        {{ t('and') }}
        <a href="/terminos-y-condiciones" class="text-acid-green/60 hover:text-acid-green no-underline transition-colors">{{ t('terms') }}</a>
      </p>
    </div>
  </div>
</template>
