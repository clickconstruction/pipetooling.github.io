import { useLayoutEffect, type RefObject } from 'react'
import { scrollLeftToShow } from '../lib/scrollLeftToShow'

/** How much of the neighbouring pill stays in view beside the lit one, in pixels. */
export const LIT_PILL_PEEK = 24

/**
 * Keeps the lit pill of a sideways row of pills in view (v2.7878). The row marks its lit pill
 * with `aria-current="true"`. The hook reads where that pill sits and moves the row sideways, and
 * only the row: it sets `scrollLeft` and never calls `scrollIntoView`, which can move the page.
 *
 * It runs when the row first draws, when `litKey` changes (the lit pill, and anything that adds or
 * removes a pill) and when the window changes width.
 */
export function useLitPillInView(rowRef: RefObject<HTMLElement | null>, litKey: string): void {
  useLayoutEffect(() => {
    const show = () => {
      const row = rowRef.current
      const lit = row?.querySelector<HTMLElement>('[aria-current="true"]')
      if (!row || !lit) return
      const rowBox = row.getBoundingClientRect()
      const litBox = lit.getBoundingClientRect()
      const next = scrollLeftToShow({
        scrollLeft: row.scrollLeft,
        viewWidth: row.clientWidth,
        // The browser rounds both widths, which can leave the last pill a fraction of a pixel short. One
        // more pixel of room lets the answer reach the true end, where the browser stops it anyway.
        contentWidth: row.scrollWidth + 1,
        itemLeft: litBox.left - rowBox.left + row.scrollLeft,
        itemWidth: litBox.width,
        peek: LIT_PILL_PEEK,
      })
      if (next !== row.scrollLeft) row.scrollLeft = next
    }
    show()
    window.addEventListener('resize', show)
    return () => window.removeEventListener('resize', show)
  }, [rowRef, litKey])
}
