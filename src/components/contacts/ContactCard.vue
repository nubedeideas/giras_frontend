<script setup lang="ts">
import type { Contact } from '@/types'

defineProps<{ contact: Contact; selected: boolean }>()
const emit = defineEmits<{ select: [uuid: string] }>()
</script>

<template>
  <div
    class="flex items-center gap-2.5 px-2.5 py-2.5 rounded cursor-pointer transition-all duration-150 border mb-1"
    :class="
      selected
        ? 'bg-glass-active border-line-acid'
        : 'bg-glass border-line hover:bg-glass-2 hover:border-line-2'
    "
    @click="emit('select', contact.uuid)"
  >
    <!-- Left bar when selected -->
    <div
      v-if="selected"
      class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-acid rounded-r"
    />

    <div class="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-line">
      <img
        v-if="contact.avatar"
        :src="contact.avatar"
        :alt="contact.full_name"
        class="w-full h-full object-cover"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center text-[13px] font-bold text-ink-2"
        :style="{ background: contact.role?.color ?? 'var(--avatar-bg)' }"
      >
        {{ contact.first_name.charAt(0) }}{{ contact.last_name.charAt(0) }}
      </div>

      <!-- Favorite star -->
      <div
        v-if="contact.is_favorite"
        class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-acid border-2 border-bg-2 flex items-center justify-center"
        title="Favorito"
      />
      <!-- Emergency indicator (no favorite) -->
      <div
        v-else-if="contact.is_emergency"
        class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-bg-2"
        style="background: #e85d00"
        title="Emergencia"
      />
    </div>

    <div class="flex-1 min-w-0">
      <p class="text-[12px] font-semibold text-ink truncate">{{ contact.full_name }}</p>
      <div class="flex items-center gap-1.5 mt-px">
        <div
          v-if="contact.role"
          class="w-1.5 h-1.5 rounded-full flex-shrink-0"
          :style="{ background: contact.role.color }"
        />
        <p class="text-[10px] text-ink-3 truncate">
          {{ contact.role?.name ?? contact.job_title ?? '—' }}
        </p>
      </div>
    </div>
  </div>
</template>
