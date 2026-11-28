<script setup lang="ts">
// El fondo no cierra el modal: solo el icono de cerrar o el botón Cancelar del contenido
// (emiten `close`). Sin Escape a propósito.
defineProps<{ show: boolean }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/50 backdrop-blur-[5px]"
    >
      <Transition name="up">
        <div
          v-if="show"
          class="relative w-full max-w-[460px] max-h-[82vh] overflow-y-auto bg-bg-3 border border-line rounded-lg p-[22px] shadow-[0_24px_60px_var(--shadow-lg)]"
        >
          <slot />
        </div>
      </Transition>
    </div>
  </Transition>
</template>
