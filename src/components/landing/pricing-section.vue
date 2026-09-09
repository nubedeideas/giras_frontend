<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'LandingPricing' })

const { t, tm } = useI18n()

type PlanId = 'starter' | 'premium' | 'custom'

type PlanBase = {
  id: PlanId
  name: string
  price: string
  priceSuffix: string
  featured?: boolean
}

type Plan = PlanBase & {
  tagline: string
  limit: string
  notifications: string
  features: string[]
  cta: string
}

const planBases: PlanBase[] = [
  { id: 'starter', name: 'Starter', price: '179€', priceSuffix: '/gira' },
  { id: 'premium', name: 'Premium', price: '300€', priceSuffix: '/gira', featured: true },
  { id: 'custom', name: 'Custom', price: '', priceSuffix: '' },
]

const plans = computed<Plan[]>(() =>
  planBases.map((base) => ({
    ...base,
    // "Custom" has no fixed number — its price slot is display text, so unlike the
    // literal 179€/300€ amounts (currency, locale-independent) it must be translated.
    price: base.id === 'custom' ? t('landing.pricing.plans.custom.priceLabel') : base.price,
    // "/gira" is Spanish prose ("per tour"), not part of the currency amount — translate it.
    priceSuffix: base.id === 'custom' ? '' : t('landing.pricing.perTourSuffix'),
    tagline: t(`landing.pricing.plans.${base.id}.tagline`),
    limit: t(`landing.pricing.plans.${base.id}.limit`),
    notifications: t(`landing.pricing.plans.${base.id}.notifications`),
    // tm() (not t()) is required here — t() only resolves compiled string leaves
    // and returns the key itself unresolved when it points at an array.
    features: tm(`landing.pricing.plans.${base.id}.features`) as unknown as string[],
    cta: t(`landing.pricing.plans.${base.id}.cta`),
  }))
)
</script>

<template>
  <section id="precios" class="relative scroll-mt-24 px-6 py-16 md:py-24">
    <div class="mx-auto max-w-7xl">
      <div class="reveal-up mb-14 text-center md:mb-20">
        <h2 class="font-header text-5xl leading-none uppercase sm:text-6xl md:text-8xl">
          {{ t('landing.pricing.heading') }} <br /><span class="acid-green italic">{{
            t('landing.pricing.headingHighlight')
          }}</span>
        </h2>
        <p class="mx-auto mt-6 max-w-2xl text-xs uppercase tracking-widest text-white/50">
          {{ t('landing.pricing.subhead') }}
        </p>
      </div>

      <div class="reveal-up grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch">
        <div
          v-for="plan in plans"
          :key="plan.id"
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
            {{ t('landing.pricing.featuredBadge') }}
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
