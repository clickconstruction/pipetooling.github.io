import { useMemo, useState, type CSSProperties } from 'react'
import type { JobDayLedger } from '../../lib/jobs/jobDayLedger'
import {
  JOB_RUN_DEFINITIONS,
  JOB_RUN_GAP_OPTIONS,
  buildRunningSeries,
  buildStatusSpans,
  buildWorkedSpans,
  monthTicks,
  summarizeJobRuns,
  type JobRunBucket,
  type JobRunDefinition,
  type JobRunRow,
} from '../../lib/jobs/jobRunningTimeline'
import type { SessionNotesJobIdentity } from '../../lib/jobs/sessionNotesSearch'
import { formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'
import SessionNotesModal from './SessionNotesModal'

/**
 * Job Summary → Timeline (v2.2711, mock-up "C"): how many jobs were running at
 * once, over time. A stacked area of the running count per day split by how
 * each job stands today (working / billed awaiting payment / paid), a 7-day
 * average, the peak, and the jobs themselves as bars in a collapsed panel.
 * Reads the same job day ledger the Jobs and Days views use.
 */
type Props = {
  ledger: JobDayLedger | null
  ledgerLoading: boolean
  ledgerError: string | null
  /** jobs_ledger.status per job from the page's ledger list (wins over the day ledger's own snapshot). */
  statusByJob: ReadonlyMap<string, string | null | undefined>
  todayYmd: string
  canOpenSessionNotes: boolean
  users: ReadonlyArray<{ id: string; name: string | null }>
  jobs: ReadonlyArray<SessionNotesJobIdentity>
}

/** Saturated status colors (literal per the theme rule). */
const BUCKET_COLOR: Record<JobRunBucket, string> = { working: '#2563eb', billed: '#d97706', paid: '#15803d' }
const BUCKET_LABEL: Record<JobRunBucket, string> = { working: 'working', billed: 'billed, awaiting payment', paid: 'paid' }

const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', background: 'var(--bg-subtle)', minWidth: 0 }
const tileK: CSSProperties = { fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }
const tileV: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: 'var(--text-strong)' }
const tileS: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-700)' }
const segWrap: CSSProperties = { display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }
const segLabel: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
function segButton(active: boolean, last: boolean): CSSProperties {
  return { padding: '0.3rem 0.65rem', fontSize: '0.78rem', fontWeight: 600, border: 'none', borderRight: last ? 'none' : '1px solid var(--border)', background: active ? '#2563eb' : 'transparent', color: active ? '#fff' : 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
}

function dayLabel(ymd: string): string {
  return formatStagesNextDateLabel(ymd)
}

export default function JobSummaryTimelineView({ ledger, ledgerLoading, ledgerError, statusByJob, todayYmd, canOpenSessionNotes, users, jobs }: Props) {
  const [definition, setDefinition] = useState<JobRunDefinition>('worked')
  const [gapDays, setGapDays] = useState(7)
  const [sessionNotesDay, setSessionNotesDay] = useState<string | null>(null)
  const [barsOpen, setBarsOpen] = useState(false)

  const mergedStatus = useMemo(() => {
    const m = new Map<string, string | null | undefined>()
    if (ledger) for (const [id, l] of ledger.jobLabels ?? []) m.set(id, l.status)
    for (const [id, s] of statusByJob) if (s != null) m.set(id, s)
    return m
  }, [ledger, statusByJob])

  const rows: JobRunRow[] = useMemo(() => {
    if (!ledger) return []
    return definition === 'worked'
      ? buildWorkedSpans({ ledger, statusByJob: mergedStatus, todayYmd, gapDays })
      : buildStatusSpans({ ledger, statusSpansByJob: ledger.statusSpansByJob ?? new Map(), statusByJob: mergedStatus, todayYmd })
  }, [ledger, mergedStatus, todayYmd, definition, gapDays])
  const dayYmds = useMemo(() => (ledger ? ledger.days.map((d) => d.ymd) : []), [ledger])
  const series = useMemo(() => buildRunningSeries(rows, dayYmds, todayYmd), [rows, dayYmds, todayYmd])
  const summary = useMemo(() => summarizeJobRuns(rows), [rows])
  const ticks = useMemo(() => monthTicks(dayYmds), [dayYmds])

  if (!ledger) {
    return (
      <p style={{ color: ledgerError ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
        {ledgerError ? `Day ledger failed: ${ledgerError}` : ledgerLoading ? 'Loading the day ledger…' : 'No day ledger yet.'}
      </p>
    )
  }

  // ---- load chart geometry ----
  const W = 1000
  const H = 250
  const L = 36
  const R = 12
  const T = 16
  const B = 30
  const n = Math.max(1, series.days.length)
  const iw = (W - L - R) / n
  const plotH = H - T - B
  const maxY = Math.max(4, Math.ceil(((series.peak?.total ?? 0) + 1) / 2) * 2)
  const yOf = (v: number) => T + plotH * (1 - v / maxY)
  const gridStep = maxY <= 8 ? 2 : maxY <= 20 ? 4 : Math.ceil(maxY / 5)
  const gridVals: number[] = []
  for (let v = 0; v <= maxY; v += gridStep) gridVals.push(v)
  // Stack order, bottom → top (v2.2734, owner's call): the still-working jobs
  // are the calm carry, so they set the floor; billed rides on them and the
  // paid one-day calls — the jumpy part — sit on top where they don't shake
  // everything beneath.
  const order: JobRunBucket[] = ['working', 'billed', 'paid']
  const areaPaths = (() => {
    const base = series.days.map(() => 0)
    return order.map((bucket) => {
      let up = ''
      let down = ''
      for (let i = 0; i < series.days.length; i++) {
        const x = L + i * iw
        const top = base[i]! + series.days[i]![bucket]
        up += `${up ? ' L' : 'M'}${x.toFixed(1)} ${yOf(top).toFixed(1)} L${(x + iw).toFixed(1)} ${yOf(top).toFixed(1)}`
      }
      for (let i = series.days.length - 1; i >= 0; i--) {
        const x = L + i * iw
        down += ` L${(x + iw).toFixed(1)} ${yOf(base[i]!).toFixed(1)} L${x.toFixed(1)} ${yOf(base[i]!).toFixed(1)}`
      }
      for (let i = 0; i < series.days.length; i++) base[i]! += series.days[i]![bucket]
      return { bucket, d: `${up}${down} Z` }
    })
  })()
  const avgPath = series.avg7.map((v, i) => `${i === 0 ? 'M' : 'L'}${(L + i * iw + iw / 2).toFixed(1)} ${yOf(v).toFixed(1)}`).join(' ')
  const todayIdx = dayYmds.indexOf(todayYmd)
  const peakIdx = series.peak ? dayYmds.indexOf(series.peak.ymd) : -1

  // ---- bars geometry ----
  const BL = 150
  const rowH = 16
  const barsH = 30 + rows.length * rowH
  const biw = (W - BL - R) / n
  const dayIndex = (ymd: string) => Math.max(0, Math.min(n - 1, dayYmds.indexOf(ymd)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={segLabel}>Running =</span>
          <span style={segWrap} role="group" aria-label="Definition of running">
            {JOB_RUN_DEFINITIONS.map((o, i) => (
              <button key={o.key} type="button" aria-pressed={definition === o.key} title={o.title} onClick={() => setDefinition(o.key)} style={segButton(definition === o.key, i === JOB_RUN_DEFINITIONS.length - 1)}>
                {o.label}
              </button>
            ))}
          </span>
        </span>
        {definition === 'worked' ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={segLabel}>Gap</span>
            <span style={segWrap} role="group" aria-label="Idle gap allowed inside a run">
              {JOB_RUN_GAP_OPTIONS.map((o, i) => (
                <button key={o.key} type="button" aria-pressed={gapDays === o.key} title={o.title} onClick={() => setGapDays(o.key)} style={segButton(gapDays === o.key, i === JOB_RUN_GAP_OPTIONS.length - 1)}>
                  {o.label}
                </button>
              ))}
            </span>
          </span>
        ) : null}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {definition === 'worked'
            ? 'A job runs from its first approved field day to its last; still-open jobs run to today. A pause longer than the gap splits the run.'
            : 'A job runs from its Working move to its Billed or Paid move, touched or not.'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.5rem' }}>
        <div style={tile}>
          <div style={tileK}>Running today</div>
          <div style={tileV}>{series.todayTotal}</div>
          <div style={tileS}>jobs open right now</div>
        </div>
        <div style={tile}>
          <div style={tileK}>Average</div>
          <div style={tileV}>{series.averageTotal.toFixed(1)}</div>
          <div style={tileS}>jobs running per day, every day in the window</div>
        </div>
        <div style={tile}>
          <div style={tileK}>Peak</div>
          <div style={tileV}>{series.peak ? series.peak.total : '—'}</div>
          <div style={tileS}>{series.peak ? `on ${dayLabel(series.peak.ymd)}` : 'no runs in the window'}</div>
        </div>
        <div style={tile}>
          <div style={tileK}>Jobs in window</div>
          <div style={tileV}>{summary.jobs}</div>
          <div style={tileS}>{summary.open} still open · {summary.finished} {definition === 'worked' ? 'finished or idle' : 'finished'}</div>
        </div>
        <div style={tile}>
          <div style={tileK}>Median run</div>
          <div style={tileV}>{summary.medianRunDays == null ? '—' : `${Math.round(summary.medianRunDays)} d`}</div>
          <div style={tileS}>{definition === 'worked' ? 'first to last work' : 'Working to Billed'}</div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.5rem 0.25rem' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Jobs running per day, stacked by status" style={{ display: 'block' }}>
          {gridVals.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 6} y={yOf(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                {v}
              </text>
            </g>
          ))}
          {areaPaths.map((p) => (
            <path key={p.bucket} d={p.d} fill={BUCKET_COLOR[p.bucket]} opacity={0.82} />
          ))}
          <path d={avgPath} fill="none" stroke="var(--text-strong)" strokeWidth={1.5} />
          {ticks.map((t) => (
            <g key={t.index}>
              <line x1={L + t.index * iw} x2={L + t.index * iw} y1={T + plotH} y2={T + plotH + 5} stroke="var(--border-strong)" />
              <text x={L + t.index * iw + 3} y={T + plotH + 16} fontSize={10} fill="var(--text-muted)">
                {t.label}
              </text>
            </g>
          ))}
          {todayIdx >= 0 ? (
            <g>
              <line x1={L + todayIdx * iw + iw / 2} x2={L + todayIdx * iw + iw / 2} y1={T} y2={T + plotH} stroke="var(--text-red-700)" strokeDasharray="3 3" />
              <text x={L + todayIdx * iw + iw / 2 - 3} y={T - 4} textAnchor="end" fontSize={9} fill="var(--text-red-700)">
                today · {series.todayTotal}
              </text>
            </g>
          ) : null}
          {series.peak && peakIdx >= 0 ? (
            <g>
              <circle cx={L + peakIdx * iw + iw / 2} cy={yOf(series.peak.total)} r={3.5} fill="var(--text-strong)" />
              <text x={L + peakIdx * iw + iw / 2 + 6} y={yOf(series.peak.total) - 5} fontSize={10} fontWeight={700} fill="var(--text-strong)">
                peak {series.peak.total} · {dayLabel(series.peak.ymd).replace(/^\w+ /, '')}
              </text>
            </g>
          ) : null}
          {/* Hover/click columns: a title per day, and the day door to Session notes. */}
          {series.days.map((d, i) => (
            <rect
              key={d.ymd}
              x={L + i * iw}
              y={T}
              width={Math.max(0.5, iw)}
              height={plotH}
              fill="transparent"
              style={{ cursor: canOpenSessionNotes && d.total > 0 ? 'pointer' : 'default' }}
              onClick={() => {
                if (canOpenSessionNotes && d.total > 0) setSessionNotesDay(d.ymd)
              }}
            >
              <title>{`${dayLabel(d.ymd)} · ${d.total} running (${d.working} working · ${d.billed} billed · ${d.paid} paid) · 7-day avg ${series.avg7[i]!.toFixed(1)}${canOpenSessionNotes && d.total > 0 ? ' · click for session notes' : ''}`}</title>
            </rect>
          ))}
        </svg>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-700)', padding: '0.35rem 0.25rem 0.2rem' }}>
          {order.map((b) => (
              <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: BUCKET_COLOR[b] }} />
                {BUCKET_LABEL[b]}
              </span>
            ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--text-strong)' }} />
            7-day average
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>hover a day for its split{canOpenSessionNotes ? ' · click it for that day’s session notes' : ''}</span>
        </div>
      </div>

      <details open={barsOpen} onToggle={(e) => setBarsOpen((e.currentTarget as HTMLDetailsElement).open)} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.4rem 0.6rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-700)', fontSize: '0.85rem' }}>
          {barsOpen ? '▾' : '▸'} The {summary.jobs} {summary.jobs === 1 ? 'job' : 'jobs'} behind this curve
        </summary>
        {barsOpen ? (
          rows.length === 0 ? (
            <p style={{ margin: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No runs in the window.</p>
          ) : (
            <div style={{ overflow: 'auto', maxHeight: 560, marginTop: '0.4rem' }}>
              <svg viewBox={`0 0 ${W} ${barsH}`} width="100%" style={{ display: 'block', minWidth: 640 }} role="img" aria-label="One bar per job from its first to its last running day">
                {ticks.map((t) => (
                  <g key={t.index}>
                    <line x1={BL + t.index * biw} x2={BL + t.index * biw} y1={4} y2={barsH - 6} stroke="var(--border)" />
                    <text x={BL + t.index * biw + 3} y={12} fontSize={10} fill="var(--text-muted)">
                      {t.label}
                    </text>
                  </g>
                ))}
                {todayIdx >= 0 ? <line x1={BL + todayIdx * biw + biw / 2} x2={BL + todayIdx * biw + biw / 2} y1={4} y2={barsH - 6} stroke="var(--text-red-700)" strokeDasharray="3 3" /> : null}
                {rows.map((r, ri) => {
                  const y = 20 + ri * rowH
                  return (
                    <g key={r.jobId}>
                      <text x={BL - 6} y={y + 11} textAnchor="end" fontSize={10.5} fontWeight={600} fill="var(--text)">
                        {r.label.number}
                      </text>
                      <text x={BL - 6 - 42} y={y + 11} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                        {r.label.name.length > 16 ? `${r.label.name.slice(0, 15)}…` : r.label.name}
                      </text>
                      {r.segments.map((s) => {
                        const a = dayIndex(s.startYmd)
                        const b = dayIndex(s.endYmd)
                        return (
                          <rect key={s.startYmd} x={BL + a * biw} y={y + 3} width={Math.max(1.5, (b - a + 1) * biw)} height={rowH - 6} rx={2} fill={BUCKET_COLOR[r.bucket]} opacity={r.bucket === 'paid' ? 0.7 : 1}>
                            <title>{`${r.label.number} ${r.label.name} · ${dayLabel(s.startYmd)} → ${dayLabel(s.endYmd)} · ${BUCKET_LABEL[r.bucket]}${r.open ? ' · still open' : ''}`}</title>
                          </rect>
                        )
                      })}
                      {r.open ? (
                        <text x={BL + (dayIndex(r.endYmd) + 1) * biw + 3} y={y + 11} fontSize={9} fill="var(--text-muted)">
                          open
                        </text>
                      ) : null}
                    </g>
                  )
                })}
              </svg>
            </div>
          )
        ) : null}
      </details>

      {sessionNotesDay ? <SessionNotesModal initialJob={null} initialDay={sessionNotesDay} initialGroupBy="job" users={users} jobs={jobs} onClose={() => setSessionNotesDay(null)} /> : null}
    </div>
  )
}
