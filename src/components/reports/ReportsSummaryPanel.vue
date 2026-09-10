<script setup lang="ts">
import SummaryDonut from './SummaryDonut.vue'

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
  title: string
}>()
</script>

<template>
  <div
    class="relative overflow-hidden rounded-lg shadow-[0_10px_30px_var(--acid-glow)] p-5"
    style="background: linear-gradient(135deg, var(--acid-muted), var(--acid-light))"
  >
    <!-- Glossy diagonal sheen -->
    <div
      class="pointer-events-none absolute inset-0"
      style="background: linear-gradient(120deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 40%)"
    />

    <p class="relative text-[9px] font-bold text-black/70 tracking-[1px] uppercase mb-4">{{ title }}</p>

    <div class="relative">
      <SummaryDonut
        :percentage="openRate"
        :center-value="`${openRate}%`"
        :center-label="labels.openRate"
        color="#000000"
        track-color="rgba(0,0,0,0.15)"
        value-color="#000000"
        label-color="rgba(0,0,0,0.65)"
      />

      <div class="mt-5 space-y-3">
        <div class="flex items-center justify-between text-[12px]">
          <span class="text-black/65">{{ labels.totalSent }}</span>
          <span class="font-semibold text-black">{{ totalSent.toLocaleString() }}</span>
        </div>
        <div class="flex items-center justify-between text-[12px]">
          <span class="text-black/65">{{ labels.clickRate }}</span>
          <span class="font-semibold text-black">{{ clickRate }}%</span>
        </div>
        <div class="flex items-center justify-between text-[12px]">
          <span class="text-black/65">{{ labels.totalContacts }}</span>
          <span class="font-semibold text-black">{{ totalContacts.toLocaleString() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
