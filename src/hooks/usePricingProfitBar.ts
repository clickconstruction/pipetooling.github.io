/**
 * Bids → Pricing: "Where the profit lives" (v2.2353) — the bar's four values, moved out of
 * `BidsPricingTab` as they were: the hovered slice and its tooltip position, the click-pinned
 * detail card (keyed by count-row id so re-solves keep it), and the legend's fold (a device
 * preference). A click outside the bar, or Escape, lets go of the pin — that half of the
 * tab's shared outside-click effect lives here now.
 */
import { useEffect, useState } from 'react'

import { readProfitLegendCollapsed, writeProfitLegendCollapsed } from '../lib/bids/profitBarLegend'

export function usePricingProfitBar() {
  const [wbBarHover, setWbBarHover] = useState<number | null>(null)
  const [wbBarTipLeft, setWbBarTipLeft] = useState(0)
  const [wbBarPinnedId, setWbBarPinnedId] = useState<string | null>(null)
  const [wbLegendCollapsed, setWbLegendCollapsed] = useState<boolean>(() => readProfitLegendCollapsed(window.localStorage))

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (wbBarPinnedId && !target.closest('[data-profit-bar]')) {
        setWbBarPinnedId(null)
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && wbBarPinnedId) setWbBarPinnedId(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [wbBarPinnedId])

  function toggleLegend() {
    setWbLegendCollapsed((prev) => {
      const next = !prev
      writeProfitLegendCollapsed(window.localStorage, next)
      return next
    })
  }

  return { wbBarHover, setWbBarHover, wbBarTipLeft, setWbBarTipLeft, wbBarPinnedId, setWbBarPinnedId, wbLegendCollapsed, toggleLegend }
}

export type PricingProfitBarState = ReturnType<typeof usePricingProfitBar>
