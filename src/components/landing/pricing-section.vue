<script setup lang="ts">
defineOptions({ name: 'LandingPricing' })

type Plan = {
  name: string
  price: string
  priceSuffix: string
  tagline: string
  limit: string
  notifications: string
  features: string[]
  cta: string
  featured?: boolean
}

const plans: Plan[] = [
  {
    name: 'Starter',
    price: '179€',
    priceSuffix: '/gira',
    tagline: 'Para artistas y promotores que arrancan su primera gira',
    limit: 'Hasta 10 shows por gira',
    notifications: '500 notificaciones incluidas',
    features: [
      'Sincronización automática con Google Calendar',
      'Envío por WhatsApp Business (API oficial)',
      'Motor de reglas de notificación',
      'Gestión de contactos y crew',
      '1 gira activa',
      'Soporte por email',
    ],
    cta: 'Empezar con Starter',
  },
  {
    name: 'Premium',
    price: '300€',
    priceSuffix: '/gira',
    tagline: 'Para giras grandes con crew multidisciplinar',
    limit: 'Hasta 20 shows por gira',
    notifications: '1.000 notificaciones incluidas',
    features: [
      'Todo lo incluido en Starter',
      'Formateo inteligente de mensajes con IA',
      'Grupos multi-crew (backline, catering, iluminación...)',
      'Envío de Day-Sheet automático night-before',
      'Confirmación de entrega en tiempo real',
      'Reportes y analítica de gira',
      'Soporte prioritario',
    ],
    cta: 'Empezar con Premium',
    featured: true,
  },
  {
    name: 'Custom',
    price: 'A Medida',
    priceSuffix: '',
    tagline: 'Para agencias con varias giras en simultáneo',
    limit: 'Más de 20 shows por gira',
    notifications: 'Volumen de notificaciones a medida',
    features: [
      'Todo lo incluido en Premium',
      'Giras y usuarios ilimitados',
      'Panel multi-gira con roles y permisos por agencia',
      'Integraciones y onboarding a medida',
      'Gestor de cuenta dedicado',
      'SLA y soporte prioritario',
    ],
    cta: 'Consultar',
  },
]
</script>

<template>
  <section id="precios" class="relative scroll-mt-24 px-6 py-16 md:py-24">
    <div class="mx-auto max-w-7xl">
      <div class="reveal-up mb-14 text-center md:mb-20">
        <h2 class="font-header text-5xl leading-none uppercase sm:text-6xl md:text-8xl">
          Un Plan Para <br /><span class="acid-green italic">Cada Tamaño De Gira</span>
        </h2>
        <p class="mx-auto mt-6 max-w-2xl text-xs uppercase tracking-widest text-white/50">
          Todos los planes incluyen sincronización con Google Calendar, envío por WhatsApp
          Business oficial y el motor de reglas de notificación.
        </p>
      </div>

      <div class="reveal-up grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch">
        <div
          v-for="plan in plans"
          :key="plan.name"
          :class="[
            'relative flex flex-col p-8 glass border transition-all',
            plan.featured
              ? 'border-acid-green shadow-hard md:-translate-y-4'
              : 'border-white/10 hover:border-white/25',
          ]"
        >
          <span
            v-if="plan.featured"
            class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-acid-green px-4 py-1 text-[9px] font-bold uppercase tracking-widest text-black"
          >
            Más elegido
          </span>

          <div class="mb-6">
            <h3 class="font-header text-3xl uppercase" :class="plan.featured ? 'acid-green' : ''">
              {{ plan.name }}
            </h3>
            <p class="mt-1 text-xs text-white/50">{{ plan.tagline }}</p>
          </div>

          <div class="mb-6 flex items-baseline gap-1">
            <span class="font-header text-5xl uppercase leading-none">{{ plan.price }}</span>
            <span v-if="plan.priceSuffix" class="font-mono text-xs text-white/40">{{
              plan.priceSuffix
            }}</span>
          </div>

          <div class="mb-6 space-y-2 border-y border-white/10 py-4">
            <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-tight">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-acid-green"></span>
              {{ plan.limit }}
            </div>
            <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-tight">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-acid-green"></span>
              {{ plan.notifications }}
            </div>
          </div>

          <ul class="mb-8 flex-1 space-y-3">
            <li
              v-for="feature in plan.features"
              :key="feature"
              class="flex items-start gap-2.5 text-xs leading-relaxed text-white/70"
            >
              <svg
                class="mt-0.5 h-3.5 w-3.5 shrink-0 text-acid-green"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ feature }}
            </li>
          </ul>

          <a
            href="#cta"
            :class="[
              'inline-flex w-full items-center justify-center px-6 py-4 text-xs font-bold uppercase tracking-tighter transition-all duration-200 hover:scale-105',
              plan.featured
                ? 'bg-acid-green text-black shadow-hard'
                : 'border border-white/20 text-white hover:border-acid-green hover:text-acid-green',
            ]"
          >
            {{ plan.cta }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
