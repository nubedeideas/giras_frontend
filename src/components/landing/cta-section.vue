<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const EMAIL_REGEX =
  /^(?=.{6,254}$)(?=.{1,64}@)[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i

const email = ref('')
const emailError = ref('')
const isLoading = ref(false)
const submitted = ref(false)

const validateEmail = (value: string) => {
  const v = value.trim().toLowerCase()
  if (!v) return t('landing.cta.errors.required')
  if (v.includes('..')) return t('landing.cta.errors.consecutiveDots')
  if (!EMAIL_REGEX.test(v)) return t('landing.cta.errors.invalid')
  return ''
}

const handleSubmit = async () => {
  if (isLoading.value) return
  const normalized = email.value.trim().toLowerCase()
  const error = validateEmail(normalized)
  email.value = normalized
  emailError.value = error
  if (error) return

  isLoading.value = true
  try {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    submitted.value = true
    email.value = ''
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <section id="cta" class="py-16 px-6 relative overflow-hidden scroll-mt-24">
    <div class="max-w-4xl mx-auto text-center relative z-10 reveal-up">
      <h2 class="font-header text-7xl md:text-[10rem] leading-[0.8] uppercase mb-12">
        {{ t('landing.cta.heading') }} <br /><span class="acid-green">{{
          t('landing.cta.headingHighlight')
        }}</span>
      </h2>
      <p class="text-white/60 mb-12 max-w-xl mx-auto uppercase text-xs tracking-widest font-bold">
        {{ t('landing.cta.subheadLine1') }}<br />
        {{ t('landing.cta.subheadLine2') }}
      </p>

      <div v-if="submitted" class="py-8">
        <p class="text-acid-green font-header text-4xl uppercase mb-2">
          {{ t('landing.cta.successTitle') }}
        </p>
        <p class="text-white/50 text-xs uppercase tracking-widest">
          {{ t('landing.cta.successSub') }}
        </p>
      </div>

      <form v-else class="max-w-lg mx-auto" novalidate @submit.prevent="handleSubmit">
        <div class="flex flex-col sm:flex-row gap-4">
          <input
            v-model="email"
            type="email"
            :placeholder="t('landing.cta.emailPlaceholder')"
            :disabled="isLoading"
            autocomplete="email"
            inputmode="email"
            :aria-label="t('landing.cta.emailAriaLabel')"
            :aria-invalid="Boolean(emailError)"
            class="flex-1 bg-white/5 border px-6 py-4 text-xs focus:outline-none focus:border-acid-green uppercase font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            :class="emailError ? 'border-red-500/80' : 'border-white/10'"
          />
          <button
            type="submit"
            :disabled="isLoading"
            :class="[
              'inline-flex w-full shrink-0 items-center justify-center whitespace-nowrap bg-acid-green px-8 py-4 text-sm font-bold uppercase tracking-tighter text-black transition-all duration-200 sm:w-[18rem]',
              isLoading ? 'shadow-hard-loading cursor-wait' : 'shadow-hard hover:scale-105',
            ]"
          >
            {{ isLoading ? t('landing.cta.submitLoadingLabel') : t('landing.cta.submitLabel') }}
          </button>
        </div>
        <p v-if="emailError" class="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-red-400">
          {{ emailError }}
        </p>
      </form>

      <p class="mt-8 text-[9px] uppercase opacity-40 tracking-[0.2em]">
        {{ t('landing.cta.urgency') }}
      </p>
    </div>

    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[800px] h-[800px] bg-acid-green/5 blur-[150px] rounded-full"></div>
  </section>
</template>
