<script setup lang="ts">
import { BTN_PRIMARY_BASE, BTN_PRIMARY_SIZE, BTN_PRIMARY_SIZE_SMALL } from './btnClasses'

defineProps<{ full?: boolean; small?: boolean }>()
</script>

<template>
  <!-- Clases en `btnClasses.ts` (las comparte el RouterLink de ImportResultSummary). -->
  <button
    :class="[
      BTN_PRIMARY_BASE,
      full ? 'w-full justify-center' : '',
      small ? BTN_PRIMARY_SIZE_SMALL : BTN_PRIMARY_SIZE,
    ]"
  >
    <slot />
  </button>
</template>
