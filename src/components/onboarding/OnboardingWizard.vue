<script setup lang="ts">
import { ref, computed } from 'vue'
import OnbTourStep from './OnbTourStep.vue'
import OnbCrewStep from './OnbCrewStep.vue'
import OnbCalendarStep from './OnbCalendarStep.vue'
import OnbDoneStep from './OnbDoneStep.vue'

const emit = defineEmits<{ complete: [tourId: number | null]; close: [] }>()

type Step = 'tour' | 'crew' | 'calendar' | 'done'

const STEPS: Step[] = ['tour', 'crew', 'calendar', 'done']

const STEP_LABELS: Record<Step, string> = {
  tour: 'Gira',
  crew: 'Crew',
  calendar: 'Calendario',
  done: '¡Listo!',
}

const currentStep = ref<Step>('tour')
const createdTourId = ref<number | null>(null)

const stepIndex = computed(() => STEPS.indexOf(currentStep.value))

function onTourNext(tourId: number) {
  createdTourId.value = tourId
  currentStep.value = 'crew'
}

function onCrewNext() {
  currentStep.value = 'calendar'
}

function onCalendarNext() {
  currentStep.value = 'done'
}

function onFinish() {
  emit('complete', createdTourId.value)
}
</script>

<template>
  <!-- Overlay -->
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <!-- Modal -->
      <div
        class="relative bg-bg-3 border border-line-2 rounded-2xl w-full max-w-[620px] max-h-[88vh] flex flex-col shadow-2xl"
        style="box-shadow: 0 0 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,216,0,0.06)"
      >
        <!-- Glow -->
        <div class="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-[radial-gradient(circle,rgba(168,216,0,0.08)_0%,transparent_70%)] pointer-events-none" />

        <!-- Header -->
        <div class="px-6 pt-6 pb-0 flex-shrink-0">
          <div class="flex items-center justify-between mb-5">
            <div>
              <p class="text-[16px] font-bold text-ink tracking-[-0.3px]">
                Configura tu primera gira
              </p>
              <p class="text-[11px] text-ink-3 mt-0.5">
                Paso {{ stepIndex + 1 }} de {{ STEPS.length }} — {{ STEP_LABELS[currentStep] }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <!-- Step dots -->
              <div class="flex items-center gap-1.5">
                <div
                  v-for="(s, i) in STEPS"
                  :key="s"
                  class="rounded-full transition-all duration-300"
                  :class="
                    i < stepIndex
                      ? 'w-2 h-2 bg-acid'
                      : i === stepIndex
                        ? 'w-5 h-2 bg-acid'
                        : 'w-2 h-2 bg-line-2'
                  "
                />
              </div>
              <!-- Close button -->
              <button
                class="w-7 h-7 flex items-center justify-center rounded-lg text-ink-4 hover:text-ink hover:bg-glass-hover transition-all bg-transparent border-none cursor-pointer"
                title="Cerrar"
                @click="emit('close')"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="h-[2px] bg-line rounded-full mb-5 overflow-hidden">
            <div
              class="h-full bg-acid rounded-full transition-all duration-500"
              :style="{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }"
            />
          </div>

          <!-- Step labels -->
          <div class="grid grid-cols-4 mb-5 -mx-1">
            <div
              v-for="(s, i) in STEPS"
              :key="s"
              class="text-center text-[10px] font-semibold px-1 transition-colors duration-200"
              :class="
                i < stepIndex
                  ? 'text-acid'
                  : i === stepIndex
                    ? 'text-ink'
                    : 'text-ink-4'
              "
            >
              {{ STEP_LABELS[s] }}
            </div>
          </div>
        </div>

        <!-- Scrollable body -->
        <div class="flex-1 overflow-y-auto px-6 pb-6">
          <Transition name="slide" mode="out-in">
            <OnbTourStep
              v-if="currentStep === 'tour'"
              key="tour"
              @next="onTourNext"
            />
            <OnbCrewStep
              v-else-if="currentStep === 'crew'"
              key="crew"
              @next="onCrewNext"
              @skip="onCrewNext"
            />
            <OnbCalendarStep
              v-else-if="currentStep === 'calendar'"
              key="calendar"
              :tour-id="createdTourId"
              @next="onCalendarNext"
              @skip="onCalendarNext"
            />
            <OnbDoneStep
              v-else
              key="done"
              :tour-id="createdTourId"
              @finish="onFinish"
            />
          </Transition>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.slide-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
</style>
