<script setup lang="ts">
defineProps<{ full?: boolean; small?: boolean }>()
</script>

<template>
  <button
    class="inline-flex items-center gap-1.5 rounded-sm bg-bg-3 text-ink border border-line-2 font-medium transition-colors duration-200 hover:bg-glass-hover cursor-pointer min-h-[44px] lg:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
    :class="[
      full ? 'w-full justify-center' : '',
      small ? 'px-3 py-2 text-[13px]' : 'px-4 py-2.5 text-[14px]',
    ]"
  >
    <slot />
  </button>
</template>
