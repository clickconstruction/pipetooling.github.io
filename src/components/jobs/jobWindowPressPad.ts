/**
 * The job window on a phone (punch list #355, v2.7309): every press under 40 px gets an unseen pad that grows its
 * hit area to a thumb's 44 px square, without moving anything. The size of the pad is `pressPad` in
 * `jobWindowPhone.ts`; this file walks the window's body, marks each small press with `data-press-pad` and the
 * pad's two custom properties, and the window's stylesheet draws the pad as a `::after` over the mark.
 *
 * Left alone: a press in the tab strip or the title row (both already a thumb's size), a press with a press, a
 * field or a select inside it (the pad would sit over them and take their taps), and a press that clips its own
 * overflow (a clipped pad is no pad). A native select or a checkbox cannot carry a `::after`, so the pad never
 * reaches them: those are sized where they are drawn.
 *
 * The pad is drawn from inside the press's border, so the border's width is added to it here (finding 340,
 * `pressPadFromInside`): a press with a 1 px border took a tap of 42 where 44 was meant.
 */
import { pressPad, pressPadFromInside } from '../../lib/jobs/jobWindowPhone'

export const PRESS_SELECTOR = 'button, a[href], [role="button"], summary'
const SKIP_WITHIN = '[role="tablist"], [data-testid="job-window-head"], [data-press-pad-skip]'
const INNER = 'button, a[href], [role="button"], input, select, textarea'
/** The walk runs this long after the last change under the body, so a burst of changes is one walk. */
const SETTLE_MS = 50

const clips = (el: HTMLElement): boolean => /hidden|clip|scroll|auto/.test(getComputedStyle(el).overflow)

/** The wider of a press's two borders on each axis, in px. A browser that cannot say answers none. */
function borderOf(el: HTMLElement): { x: number; y: number } {
  const cs = getComputedStyle(el)
  const px = (v: string) => parseFloat(v) || 0
  return { x: Math.max(px(cs.borderLeftWidth), px(cs.borderRightWidth)), y: Math.max(px(cs.borderTopWidth), px(cs.borderBottomWidth)) }
}

/** Marks every small press under `root` with its pad and clears the mark from the rest. Returns how many are padded. */
export function padSmallPresses(root: HTMLElement): number {
  let padded = 0
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(PRESS_SELECTOR))) {
    const r = el.getBoundingClientRect()
    const drawn = r.width > 0 && r.height > 0
    const sized = drawn && !el.closest(SKIP_WITHIN) && !el.querySelector(INNER) && !clips(el) ? pressPad(r) : null
    const pad = sized ? pressPadFromInside(sized, borderOf(el)) : null
    if (pad) {
      el.setAttribute('data-press-pad', '')
      el.style.setProperty('--press-pad-x', `${pad.x}px`)
      el.style.setProperty('--press-pad-y', `${pad.y}px`)
      padded++
    } else if (el.hasAttribute('data-press-pad')) {
      el.removeAttribute('data-press-pad')
      el.style.removeProperty('--press-pad-x')
      el.style.removeProperty('--press-pad-y')
    }
  }
  return padded
}

/**
 * Pads the presses under `root` now and again after anything under it changes or the screen turns, once the
 * changes have settled for a moment (a timer, not a frame: a frame never comes while the page is in the
 * background, and a timer still does). Returns the stop.
 */
export function watchSmallPresses(root: HTMLElement): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const run = () => {
    timer = null
    padSmallPresses(root)
  }
  const schedule = () => {
    if (timer === null) timer = setTimeout(run, SETTLE_MS)
  }
  schedule()
  const observer = new MutationObserver(schedule)
  // `data-open` is a fold opening or closing (`PhoneFold`): its presses stay mounted while it is shut, measure as
  // nothing, and need their pad the moment it opens. The pad's own attribute is not on the list, so it never loops.
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-open'] })
  window.addEventListener('resize', schedule)
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', schedule)
    if (timer !== null) clearTimeout(timer)
  }
}
