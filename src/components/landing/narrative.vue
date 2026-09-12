<template>
  <section
    id="narrative"
    class="py-16 mt-8 px-6 bg-black relative"
  >
    <div class="max-w-4xl mx-auto space-y-24">
      <div class="reveal-up">
        <h2 class="text-[10px] uppercase tracking-[0.5em] text-acid-green mb-8">
          {{ t('landing.narrative.step1Eyebrow') }}
        </h2>
        <p class="text-3xl md:text-5xl font-header leading-tight uppercase">
          {{ t('landing.narrative.step1Part1') }}
          <span class="opacity-40 italic">{{ t('landing.narrative.step1Quote') }}</span>
          {{ t('landing.narrative.step1Part2') }} <br />
          <span class="acid-green">{{ t('landing.narrative.step1Highlight') }}</span>
        </p>
      </div>

      <div class="reveal-up">
        <h2 class="text-[10px] uppercase tracking-[0.5em] text-acid-green mb-8">
          {{ t('landing.narrative.step2Eyebrow') }}
        </h2>
        <p class="text-3xl md:text-5xl font-header leading-tight uppercase">
          {{ t('landing.narrative.step2Part1') }} <br />
          {{ t('landing.narrative.step2Part2') }}
          <span class="acid-green italic">{{ t('landing.narrative.step2Quote') }}</span>
          {{ t('landing.narrative.step2Part3') }}
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 reveal-up">
        <div class="glass p-8 border-white/10 hover:border-acid-green/40 transition-all">
          <h3 class="font-header text-3xl mb-4">
            {{ t('landing.narrative.beforeTitle') }}
          </h3>
          <ul class="space-y-2 text-xs opacity-60 uppercase list-disc list-inside">
            <li v-for="item in beforeItems" :key="item">{{ item }}</li>
          </ul>
        </div>
        <div class="glass p-8 border-acid-green/40 bg-acid-green/5 shadow-[0_0_30px_rgba(192,255,0,0.05)]">
          <h3 class="font-header text-3xl mb-4 acid-green">
            {{ t('landing.narrative.afterTitle') }}
          </h3>
          <ul class="space-y-2 text-xs uppercase list-disc list-inside font-bold">
            <li v-for="item in afterItems" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, tm } = useI18n()

// tm() (not t()) is required for array-valued keys — t() only resolves compiled
// string leaves and returns the key itself unresolved when it points at an array.
const beforeItems = computed(() => tm('landing.narrative.beforeItems') as unknown as string[])
const afterItems = computed(() => tm('landing.narrative.afterItems') as unknown as string[])
</script>
