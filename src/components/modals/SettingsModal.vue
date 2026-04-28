<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppModal from '@/components/ui/AppModal.vue'
import Pill from '@/components/ui/Pill.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import RolesManager from '@/components/settings/RolesManager.vue'
import ActivityTypesManager from '@/components/settings/ActivityTypesManager.vue'
import CalendarsManager from '@/components/settings/CalendarsManager.vue'

type SettingsTab = 'general' | 'roles' | 'activities' | 'calendars'

const props = defineProps<{ show: boolean; initialTab?: SettingsTab }>()
const emit = defineEmits<{ close: [] }>()

const { t, locale } = useI18n()
const auth = useAuthStore()
const router = useRouter()

const activeTab = ref<SettingsTab>('general')

watch(
  () => props.show,
  (v) => { if (v && props.initialTab) activeTab.value = props.initialTab },
)

const integrations = [
  { name: 'Google Calendar', variant: 'g' as const, label: 'active' },
  { name: 'WhatsApp (Twilio)', variant: 'g' as const, label: 'active' },
  { name: 'Mailgun (Email)', variant: 'n' as const, label: 'configure' },
  { name: 'Apple Wallet Pass', variant: 'o' as const, label: 'beta' },
]

function signOut() {
  auth.logout()
  emit('close')
  router.push('/login')
}
</script>

<template>
  <AppModal :show="show" @close="emit('close')">
    <button
      class="absolute top-3.5 right-3.5 flex items-center justify-center w-[26px] h-[26px] rounded-[7px] border border-line bg-glass text-ink-2 cursor-pointer hover:bg-glass-hover hover:text-ink"
      @click="emit('close')"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <!-- User profile -->
    <div class="flex items-center gap-3 mb-5">
      <div
        class="w-11 h-11 rounded-full border-2 border-acid flex-shrink-0 overflow-hidden flex items-center justify-center text-[15px] font-bold text-black"
        :style="{ background: auth.user?.avatar ? 'transparent' : 'var(--acid)' }"
      >
        <img v-if="auth.user?.avatar" :src="auth.user.avatar" class="w-full h-full object-cover" :alt="auth.user.full_name" />
        <span v-else>{{ auth.user?.first_name?.charAt(0) }}{{ auth.user?.last_name?.charAt(0) }}</span>
      </div>
      <div class="flex-1">
        <p class="font-bold text-[14px] text-ink">{{ auth.user?.full_name }}</p>
        <p class="text-[11px] text-ink-2">{{ auth.user?.email }} · {{ t('settings.profile') }}</p>
      </div>
      <!-- Lang toggle -->
      <div class="flex gap-[3px] bg-glass border border-line rounded-[7px] p-0.5 ml-auto flex-shrink-0">
        <button
          v-for="l in ['es', 'en']"
          :key="l"
          class="px-2 py-[3px] rounded-[5px] border-none text-[10px] font-semibold cursor-pointer transition-all duration-150 tracking-[0.3px]"
          :class="locale === l ? 'bg-acid text-black' : 'bg-transparent text-ink-3'"
          @click="locale = l"
        >
          {{ l.toUpperCase() }}
        </button>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="flex gap-[3px] bg-glass border border-line rounded-[7px] p-0.5 mb-5">
      <button
        v-for="tab in [
          { key: 'general', label: 'General' },
          { key: 'roles', label: 'Roles' },
          { key: 'activities', label: 'Actividades' },
          { key: 'calendars', label: 'Calendarios' },
        ]"
        :key="tab.key"
        class="flex-1 py-[5px] rounded-[5px] border-none text-[11px] font-semibold cursor-pointer transition-all duration-150"
        :class="activeTab === tab.key ? 'bg-acid text-black' : 'bg-transparent text-ink-3 hover:text-ink'"
        @click="activeTab = tab.key as SettingsTab"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- ── General tab ─────────────────────────────────────────────────────── -->
    <template v-if="activeTab === 'general'">
      <!-- Integrations -->
      <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-2">
        {{ t('settings.integrations') }}
      </label>
      <div class="bg-glass border border-line rounded px-3.5 py-1 mb-4">
        <div
          v-for="(int, idx) in integrations"
          :key="int.name"
          class="flex items-center justify-between py-2.5"
          :class="idx < integrations.length - 1 ? 'border-b border-line' : ''"
        >
          <span class="text-[12px] text-ink">{{ int.name }}</span>
          <Pill :variant="int.variant">{{ t(`settings.${int.label}`) }}</Pill>
        </div>
      </div>

      <BtnSecondary full @click="signOut">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        {{ t('settings.signOut') }}
      </BtnSecondary>
    </template>

    <!-- ── Roles tab ───────────────────────────────────────────────────────── -->
    <template v-else-if="activeTab === 'roles'">
      <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-2">
        Roles de contactos
      </label>
      <RolesManager />
    </template>

    <!-- ── Activities tab ─────────────────────────────────────────────────── -->
    <template v-else-if="activeTab === 'activities'">
      <label class="text-[9px] font-bold text-ink-2 tracking-[0.6px] uppercase block mb-2">
        Tipos de actividad
      </label>
      <ActivityTypesManager />
    </template>

    <!-- ── Calendars tab ───────────────────────────────────────────────────── -->
    <template v-else-if="activeTab === 'calendars'">
      <CalendarsManager />
    </template>
  </AppModal>
</template>
