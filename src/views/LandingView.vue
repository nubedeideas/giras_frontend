<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import '@/assets/landing.css'
import LandingHeader from '@/components/landing/header.vue'
import LandingHero from '@/components/landing/hero.vue'
import LandingNarrative from '@/components/landing/narrative.vue'
import LandingShowcase from '@/components/landing/showcase.vue'
import LandingSocialProof from '@/components/landing/social-proof.vue'
import LandingPricing from '@/components/landing/pricing-section.vue'
import LandingBentoFeatures from '@/components/landing/bento-features.vue'
import LandingCTASection from '@/components/landing/cta-section.vue'
import LandingFooter from '@/components/landing/footer.vue'

let observer: IntersectionObserver

onMounted(() => {
  // Dashboard global CSS sets overflow:hidden + height:100% on html/body and height:100vh on
  // #app. Override those here so the landing can scroll normally. Resetting body's height is
  // required too: with height:100% left in place, body becomes its own fixed-size scroll
  // container (since it also gets overflow:auto), so window.scrollTo/scrollBehavior — which
  // scroll the window/documentElement — silently do nothing.
  document.documentElement.style.overflow = 'auto'
  document.body.style.overflow = 'auto'
  document.body.style.height = 'auto'
  const app = document.getElementById('app')
  if (app) app.style.height = 'auto'

  observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('active')
      }),
    { threshold: 0.1 }
  )
  document.querySelectorAll('.reveal-up').forEach((el) => observer.observe(el))
})

onUnmounted(() => {
  // Restore dashboard scroll containment before navigating back.
  document.documentElement.style.removeProperty('overflow')
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('height')
  const app = document.getElementById('app')
  if (app) app.style.removeProperty('height')
  observer?.disconnect()
})
</script>

<template>
  <div class="landing-body">
    <div class="min-h-screen grid-bg">
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingNarrative />
        <LandingShowcase />
        <LandingSocialProof />
        <LandingPricing />
        <LandingBentoFeatures />
        <LandingCTASection />
      </main>
      <LandingFooter />
    </div>
  </div>
</template>
