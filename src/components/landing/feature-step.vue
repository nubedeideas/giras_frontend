<template>
  <button
    :class="[
      'w-full text-left group border-l-2 pl-6 py-6 transition-all duration-500 outline-none focus-visible:ring-2 focus-visible:ring-acid-green focus-visible:ring-offset-2 focus-visible:ring-offset-black',
      active
        ? 'border-acid-green bg-acid-green/5 translate-x-4'
        : 'border-white/10 opacity-45 hover:opacity-70 hover:translate-x-2',
    ]"
    :aria-pressed="active"
    @click="emit('click')"
  >
    <div
      :class="[
        'text-[10px] mb-2 tracking-[0.3em] font-bold',
        active ? 'text-acid-green' : 'text-white',
      ]"
    >
      {{ number }}
    </div>
    <h3 :class="['font-header text-4xl uppercase mb-2 transition-all', active ? 'italic' : '']">
      {{ title }}
    </h3>
    <p class="text-xs leading-relaxed max-w-sm font-mono">
      {{ desc }}
    </p>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  number: string
  title: string
  desc: string
  active: boolean
}>()
const emit = defineEmits<{ click: [] }>()
</script>
