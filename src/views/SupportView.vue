<script setup lang="ts">
import PublicLayout from '@/layouts/PublicLayout.vue'

const toc = [
  { id: 'primeros-pasos', label: 'Primeros pasos' },
  { id: 'integraciones', label: 'Integraciones' },
  { id: 'faq', label: 'Preguntas frecuentes' },
  { id: 'contacto', label: 'Contacto' },
]

const faqs = [
  {
    q: '¿Cómo conecto mi Google Calendar?',
    a: 'Desde el asistente de configuración inicial (o en Ajustes → Integraciones) autoriza el acceso a tu cuenta de Google. Giras sincroniza automáticamente los eventos de la gira que elijas.',
  },
  {
    q: '¿Por qué no llegan las notificaciones por WhatsApp?',
    a: 'Verifica que el número de WhatsApp Business esté activo en Ajustes y que los contactos del crew tengan su número cargado correctamente. Los envíos usan canales oficiales de WhatsApp Business API, por lo que pueden tardar unos segundos en confirmarse.',
  },
  {
    q: '¿Puedo importar mis contactos existentes?',
    a: 'Sí. Durante el onboarding o desde la sección Contactos puedes importar tu lista desde Google Contacts en un solo paso.',
  },
  {
    q: '¿Cómo busco artistas al crear una gira?',
    a: 'El buscador de artistas usa la API de Spotify a través de nuestro backend, así que no necesitas credenciales propias: solo escribe el nombre y elige el resultado correcto.',
  },
  {
    q: '¿Qué pasa si cambio un evento en Google Calendar?',
    a: 'Los cambios se sincronizan automáticamente y se reflejan en Giras. Si una notificación ya fue enviada, puedes reenviar una actualización manualmente desde el detalle del evento.',
  },
]
</script>

<template>
  <PublicLayout>
    <div class="max-w-6xl mx-auto">
      <div class="reveal-up active mb-16 space-y-4">
        <h2 class="font-mono text-[10px] uppercase tracking-[0.5em] text-acid-green">
          // README.md
        </h2>
        <h1 class="font-header text-6xl leading-none uppercase md:text-8xl">
          Centro de <span class="acid-green italic">Soporte</span>
        </h1>
        <p class="max-w-lg text-sm leading-relaxed text-white/60">
          Todo lo que necesitas para sacarle el máximo provecho a Giras, directo del manual del
          equipo.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <!-- TOC -->
        <nav
          class="space-y-1 font-mono text-xs uppercase tracking-widest lg:sticky lg:top-32 lg:self-start"
        >
          <div class="mb-2 text-white/30">Índice</div>
          <a
            v-for="item in toc"
            :key="item.id"
            :href="`#${item.id}`"
            class="block py-1.5 text-white/50 transition-colors hover:text-acid-green"
          >
            # {{ item.label }}
          </a>
        </nav>

        <div class="space-y-16">
          <section id="primeros-pasos" class="scroll-mt-32 glass space-y-4 border-white/10 p-8">
            <h3 class="acid-green font-header text-3xl uppercase">01 / Primeros Pasos</h3>
            <p class="font-mono text-sm leading-relaxed text-white/60">
              Al iniciar sesión por primera vez, el asistente te guía en 3 pasos: crear tu primera
              gira, armar el crew (manual o importado desde Google Contacts) y conectar tu Google
              Calendar. Puedes reabrir el asistente en cualquier momento desde el botón "+" del menú
              lateral.
            </p>
          </section>

          <section id="integraciones" class="scroll-mt-32 glass space-y-4 border-white/10 p-8">
            <h3 class="acid-green font-header text-3xl uppercase">02 / Integraciones</h3>
            <ul
              class="list-inside list-disc space-y-3 font-mono text-sm leading-relaxed text-white/60"
            >
              <li>
                <b class="text-white">Google Calendar</b> — sincronización de eventos en tiempo
                real.
              </li>
              <li>
                <b class="text-white">WhatsApp Business API</b> — notificaciones automáticas al
                crew.
              </li>
              <li><b class="text-white">Google Contacts</b> — importación masiva de contactos.</li>
              <li><b class="text-white">Spotify</b> — búsqueda de artistas al crear una gira.</li>
            </ul>
          </section>

          <section id="faq" class="scroll-mt-32 glass space-y-4 border-white/10 p-8">
            <h3 class="acid-green font-header text-3xl uppercase">03 / Preguntas Frecuentes</h3>
            <div class="space-y-6">
              <div
                v-for="faq in faqs"
                :key="faq.q"
                class="border-b border-white/5 pb-5 last:border-b-0 last:pb-0"
              >
                <p class="mb-2 text-sm font-bold uppercase tracking-tight">{{ faq.q }}</p>
                <p class="font-mono text-xs leading-relaxed text-white/50">{{ faq.a }}</p>
              </div>
            </div>
          </section>

          <section
            id="contacto"
            class="scroll-mt-32 glass space-y-4 border-acid-green/30 bg-acid-green/5 p-8"
          >
            <h3 class="acid-green font-header text-3xl uppercase">04 / Contacto</h3>
            <p class="font-mono text-sm leading-relaxed text-white/60">
              ¿No has encontrado lo que buscabas? Escríbenos y te respondemos en menos de 24 horas.
            </p>
            <div class="border border-white/10 bg-black/40 p-4 font-mono text-xs text-white/70">
              <div>email: <span class="acid-green">soporte@gigsync.app</span></div>
              <div>horario: Lun-Vie 09:00-18:00 (CET)</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </PublicLayout>
</template>
