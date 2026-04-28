<script setup lang="ts">
import { reactive, computed, ref, onMounted } from 'vue'
import type { Contact, EmailLabel, PhoneLabel } from '@/types'
import { useContactsStore } from '@/stores/contacts'
import { useContacts } from '@/composables/useContacts'
import { useContactRoles, type ContactRole } from '@/composables/useContactRoles'
import BtnPrimary from '@/components/ui/BtnPrimary.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

const props = defineProps<{ contact: Contact }>()
const emit = defineEmits<{ cancel: []; saved: [] }>()
const store = useContactsStore()
const contactsApi = useContacts()
const rolesApi = useContactRoles()

const roles = ref<ContactRole[]>([])
const saving = ref(false)
const saveError = ref('')

onMounted(async () => {
  try {
    roles.value = await rolesApi.listRoles()
  } catch {
    // non-critical — role selector will be empty
  }
})

// ─── Form state ───────────────────────────────────────────────────────────────

const form = reactive({
  contact_type: props.contact.contact_type,
  first_name: props.contact.first_name,
  last_name: props.contact.last_name,
  company_name: props.contact.company_name ?? '',
  job_title: props.contact.job_title ?? '',
  role_uuid: props.contact.role?.uuid ?? '',
  emails: (
    props.contact.emails?.length
      ? props.contact.emails
      : [{ id: 1, email: props.contact.primary_email, label: 'work' as EmailLabel, is_primary: true }]
  ).map((e) => ({ ...e })),
  phones: (
    props.contact.phones?.length
      ? props.contact.phones
      : [{ id: 1, phone: props.contact.primary_phone, label: 'mobile' as PhoneLabel, is_primary: true }]
  ).map((p) => ({ ...p })),
  city: props.contact.city ?? '',
  country: props.contact.country ?? '',
  website: props.contact.website ?? '',
  notes: props.contact.notes ?? '',
  is_favorite: props.contact.is_favorite,
  is_emergency: props.contact.is_emergency,
})

// ─── Computed ─────────────────────────────────────────────────────────────────

const selectedRole = computed(() => roles.value.find((r) => r.uuid === form.role_uuid) ?? null)
const displayName = computed(
  () => [form.first_name, form.last_name].filter(Boolean).join(' ') || '—',
)
const avatarBg = computed(() => selectedRole.value?.color ?? 'var(--avatar-bg)')
const initials = computed(
  () => (form.first_name.charAt(0) + form.last_name.charAt(0)).toUpperCase() || '?',
)
const isValid = computed(() => form.first_name.trim().length > 0)

// ─── Label maps ───────────────────────────────────────────────────────────────

const EMAIL_LABELS: { value: EmailLabel; label: string }[] = [
  { value: 'work', label: 'Trabajo' },
  { value: 'personal', label: 'Personal' },
  { value: 'booking', label: 'Booking' },
  { value: 'press', label: 'Prensa' },
  { value: 'other', label: 'Otro' },
]

const PHONE_LABELS: { value: PhoneLabel; label: string }[] = [
  { value: 'mobile', label: 'Móvil' },
  { value: 'work', label: 'Trabajo' },
  { value: 'home', label: 'Casa' },
  { value: 'fax', label: 'Fax' },
  { value: 'other', label: 'Otro' },
]

// ─── Email / phone mutations ──────────────────────────────────────────────────

function setPrimaryEmail(idx: number) {
  form.emails.forEach((e, i) => (e.is_primary = i === idx))
}
function addEmail() {
  form.emails.push({ id: Date.now(), email: '', label: 'work', is_primary: false })
}
function removeEmail(idx: number) {
  if (form.emails.length <= 1) return
  const wasPrimary = form.emails[idx].is_primary
  form.emails.splice(idx, 1)
  if (wasPrimary) form.emails[0].is_primary = true
}

function setPrimaryPhone(idx: number) {
  form.phones.forEach((p, i) => (p.is_primary = i === idx))
}
function addPhone() {
  form.phones.push({ id: Date.now(), phone: '', label: 'mobile', is_primary: false })
}
function removePhone(idx: number) {
  if (form.phones.length <= 1) return
  const wasPrimary = form.phones[idx].is_primary
  form.phones.splice(idx, 1)
  if (wasPrimary) form.phones[0].is_primary = true
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function save() {
  if (saving.value) return
  saving.value = true
  saveError.value = ''
  try {
    const validEmails = form.emails.filter((e) => e.email.trim())
    const validPhones = form.phones.filter((p) => p.phone.trim())

    // Build a plain object accepted by the backend (bypasses strict Contact typing
    // for write-only fields like role UUID and nested phones/emails).
    // Django CharField fields use blank=True (not null=True) — send '' to clear, not null.
    const payload = {
      contact_type: form.contact_type,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      company_name: form.company_name.trim(),
      job_title: form.job_title.trim(),
      // Send uuid string so backend resolves it; empty string clears the role
      role: selectedRole.value ? selectedRole.value.uuid : '',
      emails: validEmails,
      phones: validPhones,
      city: form.city.trim(),
      country: form.country.trim(),
      website: form.website.trim(),
      notes: form.notes.trim(),
      is_favorite: form.is_favorite,
      is_emergency: form.is_emergency,
    }

    const updated = await contactsApi.updateContact(props.contact.uuid, payload as never)
    store.updateContact(props.contact.uuid, updated)
    emit('saved')
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Error al guardar contacto'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex-1 bg-bg-3 flex flex-col overflow-hidden">
    <!-- ─── Header ──────────────────────────────────────────────────────────── -->
    <div class="px-6 pt-5 pb-4 border-b border-line flex-shrink-0">
      <div class="flex items-center gap-4 mb-4">
        <!-- Live avatar preview -->
        <div
          class="w-14 h-14 rounded-full flex-shrink-0 border-2 flex items-center justify-center text-lg font-bold text-white overflow-hidden"
          :style="{ background: avatarBg, borderColor: avatarBg }"
        >
          <img
            v-if="contact.avatar"
            :src="contact.avatar"
            :alt="displayName"
            class="w-full h-full object-cover"
          />
          <span v-else>{{ initials }}</span>
        </div>

        <!-- Name preview -->
        <div class="flex-1 min-w-0">
          <p class="text-base font-bold text-ink tracking-[-0.3px] truncate">{{ displayName }}</p>
          <p v-if="selectedRole" class="text-[11px] mt-px" :style="{ color: selectedRole.color }">
            {{ selectedRole.name }}
          </p>
          <p v-else-if="form.job_title" class="text-[11px] text-ink-3 mt-px">{{ form.job_title }}</p>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-2">
        <BtnPrimary small :disabled="!isValid || saving" @click="save">
          <svg
            v-if="!saving"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </BtnPrimary>
        <BtnSecondary small @click="emit('cancel')">Cancelar</BtnSecondary>
      </div>
      <div v-if="saveError" class="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
        <p class="text-[11px] text-red-400 whitespace-pre-line font-mono">{{ saveError }}</p>
      </div>
    </div>

    <!-- ─── Scrollable form body ───────────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">

      <!-- ── Tipo de contacto ── -->
      <div>
        <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1.5">
          Tipo
        </label>
        <div class="grid grid-cols-2 gap-1.5 p-1 bg-bg-2 rounded-lg border border-line">
          <button
            v-for="opt in [{ value: 'person', label: 'Persona' }, { value: 'company', label: 'Empresa' }]"
            :key="opt.value"
            type="button"
            class="py-1.5 rounded text-[11px] font-semibold transition-all cursor-pointer border-none"
            :class="
              form.contact_type === opt.value
                ? 'bg-glass-active text-acid'
                : 'bg-transparent text-ink-3 hover:text-ink'
            "
            @click="form.contact_type = opt.value as 'person' | 'company'"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- ── Nombre ── -->
      <div class="space-y-2.5">
        <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block">
          Nombre *
        </label>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[9px] text-ink-4 block mb-1">Nombre</label>
            <input
              v-model="form.first_name"
              placeholder="Nombre"
              class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
            />
          </div>
          <div>
            <label class="text-[9px] text-ink-4 block mb-1">Apellido</label>
            <input
              v-model="form.last_name"
              placeholder="Apellido"
              class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
            />
          </div>
        </div>
      </div>

      <!-- ── Rol & Empresa ── -->
      <div class="space-y-2.5">
        <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block">
          Rol & Empresa
        </label>

        <!-- Role select -->
        <div class="relative">
          <div
            v-if="selectedRole"
            class="absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none"
            :style="{ background: selectedRole.color }"
          />
          <select
            v-model="form.role_uuid"
            class="w-full bg-glass border border-line rounded py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors appearance-none cursor-pointer"
            :class="selectedRole ? 'pl-7 pr-2.5' : 'px-2.5'"
          >
            <option value="">Sin rol</option>
            <option v-for="r in roles" :key="r.uuid" :value="r.uuid">{{ r.name }}</option>
          </select>
          <svg
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        <!-- Job title -->
        <input
          v-model="form.job_title"
          placeholder="Cargo / Puesto"
          class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
        />

        <!-- Company name -->
        <input
          v-if="form.contact_type === 'company' || form.company_name"
          v-model="form.company_name"
          placeholder="Empresa"
          class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
        />
      </div>

      <!-- ── Teléfonos ── -->
      <div class="space-y-1.5">
        <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-2">
          Teléfonos
        </label>

        <div v-for="(ph, idx) in form.phones" :key="ph.id" class="flex items-center gap-1.5">
          <!-- Label select -->
          <select
            v-model="ph.label"
            class="w-[78px] flex-shrink-0 bg-glass border border-line rounded px-2 py-1.5 text-ink-3 text-[10px] outline-none focus:border-acid transition-colors appearance-none cursor-pointer"
          >
            <option v-for="l in PHONE_LABELS" :key="l.value" :value="l.value">{{ l.label }}</option>
          </select>

          <!-- Phone input -->
          <input
            v-model="ph.phone"
            placeholder="+52 55 0000 0000"
            class="flex-1 min-w-0 bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
          />

          <!-- Primary toggle -->
          <button
            type="button"
            class="w-5 h-5 rounded-full flex-shrink-0 border-[1.5px] transition-all cursor-pointer"
            :class="
              ph.is_primary
                ? 'bg-acid border-acid'
                : 'bg-transparent border-line-2 hover:border-acid'
            "
            :title="ph.is_primary ? 'Principal' : 'Marcar como principal'"
            @click="setPrimaryPhone(idx)"
          >
            <svg
              v-if="ph.is_primary"
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#000"
              stroke-width="3.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="mx-auto"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>

          <!-- Remove -->
          <button
            v-if="form.phones.length > 1"
            type="button"
            class="w-5 h-5 flex items-center justify-center text-ink-4 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0 border-none bg-transparent"
            @click="removePhone(idx)"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          class="flex items-center gap-1 text-[11px] text-ink-3 hover:text-acid transition-colors cursor-pointer border-none bg-transparent mt-1"
          @click="addPhone"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Agregar teléfono
        </button>
      </div>

      <!-- ── Emails ── -->
      <div class="space-y-1.5">
        <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-2">
          Emails
        </label>

        <div v-for="(em, idx) in form.emails" :key="em.id" class="flex items-center gap-1.5">
          <!-- Label select -->
          <select
            v-model="em.label"
            class="w-[78px] flex-shrink-0 bg-glass border border-line rounded px-2 py-1.5 text-ink-3 text-[10px] outline-none focus:border-acid transition-colors appearance-none cursor-pointer"
          >
            <option v-for="l in EMAIL_LABELS" :key="l.value" :value="l.value">{{ l.label }}</option>
          </select>

          <!-- Email input -->
          <input
            v-model="em.email"
            type="email"
            placeholder="email@ejemplo.com"
            class="flex-1 min-w-0 bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
          />

          <!-- Primary toggle -->
          <button
            type="button"
            class="w-5 h-5 rounded-full flex-shrink-0 border-[1.5px] transition-all cursor-pointer"
            :class="
              em.is_primary
                ? 'bg-acid border-acid'
                : 'bg-transparent border-line-2 hover:border-acid'
            "
            :title="em.is_primary ? 'Principal' : 'Marcar como principal'"
            @click="setPrimaryEmail(idx)"
          >
            <svg
              v-if="em.is_primary"
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#000"
              stroke-width="3.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="mx-auto"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>

          <!-- Remove -->
          <button
            v-if="form.emails.length > 1"
            type="button"
            class="w-5 h-5 flex items-center justify-center text-ink-4 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0 border-none bg-transparent"
            @click="removeEmail(idx)"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          class="flex items-center gap-1 text-[11px] text-ink-3 hover:text-acid transition-colors cursor-pointer border-none bg-transparent mt-1"
          @click="addEmail"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Agregar email
        </button>
      </div>

      <!-- ── Ubicación ── -->
      <div class="space-y-2.5">
        <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block">
          Ubicación
        </label>
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="form.city"
            placeholder="Ciudad"
            class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
          />
          <input
            v-model="form.country"
            placeholder="País"
            class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
          />
        </div>
        <input
          v-model="form.website"
          placeholder="https://..."
          class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors"
        />
      </div>

      <!-- ── Clasificación ── -->
      <div>
        <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-2">
          Clasificación
        </label>
        <div class="flex flex-col gap-2">
          <!-- Favorite toggle -->
          <button
            type="button"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer text-left"
            :class="
              form.is_favorite
                ? 'bg-acid/10 border-acid/30 text-acid'
                : 'bg-glass border-line text-ink-3 hover:bg-glass-2 hover:text-ink'
            "
            @click="form.is_favorite = !form.is_favorite"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              :fill="form.is_favorite ? 'currentColor' : 'none'"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
            <div class="flex-1">
              <p class="text-[12px] font-semibold">Favorito</p>
              <p class="text-[10px] opacity-60">Aparece destacado en la lista</p>
            </div>
            <div
              class="w-8 h-4 rounded-full transition-colors relative flex-shrink-0"
              :class="form.is_favorite ? 'bg-acid' : 'bg-glass-2'"
            >
              <div
                class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all"
                :class="form.is_favorite ? 'left-[18px]' : 'left-0.5'"
              />
            </div>
          </button>

          <!-- Emergency toggle -->
          <button
            type="button"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer text-left"
            :class="
              form.is_emergency
                ? 'border-[#e85d00]/30 text-[#e85d00]'
                : 'bg-glass border-line text-ink-3 hover:bg-glass-2 hover:text-ink'
            "
            :style="form.is_emergency ? 'background: rgba(232,93,0,0.10)' : ''"
            @click="form.is_emergency = !form.is_emergency"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div class="flex-1">
              <p class="text-[12px] font-semibold">Emergencia</p>
              <p class="text-[10px] opacity-60">Contacto de emergencia de la gira</p>
            </div>
            <div
              class="w-8 h-4 rounded-full transition-colors relative flex-shrink-0"
              :style="form.is_emergency ? 'background: #e85d00' : ''"
              :class="!form.is_emergency ? 'bg-glass-2' : ''"
            >
              <div
                class="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all"
                :class="form.is_emergency ? 'left-[18px]' : 'left-0.5'"
              />
            </div>
          </button>
        </div>
      </div>

      <!-- ── Notas ── -->
      <div>
        <label class="text-[9px] font-bold text-ink-3 tracking-[0.5px] uppercase block mb-1.5">
          Notas
        </label>
        <textarea
          v-model="form.notes"
          placeholder="Notas internas sobre este contacto..."
          rows="3"
          class="w-full bg-glass border border-line rounded px-2.5 py-1.5 text-ink text-[12px] outline-none focus:border-acid transition-colors resize-none"
        />
      </div>
    </div>
  </div>
</template>
