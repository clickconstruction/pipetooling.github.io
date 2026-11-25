/**
 * A door that names a section lands the Person Desk on it (v2.2810), and keeps it there while the desk settles
 * (punch list #365).
 *
 * The desk used to scroll once, 50 ms after the person was known. The sections above the target each open on a short
 * *Loading…* line and grow when their own read lands, which pushed the target down after the scroll had aimed: the
 * simulator's walk of 2026-11-25 opened `&section=dashboard_view` one swipe short. And a section that draws nothing
 * until it knows the person's role was not there yet at 50 ms, so the scroll found nothing and never ran again.
 *
 * So the aim is held, not taken once:
 *  - it waits for the section to exist, for at most `waitMs`;
 *  - it scrolls to it, with a short ring so the eye lands on it;
 *  - for `settleMs` after that it looks every `everyMs`, and scrolls again when the section has moved in the page;
 *  - it lets go the moment the person touches the page (a wheel, a finger, a pointer, a key), so it never fights them.
 *
 * On a phone the name's row is pinned over the desk's scrolling box (`[data-desk-head-pinned]`, `PersonDeskHeader`).
 * The section's head must land under that row, not behind it, so the section takes the row's height as its scroll
 * margin before each scroll.
 */
export const DESK_AIM = { everyMs: 120, settleMs: 1500, waitMs: 4000, ringMs: 1800 } as const

const HANDS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

/** Starts the aim at the element with this DOM id. Returns the stop: the desk closed, or another person opened. */
export function startDeskSectionAim(domId: string, doc: Document = document): () => void {
  const view = doc.defaultView
  if (!view) return () => {}
  const started = Date.now()
  let foundAt: number | null = null
  let lastTop = 0
  let ringed: HTMLElement | null = null
  let ringOff: ReturnType<typeof setTimeout> | null = null
  let done = false

  const letGo = () => {
    if (done) return
    done = true
    view.clearInterval(tick)
    for (const h of HANDS) view.removeEventListener(h, letGo, true)
  }
  const look = () => {
    if (done) return
    const el = doc.getElementById(domId)
    const now = Date.now()
    if (!el) {
      if (now - started >= DESK_AIM.waitMs) letGo()
      return
    }
    const pinned = doc.querySelector<HTMLElement>('[data-desk-head-pinned]')
    el.style.scrollMarginTop = pinned && pinned.offsetHeight > 0 ? `${pinned.offsetHeight}px` : ''
    if (foundAt === null) {
      foundAt = now
      lastTop = el.offsetTop
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      ringed = el
      el.style.boxShadow = '0 0 0 2px var(--border-blue)'
      ringOff = setTimeout(() => {
        el.style.boxShadow = ''
        ringed = null
      }, DESK_AIM.ringMs)
    } else if (el.offsetTop !== lastTop) {
      // A section above it grew or shrank: aim again, at once, so the eye is not led twice.
      lastTop = el.offsetTop
      el.scrollIntoView({ block: 'start', behavior: 'auto' })
    }
    if (now - foundAt >= DESK_AIM.settleMs) letGo()
  }

  const tick = view.setInterval(look, DESK_AIM.everyMs)
  for (const h of HANDS) view.addEventListener(h, letGo, { capture: true, passive: true })
  look()

  return () => {
    letGo()
    if (ringOff) clearTimeout(ringOff)
    if (ringed) ringed.style.boxShadow = ''
  }
}
