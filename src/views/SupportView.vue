<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PublicLayout from '@/layouts/PublicLayout.vue'

const { t, tm } = useI18n()

const TOC_IDS = ['primeros-pasos', 'integraciones', 'faq', 'contacto'] as const

const toc = computed(() =>
  TOC_IDS.map((id) => ({ id, label: t(`support.toc.${id}`) }))
)

// tm() (not t()) is required here — t() only resolves compiled string leaves
// and returns the key itself unresolved when it points at an array.
const faqs = computed(
  () => tm('support.faq.items') as unknown as { q: string; a: string }[]
)
</script>

<template>
  <PublicLayout>
    <div class="max-w-6xl mx-auto">
      <div class="reveal-up active mb-16 space-y-4">
        <h2 class="font-mono text-[10px] uppercase tracking-[0.5em] text-acid-green">
          {{ t('support.eyebrow') }}
        </h2>
        <h1 class="font-header text-6xl leading-none uppercase md:text-8xl">
          {{ t('support.title') }} <span class="acid-green italic">{{
            t('support.titleHighlight')
          }}</span>
        </h1>
        <p class="max-w-lg text-sm leading-relaxed text-white/60">
          {{ t('support.intro') }}
        </p>
      </div>

      <div class="grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <!-- TOC -->
        <nav
          class="space-y-1 font-mono text-xs uppercase tracking-widest lg:sticky lg:top-32 lg:self-start"
        >
          <div class="mb-2 text-white/30">{{ t('support.tocHeading') }}</div>
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
            <h3 class="acid-green font-header text-3xl uppercase">
              {{ t('support.gettingStarted.heading') }}
            </h3>
            <p class="font-mono text-sm leading-relaxed text-white/60">
              {{ t('support.gettingStarted.body') }}
            </p>
          </section>

          <section id="integraciones" class="scroll-mt-32 glass space-y-4 border-white/10 p-8">
            <h3 class="acid-green font-header text-3xl uppercase">
              {{ t('support.integrations.heading') }}
            </h3>
            <ul
              class="list-inside list-disc space-y-3 font-mono text-sm leading-relaxed text-white/60"
            >
              <li>
                <b class="text-white">Google Calendar</b> —
                {{ t('support.integrations.items.googleCalendar') }}
              </li>
              <li>
                <b class="text-white">WhatsApp Business API</b> —
                {{ t('support.integrations.items.whatsapp') }}
              </li>
              <li>
                <b class="text-white">Google Contacts</b> —
                {{ t('support.integrations.items.googleContacts') }}
              </li>
              <li>
                <b class="text-white">Spotify</b> — {{ t('support.integrations.items.spotify') }}
              </li>
            </ul>
          </section>

          <section id="faq" class="scroll-mt-32 glass space-y-4 border-white/10 p-8">
            <h3 class="acid-green font-header text-3xl uppercase">
              {{ t('support.faq.heading') }}
            </h3>
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
            <h3 class="acid-green font-header text-3xl uppercase">
              {{ t('support.contact.heading') }}
            </h3>
            <p class="font-mono text-sm leading-relaxed text-white/60">
              {{ t('support.contact.body') }}
            </p>
            <div class="border border-white/10 bg-black/40 p-4 font-mono text-xs text-white/70">
              <div>
                {{ t('support.contact.emailLabel') }}
                <span class="acid-green">soporte@gigsync.app</span>
              </div>
              <div>{{ t('support.contact.hoursLabel') }} {{ t('support.contact.hoursValue') }}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </PublicLayout>
</template>
