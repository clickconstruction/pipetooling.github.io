import { useEffect, type RefObject } from 'react'

/**
 * Closes a popover menu on a click outside `ref` or on Escape — the alternative to a
 * full-screen fixed backdrop, which caught the wheel and the finger too, so the page
 * could not scroll while the menu was open and a tall menu's bottom rows were out of
 * reach (Pipeline jump strip ☰ menu, v2.3772). Listening for `click` (not pointerdown)
 * means a scroll gesture leaves the menu open and only a real tap outside closes it.
 * No-op while `open` is false.
 *
 * Inside is read from the event's path, not from `contains` on its target (v2.6504): a
 * press on a control that removes itself (a file chip's ×, a picker's row that closes
 * the picker) has left the tree by the time the click reaches the document, and a
 * detached node is inside nothing. A click older than the listener is ignored: the click
 * that opens the owner (a thread's row opening the thread, whose box then listens) is
 * still on its way to the document when the effect attaches, and would close what it
 * just opened. `capture: true` listens on the capture phase: a window's panel stops its
 * clicks from reaching the document on the way up (`ThreadWindow`, `PhoneSheet`), and the
 * reply box's fold needs the clicks on the thread around it; the menus keep the bubble
 * phase, where a press a row stops (an Edit rail under the Jobs tools menu) leaves them
 * open as it always did. `escape: false` leaves the Escape key alone, for a caller that
 * folds rather than closes and whose window owns Escape (the reply box).
 */
export function useCloseOnOutsideClick(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, more: { escape?: boolean; capture?: boolean } = {}): void {
  const escape = more.escape ?? true
  const capture = more.capture ?? false
  useEffect(() => {
    if (!open) return
    const armed = performance.now()
    const onClick = (e: MouseEvent) => {
      if (e.timeStamp < armed) return
      const root = ref.current
      if (root && clickInside(e, root)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('click', onClick, capture)
    if (escape) document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick, capture)
      if (escape) document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, onClose, escape, capture])
}

/** The click began under `root`: its path holds the root, even when the pressed control has since been removed. */
function clickInside(e: MouseEvent, root: HTMLElement): boolean {
  if (typeof e.composedPath === 'function') return e.composedPath().includes(root)
  return e.target instanceof Node && root.contains(e.target)
}
