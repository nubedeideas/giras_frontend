<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/ui/AppModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import {
  useRoleGroups,
  type RoleGroupsApply,
  type RoleGroupsApplyResult,
  type RoleGroupsProposal,
  type RoleProposalSource,
} from '@/composables/useRoleGroups'
import type { GroupSummary } from '@/composables/useReminderSettings'
import { aiErrorMessage, ROLE_TYPE_DESTINATIONS, roleBucketName } from '@/utils/aiReview'
import { isForbidden } from '@/utils/reminders'

/**
 * "Crear grupos por rol" (C3.2): la IA propone Banda, Técnicos, Conductores y Producción a partir
 * del equipo de la gira; nada se escribe hasta "Crear grupos". El borrador local (nombres,
 * casillas, asignaciones de "Sin asignar") sobrevive a un error al aplicar para poder reintentar.
 */
const props = defineProps<{
  show: boolean
  tourUuid: string
  /** Nombre de cada tipo de actividad por código, para resumir los destinos por tipo. */
  typeNames?: Record<string, string>
}>()

const emit = defineEmits<{
  close: []
  applied: [result: RoleGroupsApplyResult, applyDestinations: boolean]
  forbidden: []
}>()

const { t } = useI18n()
const api = useRoleGroups()

interface DraftContact {
  uuid: string
  name: string
  role_text: string
  selected: boolean
  source: RoleProposalSource
}

interface DraftBucket {
  key: string
  proposedName: string
  name: string
  existing: GroupSummary | null
  contacts: DraftContact[]
}

interface DraftUnassigned {
  uuid: string
  name: string
  role_text: string
  /** `''` = sigue sin asignar; si no, la `key` del grupo. */
  target: string
}

const proposal = ref<RoleGroupsProposal | null>(null)
const buckets = ref<DraftBucket[]>([])
const unassigned = ref<DraftUnassigned[]>([])
const applyDestinations = ref(false)
const initialSnapshot = ref('')

const loading = ref(false)
const loadError = ref('')
const applying = ref(false)
const applyError = ref('')
const confirmingClose = ref(false)

let request = 0

function buildDraft(p: RoleGroupsProposal) {
  buckets.value = p.buckets.map((b) => ({
    key: b.key,
    proposedName: b.existing_group?.name ?? b.name,
    name: b.existing_group?.name ?? b.name,
    existing: b.existing_group,
    contacts: b.contacts.map((c) => ({
      uuid: c.uuid,
      name: c.name,
      role_text: c.role_text,
      selected: c.selected,
      source: c.source,
    })),
  }))
  unassigned.value = p.unassigned.map((u) => ({ ...u, target: '' }))
  applyDestinations.value = false
  initialSnapshot.value = snapshot()
}

function snapshot(): string {
  return JSON.stringify([buckets.value, unassigned.value, applyDestinations.value])
}

const dirty = computed(() => !!proposal.value && snapshot() !== initialSnapshot.value)

async function load() {
  const req = ++request
  loading.value = true
  loadError.value = ''
  applyError.value = ''
  confirmingClose.value = false
  proposal.value = null
  try {
    const data = await api.propose(props.tourUuid)
    if (req !== request) return
    proposal.value = data
    buildDraft(data)
  } catch (e) {
    if (req !== request) return
    if (isForbidden(e)) {
      emit('forbidden')
      return
    }
    loadError.value = aiErrorMessage(e, t, 'roleGroups.loadError')
  } finally {
    if (req === request) loading.value = false
  }
}

watch(
  () => props.show,
  (open) => {
    if (open) void load()
    else request++
  },
  { immediate: true }
)

// ─── Derivados ────────────────────────────────────────────────────────────────

const isEmpty = computed(
  () =>
    !!proposal.value &&
    buckets.value.every((b) => b.contacts.length === 0) &&
    unassigned.value.length === 0
)

/** Contactos finales de cada grupo: los marcados más los de "Sin asignar" llevados a él. */
const finalContacts = computed(() => {
  const map = new Map<string, string[]>()
  for (const b of buckets.value) {
    map.set(
      b.key,
      b.contacts.filter((c) => c.selected).map((c) => c.uuid)
    )
  }
  for (const u of unassigned.value) {
    if (u.target) map.get(u.target)?.push(u.uuid)
  }
  return map
})

/** Un grupo nuevo sin nadie no se crea (B3.1); uno que ya existe se actualiza siempre. */
const bucketsToSend = computed(() =>
  buckets.value.filter((b) => b.existing || (finalContacts.value.get(b.key)?.length ?? 0) > 0)
)

/**
 * Resumen de D15.1 limitado a los grupos que se van a crear o actualizar (incluidos los que solo
 * se llenan desde "Sin asignar") y, si se conocen, a los tipos de la gira. No se envía: el backend
 * aplica su tabla con los grupos vivos tras crearlos.
 */
const destinations = computed(() => {
  const keys = new Set(bucketsToSend.value.map((b) => b.key))
  const known = props.typeNames && Object.keys(props.typeNames).length ? props.typeNames : null
  return ROLE_TYPE_DESTINATIONS.filter((d) => !known || d.activity_type_code in known)
    .map((d) => ({ ...d, buckets: d.buckets.filter((k) => keys.has(k)) }))
    .filter((d) => d.buckets.length > 0)
})

function bucketLabel(key: string): string {
  const b = buckets.value.find((x) => x.key === key)
  return b?.name.trim() || roleBucketName(key, t)
}

/** Tabla D15.1 resumida: tipos con los mismos destinos en una sola línea. */
const destinationRows = computed(() => {
  const rows = new Map<string, { types: string[]; groups: string[] }>()
  for (const d of destinations.value) {
    const groups = d.buckets.map(bucketLabel)
    if (d.include_team) groups.unshift(t('reminders.tour.groupsEmpty'))
    const sig = groups.join('|')
    const row = rows.get(sig) ?? { types: [], groups }
    row.types.push(props.typeNames?.[d.activity_type_code] ?? d.activity_type_code)
    rows.set(sig, row)
  }
  return [...rows.values()]
})

const nameTooLong = computed(() => buckets.value.some((b) => b.name.trim().length > 100))
const canApply = computed(
  () => !!proposal.value && !applying.value && bucketsToSend.value.length > 0 && !nameTooLong.value
)

function sourceLabel(source: RoleProposalSource): string {
  if (source === 'role') return t('roleGroups.sourceRole')
  if (source === 'ai') return t('roleGroups.sourceAi')
  return ''
}

// ─── Acciones ─────────────────────────────────────────────────────────────────

function buildPayload(): RoleGroupsApply {
  const payload: RoleGroupsApply = {
    tour: props.tourUuid,
    groups: bucketsToSend.value.map((b) => {
      const name = b.name.trim()
      return {
        key: b.key,
        // Solo si el usuario lo ha cambiado: vacío o igual al propuesto, el backend pone el suyo.
        ...(name && name !== b.proposedName ? { name } : {}),
        contact_uuids: finalContacts.value.get(b.key) ?? [],
      }
    }),
    // Sin `type_destinations`: con la casilla marcada el backend usa D15.1 entera.
    apply_type_destinations: applyDestinations.value,
  }
  return payload
}

async function apply() {
  if (!canApply.value) return
  applying.value = true
  applyError.value = ''
  try {
    const result = await api.apply(buildPayload())
    emit('applied', result, applyDestinations.value)
  } catch (e) {
    if (isForbidden(e)) {
      emit('forbidden')
      return
    }
    // El borrador se queda tal cual para corregir y reintentar.
    applyError.value = aiErrorMessage(e, t, 'roleGroups.applyError')
  } finally {
    applying.value = false
  }
}

function requestClose() {
  if (applying.value) return
  if (dirty.value && !confirmingClose.value) {
    confirmingClose.value = true
    return
  }
  confirmingClose.value = false
  emit('close')
}
</script>

<template>
  <AppModal
    :show="show"
    persistent
    @close="requestClose"
  >
    <div data-test="role-groups-modal">
      <div class="flex items-start gap-2 mb-1">
        <p class="flex-1 text-base font-bold text-ink tracking-[-0.2px]">
          {{ t('roleGroups.title') }}
        </p>
        <button
          type="button"
          class="-mt-2 -mr-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-ink-3 hover:text-ink bg-transparent border-none cursor-pointer text-[18px]"
          :aria-label="t('roleGroups.close')"
          data-test="role-groups-close"
          @click="requestClose"
        >
          ×
        </button>
      </div>
      <p class="text-[11px] text-ink-3 mb-4">
        {{ t('roleGroups.subtitle') }}
      </p>

      <!-- Cargando -->
      <div
        v-if="loading"
        class="py-6 text-center"
        data-test="role-groups-loading"
      >
        <div class="h-1 w-24 mx-auto mb-3 rounded-full bg-acid-dim animate-pulse" />
        <p class="text-[12px] text-ink-2">
          {{ t('roleGroups.loading') }}
        </p>
      </div>

      <!-- Error al proponer -->
      <div
        v-else-if="loadError"
        class="py-4 text-center"
        data-test="role-groups-error"
      >
        <p class="text-[12px] text-red-400 mb-2">
          {{ loadError }}
        </p>
        <button
          type="button"
          class="min-h-[44px] sm:min-h-0 text-[12px] font-semibold text-acid bg-transparent border-none cursor-pointer"
          data-test="role-groups-retry"
          @click="load"
        >
          {{ t('reminders.tour.retry') }}
        </button>
      </div>

      <!-- Sin equipo -->
      <p
        v-else-if="isEmpty"
        class="text-[12px] text-ink-3 text-center py-6"
        data-test="role-groups-empty"
      >
        {{ t('roleGroups.empty') }}
      </p>

      <template v-else-if="proposal">
        <p
          v-if="!proposal.ai_used && unassigned.length"
          class="text-[11px] text-brand-orange mb-3"
          data-test="role-groups-no-ai"
        >
          {{ t('roleGroups.noAi') }}
        </p>

        <!-- Un bloque por grupo -->
        <div class="space-y-3">
          <section
            v-for="b in buckets"
            :key="b.key"
            class="bg-glass border border-line rounded-sm p-3"
            :data-test="`bucket-${b.key}`"
          >
            <div class="flex items-center gap-2 mb-2">
              <input
                v-model="b.name"
                type="text"
                maxlength="100"
                :aria-label="t('roleGroups.groupName')"
                class="flex-1 min-w-0 h-11 sm:h-8 px-2.5 rounded-sm bg-bg-2 border border-line text-[13px] font-semibold text-ink outline-none focus:border-line-acid"
                data-test="bucket-name"
              >
              <span
                v-if="b.existing"
                class="flex-shrink-0 text-[10px] text-ink-4"
                data-test="bucket-existing"
              >{{ t('roleGroups.existing') }}</span>
            </div>
            <p
              v-if="b.contacts.length === 0"
              class="text-[11px] text-ink-4"
            >
              {{ t('roleGroups.noPeople') }}
            </p>
            <ul
              v-else
              class="space-y-0.5"
            >
              <li
                v-for="c in b.contacts"
                :key="c.uuid"
              >
                <label
                  class="flex items-center gap-2 min-h-[44px] sm:min-h-[32px] px-1 rounded-sm hover:bg-glass-hover cursor-pointer"
                  data-test="bucket-contact"
                >
                  <input
                    v-model="c.selected"
                    type="checkbox"
                    class="accent-acid w-4 h-4 flex-shrink-0"
                    :data-test="`contact-${b.key}-${c.uuid}`"
                  >
                  <span class="flex-1 min-w-0">
                    <span class="block text-[12px] text-ink truncate">{{ c.name }}</span>
                    <span
                      v-if="c.role_text"
                      class="block text-[10px] text-ink-4 truncate"
                    >{{ c.role_text }}</span>
                  </span>
                  <span
                    v-if="sourceLabel(c.source)"
                    class="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full"
                    :class="c.source === 'ai' ? 'bg-acid-dim text-acid' : 'bg-glass-2 text-ink-3'"
                    data-test="contact-source"
                  >{{ sourceLabel(c.source) }}</span>
                </label>
              </li>
            </ul>
          </section>

          <!-- Sin asignar -->
          <section
            v-if="unassigned.length"
            class="bg-glass border border-line rounded-sm p-3"
            data-test="unassigned"
          >
            <p class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-2">
              {{ t('roleGroups.unassigned') }}
            </p>
            <ul class="space-y-1.5">
              <li
                v-for="u in unassigned"
                :key="u.uuid"
                class="flex flex-wrap items-center gap-2"
              >
                <span class="flex-1 min-w-[140px]">
                  <span class="block text-[12px] text-ink truncate">{{ u.name }}</span>
                  <span
                    v-if="u.role_text"
                    class="block text-[10px] text-ink-4 truncate"
                  >{{ u.role_text }}</span>
                </span>
                <select
                  v-model="u.target"
                  :aria-label="t('roleGroups.assignTo', { name: u.name })"
                  class="h-11 sm:h-8 px-2 rounded-sm bg-bg-2 border border-line text-[12px] text-ink outline-none focus:border-line-acid"
                  :data-test="`unassigned-${u.uuid}`"
                >
                  <option value="">
                    {{ t('roleGroups.unassigned') }}
                  </option>
                  <option
                    v-for="b in buckets"
                    :key="b.key"
                    :value="b.key"
                  >
                    {{ bucketLabel(b.key) }}
                  </option>
                </select>
              </li>
            </ul>
          </section>

          <!-- Destinos por tipo -->
          <section
            v-if="destinationRows.length"
            class="border border-line rounded-sm p-3"
          >
            <label class="flex items-start gap-2 min-h-[44px] sm:min-h-0 cursor-pointer">
              <input
                v-model="applyDestinations"
                type="checkbox"
                class="accent-acid w-4 h-4 mt-0.5 flex-shrink-0"
                data-test="apply-destinations"
              >
              <span class="text-[12px] text-ink">{{ t('roleGroups.applyDestinations') }}</span>
            </label>
            <ul
              class="mt-2 space-y-1"
              :class="applyDestinations ? '' : 'opacity-60'"
              data-test="destinations-summary"
            >
              <li
                v-for="(row, i) in destinationRows"
                :key="i"
                class="text-[11px] text-ink-3"
                data-test="destination-row"
              >
                <span class="text-ink-2">{{ row.types.join(', ') }}</span>
                → {{ row.groups.join(', ') }}
              </li>
            </ul>
            <p class="text-[10px] text-ink-4 mt-1.5">
              {{ t('roleGroups.destinationsHint') }}
            </p>
          </section>
        </div>

        <p
          v-if="nameTooLong"
          class="text-[11px] text-red-400 mt-3"
        >
          {{ t('reminders.errors.name_too_long') }}
        </p>
        <p
          v-if="applyError"
          class="text-[11px] text-red-400 mt-3"
          data-test="role-groups-apply-error"
        >
          {{ applyError }}
        </p>
      </template>

      <!-- Confirmación al cerrar con cambios -->
      <div
        v-if="confirmingClose"
        class="mt-4 bg-glass border border-line rounded-sm p-3"
        data-test="role-groups-discard"
      >
        <p class="text-[12px] text-ink-2 mb-2">
          {{ t('roleGroups.discardConfirm') }}
        </p>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <BtnSecondary
            type="button"
            class="min-h-[44px] sm:min-h-0 justify-center"
            data-test="role-groups-keep"
            @click="confirmingClose = false"
          >
            {{ t('roleGroups.keepEditing') }}
          </BtnSecondary>
          <BtnSecondary
            type="button"
            class="min-h-[44px] sm:min-h-0 justify-center text-red-400"
            data-test="role-groups-discard-confirm"
            @click="requestClose"
          >
            {{ t('roleGroups.discard') }}
          </BtnSecondary>
        </div>
      </div>

      <!-- Pie -->
      <div
        v-else
        class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5"
      >
        <BtnSecondary
          type="button"
          class="min-h-[44px] sm:min-h-0 justify-center"
          :disabled="applying"
          data-test="role-groups-cancel"
          @click="requestClose"
        >
          {{ t('roleGroups.cancel') }}
        </BtnSecondary>
        <BtnPrimary
          v-if="proposal && !isEmpty"
          type="button"
          class="min-h-[44px] sm:min-h-0 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canApply"
          data-test="role-groups-create"
          @click="apply"
        >
          {{ applying ? t('roleGroups.creating') : t('roleGroups.create') }}
        </BtnPrimary>
      </div>
    </div>
  </AppModal>
</template>
