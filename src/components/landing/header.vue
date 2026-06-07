<script setup lang="ts">
import { ref } from 'vue'
import NavItem from './nav-item.vue'
import MobileMenu from './mobile-menu.vue'
import { RouterLink } from 'vue-router'

const mobileMenuOpen = ref(false)
</script>

<template>
  <div class="fixed top-6 left-0 w-full z-50 px-4 pointer-events-none">
    <header class="max-w-5xl mx-auto glass rounded-full border border-white/10 px-6 py-2 flex justify-between items-center pointer-events-auto shadow-2xl">
      <RouterLink to="/" class="flex items-center gap-2 group cursor-pointer">
        <img src="/assets/giras_logo.svg" alt="Giras Logo" class="h-8 group-hover:scale-105 transition-transform" />
      </RouterLink>

      <nav class="hidden md:flex items-center gap-6">
        <NavItem label="Funcionalidades" :has-dropdown="true" />
        <NavItem label="Soluciones" :has-dropdown="true" />
        <NavItem label="Precio" />
      </nav>

      <div class="flex items-center gap-4">
        <RouterLink
          to="/login"
          class="bg-acid-green text-black px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95 hidden sm:block"
        >
          Log in
        </RouterLink>
        <RouterLink
          to="/login"
          class="border-2 border-acid-green text-acid-green bg-transparent px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 hover:bg-acid-green hover:text-black transition-all shadow-lg active:scale-95 hidden sm:block"
        >
          Empezar
        </RouterLink>

        <button
          class="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5 focus:outline-none bg-transparent border-none cursor-pointer"
          aria-label="Abrir menú"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <span class="block w-5 h-0.5 bg-current transition-all duration-300" :class="mobileMenuOpen ? 'rotate-45 translate-y-2' : ''" />
          <span class="block w-5 h-0.5 bg-current transition-all duration-300" :class="mobileMenuOpen ? 'opacity-0' : ''" />
          <span class="block w-5 h-0.5 bg-current transition-all duration-300" :class="mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''" />
        </button>
      </div>
    </header>

    <MobileMenu :is-open="mobileMenuOpen" />
  </div>
</template>
