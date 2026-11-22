/**
 * Scroll to a row and stay on it until the page is still (v2.8259). A link that lands on a long list scrolls while
 * the list is still being drawn: the row may not be there yet, and what loads above it afterwards pushes it back out
 * of view. One scroll on a timer misses both. This looks for the row, scrolls to it, then keeps looking: a row that
 * has come to rest out of view is scrolled to again, at once. It lets go when the row has rested in view, when the
 * reader scrolls, taps or types, or when the time is up.
 *
 * `holdStep` is the rule, pure. `scrollToRowAndHold` is the clock around it.
 */

/** What one look at the row saw. Tops and bottoms are from the top of the viewport, in px. */
export type HoldLook = {
  rowTop: number
  rowBottom: number
  viewportH: number
  /** The row sat somewhere else at the last look: the page is still scrolling or still growing. */
  moved: boolean
}

/** `wait`: still moving, look again. `scroll`: at rest and out of view. `rest`: at rest and in view. */
export type HoldStep = 'wait' | 'scroll' | 'rest'

/** The row counts as in view when all of it is, or, for a row taller than the viewport, when its middle is. */
export function rowInView(look: Pick<HoldLook, 'rowTop' | 'rowBottom' | 'viewportH'>): boolean {
  const { rowTop, rowBottom, viewportH } = look
  if (rowBottom - rowTop >= viewportH) {
    const middle = (rowTop + rowBottom) / 2
    return middle >= 0 && middle <= viewportH
  }
  return rowTop >= 0 && rowBottom <= viewportH
}

export function holdStep(look: HoldLook): HoldStep {
  if (look.moved) return 'wait'
  return rowInView(look) ? 'rest' : 'scroll'
}

/** How often the row is looked at. */
export const HOLD_EVERY_MS = 200
/** The longest the hold lasts. */
export const HOLD_FOR_MS = 8000
/** Looks in a row that must find the row at rest and in view before the hold lets go. */
export const HOLD_RESTS = 3

export type ScrollToRowAndHoldOptions = {
  everyMs?: number
  forMs?: number
  /** Called once, when the row has rested in view. Not called when the reader took over or the time ran out. */
  onRest?: () => void
}

// jsdom lays nothing out: every row has no height there, so being drawn is enough.
const LAYS_OUT = typeof navigator === 'undefined' || !/jsdom/i.test(navigator.userAgent)
const READER_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

function movesGently(): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false
  try {
    return !(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  } catch {
    return true
  }
}

/** Scroll to the row `find` answers and hold it in view until the page is still. Answers the cancel. */
export function scrollToRowAndHold(find: () => HTMLElement | null | undefined, opts: ScrollToRowAndHoldOptions = {}): () => void {
  const everyMs = opts.everyMs ?? HOLD_EVERY_MS
  const most = Math.max(1, Math.ceil((opts.forMs ?? HOLD_FOR_MS) / everyMs))
  let looks = 0
  let rests = 0
  let lastTop: number | null = null
  let scrolledOnce = false
  let timer: ReturnType<typeof setInterval> | null = null

  const stop = () => {
    if (timer != null) clearInterval(timer)
    timer = null
    for (const name of READER_EVENTS) window.removeEventListener(name, stop)
  }

  const look = () => {
    looks += 1
    if (looks > most) return stop()
    const el = find()
    if (!el || typeof el.scrollIntoView !== 'function') return
    const rect = el.getBoundingClientRect()
    if (LAYS_OUT && rect.height === 0) return
    if (!scrolledOnce) {
      scrolledOnce = true
      lastTop = rect.top
      el.scrollIntoView({ behavior: movesGently() ? 'smooth' : 'auto', block: 'center' })
      return
    }
    const step = holdStep({ rowTop: rect.top, rowBottom: rect.bottom, viewportH: window.innerHeight, moved: rect.top !== lastTop })
    lastTop = rect.top
    if (step === 'wait') {
      rests = 0
      return
    }
    if (step === 'scroll') {
      rests = 0
      // A correction lands at once: a second gentle scroll would chase a page that is still growing.
      el.scrollIntoView({ behavior: 'auto', block: 'center' })
      lastTop = el.getBoundingClientRect().top
      return
    }
    rests += 1
    if (rests >= HOLD_RESTS) {
      stop()
      opts.onRest?.()
    }
  }

  for (const name of READER_EVENTS) window.addEventListener(name, stop, { passive: true })
  timer = setInterval(look, everyMs)
  return stop
}
