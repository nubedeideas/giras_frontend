<script setup lang="ts">
defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/65 backdrop-blur-[5px]"
      @click.self="emit('close')"
    >
      <Transition name="up">
        <div
          v-if="show"
          class="relative w-full max-w-[460px] max-h-[82vh] overflow-y-auto bg-bg-3 border border-line-2 rounded-lg p-[22px]"
        >
          <slot />
        </div>
      </Transition>
    </div>
  </Transition>
</template>
