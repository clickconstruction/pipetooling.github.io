import { useMemo, useState, type CSSProperties } from 'react'
import type { JobDayLedger } from '../../lib/jobs/jobDayLedger'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { JobSummaryEnrichedRow } from '../../lib/jobs/jobSummaryLedgerView'
import { REWORK_COUNT_OPTIONS, REWORK_RATE_BY_OPTIONS, REWORK_WINDOW_OPTIONS, filterReworkPairs, findReworkPairs, reworkRateBy, summarizeRework, type ReworkCount, type ReworkRateBy } from '../../lib/jobs/jobSummaryRework'
import { formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'

/**
 * Job Summary → Rework (v2.2831): did we have to go back? Return visits —
 * a second job at the same address within N days of the first being billed —
 * as a rate by lead tech / service type / GC against the company rate, and
 * the list of pairs so each one can be checked. Runs on every job the page
 * knows (not the Show filter): the first job may be finished long before the
 * window. Presentational; kernel in `lib/jobs/jobSummaryRework.ts`.
 */
type Props = {
  allRows: readonly JobSummaryEnrichedRow[]
  ledger: JobDayLedger | null
  ledgerLoading: boolean
  userNameById: ReadonlyMap<string, string | null | undefined>
  showMoney: boolean
  onOpenJob: (jobNumber: string) => void
}

const RATE = '#d97706'
const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', background: 'var(--bg-subtle)', minWidth: 0 }
const tileK: CSSProperties = { fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }
const tileV: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: 'var(--text-strong)' }
const tileS: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-700)' }
const segWrap: CSSProperties = { display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }
const segLabel: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
function segButton(active: boolean, last: boolean): CSSProperties {
  return { padding: '0.3rem 0.65rem', fontSize: '0.78rem', fontWeight: 600, border: 'none', borderRight: last ? 'none' : '1px solid var(--border)', background: active ? '#2563eb' : 'transparent', color: active ? '#fff' : 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
}
function Segmented<K extends string | number>({ label, value, options, onChange }: { label: string; value: K; options: ReadonlyArray<{ key: K; label: string; title?: string }>; onChange: (k: K) => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={segLabel}>{label}</span>
      <span style={segWrap} role="group" aria-label={label}>
        {options.map((o, i) => (
          <button key={String(o.key)} type="button" aria-pressed={value === o.key} title={o.title} onClick={() => onChange(o.key)} style={segButton(value === o.key, i === options.length - 1)}>
            {o.label}
          </button>
        ))}
      </span>
    </span>
  )
}
const money = (v: number | null | undefined): string => (v == null ? '—' : `${v < 0 ? '−' : ''}${formatUsdNoCents(Math.abs(v))}`)
const pct = (v: number | null | undefined): string => (v == null ? '—' : `${v.toFixed(1)}%`)
const linkBtn: CSSProperties = { border: 'none', background: 'transparent', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer' }

export default function JobSummaryReworkView({ allRows, ledger, ledgerLoading, userNameById, showMoney, onOpenJob }: Props) {
  const [windowDays, setWindowDays] = useState(90)
  const [rateBy, setRateBy] = useState<ReworkRateBy>('tech')
  const [count, setCount] = useState<ReworkCount>('callbacks')
  const ctx = useMemo(() => ({ userNameById }), [userNameById])
  const allPairs = useMemo(() => findReworkPairs(allRows, ledger, windowDays), [allRows, ledger, windowDays])
  const pairs = useMemo(() => filterReworkPairs(allPairs, count), [allPairs, count])
  const repeatCount = allPairs.length - allPairs.filter((p) => p.kind === 'callback').length
  const groups = useMemo(() => reworkRateBy(pairs, allRows, rateBy, ctx).filter((g) => g.jobs >= 2).slice(0, 12), [pairs, allRows, rateBy, ctx])
  const summary = useMemo(() => summarizeRework(pairs, allRows), [pairs, allRows])

  const W = 520
  const L = 150
  const R = 120
  const rowH = 24
  const H = 12 + Math.max(1, groups.length) * rowH + 8
  const maxRate = Math.max(1, summary.ratePct ?? 0, ...groups.map((g) => g.ratePct ?? 0)) * 1.15
  const xOf = (v: number) => L + (W - L - R) * (v / maxRate)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Segmented label="Rate by" value={rateBy} options={REWORK_RATE_BY_OPTIONS} onChange={setRateBy} />
        <Segmented label="Window" value={windowDays} options={REWORK_WINDOW_OPTIONS} onChange={setWindowDays} />
        <Segmented label="Count" value={count} options={REWORK_COUNT_OPTIONS} onChange={setCount} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          a return = a second job at the same address that started within the window after the first was billed{count === 'callbacks' && repeatCount > 0 ? ` · ${repeatCount} billed returns (repeat work) set aside` : ''}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.5rem' }}>
        <div style={tile}>
          <div style={tileK}>Return-visit rate</div>
          <div style={{ ...tileV, color: summary.returns > 0 ? 'var(--text-amber-800)' : tileV.color }}>{pct(summary.ratePct)}</div>
          <div style={tileS}>
            {summary.returns} {summary.returns === 1 ? 'return' : 'returns'} over {summary.finishedJobs} finished jobs
          </div>
        </div>
        {showMoney ? (
          <div style={tile}>
            <div style={tileK}>Cost of going back</div>
            <div style={{ ...tileV, color: 'var(--text-red-700)' }}>{money(summary.returnCostUsd)}</div>
            <div style={tileS}>labor, subs, parts, overhead on the return jobs · billed {money(summary.returnRevenueUsd)}</div>
          </div>
        ) : null}
        <div style={tile}>
          <div style={tileK}>Worst group</div>
          <div style={tileV}>{groups[0] && groups[0].returns > 0 ? pct(groups[0].ratePct) : '—'}</div>
          <div style={tileS}>{groups[0] && groups[0].returns > 0 ? `${groups[0].label} · ${groups[0].returns} of ${groups[0].jobs}` : 'no returns in the window'}</div>
        </div>
        <div style={tile}>
          <div style={tileK}>Can’t place</div>
          <div style={tileV}>{summary.unplaced}</div>
          <div style={tileS}>jobs with no address to match on</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.75rem', alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.6rem 0.25rem', minWidth: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Return-visit rate by ${rateBy}`} style={{ display: 'block' }}>
            {summary.ratePct != null ? (
              <g>
                <line x1={xOf(summary.ratePct)} x2={xOf(summary.ratePct)} y1={6} y2={H - 6} stroke="var(--text-muted)" strokeDasharray="4 3" />
                <text x={xOf(summary.ratePct) + 4} y={10} fontSize={9.5} fill="var(--text-muted)">
                  company {pct(summary.ratePct)}
                </text>
              </g>
            ) : null}
            {groups.map((g, i) => {
              const y = 12 + i * rowH
              const w = xOf(g.ratePct ?? 0) - L
              return (
                <g key={g.key}>
                  <title>{`${g.label} · ${g.returns} ${g.returns === 1 ? 'return' : 'returns'} over ${g.jobs} finished jobs · ${pct(g.ratePct)}`}</title>
                  <text x={L - 8} y={y + rowH / 2 + 4} textAnchor="end" fontSize={11} fill="var(--text)">
                    {g.label.length > 22 ? `${g.label.slice(0, 21)}…` : g.label}
                  </text>
                  <rect x={L} y={y + 6} width={Math.max(2, w)} height={rowH - 12} rx={3} fill={RATE} opacity={g.returns > 0 ? 0.9 : 0.25} />
                  <text x={L + Math.max(2, w) + 5} y={y + rowH / 2 + 4} fontSize={10.5} fill="var(--text-muted)">
                    {pct(g.ratePct)} · {g.returns} of {g.jobs}
                  </text>
                </g>
              )
            })}
            {groups.length === 0 ? (
              <text x={L} y={24} fontSize={11} fill="var(--text-muted)">
                {ledgerLoading ? 'Loading…' : 'No groups with two or more finished jobs.'}
              </text>
            ) : null}
          </svg>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0.35rem 0.25rem 0.2rem' }}>groups with at least two finished jobs · the rate credits the return to the first job’s {REWORK_RATE_BY_OPTIONS.find((o) => o.key === rateBy)?.label}</div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', overflow: 'auto', maxHeight: 420, minWidth: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr>
                {['First job', 'Return', 'Days after', showMoney ? (count === 'all' ? 'Return billed · cost' : 'Cost of return') : 'Address'].map((h, i) => (
                  <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairs.slice(0, 60).map((p) => (
                <tr key={`${p.first.jobId}-${p.second.jobId}`}>
                  <td style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '12rem' }} title={p.addressLabel}>
                    <button type="button" onClick={() => onOpenJob(p.first.number)} style={linkBtn}>
                      <b>{p.first.number}</b> {p.first.name}
                    </button>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{p.first.doneYmd ? `billed ${formatStagesNextDateLabel(p.first.doneYmd)}` : ''}</div>
                  </td>
                  <td style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '12rem' }}>
                    <button type="button" onClick={() => onOpenJob(p.second.number)} style={linkBtn}>
                      <b>{p.second.number}</b> {p.second.name}
                    </button>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{p.second.startYmd ? `started ${formatStagesNextDateLabel(p.second.startYmd)}` : ''}</div>
                  </td>
                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{p.daysAfter}</td>
                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', borderBottom: '1px solid var(--border)', color: showMoney ? 'var(--text-red-700)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '10rem' }}>
                    {showMoney ? (count === 'all' ? `${p.kind === 'repeat' ? money(p.returnRevenueUsd) : '$0'} · ${money(p.returnCostUsd)}` : money(p.returnCostUsd)) : p.addressLabel}
                  </td>
                </tr>
              ))}
              {pairs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                    {ledgerLoading ? 'Loading the day ledger…' : `No return visits within ${windowDays} days.`}
                  </td>
                </tr>
              ) : null}
              {pairs.length > 60 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>… {pairs.length - 60} more</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Jobs match by their address record, else by the street text (suite and unit numbers ignored). An unbilled return is the warranty-shaped one; a billed return is repeat work at the same site and is set aside unless you count all returns. Marking a pair “not rework” is a follow-up.
      </p>
    </div>
  )
}
