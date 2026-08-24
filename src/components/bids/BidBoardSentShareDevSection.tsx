import { useMemo, useState, type CSSProperties } from 'react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import {
  buildSentShareByPerson,
  SENT_SHARE_OTHER_KEY,
  SENT_SHARE_UNASSIGNED_KEY,
  type SentShareRow,
} from '../../lib/bids/sentShareByPerson'

/**
 * "Who sends the bids" (v2.2218) — dev-only, under the estimator labor table in
 * the Health block: share of sent bids by person as 100%-stacked rows.
 * Monthly (6 rows) / Weekly (~26 slim rows) and By $ / By count toggles, both
 * sticky per device. Colors are fixed palette slots assigned by window-$ order
 * (the kernel's bucket order), one palette validated for both themes
 * (adjacent-pair CVD ΔE ≥ 8; see docs fragment); Other and Unassigned wear
 * gray. Percent shows inside a segment when it fits; exact numbers ride the
 * legend and each segment's title.
 */

// Slots 1–5 of the dataviz reference palette, dark-stepped set (passes the
// validator on BOTH surfaces); custom gray (not a theme-token neutral) for
// Other/Unassigned. Ink per slot keeps ≥4.5:1 on its own fill.
const SLOT_FILLS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'] as const
const SLOT_INKS = ['#ffffff', '#ffffff', '#062018', '#241802', '#2b0715'] as const
const GRAY_FILL = '#5d6675'
const GRAY_INK = '#eef1f5'

const VIEW_KEY = 'bid_board_sent_share_view_v1'

type Grain = 'monthly' | 'weekly'
type Measure = 'dollars' | 'count'

function readSticky(): { grain: Grain; measure: Measure } {
  try {
    const raw = window.localStorage.getItem(VIEW_KEY)
    const o = raw ? (JSON.parse(raw) as { grain?: string; measure?: string }) : null
    return {
      grain: o?.grain === 'weekly' ? 'weekly' : 'monthly',
      measure: o?.measure === 'count' ? 'count' : 'dollars',
    }
  } catch {
    return { grain: 'monthly', measure: 'dollars' }
  }
}

const moneyShort = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

export function BidBoardSentShareDevSection({ filteredBids }: { filteredBids: BidWithBuilder[] }) {
  const [{ grain, measure }, setView] = useState(readSticky)
  const setSticky = (next: { grain: Grain; measure: Measure }) => {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_KEY, JSON.stringify(next))
    } catch {
      /* device just won't remember */
    }
  }

  const data = useMemo(() => buildSentShareByPerson(filteredBids, new Date()), [filteredBids])

  const colorFor = useMemo(() => {
    const namedKeys = data.people.map((p) => p.key).filter((k) => k !== SENT_SHARE_OTHER_KEY && k !== SENT_SHARE_UNASSIGNED_KEY)
    return (key: string): { fill: string; ink: string } => {
      const i = namedKeys.indexOf(key)
      if (i >= 0 && i < SLOT_FILLS.length) return { fill: SLOT_FILLS[i]!, ink: SLOT_INKS[i]! }
      return { fill: GRAY_FILL, ink: GRAY_INK }
    }
  }, [data.people])

  if (data.people.length === 0) return null

  const rows = grain === 'monthly' ? data.monthly : data.weekly
  const slim = grain === 'weekly'
  const pill = (on: boolean): CSSProperties => ({
    font: 'inherit',
    fontSize: '0.78rem',
    fontWeight: on ? 650 : 400,
    padding: '0.25rem 0.8rem',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    background: on ? '#2563eb' : 'transparent',
    color: on ? '#fff' : 'var(--text-muted)',
  })

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Who sends the bids</h3>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 8px' }}>
        share of sent bids · last 6 months · dev only
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <button type="button" onClick={() => setSticky({ grain: 'monthly', measure })} aria-pressed={grain === 'monthly'} style={pill(grain === 'monthly')}>
          Monthly
        </button>
        <button type="button" onClick={() => setSticky({ grain: 'weekly', measure })} aria-pressed={grain === 'weekly'} style={pill(grain === 'weekly')}>
          Weekly
        </button>
        <span style={{ width: 10 }} />
        <button type="button" onClick={() => setSticky({ grain, measure: 'dollars' })} aria-pressed={measure === 'dollars'} style={pill(measure === 'dollars')}>
          By $
        </button>
        <button type="button" onClick={() => setSticky({ grain, measure: 'count' })} aria-pressed={measure === 'count'} style={pill(measure === 'count')}>
          By count
        </button>
      </div>
      <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.78rem', marginBottom: 10 }}>
        {data.people.map((p) => {
          const c = colorFor(p.key)
          const pct = measure === 'dollars' ? p.pctDollars : p.pctCount
          return (
            <span key={p.key} style={{ color: 'var(--text-700)', whiteSpace: 'nowrap' }}>
              <span aria-hidden style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: c.fill, marginRight: 5, verticalAlign: '-1px' }} />
              <b style={{ fontWeight: 650, color: 'var(--text-strong)' }}>{p.name}</b>{' '}
              <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {pct}% · {moneyShort(p.dollars)} · {p.count} bid{p.count === 1 ? '' : 's'}
              </span>
            </span>
          )
        })}
      </div>
      <div>
        {rows.map((r: SentShareRow, i) => (
          <div
            key={`${grain}-${i}`}
            style={{ display: 'grid', gridTemplateColumns: '52px 1fr 108px', gap: 10, alignItems: 'center', marginBottom: slim ? 5 : 8 }}
          >
            <span style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {r.monthTick ? <b style={{ fontWeight: 650, color: 'var(--text-700)', marginRight: 4 }}>{r.monthTick}</b> : null}
              {r.label}
            </span>
            {r.totalCount === 0 ? (
              <div aria-label={`${r.label}: nothing sent`} style={{ height: slim ? 16 : 26, borderRadius: 5, border: '1px dashed var(--border)', opacity: 0.5 }} />
            ) : (
              <div style={{ display: 'flex', gap: 2, height: slim ? 16 : 26, borderRadius: 5, overflow: 'hidden' }}>
                {r.segments.map((s) => {
                  const pct = measure === 'dollars' ? s.pctDollars : s.pctCount
                  if (pct <= 0) return null
                  const c = colorFor(s.key)
                  return (
                    <div
                      key={s.key}
                      title={`${s.name} — ${s.count} bid${s.count === 1 ? '' : 's'} · ${moneyShort(s.dollars)} · ${pct}% of ${r.label}`}
                      style={{ flexGrow: pct, flexBasis: 0, minWidth: 2, background: c.fill, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                      {!slim && pct >= 12 ? <span style={{ fontSize: '0.68rem', fontWeight: 650, color: c.ink }}>{Math.round(pct)}%</span> : null}
                    </div>
                  )
                })}
              </div>
            )}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {r.totalCount > 0 ? `${r.totalCount} · ${moneyShort(r.totalDollars)}` : '0'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
