import { useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import type { OverheadPoolTrend } from '../../lib/overheadPoolTrend'
import { OVERHEAD_POOL_SERIES, overheadPoolTypicalLabel, type OverheadPoolCategory, type OverheadPoolDayIndex, type OverheadPoolPartsLine } from '../../lib/overheadPoolDayLines'
import type { OverheadPoolDayModalCategory } from './OverheadPoolDayModal'

/**
 * People → Overhead "pool trend + composition" card (v2.2673). Presentational:
 * the tab feeds it the kernel output built inside its 90-day KPI effect.
 *
 * Three things, top to bottom: the verdict (up/down/flat vs the prior 30
 * days), what the pool is made of (office labor / bid labor / office parts —
 * the ledger the KPI trio never showed), and the day-by-day stacked chart with
 * a 7-day line. Series colors match the rest of the tab: purple = office
 * labor, blue = bid labor, amber = office parts.
 *
 * v2.3269: every bar is a door. Hover for the day's split and its biggest
 * line, click a colored segment for that category's lines, click the empty
 * space above a bar for the whole day (Enter/Space from the keyboard); the
 * legend swatches hide a series so the others can be read alone; the list
 * under the chart names the biggest single lines in the window — the
 * discovery path for "what is that spike". The day panel itself is
 * `OverheadPoolDayModal`, owned by the tab.
 */

const SERIES = OVERHEAD_POOL_SERIES

/** Whole dollars with a $ — the tab's formatCurrency omits the sign, and cents are noise on a 90-day pool. */
const money = (v: number): string => `$${Math.round(v).toLocaleString('en-US')}`
const money2 = (v: number): string => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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

const shortDate = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

const CATS: readonly OverheadPoolCategory[] = ['office', 'bid', 'parts']

export function OverheadPoolTrendCard({
  trend,
  loading,
  windowLabel,
  dayIndex = null,
  highlightYmd = null,
  onOpenDay,
  cardLabelForLine,
}: {
  trend: OverheadPoolTrend | null
  loading: boolean
  windowLabel: string
  /** What is behind every bar (v2.3269); null while the snapshot loads. */
  dayIndex?: OverheadPoolDayIndex | null
  /** The bar to outline — the day the panel is (or was last) open on. */
  highlightYmd?: string | null
  onOpenDay?: (ymd: string, category: OverheadPoolDayModalCategory) => void
  cardLabelForLine?: (line: OverheadPoolPartsLine) => string
}) {
  const [hidden, setHidden] = useState<ReadonlySet<OverheadPoolCategory>>(() => new Set())
  const [hover, setHover] = useState<{ i: number; xPct: number; yPct: number } | null>(null)
  const [listHover, setListHover] = useState<string | null>(null)
  const interactive = Boolean(onOpenDay && dayIndex)

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

  const seriesUsd = (d: OverheadPoolTrend['days'][number], k: OverheadPoolCategory): number => (k === 'office' ? d.officeLaborUsd : k === 'bid' ? d.bidLaborUsd : d.officePartsUsd)
  const visibleUsd = (d: OverheadPoolTrend['days'][number]): number => CATS.reduce((s, k) => (hidden.has(k) ? s : s + seriesUsd(d, k)), 0)

  const chart = useMemo(() => {
    if (!trend || trend.days.length === 0) return null
    const n = trend.days.length
    const bw = (W - ML - MR) / n
    // The 7-day line follows the visible series so hiding parts lets office labor be read on its own scale.
    const allVisible = hidden.size === 0
    const avg = trend.days.map((d, i) => {
      if (allVisible) return d.trailing7AvgUsd
      let s = 0
      let c = 0
      for (let j = Math.max(0, i - 6); j <= i; j++) {
        s += visibleUsd(trend.days[j]!)
        c += 1
      }
      return s / c
    })
    const maxRaw = Math.max(...trend.days.map((d, i) => Math.max(visibleUsd(d), avg[i]!)), 1)
    const step = niceStep(maxRaw)
    const max = Math.ceil(maxRaw / step) * step * 1.05
    const y = (v: number) => H - MB - (v / max) * (H - MT - MB)
    const grid: number[] = []
    for (let g = step; g < max; g += step) grid.push(g)
    const linePath = avg.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(ML + i * bw + bw / 2).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
    return { n, bw, y, grid, linePath, avg }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trend, hidden])

  const pct = (part: number) => (trend && trend.totals.totalUsd > 0 ? Math.round((part / trend.totals.totalUsd) * 100) : 0)
  const toggle = (k: OverheadPoolCategory) =>
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else if (next.size < CATS.length - 1) next.add(k)
      return next
    })

  const hoverDay = hover && trend ? trend.days[hover.i] ?? null : null
  const hoverDetail = hoverDay && dayIndex ? dayIndex.byYmd.get(hoverDay.ymd) ?? null : null
  const hoverBiggest = (() => {
    if (!hoverDetail) return null
    const cands: Array<{ label: string; usd: number }> = []
    for (const l of hoverDetail.office) cands.push({ label: `${l.userName} · ${l.hours.toFixed(1)} h office`, usd: l.laborUsd })
    for (const l of hoverDetail.bid) cands.push({ label: `${l.userName} · ${l.hours.toFixed(1)} h on a bid`, usd: l.laborUsd })
    for (const l of hoverDetail.parts) if (l.counted) cands.push({ label: l.label, usd: l.amountUsd })
    cands.sort((a, b) => b.usd - a.usd)
    return cands[0] ?? null
  })()

  const onColumnClick = (ymd: string) => (e: MouseEvent<SVGGElement>) => {
    if (!onOpenDay) return
    const cat = (e.target as SVGElement).getAttribute('data-cat') as OverheadPoolCategory | null
    onOpenDay(ymd, cat ?? 'day')
  }
  const onColumnKey = (ymd: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (!onOpenDay) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpenDay(ymd, 'day')
    }
  }

  const outlined = listHover ?? highlightYmd

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
            <div aria-hidden style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--border)' }}>
              {CATS.map((k) => {
                const v = seriesUsd({ ...trend.days[0]!, officeLaborUsd: trend.totals.officeLaborUsd, bidLaborUsd: trend.totals.bidLaborUsd, officePartsUsd: trend.totals.officePartsUsd }, k)
                return v > 0 ? <span key={k} style={{ flex: v, background: SERIES[k].color, opacity: hidden.has(k) ? 0.25 : 1 }} /> : null
              })}
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-muted)', alignItems: 'center' }}>
              <span>
                <strong style={{ color: 'var(--text-strong)' }}>{money(trend.totals.totalUsd)}</strong> pool · {money(trend.recentAvgDailyUsd)}/day lately
                {dayIndex && dayIndex.typicalDayUsd > 0 ? <span title="The median of days with anything in them"> · a typical day is {money(dayIndex.typicalDayUsd)}</span> : null}
              </span>
              {CATS.map((k) => {
                const v = k === 'office' ? trend.totals.officeLaborUsd : k === 'bid' ? trend.totals.bidLaborUsd : trend.totals.officePartsUsd
                const off = hidden.has(k)
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={!off}
                    onClick={() => toggle(k)}
                    title={off ? `Show ${SERIES[k].label.toLowerCase()} again` : `Hide ${SERIES[k].label.toLowerCase()} to read the other series on their own scale`}
                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: off ? 0.45 : 1, textDecoration: off ? 'line-through' : 'none' }}
                  >
                    <i aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: SERIES[k].color }} />
                    {SERIES[k].label} <strong style={{ color: 'var(--text-strong)' }}>{money(v)}</strong> · {pct(v)}%
                  </button>
                )
              })}
              <span>
                <i aria-hidden style={{ display: 'inline-block', width: 10, height: 2, background: 'var(--text-strong)', marginRight: 5, verticalAlign: 3 }} />
                7-day average
              </span>
            </div>
          </div>

          {chart && (
            <div style={{ position: 'relative', marginTop: '0.5rem' }}>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label="Daily overhead pool, stacked by office labor, bid labor, and office parts, with a 7-day average line. Each bar opens the day's lines."
                style={{ display: 'block', width: '100%', height: 'auto' }}
                onMouseLeave={() => setHover(null)}
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
                  const seg = (k: OverheadPoolCategory) => {
                    const v = hidden.has(k) ? 0 : seriesUsd(d, k)
                    if (v <= 0) return null
                    const top = cursor - (chart.y(0) - chart.y(v))
                    const rect = <rect key={k} data-cat={k} x={x} y={top} width={w} height={Math.max(0.5, cursor - top)} fill={SERIES[k].color} style={{ filter: hover?.i === i ? 'brightness(1.2)' : undefined }} />
                    cursor = top
                    return rect
                  }
                  const isOutlined = outlined === d.ymd
                  return (
                    <g
                      key={d.ymd}
                      role={interactive ? 'button' : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      aria-label={interactive ? `${shortDate(d.ymd)} · ${money(d.totalUsd)} — open the day's lines` : undefined}
                      style={{ cursor: interactive ? 'pointer' : 'default', outline: 'none' }}
                      onMouseMove={() => setHover({ i, xPct: ((ML + i * chart.bw + chart.bw / 2) / W) * 100, yPct: (chart.y(visibleUsd(d)) / H) * 100 })}
                      onFocus={() => setHover({ i, xPct: ((ML + i * chart.bw + chart.bw / 2) / W) * 100, yPct: (chart.y(visibleUsd(d)) / H) * 100 })}
                      onBlur={() => setHover(null)}
                      onClick={interactive ? onColumnClick(d.ymd) : undefined}
                      onKeyDown={interactive ? onColumnKey(d.ymd) : undefined}
                    >
                      <rect x={x} y={MT} width={w} height={H - MT - MB} fill={isOutlined ? 'var(--bg-subtle)' : 'transparent'} stroke={isOutlined ? 'var(--text-strong)' : 'none'} strokeWidth={isOutlined ? 1.2 : 0} />
                      {seg('office')}
                      {seg('bid')}
                      {seg('parts')}
                      {(i === 0 || d.ymd.endsWith('-01')) && (
                        <text x={ML + i * chart.bw} y={H - 7} fill="var(--text-faint)" fontSize={10}>
                          {monthLabel(d.ymd)}
                        </text>
                      )}
                    </g>
                  )
                })}
                <path d={chart.linePath} fill="none" stroke="var(--text-strong)" strokeWidth={1.6} opacity={0.85} style={{ pointerEvents: 'none' }} />
              </svg>
              {hoverDay ? (
                <div
                  role="status"
                  style={{
                    position: 'absolute',
                    left: `${hover!.xPct}%`,
                    top: `${hover!.yPct}%`,
                    transform: 'translate(-50%, calc(-100% - 8px))',
                    pointerEvents: 'none',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-strong)',
                    borderRadius: 6,
                    padding: '0.4rem 0.55rem',
                    fontSize: '0.75rem',
                    lineHeight: 1.4,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                    zIndex: 3,
                    maxWidth: 'min(90vw, 26rem)',
                  }}
                >
                  <strong>{shortDate(hoverDay.ymd)}</strong> · {money(hoverDay.totalUsd)}
                  {dayIndex ? <span style={{ color: 'var(--text-muted)' }}>{overheadPoolTypicalLabel(hoverDay.totalUsd, dayIndex.typicalDayUsd) ? ` · ${overheadPoolTypicalLabel(hoverDay.totalUsd, dayIndex.typicalDayUsd)}` : ''}</span> : null}
                  <br />
                  <span style={{ color: 'var(--text-muted)' }}>Office labor</span> {money(hoverDay.officeLaborUsd)} · <span style={{ color: 'var(--text-muted)' }}>Bid labor</span> {money(hoverDay.bidLaborUsd)} · <span style={{ color: 'var(--text-muted)' }}>Office parts</span> {money(hoverDay.officePartsUsd)}
                  <br />
                  <span style={{ color: 'var(--text-muted)' }}>7-day avg</span> {money(chart.avg[hover!.i] ?? hoverDay.trailing7AvgUsd)}
                  {hoverBiggest ? (
                    <div style={{ marginTop: 3, paddingTop: 3, borderTop: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Biggest:</span> {hoverBiggest.label} · {money2(hoverBiggest.usd)}
                    </div>
                  ) : null}
                  {interactive ? <div style={{ color: 'var(--text-faint)', marginTop: 2 }}>click a color for its lines · the space above for the whole day</div> : null}
                </div>
              ) : null}
            </div>
          )}
          <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            Recorded (closed, not rejected), wage-priced office + bid sessions and office-job parts only — the same pool behind the
            KPIs and lenses above. Unpriced hours and unassigned salary time are missing here too.
            {interactive ? ' Click any bar to see what is in it.' : ''}
          </p>

          {dayIndex && dayIndex.biggest.length > 0 && onOpenDay ? (
            <div style={{ marginTop: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
              <div style={{ fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 2 }}>Biggest single lines in these {dayIndex.ymds.length} days</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <tbody>
                  {dayIndex.biggest.map((b, i) => {
                    const l = b.line
                    const dayTotal = dayIndex.byYmd.get(b.ymd)?.sums.total ?? 0
                    const typ = overheadPoolTypicalLabel(dayTotal, dayIndex.typicalDayUsd)
                    const what =
                      l.kind === 'parts' ? (
                        <>
                          <span style={srcBadgeStyle}>{l.source === 'mercury' ? 'card' : l.source === 'supply' ? 'supply invoice' : 'tally'}</span>
                          {l.label}
                          {cardLabelForLine && cardLabelForLine(l) ? <span style={{ color: 'var(--text-muted)' }}> · {cardLabelForLine(l)}</span> : null}
                        </>
                      ) : (
                        <>
                          {l.userName} · {l.hours.toFixed(1)} h {l.bucket === 'bid' ? 'on a bid' : 'office'}
                        </>
                      )
                    return (
                      <tr
                        key={`${b.ymd}-${b.category}-${i}`}
                        onMouseEnter={() => setListHover(b.ymd)}
                        onMouseLeave={() => setListHover(null)}
                        onClick={() => onOpenDay(b.ymd, b.category)}
                        style={{ cursor: 'pointer' }}
                        title="Open this day's lines"
                      >
                        <td style={{ ...bigTd, whiteSpace: 'nowrap' }}>
                          <i aria-hidden style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: SERIES[b.category].color, marginRight: 6, verticalAlign: -1 }} />
                          {shortDate(b.ymd)}
                        </td>
                        <td style={bigTd}>{what}</td>
                        <td style={{ ...bigTd, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          <strong>{money2(b.amountUsd)}</strong>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {' '}· {dayIndex.poolUsd > 0 ? `${((100 * b.amountUsd) / dayIndex.poolUsd).toFixed(1)}% of the pool` : ''}
                            {typ ? ` · that day was ${typ}` : ''}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

const bigTd: CSSProperties = { padding: '0.3rem 0.4rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }
const srcBadgeStyle: CSSProperties = { display: 'inline-block', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '0 5px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-700)', marginRight: 6 }
