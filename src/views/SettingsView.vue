<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import Pill from '@/components/ui/Pill.vue'
import RolesManager from '@/components/settings/RolesManager.vue'
import ActivityTypesManager from '@/components/settings/ActivityTypesManager.vue'
import CalendarsManager from '@/components/settings/CalendarsManager.vue'
import NotificationTemplatesView from '@/views/NotificationTemplatesView.vue'

type SettingsTab = 'general' | 'calendars' | 'activities' | 'roles' | 'templates'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const auth = useAuthStore()
const uiStore = useUIStore()

const TABS: { key: SettingsTab; label: string; iconPath: string }[] = [
  {
    key: 'general',
    label: 'General',
    iconPath: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  },
  {
    key: 'calendars',
    label: 'Calendarios',
    iconPath: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  },
  {
    key: 'activities',
    label: 'Actividades',
    iconPath: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`,
  },
  {
    key: 'roles',
    label: 'Roles',
    iconPath: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  },
  {
    key: 'templates',
    label: 'Templates',
    iconPath: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  },
]

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

function signOut() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- ── Left sidebar ─────────────────────────────────────────────────────── -->
    <div class="w-52 flex-shrink-0 bg-bg-2 border-r border-line flex flex-col overflow-hidden">
      <!-- User profile block -->
      <div class="px-4 pt-5 pb-4 border-b border-line flex-shrink-0">
        <div class="flex items-center gap-2.5 mb-3">
          <div
            class="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[13px] font-bold text-black border-2 border-acid"
            :style="{ background: auth.user?.avatar ? 'transparent' : 'var(--acid)' }"
          >
            <img
              v-if="auth.user?.avatar"
              :src="auth.user.avatar"
              class="w-full h-full object-cover"
              :alt="auth.user.full_name"
            />
            <span v-else>
              {{ auth.user?.first_name?.charAt(0) }}{{ auth.user?.last_name?.charAt(0) }}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[12px] font-bold text-ink truncate leading-tight">
              {{ auth.user?.full_name }}
            </p>
            <p class="text-[10px] text-ink-4 truncate mt-0.5">{{ auth.user?.email }}</p>
          </div>
        </div>
        <p class="text-[13px] font-bold text-ink tracking-[-0.2px]">Configuración</p>
      </div>

      <!-- Tab navigation -->
      <nav class="flex-1 overflow-y-auto py-2 px-2">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-0.5 text-left border-none relative cursor-pointer transition-all duration-150"
          :class="
            activeTab === tab.key
              ? 'bg-glass-active text-acid'
              : 'bg-transparent text-ink-3 hover:bg-glass-hover hover:text-ink-2'
          "
          @click="activeTab = tab.key"
        >
          <!-- Active indicator bar -->
          <div
            v-if="activeTab === tab.key"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-acid rounded-r"
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
          <span class="text-[12px] font-medium">{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Sign out -->
      <div class="px-2 py-3 border-t border-line flex-shrink-0">
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-ink-4 hover:text-red-400 hover:bg-glass-hover transition-colors cursor-pointer border-none bg-transparent"
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
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span class="text-[12px] font-medium">Cerrar sesión</span>
        </button>
      </div>
    </div>

    <!-- ── Right content area ─────────────────────────────────────────────── -->
    <div class="flex-1 overflow-hidden">
      <!-- Templates: full-height 2-panel layout (reuses NotificationTemplatesView) -->
      <NotificationTemplatesView v-if="activeTab === 'templates'" />

      <!-- Other tabs: centered scrollable content -->
      <div v-else class="h-full overflow-y-auto bg-bg-3">
        <div class="max-w-2xl mx-auto px-8 py-8">

          <!-- ── General ────────────────────────────────────────────────────── -->
          <template v-if="activeTab === 'general'">
            <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px] mb-6">General</h2>

            <!-- Language -->
            <section class="mb-8">
              <label class="block text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-3">
                Idioma de la aplicación
              </label>
              <div class="flex gap-[3px] bg-glass border border-line rounded-lg p-0.5 w-fit">
                <button
                  v-for="l in ['es', 'en']"
                  :key="l"
                  class="px-5 py-2 rounded-[7px] border-none text-[12px] font-semibold cursor-pointer transition-all duration-150"
                  :class="locale === l ? 'bg-acid text-black' : 'bg-transparent text-ink-3 hover:text-ink'"
                  @click="locale = l"
                >
                  {{ l === 'es' ? 'Español' : 'English' }}
                </button>
              </div>
              <p class="text-[10px] text-ink-4 mt-2">
                Cambia el idioma de la interfaz al instante, sin necesidad de recargar.
              </p>
            </section>

            <!-- Appearance -->
            <section class="mb-8">
              <label class="block text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-3">
                Apariencia
              </label>

              <!-- Theme picker -->
              <div class="bg-glass border border-line rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <p class="text-[13px] font-semibold text-ink">Tema de color</p>
                    <p class="text-[10px] text-ink-4 mt-0.5">
                      La barra de navegación siempre permanece en modo oscuro.
                    </p>
                  </div>
                </div>

                <!-- Theme option cards -->
                <div class="grid grid-cols-2 gap-2.5">
                  <!-- Dark option -->
                  <button
                    class="relative rounded-xl border-2 p-3 cursor-pointer transition-all text-left overflow-hidden"
                    :class="uiStore.theme === 'dark'
                      ? 'border-acid bg-acid/8'
                      : 'border-line bg-glass hover:border-line-2'"
                    @click="uiStore.setTheme('dark')"
                  >
                    <!-- Mini preview -->
                    <div class="rounded-lg overflow-hidden mb-2.5 border border-white/10" style="background: #111115; height: 52px; display: flex;">
                      <!-- Sidebar strip -->
                      <div style="width: 12px; background: #0c0c0f; border-right: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;" />
                      <!-- Content area -->
                      <div class="flex-1 p-1.5 flex flex-col gap-1">
                        <div style="height: 5px; width: 55%; background: rgba(255,255,255,0.12); border-radius: 3px;" />
                        <div style="height: 4px; width: 40%; background: rgba(255,255,255,0.07); border-radius: 3px;" />
                        <div class="flex gap-1 mt-0.5">
                          <div style="height: 14px; flex: 1; background: rgba(255,255,255,0.06); border-radius: 4px;" />
                          <div style="height: 14px; flex: 1; background: rgba(255,255,255,0.06); border-radius: 4px;" />
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-[12px] font-semibold text-ink">Oscuro</span>
                      <!-- Checkmark -->
                      <span
                        v-if="uiStore.theme === 'dark'"
                        class="w-4 h-4 rounded-full bg-acid flex items-center justify-center flex-shrink-0"
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </span>
                      <span v-else class="w-4 h-4 rounded-full border border-line-2 flex-shrink-0" />
                    </div>
                  </button>

                  <!-- Light option -->
                  <button
                    class="relative rounded-xl border-2 p-3 cursor-pointer transition-all text-left overflow-hidden"
                    :class="uiStore.theme === 'light'
                      ? 'border-acid bg-acid/8'
                      : 'border-line bg-glass hover:border-line-2'"
                    @click="uiStore.setTheme('light')"
                  >
                    <!-- Mini preview -->
                    <div class="rounded-lg overflow-hidden mb-2.5 border border-black/8" style="background: #eaeaef; height: 52px; display: flex;">
                      <!-- Sidebar strip (always dark) -->
                      <div style="width: 12px; background: #0c0c0f; border-right: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;" />
                      <!-- Content area -->
                      <div class="flex-1 p-1.5 flex flex-col gap-1">
                        <div style="height: 5px; width: 55%; background: rgba(0,0,0,0.15); border-radius: 3px;" />
                        <div style="height: 4px; width: 40%; background: rgba(0,0,0,0.09); border-radius: 3px;" />
                        <div class="flex gap-1 mt-0.5">
                          <div style="height: 14px; flex: 1; background: #ffffff; border-radius: 4px;" />
                          <div style="height: 14px; flex: 1; background: #ffffff; border-radius: 4px;" />
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-[12px] font-semibold text-ink">Claro</span>
                      <span
                        v-if="uiStore.theme === 'light'"
                        class="w-4 h-4 rounded-full bg-acid flex items-center justify-center flex-shrink-0"
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </span>
                      <span v-else class="w-4 h-4 rounded-full border border-line-2 flex-shrink-0" />
                    </div>
                  </button>
                </div>
              </div>
            </section>

            <!-- Integrations -->
            <section class="mb-8">
              <label class="block text-[10px] font-bold text-ink-3 tracking-[0.6px] uppercase mb-3">
                {{ t('settings.integrations') }}
              </label>
              <div class="bg-glass border border-line rounded-xl overflow-hidden">
                <div
                  v-for="(int, idx) in integrations"
                  :key="int.name"
                  class="flex items-center justify-between px-4 py-3"
                  :class="idx < integrations.length - 1 ? 'border-b border-line' : ''"
                >
                  <span class="text-[13px] text-ink">{{ int.name }}</span>
                  <Pill :variant="int.variant">{{ t(`settings.${int.label}`) }}</Pill>
                </div>
              </div>
            </section>
          </template>

          <!-- ── Calendarios ─────────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'calendars'">
            <div class="mb-6">
              <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px]">Calendarios</h2>
              <p class="text-[12px] text-ink-3 mt-1">
                Conecta Google Calendars para sincronizar eventos automáticamente.
              </p>
            </div>
            <CalendarsManager />
          </template>

          <!-- ── Actividades ─────────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'activities'">
            <div class="mb-6">
              <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px]">Tipos de actividad</h2>
              <p class="text-[12px] text-ink-3 mt-1">
                Define los tipos de actividades disponibles para las giras.
              </p>
            </div>
            <ActivityTypesManager />
          </template>

          <!-- ── Roles ──────────────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'roles'">
            <div class="mb-6">
              <h2 class="text-[16px] font-bold text-ink tracking-[-0.3px]">Roles de contactos</h2>
              <p class="text-[12px] text-ink-3 mt-1">
                Organiza tus contactos por rol dentro de la producción.
              </p>
            </div>
            <RolesManager />
          </template>

        </div>
      </div>
    </div>
  </div>
</template>
