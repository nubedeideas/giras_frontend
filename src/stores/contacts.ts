import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Contact } from '@/types'
import { useContacts } from '@/composables/useContacts'
import { useToursStore } from '@/stores/tours'

export const useContactsStore = defineStore('contacts', () => {
  const toursStore = useToursStore()
  const contacts = ref<Contact[]>([])
  const selectedId = ref<string | null>(null)
  const searchQuery = ref('')
  const selectedRoles = ref<string[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const filtered = computed(() => {
    let list = contacts.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      list = list.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.role?.name ?? '').toLowerCase().includes(q) ||
          c.primary_email.toLowerCase().includes(q) ||
          (c.company_name ?? '').toLowerCase().includes(q) ||
          (c.job_title ?? '').toLowerCase().includes(q),
      )
    }
    if (selectedRoles.value.length > 0) {
      list = list.filter((c) => c.role && selectedRoles.value.includes(c.role.uuid))
    }
    return list
  })

  function toggleRole(uuid: string) {
    const idx = selectedRoles.value.indexOf(uuid)
    if (idx >= 0) selectedRoles.value.splice(idx, 1)
    else selectedRoles.value.push(uuid)
  }

  const selectedContact = computed(
    () => contacts.value.find((c) => c.uuid === selectedId.value) ?? null,
  )

  function selectContact(uuid: string) {
    selectedId.value = uuid
  }

  function clearSelection() {
    selectedId.value = null
  }

  async function fetchContacts() {
    if (loading.value) return
    const tourUuid = toursStore.activeTour?.uuid
    // Unlike activities/calendar, no active tour means no contacts at all —
    // the view prompts to pick one instead of aggregating across every tour.
    if (!tourUuid) {
      contacts.value = []
      loaded.value = true
      return
    }
    loading.value = true
    try {
      const api = useContacts()
      contacts.value = await api.listContacts({ tour: tourUuid })
      loaded.value = true
    } catch {
      // keep existing list on error
    } finally {
      loading.value = false
    }
  }

  // Reload when the active tour changes — mirrors stores/activities.ts.
  watch(() => toursStore.activeTourId, () => {
    selectedId.value = null
    fetchContacts()
  })

  function addContacts(newContacts: Contact[]) {
    const existingUuids = new Set(contacts.value.map((c) => c.uuid))
    newContacts.forEach((c) => {
      if (!existingUuids.has(c.uuid)) contacts.value.push(c)
    })
  }

  function updateContact(uuid: string, data: Partial<Omit<Contact, 'uuid'>>) {
    const idx = contacts.value.findIndex((c) => c.uuid === uuid)
    if (idx >= 0) contacts.value[idx] = { ...contacts.value[idx], ...data }
  }

  function removeContact(uuid: string) {
    contacts.value = contacts.value.filter((c) => c.uuid !== uuid)
    if (selectedId.value === uuid) selectedId.value = null
  }

  return {
    contacts,
    selectedId,
    searchQuery,
    selectedRoles,
    loading,
    loaded,
    filtered,
    selectedContact,
    selectContact,
    clearSelection,
    fetchContacts,
    addContacts,
    updateContact,
    removeContact,
    toggleRole,
  }
})
