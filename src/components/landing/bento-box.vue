<template>
  <div
    :class="[
      'p-8 border border-white/10 glass flex flex-col justify-end group hover:border-acid-green transition-all',
      className,
      accent ? 'bg-acid-green/5' : '',
    ]"
  >
    <div
      :class="[
        'mb-6 flex h-11 w-11 items-center justify-center rounded-lg border transition-colors',
        accent
          ? 'border-acid-green/40 bg-acid-green/10 text-acid-green'
          : 'border-white/10 bg-white/5 text-white/70 group-hover:border-acid-green/40 group-hover:text-acid-green',
      ]"
    >
      <slot name="icon" />
    </div>
    <h3 :class="['font-header text-3xl uppercase mb-2', accent ? 'acid-green' : '']">
      {{ title }}
    </h3>
    <p class="text-xs opacity-50 max-w-sm">{{ desc }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    desc: string
    className?: string
    accent?: boolean
  }>(),
  { className: '', accent: false }
)
</script>
