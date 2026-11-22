<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import DashboardBlock from './DashboardBlock.vue'
import InboxItemRow from '@/components/inbox/InboxItemRow.vue'
import { useToursStore } from '@/stores/tours'
import { useInboxStore } from '@/stores/inbox'
import { inboxApi, type InboxItem } from '@/composables/useInbox'
import { goToInboxTarget } from '@/utils/inbox'

/**
 * "Bandeja": los 5 últimos de la gira, con una llamada propia (no usa la lista del panel del
 * store, que tiene su propio filtro y paginación). No se monta en modo demo.
 */
const PAGE_SIZE = 5

const { t } = useI18n()
const router = useRouter()
const tours = useToursStore()
const inbox = useInboxStore()

const items = ref<InboxItem[]>([])
const loading = ref(false)
const error = ref(false)

let request = 0

/** `quiet`: recarga tras descartar, sin esqueleto ni vaciar la lista; si falla, se queda así. */
async function load(uuid: string | null, { quiet = false }: { quiet?: boolean } = {}) {
  const req = ++request
  if (!quiet) {
    items.value = []
    error.value = false
  }
  if (!uuid) {
    loading.value = false
    return
  }
  loading.value = !quiet
  try {
    const page = await inboxApi.listInbox({ tour: uuid, pageSize: PAGE_SIZE })
    if (req !== request) return
    items.value = (page.results ?? []).slice(0, PAGE_SIZE)
  } catch {
    if (req !== request) return
    if (!quiet) error.value = true
  } finally {
    if (req === request) loading.value = false
  }
}

watch(
  () => tours.activeTour?.uuid ?? null,
  (uuid) => void load(uuid),
  { immediate: true }
)

/** Marca leído con el store (optimista, revierte y ajusta el contador) y navega al destino. */
async function onActivate(item: InboxItem) {
  if (!item.is_read) void inbox.markRead(item).catch(() => undefined)
  try {
    await goToInboxTarget(item, router, tours)
  } catch {
    // Navegación cancelada o duplicada: no hay nada que mostrar.
  }
}

/**
 * Descarta con el store (optimista, contador y reversión de su lista) y vuelve a pedir los 5
 * últimos: rellena el hueco y, si el descarte falló, el aviso vuelve a aparecer.
 */
async function onDismiss(item: InboxItem) {
  const uuid = tours.activeTour?.uuid ?? null
  items.value = items.value.filter((i) => i.uuid !== item.uuid)
  try {
    await inbox.dismiss(item)
  } catch {
    // `dismiss` ya gestiona sus errores (actionError); la recarga deja la lista como esté.
  }
  if (uuid !== (tours.activeTour?.uuid ?? null)) return
  await load(uuid, { quiet: true })
}

</script>

<template>
  <DashboardBlock
    :title="t('dashboard.inbox.title')"
    :count="items.filter((i) => !i.is_read).length"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && items.length === 0"
    data-testid="dashboard-inbox"
    @retry="load(tours.activeTour?.uuid ?? null)"
  >
    <template #action>
      <button
        type="button"
        class="inline-flex items-center min-h-[44px] lg:min-h-0 px-1 text-[14px] font-semibold text-olive hover:text-olive-strong bg-transparent border-none cursor-pointer"
        @click="inbox.open()"
      >
        {{ t('dashboard.inbox.open') }}
      </button>
    </template>

    <template #empty>
      <p class="min-h-[44px] flex items-center text-[15px] text-ink-2">
        {{ t('dashboard.inbox.empty') }}
      </p>
    </template>

    <ul class="flex flex-col gap-1.5">
      <InboxItemRow
        v-for="item in items"
        :key="item.uuid"
        :item="item"
        @activate="onActivate"
        @dismiss="onDismiss"
      />
    </ul>
  </DashboardBlock>
</template>
