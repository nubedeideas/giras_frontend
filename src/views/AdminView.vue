<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SubscriptionsTab from '@/components/admin/SubscriptionsTab.vue'
import PlansTab from '@/components/admin/PlansTab.vue'
import CustomPoolsTab from '@/components/admin/CustomPoolsTab.vue'
import PaymentsTab from '@/components/admin/PaymentsTab.vue'
import UsageLogTab from '@/components/admin/UsageLogTab.vue'
import AllowlistTab from '@/components/admin/AllowlistTab.vue'
import { useNoIndex } from '@/composables/usePageMeta'

useNoIndex()

type AdminTab = 'subscriptions' | 'plans' | 'pools' | 'payments' | 'usage' | 'allowlist'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const TABS: { key: AdminTab; label: string; iconPath: string }[] = [
  {
    key: 'subscriptions',
    label: 'Suscripciones',
    iconPath: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  },
  {
    key: 'plans',
    label: 'Planes',
    iconPath: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  },
  {
    key: 'pools',
    label: 'Cupos Custom',
    iconPath: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>`,
  },
  {
    key: 'payments',
    label: 'Pagos',
    iconPath: `<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>`,
  },
  {
    key: 'usage',
    label: 'Log de Uso',
    iconPath: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`,
  },
  {
    key: 'allowlist',
    label: 'Acceso',
    iconPath: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  },
]

const activeTab = computed<AdminTab>({
  get: () => (route.query.tab as AdminTab | undefined) ?? 'subscriptions',
  set: (tab) => router.replace({ path: '/admin', query: { tab } }),
})

async function signOut() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="flex flex-col lg:flex-row h-screen overflow-hidden bg-bg">
    <!-- ── Left sidebar / mobile top bar ───────────────────────────────────── -->
    <div class="flex-shrink-0 bg-bg-2 border-b lg:border-b-0 lg:border-r border-line flex flex-col overflow-hidden lg:w-56">
      <!-- Header -->
      <div class="px-4 pt-5 pb-4 border-b border-line flex-shrink-0">
        <RouterLink
          to="/home"
          class="inline-flex items-center gap-1.5 text-[11px] text-ink-4 hover:text-ink no-underline mb-3"
        >
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Volver al dashboard
        </RouterLink>
        <p class="text-[15px] font-bold text-ink tracking-[-0.2px]">
          Panel Admin
        </p>
        <p class="text-[10px] text-ink-4 truncate mt-0.5">
          {{ auth.user?.email }}
        </p>
      </div>

      <!-- Tab navigation -->
      <nav class="flex lg:flex-col overflow-x-auto lg:overflow-y-auto lg:flex-1 gap-1 lg:gap-0 px-2 py-2">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="flex-shrink-0 lg:w-full flex items-center gap-2 lg:gap-2.5 px-3 py-2 lg:py-2.5 rounded-xl lg:mb-0.5 whitespace-nowrap text-left border-none relative cursor-pointer transition-all duration-150"
          :class="
            activeTab === tab.key
              ? 'bg-glass-active text-acid'
              : 'bg-transparent text-ink-3 hover:bg-glass-hover hover:text-ink-2'
          "
          @click="activeTab = tab.key"
        >
          <div
            v-if="activeTab === tab.key"
            class="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-acid rounded-r"
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

      <!-- Sign out (desktop only) -->
      <div class="hidden lg:block px-2 py-3 border-t border-line flex-shrink-0">
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
            <line
              x1="21"
              y1="12"
              x2="9"
              y2="12"
            />
          </svg>
          <span class="text-[12px] font-medium">Cerrar sesión</span>
        </button>
      </div>
    </div>

    <!-- ── Right content area ─────────────────────────────────────────────── -->
    <div class="flex-1 overflow-hidden bg-bg-3">
      <SubscriptionsTab v-if="activeTab === 'subscriptions'" />
      <PlansTab v-else-if="activeTab === 'plans'" />
      <CustomPoolsTab v-else-if="activeTab === 'pools'" />
      <PaymentsTab v-else-if="activeTab === 'payments'" />
      <UsageLogTab v-else-if="activeTab === 'usage'" />
      <AllowlistTab v-else-if="activeTab === 'allowlist'" />
    </div>
  </div>
</template>
