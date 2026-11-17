import { useLayoutEffect, useRef, useState } from 'react'
import { lienDeskPileLineFit, lienDeskTitleLineFit, readLienDeskPileLine, readLienDeskTitleLine, type LienDeskPileLineFit, type LienDeskTitleLineFit } from '../../lib/jobs/lienDeskTitleBar'

/**
 * What the Lien desk's title bar has room for, measured (v2.7277, v2.7311; its own file since v2.7586, out of
 * `LienDesk.tsx` as it stood). The desk puts `titleBarRef` on the bar; the hook reads the line the bar drew and
 * again whenever the bar or one of its parts changes size. The rule is `lienDeskTitleBar.ts`. A phone is never
 * measured.
 */
export function useLienDeskTitleBarFit({ isMobile, recordsDoorShown, paperShown, gcNoticeShown, kind }: { isMobile: boolean; recordsDoorShown: boolean; paperShown: boolean; gcNoticeShown: boolean; kind: string }) {
  // What the title line has room for at its end (v2.7213; measured since v2.7277): all five tools, the four presses with the
  // owner-records door under them, or none. The bar reads the line it drew; the rule is `lienDeskTitleBar.ts`. None until it is drawn.
  const titleBarRef = useRef<HTMLDivElement>(null)
  const [titleLineFit, setTitleLineFit] = useState<LienDeskTitleLineFit>('none')
  // Whether By paper's pile line holds its right span beside the piles, or the span falls under them (v2.7311). One line until measured.
  const [pileLineFit, setPileLineFit] = useState<LienDeskPileLineFit>('one_line')
  useLayoutEffect(() => {
    const bar = titleBarRef.current
    if (isMobile || !bar) return
    const measure = () => {
      const line = readLienDeskTitleLine(bar)
      if (!line) return setTitleLineFit('none')
      setTitleLineFit(lienDeskTitleLineFit(line.width, line.parts))
      // The pile line (v2.7311): the span's width is the same at the line's end and under the piles, so the answer holds once the break is drawn.
      const piles = readLienDeskPileLine(bar)
      setPileLineFit(piles ? lienDeskPileLineFit(piles.width, piles.parts) : 'one_line')
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    // The bar moves with the window; the views, the paper tabs and the piles move with their words. The door and the presses keep their widths wherever they sit.
    const ro = new ResizeObserver(measure)
    ro.observe(bar)
    for (const part of ['[data-lien-desk-kinds]', '[data-lien-desk-paper-kinds]', '[data-lien-desk-piles]', '[data-lien-desk-right]']) {
      const el = bar.querySelector(part)
      if (el) ro.observe(el)
    }
    return () => ro.disconnect()
  }, [isMobile, recordsDoorShown, paperShown, gcNoticeShown, kind, titleLineFit])
  return { titleBarRef, titleLineFit, pileLineFit }
}
