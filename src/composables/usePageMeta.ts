import { useHead } from '@unhead/vue'

const SITE_URL = 'https://giras.pro'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`

export interface PageMetaOptions {
  title: string
  description: string
  /** Path starting with "/", e.g. "/soporte" */
  path: string
  ogImage?: string
}

/** Sets title, meta description, canonical, Open Graph and Twitter Card tags for one route. */
export function usePageMeta(options: PageMetaOptions) {
  const url = `${SITE_URL}${options.path}`
  const ogImage = options.ogImage ?? DEFAULT_OG_IMAGE

  useHead({
    title: options.title,
    meta: [
      { name: 'description', content: options.description },
      { property: 'og:url', content: url },
      { property: 'og:title', content: options.title },
      { property: 'og:description', content: options.description },
      { property: 'og:image', content: ogImage },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: options.title },
      { name: 'twitter:description', content: options.description },
      { name: 'twitter:image', content: ogImage },
    ],
    link: [{ rel: 'canonical', href: url }],
  })
}

/** Marks the current route as not-for-indexing — for authenticated app/admin routes. */
export function useNoIndex() {
  useHead({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  })
}

/** Injects one JSON-LD structured data block (schema.org). */
export function useJsonLd(schema: Record<string, unknown>) {
  useHead({
    script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(schema) }],
  })
}
