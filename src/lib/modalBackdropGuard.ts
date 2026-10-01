/**
 * A window closes on a click outside it only when the press AND the release were both outside it
 * (v2.4338 — Grace, 2026-10-01). Without this, a drag that starts inside a window and ends on the
 * dark backdrop — drawing a signature off the pad's edge, selecting text in a box — closes the
 * window: when the press and the release land on different elements the browser fires the click
 * on their nearest common ancestor, which is the backdrop, and every backdrop in the app closes
 * on `onClick`. (~360 of them on 2026-10-01; none had its own guard.)
 *
 * One rule for the whole app, installed once from `main.tsx`, so no window needs editing and new
 * windows get it too: a pointer click whose target is a full-screen `position: fixed` layer is
 * stopped before React sees it, unless the press and the release were both on that same layer.
 * Clicks from the keyboard or from code (`detail === 0`) pass untouched, so Enter, Escape and
 * `element.click()` behave as before.
 *
 * Why "full-screen": a backdrop and a fixed button with an icon look the same to the browser —
 * press on the icon, release on the button's edge, and the click lands on the button. Only the
 * size tells them apart. A backdrop covers at least three quarters of the screen both ways — the
 * seven that stop above the Job / Dispatch mode footer (`--app-bottom-chrome`) too, even on a
 * phone — while a fixed button or a side drawer is far smaller. A smaller backdrop is not guarded.
 */

export type ModalBackdropGuardOptions = {
  /** Which click targets count as a backdrop. Default: a full-screen fixed layer (tests inject their own; jsdom has no layout). */
  isBackdropLayer?: (el: Element) => boolean
}

/** A `position: fixed` element covering at least three quarters of the viewport both ways — the shape every backdrop in the app has. */
export function isFullScreenFixedLayer(el: Element, win: Window = window): boolean {
  const vw = win.innerWidth
  const vh = win.innerHeight
  if (!(vw > 0) || !(vh > 0)) return false
  if (win.getComputedStyle(el).position !== 'fixed') return false
  const r = el.getBoundingClientRect()
  return r.width >= vw * 0.75 && r.height >= vh * 0.75
}

/**
 * Listens on the document in the capture phase, ahead of React's root listeners. Returns a
 * function that removes the listeners (tests; a hot reload).
 */
export function installModalBackdropGuard(doc: Document = document, options: ModalBackdropGuardOptions = {}): () => void {
  const win = doc.defaultView ?? window
  const isBackdrop = options.isBackdropLayer ?? ((el: Element) => isFullScreenFixedLayer(el, win))
  let pressedOn: EventTarget | null = null
  let releasedOn: EventTarget | null = null

  const onPointerDown = (e: Event) => {
    pressedOn = e.target
    releasedOn = null
  }
  const onPointerUp = (e: Event) => {
    releasedOn = e.target
  }
  const onPointerCancel = () => {
    pressedOn = null
    releasedOn = null
  }
  const onClick = (e: MouseEvent) => {
    const pressed = pressedOn
    const released = releasedOn
    pressedOn = null
    releasedOn = null
    // Keyboard and code clicks carry no pointer press.
    if (e.detail === 0) return
    const target = e.target
    if (!(target instanceof Element) || !isBackdrop(target)) return
    if (pressed === target && released === target) return
    e.stopPropagation()
    e.preventDefault()
  }

  doc.addEventListener('pointerdown', onPointerDown, true)
  doc.addEventListener('pointerup', onPointerUp, true)
  doc.addEventListener('pointercancel', onPointerCancel, true)
  doc.addEventListener('click', onClick, true)
  return () => {
    doc.removeEventListener('pointerdown', onPointerDown, true)
    doc.removeEventListener('pointerup', onPointerUp, true)
    doc.removeEventListener('pointercancel', onPointerCancel, true)
    doc.removeEventListener('click', onClick, true)
  }
}
