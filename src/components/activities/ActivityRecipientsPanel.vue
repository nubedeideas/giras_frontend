<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  useRecipientOverrides,
  type ActivityAudience,
  type AudiencePerson,
  type RecipientOverride,
} from '@/composables/useRecipientOverrides'
import {
  useNotificationGroups,
  type NotificationGroupListItem,
} from '@/composables/useNotificationGroups'
import { useNotifications, type ContactListItem } from '@/composables/useNotifications'
import { useToursStore } from '@/stores/tours'
import { ApiError } from '@/utils/apiClient'
import GlassBlock from '@/components/ui/GlassBlock.vue'
import {
  isForbidden,
  recipientWarningLabel,
  reminderErrorMessage,
  stepsSummary,
} from '@/utils/reminders'

/**
 * Bloque "Destinatarios" del detalle de actividad (C1.4), solo para admins de la gira: a quién
 * llegan los recordatorios, de dónde sale cada persona y los ajustes de esta actividad (añadir o
 * excluir grupos y contactos). Tras cada cambio se vuelve a pedir `resolve`.
 */
const props = defineProps<{ activityUuid: string; tourUuid: string }>()

const { t } = useI18n()
const router = useRouter()
const toursStore = useToursStore()
const api = useRecipientOverrides()
const groupsApi = useNotificationGroups()
const notifApi = useNotifications()

const audience = ref<ActivityAudience | null>(null)
const loading = ref(false)
const loadError = ref('')
const forbidden = ref(false)
const busy = ref(false)
const actionError = ref('')

let request = 0

async function load() {
  const req = ++request
  loading.value = true
  loadError.value = ''
  forbidden.value = false
  try {
    const data = await api.resolve(props.activityUuid)
    if (req === request) audience.value = data
  } catch (e) {
    if (req !== request) return
    audience.value = null
    forbidden.value = isForbidden(e)
    loadError.value = reminderErrorMessage(e, t, 'recipients.loadError', { load: true })
  } finally {
    if (req === request) loading.value = false
  }
}

// ─── Derivados ────────────────────────────────────────────────────────────────

const added = computed(() => audience.value?.overrides.filter((o) => o.action === 'add') ?? [])
const excluded = computed(
  () => audience.value?.overrides.filter((o) => o.action === 'exclude') ?? []
)

const baseText = computed(() => {
  const a = audience.value
  if (!a) return ''
  if (a.base_source === 'type_groups') {
    return t('recipients.base.type_groups', { groups: a.base_groups.map((g) => g.name).join(', ') })
  }
  return t(`recipients.base.${a.base_source}`)
})

const groupNames = computed(() => {
  const names = new Map<string, string>()
  for (const g of audience.value?.base_groups ?? []) names.set(g.uuid, g.name)
  for (const o of audience.value?.overrides ?? []) if (o.group) names.set(o.group.uuid, o.group.name)
  return names
})

function sourceLabel(source: string): string {
  if (source.startsWith('group:')) {
    return groupNames.value.get(source.slice(6)) ?? t('recipients.sources.group')
  }
  const key = `recipients.sources.${source}`
  const s = t(key)
  return s === key ? source : s
}

function personSources(p: AudiencePerson): string {
  return p.sources.map(sourceLabel).join(' · ')
}

function overrideLabel(o: RecipientOverride): string {
  return o.group?.name ?? o.contact?.name ?? ''
}

function goToTourReminders() {
  toursStore.setActiveTourByUuid(props.tourUuid)
  void router.push({ path: '/tour', query: { tab: 'reminders' } })
}

// ─── Acciones ─────────────────────────────────────────────────────────────────

async function run(fn: () => Promise<unknown>) {
  busy.value = true
  actionError.value = ''
  try {
    await fn()
    closePickers()
    await load()
  } catch (e) {
    actionError.value = reminderErrorMessage(e, t, 'recipients.actionError')
    // 404 en una acción: el ajuste o el grupo ya no existe. Se recarga para ver el estado real.
    if (e instanceof ApiError && e.status === 404) await load()
  } finally {
    busy.value = false
  }
}

function excludePerson(p: AudiencePerson) {
  if (!p.contact_uuid) return
  const contact = p.contact_uuid
  void run(() => api.add({ activity: props.activityUuid, action: 'exclude', contact }))
}

function removeOverride(o: RecipientOverride) {
  void run(() => api.remove(o.uuid))
}

function addGroup(uuid: string) {
  void run(() => api.add({ activity: props.activityUuid, action: 'add', group: uuid }))
}

function addContact(uuid: string) {
  void run(() => api.add({ activity: props.activityUuid, action: 'add', contact: uuid }))
}

// ─── Selector de grupo ────────────────────────────────────────────────────────

const picker = ref<'group' | 'contact' | null>(null)
const groups = ref<NotificationGroupListItem[]>([])
const groupsLoading = ref(false)
const groupsError = ref('')

const availableGroups = computed(() => {
  const taken = new Set([
    ...(audience.value?.base_groups ?? []).map((g) => g.uuid),
    ...added.value.map((o) => o.group?.uuid).filter(Boolean),
  ])
  return groups.value.filter((g) => !taken.has(g.uuid))
})

async function openGroupPicker() {
  if (picker.value === 'group') {
    picker.value = null
    return
  }
  picker.value = 'group'
  groupsError.value = ''
  groupsLoading.value = true
  try {
    groups.value = await groupsApi.listGroups(props.tourUuid)
  } catch (e) {
    groupsError.value = reminderErrorMessage(e, t, 'recipients.loadError')
  } finally {
    groupsLoading.value = false
  }
}

// ─── Selector de contacto (búsqueda) ──────────────────────────────────────────

const search = ref('')
const contacts = ref<ContactListItem[]>([])
const contactsLoading = ref(false)
const contactsError = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchRequest = 0

function openContactPicker() {
  picker.value = picker.value === 'contact' ? null : 'contact'
  search.value = ''
  contacts.value = []
  contactsError.value = ''
}

const availableContacts = computed(() => {
  const present = new Set(
    (audience.value?.people ?? []).map((p) => p.contact_uuid).filter(Boolean) as string[]
  )
  return contacts.value.filter((c) => !present.has(c.uuid))
})

watch(search, (q) => {
  if (searchTimer) clearTimeout(searchTimer)
  const query = q.trim()
  if (query.length < 2) {
    contacts.value = []
    contactsLoading.value = false
    return
  }
  contactsLoading.value = true
  searchTimer = setTimeout(async () => {
    const req = ++searchRequest
    try {
      const res = await notifApi.listGlobalContacts(query, props.tourUuid)
      if (req === searchRequest) {
        contacts.value = res
        contactsError.value = ''
      }
    } catch (e) {
      if (req === searchRequest) contactsError.value = reminderErrorMessage(e, t, 'recipients.loadError')
    } finally {
      if (req === searchRequest) contactsLoading.value = false
    }
  }, 300)
})

function closePickers() {
  picker.value = null
  search.value = ''
}

// Al final: el `immediate` usa refs declaradas más arriba.
watch(
  () => props.activityUuid,
  () => {
    closePickers()
    actionError.value = ''
    void load()
  },
  { immediate: true }
)

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <GlassBlock :title="t('recipients.title')">
    <div data-test="activity-recipients">
      <!-- Cargando -->
      <div
        v-if="loading && !audience"
        class="space-y-1.5"
        data-test="recipients-loading"
      >
        <div class="h-4 w-2/3 bg-glass-2 rounded animate-pulse" />
        <div class="h-8 bg-glass-2 rounded animate-pulse" />
        <div class="h-8 bg-glass-2 rounded animate-pulse" />
      </div>

      <!-- Error -->
      <div
        v-else-if="loadError"
        class="text-center py-2"
        data-test="recipients-error"
      >
        <p class="text-[11px] text-red-400">
          {{ loadError }}
        </p>
        <button
          v-if="!forbidden"
          class="min-h-[44px] sm:min-h-0 mt-1 text-[11px] font-semibold text-acid bg-transparent border-none cursor-pointer"
          data-test="recipients-retry"
          @click="load"
        >
          {{ t('recipients.retry') }}
        </button>
      </div>

      <template v-else-if="audience">
        <!-- Recordatorios efectivos -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
          <p
            class="text-[11px] text-ink-2 flex-1 min-w-0"
            data-test="recipients-reminders"
          >
            {{ t('recipients.remindersLine', { summary: stepsSummary(audience.effective_steps, t) }) }}
          </p>
          <button
            type="button"
            class="min-h-[44px] sm:min-h-0 text-[11px] font-semibold text-acid bg-transparent border-none cursor-pointer p-0"
            data-test="recipients-configure"
            @click="goToTourReminders"
          >
            {{ t('recipients.configure') }}
          </button>
        </div>

        <!-- Base -->
        <p
          class="text-[11px] text-ink-3 mb-2"
          data-test="recipients-base"
        >
          {{ baseText }}
        </p>

        <!-- Avisos -->
        <p
          v-for="w in audience.warnings"
          :key="w"
          class="text-[11px] text-brand-orange mb-1"
          data-test="recipients-warning"
        >
          ⚠ {{ recipientWarningLabel(w, t) }}
        </p>

        <!-- Personas -->
        <p class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mt-3 mb-1.5">
          {{ t('recipients.people', { n: audience.people.length }) }}
        </p>
        <p
          v-if="audience.people.length === 0"
          class="text-[11px] text-ink-4 py-1"
          data-test="recipients-empty"
        >
          {{ t('recipients.empty') }}
        </p>
        <ul
          v-else
          class="space-y-1"
        >
          <li
            v-for="(p, i) in audience.people"
            :key="p.contact_uuid ?? `admin-${i}`"
            class="flex items-center gap-2 bg-glass border border-line rounded-sm px-2.5 py-1.5"
            data-test="recipients-person"
          >
            <div class="flex-1 min-w-0">
              <p class="text-[12px] text-ink truncate">
                {{ p.name }}
              </p>
              <p class="text-[10px] text-ink-4 truncate">
                {{ personSources(p) }}
              </p>
            </div>
            <!-- Canales disponibles -->
            <div class="flex items-center gap-1 flex-shrink-0">
              <span
                class="text-[10px] font-bold"
                :class="p.has_phone ? 'text-wa-green' : 'text-ink-4 line-through'"
                :title="p.has_phone ? t('recipients.channels.phone') : t('recipients.channels.noPhone')"
                :aria-label="p.has_phone ? t('recipients.channels.phone') : t('recipients.channels.noPhone')"
                data-test="person-phone"
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
                ><rect
                  x="5"
                  y="2"
                  width="14"
                  height="20"
                  rx="2"
                /><line
                  x1="12"
                  y1="18"
                  x2="12.01"
                  y2="18"
                /></svg>
              </span>
              <span
                :class="p.has_email ? 'text-brand-blue' : 'text-ink-4 opacity-50'"
                :title="p.has_email ? t('recipients.channels.email') : t('recipients.channels.noEmail')"
                :aria-label="p.has_email ? t('recipients.channels.email') : t('recipients.channels.noEmail')"
                data-test="person-email"
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
                ><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              </span>
              <span
                :class="p.has_account ? 'text-acid' : 'text-ink-4 opacity-50'"
                :title="p.has_account ? t('recipients.channels.account') : t('recipients.channels.noAccount')"
                :aria-label="p.has_account ? t('recipients.channels.account') : t('recipients.channels.noAccount')"
                data-test="person-account"
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
                ><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle
                  cx="12"
                  cy="7"
                  r="4"
                /></svg>
              </span>
            </div>
            <button
              v-if="p.contact_uuid"
              type="button"
              class="flex-shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 px-2 text-[10px] text-ink-3 hover:text-red-400 bg-transparent border-none cursor-pointer"
              :title="t('recipients.exclude')"
              :aria-label="t('recipients.exclude')"
              :disabled="busy"
              data-test="person-exclude"
              @click="excludePerson(p)"
            >
              <!-- En móvil solo el icono: el texto no cabe a 375 px junto al nombre -->
              <svg
                class="sm:hidden"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ><circle
                cx="12"
                cy="12"
                r="9"
              /><line
                x1="5.6"
                y1="5.6"
                x2="18.4"
                y2="18.4"
              /></svg>
              <span class="hidden sm:inline">{{ t('recipients.exclude') }}</span>
            </button>
          </li>
        </ul>

        <!-- Ajustes de esta actividad -->
        <div
          v-if="added.length"
          class="mt-3"
        >
          <p class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-1">
            {{ t('recipients.added') }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="o in added"
              :key="o.uuid"
              class="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-acid-dim text-acid text-[11px]"
              data-test="override-added"
            >
              {{ overrideLabel(o) }}
              <button
                type="button"
                class="w-7 h-7 sm:w-5 sm:h-5 inline-flex items-center justify-center rounded-full bg-transparent border-none text-current cursor-pointer hover:bg-glass-hover"
                :aria-label="t('recipients.remove')"
                :disabled="busy"
                data-test="override-remove"
                @click="removeOverride(o)"
              >×</button>
            </span>
          </div>
        </div>
        <div
          v-if="excluded.length"
          class="mt-3"
        >
          <p class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-1">
            {{ t('recipients.excluded') }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="o in excluded"
              :key="o.uuid"
              class="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-glass-2 text-ink-3 text-[11px] line-through"
              data-test="override-excluded"
            >
              {{ overrideLabel(o) }}
              <button
                type="button"
                class="w-7 h-7 sm:w-5 sm:h-5 inline-flex items-center justify-center rounded-full bg-transparent border-none text-current cursor-pointer hover:bg-glass-hover no-underline"
                :aria-label="t('recipients.remove')"
                :disabled="busy"
                data-test="override-remove"
                @click="removeOverride(o)"
              >×</button>
            </span>
          </div>
        </div>

        <p
          v-if="actionError"
          class="text-[11px] text-red-400 mt-2"
          data-test="recipients-action-error"
        >
          {{ actionError }}
        </p>

        <!-- Añadir -->
        <div class="flex flex-wrap gap-1.5 mt-3">
          <button
            type="button"
            class="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm border border-dashed border-line text-[11px] font-medium text-ink-3 hover:text-ink hover:border-line-2 bg-transparent cursor-pointer"
            :class="picker === 'group' ? 'text-ink border-line-2' : ''"
            :disabled="busy"
            data-test="recipients-add-group"
            @click="openGroupPicker"
          >
            + {{ t('recipients.addGroup') }}
          </button>
          <button
            type="button"
            class="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-sm border border-dashed border-line text-[11px] font-medium text-ink-3 hover:text-ink hover:border-line-2 bg-transparent cursor-pointer"
            :class="picker === 'contact' ? 'text-ink border-line-2' : ''"
            :disabled="busy"
            data-test="recipients-add-contact"
            @click="openContactPicker"
          >
            + {{ t('recipients.addContact') }}
          </button>
        </div>

        <!-- Selector de grupo -->
        <div
          v-if="picker === 'group'"
          class="mt-2 bg-glass border border-line rounded-sm p-2"
          data-test="group-picker"
        >
          <p
            v-if="groupsLoading"
            class="text-[11px] text-ink-4 py-1"
          >
            {{ t('common.loading') }}
          </p>
          <p
            v-else-if="groupsError"
            class="text-[11px] text-red-400 py-1"
          >
            {{ groupsError }}
          </p>
          <p
            v-else-if="availableGroups.length === 0"
            class="text-[11px] text-ink-4 py-1"
          >
            {{ t('recipients.noGroups') }}
          </p>
          <button
            v-for="g in availableGroups"
            v-else
            :key="g.uuid"
            type="button"
            class="w-full flex items-center justify-between gap-2 min-h-[44px] sm:min-h-0 px-2 py-1.5 rounded-sm text-left text-[12px] text-ink bg-transparent border-none hover:bg-glass-hover cursor-pointer"
            :disabled="busy"
            :data-test="`group-option-${g.uuid}`"
            @click="addGroup(g.uuid)"
          >
            <span class="truncate">{{ g.name }}</span>
            <span class="text-[10px] text-ink-4 flex-shrink-0">{{
              t('reminders.tour.contacts', { n: g.contact_count }, g.contact_count)
            }}</span>
          </button>
        </div>

        <!-- Selector de contacto -->
        <div
          v-if="picker === 'contact'"
          class="mt-2 bg-glass border border-line rounded-sm p-2"
          data-test="contact-picker"
        >
          <input
            v-model="search"
            type="search"
            :placeholder="t('recipients.searchContact')"
            class="w-full h-11 sm:h-8 px-2.5 rounded-sm bg-bg-2 border border-line text-[12px] text-ink outline-none focus:border-line-acid"
            data-test="contact-search"
          >
          <p
            v-if="search.trim().length < 2"
            class="text-[10px] text-ink-4 mt-1.5"
          >
            {{ t('recipients.searchHint') }}
          </p>
          <p
            v-else-if="contactsLoading"
            class="text-[11px] text-ink-4 mt-1.5"
          >
            {{ t('common.loading') }}
          </p>
          <p
            v-else-if="contactsError"
            class="text-[11px] text-red-400 mt-1.5"
          >
            {{ contactsError }}
          </p>
          <p
            v-else-if="availableContacts.length === 0"
            class="text-[11px] text-ink-4 mt-1.5"
          >
            {{ t('recipients.noContacts') }}
          </p>
          <div
            v-else
            class="mt-1.5 max-h-56 overflow-y-auto"
          >
            <button
              v-for="c in availableContacts"
              :key="c.uuid"
              type="button"
              class="w-full flex flex-col items-start min-h-[44px] sm:min-h-0 px-2 py-1.5 rounded-sm text-left bg-transparent border-none hover:bg-glass-hover cursor-pointer"
              :disabled="busy"
              :data-test="`contact-option-${c.uuid}`"
              @click="addContact(c.uuid)"
            >
              <span class="text-[12px] text-ink truncate max-w-full">{{ c.full_name }}</span>
              <span
                v-if="c.role || c.company_name"
                class="text-[10px] text-ink-4 truncate max-w-full"
              >{{ c.role?.name ?? c.company_name }}</span>
            </button>
          </div>
        </div>
      </template>
    </div>
  </GlassBlock>
</template>
