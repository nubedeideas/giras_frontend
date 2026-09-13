<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PublicLayout from '@/layouts/PublicLayout.vue'
import { usePageMeta } from '@/composables/usePageMeta'

const { t, tm } = useI18n()

usePageMeta({
  title: `${t('termsPage.titleLine1')} ${t('termsPage.titleHighlight')} — Giras`,
  description: t('termsPage.metaDescription'),
  path: '/terminos-y-condiciones',
})

const lastUpdated = computed(() => t('termsPage.lastUpdated'))
// tm() (not t()) is required here — t() only resolves compiled string leaves
// and returns the key itself unresolved when it points at an array.
const sections = computed(
  () => tm('termsPage.sections') as unknown as { title: string; body: string }[]
)
</script>

<template>
  <PublicLayout>
    <div class="max-w-4xl mx-auto space-y-16">
      <div class="reveal-up active space-y-4">
        <h2 class="text-[10px] uppercase tracking-[0.5em] text-acid-green">
          {{ t('termsPage.eyebrow') }}
        </h2>
        <h1 class="font-header text-6xl md:text-8xl leading-none uppercase">
          {{ t('termsPage.titleLine1') }} <br />
          <span class="acid-green italic">{{ t('termsPage.titleHighlight') }}</span>
        </h1>
        <p class="text-[10px] uppercase tracking-[0.3em] text-white/40 font-mono">
          {{ t('termsPage.lastUpdatedLabel') }} {{ lastUpdated }}
        </p>
      </div>

      <div class="glass p-8 md:p-10 border-white/10 space-y-10">
        <section
          v-for="section in sections"
          :key="section.title"
          class="space-y-3 border-b border-white/5 pb-8 last:border-b-0 last:pb-0"
        >
          <h3 class="font-header text-2xl md:text-3xl uppercase">{{ section.title }}</h3>
          <p class="text-sm leading-relaxed text-white/60 font-mono">{{ section.body }}</p>
        </section>
      </div>
    </div>
  </PublicLayout>
</template>
