<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/utils/apiClient'
import { userInitials } from '@/utils/userInitials'
import { useAuthProfile } from '@/composables/useAuthProfile'
import Pill from '@/components/ui/Pill.vue'
import RolesManager from '@/components/settings/RolesManager.vue'
import ActivityTypesManager from '@/components/settings/ActivityTypesManager.vue'
import CalendarsManager from '@/components/settings/CalendarsManager.vue'
import IcalSubscriptionsManager from '@/components/ical/IcalSubscriptionsManager.vue'
import GoogleConnectionCard from '@/components/settings/GoogleConnectionCard.vue'
import GoogleConnectNotice from '@/components/settings/GoogleConnectNotice.vue'
import ReminderTemplatesManager from '@/components/settings/reminders/ReminderTemplatesManager.vue'
import NotificationGroupsManager from '@/components/settings/NotificationGroupsManager.vue'
import NotificationRulesManager from '@/components/settings/rules/NotificationRulesManager.vue'
import NotificationTemplatesView from '@/views/NotificationTemplatesView.vue'
import SubscriptionManager from '@/components/settings/SubscriptionManager.vue'
import BillingManager from '@/components/settings/BillingManager.vue'

type SettingsTab =
  | 'general'
  | 'calendars'
  | 'activities'
  | 'reminders'
  | 'roles'
  | 'groups'
  | 'rules'
  | 'templates'
  | 'subscription'
  | 'billing'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const auth = useAuthStore()

// computed: la etiqueta de "Reglas" va por i18n y sigue al cambio de idioma.
const TABS = computed<{ key: SettingsTab; label: string; iconPath: string }[]>(() => [
  {
    key: 'general',
    label: 'General',
    iconPath: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  },
  {
    key: 'calendars',
    label: t('settings.calendars.title'),
    iconPath: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  },
  {
    key: 'activities',
    label: 'Actividades',
    iconPath: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`,
  },
  {
    key: 'reminders',
    label: t('reminders.tab'),
    iconPath: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  },
  {
    key: 'roles',
    label: 'Roles',
    iconPath: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  },
  {
    key: 'groups',
    label: 'Grupos',
    iconPath: `<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>`,
  },
  {
    key: 'rules',
    label: t('rules.tab'),
    iconPath: `<polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  },
  {
    key: 'templates',
    label: 'Templates',
    iconPath: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  },
  {
    key: 'subscription',
    label: 'Suscripción',
    iconPath: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  },
  {
    key: 'billing',
    label: 'Facturación',
    iconPath: `<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>`,
  },
])

// Se incrementa al desconectar Google para que CalendarsManager recargue (calendarios desactivados).
const calendarsKey = ref(0)

const activeTab = computed<SettingsTab>({
  get: () => (route.query.tab as SettingsTab | undefined) ?? 'general',
  set: (tab) => router.replace({ path: '/settings', query: { tab } }),
})

const integrations = [
  { name: 'Google Calendar', variant: 'g' as const, label: 'active' },
  { name: 'WhatsApp (Twilio)', variant: 'g' as const, label: 'active' },
  { name: 'Mailgun (Email)', variant: 'n' as const, label: 'configure' },
  { name: 'Apple Wallet Pass', variant: 'o' as const, label: 'beta' },
]

// ─── Teléfono del usuario (C1.6): fallback de admins por WhatsApp y alertas de borradores ───

// Mismo patrón que el backend (A1.7): E.164 laxo, se guarda sin espacios.
const PHONE_RE = /^\+?[0-9 ]{7,20}$/
const PHONE_MAX_LENGTH = 20
const { updateMe } = useAuthProfile()

const phone = ref(auth.user?.phone_number ?? '')
const phoneSaving = ref(false)
const phoneError = ref('')
const phoneSaved = ref(false)

watch(
  () => auth.user?.phone_number,
  (v) => {
    phone.value = v ?? ''
  }
)

const phoneDirty = computed(() => phone.value.trim() !== (auth.user?.phone_number ?? ''))

async function savePhone() {
  const value = phone.value.trim()
  phoneSaved.value = false
  phoneError.value = ''
  const normalized = value.replace(/ /g, '')
  // Como el backend: patrón laxo con espacios y, ya sin ellos, 20 caracteres como máximo.
  if (value && (!PHONE_RE.test(value) || normalized.length > PHONE_MAX_LENGTH)) {
    phoneError.value = t('settings.phoneInvalid')
    return
  }
  phoneSaving.value = true
  try {
    await updateMe({ phone_number: normalized })
    phoneSaved.value = true
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) {
      const msg = e.fieldErrors?.phone_number
      phoneError.value =
        (Array.isArray(msg) ? (msg[0] as string) : (msg as string)) || t('settings.phoneInvalid')
    } else if (e instanceof ApiError && e.status === 429) {
      phoneError.value = t('common.tooManyRequests')
    } else {
      phoneError.value = t('settings.phoneError')
    }
  } finally {
    phoneSaving.value = false
  }
}

async function signOut() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="flex flex-col lg:flex-row h-full overflow-hidden">
    <!-- ── Left sidebar / mobile top bar ───────────────────────────────────── -->
    <div
      class="flex-shrink-0 bg-bg-2 border-b lg:border-b-0 lg:border-r border-line flex flex-col overflow-hidden lg:w-52"
    >
      <!-- User profile block -->
      <div class="flex items-center gap-2.5 px-4 py-3 lg:pt-5 lg:pb-4 lg:flex-col lg:items-stretch border-b border-line flex-shrink-0">
        <div class="flex items-center gap-2.5 lg:mb-3 flex-1 min-w-0">
          <div
            class="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[15px] font-bold text-ink border-2 border-olive"
            :style="{ background: auth.user?.avatar ? 'transparent' : 'var(--acid)' }"
          >
            <img
              v-if="auth.user?.avatar"
              :src="auth.user.avatar"
              class="w-full h-full object-cover"
              :alt="auth.user.full_name"
            >
            <span v-else>{{ userInitials(auth.user) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[14px] font-bold text-ink truncate leading-tight">
              {{ auth.user?.full_name }}
            </p>
            <p class="text-[12px] text-ink-4 truncate mt-0.5">
              {{ auth.user?.email }}
            </p>
          </div>
        </div>
        <p class="hidden lg:block text-[15px] font-bold text-ink tracking-[-0.2px]">
          Configuración
        </p>

        <!-- Sign out (mobile: compact icon next to profile) -->
        <button
          class="lg:hidden w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg text-ink-4 hover:text-failed-fg hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent"
          title="Cerrar sesión"
          @click="signOut"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line
              x1="21"
              y1="12"
              x2="9"
              y2="12"
            />
          </svg>
        </button>
      </div>

      <!-- Tab navigation: horizontal scroll on mobile, vertical list on desktop -->
      <nav class="flex lg:flex-col overflow-x-auto lg:overflow-y-auto lg:flex-1 gap-1 lg:gap-0 px-2 py-2">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="flex-shrink-0 lg:w-full flex items-center gap-2 lg:gap-2.5 px-3 py-2 lg:py-2.5 min-h-[44px] lg:min-h-0 rounded-xl lg:mb-0.5 whitespace-nowrap text-left border-none relative cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
          :class="
            activeTab === tab.key
              ? 'bg-bg-3 text-ink shadow-sm font-semibold'
              : 'bg-transparent text-ink-2 hover:bg-glass-hover hover:text-ink'
          "
          @click="activeTab = tab.key"
        >
          <!-- Active indicator bar (desktop only — mobile uses the fill instead) -->
          <div
            v-if="activeTab === tab.key"
            class="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-olive rounded-r"
          />
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            v-html="tab.iconPath"
          />
          <span class="text-[14px]">{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Sign out (desktop only) -->
      <div class="hidden lg:block px-2 py-3 border-t border-line flex-shrink-0">
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-ink-4 hover:text-failed-fg hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent"
          @click="signOut"
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
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line
              x1="21"
              y1="12"
              x2="9"
              y2="12"
            />
          </svg>
          <span class="text-[14px] font-medium">Cerrar sesión</span>
        </button>
      </div>
    </div>

    <!-- ── Right content area ─────────────────────────────────────────────── -->
    <div class="flex-1 overflow-hidden">
      <!-- Templates: full-height 2-panel layout (reuses NotificationTemplatesView) -->
      <NotificationTemplatesView v-if="activeTab === 'templates'" />

      <!-- Subscription / Billing: self-contained, own scroll wrapper -->
      <SubscriptionManager v-else-if="activeTab === 'subscription'" />
      <BillingManager v-else-if="activeTab === 'billing'" />

      <!-- Other tabs: centered scrollable content -->
      <div
        v-else
        class="h-full overflow-y-auto bg-bg"
      >
        <div class="max-w-2xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
          <!-- ── General ────────────────────────────────────────────────────── -->
          <template v-if="activeTab === 'general'">
            <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px] mb-6">
              General
            </h2>

            <!-- Language -->
            <section class="mb-8">
              <label class="block text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase mb-3">
                Idioma de la aplicación
              </label>
              <div class="flex gap-[3px] bg-glass border border-line rounded-lg p-0.5 w-fit">
                <button
                  v-for="l in ['es', 'en']"
                  :key="l"
                  class="px-5 py-2 rounded-[7px] border-none text-[14px] font-semibold cursor-pointer transition-all duration-150"
                  :class="locale === l ? 'bg-acid text-ink' : 'bg-transparent text-ink-3 hover:text-ink'"
                  @click="locale = l"
                >
                  {{ l === 'es' ? 'Español' : 'English' }}
                </button>
              </div>
              <p class="text-[12px] text-ink-4 mt-2">
                Cambia el idioma de la interfaz al instante, sin necesidad de recargar.
              </p>
            </section>

            <!-- Teléfono (WhatsApp) -->
            <section class="mb-8">
              <label
                for="settings-phone"
                class="block text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase mb-3"
              >
                {{ t('settings.phone') }}
              </label>
              <form
                class="flex flex-col sm:flex-row gap-2"
                data-test="phone-form"
                @submit.prevent="savePhone"
              >
                <input
                  id="settings-phone"
                  v-model="phone"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  :placeholder="t('settings.phonePlaceholder')"
                  class="flex-1 min-w-0 h-11 sm:h-9 px-3 rounded-sm bg-glass border border-line text-[15px] text-ink outline-none focus:border-line-acid"
                  data-test="phone-input"
                  @input="phoneSaved = false"
                >
                <button
                  type="submit"
                  class="h-11 sm:h-9 px-4 rounded-sm text-[14px] font-bold bg-acid text-ink border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="phoneSaving || !phoneDirty"
                  data-test="phone-save"
                >
                  {{ phoneSaving ? t('settings.phoneSaving') : t('settings.phoneSave') }}
                </button>
              </form>
              <p
                v-if="phoneError"
                class="text-[13px] text-failed-fg mt-2"
                data-test="phone-error"
              >
                {{ phoneError }}
              </p>
              <p
                v-else-if="phoneSaved"
                class="text-[13px] text-olive mt-2"
                data-test="phone-saved"
              >
                {{ t('settings.phoneSaved') }}
              </p>
              <p class="text-[12px] text-ink-4 mt-2">
                {{ t('settings.phoneHelp') }}
              </p>
            </section>

            <!-- Integrations -->
            <section class="mb-8">
              <label class="block text-[12px] font-bold text-ink-2 tracking-[0.6px] uppercase mb-3">
                {{ t('settings.integrations') }}
              </label>
              <div class="bg-glass border border-line rounded-xl overflow-hidden">
                <div
                  v-for="(int, idx) in integrations"
                  :key="int.name"
                  class="flex items-center justify-between px-4 py-3"
                  :class="idx < integrations.length - 1 ? 'border-b border-line' : ''"
                >
                  <span class="text-[15px] text-ink">{{ int.name }}</span>
                  <Pill :variant="int.variant">
                    {{ t(`settings.${int.label}`) }}
                  </Pill>
                </div>
              </div>
            </section>
          </template>

          <!-- ── Calendarios ─────────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'calendars'">
            <div class="mb-6">
              <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px]">
                {{ t('settings.calendars.title') }}
              </h2>
              <p class="text-[14px] text-ink-3 mt-1">
                {{ t('settings.calendars.sub') }}
              </p>
            </div>
            <GoogleConnectNotice />
            <GoogleConnectionCard @disconnected="calendarsKey++" />
            <CalendarsManager :key="calendarsKey" />
            <!-- F3 (A11): suscripciones iCal, independientes de Google. -->
            <IcalSubscriptionsManager />
          </template>

          <!-- ── Actividades ─────────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'activities'">
            <div class="mb-6">
              <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px]">
                Tipos de actividad
              </h2>
              <p class="text-[14px] text-ink-3 mt-1">
                Define los tipos de actividades disponibles para las giras.
              </p>
            </div>
            <ActivityTypesManager />
          </template>

          <!-- ── Recordatorios por tipo ─────────────────────────────────────── -->
          <template v-else-if="activeTab === 'reminders'">
            <div class="mb-6">
              <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px]">
                {{ t('reminders.templates.title') }}
              </h2>
              <p class="text-[14px] text-ink-3 mt-1">
                {{ t('reminders.templates.subtitle') }}
              </p>
            </div>
            <ReminderTemplatesManager />
          </template>

          <!-- ── Roles ──────────────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'roles'">
            <div class="mb-6">
              <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px]">
                Roles de contactos
              </h2>
              <p class="text-[14px] text-ink-3 mt-1">
                Organiza tus contactos por rol dentro de la producción.
              </p>
            </div>
            <RolesManager />
          </template>

          <!-- ── Grupos de notificación ─────────────────────────────────────── -->
          <template v-else-if="activeTab === 'groups'">
            <div class="mb-6">
              <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px]">
                Grupos de notificación
              </h2>
              <p class="text-[14px] text-ink-3 mt-1">
                Agrupa contactos para aplicarlos con un click al notificar una actividad.
              </p>
            </div>
            <NotificationGroupsManager />
          </template>

          <!-- ── Reglas de notificación ─────────────────────────────────────── -->
          <template v-else-if="activeTab === 'rules'">
            <div class="mb-6">
              <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px]">
                {{ t('rules.title') }}
              </h2>
              <p class="text-[14px] text-ink-3 mt-1">
                {{ t('rules.subtitle') }}
              </p>
            </div>
            <NotificationRulesManager />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
