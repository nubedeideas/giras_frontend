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
        'w-8 h-1 mb-6 transition-all group-hover:w-full',
        accent ? 'bg-acid-green' : 'bg-white/20',
      ]"
    ></div>
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
  { className: '', accent: false },
)
</script>
