<script setup lang="ts">
import Stat from './stat.vue'
</script>

<template>
  <section class="py-16 mt-16 sm:mt-32 bg-acid-green text-black">
    <div class="max-w-7xl mx-auto px-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-12 text-center items-center">
        <Stat value="+500" label="Tours Gestionados" />
        <Stat value="12k" label="Lobby Calls Enviados" />
        <Stat value="99.9%" label="Uptime del Bot" />
        <Stat value="0" label="Vuelos Perdidos" />
      </div>

      <div class="mt-12 border-t border-black/10 pt-12">
        <div class="max-w-3xl mx-auto italic text-xl md:text-3xl text-center font-header uppercase tracking-tight">
          "Giras es el miembro del crew que nunca duerme, nunca se equivoca y nunca se queja. Ha
          transformado por completo la forma en que manejamos la logística en Europa."
        </div>
        <div class="mt-6 text-center text-[10px] uppercase tracking-[0.3em] font-bold">
          — Carlos M. / Tour Manager, Gira Mundial 2024
        </div>
      </div>
    </div>
  </section>
</template>
