<script setup lang="ts">
defineProps<{
  totalSent: number
  openRate: number
  clickRate: number
  totalContacts: number
  labels: {
    totalSent: string
    openRate: string
    clickRate: string
    totalContacts: string
  }
}>()
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
    <div class="bg-glass border border-line rounded p-4">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-8 h-8 rounded-lg bg-acid-dim flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-acid-muted">
            <path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/>
          </svg>
        </div>
        <p class="text-[11px] text-ink-3">{{ labels.totalSent }}</p>
      </div>
      <p class="text-[28px] font-bold tracking-[-1px] text-acid">{{ totalSent.toLocaleString() }}</p>
    </div>

    <div class="bg-glass border border-line rounded p-4">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-8 h-8 rounded-lg bg-brand-blue-dim flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-brand-blue">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <p class="text-[11px] text-ink-3">{{ labels.openRate }}</p>
      </div>
      <p class="text-[28px] font-bold tracking-[-1px] text-brand-blue">{{ openRate }}%</p>
    </div>

    <div class="bg-glass border border-line rounded p-4">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-8 h-8 rounded-lg bg-brand-orange-dim flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-brand-orange">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <p class="text-[11px] text-ink-3">{{ labels.clickRate }}</p>
      </div>
      <p class="text-[28px] font-bold tracking-[-1px] text-brand-orange">{{ clickRate }}%</p>
    </div>

    <div class="bg-glass border border-line rounded p-4">
      <div class="flex items-center gap-2 mb-3">
        <div class="w-8 h-8 rounded-lg bg-wa-green-dim flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-wa-green">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <p class="text-[11px] text-ink-3">{{ labels.totalContacts }}</p>
      </div>
      <p class="text-[28px] font-bold tracking-[-1px] text-wa-green">{{ totalContacts }}</p>
    </div>
  </div>
</template>
