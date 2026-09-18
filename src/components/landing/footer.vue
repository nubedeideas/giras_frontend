<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="py-12 mt-16 px-6 border-t border-white/5">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
      <div class="flex items-center gap-2 group cursor-pointer">
        <img
          src="/assets/giras_logo.svg"
          alt="Giras Logo"
          class="h-8 group-hover:scale-105 transition-transform"
        >
      </div>

      <div class="flex items-center gap-4 text-[10px] uppercase tracking-[0.3em] font-bold">
        <span class="opacity-30">&copy; {{ currentYear }} GIRAS //</span>
        <div class="flex items-center gap-3 text-white/30">
          <a
            href="https://x.com/giraspro_"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t('landing.footer.xLabel')"
            class="hover:text-acid-green transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://www.instagram.com/giraspro/"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t('landing.footer.instagramLabel')"
            class="hover:text-acid-green transition-colors"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect
                x="2"
                y="2"
                width="20"
                height="20"
                rx="5"
                ry="5"
              />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line
                x1="17.5"
                y1="6.5"
                x2="17.51"
                y2="6.5"
              />
            </svg>
          </a>
        </div>
      </div>

      <div class="flex gap-6 text-[10px] uppercase font-bold tracking-widest">
        <RouterLink
          to="/terminos-y-condiciones"
          class="hover:text-acid-green transition-colors"
        >
          {{ t('landing.footer.termsLink') }}
        </RouterLink>
        <RouterLink
          to="/soporte"
          class="hover:text-acid-green transition-colors"
        >
          {{ t('landing.footer.supportLink') }}
        </RouterLink>
      </div>
    </div>
  </footer>
</template>
