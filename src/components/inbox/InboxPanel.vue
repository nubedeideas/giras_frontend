<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useInboxStore, type InboxFilter } from '@/stores/inbox'
import { useToursStore } from '@/stores/tours'
import type { InboxItem } from '@/composables/useInbox'
import { goToInboxTarget, inboxTargetLocation } from '@/utils/inbox'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'
import InboxItemRow from './InboxItemRow.vue'

const { t } = useI18n()
const router = useRouter()
const inbox = useInboxStore()
const toursStore = useToursStore()

const panelEl = ref<HTMLElement | null>(null)

const FILTERS: { key: InboxFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'inbox.filters.all' },
  { key: 'unread', labelKey: 'inbox.filters.unread' },
]

function selectFilter(f: InboxFilter) {
  if (inbox.filter === f) return
  void inbox.setFilter(f)
}

async function onActivate(item: InboxItem) {
  // Optimista: no se espera a la API para navegar.
  void inbox.markRead(item)
  if (!inboxTargetLocation(item)) return
  inbox.close()
  await goToInboxTarget(item, router, toursStore)
}

function onDismiss(item: InboxItem) {
  void inbox.dismiss(item)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    inbox.close()
  }
}

function focusBell() {
  document.getElementById('inbox-bell')?.focus()
}

// Solo corre en cliente (isOpen arranca en false y no es immediate): seguro con vite-ssg.
watch(
  () => inbox.isOpen,
  async (open) => {
    if (open) {
      document.addEventListener('keydown', onKeydown)
      await nextTick()
      panelEl.value?.focus()
    } else {
      document.removeEventListener('keydown', onKeydown)
      focusBell()
    }
  }
)

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <template v-if="inbox.isOpen">
      <div
        data-testid="inbox-backdrop"
        class="fixed inset-0 bg-black/40 z-[200]"
        @click="inbox.close()"
      />
      <section
        id="inbox-panel"
        ref="panelEl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbox-panel-title"
        tabindex="-1"
        class="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-bg-2 border-l border-line z-[200] flex flex-col outline-none animate-fade-in"
      >
        <!-- Cabecera -->
        <div class="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <h2
            id="inbox-panel-title"
            class="text-[15px] text-ink font-bold tracking-[-0.3px]"
          >
            {{ t('inbox.title') }}
          </h2>
          <button
            type="button"
            data-testid="inbox-close"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-transparent border-none cursor-pointer text-ink-3 hover:text-ink hover:bg-glass-hover transition-colors"
            :aria-label="t('inbox.close')"
            @click="inbox.close()"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line
                x1="18"
                y1="6"
                x2="6"
                y2="18"
              />
              <line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
              />
            </svg>
          </button>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 border-b border-line">
          <div class="flex items-center gap-1.5">
            <button
              v-for="f in FILTERS"
              :key="f.key"
              type="button"
              :data-testid="`inbox-filter-${f.key}`"
              class="px-3.5 py-2 rounded-full text-[14px] font-medium transition-colors cursor-pointer border-none"
              :class="inbox.filter === f.key ? 'bg-glass-active text-olive' : 'bg-glass text-ink-2 hover:text-ink'"
              :aria-pressed="inbox.filter === f.key"
              @click="selectFilter(f.key)"
            >
              {{ t(f.labelKey) }}
            </button>
          </div>
          <button
            type="button"
            data-testid="inbox-mark-all"
            class="text-[14px] font-medium bg-transparent border-none px-1 py-1 transition-colors"
            :class="inbox.unreadCount === 0 ? 'text-ink-4 cursor-default' : 'text-olive cursor-pointer hover:underline'"
            :disabled="inbox.unreadCount === 0"
            @click="inbox.markAllRead()"
          >
            {{ t('inbox.markAllRead') }}
          </button>
        </div>

        <p
          v-if="inbox.actionError"
          data-testid="inbox-action-error"
          role="alert"
          class="px-4 pt-2.5 text-[14px] text-brand-orange"
        >
          {{ inbox.actionError }}
        </p>

        <!-- Lista -->
        <div
          class="flex-1 overflow-y-auto px-3 py-3"
          style="padding-bottom: max(12px, env(safe-area-inset-bottom))"
        >
          <!-- Carga inicial -->
          <ul
            v-if="inbox.loading && inbox.items.length === 0"
            data-testid="inbox-skeleton"
            class="flex flex-col gap-2"
            aria-busy="true"
          >
            <li
              v-for="n in 3"
              :key="n"
              class="h-[72px] rounded-sm bg-glass animate-pulse"
            />
          </ul>

          <!-- Error de carga sin nada que mostrar -->
          <div
            v-else-if="inbox.error && inbox.items.length === 0"
            data-testid="inbox-error"
            class="flex flex-col items-center gap-3 py-10 text-center"
          >
            <p class="text-[14px] text-ink-2">
              {{ t('inbox.errors.load') }}
            </p>
            <BtnSecondary
              small
              data-testid="inbox-retry"
              @click="inbox.loadFirstPage()"
            >
              {{ t('inbox.retry') }}
            </BtnSecondary>
          </div>

          <!-- Vacío -->
          <p
            v-else-if="inbox.items.length === 0"
            data-testid="inbox-empty"
            class="py-10 text-center text-[14px] text-ink-4"
          >
            {{ inbox.filter === 'unread' ? t('inbox.empty.unread') : t('inbox.empty.all') }}
          </p>

          <template v-else>
            <div
              v-if="inbox.error"
              class="flex items-center justify-between gap-2 mb-2 px-1 text-[14px] text-brand-orange"
            >
              <span>{{ t('inbox.errors.load') }}</span>
              <BtnSecondary
                small
                @click="inbox.loadFirstPage()"
              >
                {{ t('inbox.retry') }}
              </BtnSecondary>
            </div>
            <ul class="flex flex-col gap-2">
              <InboxItemRow
                v-for="item in inbox.items"
                :key="item.uuid"
                :item="item"
                @activate="onActivate"
                @dismiss="onDismiss"
              />
            </ul>
            <div
              v-if="inbox.nextUrl"
              class="mt-3"
            >
              <BtnSecondary
                full
                data-testid="inbox-load-more"
                :disabled="inbox.loadingMore"
                @click="inbox.loadMore()"
              >
                {{ t('inbox.loadMore') }}
              </BtnSecondary>
            </div>
            <p
              v-if="inbox.loadMoreError"
              data-testid="inbox-load-more-error"
              class="mt-2 px-1 text-[14px] text-brand-orange"
            >
              {{ t('inbox.errors.load') }}
            </p>
          </template>
        </div>
      </section>
    </template>
  </Teleport>
</template>
