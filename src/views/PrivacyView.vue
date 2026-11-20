<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PublicLayout from '@/layouts/PublicLayout.vue'
import { usePageMeta } from '@/composables/usePageMeta'

interface PrivacyLink {
  label: string
  href: string
}

interface PrivacySection {
  id: string
  title: string
  paragraphs?: string[]
  items?: string[]
  paragraphsAfter?: string[]
  statement?: string
  links?: PrivacyLink[]
}

const { t, tm } = useI18n()

usePageMeta({
  title: t('privacy.metaTitle'),
  description: t('privacy.metaDescription'),
  path: '/privacy',
})

// tm() (not t()) is required here: the sections are an array of objects, and t() only
// resolves string leaves (it returns the key itself when it points at an array).
const sections = computed(() => tm('privacy.sections') as unknown as PrivacySection[])
</script>

<template>
  <PublicLayout>
    <div class="max-w-4xl mx-auto space-y-16">
      <div class="reveal-up active space-y-4">
        <h2 class="text-[10px] uppercase tracking-[0.5em] text-acid-green">
          {{ t('privacy.eyebrow') }}
        </h2>
        <h1 class="font-header text-5xl sm:text-6xl md:text-8xl leading-none uppercase break-words">
          {{ t('privacy.titleLine1') }} <br>
          <span class="acid-green italic">{{ t('privacy.titleHighlight') }}</span>
        </h1>
        <p class="text-[10px] uppercase tracking-[0.3em] text-white/40 font-mono">
          {{ t('privacy.lastUpdatedLabel') }} {{ t('privacy.lastUpdated') }}
        </p>
        <p class="text-sm leading-relaxed text-white/60 font-mono max-w-2xl">
          {{ t('privacy.intro') }}
        </p>
      </div>

      <div class="glass p-6 md:p-10 border-white/10 space-y-10">
        <section
          v-for="section in sections"
          :id="section.id"
          :key="section.id"
          class="space-y-3 border-b border-white/5 pb-8 last:border-b-0 last:pb-0 scroll-mt-32"
        >
          <h3 class="font-header text-2xl md:text-3xl uppercase">
            {{ section.title }}
          </h3>
          <p
            v-for="(paragraph, i) in section.paragraphs ?? []"
            :key="`p-${i}`"
            class="text-sm leading-relaxed text-white/60 font-mono break-words"
          >
            {{ paragraph }}
          </p>
          <ul
            v-if="section.items?.length"
            class="list-disc pl-5 space-y-2 text-sm leading-relaxed text-white/60 font-mono marker:text-acid-green"
          >
            <li
              v-for="(item, i) in section.items"
              :key="`i-${i}`"
              class="break-words"
            >
              {{ item }}
            </li>
          </ul>
          <p
            v-for="(paragraph, i) in section.paragraphsAfter ?? []"
            :key="`pa-${i}`"
            class="text-sm leading-relaxed text-white/60 font-mono break-words"
          >
            {{ paragraph }}
          </p>
          <p
            v-if="section.statement"
            class="text-sm leading-relaxed text-white/80 font-mono border-l-2 border-acid-green pl-4"
          >
            {{ section.statement }}
          </p>
          <ul
            v-if="section.links?.length"
            class="space-y-2 text-sm font-mono"
          >
            <li
              v-for="link in section.links"
              :key="link.href"
            >
              <a
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="acid-green underline underline-offset-4 break-words hover:opacity-80 transition-opacity"
              >{{ link.label }}</a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </PublicLayout>
</template>
