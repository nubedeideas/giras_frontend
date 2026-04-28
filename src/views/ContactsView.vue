<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContactsStore } from '@/stores/contacts'
import ContactCard from '@/components/contacts/ContactCard.vue'
import ContactDetail from '@/components/contacts/ContactDetail.vue'
import ContactForm from '@/components/contacts/ContactForm.vue'
import ImportContactsModal from '@/components/modals/ImportContactsModal.vue'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'

const { t } = useI18n()
const store = useContactsStore()
const showImport = ref(false)
const editMode = ref(false)
const showRoleFilter = ref(false)

onMounted(() => {
  store.fetchContacts()
})

// Unique roles present in the contacts list
const availableRoles = computed(() => {
  const seen = new Map<string, { uuid: string; name: string; color: string }>()
  for (const c of store.contacts) {
    if (c.role && !seen.has(c.role.uuid)) {
      seen.set(c.role.uuid, { uuid: c.role.uuid, name: c.role.name, color: c.role.color })
    }
  }
  return [...seen.values()]
})

// Exit edit mode when selection changes
watch(() => store.selectedId, () => { editMode.value = false })
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- List panel -->
    <div class="w-80 flex-shrink-0 bg-bg-2 border-r border-line flex flex-col overflow-hidden">
      <div class="px-3.5 pt-[18px] pb-2.5 border-b border-line flex-shrink-0">
        <div class="flex items-center justify-between mb-3">
          <p class="text-base font-bold tracking-[-0.2px] text-ink">{{ t('contacts.title') }}</p>
          <BtnPrimary small @click="showImport = true">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {{ t('contacts.addContact') }}
          </BtnPrimary>
        </div>

        <!-- Search -->
        <div
          class="flex items-center gap-[7px] bg-glass border border-line rounded-sm px-[11px] py-[7px]"
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
            class="text-ink-4 flex-shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="store.searchQuery"
            :placeholder="t('contacts.search')"
            class="flex-1 bg-transparent border-none outline-none text-ink text-[12px] placeholder:text-ink-4"
          />
        </div>

        <!-- Role filter (compact dropdown) -->
        <div v-if="availableRoles.length > 0" class="relative mt-2">
          <!-- Trigger -->
          <button
            class="w-full flex items-center gap-2 bg-glass border rounded-sm px-[11px] py-[7px] cursor-pointer transition-all duration-150 text-left"
            :class="store.selectedRoles.length > 0 ? 'border-line-acid' : 'border-line hover:border-line-2'"
            @click="showRoleFilter = !showRoleFilter"
          >
            <!-- Selected role dots + label -->
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              <template v-if="store.selectedRoles.length > 0">
                <span
                  v-for="uuid in store.selectedRoles"
                  :key="uuid"
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  :style="{ background: availableRoles.find((r) => r.uuid === uuid)?.color }"
                />
                <span class="text-[11px] text-ink truncate">
                  {{
                    store.selectedRoles.length === 1
                      ? availableRoles.find((r) => r.uuid === store.selectedRoles[0])?.name
                      : `${store.selectedRoles.length} roles`
                  }}
                </span>
              </template>
              <span v-else class="text-[11px] text-ink-4">Filtrar por rol</span>
            </div>
            <!-- Clear + chevron -->
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <span
                v-if="store.selectedRoles.length > 0"
                class="text-[10px] text-ink-4 hover:text-ink leading-none"
                @click.stop="store.selectedRoles.splice(0)"
              >✕</span>
              <svg
                width="9" height="9" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round"
                class="text-ink-4 transition-transform duration-150"
                :class="showRoleFilter ? 'rotate-180' : ''"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          <!-- Dropdown list -->
          <div
            v-if="showRoleFilter"
            class="absolute top-full left-0 right-0 mt-1 bg-bg-4 border border-line rounded-sm z-50 py-1 shadow-lg"
          >
            <button
              v-for="role in availableRoles"
              :key="role.uuid"
              class="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-glass cursor-pointer transition-colors border-none bg-transparent text-left"
              @click="store.toggleRole(role.uuid)"
            >
              <!-- Checkbox -->
              <div
                class="w-[13px] h-[13px] rounded-[3px] border flex items-center justify-center flex-shrink-0 transition-all duration-150"
                :class="store.selectedRoles.includes(role.uuid) ? 'border-transparent' : 'border-line-2'"
                :style="store.selectedRoles.includes(role.uuid) ? { background: role.color } : {}"
              >
                <svg
                  v-if="store.selectedRoles.includes(role.uuid)"
                  width="8" height="8" viewBox="0 0 24 24" fill="none"
                  stroke="#000" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <!-- Color dot -->
              <span
                class="w-2 h-2 rounded-full flex-shrink-0"
                :style="{ background: role.color }"
              />
              <span class="text-[12px] text-ink">{{ role.name }}</span>
            </button>
          </div>

          <!-- Backdrop to close dropdown -->
          <div
            v-if="showRoleFilter"
            class="fixed inset-0 z-40"
            @click="showRoleFilter = false"
          />
        </div>
      </div>

      <!-- Contact list -->
      <div class="flex-1 overflow-y-auto px-2 py-2">
        <div v-if="store.loading" class="flex justify-center py-8">
          <svg class="animate-spin text-ink-4" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="40 22" stroke-linecap="round"/>
          </svg>
        </div>
        <template v-else>
          <div class="relative" v-for="c in store.filtered" :key="c.uuid">
            <ContactCard
              :contact="c"
              :selected="store.selectedId === c.uuid"
              @select="store.selectContact"
            />
          </div>
          <div v-if="store.filtered.length === 0" class="text-center py-8 text-ink-4 text-xs">
            {{ t('contacts.noContacts') }}
          </div>
        </template>
      </div>
    </div>

    <!-- Detail / Edit panel -->
    <div class="flex-1 overflow-hidden">
      <Transition name="fade">
        <ContactForm
          v-if="store.selectedContact && editMode"
          :key="store.selectedContact.uuid + '-form'"
          :contact="store.selectedContact"
          @cancel="editMode = false"
          @saved="editMode = false"
        />
        <ContactDetail
          v-else-if="store.selectedContact"
          :contact="store.selectedContact"
          @edit="editMode = true"
        />
        <div
          v-else
          class="h-full bg-bg-3 flex flex-col items-center justify-center gap-2.5 text-ink-3"
        >
          <div
            class="w-12 h-12 rounded-[15px] bg-glass border border-line flex items-center justify-center"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-ink-4"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <p class="text-[12px]">{{ t('contacts.selectContact') }}</p>
        </div>
      </Transition>
    </div>

    <ImportContactsModal :show="showImport" @close="showImport = false" />
  </div>
</template>
