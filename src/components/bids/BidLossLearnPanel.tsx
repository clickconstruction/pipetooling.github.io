import { useMemo, useState, type CSSProperties } from 'react'

import {
  BID_LOSS_LEARN_WINDOWS,
  LEARN_READ_LABELS,
  buildBidLossLearnStats,
  formatLearnPct,
  type BidLossLearnRow,
  type BidLossLearnWindowKey,
  type LearnBucket,
  type LearnReadKey,
} from '../../lib/bidLossLearn'
import { formatCurrency } from '../../lib/format'

/** Matches the reason-rollup's literal amber (saturated status colors stay literal). */
const AMBER = '#f59e0b'

const readChipColors: Record<LearnReadKey, { bg: string; fg: string }> = {
  razor: { bg: 'var(--bg-emerald-tint)', fg: 'var(--text-emerald-800)' },
  close: { bg: 'var(--bg-emerald-tint)', fg: 'var(--text-emerald-800)' },
  mid: { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)' },
  far: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-800)' },
}

const chartLabelStyle: CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
  margin: '0 0 0.5rem',
}

function BucketBars({ title, buckets, unit }: { title: string; buckets: LearnBucket[]; unit: string }) {
  const max = Math.max(1, ...buckets.map((b) => b.count))
  return (
    <div style={{ flex: '1 1 220px', minWidth: 200 }}>
      <p style={chartLabelStyle}>{title}</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 84, borderBottom: '1px solid var(--border-strong)' }}>
        {buckets.map((b) => (
          <div
            key={b.label}
            title={`${b.count} ${unit} ${b.label}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 3, height: '100%' }}
          >
            <span style={{ fontSize: '0.72rem', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>{b.count}</span>
            <div style={{ width: '100%', maxWidth: 44, borderRadius: '4px 4px 0 0', background: AMBER, height: `${Math.round((b.count / max) * 76)}%` }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {buckets.map((b) => (
          <span key={b.label} style={{ flex: 1, textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>{b.label}</span>
        ))}
      </div>
    </div>
  )
}

export type BidLossLearnPanelProps = {
  /** Lost bids in the lens's current estimator scope; the panel does its own window slicing. */
  rows: BidLossLearnRow[]
  /** One instant per mount, from the lens, so all memos share a clock. */
  nowIso: string
}

/**
 * "Why we lose on price — what the tabs say" (v2.2085): the compare-and-learn
 * rollup built from recorded bid tabs. Lives under the Why we lost reason
 * rollup; scoped by the lens's "bids by" estimator select, sliced here by time.
 */
export function BidLossLearnPanel({ rows, nowIso }: BidLossLearnPanelProps) {
  const [windowKey, setWindowKey] = useState<BidLossLearnWindowKey>('all')
  const stats = useMemo(() => buildBidLossLearnStats(rows, windowKey, nowIso), [rows, windowKey, nowIso])

  const windowPills = (
    <span style={{ display: 'inline-flex', gap: '0.25rem', marginLeft: 'auto' }} role="group" aria-label="Learn time range">
      {BID_LOSS_LEARN_WINDOWS.map((w) => {
        const active = w.key === windowKey
        return (
          <button
            key={w.key}
            type="button"
            aria-pressed={active}
            onClick={() => setWindowKey(w.key)}
            style={{
              fontSize: '0.72rem',
              padding: '0.16rem 0.55rem',
              borderRadius: 999,
              cursor: 'pointer',
              border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
              background: active ? 'var(--surface)' : 'transparent',
              color: 'var(--text-700)',
              fontWeight: active ? 600 : 400,
            }}
          >
            {w.label}
          </button>
        )
      })}
    </span>
  )

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.8rem 1rem', background: 'var(--surface)', marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Why we lose on price — what the tabs say</span>
        {windowPills}
      </div>

      {stats.tabbedCount === 0 ? (
        <p style={{ margin: '0.55rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          No bid tabs recorded {windowKey === 'all' ? 'yet' : 'in this range'}. When a GC shares one, save it from{' '}
          <strong>Bid tab received</strong> on Waiting to hear or <strong>record the bid tab</strong> on a lost bid card —
          this panel starts answering with the first tab.
        </p>
      ) : (
        <>
          <p style={{ margin: '0.55rem 0 0.1rem', fontSize: '0.95rem', color: 'var(--text-700)' }}>
            {stats.medianPct != null ? (
              <>
                When we lose on price, we're typically{' '}
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-amber-800)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatLearnPct(stats.medianPct)}
                </span>{' '}
                over the low.
              </>
            ) : (
              <>Every recorded tab so far had us at or below the low — price wasn't the reason.</>
            )}
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {' '}· tabs on {stats.tabbedCount} of {stats.lostCount} lost bids — every new tab sharpens this
            </span>
          </p>
          {stats.medianPct != null && stats.p25 != null && stats.p75 != null && stats.tabbedCount >= 4 ? (
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Half of the recorded losses land between <strong style={{ color: 'var(--text-700)' }}>{formatLearnPct(stats.p25)}</strong> and{' '}
              <strong style={{ color: 'var(--text-700)' }}>{formatLearnPct(stats.p75)}</strong> over.
              {stats.lowBidLossCount > 0
                ? ` ${stats.lowBidLossCount} loss${stats.lowBidLossCount === 1 ? '' : 'es'} came with us at or below the low — price wasn't the reason there.`
                : ''}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: '1.6rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
            <BucketBars title="How far over the low" buckets={stats.deltaBuckets} unit="losses" />
            {stats.rankBuckets.some((b) => b.count > 0) ? (
              <BucketBars title="Where we landed on the tab" buckets={stats.rankBuckets} unit="tabs at" />
            ) : null}
            {stats.quarters.length >= 2 ? (
              <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                <p style={chartLabelStyle}>Median over low, by quarter</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 84, borderBottom: '1px solid var(--border-strong)' }}>
                  {(() => {
                    const maxQ = Math.max(...stats.quarters.map((q) => q.medianPct), 1)
                    return stats.quarters.map((q) => (
                      <div
                        key={q.label}
                        title={`${q.label}: median ${formatLearnPct(q.medianPct)} over the low (${q.count} tab${q.count === 1 ? '' : 's'})`}
                        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 3, height: '100%' }}
                      >
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>{formatLearnPct(q.medianPct)}</span>
                        <span style={{ width: 9, height: 9, borderRadius: 999, background: AMBER }} />
                        <span style={{ width: 2, background: 'var(--bg-muted)', height: `${Math.round((q.medianPct / maxQ) * 52)}%` }} />
                      </div>
                    ))
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 18 }}>
                  {stats.quarters.map((q) => (
                    <span key={q.label} style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>{q.label}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem', marginTop: '0.7rem', minWidth: 620 }}>
              <thead>
                <tr>
                  {['GC / Builder', 'Tabs', 'Median over low', 'Usual spot', '$ on tabbed losses', 'Read'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i >= 1 && i <= 4 ? 'right' : 'left',
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        padding: '0.3rem 0.75rem 0.3rem 0',
                        borderBottom: '1px solid var(--border-strong)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.gcRows.map((g) => (
                  <tr key={g.builderKey}>
                    <td style={{ padding: '0.42rem 0.75rem 0.42rem 0', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-strong)' }}>{g.builderName}</td>
                    <td style={{ padding: '0.42rem 0.75rem 0.42rem 0', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.tabs}</td>
                    <td style={{ padding: '0.42rem 0.75rem 0.42rem 0', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {g.medianPct != null ? formatLearnPct(g.medianPct) : 'at/below low'}
                    </td>
                    <td style={{ padding: '0.42rem 0.75rem 0.42rem 0', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {g.usualRank != null ? `#${g.usualRank}` : '—'}
                    </td>
                    <td style={{ padding: '0.42rem 0.75rem 0.42rem 0', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      ${formatCurrency(g.dollars)}
                    </td>
                    <td style={{ padding: '0.42rem 0 0.42rem 0', borderBottom: '1px solid var(--border)' }}>
                      {g.read ? (
                        <span style={{ fontSize: '0.72rem', padding: '0.12rem 0.5rem', borderRadius: 999, whiteSpace: 'nowrap', background: readChipColors[g.read].bg, color: readChipColors[g.read].fg }}>
                          {LEARN_READ_LABELS[g.read]}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>low bid, still lost</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Sorted closest first — the top of the table is where a sharper pencil buys the most work.
          </p>
        </>
      )}
    </div>
  )
}
