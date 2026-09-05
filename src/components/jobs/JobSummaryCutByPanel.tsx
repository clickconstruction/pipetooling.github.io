import type { CSSProperties } from 'react'
import type { JobSummaryCompareBundle } from '../../hooks/useJobSummaryView'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { JobSummaryConcentration, JobSummaryGroup, JobSummaryLedgerRowInput } from '../../lib/jobs/jobSummaryLedgerView'

/**
 * Cut by (v2.2820): the ranked bars beside the grouped Jobs table — one bar per
 * group, true profit (green) or loss (red), the true margin and job count as a
 * label, a red tick on groups under the target, and the concentration line
 * ("top 3 = 71% of true profit"). Also exports the group subtotal row the
 * table renders above each group. Presentational.
 */
const money = (v: number | null | undefined): string => (v == null ? '—' : `${v < 0 ? '−' : ''}${formatUsdNoCents(Math.abs(v))}`)
const moneyK = (v: number): string => `${v < 0 ? '−' : ''}$${(Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10_000 ? 0 : 1)}k`
const pct = (v: number | null | undefined): string => (v == null ? '—' : `${Math.round(v)}%`)

export default function JobSummaryCutByPanel({
  groups,
  concentration,
  targetTrueMarginPct,
  showMoney,
  cutLabel,
}: {
  groups: readonly JobSummaryGroup[]
  concentration: JobSummaryConcentration
  targetTrueMarginPct: number
  showMoney: boolean
  cutLabel: string
}) {
  if (groups.length === 0) return null
  const list = groups.slice(0, 12)
  const measure = (g: JobSummaryGroup) => (showMoney ? g.totals.trueProfitUsd : g.totals.revenueUsd)
  const vals = list.map((g) => measure(g) ?? 0)
  const maxAbs = Math.max(1, ...vals.map((v) => Math.abs(v)))
  const hasNeg = vals.some((v) => v < 0)
  const W = 640
  const L = 170
  const R = 150
  const rowH = 24
  const H = 8 + list.length * rowH + (concentration.sharePct != null ? 22 : 8)
  const zeroX = L + (W - L - R) * (hasNeg ? 0.3 : 0)
  const scale = (v: number) => (v >= 0 ? (W - R - zeroX) * (v / maxAbs) : (zeroX - L) * (v / maxAbs))
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.6rem 0.25rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {showMoney ? 'True profit' : 'Revenue'} by {cutLabel}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {groups.length} groups{groups.length > list.length ? ` · top ${list.length} shown` : ''} · ranked by {showMoney ? 'true profit' : 'revenue'}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${showMoney ? 'True profit' : 'Revenue'} by ${cutLabel}, ranked`} style={{ display: 'block', maxWidth: 900 }}>
        <line x1={zeroX} x2={zeroX} y1={4} y2={8 + list.length * rowH} stroke="var(--border-strong)" />
        {list.map((g, i) => {
          const v = measure(g)
          const y = 8 + i * rowH
          const w = v == null ? 0 : scale(v)
          const x = v == null || v >= 0 ? zeroX : zeroX + w
          const under = showMoney && targetTrueMarginPct > 0 && g.totals.trueMarginPct != null && g.totals.trueMarginPct < targetTrueMarginPct
          const label = v == null ? 'overhead loading…' : `${moneyK(v)} · ${pct(showMoney ? g.totals.trueMarginPct : g.totals.marginPct)} · ${g.totals.jobs} ${g.totals.jobs === 1 ? 'job' : 'jobs'}`
          return (
            <g key={g.key}>
              <title>{`${g.label} · ${g.totals.jobs} jobs · revenue ${money(g.totals.revenueUsd)}${showMoney ? ` · true profit ${money(g.totals.trueProfitUsd)} · ${pct(g.totals.trueMarginPct)} true margin` : ''}${under ? ` · under the ${targetTrueMarginPct}% target` : ''}`}</title>
              {under ? <rect x={L - 8} y={y + 5} width={3} height={rowH - 10} fill="var(--text-red-700)" /> : null}
              <text x={L - 12} y={y + rowH / 2 + 4} textAnchor="end" fontSize={11} fill={under ? 'var(--text-red-700)' : 'var(--text)'} fontWeight={under ? 700 : 500}>
                {g.label.length > 24 ? `${g.label.slice(0, 23)}…` : g.label}
              </text>
              <rect x={x} y={y + 5} width={Math.max(2, Math.abs(w))} height={rowH - 10} rx={3} fill={v != null && v < 0 ? '#dc2626' : '#15803d'} opacity={0.9} />
              <text x={v != null && v < 0 ? zeroX + w - 5 : zeroX + Math.max(0, w) + 5} y={y + rowH / 2 + 4} textAnchor={v != null && v < 0 ? 'end' : 'start'} fontSize={10.5} fill="var(--text-muted)">
                {label}
              </text>
            </g>
          )
        })}
        {concentration.sharePct != null && showMoney ? (
          <text x={W - 4} y={H - 6} textAnchor="end" fontSize={10.5} fontWeight={700} fill="var(--text-strong)">
            top {concentration.top} = {Math.round(concentration.sharePct)}% of true profit
          </text>
        ) : null}
        {targetTrueMarginPct > 0 && showMoney && list.some((g) => g.totals.trueMarginPct != null && g.totals.trueMarginPct < targetTrueMarginPct) ? (
          <text x={L - 12} y={H - 6} textAnchor="end" fontSize={10} fill="var(--text-red-700)">
            ▎ under {targetTrueMarginPct}% target
          </text>
        ) : null}
      </svg>
    </div>
  )
}

const cell: CSSProperties = { padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }

/** The subtotal row above a group in the Jobs table: same columns as the job rows, bold, on the subtle ground. */
export function JobSummaryGroupRow({
  group,
  compare,
  targetTrueMarginPct,
  showMoney,
  ledgerLoaded,
}: {
  group: JobSummaryGroup<JobSummaryLedgerRowInput>
  compare: JobSummaryCompareBundle | null
  targetTrueMarginPct: number
  showMoney: boolean
  ledgerLoaded: boolean
}) {
  const t = group.totals
  const under = showMoney && targetTrueMarginPct > 0 && t.trueMarginPct != null && t.trueMarginPct < targetTrueMarginPct
  const prior = compare ? compare.trueMarginPctByGroupKey.get(group.key) ?? null : null
  const dPts = compare && t.trueMarginPct != null && prior != null ? t.trueMarginPct - prior : null
  const dColor = dPts == null ? 'var(--text-muted)' : Math.abs(dPts) < 0.5 ? 'var(--text-muted)' : dPts > 0 ? 'var(--text-green-700)' : 'var(--text-red-700)'
  return (
    <tr style={{ background: 'var(--bg-subtle)', borderTop: '2px solid var(--border-strong)' }}>
      <td colSpan={3} style={{ ...cell, textAlign: 'left', color: 'var(--text-strong)' }}>
        {group.label} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {t.jobs} {t.jobs === 1 ? 'job' : 'jobs'}</span>
      </td>
      <td style={cell}>{money(t.revenueUsd)}</td>
      <td style={cell}>{showMoney ? money(t.laborUsd) : '—'}</td>
      <td style={cell}>{money(t.subsUsd)}</td>
      <td style={cell}>{money(t.partsUsd)}</td>
      <td style={{ ...cell, color: showMoney && t.grossUsd < 0 ? 'var(--text-red-700)' : undefined }}>{showMoney ? money(t.grossUsd) : '—'}</td>
      <td style={cell}>{showMoney ? pct(t.marginPct) : '—'}</td>
      <td style={cell}>{ledgerLoaded ? `${t.hours.toFixed(1)} h` : '—'}</td>
      <td style={cell}>{showMoney ? money(t.overheadUsd) : '—'}</td>
      <td style={{ ...cell, color: showMoney && t.trueProfitUsd != null && t.trueProfitUsd < 0 ? 'var(--text-red-700)' : undefined }}>{showMoney ? money(t.trueProfitUsd) : '—'}</td>
      <td style={{ ...cell, color: under ? 'var(--text-red-700)' : undefined }} title={under ? `Under the ${targetTrueMarginPct}% target` : undefined}>
        {showMoney ? `${pct(t.trueMarginPct)}${under ? ' ▾' : ''}` : '—'}
        {compare && showMoney ? (
          <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: dColor }} title={prior == null ? 'No matching group in the compare window' : `Was ${pct(prior)}`}>
            {dPts == null ? (compare.ledgerLoading ? 'comparing…' : '— vs prior') : `${dPts > 0 ? '▲' : dPts < 0 ? '▼' : '•'} ${Math.abs(dPts).toFixed(1)} pts`}
          </span>
        ) : null}
      </td>
      <td style={cell}>{t.revenuePerHourUsd == null ? '—' : `$${Math.round(t.revenuePerHourUsd)}`}</td>
      <td style={cell} />
    </tr>
  )
}
