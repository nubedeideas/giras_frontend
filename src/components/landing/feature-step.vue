<template>
  <button
    :class="[
      'w-full text-left group border-l-2 transition-all duration-500 outline-none focus-visible:ring-2 focus-visible:ring-acid-green focus-visible:ring-offset-2 focus-visible:ring-offset-black',
      compact ? 'pl-4 py-4 md:pl-5 md:py-5' : 'pl-6 py-6',
      active
        ? compact
          ? 'border-acid-green bg-acid-green/5 translate-x-2'
          : 'border-acid-green bg-acid-green/5 translate-x-4'
        : 'border-white/10 opacity-45 hover:opacity-70 hover:translate-x-2',
    ]"
    :aria-pressed="active"
    @click="emit('click')"
  >
    <div
      :class="[
        compact ? 'text-[9px] mb-1.5 tracking-[0.28em] font-bold' : 'text-[10px] mb-2 tracking-[0.3em] font-bold',
        active ? 'text-acid-green' : 'text-white',
      ]"
    >
      {{ number }}
    </div>
    <h3
      :class="[
        compact ? 'font-header text-3xl md:text-[2.2rem] uppercase mb-1.5 transition-all' : 'font-header text-4xl uppercase mb-2 transition-all',
        active ? 'italic' : '',
      ]"
    >
      {{ title }}
    </h3>
    <p :class="compact ? 'text-[11px] leading-relaxed max-w-sm font-mono' : 'text-xs leading-relaxed max-w-sm font-mono'">
      {{ desc }}
    </p>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    number: string
    title: string
    desc: string
    active: boolean
    compact?: boolean
  }>(),
  { compact: false },
)
const emit = defineEmits<{ click: [] }>()
</script>
