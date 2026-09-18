<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import WhatsappMockup from './whatsapp-mockup.vue'
import TrafficControlPanel from './traffic-control-panel.vue'
import { useCtaSource } from '@/composables/useCtaSource'

const { t } = useI18n()
const { setCtaSource } = useCtaSource()

const isMobile = ref(false)

const updateViewportState = () => {
  isMobile.value = window.innerWidth < 1024
}

onMounted(() => {
  updateViewportState()
  window.addEventListener('resize', updateViewportState)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportState)
})
</script>

<template>
  <section
    class="relative flex flex-col overflow-hidden px-6 pt-24 pb-10 sm:pt-28 sm:pb-14 lg:min-h-screen lg:justify-center lg:pt-32 lg:pb-16"
  >
    <div
      class="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pb-4 sm:pb-6 lg:pb-8"
    >
      <div class="lg:col-span-7 space-y-8 z-10">
        <h1
          class="font-header text-7xl md:text-9xl leading-[0.85] tracking-tighter uppercase italic"
        >
          {{ t('landing.hero.headlinePart1') }}<span class="acid-green">{{
            t('landing.hero.headlineHighlight')
          }}</span>
          <br>
          {{ t('landing.hero.headlineLine2') }}
        </h1>
        <p class="max-w-lg text-white/60 text-sm md:text-base leading-relaxed">
          {{ t('landing.hero.subheadLine1') }} <br>{{ t('landing.hero.subheadLine2') }} <br>
          {{ t('landing.hero.subheadLine3') }} <br>
        </p>
        <div class="flex flex-col sm:flex-row gap-4 pt-4">
          <a
            href="#cta"
            class="bg-acid-green text-black px-8 py-4 font-bold text-lg uppercase tracking-tighter shadow-hard hover:translate-x-1 hover:translate-y-1 hover:!shadow-none transition-all text-center"
            @click="setCtaSource('hero')"
          >
          
            {{ t('landing.hero.ctaPrimary') }}
          </a>
          <a
            href="#funcionalidades"
            class="border border-white/20 hover:border-acid-green px-8 py-4 font-bold text-lg uppercase tracking-tighter transition-all glass text-center"
          >
            {{ t('landing.hero.ctaSecondary') }}
          </a>
        </div>
      </div>

      <div
        class="relative lg:col-span-5 lg:flex lg:min-h-[600px] lg:items-center lg:justify-center"
      >
        <!-- Desktop: phone top-left, panel offset bottom-right of the whole column -->
        <template v-if="!isMobile">
          <div
            class="absolute left-0 top-0 z-10 w-full max-w-[260px] reveal-up shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
          >
            <WhatsappMockup />
          </div>

          <div
            class="glass relative z-20 w-full max-w-[300px] translate-x-20 translate-y-40 border-white/20 p-5 reveal-up shadow-[0_30px_60px_rgba(0,0,0,0.8)]"
          >
            <TrafficControlPanel />
          </div>
        </template>

        <!-- Mobile/tablet: phone fills the available width; panel's top-left corner
             is pinned to the phone's own center so the header + first message stay readable -->
        <template v-else>
          <!-- no reveal-up here: this branch mounts async (after isMobile flips), missing the
               one-time IntersectionObserver pass in LandingView.vue and staying opacity:0 forever -->
          <div class="relative mx-auto w-full max-w-[320px]">
            <WhatsappMockup />
            <div
              class="glass absolute left-1/2 top-1/2 z-20 w-[72%] max-w-[260px] -translate-x-1/4 border-white/20 p-3 shadow-[0_30px_60px_rgba(0,0,0,0.8)]"
            >
              <TrafficControlPanel compact />
            </div>
          </div>
        </template>

        <div class="absolute -top-20 -right-20 w-64 h-64 bg-acid-green/10 blur-[100px]" />
        <div class="absolute -bottom-20 -left-20 w-64 h-64 bg-white/5 blur-[100px]" />
      </div>
    </div>

    <div
      class="absolute bottom-0 left-0 w-full overflow-hidden whitespace-nowrap border-y border-white/5 py-2"
    >
      <div class="inline-block animate-marquee uppercase text-[10px] tracking-[0.4em] opacity-30">
        TOUR READY — CALENDAR SYNC — WHATSAPP AUTOMATION — NO MORE MISSED CALLS — SCALE YOUR
        LOGISTICS — TOUR READY — CALENDAR SYNC — WHATSAPP AUTOMATION — NO MORE MISSED CALLS — SCALE
        YOUR LOGISTICS —
      </div>
    </div>
  </section>
</template>
