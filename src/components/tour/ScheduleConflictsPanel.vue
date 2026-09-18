<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Pill from '@/components/ui/Pill.vue'
import { useScheduleConflicts, type ScheduleConflict } from '@/composables/useScheduleConflicts'

const props = defineProps<{ tourUuid: string }>()
const { t } = useI18n()
const api = useScheduleConflicts()

const conflicts = ref<ScheduleConflict[]>([])
const loading = ref(false)
const error = ref('')
const resolvingUuid = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    conflicts.value = await api.listConflicts(props.tourUuid)
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('tourHub.conflicts.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.tourUuid, load)

async function resolve(conflict: ScheduleConflict) {
  resolvingUuid.value = conflict.uuid
  try {
    await api.resolveConflict(props.tourUuid, conflict.uuid)
    conflicts.value = conflicts.value.filter((c) => c.uuid !== conflict.uuid)
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('tourHub.conflicts.loadError')
  } finally {
    resolvingUuid.value = null
  }
}
</script>

<template>
  <div>
    <div
      v-if="loading"
      class="flex items-center justify-center py-16"
    >
      <svg
        class="animate-spin text-ink-4"
        width="20"
        height="20"
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

    <div
      v-else-if="error"
      class="py-10 text-center"
    >
      <p class="text-[12px] text-red-400 mb-2">
        {{ error }}
      </p>
      <button
        class="text-[11px] text-ink-3 hover:text-ink cursor-pointer border-none bg-transparent underline"
        @click="load"
      >
        Reintentar
      </button>
    </div>

    <div
      v-else-if="!conflicts.length"
      class="py-10 text-center"
    >
      <p class="text-[12px] text-ink-3">
        {{ t('tourHub.conflicts.empty') }}
      </p>
    </div>

    <div
      v-else
      class="space-y-2"
    >
      <div
        v-for="conflict in conflicts"
        :key="conflict.uuid"
        class="bg-bg-3 border border-line rounded-lg p-3.5 flex items-start gap-3"
      >
        <div
          class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
          style="background: rgba(232,93,0,0.15); color: #e85d00"
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
          ><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line
            x1="12"
            y1="9"
            x2="12"
            y2="13"
          /><line
            x1="12"
            y1="17"
            x2="12.01"
            y2="17"
          /></svg>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <Pill variant="o">
              {{ conflict.conflict_type_display }}
            </Pill>
          </div>
          <p class="text-[12px] text-ink leading-relaxed">
            {{ conflict.description }}
          </p>
        </div>

        <button
          class="flex-shrink-0 px-3 py-1.5 rounded text-[11px] font-medium bg-glass border border-line text-ink-2 hover:bg-glass-hover transition-colors cursor-pointer disabled:opacity-40"
          :disabled="resolvingUuid === conflict.uuid"
          @click="resolve(conflict)"
        >
          {{ resolvingUuid === conflict.uuid ? t('tourHub.conflicts.resolving') : t('tourHub.conflicts.resolve') }}
        </button>
      </div>
    </div>
  </div>
</template>
