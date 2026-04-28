<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_CHANNEL_LABELS,
  TEMPLATE_CHANNEL_COLORS,
  TEMPLATE_TYPES,
  TEMPLATE_CHANNELS,
  type NotificationTemplateListItem,
  type TemplateType,
  type TemplateChannel,
} from '@/composables/useNotificationTemplates'

const props = defineProps<{
  templates: NotificationTemplateListItem[]
  loading: boolean
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [uuid: string]
  create: []
}>()

const filterType = ref<TemplateType | ''>('')
const filterChannel = ref<TemplateChannel | ''>('')
const filterActive = ref<'' | 'true' | 'false'>('')

const filtered = computed(() => {
  return props.templates.filter((t) => {
    if (filterType.value && t.notification_type !== filterType.value) return false
    if (filterChannel.value && t.channel !== filterChannel.value) return false
    if (filterActive.value === 'true' && !t.is_active) return false
    if (filterActive.value === 'false' && t.is_active) return false
    return true
  })
})

const hasFilters = computed(
  () => filterType.value !== '' || filterChannel.value !== '' || filterActive.value !== '',
)

function clearFilters() {
  filterType.value = ''
  filterChannel.value = ''
  filterActive.value = ''
}

const selectClass =
  'bg-bg-3 border border-line rounded-lg px-2 py-1.5 text-[11px] text-ink outline-none focus:border-line-2 transition-colors cursor-pointer flex-1'
</script>

<template>
  <div class="w-80 flex-shrink-0 bg-bg-2 border-r border-line flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="px-3.5 pt-[18px] pb-2.5 border-b border-line flex-shrink-0">
      <div class="flex items-center justify-between mb-3">
        <p class="text-base font-bold tracking-[-0.2px] text-ink">Templates</p>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-acid text-black text-[11px] font-semibold cursor-pointer border-none hover:brightness-105 transition-all"
          @click="emit('create')"
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo
        </button>
      </div>

      <!-- Filters -->
      <div class="space-y-1.5">
        <div class="flex gap-1.5">
          <select v-model="filterType" :class="selectClass">
            <option value="">Todos los tipos</option>
            <option v-for="t in TEMPLATE_TYPES" :key="t" :value="t">
              {{ TEMPLATE_TYPE_LABELS[t] }}
            </option>
          </select>
        </div>
        <div class="flex gap-1.5">
          <select v-model="filterChannel" :class="selectClass">
            <option value="">Todos los canales</option>
            <option v-for="c in TEMPLATE_CHANNELS" :key="c" :value="c">
              {{ TEMPLATE_CHANNEL_LABELS[c] }}
            </option>
          </select>
          <select v-model="filterActive" :class="selectClass" style="max-width: 100px">
            <option value="">Estado</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
        <button
          v-if="hasFilters"
          class="text-[10px] text-ink-4 hover:text-ink-2 transition-colors border-none bg-transparent cursor-pointer p-0"
          @click="clearFilters"
        >
          ✕ Limpiar filtros
        </button>
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto px-2 py-2">
      <div v-if="loading" class="flex justify-center py-8">
        <svg
          class="animate-spin text-ink-4"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="3"
            stroke-dasharray="40 22"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <template v-else>
        <button
          v-for="t in filtered"
          :key="t.uuid"
          class="w-full text-left px-3 py-2.5 rounded-xl mb-1 border transition-all duration-150 cursor-pointer"
          :class="
            selectedId === t.uuid
              ? 'bg-glass-active border-line-acid'
              : 'bg-glass border-line hover:bg-glass-hover hover:border-line-2'
          "
          @click="emit('select', t.uuid)"
        >
          <!-- Name row -->
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <p
              class="text-[12px] font-semibold text-ink leading-tight"
              :class="!t.is_active ? 'opacity-50' : ''"
            >
              {{ t.name }}
            </p>
            <div class="flex items-center gap-1 flex-shrink-0">
              <!-- Default badge -->
              <span
                v-if="t.is_default"
                class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-acid/15 text-acid leading-none"
              >
                ★
              </span>
              <!-- Active / inactive dot -->
              <span
                class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                :class="t.is_active ? 'bg-[#34d399]' : 'bg-ink-4'"
              />
            </div>
          </div>

          <!-- Type label -->
          <p class="text-[10px] text-ink-3 mb-1.5 truncate">
            {{ TEMPLATE_TYPE_LABELS[t.notification_type] }}
          </p>

          <!-- Channel pill -->
          <span
            class="inline-flex items-center text-[9px] font-semibold px-2 py-0.5 rounded-full"
            :style="{
              background: TEMPLATE_CHANNEL_COLORS[t.channel].bg,
              color: TEMPLATE_CHANNEL_COLORS[t.channel].text,
            }"
          >
            {{ TEMPLATE_CHANNEL_LABELS[t.channel] }}
          </span>
        </button>

        <div v-if="filtered.length === 0" class="text-center py-8 text-ink-4 text-xs">
          {{ hasFilters ? 'Sin templates con estos filtros' : 'Sin templates creados' }}
        </div>
      </template>
    </div>
  </div>
</template>
