import i18n from '@/i18n'
import { useConsent } from '@/composables/useConsent'
import { useCtaSource } from '@/composables/useCtaSource'

export interface LeadEnrichment {
  timezone: string
  browser_language: string
  ui_language: string
  user_agent: string
  is_mobile_hint: boolean | null
  viewport_width: number
  sent_at_utc: string
  page_url: string
  referrer: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  gclid: string | null
  fbclid: string | null
  ga_client_id: string | null
  ga_session_id: string | null
  consent_granted: boolean
  cta_source: string | null
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

/** _ga format: GA1.1.<id1>.<id2> — the GA4 Client ID is the last two segments joined */
function gaClientId(): string | null {
  const raw = readCookie('_ga')
  if (!raw) return null
  const parts = raw.split('.')
  return parts.length >= 4 ? `${parts[2]}.${parts[3]}` : null
}

/** Cookie name is _ga_<measurement id suffix>, which isn't known statically — scan for it.
 *  Format: GS1.1.<session_id>.<...> */
function gaSessionId(): string | null {
  const match = document.cookie.match(/(?:^|; )(_ga_[A-Z0-9]+)=([^;]*)/)
  if (!match) return null
  const parts = decodeURIComponent(match[2]).split('.')
  return parts.length >= 3 ? parts[2] : null
}

/** Only Chromium browsers expose this (Client Hints) — null means "let the backend
 *  classify it from the raw user_agent instead", not "not mobile". */
function isMobileHint(): boolean | null {
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  return typeof uaData?.mobile === 'boolean' ? uaData.mobile : null
}

function urlParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name)
}

export function useLeadEnrichment() {
  function build(): LeadEnrichment {
    const { status } = useConsent()
    const { lastSource } = useCtaSource()

    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      browser_language: navigator.language,
      ui_language: i18n.global.locale.value,
      user_agent: navigator.userAgent,
      is_mobile_hint: isMobileHint(),
      viewport_width: window.innerWidth,
      sent_at_utc: new Date().toISOString(),
      page_url: window.location.href,
      referrer: document.referrer,
      utm_source: urlParam('utm_source'),
      utm_medium: urlParam('utm_medium'),
      utm_campaign: urlParam('utm_campaign'),
      utm_term: urlParam('utm_term'),
      utm_content: urlParam('utm_content'),
      gclid: urlParam('gclid'),
      fbclid: urlParam('fbclid'),
      ga_client_id: status.value === 'granted' ? gaClientId() : null,
      ga_session_id: status.value === 'granted' ? gaSessionId() : null,
      consent_granted: status.value === 'granted',
      cta_source: lastSource.value,
    }
  }

  return { build }
}
