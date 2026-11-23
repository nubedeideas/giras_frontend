<script setup lang="ts">
// "Comparte la agenda con tu equipo" (F5a §4.3, D-F5-12) en la pantalla final de la importación:
// las personas confirmadas (`result.contact_uuids`) que tienen enlace al portal del crew, cada una
// con su estado y "Compartir". Se comparte desde el dispositivo del tour manager: menú de compartir
// del sistema (Web Share) en el móvil, o copiar; en escritorio, además, "WhatsApp" abre `wa.me` sin
// número con el texto. Nada sale por Twilio ni gasta cupo. Sin "Compartir todos": cada enlace es
// personal (se revoca y cuenta visitas por persona). Si la persona aún no tiene enlace (`none`), se
// crea con `ensureCrewLink` al compartir. Lista de `GET /api/tours/{uuid}/crew-links/` (todas las
// páginas) filtrada por `contactUuids`, con protección frente a respuestas atrasadas.
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useCrewLinks, type CrewLinkRow, type CrewLinkState } from '@/composables/useCrewLinks'
import { ApiError } from '@/utils/apiClient'
import { copyText } from '@/utils/clipboard'
import { apiErrorCodes } from '@/utils/notificationErrors'
import { crewLinkBadge } from '@/utils/statusBadge'

const props = defineProps<{
  tourUuid: string
  tourName: string
  /** Contactos confirmados por la importación (`result.contact_uuids`). */
  contactUuids: string[]
}>()

const { t } = useI18n()
const linksApi = useCrewLinks()

// ─── Carga ────────────────────────────────────────────────────────────────────

const rows = ref<CrewLinkRow[]>([])
const loading = ref(false)
const loadError = ref(false)
let request = 0

async function load() {
  const id = ++request
  const tourUuid = props.tourUuid
  const wanted = new Set(props.contactUuids)
  rows.value = []
  loadError.value = false
  feedback.value = {}
  if (!wanted.size) return
  loading.value = true
  try {
    const all: CrewLinkRow[] = []
    let page = 1
    for (;;) {
      const data = await linksApi.listCrewLinks(tourUuid, page)
      if (id !== request) return
      all.push(...data.results)
      if (!data.next) break
      page += 1
    }
    rows.value = all.filter((r) => wanted.has(r.contact.uuid))
  } catch {
    if (id === request) loadError.value = true
  } finally {
    if (id === request) loading.value = false
  }
}

onMounted(load)
watch(
  () => [props.tourUuid, props.contactUuids.join(',')],
  () => void load()
)

const portalDisabled = computed(() => rows.value.some((r) => r.state === 'disabled'))
const visible = computed(() => loading.value || loadError.value || rows.value.length > 0)

// ─── Estado por persona ──────────────────────────────────────────────────────

/** Con estos estados "Compartir" da (o crea) un enlace que funciona. */
const SHAREABLE: ReadonlySet<CrewLinkState> = new Set(['active', 'none'])

function canShare(row: CrewLinkRow): boolean {
  return SHAREABLE.has(row.state)
}

function stateLabel(state: CrewLinkState): string {
  if (state === 'active') return t('importer.crewLinks.ready')
  if (state === 'none') return t('importer.crewLinks.none')
  return t(`tourHub.crew.states.${state}`)
}

type Feedback = { kind: 'ok' | 'error' | 'manual'; text: string }
const feedback = ref<Record<string, Feedback>>({})
const busy = ref<string | null>(null)

function setFeedback(uuid: string, f: Feedback | null) {
  const next = { ...feedback.value }
  if (f) next[uuid] = f
  else delete next[uuid]
  feedback.value = next
}

function replaceRow(row: CrewLinkRow) {
  const i = rows.value.findIndex((r) => r.contact.uuid === row.contact.uuid)
  if (i >= 0) rows.value[i] = row
}

/** El enlace se creó pero no tiene URL (portal apagado, revocado…): el estado lo explica. */
class LinkStateError extends Error {
  constructor(readonly state: CrewLinkState) {
    super(state)
  }
}

/** Códigos de las acciones de enlace: llegan como `{code, detail}` (forma DRF, sin envolver). */
function errorCodes(e: unknown): string[] {
  const codes = apiErrorCodes(e)
  if (e instanceof ApiError && e.data && typeof e.data === 'object') {
    const code = (e.data as Record<string, unknown>).code
    if (typeof code === 'string') codes.push(code)
  }
  return codes
}

function errorText(e: unknown): string {
  if (e instanceof LinkStateError) return stateLabel(e.state)
  const codes = errorCodes(e)
  if (codes.includes('portal_disabled')) return t('importer.crewLinks.disabled')
  if (codes.includes('portal_unavailable')) return t('importer.crewLinks.unavailable')
  if (codes.includes('link_revoked')) return t('importer.crewLinks.revoked')
  if (codes.includes('contact_not_in_crew')) return t('importer.crewLinks.notInCrew')
  return t('importer.crewLinks.error')
}

/** URL del enlace de la persona; si aún no existe, lo crea (POST) y actualiza la fila. */
function ensureUrl(row: CrewLinkRow): Promise<string> {
  const known = row.link?.url
  if (known) return Promise.resolve(known)
  const tourUuid = props.tourUuid
  const id = request
  return linksApi.ensureCrewLink(tourUuid, row.contact.uuid).then((r) => {
    if (id === request) replaceRow(r)
    if (!r.link?.url) throw new LinkStateError(r.state)
    return r.link.url
  })
}

function message(row: CrewLinkRow, url: string): string {
  return t('importer.crewLinks.message', {
    name: row.contact.display_name,
    tour: props.tourName,
    url,
  })
}

function hasWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * "Compartir": menú del sistema si el navegador lo tiene; si no, copia el enlace. Con el enlace por
 * crear, la petición va antes del menú: si el navegador ya no deja abrirlo (se pierde el gesto tras
 * esperar a la red), la fila queda con el enlace listo y basta con tocar otra vez.
 */
async function share(row: CrewLinkRow) {
  const uuid = row.contact.uuid
  if (busy.value) return
  setFeedback(uuid, null)
  if (!hasWebShare()) {
    await copy(row)
    return
  }
  const known = row.link?.url ?? null
  let url = known
  if (!url) {
    busy.value = uuid
    try {
      url = await ensureUrl(row)
    } catch (e) {
      setFeedback(uuid, { kind: 'error', text: errorText(e) })
      return
    } finally {
      busy.value = null
    }
  }
  try {
    await navigator.share({
      title: t('importer.crewLinks.shareTitle', { tour: props.tourName }),
      text: message(row, url),
    })
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'AbortError') return
    if (!known) setFeedback(uuid, { kind: 'ok', text: t('importer.crewLinks.tapAgain') })
    else await copy(row)
  }
}

/** Copia el enlace (la petición, si hace falta, va en el mismo clic: Safari). */
async function copy(row: CrewLinkRow) {
  const uuid = row.contact.uuid
  const source = ensureUrl(row)
  busy.value = uuid
  try {
    await copyText(source)
    setFeedback(uuid, { kind: 'ok', text: t('importer.crewLinks.copied') })
  } catch (e) {
    // La API respondió pero el navegador no deja copiar: se enseña el enlace para copiarlo a mano.
    const url = await source.catch(() => null)
    if (url) setFeedback(uuid, { kind: 'manual', text: url })
    else setFeedback(uuid, { kind: 'error', text: errorText(e) })
  } finally {
    busy.value = null
  }
}

/**
 * "WhatsApp" (escritorio): `wa.me` sin número con el texto, en una pestaña nueva. La pestaña se abre
 * en el clic (si no, el navegador la bloquea tras esperar a la red) y recibe la dirección después.
 */
async function whatsapp(row: CrewLinkRow) {
  const uuid = row.contact.uuid
  if (busy.value) return
  setFeedback(uuid, null)
  const known = row.link?.url
  if (known) {
    window.open(waUrl(row, known), '_blank', 'noopener')
    return
  }
  const tab = window.open('', '_blank')
  if (tab) tab.opener = null
  busy.value = uuid
  try {
    const url = await ensureUrl(row)
    if (tab) tab.location.href = waUrl(row, url)
    else window.open(waUrl(row, url), '_blank', 'noopener')
  } catch (e) {
    tab?.close()
    setFeedback(uuid, { kind: 'error', text: errorText(e) })
  } finally {
    busy.value = null
  }
}

function waUrl(row: CrewLinkRow, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message(row, url))}`
}

const manageLink = { name: 'tour', query: { tab: 'crew' } }

const ACTION_BTN =
  'items-center justify-center gap-1.5 min-h-[44px] lg:min-h-[36px] px-3 rounded-sm text-[14px] font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:opacity-50 disabled:cursor-not-allowed'
</script>

<template>
  <section
    v-if="visible"
    class="flex flex-col gap-3 rounded border border-line bg-bg-2 p-4"
    aria-labelledby="import-crew-links-title"
    data-test="import-crew-links"
  >
    <h2
      id="import-crew-links-title"
      class="text-[15px] font-semibold text-ink"
    >
      {{ t('importer.crewLinks.title') }}
    </h2>

    <!-- Carga -->
    <ul
      v-if="loading"
      class="flex flex-col gap-2"
      aria-busy="true"
      data-test="import-crew-links-loading"
    >
      <li class="sr-only">
        {{ t('common.loading') }}
      </li>
      <li
        v-for="i in 3"
        :key="i"
        class="h-11 rounded-sm bg-bg-4 animate-pulse"
      />
    </ul>

    <!-- Error de la lista -->
    <div
      v-else-if="loadError"
      class="flex flex-wrap items-center gap-2"
    >
      <p
        class="text-[14px] text-failed-fg"
        role="alert"
        data-test="import-crew-links-error"
      >
        {{ t('importer.crewLinks.loadError') }}
      </p>
      <button
        type="button"
        :class="[ACTION_BTN, 'inline-flex border border-line-2 bg-bg-3 text-ink hover:bg-glass-hover']"
        data-test="import-crew-links-retry"
        @click="load"
      >
        {{ t('importer.crewLinks.retry') }}
      </button>
    </div>

    <template v-else>
      <p
        v-if="portalDisabled"
        class="flex flex-wrap items-center gap-x-2 text-[14px] text-pending-fg rounded-sm bg-pending-bg px-3 py-2"
        data-test="import-crew-links-disabled"
      >
        <span>{{ t('importer.crewLinks.disabled') }}</span>
        <RouterLink
          :to="manageLink"
          class="inline-flex items-center min-h-[44px] lg:min-h-0 font-medium text-olive hover:text-olive-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive rounded-sm"
        >
          {{ t('importer.crewLinks.openCrew') }}
        </RouterLink>
      </p>
      <p
        v-else
        class="text-[13px] text-ink-2"
      >
        {{ t('importer.crewLinks.help') }}
      </p>

      <ul class="flex flex-col divide-y divide-line">
        <li
          v-for="row in rows"
          :key="row.contact.uuid"
          class="flex flex-col gap-1 py-2"
          :data-contact="row.contact.uuid"
          data-test="import-crew-link"
        >
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
              {{ row.contact.display_name }}
            </span>
            <StatusBadge
              size="sm"
              :status="crewLinkBadge(row.state)"
              :label="stateLabel(row.state)"
              data-test="import-crew-link-state"
            />
          </div>
          <div
            v-if="canShare(row)"
            class="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              :class="[ACTION_BTN, 'inline-flex border border-line-2 bg-bg-3 text-ink hover:bg-glass-hover']"
              :disabled="busy !== null"
              :aria-label="t('importer.crewLinks.shareLabel', { name: row.contact.display_name })"
              data-test="import-crew-link-share"
              @click="share(row)"
            >
              <span
                v-if="busy === row.contact.uuid"
                class="w-3.5 h-3.5 rounded-full border-2 border-line-2 border-t-olive animate-spin"
                aria-hidden="true"
              />
              {{ t('importer.crewLinks.share') }}
            </button>
            <button
              type="button"
              :class="[ACTION_BTN, 'hidden lg:inline-flex bg-transparent border-none text-olive hover:text-olive-strong']"
              :disabled="busy !== null"
              :aria-label="t('importer.crewLinks.whatsappLabel', { name: row.contact.display_name })"
              data-test="import-crew-link-whatsapp"
              @click="whatsapp(row)"
            >
              {{ t('importer.crewLinks.whatsapp') }}
            </button>
          </div>
          <p
            v-if="feedback[row.contact.uuid]"
            class="text-[13px] break-all"
            :class="feedback[row.contact.uuid].kind === 'error' ? 'text-failed-fg' : 'text-ink-2'"
            :role="feedback[row.contact.uuid].kind === 'error' ? 'alert' : 'status'"
            data-test="import-crew-link-feedback"
          >
            {{ feedback[row.contact.uuid].text }}
          </p>
        </li>
      </ul>
    </template>
  </section>
</template>
