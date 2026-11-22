<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Translation, useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useToursStore } from '@/stores/tours'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/utils/apiClient'
import type { Tour } from '@/types'

/**
 * "Pausar avisos" de una gira (spec F0 §4.2). Admin y no demo: interruptor; pausar pide
 * confirmación, reanudar no. El resto solo ve el badge cuando la gira está en pausa. El estado vive
 * en el store de giras (las acciones lo actualizan), así que el badge de `TourMenuPanel` y "Por
 * resolver" cambian a la vez.
 */
const props = withDefaults(defineProps<{ tour: Tour; compact?: boolean }>(), { compact: false })

const { t, locale } = useI18n()
const toursStore = useToursStore()
const auth = useAuthStore()

const active = computed(() => props.tour.enable_notifications !== false)
const canToggle = computed(() => !!props.tour.current_user_is_admin && !auth.isDemoMode)

const pausedSince = computed(() => {
  const iso = props.tour.notifications_paused_at
  if (!iso) return ''
  const dt = DateTime.fromISO(iso).setLocale(locale.value === 'es' ? 'es-ES' : 'en-GB')
  if (!dt.isValid) return ''
  return dt.toLocaleString({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
})

const saving = ref(false)
const confirmOpen = ref(false)
const errorMsg = ref('')
const infoLines = ref<string[]>([])

// Guard de respuesta obsoleta: si cambia la gira mientras se pausa/reanuda, no se pintan los
// mensajes de la anterior (el store sí actualiza la gira correcta, va por uuid).
let request = 0

watch(
  () => props.tour.uuid,
  () => {
    request++
    saving.value = false
    confirmOpen.value = false
    errorMsg.value = ''
    infoLines.value = []
  }
)

function errorText(e: unknown): string {
  if (e instanceof ApiError && e.status === 403) return t('notifPause.forbidden')
  return t('notifPause.error')
}

function onToggle() {
  if (saving.value || !canToggle.value) return
  errorMsg.value = ''
  infoLines.value = []
  if (active.value) confirmOpen.value = true
  else void resume()
}

async function pause() {
  confirmOpen.value = false
  const req = ++request
  const uuid = props.tour.uuid
  saving.value = true
  try {
    const res = await toursStore.pauseNotifications(uuid)
    if (req !== request) return
    const held = res.held ?? 0
    infoLines.value = held > 0 ? [t('notifPause.heldCount', { n: held }, held)] : []
  } catch (e) {
    if (req !== request) return
    errorMsg.value = errorText(e)
  } finally {
    if (req === request) saving.value = false
  }
}

async function resume() {
  const req = ++request
  const uuid = props.tour.uuid
  saving.value = true
  try {
    const res = await toursStore.resumeNotifications(uuid)
    if (req !== request) return
    const cancelled = res.cancelled ?? 0
    infoLines.value = [t('notifPause.resumed')]
    if (cancelled > 0) {
      infoLines.value.push(t('notifPause.cancelledCount', { n: cancelled }, cancelled))
    }
  } catch (e) {
    if (req !== request) return
    errorMsg.value = errorText(e)
  } finally {
    if (req === request) saving.value = false
  }
}
</script>

<template>
  <div
    v-if="canToggle || !active"
    class="flex flex-col gap-1"
    data-testid="notif-pause"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        v-if="canToggle"
        type="button"
        role="switch"
        :aria-checked="active"
        :aria-busy="saving"
        :aria-label="active ? t('notifPause.active') : t('notifPause.paused')"
        :title="active ? t('notifPause.pause') : t('notifPause.resume')"
        :disabled="saving"
        data-testid="notif-pause-switch"
        class="inline-flex items-center gap-2.5 min-h-[44px] lg:min-h-0 bg-transparent border-none p-0 rounded-sm cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:cursor-default disabled:opacity-50"
        @click="onToggle"
      >
        <span
          class="relative w-7 h-4 rounded-full flex-shrink-0 border transition-colors"
          :class="active ? 'bg-acid border-line-acid' : 'bg-glass-2 border-line'"
          aria-hidden="true"
        >
          <span
            class="absolute top-[1px] w-3 h-3 rounded-full transition-all"
            :class="active ? 'left-[13px] bg-bg' : 'left-[1px] bg-ink-3'"
          />
        </span>
        <!-- En pausa el texto lo da el badge de al lado: aquí solo para lectores de pantalla. -->
        <span :class="active ? 'text-[14px] text-ink-2' : 'sr-only'">
          {{ active ? t('notifPause.active') : t('notifPause.paused') }}
        </span>
      </button>
      <StatusBadge
        v-if="!active"
        status="pending"
        :label="t('notifPause.paused')"
        size="sm"
        data-testid="notif-pause-badge"
      />
      <Translation
        v-if="!active && pausedSince && !compact"
        keypath="notifPause.pausedSince"
        scope="global"
        tag="span"
        class="text-[13px] text-ink-2"
        data-testid="notif-pause-since"
      >
        <template #date>
          <span class="font-time tnum">{{ pausedSince }}</span>
        </template>
      </Translation>
    </div>

    <p
      v-if="errorMsg"
      role="alert"
      class="text-[13px] text-failed-fg"
      data-testid="notif-pause-error"
    >
      {{ errorMsg }}
    </p>
    <p
      v-for="(line, i) in infoLines"
      :key="i"
      role="status"
      class="text-[13px] text-ink-2"
      data-testid="notif-pause-info"
    >
      {{ line }}
    </p>

    <AppModal
      :show="confirmOpen"
      @close="confirmOpen = false"
    >
      <div data-testid="notif-pause-confirm">
        <p class="text-[17px] font-bold text-ink mb-2">
          {{ t('notifPause.confirmTitle', { tour: tour.name }) }}
        </p>
        <p class="text-[15px] text-ink-2 leading-relaxed mb-5">
          {{ t('notifPause.confirmBody') }}
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <BtnSecondary
            type="button"
            data-testid="notif-pause-cancel"
            @click="confirmOpen = false"
          >
            {{ t('common.cancel') }}
          </BtnSecondary>
          <BtnPrimary
            type="button"
            data-testid="notif-pause-confirm-btn"
            @click="pause"
          >
            {{ t('notifPause.pause') }}
          </BtnPrimary>
        </div>
      </div>
    </AppModal>
  </div>
</template>
