<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * Tarjeta común de los bloques del dashboard: título, contador opcional, acción en la cabecera y
 * los estados de carga (esqueleto), error (con "Reintentar") y vacío.
 */
withDefaults(
  defineProps<{
    title: string
    count?: number | null
    loading?: boolean
    error?: boolean
    empty?: boolean
    /** Texto del error; por defecto, `dashboard.loadError`. */
    errorText?: string
  }>(),
  { count: null, loading: false, error: false, empty: false, errorText: '' }
)
const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
</script>

<template>
  <section class="min-w-0 bg-bg-3 border border-line rounded-2xl p-4 lg:p-5">
    <header class="flex items-center gap-2 mb-3 min-h-[28px]">
      <h3 class="text-[13px] font-bold text-ink-2 tracking-[1px] uppercase truncate">
        {{ title }}
      </h3>
      <span
        v-if="count !== null && count > 0"
        data-testid="block-count"
        class="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-pending-bg text-pending-fg text-[12px] font-bold font-time tnum"
      >{{ count }}</span>
      <div class="ml-auto flex-shrink-0">
        <slot name="action" />
      </div>
    </header>

    <div
      v-if="loading"
      data-testid="block-loading"
      class="flex flex-col gap-2.5"
      aria-busy="true"
    >
      <div
        v-for="i in 3"
        :key="i"
        class="h-[44px] rounded-lg bg-bg-4 animate-pulse motion-reduce:animate-none"
      />
    </div>

    <div
      v-else-if="error"
      data-testid="block-error"
      class="flex flex-wrap items-center gap-3"
      role="alert"
    >
      <p class="text-[15px] text-failed-fg flex-1 min-w-0">
        {{ errorText || t('dashboard.loadError') }}
      </p>
      <button
        type="button"
        data-testid="block-retry"
        class="min-h-[44px] px-4 rounded-sm bg-bg-3 border border-line-2 text-ink text-[14px] font-medium cursor-pointer hover:bg-glass-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive"
        @click="emit('retry')"
      >
        {{ t('dashboard.retry') }}
      </button>
    </div>

    <div
      v-else-if="empty"
      data-testid="block-empty"
    >
      <slot name="empty" />
    </div>

    <slot v-else />
  </section>
</template>
