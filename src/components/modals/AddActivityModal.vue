<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'

/**
 * Cómo añadir actividades (A1-A4 de la spec F2 §4.6): a mano y, con `canImport` (admin de la gira
 * fuera de la demo), "Archivo o foto", que abre el importador.
 *
 * F5a (P-F5-4): la opción "Google Calendar" (`openImportCal` → `ImportCalActivitiesModal`) está
 * oculta hasta F5b, que la sustituye por la fuente Google del importador. El evento se mantiene
 * para que las vistas no cambien hasta entonces.
 */
const props = defineProps<{ show: boolean; canImport?: boolean }>()
const emit = defineEmits<{ close: []; openCreate: []; openImportCal: []; openImport: [] }>()

const { t } = useI18n()

type Choice = 'cal' | 'manual' | 'file'
const choice = ref<Choice | null>(null)

watch(
  () => props.show,
  (val) => {
    if (!val) setTimeout(() => (choice.value = null), 300)
  }
)

const options = computed(() => {
  const list: { key: Choice; title: string; sub: string }[] = [
    { key: 'manual', title: t('activities.add.manual'), sub: t('activities.add.manualSub') },
  ]
  if (props.canImport) {
    list.push({ key: 'file', title: t('activities.add.file'), sub: t('activities.add.fileSub') })
  }
  return list
})

function confirm() {
  const c = choice.value
  if (!c) return
  emit('close')
  if (c === 'cal') emit('openImportCal')
  else if (c === 'manual') emit('openCreate')
  else emit('openImport')
}
</script>

<template>
  <AppModal
    :show="show"
    @close="emit('close')"
  >
    <button
      type="button"
      class="absolute top-3 right-3 flex items-center justify-center w-[44px] h-[44px] lg:w-8 lg:h-8 rounded-sm border border-line bg-bg-2 text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
      :aria-label="t('activities.add.close')"
      data-test="add-activity-close"
      @click="emit('close')"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <line
          x1="18"
          y1="6"
          x2="6"
          y2="18"
        /><line
          x1="6"
          y1="6"
          x2="18"
          y2="18"
        />
      </svg>
    </button>

    <div class="flex items-center gap-2.5 mb-[18px] pr-12">
      <div
        class="w-[34px] h-[34px] rounded-sm bg-lime-soft text-olive flex items-center justify-center flex-shrink-0"
        aria-hidden="true"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect
            x="3"
            y="4"
            width="18"
            height="18"
            rx="2"
          />
          <line
            x1="3"
            y1="10"
            x2="21"
            y2="10"
          />
          <line
            x1="8"
            y1="2"
            x2="8"
            y2="6"
          />
          <line
            x1="16"
            y1="2"
            x2="16"
            y2="6"
          />
          <line
            x1="12"
            y1="14"
            x2="12"
            y2="18"
          />
          <line
            x1="10"
            y1="16"
            x2="14"
            y2="16"
          />
        </svg>
      </div>
      <div>
        <p class="text-[15px] font-bold text-ink">
          {{ t('activities.add.title') }}
        </p>
        <p class="text-[13px] text-ink-2 mt-px">
          {{ t('activities.add.sub') }}
        </p>
      </div>
    </div>

    <!-- Opciones: apiladas en móvil, 2 o 3 columnas desde `sm` -->
    <div
      class="grid grid-cols-1 gap-2 mb-5"
      :class="canImport ? 'sm:grid-cols-2' : 'sm:grid-cols-1'"
      role="radiogroup"
      :aria-label="t('activities.add.title')"
    >
      <button
        v-for="opt in options"
        :key="opt.key"
        type="button"
        role="radio"
        :aria-checked="choice === opt.key"
        class="flex sm:flex-col items-center gap-3 sm:gap-0 min-h-[44px] border rounded p-3 sm:p-4 text-left sm:text-center cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
        :class="choice === opt.key ? 'border-olive bg-glass-active' : 'border-line bg-bg-2 hover:bg-glass-hover'"
        :data-test="`add-activity-${opt.key}`"
        @click="choice = opt.key"
      >
        <span
          class="w-9 h-9 rounded-sm flex items-center justify-center flex-shrink-0 sm:mx-auto sm:mb-2.5 transition-colors duration-200"
          :class="choice === opt.key ? 'bg-bg-3 text-olive' : 'bg-bg-4 text-ink-2'"
          aria-hidden="true"
        >
          <!-- Google -->
          <svg
            v-if="opt.key === 'cal'"
            viewBox="0 0 24 24"
            width="16"
            height="16"
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
          <!-- Manual -->
          <svg
            v-else-if="opt.key === 'manual'"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <!-- Archivo o foto -->
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line
              x1="12"
              y1="18"
              x2="12"
              y2="12"
            />
            <polyline points="9 15 12 12 15 15" />
          </svg>
        </span>
        <span class="min-w-0">
          <span class="block text-[14px] font-semibold text-ink leading-snug">{{ opt.title }}</span>
          <span class="block text-[13px] text-ink-2 mt-0.5">{{ opt.sub }}</span>
        </span>
      </button>
    </div>

    <BtnPrimary
      type="button"
      full
      data-test="add-activity-continue"
      :disabled="!choice"
      :class="choice ? 'opacity-100' : 'opacity-50 cursor-not-allowed'"
      @click="confirm"
    >
      {{ t('activities.add.continue') }}
    </BtnPrimary>
  </AppModal>
</template>
