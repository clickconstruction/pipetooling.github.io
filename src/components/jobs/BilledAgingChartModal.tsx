import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { StageRow } from '../../lib/jobsStagesBoard'
import {
  billedAgingMoneyLabel,
  billedAgingRadius,
  billedAgingX,
  billedAgingXDomainMax,
  billedAgingY,
  billedAgingYDomainMax,
  billedAgingYTicks,
  buildBilledAgingChart,
  type BilledAgingPoint,
} from '../../lib/jobs/billedAgingChart'

/**
 * 📊 on the Billed Awaiting Payment header (v2.1871, dev/controller): every
 * open bill as a bubble — x = days in Billed (the header chips' clock),
 * y = open dollars (log), bubble area = the job's lifetime cost
 * (get_billed_aging_costs — wage-derived, hence the gate). Red dashed bubbles
 * are "underwater" jobs (cost > revenue). Click a bubble to jump the board to
 * that bill.
 */

const VB_W = 880
const VB_H = 480
const X0 = 70
const X1 = 820
const Y_TOP = 20
const Y_BOTTOM = 420

export default function BilledAgingChartModal({
  rows,
  onClose,
  onOpenInvoice,
}: {
  rows: StageRow[]
  onClose: () => void
  onOpenInvoice: (invoiceId: string) => void
}) {
  const { showToast } = useToastContext()
  const [costs, setCosts] = useState<Record<string, number> | null>(null)
  const [costsLoading, setCostsLoading] = useState(true)
  const [hover, setHover] = useState<{ p: BilledAgingPoint; cx: number; cy: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          () => supabase.rpc('get_billed_aging_costs'),
          'billed aging costs',
        )
        if (cancelled) return
        setCosts(data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, number>) : {})
      } catch (e) {
        if (!cancelled) {
          showToast(formatErrorMessage(e, 'Could not load job costs — showing uniform dots'), 'error')
          setCosts({})
        }
      } finally {
        if (!cancelled) setCostsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showToast])

  const { points, stats } = useMemo(() => buildBilledAgingChart(rows, costs), [rows, costs])
  const xMax = useMemo(() => billedAgingXDomainMax(points), [points])
  const yMax = useMemo(() => billedAgingYDomainMax(points), [points])
  const yTicks = useMemo(() => billedAgingYTicks(yMax), [yMax])
  // Direct labels: the 90+ tail's four biggest open amounts (everything else is hover).
  const labeledIds = useMemo(
    () =>
      new Set(
        points
          .filter((p) => p.days >= 90)
          .sort((a, b) => b.open - a.open)
          .slice(0, 4)
          .map((p) => p.invoiceId),
      ),
    [points],
  )

  const xd = (d: number) => billedAgingX(d, xMax, X0, X1)
  const yd = (v: number) => billedAgingY(v, yMax, Y_TOP, Y_BOTTOM)
  const xTicks = useMemo(() => {
    const ticks: number[] = []
    for (let d = 0; d <= xMax; d += 30) ticks.push(d)
    return ticks
  }, [xMax])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Billed Awaiting Payment aging chart"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(980px, calc(100vw - 2rem))', maxHeight: '92vh', overflow: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>Billed Awaiting Payment — aging</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap', margin: '0.5rem 0 0.75rem' }}>
          <Stat v={billedAgingMoneyLabel(stats.openTotal)} k={`open · ${stats.plottedCount} bills`} />
          <Stat v={stats.medianDays == null ? '—' : `${stats.medianDays} days`} k="median age" />
          <Stat v={billedAgingMoneyLabel(stats.sum90)} k={`past 90 days · ${stats.count90} bills`} bad={stats.count90 > 0} />
          <Stat
            v={billedAgingMoneyLabel(stats.underwaterTotal)}
            k={`underwater · ${stats.underwaterCount} jobs`}
            bad={stats.underwaterCount > 0}
          />
        </div>

        <div style={{ position: 'relative', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            style={{ width: '100%', minWidth: 640, height: 'auto', display: 'block' }}
            role="img"
            aria-label="Bubble chart: open dollars by days in Billed Awaiting Payment; bubble size is our cost on the job"
          >
            {/* aging bands — the header chips' buckets */}
            {xMax >= 60 && <rect x={xd(30)} y={Y_TOP} width={xd(Math.min(60, xMax)) - xd(30)} height={Y_BOTTOM - Y_TOP} fill="var(--bg-amber-tint, rgba(245,158,11,0.06))" opacity={0.6} />}
            {xMax >= 90 && <rect x={xd(60)} y={Y_TOP} width={xd(Math.min(90, xMax)) - xd(60)} height={Y_BOTTOM - Y_TOP} fill="var(--bg-amber-tint, rgba(245,158,11,0.06))" />}
            {xMax >= 90 && <rect x={xd(90)} y={Y_TOP} width={X1 - xd(90)} height={Y_BOTTOM - Y_TOP} fill="var(--bg-red-tint, rgba(220,38,38,0.06))" />}
            <text x={xd(30) + 4} y={Y_TOP + 12} fontSize={10} fill="var(--text-muted)">30+</text>
            <text x={xd(60) + 4} y={Y_TOP + 12} fontSize={10} fill="var(--text-muted)">60+</text>
            <text x={xd(90) + 4} y={Y_TOP + 12} fontSize={10} fill="var(--text-red-600)">90+</text>

            {/* y grid + tick labels (log) */}
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={X0} x2={X1} y1={yd(t)} y2={yd(t)} stroke="var(--border)" strokeWidth={1} />
                <text x={X0 - 6} y={yd(t) + 3} fontSize={10} fill="var(--text-muted)" textAnchor="end">
                  {billedAgingMoneyLabel(t)}
                </text>
              </g>
            ))}
            {/* x ticks */}
            {xTicks.map((d) => (
              <text key={d} x={xd(d)} y={Y_BOTTOM + 18} fontSize={10} fill="var(--text-muted)" textAnchor="middle">
                {d}
              </text>
            ))}
            <text x={(X0 + X1) / 2} y={VB_H - 16} fontSize={11} fill="var(--text-muted)" textAnchor="middle">
              days in Billed Awaiting Payment
            </text>
            <text x={16} y={(Y_TOP + Y_BOTTOM) / 2} fontSize={11} fill="var(--text-muted)" textAnchor="middle" transform={`rotate(-90 16 ${(Y_TOP + Y_BOTTOM) / 2})`}>
              open $ on the bill (log)
            </text>
            {stats.count90 > 0 && (
              <text x={X1 - 8} y={Y_TOP + 36} fontSize={11} fontWeight={600} fill="var(--text-red-600)" textAnchor="end">
                big &amp; old — chase these first ↗
              </text>
            )}

            {/* bubbles — normal first, underwater on top; 2px surface ring keeps clusters countable */}
            {points
              .slice()
              .sort((a, b) => billedAgingRadius(b.cost) - billedAgingRadius(a.cost))
              .map((p) => {
                const cx = xd(p.days)
                const cy = yd(p.open)
                const r = billedAgingRadius(p.cost)
                return (
                  <circle
                    key={p.invoiceId}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={p.underwater ? 'var(--bg-red-tint, rgba(220,38,38,0.3))' : 'var(--bg-blue-tint)'}
                    stroke={p.underwater ? 'var(--text-red-600)' : 'var(--text-blue-500)'}
                    strokeWidth={1.5}
                    strokeDasharray={p.underwater ? '3 2' : undefined}
                    paintOrder="stroke"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover({ p, cx, cy })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onOpenInvoice(p.invoiceId)}
                  >
                    <title>{`${p.label} — ${billedAgingMoneyLabel(p.open)} open · ${p.days} days`}</title>
                  </circle>
                )
              })}

            {/* direct labels on the 90+ tail only */}
            {points
              .filter((p) => labeledIds.has(p.invoiceId))
              .map((p) => (
                <text
                  key={`lbl-${p.invoiceId}`}
                  x={Math.min(xd(p.days), X1 - 4)}
                  y={Math.max(yd(p.open) - billedAgingRadius(p.cost) - 6, Y_TOP + 24)}
                  fontSize={10.5}
                  fill="var(--text-700)"
                  textAnchor={xd(p.days) > X1 - 90 ? 'end' : 'middle'}
                >
                  {p.label} · {billedAgingMoneyLabel(p.open)}
                </text>
              ))}

            {/* bubble size legend — vertical, far right middle (the 90+ zone is
                the part of the plot you WANT empty, so it borrows that air). */}
            <g transform={`translate(${X1 - 40}, ${(Y_TOP + Y_BOTTOM) / 2 - 80})`}>
              <text x={0} y={0} fontSize={10} fill="var(--text-muted)" textAnchor="middle">our cost</text>
              <circle cx={0} cy={20} r={billedAgingRadius(500)} fill="none" stroke="var(--text-muted)" />
              <text x={0} y={38} fontSize={10} fill="var(--text-muted)" textAnchor="middle">$500</text>
              <circle cx={0} cy={62} r={billedAgingRadius(5000)} fill="none" stroke="var(--text-muted)" />
              <text x={0} y={90} fontSize={10} fill="var(--text-muted)" textAnchor="middle">$5k</text>
              <circle cx={0} cy={128} r={billedAgingRadius(20000)} fill="none" stroke="var(--text-muted)" />
              <text x={0} y={170} fontSize={10} fill="var(--text-muted)" textAnchor="middle">$20k</text>
            </g>
          </svg>

          {hover && (
            <div
              style={{
                position: 'absolute',
                left: `min(max(${(hover.cx / VB_W) * 100}%, 8%), 72%)`,
                top: `${Math.max((hover.cy / VB_H) * 100 - 18, 2)}%`,
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: '0.5rem 0.7rem',
                fontSize: '0.75rem',
                pointerEvents: 'none',
                boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
                maxWidth: 260,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{hover.p.label}</div>
              {hover.p.customerName && <div style={{ color: 'var(--text-muted)' }}>{hover.p.customerName}</div>}
              <div style={{ marginTop: 2 }}>
                {billedAgingMoneyLabel(hover.p.open)} open · {hover.p.days} days in Billed
              </div>
              <div>
                Our cost {hover.p.cost == null ? '—' : billedAgingMoneyLabel(hover.p.cost)}
                {hover.p.underwater ? ' · underwater' : ''}
              </div>
              <div style={{ color: 'var(--text-blue-700)', fontWeight: 600, marginTop: 2 }}>Click to jump to the bill →</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="5" fill="var(--bg-blue-tint)" stroke="var(--text-blue-500)" strokeWidth="1.5" /></svg>
            open bill
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" aria-hidden><circle cx="7" cy="7" r="5" fill="var(--bg-red-tint)" stroke="var(--text-red-600)" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
            underwater — our cost exceeds the job's revenue
          </span>
          {rows.length === 0 && <span role="status">Loading billed rows…</span>}
          {costsLoading && <span role="status">Sizing bubbles…</span>}
          {stats.skippedNoDate > 0 && (
            <span>
              {stats.skippedNoDate} row{stats.skippedNoDate === 1 ? '' : 's'} without a bill date not plotted
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
