/**
 * Materials → Parts Book: What your materials cost (v2.4391). One card over the parts list: the
 * month-by-month number for the parts you bid with, how fresh the prices behind it are, and the
 * prices that moved lately. The math is `lib/materials/materialPriceIndex.ts`; the reads are
 * `useMaterialPriceIndex`. Renders and reports nothing else; it writes nothing.
 */
import type { CSSProperties } from 'react'
import { useMaterialPriceIndex, type MaterialPriceIndexState } from '../../hooks/useMaterialPriceIndex'
import { helpGuideHref } from '../../lib/helpGuideAnchors'
import { changeText, monthName, verdictText, type IndexMonth, type MaterialPriceIndex } from '../../lib/materials/materialPriceIndex'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

export const MATERIAL_PRICES_GUIDE = 'track-what-your-materials-cost'

const label: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }
const FRESH_COLORS = { within30: '#15803d', within90: '#86efac', older: '#f59e0b' } as const

const pct = (share: number) => `${Math.round(share * 100)}%`

/** The small line: faint (dashed, grey) where too few of the parts had a price yet. */
export function MaterialPricesSparkline({ months, width = 260, height = 56 }: { months: IndexMonth[]; width?: number; height?: number }) {
  if (months.length < 2) return null
  const values = months.map((m) => m.index)
  const lo = Math.min(99, ...values)
  const hi = Math.max(101, ...values)
  const padX = 6
  const padY = 6
  const x = (i: number) => padX + (i * (width - 2 * padX)) / (months.length - 1)
  const y = (v: number) => padY + ((hi - v) * (height - 2 * padY)) / (hi - lo)
  const segments = months.slice(1).map((m, i) => ({ faint: m.faint, d: `M${x(i).toFixed(1)},${y(values[i]!).toFixed(1)} L${x(i + 1).toFixed(1)},${y(m.index).toFixed(1)}` }))
  const last = months[months.length - 1]!
  const first = months[0]!
  return (
    <svg
      width={width}
      height={height + 16}
      viewBox={`0 0 ${width} ${height + 16}`}
      role="img"
      aria-label={`From ${monthName(first.month)} to ${monthName(last.month)}: ${values.map((v) => v.toFixed(1)).join(', ')}`}
      style={{ display: 'block', maxWidth: '100%' }}
    >
      <line x1={padX} x2={width - padX} y1={y(100)} y2={y(100)} stroke="var(--border)" strokeDasharray="3 3" />
      {segments.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={s.faint ? 'var(--text-faint)' : '#2563eb'} strokeWidth={s.faint ? 2 : 2.5} strokeDasharray={s.faint ? '4 4' : undefined} />
      ))}
      <circle cx={x(months.length - 1)} cy={y(last.index)} r={3.5} fill="#2563eb" />
      <text x={padX} y={height + 13} fontSize={11} fill="var(--text-muted)">{monthName(first.month).slice(0, 3)}</text>
      <text x={width - padX} y={height + 13} fontSize={11} fill="var(--text-muted)" textAnchor="end">{monthName(last.month).slice(0, 3)}</text>
    </svg>
  )
}

function FreshnessBar({ freshness }: { freshness: MaterialPriceIndex['freshness'] }) {
  const parts = [
    { key: 'within30', share: freshness.within30, text: `${pct(freshness.within30)} checked in the last 30 days` },
    { key: 'within90', share: freshness.within90, text: `${pct(freshness.within90)} checked 31 to 90 days ago` },
    { key: 'older', share: freshness.older, text: `${pct(freshness.older)} older than 90 days` },
  ] as const
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div role="img" aria-label={parts.map((p) => p.text).join(', ')} style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-muted)' }}>
        {parts.map((p) => (
          <span key={p.key} style={{ width: `${p.share * 100}%`, background: FRESH_COLORS[p.key] }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.75rem' }}>
        {parts.map((p) => (
          <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: FRESH_COLORS[p.key], flex: '0 0 auto' }} />
            {p.text}
          </span>
        ))}
      </div>
    </div>
  )
}

/** The card for a computed index; the loading and error states are one quiet line. */
export function MaterialPricesCardView({ state }: { state: MaterialPriceIndexState }) {
  if (state.status === 'loading') return <div style={{ ...muted, marginBottom: '1rem' }}>Reading your material prices…</div>
  if (state.status === 'error') return <div style={{ ...muted, marginBottom: '1rem' }}>Couldn’t read your material prices just now.</div>
  const index = state.index
  if (!index) return null
  const base = monthName(index.baseMonth)
  const anyFaint = index.months.some((m) => m.faint)
  return (
    <section
      aria-label="What your materials cost"
      style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-subtle)', padding: '1rem 1.1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem 2rem', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem' }}>
            <span style={label}>What your materials cost</span>
            <a href={helpGuideHref(MATERIAL_PRICES_GUIDE)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--text-link)' }}>How this works</a>
          </div>
          {index.showNumber ? (
            <>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--text-strong)' }}>{verdictText(index)}</div>
              <div style={muted}>{index.latest.toFixed(1)} against 100 in {base}. These are the parts you bid with, each counted by what you spend on it.</div>
              <MaterialPricesSparkline months={index.months} />
              {anyFaint ? <div style={{ ...muted, fontSize: '0.75rem' }}>The line is faint where too few of these parts had a price yet.</div> : null}
              {index.last3 != null ? (
                <div style={{ fontSize: '0.8125rem' }}>
                  Last 3 months: <strong>{changeText(index.last3)}</strong>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--text-strong)' }}>Not enough fresh prices to say</div>
              <div style={muted}>Less than half of your bid dollars sit on a price checked in the last 90 days.</div>
            </>
          )}
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={label}>How fresh</span>
          <FreshnessBar freshness={index.freshness} />
          <div style={{ fontSize: '0.8125rem' }}>{pct(index.freshness.older)} of your bid dollars sit on a price older than 90 days.</div>
        </div>
      </div>
      {index.moved.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={label}>Moved lately</span>
          {index.moved.map((m) => {
            const up = m.change > 0
            return (
              <div key={`${m.partId}|${m.houseId}`} style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', padding: '0.45rem 0', borderTop: '1px solid var(--border)', fontSize: '0.8125rem', flexWrap: 'wrap' }}>
                <span style={{ width: '4.75rem', fontWeight: 700, color: up ? 'var(--text-orange-700)' : 'var(--text-blue-700)', fontVariantNumeric: 'tabular-nums' }}>
                  {up ? '▲' : '▼'} {(Math.abs(m.change) * 100).toFixed(1)}%
                </span>
                <span style={{ flex: '1 1 14rem', minWidth: 0 }}>
                  <strong style={{ overflowWrap: 'anywhere' }}>{m.partName}</strong>
                  <span style={{ color: 'var(--text-muted)' }}> · {m.houseName} · {formatWorkDateYmdMonthDayShort(m.day)}</span>
                </span>
                {m.openBidCount > 0 ? <span style={{ color: 'var(--text-muted)' }}>on {m.openBidCount} open bid{m.openBidCount === 1 ? '' : 's'}</span> : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

/** The Parts Book's card for the trade on screen. */
export function MaterialPricesCard({ serviceTypeId }: { serviceTypeId: string | null }) {
  const state = useMaterialPriceIndex(serviceTypeId)
  return <MaterialPricesCardView state={state} />
}
