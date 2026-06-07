<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import '@/assets/landing.css'
import LandingHeader from '@/components/landing/header.vue'
import LandingHero from '@/components/landing/hero.vue'
import LandingNarrative from '@/components/landing/narrative.vue'
import LandingShowcase from '@/components/landing/showcase.vue'
import LandingSocialProof from '@/components/landing/social-proof.vue'
import LandingBentoFeatures from '@/components/landing/bento-features.vue'
import LandingCTASection from '@/components/landing/cta-section.vue'
import LandingFooter from '@/components/landing/footer.vue'

let observer: IntersectionObserver

onMounted(() => {
  // Dashboard global CSS sets overflow:hidden on html/body and height:100vh on #app.
  // Override those here so the landing can scroll normally.
  document.documentElement.style.overflow = 'auto'
  document.body.style.overflow = 'auto'
  const app = document.getElementById('app')
  if (app) app.style.height = 'auto'

  observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('active') }),
    { threshold: 0.1 },
  )
  document.querySelectorAll('.reveal-up').forEach((el) => observer.observe(el))
})

onUnmounted(() => {
  // Restore dashboard scroll containment before navigating back.
  document.documentElement.style.removeProperty('overflow')
  document.body.style.removeProperty('overflow')
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
        <LandingBentoFeatures />
        <LandingCTASection />
      </main>
      <LandingFooter />
    </div>
  </div>
</template>
