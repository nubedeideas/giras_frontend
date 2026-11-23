<script setup lang="ts">
// Tarjeta de la revisión que se desliza para omitir (F5a §4.2, D-F5-11): hacia la izquierda en una
// fila que entra ("Omitir") y hacia la derecha en una omitida ("Recuperar"). Solo con el dedo y por
// debajo de 1024 px (`useSwipeAction`); el botón Omitir/Recuperar de la tarjeta hace lo mismo con
// teclado o lector de pantalla. Nada se confirma ni se crea con un gesto: solo emite `swipe` y la
// tarjeta decide (el mismo camino que su botón). El `li` es el elemento de la lista; el aspecto de
// la tarjeta (borde, fondo, relleno) va en `contentClass`, la capa que se mueve sobre el fondo con
// el texto de la acción.
import { useI18n } from 'vue-i18n'
import { useSwipeAction } from '@/composables/useSwipeAction'

const props = withDefaults(
  defineProps<{
    /** Fila omitida: el gesto la recupera. */
    skipped: boolean
    /** Sin gesto (cancelaciones, filas que se vincularán, guardando…). */
    disabled?: boolean
    contentClass?: string | string[]
  }>(),
  { disabled: false, contentClass: '' }
)
const emit = defineEmits<{ swipe: [] }>()

const { t } = useI18n()

const swipe = useSwipeAction({
  direction: () => (props.disabled ? null : props.skipped ? 'right' : 'left'),
  onSwipe: () => emit('swipe'),
})
const { offset, active, dragDirection } = swipe
</script>

<template>
  <li
    class="relative rounded overflow-hidden focus:outline-none"
    tabindex="-1"
  >
    <div
      v-if="active"
      class="absolute inset-0 flex items-center px-4 text-[14px] font-semibold"
      :class="
        dragDirection === 'left'
          ? 'justify-end bg-off-bg text-off-fg'
          : 'justify-start bg-acid-dim text-olive'
      "
      aria-hidden="true"
      data-test="import-swipe-hint"
    >
      {{ dragDirection === 'left' ? t('importer.mobile.swipeSkip') : t('importer.mobile.swipeRestore') }}
    </div>
    <div
      class="relative touch-pan-y touch-pinch-zoom lg:touch-auto"
      :class="[
        contentClass,
        active ? 'transition-none' : 'transition-transform duration-200 motion-reduce:transition-none',
      ]"
      :style="offset ? { transform: `translateX(${offset}px)` } : undefined"
      data-test="import-swipe-content"
      @pointerdown="swipe.onPointerdown"
      @pointermove="swipe.onPointermove"
      @pointerup="swipe.onPointerup"
      @pointercancel="swipe.onPointercancel"
      @click.capture="swipe.onClickCapture"
    >
      <slot />
    </div>
  </li>
</template>
