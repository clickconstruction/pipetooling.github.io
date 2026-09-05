import { useMemo, useState, type CSSProperties } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { JobSummaryEnrichedRow } from '../../lib/jobs/jobSummaryLedgerView'
import { JOB_SUMMARY_SCATTER_COLOR_OPTIONS, JOB_SUMMARY_SCATTER_SIZE_OPTIONS, buildJobSummaryScatter, type JobSummaryScatterColorBy, type JobSummaryScatterSizeBy } from '../../lib/jobs/jobSummaryScatter'

/**
 * Job Summary → Scatter (v2.2826): every finished job as one bubble — revenue
 * across (square-root scale, since most jobs are small), true margin up,
 * bubble by field hours or days, color by service type / GC / lead tech.
 * Median lines cut the plot into quadrants; the target line and the
 * "big and thin" list name the bottom-right one. Click a bubble to open the
 * job. Presentational; kernel in `lib/jobs/jobSummaryScatter.ts`.
 */
type Props = {
  rows: readonly JobSummaryEnrichedRow[]
  ledgerLoading: boolean
  colorBy: JobSummaryScatterColorBy
  onColorByChange: (c: JobSummaryScatterColorBy) => void
  sizeBy: JobSummaryScatterSizeBy
  onSizeByChange: (s: JobSummaryScatterSizeBy) => void
  targetTrueMarginPct: number
  userNameById: ReadonlyMap<string, string | null | undefined>
  showMoney: boolean
  onOpenJob: (jobNumber: string) => void
}

const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', background: 'var(--bg-subtle)', minWidth: 0 }
const tileK: CSSProperties = { fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }
const tileV: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: 'var(--text-strong)' }
const tileS: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-700)' }
const segWrap: CSSProperties = { display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }
const segLabel: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
function segButton(active: boolean, last: boolean): CSSProperties {
  return { padding: '0.3rem 0.65rem', fontSize: '0.78rem', fontWeight: 600, border: 'none', borderRight: last ? 'none' : '1px solid var(--border)', background: active ? '#2563eb' : 'transparent', color: active ? '#fff' : 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
}
function Segmented<K extends string>({ label, value, options, onChange }: { label: string; value: K; options: ReadonlyArray<{ key: K; label: string; title?: string }>; onChange: (k: K) => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={segLabel}>{label}</span>
      <span style={segWrap} role="group" aria-label={label}>
        {options.map((o, i) => (
          <button key={o.key} type="button" aria-pressed={value === o.key} title={o.title} onClick={() => onChange(o.key)} style={segButton(value === o.key, i === options.length - 1)}>
            {o.label}
          </button>
        ))}
      </span>
    </span>
  )
}
const money = (v: number | null | undefined): string => (v == null ? '—' : `${v < 0 ? '−' : ''}${formatUsdNoCents(Math.abs(v))}`)
const moneyK = (v: number): string => `${v < 0 ? '−' : ''}$${(Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10_000 ? 0 : 1)}k`
const pct = (v: number | null | undefined): string => (v == null ? '—' : `${Math.round(v)}%`)

export default function JobSummaryScatterView({ rows, ledgerLoading, colorBy, onColorByChange, sizeBy, onSizeByChange, targetTrueMarginPct, userNameById, showMoney, onOpenJob }: Props) {
  const ctx = useMemo(() => ({ userNameById }), [userNameById])
  const scatter = useMemo(() => buildJobSummaryScatter(rows, colorBy, ctx), [rows, colorBy, ctx])
  const [hover, setHover] = useState<string | null>(null)
  const target = showMoney ? targetTrueMarginPct : 0
  const colorOf = useMemo(() => new Map(scatter.series.map((s) => [s.key, s.color])), [scatter.series])

  if (!showMoney) {
    return <p style={{ color: 'var(--text-muted)' }}>The Scatter view plots true margin, which your role doesn’t see. The Jobs and Days views still work.</p>
  }

  // ---- geometry ----
  const W = 720
  const H = 400
  const L = 52
  const R = 16
  const T = 16
  const B = 36
  const pw = W - L - R
  const ph = H - T - B
  const maxRev = Math.max(1000, ...scatter.points.map((p) => p.revenueUsd))
  const xOf = (v: number) => L + pw * Math.sqrt(Math.max(0, v) / maxRev)
  const minM = Math.min(-40, ...scatter.points.map((p) => Math.max(-100, p.trueMarginPct)))
  const maxM = Math.max(80, ...scatter.points.map((p) => Math.min(100, p.trueMarginPct)))
  const yOf = (m: number) => T + ph * (1 - (Math.max(minM, Math.min(maxM, m)) - minM) / (maxM - minM))
  const sizeVal = (p: { hours: number; days: number }) => (sizeBy === 'hours' ? p.hours : sizeBy === 'days' ? p.days : 1)
  const maxSize = Math.max(1, ...scatter.points.map(sizeVal))
  const rOf = (p: { hours: number; days: number }) => (sizeBy === 'none' ? 5 : 3.5 + 13 * Math.sqrt(sizeVal(p) / maxSize))
  const xTicks = [500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000].filter((v) => v <= maxRev)
  const yTicks: number[] = []
  for (let m = Math.ceil(minM / 20) * 20; m <= maxM; m += 20) yTicks.push(m)
  const drawn = [...scatter.points].sort((a, b) => sizeVal(b) - sizeVal(a))
  const under = target > 0 ? scatter.points.filter((p) => p.trueMarginPct < target).length : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Segmented label="Color by" value={colorBy} options={JOB_SUMMARY_SCATTER_COLOR_OPTIONS} onChange={onColorByChange} />
        <Segmented label="Size by" value={sizeBy} options={JOB_SUMMARY_SCATTER_SIZE_OPTIONS} onChange={onSizeByChange} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {scatter.points.length} jobs · {scatter.skipped > 0 ? `${scatter.skipped} left off (${ledgerLoading ? 'overhead still loading' : 'no revenue or no overhead yet'})` : 'every visible job has a margin'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(16rem, 2fr)', gap: '0.75rem', alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.5rem 0.25rem', minWidth: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Each job as a bubble: revenue across, true margin up" style={{ display: 'block' }} onMouseLeave={() => setHover(null)}>
            {yTicks.map((m) => (
              <g key={m}>
                <line x1={L} x2={W - R} y1={yOf(m)} y2={yOf(m)} stroke={m === 0 ? 'var(--border-strong)' : 'var(--border)'} />
                <text x={L - 6} y={yOf(m) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                  {m}%
                </text>
              </g>
            ))}
            {xTicks.map((v) => (
              <g key={v}>
                <line x1={xOf(v)} x2={xOf(v)} y1={T + ph} y2={T + ph + 4} stroke="var(--border-strong)" />
                <text x={xOf(v)} y={T + ph + 15} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
                  {moneyK(v)}
                </text>
              </g>
            ))}
            <text transform={`rotate(-90 12 ${T + ph / 2})`} x={12} y={T + ph / 2} textAnchor="middle" fontSize={10} fill="var(--text-muted)" style={{ pointerEvents: 'none' }}>
              true margin
            </text>
            <text x={L + pw / 2} y={H - 3} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
              revenue (square-root scale)
            </text>
            {scatter.medianRevenueUsd != null && scatter.medianMarginPct != null ? (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={xOf(scatter.medianRevenueUsd)} x2={xOf(scatter.medianRevenueUsd)} y1={T} y2={T + ph} stroke="var(--text-muted)" strokeDasharray="4 3" />
                <line x1={L} x2={W - R} y1={yOf(scatter.medianMarginPct)} y2={yOf(scatter.medianMarginPct)} stroke="var(--text-muted)" strokeDasharray="4 3" />
                <text x={xOf(scatter.medianRevenueUsd) + 4} y={T + 10} fontSize={9.5} fill="var(--text-muted)">
                  median size {moneyK(scatter.medianRevenueUsd)}
                </text>
                <text x={W - R - 4} y={yOf(scatter.medianMarginPct) - 4} textAnchor="end" fontSize={9.5} fill="var(--text-muted)">
                  median margin {pct(scatter.medianMarginPct)}
                </text>
                <text x={W - R - 4} y={T + ph - 6} textAnchor="end" fontSize={10} fontWeight={700} fill="var(--text-red-700)">
                  big and thin ↘
                </text>
              </g>
            ) : null}
            {target > 0 ? (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={L} x2={W - R} y1={yOf(target)} y2={yOf(target)} stroke="var(--text-strong)" strokeWidth={1.5} strokeDasharray="3 2" />
                <text x={L + 4} y={yOf(target) - 4} fontSize={9.5} fontWeight={700} fill="var(--text-strong)">
                  target {target}% · {under} under
                </text>
              </g>
            ) : null}
            {drawn.map((p) => (
              <circle
                key={p.jobId}
                cx={xOf(p.revenueUsd)}
                cy={yOf(p.trueMarginPct)}
                r={rOf(p)}
                fill={colorOf.get(p.seriesKey) ?? 'var(--text-muted)'}
                fillOpacity={hover == null || hover === p.jobId ? 0.72 : 0.25}
                stroke={hover === p.jobId ? 'var(--text-strong)' : 'var(--surface)'}
                strokeWidth={hover === p.jobId ? 2 : 1.5}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(p.jobId)}
                onClick={() => onOpenJob(p.number)}
              >
                <title>{`${p.number} ${p.name} · ${p.seriesLabel} · revenue ${money(p.revenueUsd)} · true profit ${money(p.trueProfitUsd)} · ${pct(p.trueMarginPct)} · ${p.hours.toFixed(1)} h · ${p.days} d · click to open`}</title>
              </circle>
            ))}
          </svg>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-700)', padding: '0.35rem 0.25rem 0.2rem' }}>
            {scatter.series.map((s) => (
              <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                {s.label} <span style={{ color: 'var(--text-muted)' }}>{s.count}</span>
              </span>
            ))}
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
              bubble = {sizeBy === 'hours' ? 'field hours' : sizeBy === 'days' ? 'days worked' : 'one job'} · dashed = medians · click a bubble to open the job
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
          <div style={tile}>
            <div style={tileK}>Big and thin</div>
            <div style={{ ...tileV, color: scatter.bigThin.length > 0 ? 'var(--text-red-700)' : tileV.color }}>
              {scatter.bigThin.length} {scatter.bigThin.length === 1 ? 'job' : 'jobs'}
            </div>
            <div style={tileS}>above the median size, below the median margin · {money(scatter.bigThin.reduce((a, p) => a + p.shortfallUsd, 0))} short of median margin</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'auto', maxHeight: 340 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr>
                  {['Job', 'Revenue', 'Hours', 'True %', 'Short'].map((h, i) => (
                    <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: i === 0 ? 'left' : 'right', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scatter.bigThin.slice(0, 12).map((p) => (
                  <tr key={p.jobId} onMouseEnter={() => setHover(p.jobId)} onMouseLeave={() => setHover(null)} style={{ background: hover === p.jobId ? 'var(--bg-subtle)' : undefined }}>
                    <td style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '11rem' }}>
                      <button type="button" onClick={() => onOpenJob(p.number)} title={`Open ${p.number} on the Jobs view`} style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer' }}>
                        <b>{p.number}</b> <span style={{ color: 'var(--text-muted)' }}>{p.seriesLabel}</span>
                      </button>
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{money(p.revenueUsd)}</td>
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{p.hours.toFixed(0)}</td>
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)', color: p.trueMarginPct < 0 || (target > 0 && p.trueMarginPct < target) ? 'var(--text-red-700)' : undefined }}>{pct(p.trueMarginPct)}</td>
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{money(p.shortfallUsd)}</td>
                  </tr>
                ))}
                {scatter.bigThin.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                      {scatter.points.length === 0 ? (ledgerLoading ? 'Loading the day ledger…' : 'No jobs with a margin in the window.') : 'No big job sits under the median margin.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>“Short” is the dollars the job would have kept at the median margin. Hover a row to find its bubble.</p>
        </div>
      </div>
    </div>
  )
}
