import type { OverheadPoolTrend } from '../../lib/overheadPoolTrend'

/**
 * People → Overhead "pool trend + composition" card (v2.2673). Presentational:
 * the tab feeds it the kernel output built inside its 90-day KPI effect.
 *
 * Three things, top to bottom: the verdict (up/down/flat vs the prior 30
 * days), what the pool is made of (office labor / bid labor / office parts —
 * the ledger the KPI trio never showed), and the day-by-day stacked chart with
 * a 7-day line. Series colors match the rest of the tab: purple = office
 * labor, blue = bid labor, amber = office parts.
 */

const SERIES = {
  office: { label: 'Office labor', color: '#8b5cf6' },
  bid: { label: 'Bid labor', color: 'var(--text-blue-500)' },
  parts: { label: 'Office parts', color: '#f59e0b' },
} as const

/** Whole dollars with a $ — the tab's formatCurrency omits the sign, and cents are noise on a 90-day pool. */
const money = (v: number): string => `$${Math.round(v).toLocaleString('en-US')}`

const W = 900
const H = 170
const ML = 46
const MR = 8
const MT = 10
const MB = 22

function monthLabel(ymd: string): string {
  const m = Number(ymd.slice(5, 7))
  return ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][m] ?? ''
}

function niceStep(max: number): number {
  const raw = max / 3
  const pow = 10 ** Math.floor(Math.log10(Math.max(1, raw)))
  const candidates = [1, 2, 2.5, 5, 10].map((k) => k * pow)
  return candidates.find((c) => c >= raw) ?? candidates[candidates.length - 1] ?? 1
}

export function OverheadPoolTrendCard({
  trend,
  loading,
  windowLabel,
}: {
  trend: OverheadPoolTrend | null
  loading: boolean
  windowLabel: string
}) {
  const verdict = (() => {
    if (loading || !trend) return null
    const pct = trend.deltaPct == null ? null : Math.round(Math.abs(trend.deltaPct) * 100)
    if (trend.direction === 'up')
      return {
        text: `↑ Trending up · +${pct}% vs the prior ${trend.compareDays} days`,
        color: 'var(--text-amber-900)',
        bg: 'var(--bg-amber-tint)',
        border: 'var(--border-amber)',
      }
    if (trend.direction === 'down')
      return {
        text: `↓ Trending down · −${pct}% vs the prior ${trend.compareDays} days`,
        color: 'var(--text-green-800)',
        bg: 'var(--bg-green-tint)',
        border: 'var(--border-green)',
      }
    return {
      text:
        trend.deltaPct == null
          ? `No trend yet — nothing in the prior ${trend.compareDays} days to compare`
          : `→ Flat · ${trend.deltaPct >= 0 ? '+' : '−'}${pct}% vs the prior ${trend.compareDays} days`,
      color: 'var(--text-muted)',
      bg: 'var(--bg-page)',
      border: 'var(--border)',
    }
  })()

  const chart = (() => {
    if (!trend || trend.days.length === 0) return null
    const n = trend.days.length
    const bw = (W - ML - MR) / n
    const maxRaw = Math.max(...trend.days.map((d) => Math.max(d.totalUsd, d.trailing7AvgUsd)), 1)
    const step = niceStep(maxRaw)
    const max = Math.ceil(maxRaw / step) * step * 1.05
    const y = (v: number) => H - MB - (v / max) * (H - MT - MB)
    const grid: number[] = []
    for (let g = step; g < max; g += step) grid.push(g)
    const linePath = trend.days
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${(ML + i * bw + bw / 2).toFixed(1)} ${y(d.trailing7AvgUsd).toFixed(1)}`)
      .join(' ')
    return { n, bw, y, grid, linePath }
  })()

  const pct = (part: number) => (trend && trend.totals.totalUsd > 0 ? Math.round((part / trend.totals.totalUsd) * 100) : 0)

  return (
    <div
      style={{
        marginBottom: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--bg-page)',
        padding: '0.6rem 0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--text-strong)', fontSize: '0.9375rem' }}>Overhead pool — 90 days</strong>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{windowLabel}</span>
        {verdict && (
          <span
            title={
              trend
                ? `Average $/day over the last ${trend.compareDays} days (${money(trend.recentAvgDailyUsd)}) vs the ${trend.compareDays} before (${money(trend.priorAvgDailyUsd)}). Within ±5% reads as flat. Calendar-day averages — zero-activity days count.`
                : undefined
            }
            style={{
              marginLeft: 'auto',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: verdict.color,
              background: verdict.bg,
              border: `1px solid ${verdict.border}`,
              borderRadius: 999,
              padding: '0.15rem 0.6rem',
            }}
          >
            {verdict.text}
          </span>
        )}
      </div>

      {loading || !trend ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
          {loading ? 'Loading…' : '—'}
        </div>
      ) : (
        <>
          <div style={{ marginTop: '0.5rem' }}>
            <div
              aria-hidden
              style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--border)' }}
            >
              {(
                [
                  ['office', trend.totals.officeLaborUsd],
                  ['bid', trend.totals.bidLaborUsd],
                  ['parts', trend.totals.officePartsUsd],
                ] as const
              ).map(([k, v]) =>
                v > 0 ? <span key={k} style={{ flex: v, background: SERIES[k].color }} /> : null,
              )}
            </div>
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                marginTop: '0.35rem',
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>
                <strong style={{ color: 'var(--text-strong)' }}>{money(trend.totals.totalUsd)}</strong> pool ·{' '}
                {money(trend.recentAvgDailyUsd)}/day lately
              </span>
              {(
                [
                  ['office', trend.totals.officeLaborUsd],
                  ['bid', trend.totals.bidLaborUsd],
                  ['parts', trend.totals.officePartsUsd],
                ] as const
              ).map(([k, v]) => (
                <span key={k}>
                  <i
                    aria-hidden
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: SERIES[k].color,
                      marginRight: 5,
                      verticalAlign: -1,
                    }}
                  />
                  {SERIES[k].label} <strong style={{ color: 'var(--text-strong)' }}>{money(v)}</strong> · {pct(v)}%
                </span>
              ))}
              <span>
                <i
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 2,
                    background: 'var(--text-strong)',
                    marginRight: 5,
                    verticalAlign: 3,
                  }}
                />
                7-day average
              </span>
            </div>
          </div>

          {chart && (
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label="Daily overhead pool, stacked by office labor, bid labor, and office parts, with a 7-day average line"
              style={{ display: 'block', width: '100%', height: 'auto', marginTop: '0.5rem' }}
            >
              {chart.grid.map((g) => (
                <g key={g}>
                  <line x1={ML} y1={chart.y(g)} x2={W - MR} y2={chart.y(g)} stroke="var(--border)" strokeWidth={1} />
                  <text x={ML - 6} y={chart.y(g) + 3.5} textAnchor="end" fill="var(--text-faint)" fontSize={10}>
                    ${g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)}k` : g}
                  </text>
                </g>
              ))}
              {trend.days.map((d, i) => {
                const x = ML + i * chart.bw + 0.6
                const w = Math.max(1.5, chart.bw - 1.2)
                let cursor = H - MB
                const seg = (v: number, color: string, key: string) => {
                  if (v <= 0) return null
                  // Bar height for v is the y-distance from the baseline to y(v).
                  const top = cursor - (chart.y(0) - chart.y(v))
                  const rect = <rect key={key} x={x} y={top} width={w} height={Math.max(0.5, cursor - top)} fill={color} />
                  cursor = top
                  return rect
                }
                const tip = `${d.ymd} · ${money(d.totalUsd)}\nOffice labor ${money(d.officeLaborUsd)} · Bid labor ${money(d.bidLaborUsd)} · Office parts ${money(d.officePartsUsd)}\n7-day avg ${money(d.trailing7AvgUsd)}`
                return (
                  <g key={d.ymd}>
                    <title>{tip}</title>
                    {seg(d.officeLaborUsd, SERIES.office.color, 'o')}
                    {seg(d.bidLaborUsd, SERIES.bid.color, 'b')}
                    {seg(d.officePartsUsd, SERIES.parts.color, 'p')}
                    <rect x={x} y={MT} width={w} height={H - MT - MB} fill="transparent" />
                    {(i === 0 || d.ymd.endsWith('-01')) && (
                      <text x={ML + i * chart.bw} y={H - 7} fill="var(--text-faint)" fontSize={10}>
                        {monthLabel(d.ymd)}
                      </text>
                    )}
                  </g>
                )
              })}
              <path d={chart.linePath} fill="none" stroke="var(--text-strong)" strokeWidth={1.6} opacity={0.85} />
            </svg>
          )}
          <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            Approved, wage-priced office + bid sessions and office-job parts only — the same pool behind the KPIs and lenses
            above. Anything the maintenance strip flags is missing here too.
          </p>
        </>
      )}
    </div>
  )
}
