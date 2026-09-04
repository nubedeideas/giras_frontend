<script setup lang="ts">
import PublicLayout from '@/layouts/PublicLayout.vue'

const lastUpdated = 'Septiembre 2026'

const sections = [
  {
    title: '1. Aceptación de los Términos',
    body: 'Al crear una cuenta o utilizar Giras (GigSync), aceptas estos Términos y Condiciones en su totalidad. Si no estás de acuerdo con alguna parte, no debes utilizar el servicio.',
  },
  {
    title: '2. Descripción del Servicio',
    body: 'Giras es una plataforma de gestión logística para giras musicales. Permite sincronizar calendarios (Google Calendar), automatizar notificaciones al crew vía WhatsApp Business, e importar contactos, entre otras funcionalidades.',
  },
  {
    title: '3. Cuentas de Usuario',
    body: 'Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de toda actividad realizada bajo tu cuenta. Debes notificarnos de inmediato ante cualquier uso no autorizado.',
  },
  {
    title: '4. Integraciones de Terceros',
    body: 'Giras se conecta con servicios externos como Google Calendar, Google Contacts, WhatsApp Business API y Spotify para brindar sus funcionalidades. El uso de estas integraciones también está sujeto a los términos y políticas de privacidad de esos proveedores.',
  },
  {
    title: '5. Uso de Datos y Privacidad',
    body: 'Recopilamos y procesamos los datos estrictamente necesarios para operar el servicio: eventos de calendario, contactos del crew y mensajes de notificación. No vendemos ni compartimos tu información con terceros salvo lo necesario para el funcionamiento de las integraciones que tú mismo autorizas.',
  },
  {
    title: '6. Propiedad Intelectual',
    body: 'El software, diseño, marca y contenido de Giras son propiedad de sus creadores. No está permitida su reproducción o distribución sin autorización expresa.',
  },
  {
    title: '7. Limitación de Responsabilidad',
    body: 'Giras se ofrece "tal cual". No garantizamos disponibilidad ininterrumpida del servicio ni nos hacemos responsables por fallas de terceros (Google, WhatsApp, Spotify) que puedan afectar la sincronización o el envío de notificaciones.',
  },
  {
    title: '8. Cambios a estos Términos',
    body: 'Podemos actualizar estos Términos y Condiciones periódicamente. Notificaremos cambios relevantes a través de la aplicación o por correo electrónico.',
  },
  {
    title: '9. Contacto',
    body: 'Ante cualquier consulta sobre estos términos, escríbenos a legal@gigsync.app o visita nuestra sección de Soporte.',
  },
]
</script>

<template>
  <PublicLayout>
    <div class="max-w-4xl mx-auto space-y-16">
      <div class="reveal-up active space-y-4">
        <h2 class="text-[10px] uppercase tracking-[0.5em] text-acid-green">Legal</h2>
        <h1 class="font-header text-6xl md:text-8xl leading-none uppercase">
          Términos <br />
          <span class="acid-green italic">&amp; Condiciones</span>
        </h1>
        <p class="text-[10px] uppercase tracking-[0.3em] text-white/40 font-mono">
          Última actualización: {{ lastUpdated }}
        </p>
      </div>

      <div class="glass p-8 md:p-10 border-white/10 space-y-10">
        <section
          v-for="section in sections"
          :key="section.title"
          class="space-y-3 border-b border-white/5 pb-8 last:border-b-0 last:pb-0"
        >
          <h3 class="font-header text-2xl md:text-3xl uppercase">{{ section.title }}</h3>
          <p class="text-sm leading-relaxed text-white/60 font-mono">{{ section.body }}</p>
        </section>
      </div>
    </div>
  </PublicLayout>
</template>
