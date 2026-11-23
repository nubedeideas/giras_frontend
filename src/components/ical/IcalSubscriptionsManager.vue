<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import IcalSubscriptionCard from '@/components/ical/IcalSubscriptionCard.vue'
import IcalSubscribeModal from '@/components/ical/IcalSubscribeModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { listIcalSubscriptions, type IcalSubscription } from '@/composables/useIcalSubscriptions'

// Ajustes › Calendarios (A11, F3 §4.3): suscripciones iCal de todas las giras que el usuario
// administra (`GET ical-subscriptions/` sin gira), con alta desde un modal con selector de gira.
const { t } = useI18n()
const auth = useAuthStore()
const toursStore = useToursStore()

const subs = ref<IcalSubscription[]>([])
const loading = ref(true)
const failed = ref(false)
const showModal = ref(false)
let request = 0

/** Suscribir solo si administra alguna gira y fuera de la demo (F3 §4.6). */
const canSubscribe = computed(
  () => !auth.isDemoMode && toursStore.tours.some((tour) => tour.current_user_is_admin === true)
)

async function load() {
  const req = ++request
  loading.value = true
  failed.value = false
  try {
    const list = await listIcalSubscriptions()
    if (req !== request) return
    subs.value = list
  } catch {
    if (req !== request) return
    failed.value = true
  } finally {
    if (req === request) loading.value = false
  }
}

onMounted(load)

function onChanged(sub: IcalSubscription) {
  subs.value = subs.value.map((s) => (s.uuid === sub.uuid ? sub : s))
}

function onDeleted(uuid: string) {
  subs.value = subs.value.filter((s) => s.uuid !== uuid)
}

function onCreated(sub: IcalSubscription) {
  subs.value = [sub, ...subs.value.filter((s) => s.uuid !== sub.uuid)]
}

function closeModal() {
  showModal.value = false
  // La primera lectura ha podido terminar mientras tanto: estado y cambios por revisar al día.
  void load()
}
</script>

<template>
  <section
    class="mt-8"
    data-test="ical-manager"
  >
    <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
      <h3 class="text-[15px] font-bold text-ink">
        {{ t('ical.manager.title') }}
      </h3>
      <BtnSecondary
        v-if="canSubscribe && !loading && !failed && subs.length > 0"
        type="button"
        small
        data-test="ical-manager-add"
        @click="showModal = true"
      >
        {{ t('ical.subscribe') }}
      </BtnSecondary>
    </div>

    <!-- Carga: esqueleto de dos tarjetas -->
    <div
      v-if="loading"
      class="flex flex-col gap-3"
      role="status"
      :aria-label="t('ical.manager.loading')"
      data-test="ical-manager-loading"
    >
      <div
        v-for="i in 2"
        :key="i"
        class="h-[112px] rounded border border-line bg-bg-2 animate-pulse"
      />
    </div>

    <div
      v-else-if="failed"
      class="flex flex-col items-start gap-3 rounded border border-line bg-bg-3 px-4 py-3.5"
      data-test="ical-manager-error"
    >
      <p
        class="text-[14px] text-failed-fg"
        role="alert"
      >
        {{ t('ical.errors.generic') }}
      </p>
      <BtnSecondary
        type="button"
        small
        data-test="ical-manager-retry"
        @click="load"
      >
        {{ t('ical.manager.retry') }}
      </BtnSecondary>
    </div>

    <div
      v-else-if="subs.length === 0"
      class="flex flex-col items-start gap-3 rounded border border-line bg-bg-3 px-4 py-3.5"
      data-test="ical-manager-empty"
    >
      <p class="text-[14px] text-ink-2">
        {{ t('ical.manager.empty') }}
      </p>
      <BtnSecondary
        v-if="canSubscribe"
        type="button"
        data-test="ical-manager-empty-add"
        @click="showModal = true"
      >
        {{ t('ical.subscribe') }}
      </BtnSecondary>
    </div>

    <div
      v-else
      class="flex flex-col gap-3"
    >
      <IcalSubscriptionCard
        v-for="sub in subs"
        :key="sub.uuid"
        :sub="sub"
        @changed="onChanged"
        @deleted="onDeleted"
        @stale="load"
      />
    </div>

    <IcalSubscribeModal
      :show="showModal"
      :tour-uuid="null"
      @created="onCreated"
      @close="closeModal"
    />
  </section>
</template>
