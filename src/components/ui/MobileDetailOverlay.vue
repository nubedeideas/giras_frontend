<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

// Lock background scroll while the overlay is open (prevents scroll-through
// behind the fixed panel on iOS Safari).
watch(
  () => props.show,
  (show) => {
    document.body.style.overflow = show ? 'hidden' : ''
  },
  { immediate: true },
)

onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="detail-slide-up">
      <div
        v-if="show"
        class="fixed inset-0 z-[110] bg-bg-3 flex flex-col"
      >
        <div class="flex items-center px-3.5 py-3 border-b border-line flex-shrink-0">
          <button
            class="flex items-center justify-center w-7 h-7 rounded-lg border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink"
            @click="emit('close')"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
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
        </div>

        <div class="flex-1 flex flex-col overflow-hidden">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.detail-slide-up-enter-active,
.detail-slide-up-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.detail-slide-up-enter-from,
.detail-slide-up-leave-to {
  transform: translateY(24px);
  opacity: 0;
}
</style>
