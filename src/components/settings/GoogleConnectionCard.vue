<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import { useAuthStore } from '@/stores/auth'
import { useGoogleStore } from '@/stores/google'
import { googleIntegrationApi } from '@/composables/useGoogleIntegration'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import GoogleConnectCta from './GoogleConnectCta.vue'

/** Ajustes → Calendarios: cuenta de Google conectada, permisos concedidos, conectar y desconectar. */
const emit = defineEmits<{ disconnected: [] }>()

const RETURN_TO = '/settings?tab=calendars'

const { t, locale } = useI18n()
const auth = useAuthStore()
const googleStore = useGoogleStore()

const status = computed(() => googleStore.status)
const features = computed(
  () => status.value?.features ?? { calendar: false, calendar_write: false, contacts: false }
)

const connectedSince = computed(() => {
  const iso = status.value?.connected_at
  if (!iso) return ''
  const dt = DateTime.fromISO(iso)
  return dt.isValid ? dt.setLocale(locale.value).toLocaleString(DateTime.DATE_MED) : ''
})

const scopes = computed(() => [
  { key: 'calendarRead', granted: features.value.calendar },
  { key: 'calendarWrite', granted: features.value.calendar_write },
  { key: 'contactsRead', granted: features.value.contacts },
])

// ─── Desconectar ──────────────────────────────────────────────────────────────

const confirmOpen = ref(false)
const disconnecting = ref(false)
const feedback = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

function askDisconnect() {
  feedback.value = null
  confirmOpen.value = true
}

async function confirmDisconnect() {
  disconnecting.value = true
  try {
    const result = await googleIntegrationApi.disconnect()
    if (result?.status) googleStore.setStatus(result.status)
    else await googleStore.load(true)
    feedback.value = { kind: 'ok', text: t('googleIntegration.disconnect.done') }
    confirmOpen.value = false
    emit('disconnected')
  } catch {
    feedback.value = { kind: 'error', text: t('googleIntegration.disconnect.error') }
    confirmOpen.value = false
  } finally {
    disconnecting.value = false
  }
}

onMounted(() => {
  googleStore.load()
})
</script>

<template>
  <section
    class="bg-glass border border-line rounded-xl px-4 py-4 mb-5 space-y-3"
    data-testid="google-connection-card"
  >
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-lg bg-glass-2 flex items-center justify-center flex-shrink-0">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          aria-hidden="true"
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
      </div>
      <h3 class="text-[13px] font-bold text-ink">
        {{ t('googleIntegration.card.title') }}
      </h3>
    </div>

    <!-- Demo -->
    <p
      v-if="auth.isDemoMode"
      class="text-[11px] text-ink-3"
    >
      {{ t('googleIntegration.card.demo') }}
    </p>

    <!-- Cargando -->
    <div
      v-else-if="googleStore.loading && !status"
      class="space-y-2"
      data-testid="google-card-loading"
    >
      <div class="h-3 w-2/3 rounded bg-glass-2 animate-pulse" />
      <div class="h-3 w-1/2 rounded bg-glass-2 animate-pulse" />
    </div>

    <!-- Error al cargar -->
    <div
      v-else-if="googleStore.error && !status"
      class="space-y-2"
      data-testid="google-card-error"
    >
      <p class="text-[11px] text-red-400">
        {{ googleStore.error }}
      </p>
      <BtnSecondary
        small
        @click="googleStore.load(true)"
      >
        {{ t('onboarding.retry') }}
      </BtnSecondary>
    </div>

    <template v-else>
      <p
        class="text-[12px] break-words"
        :class="status?.connected ? 'text-ink-2' : 'text-ink-3'"
        data-testid="google-card-status"
      >
        <template v-if="status?.connected">
          {{
            connectedSince
              ? t('googleIntegration.card.connectedAs', {
                email: status.account_email,
                date: connectedSince,
              })
              : t('googleIntegration.card.connectedAsNoDate', { email: status.account_email })
          }}
        </template>
        <template v-else>
          {{ t('googleIntegration.card.notConnected') }}
        </template>
      </p>

      <!-- Permisos concedidos -->
      <ul
        v-if="status?.connected"
        class="space-y-1"
      >
        <li
          v-for="s in scopes"
          :key="s.key"
          class="flex items-center gap-2 text-[11px]"
          :class="s.granted ? 'text-ink-2' : 'text-ink-4'"
          :data-testid="`google-scope-${s.key}`"
          :data-granted="String(s.granted)"
        >
          <span
            class="w-4 text-center font-bold"
            :class="s.granted ? 'text-acid' : 'text-ink-4'"
            aria-hidden="true"
          >{{ s.granted ? '✓' : '–' }}</span>
          {{ t(`googleIntegration.scopes.${s.key}`) }}
        </li>
      </ul>

      <div class="grid gap-3 sm:grid-cols-2">
        <GoogleConnectCta
          v-if="!features.calendar"
          purpose="calendar"
          :return-to="RETURN_TO"
        />
        <GoogleConnectCta
          v-if="!features.contacts"
          purpose="contacts"
          :return-to="RETURN_TO"
        />
      </div>

      <div
        v-if="status?.connected"
        class="pt-1"
      >
        <button
          type="button"
          class="text-[11px] font-semibold text-ink-3 hover:text-red-400 bg-transparent border-none cursor-pointer p-0 transition-colors"
          data-testid="google-disconnect"
          @click="askDisconnect"
        >
          {{ t('googleIntegration.disconnect.button') }}
        </button>
      </div>

      <p
        v-if="feedback"
        class="text-[11px]"
        :class="feedback.kind === 'ok' ? 'text-acid' : 'text-red-400'"
        data-testid="google-disconnect-feedback"
      >
        {{ feedback.text }}
      </p>
    </template>

    <AppModal
      :show="confirmOpen"
      @close="confirmOpen = false"
    >
      <p class="text-[14px] font-bold text-ink mb-2">
        {{ t('googleIntegration.disconnect.confirmTitle') }}
      </p>
      <p
        class="text-[12px] text-ink-2 leading-relaxed mb-5"
        data-testid="google-disconnect-confirm-body"
      >
        {{ t('googleIntegration.disconnect.confirmBody') }}
      </p>
      <div class="flex gap-2 justify-end">
        <BtnSecondary
          :disabled="disconnecting"
          @click="confirmOpen = false"
        >
          {{ t('common.cancel') }}
        </BtnSecondary>
        <BtnPrimary
          :disabled="disconnecting"
          data-testid="google-disconnect-confirm"
          @click="confirmDisconnect"
        >
          {{ t('googleIntegration.disconnect.button') }}
        </BtnPrimary>
      </div>
    </AppModal>
  </section>
</template>
