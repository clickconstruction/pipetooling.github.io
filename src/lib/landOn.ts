/**
 * Land on a place: scroll it into view and light it for a moment, so a press that opens another screen shows the
 * reader where to work. The one shared piece for it. The light is the `[data-landed]` rule in `index.css`, drawn from
 * theme tokens: it holds for a second and a half and then fades. Under reduced motion nothing moves and nothing
 * fades: the place is in view at once and a steady outline stands for the same time.
 *
 * `landOnWhenThere` is for a place that is not drawn yet, which is the usual case: the window it lives in opens on
 * the same press, and its rows arrive with a read.
 */

/** How long the light holds before it fades. */
export const LAND_ON_HOLD_MS = 1500
/** The fade after the hold. `index.css` spends the same total. */
export const LAND_ON_FADE_MS = 600

export type LandOnOptions = {
  /** A selector inside the place for the control the cursor goes in. The page does not scroll again for it. */
  focus?: string | null
  /** A test's stand-in for the reader's reduced-motion setting. */
  reducedMotion?: boolean
}

const LAYS_OUT = typeof navigator === 'undefined' || !/jsdom/i.test(navigator.userAgent)

/** Whether the reader asked the system for less motion. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Scroll to the place and light it. Answers the undo, which takes the light off early. */
export function landOn(el: HTMLElement, opts: LandOnOptions = {}): () => void {
  const reduced = opts.reducedMotion ?? prefersReducedMotion()
  if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  if (opts.focus) {
    const inside = el.querySelector<HTMLElement>(opts.focus)
    try {
      inside?.focus({ preventScroll: true })
    } catch {
      // A control that cannot take the cursor loses the cursor, not the landing.
    }
  }
  return lightLanded(el, reduced)
}

/**
 * The light alone, for a place its own scroller has already brought into view (the Lien desk's affidavit pane lands a
 * gate row under its pinned heads, which `scrollIntoView` cannot see). Answers the undo, which takes the light off early.
 */
export function lightLanded(el: HTMLElement, reducedMotion: boolean = prefersReducedMotion()): () => void {
  el.setAttribute('data-landed', 'yes')
  const off = window.setTimeout(() => el.removeAttribute('data-landed'), reducedMotion ? LAND_ON_HOLD_MS : LAND_ON_HOLD_MS + LAND_ON_FADE_MS)
  return () => {
    window.clearTimeout(off)
    el.removeAttribute('data-landed')
  }
}

/**
 * Land on a place once it is drawn and has a size. Looks every tenth of a second, for eight seconds at most, then
 * gives up without a word: the window is open either way. Answers the undo.
 */
export function landOnWhenThere(find: () => HTMLElement | null | undefined, opts: LandOnOptions & { everyMs?: number; tries?: number } = {}): () => void {
  const everyMs = opts.everyMs ?? 100
  const most = opts.tries ?? 80
  let tries = 0
  let undo: (() => void) | null = null
  const look = () => {
    const el = find()
    // A real page waits for the place to have a size: a folded tab is drawn with none. jsdom lays nothing out, so there being drawn is enough.
    if (!el || (LAYS_OUT && el.getBoundingClientRect().height === 0)) return false
    undo = landOn(el, opts)
    return true
  }
  if (look()) return () => undo?.()
  const tick = window.setInterval(() => {
    tries += 1
    if (look() || tries >= most) window.clearInterval(tick)
  }, everyMs)
  return () => {
    window.clearInterval(tick)
    undo?.()
  }
}
