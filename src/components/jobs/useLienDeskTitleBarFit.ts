import { useLayoutEffect, useRef, useState } from 'react'
import { lienDeskPapersFit, lienDeskPileLineFit, lienDeskTitleLineFit, readLienDeskPileLine, readLienDeskTitleLine, type LienDeskPapersFit, type LienDeskPileLineFit, type LienDeskTitleLineFit } from '../../lib/jobs/lienDeskTitleBar'

/**
 * What the Lien desk's title bar has room for, measured (v2.7277, v2.7311; its own file since v2.7586, out of
 * `LienDesk.tsx` as it stood). The desk puts `titleBarRef` on the bar; the hook reads the line the bar drew and
 * again whenever the bar or one of its parts changes size. The rule is `lienDeskTitleBar.ts`. A phone is never
 * measured. Since v2.7789 it also answers whether By paper's paper tabs fit on the title line (`papersFit`).
 */
export function useLienDeskTitleBarFit({ isMobile, paperShown, kind }: { isMobile: boolean; paperShown: boolean; kind: string }) {
  // What the title line has room for at its end (v2.7213; measured since v2.7277): the four presses, or none. The
  // owner-records door was a tool too until v2.7780. The bar reads the line it drew; the rule is `lienDeskTitleBar.ts`. None until it is drawn.
  const titleBarRef = useRef<HTMLDivElement>(null)
  const [titleLineFit, setTitleLineFit] = useState<LienDeskTitleLineFit>('none')
  // Whether By paper's pile line holds its right span beside the piles, or the span falls under them (v2.7311). One line until measured.
  const [pileLineFit, setPileLineFit] = useState<LienDeskPileLineFit>('one_line')
  // Whether By paper's three paper tabs ride the title line, between the views and the tools (v2.7789). The second line until measured.
  const [papersFit, setPapersFit] = useState<LienDeskPapersFit>('second_line')
  useLayoutEffect(() => {
    const bar = titleBarRef.current
    if (isMobile || !bar) return
    const measure = () => {
      const line = readLienDeskTitleLine(bar)
      if (!line) {
        setPapersFit('second_line')
        return setTitleLineFit('none')
      }
      setTitleLineFit(lienDeskTitleLineFit(line.width, line.parts))
      const piles = readLienDeskPileLine(bar)
      // The paper tabs (v2.7789): their width is the same on either line, so the answer holds once they have moved.
      const papers = piles ? lienDeskPapersFit(line.width, line.parts, piles.parts.papers) : 'second_line'
      setPapersFit(papers)
      // The pile line (v2.7311): the span's width is the same at the line's end and under the piles, so the answer holds once the break is drawn. With the papers up, the line is measured without them.
      setPileLineFit(piles ? lienDeskPileLineFit(piles.width, piles.parts, papers) : 'one_line')
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    // The bar moves with the window; the views, the paper tabs and the piles move with their words. The presses keep their width wherever they sit.
    // The paper tabs are drawn anew when they change lines, so the effect runs again on `papersFit` and watches the new row.
    const ro = new ResizeObserver(measure)
    ro.observe(bar)
    for (const part of ['[data-lien-desk-kinds]', '[data-lien-desk-paper-kinds]', '[data-lien-desk-piles]', '[data-lien-desk-right]']) {
      const el = bar.querySelector(part)
      if (el) ro.observe(el)
    }
    return () => ro.disconnect()
  }, [isMobile, paperShown, kind, titleLineFit, papersFit])
  return { titleBarRef, titleLineFit, pileLineFit, papersFit }
}
