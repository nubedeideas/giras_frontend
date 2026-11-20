<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import ConsentBanner from '@/components/ConsentBanner.vue'

const route = useRoute()
</script>

<template>
  <RouterView />
  <!-- El portal del crew no carga GTM: no hay nada que consentir -->
  <ClientOnly v-if="!route.meta.crew">
    <ConsentBanner />
  </ClientOnly>
</template>
