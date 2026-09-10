import { useCallback, useState } from 'react'

const KEY = 'pt.bidFlow.inline.expanded'

/**
 * The bid flow strip's fold on the workflow tabs (v2.3241): folded by default to
 * one line beside the bid's title; unfolds to the full strip on a tap. Per device,
 * the way the Workbench's Solver fold is — a person who likes the full strip open
 * keeps it open on every bid.
 */
export function useBidFlowFold(): { expanded: boolean; toggle: () => void } {
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  const toggle = useCallback(() => {
    setExpanded((cur) => {
      const next = !cur
      try {
        window.localStorage.setItem(KEY, next ? '1' : '0')
      } catch {
        /* per-device convenience only */
      }
      return next
    })
  }, [])
  return { expanded, toggle }
}
