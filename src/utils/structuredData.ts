const SITE_URL = 'https://giras.pro'

export interface PlanOffer {
  name: string
  price: string
  priceCurrency?: string
}

export function organizationSchema(logoUrl: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Giras',
    url: SITE_URL,
    logo: logoUrl,
    description,
  }
}

export function softwareApplicationSchema(description: string, offers: PlanOffer[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Giras',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description,
    offers: offers.map((o) => ({
      '@type': 'Offer',
      name: o.name,
      price: o.price,
      priceCurrency: o.priceCurrency ?? 'EUR',
    })),
  }
}

export function faqPageSchema(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
}
