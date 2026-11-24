import { useLayoutEffect, useState, type ReactNode } from 'react'
import { useMeasuredWidth } from '../../hooks/useMeasuredWidth'
import { takeoffLinesFit, tightenedLinesFit } from '../../lib/bids/takeoffSheetFit'

/**
 * The box around the takeoff line table (v2.8476). It measures itself and tells
 * the table how to draw (`data-fit`, `lib/bids/takeoffSheetFit.ts`): roomy, snug,
 * or scrolling sideways inside this box with the row's two presses pinned at its
 * right edge. The rules are in `index.css` under `.takeoffLinesBox`.
 *
 * A width alone cannot know the rows: a long amount or a fixture named in one
 * unbroken word can make the table wider than its box. So after each draw the box
 * checks whether the table overflowed anyway and steps one tighter for this width.
 * It judges only while its measured width is the width it has, and keeps no record
 * from one width to the next (v2.8494).
 *
 * The box keeps `overflow: visible` while the table fits, as it has since v2.1059:
 * the part search list hangs below its row and a clipping box cut it off on the
 * sheet's last rows. Only `scroll` clips, and there the rules make room for the list.
 */
export function TakeoffLinesBox({ children }: { children: ReactNode }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>()
  const at = width == null ? null : Math.round(width)
  const [seen, setSeen] = useState<{ at: number | null; overflows: number }>({ at: null, overflows: 0 })
  const overflows = seen.at === at ? seen.overflows : 0
  const fit = tightenedLinesFit(takeoffLinesFit(width), overflows)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // v2.8494: a window resize can redraw the page before this box has measured itself again. The layout is
    // then the new size and `at` the old one, and an overflow seen now would be written against the wrong
    // width, to be found again when the window comes back to it. So nothing is judged until the two agree.
    if (at != null && Math.round(el.getBoundingClientRect().width) !== at) return
    // A record made at another width says nothing about this one: start clean here.
    if (seen.at !== at && seen.overflows > 0) {
      setSeen({ at, overflows: 0 })
      return
    }
    if (fit === 'scroll') return
    if (el.scrollWidth > el.clientWidth + 1) setSeen({ at, overflows: overflows + 1 })
    // `children` is a new table on every draw of the tab, so this looks again whenever the rows may have changed.
  }, [ref, fit, at, overflows, seen, children])

  return (
    <div ref={ref} className="takeoffLinesBox" data-fit={fit} data-testid="takeoff-lines-box" style={{ border: '1px solid var(--border)', borderRadius: 4 }}>
      {children}
    </div>
  )
}
