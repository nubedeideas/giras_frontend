<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import SheetSubscriptionCard from '@/components/sheets/SheetSubscriptionCard.vue'
import SheetLinkModal from '@/components/sheets/SheetLinkModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useToursStore } from '@/stores/tours'
import { isPickerConfigured } from '@/composables/useGooglePicker'
import {
  listSheetSubscriptions,
  type SheetSubscription,
} from '@/composables/useSheetSubscriptions'

// Ajustes › Calendarios y hojas (F4 §4.3): hojas de Google de todas las giras que el usuario
// administra (`GET sheet-subscriptions/` sin gira), con alta desde un modal con selector de gira.
// Sin el selector de Google configurado en el build no se ofrece vincular (D-F4-16): la sección
// solo aparece si ya hay vinculaciones.
const props = withDefaults(defineProps<{ openNew?: boolean }>(), { openNew: false })

const { t } = useI18n()
const auth = useAuthStore()
const toursStore = useToursStore()

const pickerReady = isPickerConfigured()

const subs = ref<SheetSubscription[]>([])
const loading = ref(true)
const failed = ref(false)
const showModal = ref(false)
let request = 0

/** Vincular solo con el selector configurado, si administra alguna gira y fuera de la demo. */
const canLink = computed(
  () =>
    pickerReady &&
    !auth.isDemoMode &&
    toursStore.tours.some((tour) => tour.current_user_is_admin === true)
)
/** Sin selector, la sección solo se pinta si ya hay hojas vinculadas. */
const visible = computed(() => pickerReady || subs.value.length > 0)

async function load() {
  const req = ++request
  loading.value = true
  failed.value = false
  try {
    const list = await listSheetSubscriptions()
    if (req !== request) return
    subs.value = list
  } catch {
    if (req !== request) return
    failed.value = true
  } finally {
    if (req === request) loading.value = false
  }
}

onMounted(() => {
  void load()
  // Vuelta del OAuth de "Conectar Google Sheets" desde Ajustes (`?sheets=new`).
  if (props.openNew && pickerReady && !auth.isDemoMode) showModal.value = true
})

function onChanged(sub: SheetSubscription) {
  subs.value = subs.value.map((s) => (s.uuid === sub.uuid ? sub : s))
}

function onDeleted(uuid: string) {
  subs.value = subs.value.filter((s) => s.uuid !== uuid)
}

function onCreated(sub: SheetSubscription) {
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
    v-if="visible"
    class="mt-8"
    data-test="sheet-manager"
  >
    <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
      <h3 class="text-[15px] font-bold text-ink">
        {{ t('sheets.manager.title') }}
      </h3>
      <BtnSecondary
        v-if="canLink && !loading && !failed && subs.length > 0"
        type="button"
        small
        data-test="sheet-manager-add"
        @click="showModal = true"
      >
        {{ t('sheets.link') }}
      </BtnSecondary>
    </div>

    <!-- Carga: esqueleto de dos tarjetas -->
    <div
      v-if="loading"
      class="flex flex-col gap-3"
      role="status"
      :aria-label="t('sheets.manager.loading')"
      data-test="sheet-manager-loading"
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
      data-test="sheet-manager-error"
    >
      <p
        class="text-[14px] text-failed-fg"
        role="alert"
      >
        {{ t('sheets.errors.generic') }}
      </p>
      <BtnSecondary
        type="button"
        small
        data-test="sheet-manager-retry"
        @click="load"
      >
        {{ t('sheets.manager.retry') }}
      </BtnSecondary>
    </div>

    <div
      v-else-if="subs.length === 0"
      class="flex flex-col items-start gap-3 rounded border border-line bg-bg-3 px-4 py-3.5"
      data-test="sheet-manager-empty"
    >
      <p class="text-[14px] text-ink-2">
        {{ t('sheets.manager.empty') }}
      </p>
      <BtnSecondary
        v-if="canLink"
        type="button"
        data-test="sheet-manager-empty-add"
        @click="showModal = true"
      >
        {{ t('sheets.link') }}
      </BtnSecondary>
    </div>

    <div
      v-else
      class="flex flex-col gap-3"
    >
      <SheetSubscriptionCard
        v-for="sub in subs"
        :key="sub.uuid"
        :sub="sub"
        @changed="onChanged"
        @deleted="onDeleted"
        @stale="load"
      />
    </div>

    <SheetLinkModal
      :show="showModal"
      :tour-uuid="null"
      @created="onCreated"
      @close="closeModal"
    />
  </section>
</template>
