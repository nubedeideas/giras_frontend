<template>
  <section id="narrative" class="py-16 mt-8 px-6 bg-black relative">
    <div class="max-w-4xl mx-auto space-y-24">
      <div class="reveal-up">
        <h2 class="text-[10px] uppercase tracking-[0.5em] text-acid-green mb-8">01 / El Problema</h2>
        <p class="text-3xl md:text-5xl font-header leading-tight uppercase">
          Perder tiempo enviando
          <span class="opacity-40 italic">"Lobby Call a las 8am"</span>
          individualmente a 15 personas no es management. <br />
          <span class="acid-green">Es esclavitud técnica.</span>
        </p>
      </div>

      <div class="reveal-up">
        <h2 class="text-[10px] uppercase tracking-[0.5em] text-acid-green mb-8">02 / El Método</h2>
        <p class="text-3xl md:text-5xl font-header leading-tight uppercase">
          Tu calendario manda. Giras escucha. <br />
          Cada evento en Google Calendar activa una
          <span class="opacity-40 italic">notificación programada</span>
          para el equipo correcto.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 reveal-up">
        <div class="glass p-8 border-white/10 hover:border-acid-green/40 transition-all">
          <h3 class="font-header text-3xl mb-4">Antes: El Caos</h3>
          <ul class="space-y-2 text-xs opacity-60 uppercase list-disc list-inside">
            <li>Copiar y pegar textos a las 2 AM.</li>
            <li>Músicos que "no vieron el mensaje".</li>
            <li>Errores manuales en horarios.</li>
            <li>Pánico en el lobby del hotel.</li>
          </ul>
        </div>
        <div class="glass p-8 border-acid-green/40 bg-acid-green/5 shadow-[0_0_30px_rgba(192,255,0,0.05)]">
          <h3 class="font-header text-3xl mb-4 acid-green">Ahora: Giras</h3>
          <ul class="space-y-2 text-xs uppercase list-disc list-inside font-bold">
            <li>Sincronización instantánea GCal.</li>
            <li>Confirmación de lectura automática.</li>
            <li>Reglas de equipo inteligentes.</li>
            <li>Paz mental absoluta.</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts"></script>
