<script setup lang="ts">
import { RouterLink } from 'vue-router'
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="py-12 mt-16 px-6 border-t border-white/5">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
      <div class="flex items-center gap-2 group cursor-pointer">
        <img src="/assets/giras_logo.svg" alt="Giras Logo" class="h-8 group-hover:scale-105 transition-transform" />
      </div>

      <div class="text-[10px] uppercase opacity-30 tracking-[0.3em] font-bold">
        &copy; {{ currentYear }} GIRAS MICRO-SAAS // MADE FOR THE ROAD
      </div>

      <div class="flex gap-6 text-[10px] uppercase font-bold tracking-widest">
        <RouterLink to="/terminos-y-condiciones" class="hover:text-acid-green transition-colors">Términos</RouterLink>
        <RouterLink to="/politica-de-privacidad" class="hover:text-acid-green transition-colors">Privacidad</RouterLink>
        <a href="#" class="hover:text-acid-green transition-colors">Soporte</a>
      </div>
    </div>
  </footer>
</template>
