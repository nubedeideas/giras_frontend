<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AudiencePerson } from '@/composables/useRecipientOverrides'
import type { NoticeSelection } from '@/composables/useNotices'
import {
  useNotificationGroups,
  type NotificationGroupListItem,
} from '@/composables/useNotificationGroups'
import { useNotifications, type ContactListItem } from '@/composables/useNotifications'
import type { ReminderChannel } from '@/utils/reminders'
import { noticeErrorMessage } from '@/utils/notices'

/**
 * Destinatarios de un aviso (C2.2 y C2.4): personas de la vista previa con "Quitar", chips de
 * grupos añadidos y de personas quitadas, y selectores para añadir grupo o contacto. No llama a
 * la API de avisos: emite la selección nueva y el padre decide (PATCH o nueva vista previa).
 */
const props = defineProps<{
  people: AudiencePerson[]
  selection: NoticeSelection
  tourUuid: string
  channel: ReminderChannel
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:selection': [NoticeSelection] }>()

const { t } = useI18n()
const groupsApi = useNotificationGroups()
const notifApi = useNotifications()

// Nombres conocidos por uuid (personas vistas, grupos y resultados de búsqueda): los chips de
// excluidos y de grupos nunca enseñan un uuid.
const names = ref(new Map<string, string>())
function remember(uuid: string | null, name: string) {
  if (uuid && name) names.value.set(uuid, name)
}
watch(
  () => props.people,
  (people) => people.forEach((p) => remember(p.contact_uuid, p.name)),
  { immediate: true }
)

function reachable(p: AudiencePerson): boolean {
  if (props.channel === 'whatsapp') return p.has_phone
  if (props.channel === 'email') return p.has_email
  return p.has_account
}

function unreachableLabel(): string {
  if (props.channel === 'whatsapp') return t('recipients.channels.noPhone')
  if (props.channel === 'email') return t('recipients.channels.noEmail')
  return t('recipients.channels.noAccount')
}

function update(patch: Partial<NoticeSelection>) {
  emit('update:selection', { ...props.selection, ...patch })
}

function removePerson(p: AudiencePerson) {
  const uuid = p.contact_uuid
  if (!uuid) return
  if (props.selection.contacts.includes(uuid)) {
    update({ contacts: props.selection.contacts.filter((c) => c !== uuid) })
  } else if (!props.selection.excluded_contacts.includes(uuid)) {
    update({ excluded_contacts: [...props.selection.excluded_contacts, uuid] })
  }
}

function restore(uuid: string) {
  update({ excluded_contacts: props.selection.excluded_contacts.filter((c) => c !== uuid) })
}

function removeGroup(uuid: string) {
  update({ groups: props.selection.groups.filter((g) => g !== uuid) })
}

function addGroup(g: NotificationGroupListItem) {
  remember(g.uuid, g.name)
  picker.value = null
  if (!props.selection.groups.includes(g.uuid)) update({ groups: [...props.selection.groups, g.uuid] })
}

function addContact(c: ContactListItem) {
  remember(c.uuid, c.full_name)
  picker.value = null
  search.value = ''
  if (props.selection.excluded_contacts.includes(c.uuid)) {
    restore(c.uuid)
    return
  }
  if (!props.selection.contacts.includes(c.uuid)) {
    update({ contacts: [...props.selection.contacts, c.uuid] })
  }
}

const excludedChips = computed(() =>
  props.selection.excluded_contacts.map((uuid) => ({
    uuid,
    name: names.value.get(uuid) ?? t('notices.recipients.contact'),
  }))
)
const groupChips = computed(() =>
  props.selection.groups.map((uuid) => ({
    uuid,
    name: names.value.get(uuid) ?? t('notices.recipients.group'),
  }))
)

// ─── Selectores ───────────────────────────────────────────────────────────────

const picker = ref<'group' | 'contact' | null>(null)
const groups = ref<NotificationGroupListItem[]>([])
const groupsLoaded = ref(false)
const groupsLoading = ref(false)
const groupsError = ref('')

async function loadGroups() {
  groupsLoading.value = true
  groupsError.value = ''
  try {
    groups.value = await groupsApi.listGroups(props.tourUuid)
    groups.value.forEach((g) => remember(g.uuid, g.name))
    groupsLoaded.value = true
  } catch (e) {
    groupsError.value = noticeErrorMessage(e, t, 'recipients.loadError')
  } finally {
    groupsLoading.value = false
  }
}

// Si el aviso ya trae grupos añadidos, se cargan para poner nombre a sus chips.
watch(
  () => props.selection.groups.length,
  (n) => {
    if (n && !groupsLoaded.value && !groupsLoading.value) void loadGroups()
  },
  { immediate: true }
)

function openGroupPicker() {
  picker.value = picker.value === 'group' ? null : 'group'
  if (picker.value === 'group' && !groupsLoaded.value) void loadGroups()
}

const availableGroups = computed(() =>
  groups.value.filter((g) => !props.selection.groups.includes(g.uuid))
)

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
    props.people.map((p) => p.contact_uuid).filter((u): u is string => !!u)
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
      if (req === searchRequest) contactsError.value = noticeErrorMessage(e, t, 'recipients.loadError')
    } finally {
      if (req === searchRequest) contactsLoading.value = false
    }
  }, 300)
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div data-test="notice-recipients">
    <p
      v-if="people.length === 0"
      class="text-[11px] text-ink-4 py-1"
      data-test="notice-recipients-empty"
    >
      {{ t('notices.recipients.empty') }}
    </p>
    <ul
      v-else
      class="space-y-1 max-h-64 overflow-y-auto"
    >
      <li
        v-for="(p, i) in people"
        :key="p.contact_uuid ?? `admin-${i}`"
        class="flex items-center gap-2 bg-glass border border-line rounded-sm pl-2.5 pr-1 py-1"
        data-test="notice-person"
      >
        <div class="flex-1 min-w-0">
          <p class="text-[12px] text-ink truncate">
            {{ p.name }}
          </p>
          <p
            v-if="!reachable(p)"
            class="text-[10px] text-brand-orange truncate"
            data-test="notice-person-unreachable"
          >
            {{ unreachableLabel() }}
          </p>
        </div>
        <button
          v-if="p.contact_uuid"
          type="button"
          class="flex-shrink-0 min-h-[44px] min-w-[44px] lg:min-h-[28px] lg:min-w-[28px] flex items-center justify-center rounded-sm text-ink-3 hover:text-red-400 hover:bg-glass-hover bg-transparent border-none cursor-pointer disabled:opacity-40"
          :aria-label="t('notices.recipients.remove', { name: p.name })"
          :title="t('notices.recipients.remove', { name: p.name })"
          :disabled="disabled"
          data-test="notice-person-remove"
          @click="removePerson(p)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><line
            x1="18"
            y1="6"
            x2="6"
            y2="18"
          /><line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
          /></svg>
        </button>
      </li>
    </ul>

    <!-- Grupos añadidos -->
    <div
      v-if="groupChips.length"
      class="mt-2.5"
    >
      <p class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-1">
        {{ t('notices.recipients.addedGroups') }}
      </p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="g in groupChips"
          :key="g.uuid"
          class="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-acid-dim text-acid text-[11px]"
          data-test="notice-group-chip"
        >
          {{ g.name }}
          <button
            type="button"
            class="w-8 h-8 lg:w-5 lg:h-5 inline-flex items-center justify-center rounded-full bg-transparent border-none text-current cursor-pointer hover:bg-glass-hover"
            :aria-label="t('notices.recipients.remove', { name: g.name })"
            :disabled="disabled"
            data-test="notice-group-remove"
            @click="removeGroup(g.uuid)"
          >×</button>
        </span>
      </div>
    </div>

    <!-- Personas quitadas -->
    <div
      v-if="excludedChips.length"
      class="mt-2.5"
    >
      <p class="text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-1">
        {{ t('notices.recipients.removed') }}
      </p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="c in excludedChips"
          :key="c.uuid"
          class="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-glass-2 text-ink-3 text-[11px]"
          data-test="notice-excluded-chip"
        >
          <span class="line-through">{{ c.name }}</span>
          <button
            type="button"
            class="min-h-[32px] lg:min-h-0 px-1.5 rounded-full bg-transparent border-none text-acid text-[10px] font-semibold cursor-pointer hover:bg-glass-hover"
            :disabled="disabled"
            data-test="notice-excluded-restore"
            @click="restore(c.uuid)"
          >{{ t('notices.recipients.restore') }}</button>
        </span>
      </div>
    </div>

    <!-- Añadir -->
    <div class="flex flex-wrap gap-1.5 mt-2.5">
      <button
        type="button"
        class="flex-1 lg:flex-none min-h-[44px] lg:min-h-0 px-3 py-1.5 rounded-sm border border-dashed border-line text-[11px] font-medium text-ink-3 hover:text-ink hover:border-line-2 bg-transparent cursor-pointer"
        :class="picker === 'group' ? 'text-ink border-line-2' : ''"
        :disabled="disabled"
        data-test="notice-add-group"
        @click="openGroupPicker"
      >
        + {{ t('recipients.addGroup') }}
      </button>
      <button
        type="button"
        class="flex-1 lg:flex-none min-h-[44px] lg:min-h-0 px-3 py-1.5 rounded-sm border border-dashed border-line text-[11px] font-medium text-ink-3 hover:text-ink hover:border-line-2 bg-transparent cursor-pointer"
        :class="picker === 'contact' ? 'text-ink border-line-2' : ''"
        :disabled="disabled"
        data-test="notice-add-contact"
        @click="openContactPicker"
      >
        + {{ t('recipients.addContact') }}
      </button>
    </div>

    <div
      v-if="picker === 'group'"
      class="mt-2 bg-glass border border-line rounded-sm p-2"
      data-test="notice-group-picker"
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
        class="w-full flex items-center justify-between gap-2 min-h-[44px] lg:min-h-0 px-2 py-1.5 rounded-sm text-left text-[12px] text-ink bg-transparent border-none hover:bg-glass-hover cursor-pointer"
        :disabled="disabled"
        :data-test="`notice-group-option-${g.uuid}`"
        @click="addGroup(g)"
      >
        <span class="truncate">{{ g.name }}</span>
        <span class="text-[10px] text-ink-4 flex-shrink-0">{{
          t('reminders.tour.contacts', { n: g.contact_count }, g.contact_count)
        }}</span>
      </button>
    </div>

    <div
      v-if="picker === 'contact'"
      class="mt-2 bg-glass border border-line rounded-sm p-2"
      data-test="notice-contact-picker"
    >
      <input
        v-model="search"
        type="search"
        :placeholder="t('recipients.searchContact')"
        class="w-full h-11 lg:h-8 px-2.5 rounded-sm bg-bg-2 border border-line text-[12px] text-ink outline-none focus:border-line-acid"
        data-test="notice-contact-search"
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
          class="w-full flex flex-col items-start min-h-[44px] lg:min-h-0 px-2 py-1.5 rounded-sm text-left bg-transparent border-none hover:bg-glass-hover cursor-pointer"
          :disabled="disabled"
          :data-test="`notice-contact-option-${c.uuid}`"
          @click="addContact(c)"
        >
          <span class="text-[12px] text-ink truncate max-w-full">{{ c.full_name }}</span>
          <span
            v-if="c.role || c.company_name"
            class="text-[10px] text-ink-4 truncate max-w-full"
          >{{ c.role?.name ?? c.company_name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
