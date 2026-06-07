<script setup lang="ts">
import NavItem from './nav-item.vue'
import { RouterLink } from 'vue-router'
defineProps<{ isOpen: boolean }>()
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 -translate-y-4"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-4"
  >
    <div
      v-if="isOpen"
      class="md:hidden pointer-events-auto mt-3 max-w-5xl mx-auto bg-neutral-950 rounded-2xl border border-white/10 px-6 py-6 shadow-2xl flex flex-col gap-6"
    >
      <nav class="flex flex-col gap-4">
        <NavItem label="Funcionalidades" :has-dropdown="true" />
        <NavItem label="Soluciones" :has-dropdown="true" />
        <NavItem label="Precio" />
      </nav>
      <div class="flex flex-col gap-3">
        <RouterLink
          to="/login"
          class="w-full text-center bg-acid-green text-black px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-lg active:scale-95"
        >
          Log in
        </RouterLink>
        <RouterLink
          to="/login"
          class="w-full text-center border-2 border-acid-green text-acid-green bg-transparent px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 hover:bg-acid-green hover:text-black transition-all shadow-lg active:scale-95"
        >
          Empezar
        </RouterLink>
      </div>
    </div>
  </Transition>
</template>
