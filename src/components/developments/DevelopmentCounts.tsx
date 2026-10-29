/**
 * The head's five count tiles with their cards (punch list #208, design spike; the owner's pick A of
 * `counts-hover-mockup.html`). Rest on a tile and its card drops under it, the records grouped by
 * the count's own rule, each a door, the board's door in the foot; it stays while the pointer is on
 * it and leaves a beat after. A press pins the card until Escape or a press elsewhere; on a phone,
 * where nothing hovers, the press opens the card as a sheet under the tiles. The words come from
 * `countCards.ts`; this file is the behavior and the shape.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick'
import type { CountCard, CountDoor, CountFootDoor, CountKey } from '../../lib/developments/countCards'
import { capStyle, LinkButton } from './developmentPageBits'

export type CountTileSpec = { key: CountKey; cap: string; value: ReactNode; sub: ReactNode; tone?: 'amber' | 'green' }

const LEAVE_MS = 260
const ENTER_MS = 120

function CountCardBody({ card, sheet, onRow, onFoot, onClose }: { card: CountCard; sheet: boolean; onRow: (door: CountDoor) => void; onFoot: (door: CountFootDoor) => void; onClose: () => void }) {
  const row: CSSProperties = { display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 12px', fontSize: '0.78rem', minWidth: 0 }
  return (
    <div className="developmentCountCard" data-testid="development-count-card" role="dialog" aria-label={card.head}>
      <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <strong style={{ color: 'var(--text-strong)', fontSize: '0.84rem' }}>{card.head}</strong>
        {sheet ? (
          <button type="button" onClick={onClose} aria-label="Close" title="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit', fontSize: '1rem', lineHeight: 1, padding: '0 2px' }}>
            ×
          </button>
        ) : card.headMeta ? (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{card.headMeta}</span>
        ) : null}
      </div>
      {card.empty ? (
        <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{card.empty.lead}</strong> {card.empty.rest}
        </div>
      ) : (
        <div style={{ padding: '2px 0 4px' }}>
          {card.groups.map((g) => (
            <div key={g.label}>
              <div style={{ ...capStyle, padding: '6px 12px 2px' }}>{g.label}</div>
              {g.rows.map((r) => (
                <div key={r.key} className="developmentCountRow" style={row}>
                  <LinkButton onClick={() => onRow(r.door)} strong nowrap>
                    {r.number}
                  </LinkButton>
                  <span style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: sheet ? 'normal' : 'nowrap', color: 'var(--text-strong)' }}>{r.name || '—'}</span>
                  {r.value ? <span style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>{r.value}</span> : null}
                  {r.meta && !sheet ? <span style={{ flex: 'none', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{r.meta}</span> : null}
                </div>
              ))}
            </div>
          ))}
          {card.more > 0 ? <div style={{ padding: '3px 12px', fontSize: '0.76rem', color: 'var(--text-faint)' }}>and {card.more} more</div> : null}
          {card.folded ? <div style={{ padding: '6px 12px 2px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{card.folded}</div> : null}
        </div>
      )}
      <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', fontSize: '0.78rem' }}>
        <LinkButton onClick={() => onFoot(card.foot.door)} strong nowrap>
          {card.foot.label}
        </LinkButton>
        {card.foot.note ? <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textAlign: 'right' }}>{card.foot.note}</span> : null}
      </div>
    </div>
  )
}

export function DevelopmentCounts({ tiles, cards, phone, onRow, onFoot }: { tiles: CountTileSpec[]; cards: Record<CountKey, CountCard>; phone: boolean; onRow: (door: CountDoor) => void; onFoot: (door: CountFootDoor) => void }) {
  const [open, setOpen] = useState<CountKey | null>(null)
  const [pinned, setPinned] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<number | null>(null)
  const leaveTimer = useRef<number | null>(null)
  const clearTimers = () => {
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    enterTimer.current = null
    leaveTimer.current = null
  }
  const close = useCallback(() => {
    clearTimers()
    setOpen(null)
    setPinned(false)
  }, [])
  useCloseOnOutsideClick(wrapRef, open !== null, close)
  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])
  useEffect(() => clearTimers, [])

  // Hover: a beat before the card shows, a beat after the pointer leaves, nothing while pinned or on a phone.
  const hover = (key: CountKey) => {
    if (phone || pinned) return
    clearTimers()
    enterTimer.current = window.setTimeout(() => setOpen(key), ENTER_MS)
  }
  const leave = () => {
    if (phone || pinned) return
    clearTimers()
    leaveTimer.current = window.setTimeout(() => setOpen(null), LEAVE_MS)
  }
  const stay = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    leaveTimer.current = null
  }
  // A press pins the card (and on a phone is the only way in); a second press on the same tile lets go.
  const press = (key: CountKey) => {
    clearTimers()
    if (open === key && pinned) {
      close()
      return
    }
    setOpen(key)
    setPinned(true)
  }
  const act = (fn: () => void) => {
    close()
    fn()
  }

  return (
    <div ref={wrapRef} style={{ margin: '12px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? 'repeat(2, minmax(0, 1fr))' : `repeat(${tiles.length}, minmax(0, 1fr))`, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', position: 'relative' }} data-testid="development-counts">
        {tiles.map((t, i) => {
          const isOpen = open === t.key
          const last = i === tiles.length - 1
          return (
            <div
              key={t.key}
              className="developmentCountTile"
              data-open={isOpen ? '1' : undefined}
              data-pinned={isOpen && pinned ? '1' : undefined}
              data-testid={`development-count-${t.key}`}
              style={{ position: 'relative', minWidth: 0, borderRight: phone ? (i % 2 === 0 ? '1px solid var(--border)' : 'none') : last ? 'none' : '1px solid var(--border)', borderBottom: phone && i < tiles.length - 1 ? '1px solid var(--border)' : 'none', borderRadius: i === 0 ? '8px 0 0 8px' : last && !phone ? '0 8px 8px 0' : 0 }}
              onMouseEnter={() => hover(t.key)}
              onMouseLeave={leave}
            >
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                title={phone ? 'Tap for the detail' : 'Rest here for the detail; press to keep it open'}
                onClick={() => press(t.key)}
                onFocus={() => hover(t.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    press(t.key)
                  }
                }}
                style={{ padding: '10px 14px', cursor: 'pointer', outline: 'none' }}
              >
                <div style={capStyle}>{t.cap}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: t.tone === 'amber' ? 'var(--text-amber-800)' : t.tone === 'green' ? 'var(--text-green-700)' : 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{t.value}</div>
                {t.sub ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{t.sub}</div> : null}
              </div>
              {isOpen && !phone ? (
                <div
                  style={{ position: 'absolute', top: 'calc(100% + 6px)', ...(i >= tiles.length - 2 ? { right: 0 } : { left: 0 }), width: 380, maxWidth: '92vw', zIndex: 30 }}
                  onMouseEnter={stay}
                  onMouseLeave={leave}
                >
                  <CountCardBody card={cards[t.key]} sheet={false} onRow={(d) => act(() => onRow(d))} onFoot={(d) => act(() => onFoot(d))} onClose={close} />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {open && phone ? (
        <div style={{ marginTop: 8 }} data-testid="development-count-sheet">
          <CountCardBody card={cards[open]} sheet onRow={(d) => act(() => onRow(d))} onFoot={(d) => act(() => onFoot(d))} onClose={close} />
        </div>
      ) : null}
    </div>
  )
}
