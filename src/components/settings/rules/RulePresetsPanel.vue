<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RulePreset } from '@/composables/useNotificationRules'
import { skipReasonLabel } from '@/utils/notificationRules'

defineProps<{
  presets: RulePreset[]
  /** Clave de la sugerida que se está activando. */
  busyKey?: string | null
  error?: string
}>()
const emit = defineEmits<{
  apply: [key: string]
  open: [ruleUuid: string]
}>()

const { t, te } = useI18n()

function title(p: RulePreset) {
  const key = `rules.presets.${p.key}.title`
  return te(key) ? t(key) : p.key
}

function desc(p: RulePreset) {
  const key = `rules.presets.${p.key}.desc`
  return te(key) ? t(key) : ''
}

function isApplied(p: RulePreset) {
  return !!p.applied_rule && p.applied_active
}
</script>

<template>
  <section
    v-if="presets.length"
    class="mb-5"
    data-test="presets"
  >
    <p class="text-[10px] font-bold text-ink-3 tracking-[0.5px] uppercase mb-2">
      {{ t('rules.presets.title') }}
    </p>
    <p
      v-if="error"
      class="text-[11px] text-red-400 mb-2"
    >
      {{ error }}
    </p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div
        v-for="p in presets"
        :key="p.key"
        class="bg-glass border rounded-sm px-3 py-2.5 flex flex-col gap-2"
        :class="isApplied(p) ? 'border-line-acid' : 'border-line'"
        :data-test="`preset-${p.key}`"
      >
        <div class="min-w-0">
          <p class="text-[12px] font-semibold text-ink">
            {{ title(p) }}
          </p>
          <p
            v-if="desc(p)"
            class="text-[11px] text-ink-3 mt-0.5"
          >
            {{ desc(p) }}
          </p>
        </div>
        <div class="mt-auto">
          <button
            v-if="isApplied(p)"
            class="text-[11px] font-semibold text-acid bg-transparent border-none p-0 cursor-pointer hover:underline"
            data-test="preset-active"
            @click="emit('open', p.applied_rule as string)"
          >
            ✓ {{ t('rules.presets.active') }}
          </button>
          <div
            v-else-if="!p.available"
            class="flex flex-col items-start gap-1"
            data-test="preset-unavailable"
          >
            <button
              class="inline-flex items-center rounded-sm bg-glass-2 text-ink-4 font-bold px-2.5 py-[5px] text-[10px] border-none cursor-not-allowed"
              disabled
            >
              {{ t('rules.presets.activate') }}
            </button>
            <p class="text-[11px] text-brand-orange">
              {{
                t('rules.presets.unavailable', {
                  reason: skipReasonLabel(p.unavailable_reason ?? '', t),
                })
              }}
            </p>
          </div>
          <button
            v-else
            class="inline-flex items-center rounded-sm bg-acid text-black font-bold px-2.5 py-[5px] text-[10px] border-none cursor-pointer transition-opacity"
            :class="busyKey ? 'opacity-50' : ''"
            :disabled="!!busyKey"
            data-test="preset-activate"
            @click="emit('apply', p.key)"
          >
            {{ busyKey === p.key ? t('rules.presets.activating') : t('rules.presets.activate') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
