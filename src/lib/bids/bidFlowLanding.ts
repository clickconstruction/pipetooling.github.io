/**
 * Landing on a bid-flow door (v2.3216).
 *
 * A step on the strip has always opened a destination — the Edit window or
 * one of the workflow tabs. Now it also lands: the destination renders (async
 * after a tab switch or a modal open), the target element is found, scrolled
 * to the middle, given keyboard focus, and ringed in the app's focus blue for
 * a few seconds so the eye knows where the missing piece goes.
 *
 * Pure DOM helper, no React: poll for the first of the step's target ids that
 * exists, then land. The same idiom as `usePendingRowFlash` (jump-to-row) but
 * class-based, so a field needs nothing beyond a stable id. A `focus=` URL
 * parameter on /bids reaches the same helper.
 */

export const BID_FLOW_LANDING_CLASS = 'bid-flow-landing'
/** How long the ring stays before it has faded (matches the CSS animation). */
export const BID_FLOW_LANDING_MS = 3200

export type LandingOptions = {
  /** Give up after this long (the destination never rendered the target). */
  timeoutMs?: number
  pollMs?: number
  /** Called once: true when landed, false when nothing appeared in time. */
  onDone?: (landed: boolean) => void
  /** Test seam. */
  doc?: Document
  reducedMotion?: boolean
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** The first target that exists right now, else null. */
export function findLandingElement(targets: ReadonlyArray<string>, doc: Document = document): HTMLElement | null {
  for (const id of targets) {
    const el = doc.getElementById(id)
    if (el instanceof HTMLElement) return el
  }
  return null
}

/** Scroll, focus, ring. Exported for the one-shot case where the element is already in hand. */
export function landOnElement(el: HTMLElement, opts?: { reducedMotion?: boolean }): void {
  const reduced = opts?.reducedMotion ?? prefersReducedMotion()
  try {
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  } catch {
    /* jsdom and very old engines */
  }
  const focusable = el.matches('input, textarea, select, button, a[href], [tabindex]')
  if (focusable) {
    try {
      el.focus({ preventScroll: true })
    } catch {
      /* ignore */
    }
  }
  // Re-trigger the animation when the same element is landed on twice.
  el.classList.remove(BID_FLOW_LANDING_CLASS)
  void el.offsetWidth
  el.classList.add(BID_FLOW_LANDING_CLASS)
  window.setTimeout(() => el.classList.remove(BID_FLOW_LANDING_CLASS), BID_FLOW_LANDING_MS)
}

/**
 * Poll for any of `targets`, then land on it. Returns a cancel function.
 * `targets` empty/null = nothing to do (Review has no landing; the prompt is the door).
 */
export function landOnBidFlowTarget(targets: ReadonlyArray<string> | null | undefined, opts?: LandingOptions): () => void {
  if (!targets || targets.length === 0) {
    opts?.onDone?.(false)
    return () => {}
  }
  const doc = opts?.doc ?? document
  const timeoutMs = opts?.timeoutMs ?? 6000
  const pollMs = opts?.pollMs ?? 120
  const startedAt = Date.now()
  let cancelled = false
  let timer: number | null = null
  const tick = () => {
    if (cancelled) return
    const el = findLandingElement(targets, doc)
    if (el) {
      landOnElement(el, { reducedMotion: opts?.reducedMotion })
      opts?.onDone?.(true)
      return
    }
    if (Date.now() - startedAt >= timeoutMs) {
      opts?.onDone?.(false)
      return
    }
    timer = window.setTimeout(tick, pollMs)
  }
  // A beat for the destination's first paint before the first look.
  timer = window.setTimeout(tick, 60)
  return () => {
    cancelled = true
    if (timer != null) window.clearTimeout(timer)
  }
}

/** Parse the `focus` URL parameter: comma-separated ids, trimmed, blanks dropped. */
export function parseLandingParam(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z][\w-]*$/.test(s))
}
