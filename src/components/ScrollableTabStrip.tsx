import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { scrollLeftToShow } from '../lib/scrollLeftToShow'

/** A fade that carries an arrow is this wide: the row fades over its first 60% and the arrow has the rest. */
const EDGE_MARK_FADE_PX = 32

/**
 * Single-row tab strip (v2.1331, built for the Bids header): centers its
 * children while they fit, and the moment they don't it becomes a horizontal
 * scroller — no wrapping, no orphaned rows. Edge fades appear on whichever
 * side has more content, and the active tab is scrolled into view when
 * `activeKey` changes (deep links land with the right tab visible).
 *
 * Callers tag each tab element with `data-tabkey="<key>"` so the strip can
 * find the active one. The centering trick: an inner flex row with
 * `margin-inline: auto` — auto margins center it when narrower than the
 * scroller and collapse to 0 when wider, which keeps the left edge reachable
 * (plain `justify-content: center` clips it).
 *
 * `activePeek` (v2.8288, the Jobs and People rows under the new phone layout) is a second way to keep the
 * active tab in view. Without it the browser's `scrollIntoView` puts the tab flush against the edge, under
 * the fade, where a filled tab reads as washed out and nothing of the next tab shows. With it the row alone
 * is moved (`scrollLeftToShow`, never the page) so the tab is whole and that much of its neighbour shows past
 * it, cut by the edge. It is kept so when the row's own width changes too, for tabs that land after the
 * first draw.
 *
 * `edgeMarks` (the same rows) draws a small arrow in each fade. A fade is the row's own colour, so where the
 * edge falls on the blank between two tabs it shows nothing: on a 393 px phone an assistant's Jobs row ended
 * on *Billing* with five tabs past it and no sign of them. The arrow says the row goes on wherever the edge
 * falls. It is drawn, not pressed: a touch goes through it to the tab under it.
 */
export function ScrollableTabStrip({
  children,
  activeKey,
  ariaLabel,
  fadeColor = 'var(--bg-page)',
  gap = '0.25rem',
  align = 'center',
  role,
  fadeSlack = 2,
  activePeek,
  edgeMarks = false,
}: {
  children: ReactNode
  /** When set, the element with a matching `data-tabkey` is kept in view. */
  activeKey?: string
  ariaLabel?: string
  /** Background the edge fades blend into (default: the page background). */
  fadeColor?: string
  gap?: string
  /** `start` keeps a short row at the left edge, where a wrapping row would have put it (the Job updates pills). */
  align?: 'center' | 'start'
  /** The scroller's role, with `ariaLabel` as its name: `tablist` for a row of filter pills. */
  role?: string
  /** How many pixels may hide past an edge before that edge's fade is drawn (default 2). */
  fadeSlack?: number
  /** How many pixels of the neighbouring tab stay in view beside the active one. Unset, the tab is put flush against the edge as before. */
  activePeek?: number
  /** Draws a small arrow in each fade. A fade over a blank stretch of the row shows nothing, and the arrow still says the row goes on. */
  edgeMarks?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState({ left: false, right: false })

  const syncFades = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setFade((prev) => {
      const next = { left: el.scrollLeft > fadeSlack, right: el.scrollLeft < max - fadeSlack }
      return next.left === prev.left && next.right === prev.right ? prev : next
    })
  }, [fadeSlack])

  useEffect(() => {
    syncFades()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', syncFades, { passive: true })
    window.addEventListener('resize', syncFades)
    return () => {
      el.removeEventListener('scroll', syncFades)
      window.removeEventListener('resize', syncFades)
    }
  }, [syncFades])

  useEffect(() => {
    if (!activeKey || activePeek != null) return
    const tabs = scrollRef.current?.querySelectorAll<HTMLElement>('[data-tabkey]') ?? []
    const el = Array.from(tabs).find((t) => t.dataset.tabkey === activeKey)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    syncFades()
  }, [activeKey, activePeek, syncFades])

  // With a peek: before the first paint, so the row never opens on the wrong tabs and then jumps.
  useLayoutEffect(() => {
    if (!activeKey || activePeek == null) return
    const show = () => {
      const scroller = scrollRef.current
      if (!scroller) return
      const tabs = scroller.querySelectorAll<HTMLElement>('[data-tabkey]')
      const tab = Array.from(tabs).find((t) => t.dataset.tabkey === activeKey)
      if (tab) {
        const scrollerBox = scroller.getBoundingClientRect()
        const tabBox = tab.getBoundingClientRect()
        const next = scrollLeftToShow({
          scrollLeft: scroller.scrollLeft,
          viewWidth: scroller.clientWidth,
          // The browser rounds both widths, which can leave the last tab a fraction of a pixel short. One more
          // pixel of room lets the answer reach the true end, where the browser stops it anyway.
          contentWidth: scroller.scrollWidth + 1,
          itemLeft: tabBox.left - scrollerBox.left + scroller.scrollLeft,
          itemWidth: tabBox.width,
          peek: activePeek,
        })
        if (next !== scroller.scrollLeft) scroller.scrollLeft = next
      }
      syncFades()
    }
    show()
    // A phone fires `resize` as its address bar folds away on a scroll down the page. Only a new width moves the
    // row, so a row the person has slid sideways stays where they left it.
    let width = scrollRef.current?.clientWidth
    const onResize = () => {
      const now = scrollRef.current?.clientWidth
      if (now === width) return
      width = now
      show()
    }
    window.addEventListener('resize', onResize)
    // The row's width changes when a tab lands late (a role read after the first draw) or the page's font does.
    const row = rowRef.current
    const watch = row && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(show) : null
    if (row && watch) watch.observe(row)
    return () => {
      window.removeEventListener('resize', onResize)
      watch?.disconnect()
    }
  }, [activeKey, activePeek, syncFades])

  const fadeStyle = (side: 'left' | 'right') => ({
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    [side]: 0,
    width: 28,
    background: `linear-gradient(to ${side}, transparent, ${fadeColor})`,
    pointerEvents: 'none' as const,
    // The arrow sits against the edge on a stretch that is the row's own colour all through, so a cut word ends
    // before the arrow and never runs under it.
    ...(edgeMarks
      ? {
          width: EDGE_MARK_FADE_PX,
          background: `linear-gradient(to ${side}, transparent, ${fadeColor} 60%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: side === 'right' ? ('flex-end' as const) : ('flex-start' as const),
        }
      : null),
  })
  /** The small arrow of an edge that has more past it, pointing the way the row goes on. */
  const edgeMark = (side: 'left' | 'right') =>
    edgeMarks ? (
      <svg data-edge-mark={side} width="9" height="14" viewBox="0 0 9 14" fill="none" style={{ color: 'var(--text-muted)', display: 'block', margin: '0 2px' }}>
        <path d={side === 'right' ? 'M2 2l5 5-5 5' : 'M7 2L2 7l5 5'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : null

  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <div
        ref={scrollRef}
        role={role}
        aria-label={ariaLabel}
        className="tab-strip-scroll"
        style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}
      >
        <div
          ref={rowRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap,
            flexWrap: 'nowrap',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            marginLeft: align === 'start' ? 0 : 'auto',
            marginRight: 'auto',
          }}
        >
          {children}
        </div>
      </div>
      {fade.left && <div aria-hidden style={fadeStyle('left')}>{edgeMark('left')}</div>}
      {fade.right && <div aria-hidden style={fadeStyle('right')}>{edgeMark('right')}</div>}
    </div>
  )
}
