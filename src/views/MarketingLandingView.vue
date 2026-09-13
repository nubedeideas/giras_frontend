<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PublicLayout from '@/layouts/PublicLayout.vue'
import { usePageMeta } from '@/composables/usePageMeta'

const { t } = useI18n()

usePageMeta({
  title: `${t('marketingLanding.titleLine1')} ${t('marketingLanding.titleHighlight')} — Giras`,
  description: t('marketingLanding.intro'),
  path: '/landing',
})
</script>

<template>
  <PublicLayout>
    <div class="max-w-4xl mx-auto space-y-16">
      <div class="reveal-up active space-y-4">
        <h2 class="text-[10px] uppercase tracking-[0.5em] text-acid-green">
          {{ t('marketingLanding.eyebrow') }}
        </h2>
        <h1 class="font-header text-6xl md:text-8xl leading-none uppercase">
          {{ t('marketingLanding.titleLine1') }} <br />
          <span class="acid-green italic">{{ t('marketingLanding.titleHighlight') }}</span>
        </h1>
        <p class="text-sm leading-relaxed text-white/60 font-mono max-w-2xl">
          {{ t('marketingLanding.intro') }}
        </p>
      </div>

      <div class="glass p-8 md:p-10 border-white/10">
        <p class="text-sm leading-relaxed text-white/60 font-mono">
          {{ t('marketingLanding.placeholder') }}
        </p>
      </div>
    </div>
  </PublicLayout>
</template>
