import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { LienMarkCard, LienMarkCardDoor } from '../../lib/jobs/lienMarkCards'
import type { LienRunwayTone } from '../../lib/jobs/lienPayRunway'

/**
 * The hover card over a Deadlines mark (v2.5531): one column per card, side by side in the
 * marks' own order, each with its glyph, its title, its dated line, its facts, the jobs behind a
 * GC row's count and the board's own door. The card keeps inside its track: it slides left
 * when the mark is near the right edge, opens above the row when the list has no room below,
 * and its columns scroll sideways when they are wider than the track. The words come from
 * lib/jobs/lienMarkCards.ts; the tab wires the doors, the timers and the Esc that closes it.
 */

export type LienMarkCardView = LienMarkCard & { icon: ReactNode }

const COL_W = 236
const TONE_INK: Record<LienRunwayTone, string> = {
  green: 'var(--text-green-700)',
  amber: 'var(--text-amber-800)',
  red: 'var(--text-red-700)',
  grey: 'var(--text-700)',
}

export type LienMarkHoverCardProps = {
  cards: ReadonlyArray<LienMarkCardView>
  /** Where the first mark sits along the track, 0–100. */
  anchorPct: number
  /** The row's top edge inside the card's parent, where a card drawn above ends. */
  aboveBottom: number
  /** Where a card drawn below starts. */
  belowTop: number
  label: string
  onDoor: (door: LienMarkCardDoor, card: LienMarkCard) => void
  onEnter: () => void
  onLeave: () => void
}

export function LienMarkHoverCard({ cards, anchorPct, aboveBottom, belowTop, label, onDoor, onEnter, onLeave }: LienMarkHoverCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const colsRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ left: number; above: boolean; scrolls: boolean }>({ left: 0, above: false, scrolls: false })
  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return
    const trackW = parent.clientWidth
    const cardW = el.offsetWidth
    const anchor = (anchorPct / 100) * trackW
    const left = Math.max(0, Math.min(anchor - 12, trackW - cardW))
    // The list that scrolls: with no room under the row, the card opens above it.
    const list = el.closest<HTMLElement>('[data-lien-cal-list]')
    let above = false
    if (list) {
      const listRect = list.getBoundingClientRect()
      const rowRect = parent.getBoundingClientRect()
      const cardH = el.offsetHeight
      const roomBelow = listRect.bottom - rowRect.bottom
      const roomAbove = rowRect.top - listRect.top
      above = roomBelow < cardH + 12 && roomAbove > roomBelow
    }
    const cols = colsRef.current
    const scrolls = Boolean(cols && cols.scrollWidth > cols.clientWidth + 1)
    setPlace((p) => (p.left === left && p.above === above && p.scrolls === scrolls ? p : { left, above, scrolls }))
  }, [anchorPct, cards])
  const style: CSSProperties = {
    position: 'absolute',
    left: place.left,
    ...(place.above ? { bottom: aboveBottom } : { top: belowTop }),
    zIndex: 7,
    maxWidth: 'calc(100% - 4px)',
    width: 'max-content',
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 10,
    boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
    fontSize: '0.75rem',
    color: 'var(--text)',
    cursor: 'default',
  }
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-testid="lien-mark-card"
      data-above={place.above ? 'true' : undefined}
      data-scrolls={place.scrolls ? 'true' : undefined}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {place.scrolls ? (
        <span aria-hidden style={{ position: 'absolute', right: 8, top: 5, fontSize: '0.625rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>
          scrolls ▸
        </span>
      ) : null}
      <div ref={colsRef} className="lienMarkCardCols" style={{ display: 'flex', overflowX: 'auto', scrollbarGutter: 'stable' }}>
        {cards.map((c, i) => (
          <div key={c.key} data-testid="lien-mark-card-col" style={{ flex: `0 0 ${COL_W}px`, minWidth: 0, padding: '10px 12px 9px', borderRight: i < cards.length - 1 ? '1px solid var(--border)' : 'none', display: 'grid', gap: 4, alignContent: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.8125rem', minWidth: 0 }}>
              <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 16, flex: 'none' }}>
                {c.icon}
              </span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
            </div>
            {c.when ? (
              <div data-testid="lien-mark-card-when" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: TONE_INK[c.whenTone] }}>
                {c.when}
              </div>
            ) : null}
            {c.jobs.length ? (
              <div style={{ display: 'grid', gap: 2 }}>
                {c.jobs.map((j) => (
                  <div key={j.jobId} data-testid="lien-mark-card-job" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '0 8px', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-link)' }}>{j.number}</span>
                    <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {j.name}
                      {j.month ? <span style={{ color: 'var(--text-muted)' }}> · {j.month}</span> : null}
                    </span>
                    <span>{formatUsdNoCents(j.money)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {c.facts.map((f, k) => (
              <div key={k} style={{ color: 'var(--text-700)', lineHeight: 1.4 }}>
                {f}
              </div>
            ))}
            {c.door ? (
              <button type="button" data-testid="lien-mark-card-door" onClick={() => onDoor(c.door!, c)} style={{ justifySelf: 'start', marginTop: 2, font: 'inherit', fontSize: '0.75rem', fontWeight: 700, color: c.door.kind === 'lien_window' && c.glyph !== 'notice' ? 'var(--text-link)' : 'var(--text-amber-800)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                {c.door.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
