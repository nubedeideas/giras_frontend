<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import '@/assets/landing.css'
import LandingHeader from '@/components/landing/header.vue'
import LandingFooter from '@/components/landing/footer.vue'

onMounted(() => {
  // Dashboard global CSS sets overflow:hidden + height:100% on html/body and height:100vh on
  // #app. Override those here so this page can scroll normally, same as LandingView. Resetting
  // body's height is required too: with height:100% left in place, body becomes its own
  // fixed-size scroll container (since it also gets overflow:auto), so window.scrollTo/
  // scrollBehavior — which scroll the window/documentElement — silently do nothing.
  document.documentElement.style.overflow = 'auto'
  document.body.style.overflow = 'auto'
  document.body.style.height = 'auto'
  const app = document.getElementById('app')
  if (app) app.style.height = 'auto'
})

onUnmounted(() => {
  document.documentElement.style.removeProperty('overflow')
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('height')
  const app = document.getElementById('app')
  if (app) app.style.removeProperty('height')
})
</script>

<template>
  <div class="landing-body">
    <div class="min-h-screen grid-bg">
      <LandingHeader />
      <main class="px-6 pb-24 pt-40">
        <slot />
      </main>
      <LandingFooter />
    </div>
  </div>
</template>
