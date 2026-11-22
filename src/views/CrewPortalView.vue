<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@unhead/vue'
import { useNoIndex } from '@/composables/usePageMeta'
import { useCrewPortal, type CrewActivity } from '@/composables/useCrewPortal'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { activityBadge } from '@/utils/statusBadge'
import {
  activityTimeLabel,
  dateRange,
  dayLabel,
  dayOffsetLabel,
  detailLines,
  fileSize,
  longDate,
  showStatus,
} from '@/utils/crewPortal'
import Pill from '@/components/ui/Pill.vue'

// Vista pública sin layout ni sesión: no usa useAuthStore (el router tampoco, por meta.crew).
const route = useRoute()
const { t, locale } = useI18n()
const { portal, loading, error, load } = useCrewPortal()

const token = computed(() => String(route.params.token ?? ''))

useNoIndex()
useHead({
  title: computed(() =>
    portal.value
      ? t('crewPortal.pageTitle', { tour: portal.value.tour.name })
      : t('crewPortal.loadingTitle')
  ),
  // El token va en la URL: ninguna petición a terceros (póster, mapas) debe llevarlo de Referer.
  meta: [{ name: 'referrer', content: 'no-referrer' }],
})

function refresh() {
  // `/crew/` sin token o con sufijos (ruta `crew-portal-invalid`): no hay nada que pedir.
  if (!token.value) {
    error.value = 'invalid'
    return
  }
  if (!loading.value) load(token.value)
}

onMounted(refresh)

const dates = computed(() =>
  portal.value
    ? dateRange(portal.value.tour.start_date, portal.value.tour.end_date, locale.value)
    : ''
)

const cities = computed(() => {
  const tour = portal.value?.tour
  if (!tour) return ''
  if (tour.start_city && tour.end_city && tour.start_city !== tour.end_city) {
    return `${tour.start_city} → ${tour.end_city}`
  }
  return tour.start_city || tour.end_city
})

const modeNotice = computed(() => {
  const p = portal.value
  if (!p) return ''
  if (p.mode === 'upcoming') {
    return t('crewPortal.upcoming', { date: longDate(p.tour.start_date, locale.value) })
  }
  if (p.mode === 'finished') {
    return t('crewPortal.finished', {
      date: longDate(p.tour.end_date, locale.value),
      expires: longDate(p.expires_on, locale.value),
    })
  }
  return ''
})

const greetingName = computed(
  () => portal.value?.contact.first_name || portal.value?.contact.display_name || ''
)

const hasActivities = computed(() => !!portal.value?.days.some((d) => d.activities.length))

function timeOf(a: CrewActivity) {
  return activityTimeLabel(a, portal.value?.timezone ?? a.timezone)
}

function hasZone(a: CrewActivity): boolean {
  if (a.all_day) return false
  const label = timeOf(a)
  return !!(label.startZone || label.endZone)
}

function placeLabel(a: CrewActivity): string {
  return [a.location_name, a.destination_name].filter(Boolean).join(' → ')
}

function dotColor(a: CrewActivity): string {
  return a.activity_type?.color || 'var(--ink-3)'
}
</script>

<template>
  <div class="min-h-screen bg-bg text-ink">
    <main class="max-w-md mx-auto px-4 pt-5 pb-10">
      <!-- Carga inicial: esqueleto -->
      <div
        v-if="loading && !portal"
        data-testid="crew-loading"
        class="animate-pulse space-y-3"
        aria-busy="true"
      >
        <div class="h-24 rounded-lg bg-bg-4 animate-pulse motion-reduce:animate-none" />
        <div class="h-5 w-1/3 rounded bg-bg-4 animate-pulse motion-reduce:animate-none" />
        <div class="h-20 rounded-lg bg-bg-4 animate-pulse motion-reduce:animate-none" />
        <div class="h-20 rounded-lg bg-bg-4 animate-pulse motion-reduce:animate-none" />
        <div class="h-20 rounded-lg bg-bg-4 animate-pulse motion-reduce:animate-none" />
      </div>

      <!-- Error sin datos -->
      <div
        v-else-if="error && !portal"
        data-testid="crew-error"
        :data-code="error"
        class="mt-16 bg-bg-3 border border-line rounded-lg p-6 text-center"
      >
        <p class="text-[15px] font-semibold text-ink mb-2">
          {{ t('crewPortal.errorTitle') }}
        </p>
        <p class="text-[15px] text-ink-2 leading-relaxed">
          {{ t(`crewPortal.errors.${error}`) }}
        </p>
        <button
          v-if="error === 'network' || error === 'rate_limited'"
          type="button"
          data-testid="crew-retry"
          class="mt-5 px-4 py-2 rounded-sm bg-acid text-ink text-[14px] font-bold border-none cursor-pointer"
          @click="refresh"
        >
          {{ t('crewPortal.retry') }}
        </button>
      </div>

      <template v-else-if="portal">
        <!-- Cabecera -->
        <header class="bg-bg-3 border border-line rounded-lg overflow-hidden mb-4">
          <img
            v-if="portal.tour.poster_url"
            :src="portal.tour.poster_url"
            alt=""
            referrerpolicy="no-referrer"
            class="w-full h-40 object-cover"
          >
          <div class="p-4">
            <p
              v-if="greetingName"
              class="text-[14px] text-olive font-medium mb-1"
            >
              {{ t('crewPortal.hello', { name: greetingName }) }}
            </p>
            <h1 class="text-[20px] font-bold leading-tight text-ink break-words">
              {{ portal.tour.name }}
            </h1>
            <p
              v-if="portal.tour.artist_name"
              class="text-[15px] text-ink-2 mt-0.5"
            >
              {{ portal.tour.artist_name }}
            </p>
            <p class="text-[14px] text-ink-3 mt-1">
              {{ dates }}<span v-if="cities"> · {{ cities }}</span>
            </p>
            <p
              v-if="modeNotice"
              data-testid="crew-mode"
              class="mt-3 text-[14px] text-ink-2 bg-glass border border-line rounded px-3 py-2"
            >
              {{ modeNotice }}
            </p>
          </div>
        </header>

        <!-- Aviso de error en una recarga (se conserva la agenda) -->
        <p
          v-if="error"
          data-testid="crew-refresh-error"
          class="mb-3 text-[14px] text-brand-orange bg-brand-orange-dim border border-line rounded px-3 py-2"
        >
          {{ t(`crewPortal.errors.${error}`) }}
        </p>

        <!-- Agenda -->
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-[12px] font-bold text-ink-2 tracking-[1px] uppercase">
            {{ t('crewPortal.agenda') }}
          </h2>
          <button
            type="button"
            data-testid="crew-refresh"
            class="text-[14px] text-olive bg-transparent border-none cursor-pointer disabled:opacity-50"
            :disabled="loading"
            @click="refresh"
          >
            {{ t('crewPortal.refresh') }}
          </button>
        </div>

        <p
          v-if="!hasActivities && portal.next_activity_date"
          data-testid="crew-next-activity"
          class="mb-3 text-[14px] text-ink-2"
        >
          {{ t('crewPortal.nextActivity', { date: longDate(portal.next_activity_date, locale) }) }}
        </p>

        <section
          v-for="day in portal.days"
          :key="day.date"
          data-testid="crew-day"
          class="mb-4"
        >
          <h3
            class="text-[15px] font-semibold mb-2 capitalize"
            :class="day.is_today ? 'text-olive' : 'text-ink'"
          >
            <span v-if="day.is_today">{{ t('crewPortal.today') }} · </span>{{ dayLabel(day.date, locale) }}
          </h3>

          <p
            v-if="!day.activities.length"
            data-testid="crew-day-empty"
            class="text-[14px] text-ink-4 px-1"
          >
            {{ t('crewPortal.noActivities') }}
          </p>

          <article
            v-for="a in day.activities"
            :key="a.uuid"
            data-testid="crew-activity"
            class="bg-bg-3 border border-line rounded p-3 mb-2"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0 bg-bg-2 border border-line"
              >
                <div
                  class="w-[8px] h-[8px] rounded-full"
                  :style="{ background: dotColor(a) }"
                />
              </div>

              <div class="flex-1 min-w-0">
                <!-- Con zona horaria la hora va en su propia línea: a 375 px no ahoga el título -->
                <div
                  class="flex gap-x-2"
                  :class="hasZone(a) ? 'flex-col' : 'items-baseline justify-between'"
                >
                  <p
                    class="text-[15px] font-semibold break-words"
                    :class="a.status === 'cancelled' ? 'line-through text-ink-2' : 'text-ink'"
                  >
                    {{ a.title }}
                  </p>
                  <p
                    data-testid="crew-time"
                    class="text-[15px] text-ink font-time tnum flex-shrink-0"
                    :class="hasZone(a) ? 'text-left mt-0.5' : 'text-right'"
                    :title="t('crewPortal.localTime')"
                  >
                    <template v-if="a.all_day">
                      {{ t('crewPortal.allDay') }}
                    </template>
                    <template v-else>
                      <span>{{ timeOf(a).start }}</span>
                      <span
                        v-if="timeOf(a).startZone"
                        class="text-[12px] text-ink-3 ml-1"
                      >{{ timeOf(a).startZone }}</span>
                      <span v-if="timeOf(a).end">–{{ timeOf(a).end }}</span>
                      <sup
                        v-if="timeOf(a).end && timeOf(a).endDayOffset !== 0"
                        data-testid="crew-day-offset"
                        class="text-[12px] text-ink-3"
                      >{{ dayOffsetLabel(timeOf(a).endDayOffset) }}</sup>
                      <span
                        v-if="timeOf(a).endZone"
                        class="text-[12px] text-ink-3 ml-1"
                      >{{ timeOf(a).endZone }}</span>
                    </template>
                  </p>
                </div>

                <p class="text-[14px] text-ink-2 mt-0.5 break-words">
                  <span v-if="a.activity_type">{{ a.activity_type.name }}</span>
                  <span v-if="a.activity_type && placeLabel(a)"> · </span>
                  <span v-if="placeLabel(a)">{{ placeLabel(a) }}</span>
                </p>

                <StatusBadge
                  v-if="showStatus(a.status)"
                  data-testid="crew-status"
                  class="mt-1.5"
                  :status="activityBadge(a.status)"
                  :label="t(`crewPortal.status.${a.status}`)"
                  size="sm"
                />

                <p
                  v-if="a.description"
                  class="text-[14px] text-ink-3 mt-1.5 whitespace-pre-line break-words"
                >
                  {{ a.description }}
                </p>

                <div
                  v-for="(line, i) in detailLines(a.details)"
                  :key="i"
                  data-testid="crew-detail"
                  class="text-[14px] text-ink-2 mt-1 break-words"
                >
                  <template
                    v-for="(part, j) in line"
                    :key="part.key"
                  >
                    <span v-if="j > 0"> · </span>
                    <span v-if="part.key === 'delay'">{{ t('crewPortal.details.delay', { value: part.value }) }}</span>
                    <template v-else>
                      <span class="text-ink-3">{{ t(`crewPortal.details.${part.key}`) }}</span>
                      <a
                        v-if="part.href"
                        :href="part.href"
                        class="text-olive no-underline ml-1"
                      >{{ part.value }}</a>
                      <span
                        v-else
                        class="ml-1"
                      >{{ part.value }}</span>
                    </template>
                  </template>
                </div>

                <a
                  v-if="a.maps_url"
                  data-testid="crew-map"
                  :href="a.maps_url"
                  target="_blank"
                  rel="noreferrer noopener"
                  class="inline-flex items-center gap-1 mt-2 text-[14px] text-olive no-underline"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle
                    cx="12"
                    cy="10"
                    r="3"
                  /></svg>
                  {{ t('crewPortal.openMap') }}
                </a>
              </div>
            </div>
          </article>
        </section>

        <!-- Documentos -->
        <section
          v-if="portal.documents.length"
          data-testid="crew-documents"
          class="mt-6"
        >
          <h2 class="text-[12px] font-bold text-ink-2 tracking-[1px] uppercase mb-2">
            {{ t('crewPortal.documents') }}
          </h2>
          <div
            v-for="doc in portal.documents"
            :key="doc.uuid"
            class="bg-bg-3 border border-line rounded p-3 mb-2 flex items-center gap-3"
          >
            <div class="flex-1 min-w-0">
              <Pill variant="n">
                {{ doc.document_type_display }}
              </Pill>
              <p class="text-[15px] text-ink mt-1 truncate">
                {{ doc.description || doc.file_name }}
              </p>
              <p
                v-if="fileSize(doc.file_size)"
                class="text-[13px] text-ink-4"
              >
                {{ fileSize(doc.file_size) }}
              </p>
            </div>
            <!-- Enlace directo a la URL absoluta: el backend responde con Content-Disposition:
                 attachment (las descargas por blob fallan en Safari de iOS). -->
            <!-- target=_blank: si el enlace se revoca entre la carga y el clic, el JSON de error
                 se abre en otra pestaña y no se pierde la agenda. -->
            <a
              data-testid="crew-download"
              :href="doc.download_url"
              target="_blank"
              rel="noreferrer noopener"
              download
              class="flex-shrink-0 px-3 py-2 rounded-sm bg-acid text-ink text-[14px] font-bold no-underline"
            >
              {{ t('crewPortal.download') }}
            </a>
          </div>
        </section>

        <!-- Contactos clave -->
        <section
          v-if="portal.tour.contacts_text"
          data-testid="crew-contacts"
          class="mt-6"
        >
          <h2 class="text-[12px] font-bold text-ink-2 tracking-[1px] uppercase mb-2">
            {{ t('crewPortal.keyContacts') }}
          </h2>
          <pre class="bg-bg-3 border border-line rounded p-3 text-[14px] text-ink-2 whitespace-pre-wrap break-words font-sans">{{ portal.tour.contacts_text }}</pre>
        </section>
      </template>
    </main>
  </div>
</template>
