import { ref } from 'vue'

/** Every landing button that scrolls to the #cta lead form — extend here if a new one is added */
export type CtaSource = 'hero' | 'pricing_starter' | 'pricing_premium' | 'pricing_custom'

// Singleton, module-level — same pattern as useConsent.ts. Keeps only the most
// recent click: if someone clicks two different plan buttons before submitting,
// the latest one is the strongest signal of what they're actually interested in.
const lastSource = ref<CtaSource | null>(null)

function setCtaSource(source: CtaSource) {
  lastSource.value = source
}

export function useCtaSource() {
  return { lastSource, setCtaSource }
}
