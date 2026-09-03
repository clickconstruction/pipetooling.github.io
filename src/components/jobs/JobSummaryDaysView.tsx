import { useMemo, useState, type CSSProperties } from 'react'
import type { JobDayLedger } from '../../lib/jobs/jobDayLedger'
import type { SessionNotesJobIdentity } from '../../lib/jobs/sessionNotesSearch'
import SessionNotesModal from './SessionNotesModal'
import { buildJobDaysChartSeries, buildJobDaysRows, orderJobDaysRows, summarizeJobDays } from '../../lib/jobs/jobDaysConcurrency'
import { formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

/**
 * Job Summary → Days (v2.2695): how many jobs the crew carried each day. Reads
 * the same job day ledger true profit charges from, so the "per job-day"
 * overhead here is exactly the unit the Jobs view's day-share spends. Rows are
 * newest first; the chart stacks each day's field hours by job.
 */
export type JobSummaryDaysJobLabel = { number: string; name: string }

type Props = {
  ledger: JobDayLedger | null
  ledgerLoading: boolean
  ledgerError: string | null
  jobLabelById: ReadonlyMap<string, JobSummaryDaysJobLabel>
  /** Pay lockdown: pool $ / per job-day only for dev, master, controller. */
  showMoney: boolean
  /** Click a day → Session notes pinned to it, grouped by job (v2.2699). Office roles only. */
  canOpenSessionNotes: boolean
  users: ReadonlyArray<{ id: string; name: string | null }>
  jobs: ReadonlyArray<SessionNotesJobIdentity>
}

/** Saturated series colors for the keyed jobs (status/action colors stay literal per the theme rule); "other" uses a muted token. */
const SERIES_COLORS = ['#2563eb', '#0e9f8a', '#d97706', '#7c3aed', '#db2777', '#0891b2']
const OTHER_COLOR = 'var(--text-faint)'

const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', background: 'var(--bg-subtle)', minWidth: 0 }
const tileK: CSSProperties = { fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }
const tileV: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: 'var(--text-strong)' }
const tileS: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-700)' }
const th: CSSProperties = { padding: '0.5rem 0.6rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap', background: 'var(--bg-subtle)' }
const td: CSSProperties = { padding: '0.45rem 0.6rem', textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }

/** `formatUsdNoCents` already carries the "$". */
const money = (v: number | null): string => (v == null ? '—' : formatUsdNoCents(v))

/** The page's ledger list first (it carries service-type prefixes when set), then the ledger's own labels, then a short id. */
function jobLabel(jobLabelById: ReadonlyMap<string, JobSummaryDaysJobLabel>, ledger: JobDayLedger | null, jobId: string): JobSummaryDaysJobLabel {
  // `jobLabels` is optional-chained too: a ledger deserialized by an older build has none.
  return jobLabelById.get(jobId) ?? ledger?.jobLabels?.get(jobId) ?? { number: jobId.slice(0, 8), name: '' }
}

export default function JobSummaryDaysView({ ledger, ledgerLoading, ledgerError, jobLabelById, showMoney, canOpenSessionNotes, users, jobs }: Props) {
  const [includeQuiet, setIncludeQuiet] = useState(false)
  const [sessionNotesDay, setSessionNotesDay] = useState<string | null>(null)
  const rows = useMemo(() => (ledger ? buildJobDaysRows(ledger) : []), [ledger])
  const summary = useMemo(() => summarizeJobDays(rows), [rows])
  const series = useMemo(() => buildJobDaysChartSeries(rows, SERIES_COLORS.length), [rows])
  const ordered = useMemo(() => orderJobDaysRows(rows, { includeQuiet }), [rows, includeQuiet])
  const colorByJob = useMemo(() => new Map(series.keyJobIds.map((id, i) => [id, SERIES_COLORS[i] ?? OTHER_COLOR])), [series.keyJobIds])

  if (!ledger) {
    return (
      <p style={{ color: ledgerError ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
        {ledgerError ? `Day ledger failed: ${ledgerError}` : ledgerLoading ? 'Loading the day ledger…' : 'No day ledger yet.'}
      </p>
    )
  }

  // Chart geometry — one bar per calendar day; ticks thin out on long windows.
  const W = 760
  const H = 230
  const L = 40
  const R = 10
  const T = 14
  const B = 34
  const n = Math.max(1, series.days.length)
  const iw = (W - L - R) / n
  const maxH = Math.max(8, Math.ceil(series.maxHours / 8) * 8)
  const gridStep = maxH / 4
  const tickEvery = Math.max(1, Math.round(n / 12))
  const plotH = H - T - B
  const gapPx = n > 90 ? 0.5 : n > 40 ? 1 : 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.5rem' }}>
        <div style={tile}>
          <div style={tileK}>Workdays</div>
          <div style={tileV}>{summary.workdays}</div>
          <div style={tileS}>of {summary.calendarDays} calendar days</div>
        </div>
        <div style={tile}>
          <div style={tileK}>Jobs per workday</div>
          <div style={tileV}>{summary.avgJobsPerWorkday == null ? '—' : `${summary.avgJobsPerWorkday.toFixed(1)} avg · ${summary.maxJobsPerWorkday} max`}</div>
          <div style={tileS}>median {summary.medianJobsPerWorkday ?? '—'} · {summary.jobDays} job-days</div>
        </div>
        {showMoney ? (
          <div style={tile}>
            <div style={tileK}>Overhead per job-day</div>
            <div style={tileV}>{money(summary.overheadPerJobDayUsd)}</div>
            <div style={tileS}>pool on workdays ÷ job-days{summary.unallocatedUsd > 0 ? ` · ${money(summary.unallocatedUsd)} on quiet days` : ''}</div>
          </div>
        ) : null}
        <div style={tile}>
          <div style={tileK}>Field hours</div>
          <div style={tileV}>{summary.totalFieldHours.toFixed(1)}</div>
          <div style={tileS}>{summary.totalPeopleDays} people-days · {summary.workdays > 0 ? (summary.totalFieldHours / summary.workdays).toFixed(1) : '—'} h per workday</div>
        </div>
        <div style={tile}>
          <div style={tileK}>Workdays by jobs carried</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44, marginTop: 6 }}>
            {summary.histogram.slice(1).map((count, i) => {
              const max = Math.max(1, ...summary.histogram.slice(1))
              return (
                <div key={i} title={`${count} ${count === 1 ? 'workday' : 'workdays'} carried ${i + 1} ${i === 0 ? 'job' : 'jobs'}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-700)', lineHeight: 1 }}>{count}</span>
                  <div style={{ width: '100%', height: `${Math.max(2, (count / max) * 28)}px`, background: '#2563eb', borderRadius: '2px 2px 0 0' }} />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{i + 1}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.5rem 0.25rem' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-700)', padding: '0 0.25rem 0.35rem' }}>
          {series.keyJobIds.map((id) => {
            const l = jobLabel(jobLabelById, ledger, id)
            return (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: colorByJob.get(id) }} />
                {l.number}
                {l.name ? <span style={{ color: 'var(--text-muted)' }}>{l.name}</span> : null}
              </span>
            )
          })}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: OTHER_COLOR }} />
            other jobs
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>bar = that day’s field hours by job · number = jobs carried</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Field hours per day, stacked by job" style={{ display: 'block' }}>
          {[0, 1, 2, 3, 4].map((k) => {
            const v = k * gridStep
            const y = T + plotH * (1 - v / maxH)
            return (
              <g key={k}>
                <line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
                <text x={L - 6} y={y + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                  {v}h
                </text>
              </g>
            )
          })}
          {series.days.map((d, i) => {
            const x = L + i * iw + gapPx / 2
            const w = Math.max(0.5, iw - gapPx)
            let y = T + plotH
            const dayRow = rows[i]
            return (
              <g key={d.ymd}>
                {d.segments.map((s, j) => {
                  const h = plotH * (s.hours / maxH)
                  y -= h
                  const l = s.jobId ? jobLabel(jobLabelById, ledger, s.jobId) : null
                  return (
                    <rect key={j} x={x} y={y} width={w} height={h} fill={s.jobId ? colorByJob.get(s.jobId) : OTHER_COLOR} rx={n > 60 ? 0 : 1}>
                      <title>{`${formatStagesNextDateLabel(d.ymd)} · ${l ? `${l.number} ${l.name}`.trim() : 'other jobs'} · ${s.hours.toFixed(1)} h${dayRow ? ` · ${dayRow.jobs} jobs that day` : ''}`}</title>
                    </rect>
                  )
                })}
                {n <= 60 ? (
                  <text x={x + w / 2} y={H - B + 13} textAnchor="middle" fontSize={10} fontWeight={700} fill={d.jobs ? 'var(--text-700)' : 'var(--text-faint)'}>
                    {d.jobs || '·'}
                  </text>
                ) : null}
                {i % tickEvery === 0 ? (
                  <text x={x + w / 2} y={H - B + 26} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
                    {formatStagesNextDateLabel(d.ymd).replace(/^\w+ /, '')}
                  </text>
                ) : null}
              </g>
            )
          })}
          {n <= 60 ? (
            <text x={L} y={H - B + 13} textAnchor="end" fontSize={9} fill="var(--text-muted)">
              jobs
            </text>
          ) : null}
        </svg>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.78rem', color: 'var(--text-700)' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={includeQuiet} onChange={(e) => setIncludeQuiet(e.target.checked)} />
          Show days with nothing on them
        </label>
        <span style={{ color: 'var(--text-muted)' }}>
          Newest first · people are distinct names with approved time that day{canOpenSessionNotes ? ' · click a day for its session notes' : ''}
        </span>
      </div>
      {sessionNotesDay ? (
        <SessionNotesModal initialJob={null} initialDay={sessionNotesDay} initialGroupBy="job" users={users} jobs={jobs} onClose={() => setSessionNotesDay(null)} />
      ) : null}

      <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Day</th>
              <th style={th}>Jobs</th>
              <th style={th}>People</th>
              <th style={th}>Field h</th>
              {showMoney ? <th style={th}>Pool</th> : null}
              {showMoney ? <th style={th}>Per job-day</th> : null}
              <th style={{ ...th, textAlign: 'left' }}>Worked</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => (
              <tr key={r.ymd}>
                <td style={{ ...td, textAlign: 'left' }}>
                  {canOpenSessionNotes ? (
                    <button
                      type="button"
                      onClick={() => setSessionNotesDay(r.ymd)}
                      title="Open Session notes for this day, grouped by job"
                      aria-label={`Session notes for ${formatStagesNextDateLabel(r.ymd)}`}
                      style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {formatStagesNextDateLabel(r.ymd)} <span aria-hidden style={{ color: 'var(--text-faint)' }}>›</span>
                    </button>
                  ) : (
                    formatStagesNextDateLabel(r.ymd)
                  )}
                </td>
                <td style={{ ...td, fontWeight: 700, color: r.jobs ? 'var(--text-strong)' : 'var(--text-faint)' }}>{r.jobs}</td>
                <td style={{ ...td, color: r.people ? undefined : 'var(--text-faint)' }}>{r.people}</td>
                <td style={{ ...td, color: r.fieldHours ? undefined : 'var(--text-faint)' }}>{r.fieldHours.toFixed(1)}</td>
                {showMoney ? <td style={td}>{money(r.poolUsd)}</td> : null}
                {showMoney ? (
                  <td style={td}>
                    {r.perJobDayUsd == null ? (
                      <span style={{ color: 'var(--text-muted)' }}>
                        —{r.poolUsd > 0 ? <span style={{ marginLeft: 4, fontSize: '0.66rem', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 4, padding: '0 4px' }}>unallocated</span> : null}
                      </span>
                    ) : (
                      money(r.perJobDayUsd)
                    )}
                  </td>
                ) : null}
                <td style={{ ...td, textAlign: 'left', whiteSpace: 'normal' }}>
                  {r.slices.length === 0 ? (
                    <span style={{ color: 'var(--text-faint)' }}>{r.poolUsd > 0 ? 'office only' : 'no field work'}</span>
                  ) : (
                    r.slices.map((s) => {
                      const l = jobLabel(jobLabelById, ledger, s.jobId)
                      const color = colorByJob.get(s.jobId) ?? OTHER_COLOR
                      return (
                        <span
                          key={s.jobId}
                          title={`${l.number} ${l.name}`.trim() + ` · ${s.people.join(', ')}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 600, color: '#fff', background: color, margin: '1px 3px 1px 0', whiteSpace: 'nowrap' }}
                        >
                          {l.number} {s.hours.toFixed(1)}h
                          <span style={{ opacity: 0.85, fontWeight: 400 }}>· {s.people.length}</span>
                        </span>
                      )
                    })
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
