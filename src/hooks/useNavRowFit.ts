import { useLayoutEffect, useRef, useState } from 'react'
import { NAV_ROW_ALL_ON_ROW, navRowFit, readNavRow, sameNavRowFit, type NavRowFit, type NavRowHas, type NavRowRemembered } from '../lib/navRowFit'

/**
 * Re-measure delays (ms after a pass is set up), as `useNavFitCollapse` keeps them: the header grows after mount
 * (`role` lands about half a second in and brings the coloured presses and the icon links), and a tab that never
 * renders gets no ResizeObserver callback.
 */
const NAV_ROW_SETTLE_MS = [0, 400, 1200] as const

/**
 * Which of the phone header's presses are rows of the gear menu because the row has no room for them, and whether
 * the row's gaps close up (`lib/navRowFit.ts` has the rule). `active` is false while the desktop row is drawn,
 * which this hook never measures: a desktop row that does not fit becomes the phone's row (`useNavFitCollapse`).
 * `has` says which presses this person has at all. `contentKey` is any value that changes when the row's content
 * does, so a change re-measures at once.
 *
 * The first measure runs in a layout effect, so a row that does not fit is never painted on two lines or past
 * the edge. Where nothing can be measured (jsdom), every press stays on the row.
 */
export function useNavRowFit(navRef: React.RefObject<HTMLElement | null>, active: boolean, has: NavRowHas, contentKey?: string): NavRowFit {
  const [fit, setFit] = useState<NavRowFit>(NAV_ROW_ALL_ON_ROW)
  const fitRef = useRef(fit)
  fitRef.current = fit
  const remembered = useRef<NavRowRemembered>({})
  const { wrench, people, customers } = has

  useLayoutEffect(() => {
    const settle = (next: NavRowFit) => {
      if (!sameNavRowFit(next, fitRef.current)) setFit(next)
    }
    if (!active) {
      settle(NAV_ROW_ALL_ON_ROW)
      return
    }
    const measure = () => {
      const el = navRef.current
      const row = el ? readNavRow(el, { wrench, people, customers }, remembered.current) : null
      if (!row) return
      remembered.current = { ...remembered.current, ...row.measured }
      settle(navRowFit(row.width, row.parts))
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    const timers = NAV_ROW_SETTLE_MS.map((ms) => window.setTimeout(measure, ms))
    // The row's two ends change width when a press arrives or leaves; the root covers a viewport change that
    // dispatches no resize event (device emulation).
    let ro: ResizeObserver | null = null
    const el = navRef.current
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(document.documentElement)
      if (el) {
        ro.observe(el)
        for (const child of Array.from(el.children)) ro.observe(child)
      }
    }
    // A row already too long keeps its ends' widths when one more press arrives, so the arrival itself is watched too.
    let mo: MutationObserver | null = null
    if (el && typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(measure)
      mo.observe(el, { childList: true, subtree: true })
    }
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      for (const t of timers) window.clearTimeout(t)
      ro?.disconnect()
      mo?.disconnect()
    }
  }, [navRef, active, wrench, people, customers, contentKey, fit])

  return active ? fit : NAV_ROW_ALL_ON_ROW
}
