import { useEffect, useRef, useState } from 'react'

/**
 * GC mode, the real build (the Board's B3), from the design spike's `usePriceCard.ts`: who holds the
 * price card open on a Project Board row (GcPriceCard.tsx):
 * the trigger it hangs from, and whether a click pinned it. Hover opens it after a moment and
 * closes it a moment after the pointer leaves, so the pointer can cross into the card.
 */
const OPEN_MS = 150
const CLOSE_MS = 200

/** Who holds the card open: the trigger it hangs from, and whether a click pinned it. */
export interface PriceCardHandle {
  anchor: HTMLElement | null
  pinned: boolean
  enter: (el: HTMLElement) => void
  leave: () => void
  toggle: (el: HTMLElement) => void
  close: () => void
  holdOpen: () => void
}

export function usePriceCard(): PriceCardHandle {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [pinned, setPinned] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const clear = () => window.clearTimeout(timer.current)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return {
    anchor,
    pinned,
    enter: (el) => {
      clear()
      timer.current = window.setTimeout(() => setAnchor(el), OPEN_MS)
    },
    leave: () => {
      clear()
      if (!pinned) timer.current = window.setTimeout(() => setAnchor(null), CLOSE_MS)
    },
    toggle: (el) => {
      clear()
      if (pinned && anchor === el) {
        setPinned(false)
        setAnchor(null)
      } else {
        setPinned(true)
        setAnchor(el)
      }
    },
    close: () => {
      clear()
      setPinned(false)
      setAnchor(null)
    },
    holdOpen: clear,
  }
}

