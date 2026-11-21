<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGoogleIntegration, type StartConnectOptions } from '@/composables/useGoogleIntegration'
import type { GooglePurpose } from '@/utils/googleOAuth'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'

/**
 * Bloque "No conectado": texto de consentimiento (lo que Google va a pedir y para qué) y botón
 * "Conectar Google Calendar/Contactos", que lleva a Google con el permiso de ese propósito.
 */
const props = defineProps<{
  purpose: GooglePurpose
  returnTo: string
  /** Texto de contexto encima del de consentimiento (p. ej. `missing.calendar`). */
  intro?: string
  onboarding?: StartConnectOptions['onboarding']
  /** Sin caja ni consentimiento largo: para avisos dentro de otra tarjeta. */
  compact?: boolean
}>()

const { t } = useI18n()
const { connecting, error, startConnect } = useGoogleIntegration()

function connect() {
  startConnect(props.purpose, props.returnTo, { onboarding: props.onboarding })
}
</script>

<template>
  <div
    :class="compact ? 'space-y-2' : 'bg-glass border border-line rounded-xl px-4 py-4 space-y-3'"
    :data-testid="`google-connect-cta-${purpose}`"
  >
    <p
      v-if="!compact"
      class="text-[9px] font-bold text-ink-3 tracking-[0.6px] uppercase"
    >
      {{ t('googleIntegration.card.notConnectedShort') }}
    </p>
    <p
      v-if="intro"
      class="text-[12px] text-ink-2 leading-relaxed"
    >
      {{ intro }}
    </p>
    <p
      v-if="!compact"
      class="text-[11px] text-ink-3 leading-relaxed"
      data-testid="google-consent-text"
    >
      {{ t(`googleIntegration.consent.${purpose}`) }}
    </p>
    <BtnPrimary
      :full="!compact"
      :small="compact"
      :disabled="connecting !== null"
      :class="connecting !== null ? 'opacity-60 cursor-wait' : ''"
      :data-testid="`google-connect-${purpose}`"
      @click="connect"
    >
      <svg
        v-if="connecting === purpose"
        class="animate-spin"
        width="11"
        height="11"
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
      {{
        connecting === purpose
          ? t('googleIntegration.connect.redirecting')
          : t(`googleIntegration.connect.${purpose}`)
      }}
    </BtnPrimary>
    <p
      v-if="error"
      class="text-[10px] text-red-400"
      data-testid="google-connect-error"
    >
      {{ error }}
    </p>
  </div>
</template>
