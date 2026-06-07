<script setup lang="ts">
import BentoBox from './bento-box.vue'
</script>

<template>
  <section id="features" class="py-16 mt-16 px-6">
    <div class="max-w-7xl mx-auto">
      <h2 class="font-header text-6xl uppercase mb-16 reveal-up">
        Diferenciadores <br />
        <span class="opacity-40 italic underline decoration-acid-green">Técnicos</span>
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[250px] reveal-up">
        <BentoBox
          class-name="md:col-span-2 md:row-span-1"
          title="Sincronización Profunda"
          desc="No solo leemos el evento. Analizamos descripciones, ubicaciones y notas para automatizar el contenido del mensaje."
        />
        <BentoBox
          title="WhatsApp Business API"
          desc="Sin bloqueos de cuenta. Usamos canales oficiales para asegurar que el 100% de los mensajes lleguen."
          :accent="true"
        />
        <BentoBox
          title="Multi-Crew"
          desc="Crea grupos para Backline, Catering, Iluminación y Músicos."
        />
        <BentoBox
          class-name="md:col-span-2"
          title="Reglas de Notificación"
          desc="Programación flexible: 'X horas antes del evento', 'A la hora exacta', 'Recordatorio 10 mins después si no hay OK'."
        />
      </div>
    </div>
  </section>
</template>
