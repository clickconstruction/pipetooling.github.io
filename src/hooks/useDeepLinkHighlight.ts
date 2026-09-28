/**
 * A deep link's ring: the row (or card) a link landed on is highlighted for a moment, then
 * let go. `gen` counts every flash, so landing on the same row twice still re-runs the
 * effects keyed on it (scroll into view, expand the card).
 *
 * Stage A of the Bids map's step 7 (`docs/BIDS_TABS_ARCHITECTURE.md`): the Bid Board and the
 * By builder lens each carried this — a highlight id, a generation, a timeout ref and the
 * unmount cleanup — written out three times in `src/pages/Bids.tsx`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export const DEEP_LINK_HIGHLIGHT_MS = 2500

export function useDeepLinkHighlight(ms: number = DEEP_LINK_HIGHLIGHT_MS) {
  const [id, setId] = useState<string | null>(null)
  const [gen, setGen] = useState(0)
  const timeoutRef = useRef<number | null>(null)

  /** Ring this id now; a ring already showing is replaced and its clock restarted. */
  const flash = useCallback(
    (nextId: string) => {
      setGen((g) => g + 1)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setId(nextId)
      timeoutRef.current = window.setTimeout(() => {
        setId(null)
        timeoutRef.current = null
      }, ms)
    },
    [ms],
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  return { id, gen, flash }
}
