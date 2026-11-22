<script setup lang="ts">
// Estimación de WhatsApp junto a "Confirmar" (F1 D11): "Unos {total} WhatsApp durante la gira ·
// te quedan {remaining} en tu plan" y, si no caben (`exceeds`), aviso de que el resto saldrá por
// email y en la app. Nada si el campo es `null` o no entra nadie con móvil (`people` 0).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImportWhatsappEstimate } from '@/composables/useImportJobs'

const props = defineProps<{ estimate: ImportWhatsappEstimate | null | undefined }>()

const { t } = useI18n()

const visible = computed(() => !!props.estimate && props.estimate.people > 0)

const line = computed(() => {
  const e = props.estimate
  if (!e) return ''
  const parts = [t('importer.estimate.total', { n: e.total }, e.total)]
  if (e.remaining !== null) parts.push(t('importer.estimate.remaining', { n: e.remaining }, e.remaining))
  return parts.join(' · ')
})
</script>

<template>
  <div
    v-if="visible"
    class="flex flex-col gap-1"
    data-test="import-wa-estimate"
  >
    <p
      class="text-[13px] text-ink-2"
      data-test="import-wa-estimate-line"
    >
      {{ line }}
    </p>
    <p
      v-if="estimate?.exceeds"
      class="text-[13px] text-pending-fg rounded-sm bg-pending-bg px-2.5 py-1.5"
      data-test="import-wa-estimate-exceeds"
    >
      {{ t('importer.estimate.exceeds') }}
    </p>
  </div>
</template>
