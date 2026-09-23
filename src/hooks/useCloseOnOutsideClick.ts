import { useEffect, type RefObject } from 'react'

/**
 * Closes a popover menu on a click outside `ref` or on Escape — the alternative to a
 * full-screen fixed backdrop, which caught the wheel and the finger too, so the page
 * could not scroll while the menu was open and a tall menu's bottom rows were out of
 * reach (Pipeline jump strip ☰ menu, v2.3772). Listening for `click` (not pointerdown)
 * means a scroll gesture leaves the menu open and only a real tap outside closes it.
 * No-op while `open` is false.
 */
export function useCloseOnOutsideClick(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const root = ref.current
      if (root && e.target instanceof Node && root.contains(e.target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, onClose])
}
