/**
 * Freezes the page behind an open modal.
 *
 * `overflow: hidden` alone doesn't hold on iOS Safari — the body still
 * rubber-bands and the page underneath scrolls while the user drags inside the
 * modal. The working recipe (already used by the clock-in modal) is
 * `position: fixed` with the current scroll offset pinned as a negative `top`,
 * restoring the offset on release so closing the modal doesn't jump the page
 * back to the top.
 *
 * Reference-counted because modals stack (Additional Report opens Job Reports,
 * which opens Report View): the first lock saves and applies, the last release
 * restores. Without the count the inner modal's release would unfreeze the page
 * while the outer one is still open.
 */

export interface ScrollLockStyle {
  overflow: string
  position: string
  top: string
  left: string
  right: string
  paddingRight: string
}

/** Structural stand-in for `document.body` (keeps the kernel testable). */
export interface ScrollLockBody {
  style: ScrollLockStyle
}

/** Structural stand-in for `window`. */
export interface ScrollLockWindow {
  scrollY: number
  scrollTo: (x: number, y: number) => void
}

const state: { depth: number; saved: ScrollLockStyle | null; scrollY: number } = {
  depth: 0,
  saved: null,
  scrollY: 0,
}

function readStyle(body: ScrollLockBody): ScrollLockStyle {
  // Read each property by name — a CSSStyleDeclaration doesn't spread.
  return {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    paddingRight: body.style.paddingRight,
  }
}

/**
 * Locks background scrolling. Returns the release function; calling it more
 * than once is a no-op, so it can be handed straight to a `useEffect` cleanup.
 *
 * `scrollbarWidth` (0 on touch devices) is added to the body's right padding:
 * fixing the body removes the desktop scrollbar, and without the compensation
 * the whole page jumps sideways the moment a modal opens.
 */
export function acquireBodyScrollLock(
  body: ScrollLockBody,
  win: ScrollLockWindow,
  scrollbarWidth = 0,
): () => void {
  if (state.depth === 0) {
    state.scrollY = win.scrollY
    state.saved = readStyle(body)
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${state.scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    if (scrollbarWidth > 0) {
      // calc() so a body that already carries padding in any unit still adds up.
      body.style.paddingRight = `calc(${state.saved.paddingRight || '0px'} + ${scrollbarWidth}px)`
    }
  }
  state.depth += 1

  let released = false
  return () => {
    if (released) return
    released = true
    state.depth -= 1
    if (state.depth > 0) return
    const saved = state.saved
    if (saved) {
      body.style.overflow = saved.overflow
      body.style.position = saved.position
      body.style.top = saved.top
      body.style.left = saved.left
      body.style.right = saved.right
      body.style.paddingRight = saved.paddingRight
    }
    state.saved = null
    win.scrollTo(0, state.scrollY)
  }
}

/** Test-only escape hatch — the counter is module state shared across tests. */
export function resetBodyScrollLockForTests(): void {
  state.depth = 0
  state.saved = null
  state.scrollY = 0
}
