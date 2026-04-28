<script setup lang="ts">
defineProps<{ full?: boolean; small?: boolean }>()
</script>

<template>
  <button
    class="inline-flex items-center gap-1.5 rounded-sm bg-acid text-black font-bold transition-all duration-200 hover:bg-acid-light hover:-translate-y-px cursor-pointer border-none"
    :class="[full ? 'w-full justify-center' : '', small ? 'px-2.5 py-[5px] text-[10px]' : 'px-3.5 py-[7px] text-[11px]']"
  >
    <slot />
  </button>
</template>
