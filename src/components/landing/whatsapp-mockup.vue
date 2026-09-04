<template>
  <div
    class="glass relative aspect-[9/18.5] w-full overflow-hidden rounded-[2.5rem] border-[10px] border-white/10 p-4"
  >
    <div class="-mx-4 -mt-4 mb-4 flex items-center gap-3 rounded-t-[1.8rem] bg-[#075e54] p-5">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/20 text-xs"
      >
        G
      </div>
      <div>
        <div class="text-[11px] font-bold tracking-tight text-white">Giras Manager</div>
        <div class="flex items-center gap-1 text-[9px] text-acid-green">
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-acid-green"></span>
          En línea
        </div>
      </div>
    </div>
    <div class="space-y-4 px-1">
      <div
        class="w-[90%] rounded-2xl rounded-tl-none bg-[#dcf8c6] p-4 text-[11px] text-black shadow-lg"
      >
        <div class="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase">
          <span>📍</span> LOBBY CALL: MADRID
        </div>
        <p class="leading-relaxed opacity-80">
          Hola Equipo 👋. Mañana el transporte sale a las <b>08:00 AM</b> puntual.
        </p>
      </div>
      <div
        class="w-[90%] rounded-2xl rounded-tl-none bg-[#dcf8c6] p-4 text-[11px] text-black shadow-lg"
      >
        <div class="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase text-red-600">
          <span>🚨</span> URGENTE
        </div>
        <p class="leading-relaxed opacity-80">
          La prueba de sonido se adelanta a las <b>16:15</b>.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'WhatsappMockup' })
</script>
