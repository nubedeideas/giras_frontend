<template>
  <a
    :href="`/#${label.toLowerCase()}`"
    class="group flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest hover:text-acid-green transition-all cursor-pointer"
  >
    {{ label }}
    <svg
      v-if="hasDropdown"
      class="w-2 h-2 opacity-40 group-hover:opacity-100 group-hover:translate-y-0.5 transition-all"
      viewBox="0 0 8 5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M1 1L4 4L7 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </a>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ label: string; hasDropdown?: boolean }>(),
  { hasDropdown: false },
)
</script>
