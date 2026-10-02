import { useCallback, useState } from 'react'

const KEY = 'pt.pricing.bidsLikeThis.expanded'

/**
 * The fold of "Bids like this" on Bids → Pricing (v2.4418): one line by default, the compared
 * bids on a tap. Per device, the way the bid flow strip's fold is (`useBidFlowFold`).
 */
export function useBidsLikeThisFold(): { expanded: boolean; toggle: () => void } {
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
