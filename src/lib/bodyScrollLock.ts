/**
 * Freezes the page behind an open modal.
 *
 * `overflow: hidden` alone doesn't hold on iOS Safari — the body still
 * rubber-bands and the page underneath scrolls while the user drags inside the
 * modal. The working recipe is `position: fixed` with the current scroll offset
 * pinned as a negative `top`, restoring the offset on release so closing the
 * modal doesn't jump the page back to the top.
 *
 * The lock is a class on `<html>` (`SCROLL_LOCK_CLASS`; the rule is in
 * `index.css`), never a style written on the body. A lock kept in the body's
 * inline styles could be stranded by any other code that saved and restored
 * those styles around it: a window with its own `overflow: hidden` effect opened
 * first, the lock saved that `hidden` as "the style before", and on close put it
 * back for good — the page stayed frozen until a refresh. The class reads and
 * restores nothing, so no other writer can strand it.
 *
 * Reference-counted because modals stack (Additional Report opens Job Reports,
 * which opens Report View): the first lock applies, the last release lifts it.
 * Without the count the inner modal's release would unfreeze the page while the
 * outer one is still open.
 */

/** On `<html>` while the page is frozen. `index.css` pins the body under it. */
export const SCROLL_LOCK_CLASS = 'scroll-locked'
/** The scroll offset the body is pinned at, as a negative `top`. */
export const SCROLL_LOCK_TOP_VAR = '--scroll-lock-top'
/** The width of the scrollbar the pinned body lost (0 on touch). */
export const SCROLL_LOCK_PAD_VAR = '--scroll-lock-pad'

/** Structural stand-in for `document.documentElement` (keeps the kernel testable). */
export interface ScrollLockRoot {
  classList: { add: (name: string) => void; remove: (name: string) => void; contains: (name: string) => boolean }
  style: { setProperty: (name: string, value: string) => void; removeProperty: (name: string) => unknown }
}

/** Structural stand-in for `window`. */
export interface ScrollLockWindow {
  scrollY: number
  scrollTo: (x: number, y: number) => void
}

/** The inline styles a hand-written lock leaves on `document.body`. */
export interface ScrollLockBodyStyle {
  overflow: string
  position: string
  top: string
  left: string
  right: string
}

const state: { depth: number; scrollY: number } = { depth: 0, scrollY: 0 }

function lift(root: ScrollLockRoot): void {
  root.classList.remove(SCROLL_LOCK_CLASS)
  root.style.removeProperty(SCROLL_LOCK_TOP_VAR)
  root.style.removeProperty(SCROLL_LOCK_PAD_VAR)
}

/**
 * Locks background scrolling. Returns the release function; calling it more
 * than once is a no-op, so it can be handed straight to a `useEffect` cleanup.
 *
 * `scrollbarWidth` (0 on touch devices) becomes the body's right padding:
 * fixing the body removes the desktop scrollbar, and without the compensation
 * the whole page jumps sideways the moment a modal opens.
 */
export function acquireBodyScrollLock(root: ScrollLockRoot, win: ScrollLockWindow, scrollbarWidth = 0): () => void {
  if (state.depth === 0) {
    state.scrollY = win.scrollY
    root.style.setProperty(SCROLL_LOCK_TOP_VAR, `-${state.scrollY}px`)
    root.style.setProperty(SCROLL_LOCK_PAD_VAR, `${Math.max(0, scrollbarWidth)}px`)
    root.classList.add(SCROLL_LOCK_CLASS)
  }
  state.depth += 1

  let released = false
  return () => {
    if (released) return
    released = true
    state.depth -= 1
    if (state.depth > 0) return
    lift(root)
    win.scrollTo(0, state.scrollY)
  }
}

/** True while at least one lock is held. */
export function isBodyScrollLockHeld(): boolean {
  return state.depth > 0
}

/** True when the body's own inline styles would hold the page still. */
export function bodyStyleFreezesPage(style: Pick<ScrollLockBodyStyle, 'overflow' | 'position'>): boolean {
  return style.overflow === 'hidden' || style.position === 'fixed'
}

/**
 * The last line of defence: with no lock held, nothing may hold the page still.
 * Lifts a class left behind and clears a freeze written straight onto the
 * body's inline styles (code outside this module — lint forbids it in `src`, a
 * library can still do it). Returns true when it had something to clear. The
 * caller decides WHEN nothing is open; this only refuses while a lock is held.
 */
export function healStrayScrollLock(root: ScrollLockRoot, bodyStyle: ScrollLockBodyStyle): boolean {
  if (state.depth > 0) return false
  let healed = false
  if (root.classList.contains(SCROLL_LOCK_CLASS)) {
    lift(root)
    healed = true
  }
  if (bodyStyleFreezesPage(bodyStyle)) {
    if (bodyStyle.position === 'fixed') {
      bodyStyle.position = ''
      bodyStyle.top = ''
      bodyStyle.left = ''
      bodyStyle.right = ''
    }
    if (bodyStyle.overflow === 'hidden') bodyStyle.overflow = ''
    healed = true
  }
  return healed
}

/** Test-only escape hatch — the counter is module state shared across tests. */
export function resetBodyScrollLockForTests(): void {
  state.depth = 0
  state.scrollY = 0
}
