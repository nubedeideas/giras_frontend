<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useConsent } from '@/composables/useConsent'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

const { t } = useI18n()
const { status, accept, reject } = useConsent()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="status === null"
      class="fixed inset-x-0 z-[200] flex justify-center px-3 bottom-[76px] lg:bottom-4"
    >
      <div
        class="w-full max-w-xl bg-bg-3 border border-line rounded-2xl shadow-[0_8px_30px_var(--shadow-md)] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <p class="flex-1 text-[12px] text-ink-2 leading-relaxed">
          {{ t('consent.message') }}
          <a
            href="/terminos-y-condiciones"
            class="text-acid-muted hover:text-acid no-underline"
          >{{ t('consent.more') }}</a>
        </p>
        <div class="flex gap-2 flex-shrink-0">
          <BtnSecondary
            small
            @click="reject"
          >
            {{ t('consent.reject') }}
          </BtnSecondary>
          <BtnPrimary
            small
            @click="accept"
          >
            {{ t('consent.accept') }}
          </BtnPrimary>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
