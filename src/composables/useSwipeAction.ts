import { ref, type Ref } from 'vue'

// Deslizar para omitir (F5a §4.2, D-F5-11). Pointer Events sin librerías: solo con el dedo
// (`pointerType === 'touch'`) y por debajo de 1024 px. La tarjeta lleva `touch-action: pan-y`, así
// que el scroll vertical sigue siendo del navegador (si empieza, llega `pointercancel` y no pasa
// nada). Se dispara al soltar si el recorrido supera el 35 % del ancho o la velocidad media pasa de
// 0,5 px/ms. Con `prefers-reduced-motion` la tarjeta no se mueve durante el arrastre: el gesto se
// aplica igual al soltar. `window` solo se lee dentro de los manejadores (vite-ssg).

export type SwipeDirection = 'left' | 'right'

export interface SwipeOptions {
  /** Hacia dónde se puede deslizar ahora mismo; `null` = sin gesto (fila sin omitir, guardando…). */
  direction: () => SwipeDirection | null
  /** Se llama al soltar pasado el umbral. */
  onSwipe: (direction: SwipeDirection) => void
  /** Fracción del ancho de la tarjeta (0,35). */
  threshold?: number
  /** Velocidad media mínima en px/ms (0,5). */
  velocity?: number
}

/** Por debajo de 1024 px (el corte `lg` de la app). */
export const SWIPE_MAX_WIDTH = 1024
/** Movimiento antes de decidir si el gesto es horizontal o vertical. */
const SLOP = 8
/** Recorrido mínimo para que un golpe rápido cuente como gesto (no un toque). */
const MIN_FLICK = 30

interface PointerLike {
  pointerType: string
  pointerId?: number
  clientX: number
  clientY: number
  timeStamp: number
  currentTarget: EventTarget | null
  /** Donde empezó el toque: en un control (campo, botón, enlace) no hay gesto. */
  target?: EventTarget | null
}

/** Controles dentro de la tarjeta que no arrancan el gesto (`data-no-swipe` para excluir más). */
const NO_SWIPE = 'input,select,textarea,button,a,[data-no-swipe]'

function startsOnControl(target: EventTarget | null | undefined): boolean {
  const el = target as Element | null | undefined
  return typeof el?.closest === 'function' && el.closest(NO_SWIPE) !== null
}

export interface SwipeAction {
  /** Desplazamiento horizontal en px (0 en reposo o con movimiento reducido). */
  offset: Ref<number>
  /** Arrastre horizontal en curso en el sentido permitido (`dragDirection`). */
  active: Ref<boolean>
  dragDirection: Ref<SwipeDirection | null>
  onPointerdown: (e: PointerLike) => void
  onPointermove: (e: PointerLike) => void
  onPointerup: (e: PointerLike) => void
  onPointercancel: () => void
  /** En fase de captura: tras un gesto, se come el clic que el navegador manda al soltar. */
  onClickCapture: (e: Event) => void
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function useSwipeAction(options: SwipeOptions): SwipeAction {
  const threshold = options.threshold ?? 0.35
  const minVelocity = options.velocity ?? 0.5

  const offset = ref(0)
  const active = ref(false)
  const dragDirection = ref<SwipeDirection | null>(null)

  let tracking = false
  let axis: 'x' | 'y' | null = null
  let startX = 0
  let startY = 0
  let startT = 0
  let width = 0
  let distance = 0
  let reduced = false
  let suppressClick = false

  function reset() {
    tracking = false
    axis = null
    distance = 0
    offset.value = 0
    active.value = false
    dragDirection.value = null
  }

  function onPointerdown(e: PointerLike) {
    suppressClick = false
    if (e.pointerType !== 'touch') return
    if (startsOnControl(e.target)) return
    if (typeof window === 'undefined' || window.innerWidth >= SWIPE_MAX_WIDTH) return
    const dir = options.direction()
    if (!dir) return
    reset()
    tracking = true
    dragDirection.value = dir
    startX = e.clientX
    startY = e.clientY
    startT = e.timeStamp
    const el = e.currentTarget as HTMLElement | null
    width = el?.getBoundingClientRect?.().width || window.innerWidth
    reduced = prefersReducedMotion()
  }

  function onPointermove(e: PointerLike) {
    if (!tracking) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (axis === null) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (axis === 'y') {
        // Es scroll: el gesto no omite nada.
        reset()
        return
      }
      const el = e.currentTarget as Element | null
      try {
        if (e.pointerId !== undefined) el?.setPointerCapture?.(e.pointerId)
      } catch {
        // Sin captura el gesto sigue funcionando mientras el dedo no salga de la tarjeta.
      }
    }
    // Solo cuenta el recorrido en el sentido permitido.
    const along = dragDirection.value === 'left' ? Math.min(0, dx) : Math.max(0, dx)
    distance = Math.abs(along)
    // En el sentido no permitido no se enseña la acción ("Omitir" al arrastrar a la derecha).
    active.value = along !== 0
    offset.value = reduced ? 0 : along
  }

  function onPointerup(e: PointerLike) {
    if (!tracking) return
    const dir = dragDirection.value
    const horizontal = axis === 'x'
    const elapsed = Math.max(1, e.timeStamp - startT)
    const dist = distance
    reset()
    if (!horizontal || !dir) return
    // Tras un arrastre horizontal no se deja pasar el clic del final (botones bajo el dedo).
    suppressClick = true
    setTimeout(() => (suppressClick = false), 400)
    const fast = dist >= MIN_FLICK && dist / elapsed > minVelocity
    if (dist >= width * threshold || fast) options.onSwipe(dir)
  }

  function onPointercancel() {
    reset()
  }

  function onClickCapture(e: Event) {
    if (!suppressClick) return
    suppressClick = false
    e.stopPropagation()
    e.preventDefault()
  }

  return {
    offset,
    active,
    dragDirection,
    onPointerdown,
    onPointermove,
    onPointerup,
    onPointercancel,
    onClickCapture,
  }
}
