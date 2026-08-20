import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  buildPaidProfitChart,
  paidProfitMoneyLabel,
  paidProfitRadius,
  paidProfitX,
  paidProfitXDomainMax,
  paidProfitY,
  paidProfitYDomain,
  paidProfitYTicks,
  sqrtSpacedTicks,
  type PaidProfitPoint,
  type PaidProfitStatsRow,
  type PaidProfitWindow,
} from '../../lib/jobs/paidProfitChart'
import { APP_SETTINGS_KEY_OVERHEAD_OFFICE_JOB_LEDGER_ID_V1 } from '../../lib/appSettingsKeys'

/**
 * 📊 on the Paid in Full header (v2.1879, dev/controller): every paid job as a
 * bubble — x = approved clock-session hours, y = profit (revenue − six-stream
 * cost, losses below a bold $0 line), bubble area = revenue. Dashed guide
 * lines through the origin read as profit per clocked hour. Click a bubble to
 * open that job's detail view.
 */

const VB_W = 880
const VB_H = 500
const X0 = 70
const X1 = 820
const Y_TOP = 20
const Y_BOTTOM = 440
const GUIDE_RATES = [50, 150]

export default function PaidProfitChartModal({
  paidJobs,
  onClose,
  onOpenJob,
}: {
  paidJobs: JobWithDetails[]
  onClose: () => void
  onOpenJob: (job: JobWithDetails) => void
}) {
  const { showToast } = useToastContext()
  const [statsMap, setStatsMap] = useState<Record<string, PaidProfitStatsRow> | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [hover, setHover] = useState<{ p: PaidProfitPoint; cx: number; cy: number } | null>(null)
  /** Time window over the job's latest payment date (v2.1889). Default: last year. */
  const [windowDays, setWindowDays] = useState<PaidProfitWindow>(365)
  /** The overhead "office job" — an expense bucket, excluded from the chart. */
  const [overheadJobId, setOverheadJobId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('app_settings')
      .select('value_text')
      .eq('key', APP_SETTINGS_KEY_OVERHEAD_OFFICE_JOB_LEDGER_ID_V1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setOverheadJobId((data?.value_text ?? '').trim() || null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          () => supabase.rpc('get_paid_profit_stats'),
          'paid profit stats',
        )
        if (cancelled) return
        setStatsMap(
          data && typeof data === 'object' && !Array.isArray(data)
            ? (data as Record<string, PaidProfitStatsRow>)
            : {},
        )
      } catch (e) {
        if (!cancelled) {
          showToast(formatErrorMessage(e, 'Could not load job costs — nothing to plot'), 'error')
          setStatsMap({})
        }
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showToast])

  const jobsById = useMemo(() => new Map(paidJobs.map((j) => [j.id, j])), [paidJobs])
  const { points, stats } = useMemo(
    () => buildPaidProfitChart(paidJobs, statsMap, { windowDays, excludeJobId: overheadJobId }),
    [paidJobs, statsMap, windowDays, overheadJobId],
  )
  const xMax = useMemo(() => paidProfitXDomainMax(points), [points])
  const yDom = useMemo(() => paidProfitYDomain(points), [points])
  const yTicks = useMemo(() => paidProfitYTicks(yDom), [yDom])

  const xd = (h: number) => paidProfitX(h, xMax, X0, X1)
  const yd = (v: number) => paidProfitY(v, yDom, Y_TOP, Y_BOTTOM)
  // sqrt-spaced so labels stay evenly readable under the sqrt axis.
  const xTicks = useMemo(() => sqrtSpacedTicks(xMax, 5), [xMax])
  /** $/hr guide as a sampled path — a curve under the sqrt scales, correct pointwise. */
  const guidePath = (rate: number): string | null => {
    const hEnd = Math.min(xMax, yDom.max / rate)
    if (hEnd <= 0) return null
    const parts: string[] = []
    for (let i = 0; i <= 32; i++) {
      const h = (hEnd * i) / 32
      parts.push(`${i === 0 ? 'M' : 'L'}${xd(h).toFixed(1)},${yd(h * rate).toFixed(1)}`)
    }
    return parts.join(' ')
  }
  // Direct labels: biggest win, biggest loss (everything else is hover).
  const labeledIds = useMemo(() => {
    const ids = new Set<string>()
    const byProfit = [...points].sort((a, b) => b.profit - a.profit)
    if (byProfit.length > 0) ids.add(byProfit[0]!.jobId)
    if (byProfit.length > 1 && byProfit[byProfit.length - 1]!.profit < 0) ids.add(byProfit[byProfit.length - 1]!.jobId)
    return ids
  }, [points])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paid in Full profit chart"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(980px, calc(100vw - 2rem))', maxHeight: '92vh', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Paid in Full — profit vs clocked hours</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.5rem 0 0.25rem' }}>
          {(
            [
              { v: 90 as const, label: 'Last 90 days' },
              { v: 180 as const, label: 'Last 180 days' },
              { v: 365 as const, label: 'Last year' },
              { v: null, label: 'All time' },
            ] as Array<{ v: PaidProfitWindow; label: string }>
          ).map((w) => (
            <button
              key={w.label}
              type="button"
              onClick={() => setWindowDays(w.v)}
              aria-pressed={windowDays === w.v}
              style={{
                height: 26,
                padding: '0 10px',
                borderRadius: 9999,
                border: `1px solid ${windowDays === w.v ? 'var(--text-blue-700)' : 'var(--border-strong)'}`,
                background: windowDays === w.v ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: windowDays === w.v ? 'var(--text-blue-700)' : 'var(--text-700)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap', margin: '0.5rem 0 0.75rem' }}>
          <Stat v={paidProfitMoneyLabel(stats.profitTotal)} k={`profit · ${stats.plottedCount} jobs`} bad={stats.profitTotal < 0} />
          <Stat
            v={stats.medianPerHour == null ? '—' : `${paidProfitMoneyLabel(stats.medianPerHour)}/hr`}
            k="median profit per hour"
          />
          <Stat v={paidProfitMoneyLabel(stats.loserTotal)} k={`${stats.loserCount} job${stats.loserCount === 1 ? '' : 's'} lost money`} bad={stats.loserCount > 0} />
          <Stat v={`${Math.round(stats.hoursTotal).toLocaleString('en-US')} h`} k="clocked in total" />
        </div>

        <div style={{ position: 'relative', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            style={{ width: '100%', minWidth: 640, height: 'auto', display: 'block' }}
            role="img"
            aria-label="Bubble chart: profit by clocked hours for paid jobs; bubble size is revenue"
          >
            {/* loss region below $0 */}
            {yDom.min < 0 && (
              <rect x={X0} y={yd(0)} width={X1 - X0} height={Y_BOTTOM - yd(0)} fill="var(--bg-red-tint, rgba(220,38,38,0.05))" />
            )}
            {/* y grid + ticks; $0 line bold */}
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={X0} x2={X1} y1={yd(t)} y2={yd(t)} stroke={t === 0 ? 'var(--text-muted)' : 'var(--border)'} strokeWidth={t === 0 ? 1.5 : 1} />
                <text x={X0 - 6} y={yd(t) + 3} fontSize={10} fill={t < 0 ? 'var(--text-red-600)' : 'var(--text-muted)'} textAnchor="end">
                  {paidProfitMoneyLabel(t)}
                </text>
              </g>
            ))}
            {xTicks.map((h) => (
              <text key={h} x={xd(h)} y={Y_BOTTOM + 18} fontSize={10} fill="var(--text-muted)" textAnchor="middle">
                {h}
              </text>
            ))}
            <text x={(X0 + X1) / 2} y={VB_H - 14} fontSize={11} fill="var(--text-muted)" textAnchor="middle">
              clocked hours on the job (approved sessions)
            </text>
            <text x={16} y={(Y_TOP + Y_BOTTOM) / 2} fontSize={11} fill="var(--text-muted)" textAnchor="middle" transform={`rotate(-90 16 ${(Y_TOP + Y_BOTTOM) / 2})`}>
              profit ($)
            </text>

            {/* $/hr guides through the origin — curves under the sqrt scales, correct pointwise */}
            {GUIDE_RATES.map((rate) => {
              const d = guidePath(rate)
              if (!d) return null
              const hEnd = Math.min(xMax, yDom.max / rate)
              return (
                <g key={rate}>
                  <path d={d} fill="none" stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="5 4" opacity={0.5} />
                  <text x={xd(hEnd) - 4} y={yd(hEnd * rate) + (rate === GUIDE_RATES[0] ? -6 : 14)} fontSize={10} fill="var(--text-muted)" textAnchor="end">
                    ${rate}/hr
                  </text>
                </g>
              )
            })}

            {/* bubbles — biggest first so small ones stay clickable */}
            {points
              .slice()
              .sort((a, b) => paidProfitRadius(b.revenue) - paidProfitRadius(a.revenue))
              .map((p) => {
                const cx = xd(p.hours)
                const cy = yd(p.profit)
                const neg = p.profit < 0
                return (
                  <circle
                    key={p.jobId}
                    cx={cx}
                    cy={cy}
                    r={paidProfitRadius(p.revenue)}
                    fill={neg ? 'var(--bg-red-tint, rgba(220,38,38,0.3))' : 'var(--bg-blue-tint)'}
                    stroke={neg ? 'var(--text-red-600)' : 'var(--text-blue-500)'}
                    strokeWidth={1.5}
                    strokeDasharray={neg ? '3 2' : undefined}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover({ p, cx, cy })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => {
                      const job = jobsById.get(p.jobId)
                      if (job) onOpenJob(job)
                    }}
                  >
                    <title>{`${p.label} — ${paidProfitMoneyLabel(p.profit)} profit · ${Math.round(p.hours)} h`}</title>
                  </circle>
                )
              })}

            {/* direct labels: biggest win + biggest loss */}
            {points
              .filter((p) => labeledIds.has(p.jobId))
              .map((p) => {
                const cx = Math.min(Math.max(xd(p.hours), X0 + 8), X1 - 4)
                const anchor = cx < X0 + 100 ? 'start' : cx > X1 - 100 ? 'end' : 'middle'
                return (
                  <text
                    key={`lbl-${p.jobId}`}
                    x={cx}
                    y={Math.max(yd(p.profit) - paidProfitRadius(p.revenue) - 6, Y_TOP + 12)}
                    fontSize={10.5}
                    fill="var(--text-700)"
                    textAnchor={anchor}
                  >
                    {p.label} · {paidProfitMoneyLabel(p.profit)}
                  </text>
                )
              })}
          </svg>

          {hover && (
            <div
              style={{
                position: 'absolute',
                left: `min(max(${(hover.cx / VB_W) * 100}%, 8%), 70%)`,
                top: `${Math.max((hover.cy / VB_H) * 100 - 20, 2)}%`,
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: '0.5rem 0.7rem',
                fontSize: '0.75rem',
                pointerEvents: 'none',
                boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
                maxWidth: 280,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{hover.p.label}</div>
              {hover.p.customerName && <div style={{ color: 'var(--text-muted)' }}>{hover.p.customerName}</div>}
              <div style={{ marginTop: 2 }}>
                Revenue {paidProfitMoneyLabel(hover.p.revenue)} · cost {paidProfitMoneyLabel(hover.p.cost)}
              </div>
              <div style={{ color: hover.p.profit < 0 ? 'var(--text-red-600)' : 'inherit' }}>
                Profit {paidProfitMoneyLabel(hover.p.profit)} · {Math.round(hover.p.hours)} h clocked
                {hover.p.perHour != null ? ` · ${paidProfitMoneyLabel(hover.p.perHour)}/hr` : ''}
              </div>
              <div style={{ color: 'var(--text-blue-700)', fontWeight: 600, marginTop: 2 }}>Click to open the job →</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="5" fill="var(--bg-blue-tint)" stroke="var(--text-blue-500)" strokeWidth="1.5" /></svg>
            paid job (bubble = revenue)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="5" fill="var(--bg-red-tint)" stroke="var(--text-red-600)" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
            lost money
          </span>
          <span>dashed guides = profit per clocked hour</span>
          {paidJobs.length === 0 && <span role="status">Loading paid jobs…</span>}
          {statsLoading && <span role="status">Computing costs…</span>}
          {stats.skippedNoStats > 0 && !statsLoading && (
            <span>
              {stats.skippedNoStats} job{stats.skippedNoStats === 1 ? '' : 's'} with no tracked cost or hours not plotted
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ v, k, bad }: { v: string; k: string; bad?: boolean }) {
  return (
    <span>
      <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: bad ? 'var(--text-red-600)' : 'inherit' }}>{v}</span>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</span>
    </span>
  )
}
