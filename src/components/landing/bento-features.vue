<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BentoBox from './bento-box.vue'

const { t } = useI18n()
</script>

<template>
  <section
    id="features"
    class="py-16 mt-16 px-6"
  >
    <div class="max-w-7xl mx-auto">
      <h2 class="font-header text-6xl uppercase mb-16 reveal-up">
        {{ t('landing.bentoFeatures.heading') }} <br>
        <span class="opacity-40 italic underline decoration-acid-green">{{
          t('landing.bentoFeatures.headingHighlight')
        }}</span>
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[250px] reveal-up">
        <BentoBox
          class-name="md:col-span-2 md:row-span-1"
          :title="t('landing.bentoFeatures.deepSync.title')"
          :desc="t('landing.bentoFeatures.deepSync.desc')"
        >
          <template #icon>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
              <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </template>
        </BentoBox>
        <BentoBox
          :title="t('landing.bentoFeatures.whatsappApi.title')"
          :desc="t('landing.bentoFeatures.whatsappApi.desc')"
          :accent="true"
        >
          <template #icon>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
              />
            </svg>
          </template>
        </BentoBox>
        <BentoBox
          :title="t('landing.bentoFeatures.multiCrew.title')"
          :desc="t('landing.bentoFeatures.multiCrew.desc')"
        >
          <template #icon>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle
                cx="9"
                cy="7"
                r="4"
              />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </template>
        </BentoBox>
        <BentoBox
          class-name="md:col-span-2"
          :title="t('landing.bentoFeatures.rulesEngine.title')"
          :desc="t('landing.bentoFeatures.rulesEngine.desc')"
        >
          <template #icon>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </template>
        </BentoBox>
      </div>
    </div>
  </section>
</template>
