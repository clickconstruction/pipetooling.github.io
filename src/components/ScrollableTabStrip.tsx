import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

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
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
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
    if (!activeKey) return
    const tabs = scrollRef.current?.querySelectorAll<HTMLElement>('[data-tabkey]') ?? []
    const el = Array.from(tabs).find((t) => t.dataset.tabkey === activeKey)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    syncFades()
  }, [activeKey, syncFades])

  const fadeStyle = (side: 'left' | 'right') => ({
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    [side]: 0,
    width: 28,
    background: `linear-gradient(to ${side}, transparent, ${fadeColor})`,
    pointerEvents: 'none' as const,
  })

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
      {fade.left && <div aria-hidden style={fadeStyle('left')} />}
      {fade.right && <div aria-hidden style={fadeStyle('right')} />}
    </div>
  )
}
