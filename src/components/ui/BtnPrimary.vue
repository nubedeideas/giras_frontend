<script setup lang="ts">
defineProps<{ full?: boolean; small?: boolean }>()
</script>

<template>
  <!-- text-night (#111) en vez de text-ink: dentro de .sidebar-dark ink pasa a claro y quedaría
       ilegible sobre lima; night es el mismo #111 en ambos contextos. -->
  <button
    class="inline-flex items-center gap-1.5 rounded-sm bg-acid text-night font-bold transition-colors duration-200 hover:bg-acid-light cursor-pointer border-none min-h-[44px] lg:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
    :class="[
      full ? 'w-full justify-center' : '',
      small ? 'px-3 py-2 text-[13px]' : 'px-4 py-2.5 text-[14px]',
    ]"
  >
    <slot />
  </button>
</template>
