<script setup lang="ts">
// `persistent`: disables closing by clicking the backdrop — for forms where
// an accidental outside click would silently discard unsaved edits. Closing
// still works via whatever explicit close/cancel control the modal's own
// content provides (they all call `emit('close')` the same way).
const props = defineProps<{ show: boolean; persistent?: boolean }>()
const emit = defineEmits<{ close: [] }>()

function onBackdropClick() {
  if (!props.persistent) emit('close')
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/65 backdrop-blur-[5px]"
      @click.self="onBackdropClick"
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
