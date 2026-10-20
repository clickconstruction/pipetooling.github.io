import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { CardStage } from '../../lib/gc/cardHead'
import type { TileDot, TileState } from '../../lib/gc/stageHealth'
import { BUYOUT_DOT_WORDS, STRIPE_WORDS, type TradeRow } from '../../lib/gc/tradeRows'
import { Chip } from './gcUi'

/**
 * GC mode, a project's card (to-do #108, PR 3): the trades as one row each, from `tradeRows.ts`. The row is the
 * stripe, the trade and who has it, the scope, the money, where it stands, who is asked (while bidding), what waits
 * (once awarded) and the one press; under it, folded by ›, the page draws the scope lines, the statement of work and
 * the asks as they were. The rows open by default: the asks are the day's work while bidding.
 */

/** The tile colours, saturated on purpose, like the ring's: they are status marks. */
const STRIPE: Record<TileState, string> = { good: '#22c55e', warn: '#f59e0b', bad: '#ef4444', ours: '#8b5cf6' }
const DOT: Record<TileDot, string> = { on: '#22c55e', wait: '#f59e0b', us: '#ef4444', off: 'transparent' }

const TONE: Record<'good' | 'warn' | 'bad' | 'plain', string> = {
  good: 'var(--text-green-700)',
  warn: 'var(--text-amber-700)',
  bad: 'var(--text-red-700)',
  plain: 'var(--text-base)',
}

const cell = (basis: string, grow = 0): CSSProperties => ({ flex: `${grow} 1 ${basis}`, minWidth: 0 })
const head: CSSProperties = { fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }

/** Which cells a stage's rows carry, in order, with the width each wants. */
function columns(stage: CardStage): { key: string; label: string; basis: string; grow?: number }[] {
  if (stage === 'bidding')
    return [
      { key: 'trade', label: 'Trade', basis: '9rem' },
      { key: 'scope', label: 'Scope', basis: '7rem' },
      { key: 'money', label: 'Budget', basis: '5.5rem' },
      { key: 'standing', label: 'Quotes', basis: '6.5rem' },
      { key: 'asked', label: 'Asked', basis: '12rem', grow: 1 },
      { key: 'next', label: 'Next', basis: '9rem' },
    ]
  return [
    { key: 'trade', label: 'Trade · company', basis: '11rem' },
    { key: 'scope', label: 'Scope', basis: '7.5rem' },
    { key: 'money', label: 'Contract', basis: '7rem' },
    { key: 'standing', label: stage === 'buyout' ? 'Papers' : 'Done', basis: '7.5rem' },
    { key: 'waiting', label: 'Waiting on', basis: '12rem', grow: 1 },
  ]
}

export function GcTradeRows({
  stage,
  rows,
  details,
  onNext,
  tourGaps,
}: {
  stage: CardStage
  rows: TradeRow[]
  /** What the page draws under a row: the scope lines, the statement of work, the asks. */
  details: (row: TradeRow) => ReactNode
  onNext: (row: TradeRow) => void
  /** The walkthrough's gaps anchor goes on the first card's rows box. */
  tourGaps?: string
}) {
  const [folded, setFolded] = useState<Set<string>>(() => new Set())
  const box = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(([entry]) => setWide((entry?.contentRect.width ?? 900) >= 680))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const cols = columns(stage)
  const toggle = (id: string) =>
    setFolded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <div ref={box} data-gc-trade-rows={stage} data-tour={tourGaps} style={{ display: 'grid', minWidth: 0 }}>
      {wide && rows.length > 0 && (
        <div aria-hidden style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', padding: '0 0.5rem 0.3rem 0.85rem', borderBottom: '1px solid var(--border)' }}>
          {cols.map((c) => (
            <span key={c.key} style={{ ...cell(c.basis, c.grow), ...head }}>
              {c.label}
            </span>
          ))}
          <span style={{ width: '1.4rem', flex: 'none' }} />
        </div>
      )}
      {rows.map((r) => {
        const open = !folded.has(r.id)
        const stripe = r.stripe === 'none' ? 'var(--border)' : STRIPE[r.stripe]
        const cells: Record<string, ReactNode> = {
          trade: (
            <span style={{ display: 'grid', gap: 0, minWidth: 0 }}>
              <span style={{ fontWeight: 700, display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {r.trade}
                {r.ours && stage === 'bidding' && <Chip tone="blue">ours</Chip>}
              </span>
              {r.who && stage !== 'bidding' && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.who}</span>}
            </span>
          ),
          scope: <span style={{ color: 'var(--text-muted)' }}>{r.scope}</span>,
          money: r.money ? (
            <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }} title={r.money.label}>
              {r.money.words}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{r.ours ? 'ours' : wide ? '—' : ''}</span>
          ),
          standing: r.standing ? (
            r.standing.kind === 'quotes' ? (
              <span style={{ fontWeight: 700, color: TONE[r.standing.tone] }}>{r.standing.words}</span>
            ) : r.standing.kind === 'dots' ? (
              <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }} title={BUYOUT_DOT_WORDS}>
                <span style={{ display: 'inline-flex', gap: 3 }} aria-label={r.standing.dots.join(', ')}>
                  {r.standing.dots.map((d, i) => (
                    <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block', background: DOT[d], border: `1.5px solid ${d === 'off' ? 'var(--border-strong)' : DOT[d]}` }} />
                  ))}
                </span>
                <span style={{ fontSize: '0.8rem' }}>{r.standing.words}</span>
              </span>
            ) : r.standing.kind === 'words' ? (
              <span style={{ fontWeight: 600, color: r.standing.tone === 'bad' ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{r.standing.words}</span>
            ) : (
              <span style={{ display: 'grid', gridTemplateColumns: '2.6rem minmax(0, 1fr)', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.standing.words}</span>
                <span style={{ height: 7, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.min(100, r.standing.pct)}%`, background: r.stripe === 'none' ? 'var(--border-strong)' : STRIPE[r.stripe], borderRadius: 999 }} />
                </span>
              </span>
            )
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{r.ours ? 'our own bid' : wide ? '—' : ''}</span>
          ),
          asked:
            r.asked.length > 0 ? (
              <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {r.asked.map((a) => (
                  <Chip key={a.company} tone={a.tone} title={`${a.company} · ${a.words}`} small>
                    {a.company.split(' ')[0]} · {a.words}
                  </Chip>
                ))}
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>{r.ours ? 'our own crew' : 'nobody yet'}</span>
            ),
          waiting: <span style={{ color: r.stripe === 'bad' ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{r.waiting ?? (wide ? '—' : '')}</span>,
          next: r.next ? (
            <button
              type="button"
              onClick={() => onNext(r)}
              style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: r.next.key === 'compare' ? '#2563eb' : 'var(--surface)', color: r.next.key === 'compare' ? '#fff' : 'var(--text-base)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {r.next.words}
            </button>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{wide ? '—' : ''}</span>
          ),
        }
        return (
          <div key={r.id} data-gc-trade-row={r.id} data-gc-trade-stripe={r.stripe} style={{ display: 'grid', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.45rem 0.5rem 0.45rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem', flexWrap: wide ? 'nowrap' : 'wrap', minWidth: 0 }}>
              <span aria-hidden style={{ width: 5, alignSelf: 'stretch', minHeight: '1.6rem', borderRadius: 2, background: stripe, flex: 'none', marginRight: '0.25rem' }} />
              {cols.map((c) => (
                <span key={c.key} style={cell(c.basis, c.grow)}>
                  {cells[c.key]}
                </span>
              ))}
              <button
                type="button"
                aria-expanded={open}
                aria-label={open ? `Fold ${r.trade}` : `Open ${r.trade}`}
                onClick={() => toggle(r.id)}
                style={{ width: '1.4rem', flex: 'none', marginLeft: wide ? 0 : 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', font: 'inherit', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}
              >
                ›
              </button>
            </div>
            {open && (
              <div data-gc-trade-details={r.id} style={{ padding: '0 0.5rem 0.6rem 1rem', display: 'grid', gap: '0.3rem', fontSize: '0.85rem', borderLeft: `3px solid ${stripe}`, marginLeft: '0.1rem' }}>
                {details(r)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** The colours' key, drawn by the band when its Key link is on. */
export function GcTradeRowsKey({ stage }: { stage: CardStage }) {
  return (
    <div data-gc-tile-key style={{ display: 'flex', gap: '0.3rem 1rem', flexWrap: 'wrap', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
      {STRIPE_WORDS.map((k) => (
        <span key={k.state} style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: STRIPE[k.state], display: 'inline-block' }} />
          {k.words}
        </span>
      ))}
      {stage === 'buyout' && <span>{BUYOUT_DOT_WORDS}</span>}
      {stage === 'bidding' && <span>A chip a company asked: red has not opened it, blue is looking, green sent a quote.</span>}
    </div>
  )
}
