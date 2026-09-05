import { useMemo, useState, type CSSProperties } from 'react'
import type { JobSummaryCompareBundle } from '../../hooks/useJobSummaryView'
import type { JobDayLedger } from '../../lib/jobs/jobDayLedger'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { JobSummaryEnrichedRow } from '../../lib/jobs/jobSummaryLedgerView'
import { bucketJobSummaryByMonth, type JobSummaryMonth, type JobSummaryMonthsBookBy } from '../../lib/jobs/jobSummaryMonths'

/**
 * Job Summary → Months (v2.2821): the monthly P&L. One stacked bar per month —
 * labor, subs, parts, overhead (the month's whole pool) and what's left, with
 * the true margin on top of each bar; a loss stacks red above revenue. Target
 * draws a dashed tick per bar where profit would start at the target margin;
 * Compare to puts a delta line under the tiles. Presentational — the kernel is
 * `lib/jobs/jobSummaryMonths.ts`.
 */
type Props = {
  rows: readonly JobSummaryEnrichedRow[]
  ledger: JobDayLedger | null
  ledgerLoading: boolean
  ledgerError: string | null
  startYmd: string
  endYmd: string
  bookBy: JobSummaryMonthsBookBy
  targetTrueMarginPct: number
  compare: JobSummaryCompareBundle | null
  compareLabel: string
  showMoney: boolean
}

const BAND: ReadonlyArray<{ key: 'laborUsd' | 'subsUsd' | 'partsUsd' | 'overheadUsd'; label: string; color: string }> = [
  { key: 'laborUsd', label: 'labor', color: 'var(--text-link)' },
  { key: 'subsUsd', label: 'subs', color: '#d97706' },
  { key: 'partsUsd', label: 'parts', color: '#0891b2' },
  { key: 'overheadUsd', label: 'overhead', color: '#7c3aed' },
]
const PROFIT = '#15803d'
const LOSS = '#dc2626'

const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', background: 'var(--bg-subtle)', minWidth: 0 }
const tileK: CSSProperties = { fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }
const tileV: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: 'var(--text-strong)' }
const tileS: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-700)' }

const money = (v: number | null | undefined): string => (v == null ? '—' : `${v < 0 ? '−' : ''}${formatUsdNoCents(Math.abs(v))}`)
const moneyK = (v: number): string => `${v < 0 ? '−' : ''}$${(Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10_000 ? 0 : 1)}k`
const pct = (v: number | null | undefined): string => (v == null ? '—' : `${Math.round(v)}%`)

function Delta({ now, prior, fmt, vs, higherIsGood = true, priorEmpty }: { now: number | null; prior: number | null; fmt: (abs: number) => string; vs: string; higherIsGood?: boolean; priorEmpty: boolean }) {
  if (priorEmpty) return <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>no jobs in the {vs}</div>
  if (now == null || prior == null) return <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>— vs {vs}</div>
  const d = now - prior
  const flat = Math.abs(d) < 1e-9
  const good = higherIsGood ? d > 0 : d < 0
  return <div style={{ fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums', color: flat ? 'var(--text-muted)' : good ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{flat ? '•' : d > 0 ? '▲' : '▼'} {fmt(Math.abs(d))} vs {vs}</div>
}

export default function JobSummaryMonthsView({ rows, ledger, ledgerLoading, ledgerError, startYmd, endYmd, bookBy, targetTrueMarginPct, compare, compareLabel, showMoney }: Props) {
  const series = useMemo(() => bucketJobSummaryByMonth({ rows, ledger, bookBy, startYmd, endYmd }), [rows, ledger, bookBy, startYmd, endYmd])
  const prior = useMemo(() => (compare ? bucketJobSummaryByMonth({ rows: compare.rows, ledger: compare.ledger, bookBy, startYmd: compare.startYmd, endYmd: compare.endYmd }) : null), [compare, bookBy])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const t = series.totals
  const target = showMoney ? targetTrueMarginPct : 0
  const underTarget = target > 0 ? series.months.filter((m) => m.revenueUsd > 0 && m.trueMarginPct != null && m.trueMarginPct < target).length : 0
  const monthsWithRevenue = series.months.filter((m) => m.revenueUsd > 0).length
  const priorEmpty = prior != null && prior.totals.jobs === 0 && prior.unplacedJobs === 0

  // ---- geometry ----
  const W = 1000
  const H = 270
  const L = 58
  const R = 12
  const T = 22
  const B = 30
  const plotH = H - T - B
  const n = Math.max(1, series.months.length)
  const cw = (W - L - R) / n
  const bw = Math.min(cw * 0.62, 90)
  const barTop = (m: JobSummaryMonth) => (showMoney ? Math.max(m.revenueUsd, m.laborUsd + m.subsUsd + m.partsUsd + (m.overheadUsd ?? 0)) : m.revenueUsd)
  const maxY = Math.max(1000, ...series.months.map(barTop)) * 1.1
  const yOf = (v: number) => T + plotH * (1 - v / maxY)
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => maxY * f)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.5rem' }}>
        {showMoney ? (
          <div style={tile}>
            <div style={tileK}>True profit</div>
            <div style={{ ...tileV, color: t.trueProfitUsd == null ? tileV.color : t.trueProfitUsd < 0 || (target > 0 && t.trueMarginPct != null && t.trueMarginPct < target) ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>{money(t.trueProfitUsd)}</div>
            <div style={tileS}>
              {pct(t.trueMarginPct)} true margin{target > 0 ? ` · target ${target}%` : ''}
            </div>
            {prior ? <Delta now={t.trueProfitUsd} prior={prior.totals.trueProfitUsd} fmt={money} vs={compareLabel} priorEmpty={priorEmpty} /> : null}
            {prior && !priorEmpty ? <Delta now={t.trueMarginPct} prior={prior.totals.trueMarginPct} fmt={(a) => `${a.toFixed(1)} pts`} vs={compareLabel} priorEmpty={false} /> : null}
          </div>
        ) : null}
        <div style={tile}>
          <div style={tileK}>Revenue</div>
          <div style={tileV}>{money(t.revenueUsd)}</div>
          <div style={tileS}>{monthsWithRevenue > 0 ? `${money(t.revenueUsd / monthsWithRevenue)} per month with work` : 'no months with revenue'}</div>
          {prior ? <Delta now={t.revenueUsd} prior={prior.totals.revenueUsd} fmt={money} vs={compareLabel} priorEmpty={priorEmpty} /> : null}
        </div>
        <div style={tile}>
          <div style={tileK}>Best month</div>
          <div style={tileV}>{series.best ? series.best.label : '—'}</div>
          <div style={tileS}>{series.best ? (showMoney ? `${money(series.best.trueProfitUsd)} · ${pct(series.best.trueMarginPct)}` : money(series.best.revenueUsd)) : 'no revenue in the window'}</div>
        </div>
        {showMoney ? (
          <div style={tile}>
            <div style={tileK}>Overhead</div>
            <div style={tileV}>{money(t.overheadUsd)}</div>
            <div style={tileS}>{t.overheadUsd == null ? (ledgerLoading ? 'loading the day ledger…' : 'not available') : `whole pool · ${money(t.unallocatedUsd)} fell on days with no field work`}</div>
            {prior ? <Delta now={t.overheadUsd} prior={prior.totals.overheadUsd} fmt={money} vs={compareLabel} higherIsGood={false} priorEmpty={priorEmpty} /> : null}
          </div>
        ) : null}
        {target > 0 ? (
          <div style={tile}>
            <div style={tileK}>Under target</div>
            <div style={{ ...tileV, color: underTarget > 0 ? 'var(--text-red-700)' : 'var(--text-green-700)' }}>{underTarget}</div>
            <div style={tileS}>{underTarget === 1 ? 'month' : 'months'} below {target}% true margin</div>
          </div>
        ) : (
          <div style={tile}>
            <div style={tileK}>Field hours</div>
            <div style={tileV}>{t.fieldHours.toFixed(0)}</div>
            <div style={tileS}>approved, in the window</div>
          </div>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.5rem 0.25rem' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Revenue per month, split into costs, overhead, and true profit" style={{ display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
          {gridVals.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 6} y={yOf(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                {moneyK(v)}
              </text>
            </g>
          ))}
          <text transform={`rotate(-90 11 ${T + plotH / 2})`} x={11} y={T + plotH / 2} textAnchor="middle" fontSize={10} fill="var(--text-muted)" style={{ pointerEvents: 'none' }}>
            revenue that month
          </text>
          {hoverIdx != null ? <rect x={L + hoverIdx * cw} y={T} width={cw} height={plotH} fill="var(--text-strong)" opacity={0.06} style={{ pointerEvents: 'none' }} /> : null}
          {series.months.map((m, i) => {
            const x = L + i * cw + (cw - bw) / 2
            const under = target > 0 && m.revenueUsd > 0 && m.trueMarginPct != null && m.trueMarginPct < target
            let base = 0
            const pieces: Array<{ key: string; y0: number; y1: number; color: string }> = []
            if (showMoney) {
              for (const b of BAND) {
                const v = b.key === 'overheadUsd' ? (m.overheadUsd ?? 0) : m[b.key]
                if (v > 0) {
                  pieces.push({ key: b.key, y0: base, y1: base + v, color: b.color })
                  base += v
                }
              }
              if (m.trueProfitUsd != null && m.trueProfitUsd > 0) pieces.push({ key: 'profit', y0: base, y1: base + m.trueProfitUsd, color: PROFIT })
              else if (m.trueProfitUsd != null && m.trueProfitUsd < 0) pieces.push({ key: 'loss', y0: m.revenueUsd, y1: base, color: LOSS })
            } else if (m.revenueUsd > 0) pieces.push({ key: 'revenue', y0: 0, y1: m.revenueUsd, color: 'var(--text-link)' })
            const top = barTop(m)
            const label = m.revenueUsd > 0 ? (showMoney ? pct(m.trueMarginPct) : moneyK(m.revenueUsd)) : ''
            return (
              <g key={m.ym}>
                {pieces.map((p) => (
                  <rect key={p.key} x={x} y={yOf(p.y1)} width={bw} height={Math.max(0, yOf(p.y0) - yOf(p.y1) - 1.5)} rx={p.key === 'profit' || p.key === 'revenue' ? 3 : 1} fill={p.color} opacity={p.key === 'loss' ? 0.85 : 0.9} />
                ))}
                {target > 0 && m.revenueUsd > 0 ? <line x1={x - 3} x2={x + bw + 3} y1={yOf(m.revenueUsd * (1 - target / 100))} y2={yOf(m.revenueUsd * (1 - target / 100))} stroke="var(--text-strong)" strokeWidth={1.5} strokeDasharray="3 2" /> : null}
                {label ? (
                  <text x={x + bw / 2} y={yOf(top) - 6} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={under || (m.trueProfitUsd != null && m.trueProfitUsd < 0) ? 'var(--text-red-700)' : 'var(--text-strong)'}>
                    {label}
                    {under ? ' ▾' : ''}
                  </text>
                ) : null}
                <text x={L + i * cw + cw / 2} y={T + plotH + 16} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)">
                  {m.label.replace(/ \d{4}$/, '')}
                  {i === 0 || m.ym.endsWith('-01') ? ` ${m.ym.slice(0, 4)}` : ''}
                </text>
                <rect x={L + i * cw} y={T} width={cw} height={plotH} fill="transparent" onMouseEnter={() => setHoverIdx(i)}>
                  <title>{`${m.label} · ${m.jobs} ${m.jobs === 1 ? 'job' : 'jobs'} · revenue ${money(m.revenueUsd)}${showMoney ? ` · labor ${money(m.laborUsd)} · subs ${money(m.subsUsd)} · parts ${money(m.partsUsd)} · overhead ${money(m.overheadUsd)}${m.unallocatedUsd > 0 ? ` (${money(m.unallocatedUsd)} unallocated)` : ''} · true profit ${money(m.trueProfitUsd)} · ${pct(m.trueMarginPct)}` : ''} · ${m.fieldHours.toFixed(0)} field h`}</title>
                </rect>
              </g>
            )
          })}
        </svg>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-700)', padding: '0.35rem 0.25rem 0.2rem' }}>
          {showMoney ? (
            <>
              {BAND.map((b) => (
                <span key={b.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: b.color }} />
                  {b.label}
                </span>
              ))}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: PROFIT }} />
                true profit
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: LOSS }} />
                loss
              </span>
              {target > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <i style={{ display: 'inline-block', width: 14, height: 0, borderTop: '1.5px dashed var(--text-strong)' }} />
                  where profit starts at {target}%
                </span>
              ) : null}
            </>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: '#2563eb' }} />
              revenue
            </span>
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>hover a month for its split</span>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {bookBy === 'work' ? 'Each job’s revenue and costs are spread over the months it was worked, by approved field hours. ' : 'Each job books whole to the month its last bill went out. '}
        Overhead is the month’s whole pool, so the column reconciles to the Overhead tab.
        {series.unplacedJobs > 0 ? ` ${series.unplacedJobs} ${series.unplacedJobs === 1 ? 'job' : 'jobs'} (${money(series.unplacedRevenueUsd)}) ${bookBy === 'work' ? 'have no approved hours in the window and aren’t on the chart — Book by bill month places them by their bill date' : 'have no bill date in the window and aren’t on the chart'}.` : ''}
        {ledgerError ? ` Day ledger failed: ${ledgerError}` : ''}
      </p>
    </div>
  )
}
