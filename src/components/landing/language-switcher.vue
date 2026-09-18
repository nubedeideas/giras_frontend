<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

type LangOption = { code: 'es' | 'en'; flag: string; name: string }

const options: LangOption[] = [
  { code: 'es', flag: 'fi-es', name: 'Español' },
  { code: 'en', flag: 'fi-gb', name: 'English' },
]

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const current = () => options.find((o) => o.code === locale.value) ?? options[0]

const toggle = () => {
  open.value = !open.value
}

const select = (code: 'es' | 'en') => {
  locale.value = code
  open.value = false
}

const onClickOutside = (e: MouseEvent) => {
  if (open.value && rootRef.value && !rootRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

const onKeydown = (e: KeyboardEvent) => {
  if (!open.value) return
  if (e.key === 'Escape') {
    open.value = false
    return
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const idx = options.findIndex((o) => o.code === locale.value)
    const dir = e.key === 'ArrowDown' ? 1 : -1
    const next = options[(idx + dir + options.length) % options.length]
    select(next.code)
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="rootRef"
    class="relative"
  >
    <button
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="t('landing.header.langSwitcher.label')"
      class="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70 transition-all hover:border-acid-green hover:text-acid-green"
      @click="toggle"
    >
      <span
        :class="['fi', current().flag, 'rounded-[2px]']"
        aria-hidden="true"
      />
      {{ current().code }}
      <svg
        class="h-2.5 w-2.5 transition-transform"
        :class="open ? 'rotate-180' : ''"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <Transition name="lang-menu">
      <ul
        v-if="open"
        role="listbox"
        :aria-label="t('landing.header.langSwitcher.label')"
        class="glass absolute right-0 top-[calc(100%+8px)] w-36 overflow-hidden rounded-xl border border-white/10 py-1 shadow-2xl"
      >
        <li
          v-for="opt in options"
          :key="opt.code"
          role="option"
          :aria-selected="locale === opt.code"
          tabindex="0"
          :class="[
            'flex cursor-pointer items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-tight transition-colors',
            locale === opt.code ? 'text-acid-green' : 'text-white/70 hover:text-white',
          ]"
          @click="select(opt.code)"
          @keydown.enter="select(opt.code)"
          @keydown.space.prevent="select(opt.code)"
        >
          <span
            :class="['fi', opt.flag, 'rounded-[2px]']"
            aria-hidden="true"
          />
          <span>{{ opt.name }}</span>
          <span class="ml-auto text-[9px] opacity-50">{{ opt.code }}</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.lang-menu-enter-active,
.lang-menu-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.lang-menu-enter-from,
.lang-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
