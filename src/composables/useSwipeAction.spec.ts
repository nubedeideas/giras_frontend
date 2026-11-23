import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSwipeAction, type SwipeDirection } from './useSwipeAction'

/** Tarjeta de 300 px de ancho: el umbral (35 %) son 105 px. */
const card = {
  getBoundingClientRect: () => ({ width: 300 }) as DOMRect,
  setPointerCapture: vi.fn(),
} as unknown as HTMLElement

const ev = (x: number, y: number, timeStamp: number, pointerType = 'touch') => ({
  pointerType,
  pointerId: 1,
  clientX: x,
  clientY: y,
  timeStamp,
  currentTarget: card,
})

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reduce && query.includes('reduce'), media: query }))
  )
}

function setup(direction: SwipeDirection | null = 'left') {
  const onSwipe = vi.fn()
  const swipe = useSwipeAction({ direction: () => direction, onSwipe })
  return { swipe, onSwipe }
}

/** Arrastre de `from` a `to` (x) en `ms` milisegundos, con un paso intermedio. */
function drag(
  swipe: ReturnType<typeof setup>['swipe'],
  from: number,
  to: number,
  ms: number,
  opts: { dy?: number; pointerType?: string } = {}
) {
  const dy = opts.dy ?? 0
  swipe.onPointerdown(ev(from, 100, 0, opts.pointerType))
  swipe.onPointermove(ev((from + to) / 2, 100 + dy / 2, ms / 2, opts.pointerType))
  swipe.onPointermove(ev(to, 100 + dy, ms, opts.pointerType))
  swipe.onPointerup(ev(to, 100 + dy, ms, opts.pointerType))
}

beforeEach(() => {
  vi.stubGlobal('innerWidth', 375)
  stubReducedMotion(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useSwipeAction', () => {
  it('pasado el 35 % del ancho omite al soltar; antes no', () => {
    const { swipe, onSwipe } = setup('left')
    drag(swipe, 250, 160, 1000) // 90 px despacio: no llega
    expect(onSwipe).not.toHaveBeenCalled()
    drag(swipe, 250, 140, 1000) // 110 px > 105
    expect(onSwipe).toHaveBeenCalledWith('left')
  })

  it('un golpe rápido (> 0,5 px/ms) cuenta aunque no llegue al umbral', () => {
    const { swipe, onSwipe } = setup('left')
    drag(swipe, 250, 190, 60) // 60 px en 60 ms = 1 px/ms
    expect(onSwipe).toHaveBeenCalledTimes(1)
  })

  it('el desplazamiento sigue al dedo solo en el sentido permitido y vuelve a 0 al soltar', () => {
    const { swipe } = setup('left')
    swipe.onPointerdown(ev(200, 100, 0))
    swipe.onPointermove(ev(150, 102, 50))
    expect(swipe.active.value).toBe(true)
    expect(swipe.offset.value).toBe(-50)
    swipe.onPointermove(ev(260, 102, 80))
    expect(swipe.offset.value).toBe(0)
    swipe.onPointerup(ev(260, 102, 80))
    expect(swipe.active.value).toBe(false)
  })

  it('en una omitida se desliza a la derecha para recuperar', () => {
    const { swipe, onSwipe } = setup('right')
    drag(swipe, 50, 200, 500)
    expect(onSwipe).toHaveBeenCalledWith('right')
    onSwipe.mockClear()
    drag(swipe, 250, 50, 500) // hacia la izquierda no hace nada
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('solo táctil: con ratón o lápiz no hay gesto', () => {
    const { swipe, onSwipe } = setup('left')
    drag(swipe, 250, 50, 100, { pointerType: 'mouse' })
    drag(swipe, 250, 50, 100, { pointerType: 'pen' })
    expect(onSwipe).not.toHaveBeenCalled()
    expect(swipe.active.value).toBe(false)
  })

  it('desde 1024 px no hay gesto', () => {
    vi.stubGlobal('innerWidth', 1024)
    const { swipe, onSwipe } = setup('left')
    drag(swipe, 250, 50, 100)
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('un movimiento vertical es scroll: no omite aunque luego se mueva en horizontal', () => {
    const { swipe, onSwipe } = setup('left')
    swipe.onPointerdown(ev(250, 100, 0))
    swipe.onPointermove(ev(248, 160, 50)) // vertical
    swipe.onPointermove(ev(50, 170, 100))
    swipe.onPointerup(ev(50, 170, 120))
    expect(onSwipe).not.toHaveBeenCalled()
    expect(swipe.offset.value).toBe(0)
  })

  it('pointercancel (el navegador se queda el scroll) no omite', () => {
    const { swipe, onSwipe } = setup('left')
    swipe.onPointerdown(ev(250, 100, 0))
    swipe.onPointermove(ev(150, 100, 50))
    swipe.onPointercancel()
    swipe.onPointerup(ev(50, 100, 100))
    expect(onSwipe).not.toHaveBeenCalled()
    expect(swipe.active.value).toBe(false)
  })

  it('sin dirección (fila de cancelación o guardando) no hay gesto', () => {
    const { swipe, onSwipe } = setup(null)
    drag(swipe, 250, 50, 100)
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('con movimiento reducido la tarjeta no se mueve, pero el gesto se aplica al soltar', () => {
    stubReducedMotion(true)
    const { swipe, onSwipe } = setup('left')
    swipe.onPointerdown(ev(250, 100, 0))
    swipe.onPointermove(ev(100, 100, 300))
    expect(swipe.active.value).toBe(true)
    expect(swipe.offset.value).toBe(0)
    swipe.onPointerup(ev(100, 100, 300))
    expect(onSwipe).toHaveBeenCalledTimes(1)
  })

  it('tras un gesto se come el clic del final', () => {
    const { swipe } = setup('left')
    drag(swipe, 250, 50, 100)
    const click = { stopPropagation: vi.fn(), preventDefault: vi.fn() } as unknown as Event
    swipe.onClickCapture(click)
    expect(click.stopPropagation).toHaveBeenCalled()
    const next = { stopPropagation: vi.fn(), preventDefault: vi.fn() } as unknown as Event
    swipe.onClickCapture(next)
    expect(next.stopPropagation).not.toHaveBeenCalled()
  })
})
