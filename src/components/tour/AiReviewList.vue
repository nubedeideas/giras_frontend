<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DateTime } from 'luxon'
import { formatInZoneLocalized } from '@/utils/datetime'
import {
  useActivities,
  type ActivityListItem,
  type ActivityTypeListItem,
} from '@/composables/useActivities'
import {
  useRecipientOverrides,
  type RecipientOverride,
  type RecipientOverrideActivity,
} from '@/composables/useRecipientOverrides'
import { ApiError } from '@/utils/apiClient'
import { aiErrorMessage, isAlreadyReviewed } from '@/utils/aiReview'

/**
 * "Por revisar (n)" del panel de recordatorios de la gira (C3.3): actividades cuyo tipo asignó
 * la IA de Calendar y grupos sugeridos por la IA. Nada cambia hasta aceptar o confirmar; tras
 * cada acción se recarga la lista y se avisa al padre (`changed`) para refrescar la estimación.
 */
const props = defineProps<{ tourUuid: string }>()
const emit = defineEmits<{ changed: []; forbidden: [] }>()

const { t, locale } = useI18n()
const activitiesApi = useActivities()
const overridesApi = useRecipientOverrides()

const pending = ref<ActivityListItem[]>([])
const suggestions = ref<RecipientOverride[]>([])
const types = ref<ActivityTypeListItem[]>([])
/** Tipo elegido en el selector de cada actividad (borrador local, por uuid). */
const typeDraft = ref<Record<string, string>>({})

const loaded = ref(false)
const loadError = ref('')
const busy = ref<Set<string>>(new Set())
const cardErrors = ref<Record<string, string>>({})
const bulkBusy = ref(false)
const bulkError = ref('')
const confirmingAll = ref(false)

let request = 0

async function load() {
  const req = ++request
  loadError.value = ''
  try {
    const [acts, sugg] = await Promise.all([
      activitiesApi.listPendingAiReview(props.tourUuid),
      overridesApi.listSuggested(props.tourUuid),
    ])
    if (req !== request) return
    // El filtro lo hace el backend; se vuelve a comprobar por si un backend anterior lo ignora.
    pending.value = acts.filter((a) => a.ai_review?.status === 'pending')
    suggestions.value = sugg.filter((s) => s.status === 'suggested')
    const drafts: Record<string, string> = {}
    for (const a of pending.value) {
      drafts[a.uuid] = typeDraft.value[a.uuid] ?? a.activity_type_code
    }
    typeDraft.value = drafts
    loaded.value = true
    if (pending.value.length && !types.value.length) void loadTypes()
  } catch (e) {
    if (req !== request) return
    // Solo un 403 echa al usuario: el 404 de la gira ya lo trata el catálogo del panel, y un fallo
    // de esta lista no debe tapar el resto de recordatorios.
    if (e instanceof ApiError && e.status === 403) {
      emit('forbidden')
      return
    }
    loadError.value = aiErrorMessage(e, t, 'aiReview.loadError')
  }
}

async function loadTypes() {
  try {
    // Los de la gira (owner + sistema): un coadmin no ve sus propios tipos aquí.
    const tour = props.tourUuid
    const list = await activitiesApi.listActivityTypes(tour)
    if (tour === props.tourUuid) types.value = list
  } catch {
    // Sin tipos no hay selector: se puede confirmar el propuesto igualmente.
    types.value = []
  }
}

watch(
  () => props.tourUuid,
  () => {
    pending.value = []
    suggestions.value = []
    types.value = []
    typeDraft.value = {}
    loaded.value = false
    void load()
  },
  { immediate: true }
)

// ─── Tarjetas ─────────────────────────────────────────────────────────────────

interface Card {
  uuid: string
  title: string
  scheduledAt: string
  /** Zona de la actividad; la del navegador si el resumen de la sugerencia no la trae. */
  timezone: string
  typeCode: string
  typeName: string
  review: ActivityListItem | null
  suggestions: RecipientOverride[]
}

const cards = computed<Card[]>(() => {
  const map = new Map<string, Card>()
  for (const a of pending.value) {
    map.set(a.uuid, {
      uuid: a.uuid,
      title: a.title,
      scheduledAt: a.scheduled_at,
      timezone: a.timezone || DateTime.local().zoneName,
      typeCode: a.activity_type_code,
      typeName: a.activity_type_name,
      review: a,
      suggestions: [],
    })
  }
  for (const s of suggestions.value) {
    const act: RecipientOverrideActivity | null = typeof s.activity === 'string' ? null : s.activity
    const uuid = act?.uuid ?? (s.activity as string)
    let card = map.get(uuid)
    if (!card) {
      card = {
        uuid,
        title: act?.title ?? '',
        scheduledAt: act?.scheduled_at ?? '',
        timezone: act?.timezone || DateTime.local().zoneName,
        typeCode: act?.activity_type_code ?? '',
        typeName: typeName(act?.activity_type_code ?? ''),
        review: null,
        suggestions: [],
      }
      map.set(uuid, card)
    }
    card.suggestions.push(s)
  }
  return [...map.values()].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
})

const count = computed(() => cards.value.length)

function typeName(code: string): string {
  return types.value.find((x) => x.code === code)?.name ?? code
}

function formatDate(c: Card): string {
  return c.scheduledAt ? formatInZoneLocalized(c.scheduledAt, c.timezone, locale.value) : ''
}

function suggestionLabel(s: RecipientOverride): string {
  return s.group?.name ?? s.contact?.name ?? ''
}

function typeChanged(c: Card): boolean {
  const draft = typeDraft.value[c.uuid]
  return !!c.review && !!draft && draft !== c.typeCode
}

// ─── Acciones ─────────────────────────────────────────────────────────────────

function setBusy(key: string, on: boolean) {
  const next = new Set(busy.value)
  if (on) next.add(key)
  else next.delete(key)
  busy.value = next
}

function setCardError(uuid: string, msg: string) {
  cardErrors.value = { ...cardErrors.value, [uuid]: msg }
}

async function act(cardUuid: string, key: string, fn: () => Promise<unknown>, fallback: string) {
  setBusy(key, true)
  setCardError(cardUuid, '')
  let reload = true
  try {
    await fn()
    emit('changed')
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      emit('forbidden')
      return
    }
    setCardError(cardUuid, aiErrorMessage(e, t, fallback))
    // 409 (`not_suggested`, `no_pending_review`) o 404: ya revisado o borrado en otro sitio, se
    // recarga para ver el estado real. Cualquier otro error deja la tarjeta como estaba.
    reload = isAlreadyReviewed(e) || (e instanceof ApiError && e.status === 404)
  } finally {
    setBusy(key, false)
  }
  if (reload) await load()
}

/** Tipo: si se cambió, PATCH del tipo (confirma la revisión); si no, `confirm-ai-review`. */
function confirmType(c: Card): Promise<unknown> {
  if (typeChanged(c)) {
    const type = types.value.find((x) => x.code === typeDraft.value[c.uuid])
    if (type) return activitiesApi.updateActivity(c.uuid, { activity_type_id: type.uuid })
  }
  return activitiesApi.confirmAiReview(c.uuid)
}

/** 409 (`not_suggested`, `no_pending_review`) o 404: ya revisado o borrado; no es un fallo. */
function isGone(e: unknown): boolean {
  return isAlreadyReviewed(e) || (e instanceof ApiError && e.status === 404)
}

interface ConfirmOutcome {
  forbidden?: boolean
  error?: string
  /** Texto de un 409/404 (ya revisado): se enseña en la tarjeta pero no cuenta como fallo. */
  notice?: string
}

/**
 * Confirmar una tarjeta: acepta por uuid sus sugerencias visibles y confirma su tipo. Es lo mismo
 * que hace "Confirmar todo" por cada tarjeta; nunca toca sugerencias que el usuario no ha visto.
 */
async function confirmCard(c: Card): Promise<ConfirmOutcome> {
  let notice: string | undefined
  for (const s of c.suggestions) {
    try {
      await overridesApi.accept(s.uuid)
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) return { forbidden: true }
      const msg = aiErrorMessage(e, t, 'aiReview.actionError')
      if (!isGone(e)) return { error: msg }
      notice = msg
    }
  }
  if (c.review) {
    try {
      await confirmType(c)
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) return { forbidden: true }
      const msg = aiErrorMessage(e, t, 'aiReview.confirmError')
      if (!isGone(e)) return { error: msg }
      notice = msg
    }
  }
  return { notice }
}

async function onConfirm(c: Card) {
  const key = `confirm:${c.uuid}`
  setBusy(key, true)
  setCardError(c.uuid, '')
  let outcome: ConfirmOutcome
  try {
    outcome = await confirmCard(c)
  } finally {
    setBusy(key, false)
  }
  if (outcome.forbidden) {
    emit('forbidden')
    return
  }
  if (outcome.error || outcome.notice) setCardError(c.uuid, outcome.error ?? outcome.notice ?? '')
  // Aunque falle a medias, algo puede haber cambiado: se avisa y se recarga el estado real.
  emit('changed')
  await load()
}

function onAccept(c: Card, s: RecipientOverride) {
  void act(c.uuid, `s:${s.uuid}`, () => overridesApi.accept(s.uuid), 'aiReview.actionError')
}

function onReject(c: Card, s: RecipientOverride) {
  void act(c.uuid, `s:${s.uuid}`, () => overridesApi.reject(s.uuid), 'aiReview.actionError')
}

/**
 * "Confirmar todo": cada tarjeta visible como su "Confirmar" (sugerencias por uuid y tipo con el
 * elegido). No usa `accept-all` de la gira: aceptaría sugerencias llegadas después de cargar.
 */
async function confirmAll() {
  confirmingAll.value = false
  bulkBusy.value = true
  bulkError.value = ''
  let failed = 0
  try {
    for (const c of [...cards.value]) {
      setCardError(c.uuid, '')
      const outcome = await confirmCard(c)
      if (outcome.forbidden) {
        emit('forbidden')
        return
      }
      if (outcome.error) {
        failed++
        setCardError(c.uuid, outcome.error)
      }
    }
    if (failed) bulkError.value = t('aiReview.confirmAllPartial', { n: failed }, failed)
  } finally {
    bulkBusy.value = false
  }
  emit('changed')
  await load()
}

const pendingTypes = computed(() => cards.value.filter((c) => c.review).length)

defineExpose({ reload: () => load(), count })
</script>

<template>
  <!-- Solo si hay algo que revisar (o falló la carga): sin esqueleto ni vacío, para no parpadear -->
  <section
    v-if="(loaded && count > 0) || loadError"
    class="mb-5"
    data-test="ai-review"
  >
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <h3 class="flex-1 text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase">
        {{ t('aiReview.title', { count }) }}
      </h3>
      <button
        v-if="count > 0 && !confirmingAll"
        type="button"
        class="min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm text-[13px] font-semibold bg-glass border border-line text-olive hover:bg-glass-hover cursor-pointer disabled:opacity-50"
        :disabled="bulkBusy || busy.size > 0"
        data-test="ai-review-confirm-all"
        @click="confirmingAll = true"
      >
        {{ bulkBusy ? t('aiReview.working') : t('aiReview.confirmAll') }}
      </button>
    </div>

    <!-- Confirmación de "Confirmar todo" -->
    <div
      v-if="confirmingAll"
      class="bg-glass border border-line rounded-sm p-3 mb-2"
      data-test="ai-review-confirm-all-prompt"
    >
      <p class="text-[14px] text-ink-2 mb-2">
        {{
          t('aiReview.confirmAllPrompt', {
            groups: suggestions.length,
            types: pendingTypes,
          })
        }}
      </p>
      <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button
          type="button"
          class="min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm text-[13px] bg-glass border border-line text-ink-2 cursor-pointer"
          data-test="ai-review-confirm-all-cancel"
          @click="confirmingAll = false"
        >
          {{ t('aiReview.cancel') }}
        </button>
        <button
          type="button"
          class="min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm text-[13px] font-bold bg-acid text-ink border-none cursor-pointer"
          data-test="ai-review-confirm-all-go"
          @click="confirmAll"
        >
          {{ t('aiReview.confirmAll') }}
        </button>
      </div>
    </div>

    <p
      v-if="bulkError"
      class="text-[13px] text-failed-fg mb-2"
      data-test="ai-review-bulk-error"
    >
      {{ bulkError }}
    </p>

    <!-- Error -->
    <div
      v-if="loadError"
      class="bg-glass border border-line rounded-sm px-3 py-3 text-center"
      data-test="ai-review-error"
    >
      <p class="text-[13px] text-failed-fg mb-1">
        {{ loadError }}
      </p>
      <button
        type="button"
        class="min-h-[44px] sm:min-h-0 text-[13px] font-semibold text-olive bg-transparent border-none cursor-pointer"
        data-test="ai-review-retry"
        @click="load"
      >
        {{ t('reminders.tour.retry') }}
      </button>
    </div>

    <ul
      v-else
      class="space-y-1.5"
    >
      <li
        v-for="c in cards"
        :key="c.uuid"
        class="bg-glass border border-line rounded-sm px-3 py-2.5"
        :data-test="`ai-card-${c.uuid}`"
      >
        <div class="flex flex-wrap items-baseline gap-x-2 mb-1.5">
          <p class="text-[14px] font-semibold text-ink truncate max-w-full">
            {{ c.title }}
          </p>
          <span class="text-[12px] text-ink-4 font-time tnum">{{ formatDate(c) }}</span>
        </div>

        <!-- Tipo propuesto -->
        <div
          v-if="c.review"
          class="flex flex-wrap items-center gap-2 mb-1.5"
        >
          <span class="text-[12px] text-ink-3">{{ t('aiReview.typeProposed') }}</span>
          <select
            v-if="types.length"
            v-model="typeDraft[c.uuid]"
            :aria-label="t('aiReview.typeProposed')"
            class="h-11 sm:h-8 px-2 rounded-sm bg-bg-2 border border-line text-[14px] text-ink outline-none focus:border-line-acid max-w-full"
            :disabled="busy.has(`confirm:${c.uuid}`) || bulkBusy"
            data-test="ai-card-type"
          >
            <option
              v-if="!types.some((x) => x.code === c.typeCode)"
              :value="c.typeCode"
            >
              {{ c.typeName }}
            </option>
            <option
              v-for="tp in types"
              :key="tp.uuid"
              :value="tp.code"
            >
              {{ tp.name }}
            </option>
          </select>
          <span
            v-else
            class="text-[14px] text-ink"
          >{{ c.typeName }}</span>
        </div>

        <!-- Grupos sugeridos -->
        <div
          v-if="c.suggestions.length"
          class="mb-1.5"
        >
          <p class="text-[12px] text-ink-3 mb-1">
            {{ t('aiReview.suggestedGroups') }}
          </p>
          <ul class="space-y-1">
            <li
              v-for="s in c.suggestions"
              :key="s.uuid"
              class="flex flex-wrap items-center gap-2"
              data-test="ai-suggestion"
            >
              <span class="flex-1 min-w-[120px]">
                <span class="block text-[14px] text-olive">{{ suggestionLabel(s) }}</span>
                <span
                  v-if="s.reason"
                  class="block text-[12px] text-ink-4"
                  data-test="ai-suggestion-reason"
                >{{ s.reason }}</span>
              </span>
              <button
                type="button"
                class="min-h-[44px] sm:min-h-0 px-2.5 py-1 rounded-sm text-[13px] font-semibold bg-acid-dim text-olive border-none cursor-pointer disabled:opacity-50"
                :disabled="busy.has(`s:${s.uuid}`) || busy.has(`confirm:${c.uuid}`) || bulkBusy"
                data-test="ai-suggestion-accept"
                @click="onAccept(c, s)"
              >
                {{ t('aiReview.accept') }}
              </button>
              <button
                type="button"
                class="min-h-[44px] sm:min-h-0 px-2.5 py-1 rounded-sm text-[13px] bg-glass border border-line text-ink-3 hover:text-ink cursor-pointer disabled:opacity-50"
                :disabled="busy.has(`s:${s.uuid}`) || busy.has(`confirm:${c.uuid}`) || bulkBusy"
                data-test="ai-suggestion-reject"
                @click="onReject(c, s)"
              >
                {{ t('aiReview.reject') }}
              </button>
            </li>
          </ul>
        </div>

        <p
          v-if="cardErrors[c.uuid]"
          class="text-[13px] text-failed-fg mb-1"
          data-test="ai-card-error"
        >
          {{ cardErrors[c.uuid] }}
        </p>

        <div class="flex justify-end">
          <button
            type="button"
            class="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm text-[13px] font-bold bg-acid text-ink border-none cursor-pointer disabled:opacity-50"
            :disabled="busy.has(`confirm:${c.uuid}`) || bulkBusy"
            data-test="ai-card-confirm"
            @click="onConfirm(c)"
          >
            {{ t('aiReview.confirm') }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
