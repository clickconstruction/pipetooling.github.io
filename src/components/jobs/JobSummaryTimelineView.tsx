import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { JobDayLedger } from '../../lib/jobs/jobDayLedger'
import {
  JOB_RUN_BAND_LABEL,
  JOB_RUN_COLOR_BY_OPTIONS,
  JOB_RUN_DEFINITIONS,
  JOB_RUN_GAP_OPTIONS,
  JOB_RUN_AS_OF_JUMPS,
  asOfYmdForDaysBack,
  daysBackLabel,
  jobRunDeltaSince,
  bucketRunningWeekly,
  buildRunningSeriesBy,
  buildStatusSpans,
  buildWorkedSpans,
  colorSegmentsForRow,
  monthTicks,
  summarizeJobRuns,
  type JobRunBand,
  type JobRunColorBy,
  type JobRunDefinition,
  type JobRunDeltaSince,
  type JobRunRow,
  type JobRunningWeeklySeries,
} from '../../lib/jobs/jobRunningTimeline'
import type { SessionNotesJobIdentity } from '../../lib/jobs/sessionNotesSearch'
import { formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'
import SessionNotesModal from './SessionNotesModal'

/**
 * Job Summary → Timeline (v2.2711, mock-up "C"): how many jobs were running at
 * once, over time. A stacked area of the running count per day, a 7-day
 * average, the peak, and the jobs themselves as bars in a collapsed panel.
 * Reads the same job day ledger the Jobs and Days views use.
 *
 * Stack order (v2.2734, owner's call): the calm carry sets the floor and the
 * churn rides on top — working / billed / paid, or 6+ days / 2–5 / 1 day.
 * Color by (v2.2745): today's status, the state on each day, or run length.
 * As of (v2.2807, mock-up "C"): a slider walks the chart back a day at a time —
 * the window clips at that day, buckets are as they stood then, the days after
 * ghost to a dashed outline, and a strip counts what changed since.
 */
type Props = {
  ledger: JobDayLedger | null
  ledgerLoading: boolean
  ledgerError: string | null
  /** jobs_ledger.status per job from the page's ledger list (wins over the day ledger's own snapshot). */
  statusByJob: ReadonlyMap<string, string | null | undefined>
  todayYmd: string
  colorBy: JobRunColorBy
  onColorByChange: (c: JobRunColorBy) => void
  /** Daily columns or Monday-keyed weekly bars (v2.2746). */
  granularity: TimelineGranularity
  onGranularityChange: (g: TimelineGranularity) => void
  /** The "As of" slider row is shown (v2.2807); the slider itself always opens on today. */
  asOfOn: boolean
  onAsOfOnChange: (on: boolean) => void
  canOpenSessionNotes: boolean
  users: ReadonlyArray<{ id: string; name: string | null }>
  jobs: ReadonlyArray<SessionNotesJobIdentity>
}

export type TimelineGranularity = 'daily' | 'weekly'
const GRANULARITY_OPTIONS: ReadonlyArray<{ key: TimelineGranularity; label: string; title: string }> = [
  { key: 'daily', label: 'Daily', title: 'One column per day' },
  { key: 'weekly', label: 'Weekly', title: 'One bar per week (Monday to Sunday): jobs carried over from before under jobs that started that week' },
]
const WEEK_COLOR = { carried: '#2563eb', fresh: '#0891b2' } as const

/** Saturated band colors (literal per the theme rule). */
const BAND_COLOR: Record<JobRunBand, string> = {
  working: '#2563eb',
  billed: '#d97706',
  paid: '#15803d',
  d6p: '#2563eb',
  d2_5: '#7c3aed',
  d1: '#0891b2',
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

function dayLabel(ymd: string): string {
  return formatStagesNextDateLabel(ymd)
}

export default function JobSummaryTimelineView({ ledger, ledgerLoading, ledgerError, statusByJob, todayYmd, colorBy, onColorByChange, granularity, onGranularityChange, asOfOn, onAsOfOnChange, canOpenSessionNotes, users, jobs }: Props) {
  const [definition, setDefinition] = useState<JobRunDefinition>('status')
  const [gapDays, setGapDays] = useState(7)
  const [sessionNotesDay, setSessionNotesDay] = useState<string | null>(null)
  const [barsOpen, setBarsOpen] = useState(false)
  /** Hover guide (v2.2775): the day column under the cursor, so the click target is named before the click. */
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  /** As of (v2.2807): days before today the chart is rewound to; 0 = today. */
  const [daysBack, setDaysBack] = useState(0)
  const [playing, setPlaying] = useState(false)

  const mergedStatus = useMemo(() => {
    const m = new Map<string, string | null | undefined>()
    if (ledger) for (const [id, l] of ledger.jobLabels ?? []) m.set(id, l.status)
    for (const [id, s] of statusByJob) if (s != null) m.set(id, s)
    return m
  }, [ledger, statusByJob])

  const dayYmds = useMemo(() => (ledger ? ledger.days.map((d) => d.ymd) : []), [ledger])
  const maxBack = Math.max(0, dayYmds.length - 1)
  const effBack = asOfOn ? Math.min(daysBack, maxBack) : 0
  const rewound = effBack > 0
  const asOfYmd = rewound ? asOfYmdForDaysBack(todayYmd, effBack, dayYmds[0]) : todayYmd
  useEffect(() => {
    if (!asOfOn) {
      setDaysBack(0)
      setPlaying(false)
    }
  }, [asOfOn])
  useEffect(() => {
    if (!playing) return
    if (effBack <= 0) {
      setPlaying(false)
      return
    }
    const t = window.setTimeout(() => setDaysBack((b) => Math.max(0, b - 1)), 140)
    return () => window.clearTimeout(t)
  }, [playing, effBack])

  /** Today's rows: the full picture, also the source of the ghosted future and the "since" counts. */
  const rowsToday: JobRunRow[] = useMemo(() => {
    if (!ledger) return []
    return definition === 'worked'
      ? buildWorkedSpans({ ledger, statusByJob: mergedStatus, todayYmd, gapDays })
      : buildStatusSpans({ ledger, statusSpansByJob: ledger.statusSpansByJob ?? new Map(), statusByJob: mergedStatus, todayYmd })
  }, [ledger, mergedStatus, todayYmd, definition, gapDays])
  const rows: JobRunRow[] = useMemo(() => {
    if (!ledger || !rewound) return rowsToday
    return definition === 'worked'
      ? buildWorkedSpans({ ledger, statusByJob: mergedStatus, todayYmd, gapDays, asOfYmd })
      : buildStatusSpans({ ledger, statusSpansByJob: ledger.statusSpansByJob ?? new Map(), statusByJob: mergedStatus, todayYmd, asOfYmd })
  }, [ledger, rowsToday, rewound, mergedStatus, todayYmd, definition, gapDays, asOfYmd])
  const dayYmdsAsOf = useMemo(() => (rewound ? dayYmds.filter((d) => d <= asOfYmd) : dayYmds), [dayYmds, rewound, asOfYmd])
  const series = useMemo(() => buildRunningSeriesBy(rows, dayYmdsAsOf, asOfYmd, colorBy), [rows, dayYmdsAsOf, asOfYmd, colorBy])
  const seriesToday = useMemo(() => (rewound ? buildRunningSeriesBy(rowsToday, dayYmds, todayYmd, colorBy) : null), [rewound, rowsToday, dayYmds, todayYmd, colorBy])
  const weekly = useMemo(() => bucketRunningWeekly(rows, dayYmdsAsOf, asOfYmd), [rows, dayYmdsAsOf, asOfYmd])
  const weeklyToday = useMemo(() => (rewound ? bucketRunningWeekly(rowsToday, dayYmds, todayYmd) : null), [rewound, rowsToday, dayYmds, todayYmd])
  const summary = useMemo(() => summarizeJobRuns(rows), [rows])
  const delta: JobRunDeltaSince | null = useMemo(() => (rewound ? jobRunDeltaSince(rowsToday, asOfYmd, todayYmd) : null), [rewound, rowsToday, asOfYmd, todayYmd])
  const ticks = useMemo(() => monthTicks(dayYmds), [dayYmds])
  const isWeekly = granularity === 'weekly'
  const hasMoves = useMemo(() => rows.some((r) => r.billedYmd != null || r.paidYmd != null), [rows])

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
  const L = 48
  const R = 12
  const T = 16
  const B = 30
  const n = Math.max(1, dayYmds.length)
  const iw = (W - L - R) / n
  const plotH = H - T - B
  const maxY = Math.max(4, Math.ceil((Math.max(series.peak?.total ?? 0, seriesToday?.peak?.total ?? 0) + 1) / 2) * 2)
  const yOf = (v: number) => T + plotH * (1 - v / maxY)
  const gridStep = maxY <= 8 ? 2 : maxY <= 20 ? 4 : Math.ceil(maxY / 5)
  const gridVals: number[] = []
  for (let v = 0; v <= maxY; v += gridStep) gridVals.push(v)
  const bands = series.bands
  const areaPaths = (() => {
    const base = series.days.map(() => 0)
    return bands.map((band) => {
      let up = ''
      let down = ''
      for (let i = 0; i < series.days.length; i++) {
        const x = L + i * iw
        const top = base[i]! + series.days[i]!.counts[band]
        up += `${up ? ' L' : 'M'}${x.toFixed(1)} ${yOf(top).toFixed(1)} L${(x + iw).toFixed(1)} ${yOf(top).toFixed(1)}`
      }
      for (let i = series.days.length - 1; i >= 0; i--) {
        const x = L + i * iw
        down += ` L${(x + iw).toFixed(1)} ${yOf(base[i]!).toFixed(1)} L${x.toFixed(1)} ${yOf(base[i]!).toFixed(1)}`
      }
      for (let i = 0; i < series.days.length; i++) base[i]! += series.days[i]!.counts[band]
      return { band, d: `${up}${down} Z` }
    })
  })()
  const avgPath = series.avg7.map((v, i) => `${i === 0 ? 'M' : 'L'}${(L + i * iw + iw / 2).toFixed(1)} ${yOf(v).toFixed(1)}`).join(' ')
  const todayIdx = dayYmds.indexOf(asOfYmd)
  const realTodayIdx = dayYmds.indexOf(todayYmd)
  const peakIdx = series.peak ? dayYmds.indexOf(series.peak.ymd) : -1
  /** The days after the as-of day, as today knows them: a dashed outline of the total (v2.2807). */
  const ghostPath = (() => {
    if (!seriesToday || todayIdx < 0) return ''
    let d = ''
    for (let i = todayIdx; i < seriesToday.days.length; i++) {
      const x = L + i * iw
      const y = yOf(seriesToday.days[i]!.total).toFixed(1)
      d += `${d ? ' L' : 'M'}${x.toFixed(1)} ${y} L${(x + iw).toFixed(1)} ${y}`
    }
    return d
  })()
  const splitText = (counts: Record<JobRunBand, number>) => bands.map((b) => `${counts[b]} ${JOB_RUN_BAND_LABEL[b]}`).join(' · ')

  // ---- bars geometry ----
  const BL = 150
  const rowH = 16
  const barsH = 30 + rows.length * rowH
  const biw = (W - BL - R) / n
  const dayIndex = (ymd: string) => Math.max(0, Math.min(n - 1, dayYmds.indexOf(ymd)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Segmented label="Running =" value={definition} options={JOB_RUN_DEFINITIONS} onChange={setDefinition} />
        {definition === 'worked' ? <Segmented label="Gap" value={gapDays} options={JOB_RUN_GAP_OPTIONS} onChange={setGapDays} /> : null}
        <Segmented label="Show" value={granularity} options={GRANULARITY_OPTIONS} onChange={onGranularityChange} />
        {isWeekly ? null : <Segmented label="Color by" value={colorBy} options={JOB_RUN_COLOR_BY_OPTIONS} onChange={onColorByChange} />}
        <span style={segWrap}>
          <button type="button" aria-pressed={asOfOn} title="Walk the chart back: see it as it stood on an earlier day" onClick={() => onAsOfOnChange(!asOfOn)} style={segButton(asOfOn, true)}>
            ⏮ As of
          </button>
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {definition === 'worked'
            ? 'A job runs from its first approved field day to its last; still-open jobs run to today. A pause longer than the gap splits the run.'
            : 'A job runs from its Working move to its Billed or Paid move, touched or not.'}
        </span>
      </div>
      {colorBy === 'stateOnDay' && !hasMoves && rows.length > 0 ? (
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-amber-800)' }}>No Billed or Paid moves found for these jobs, so every day reads as working. Jobs moved through the Pipeline record the moves automatically.</p>
      ) : null}

      {asOfOn ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)', padding: '0.4rem 0.7rem' }}>
          <button
            type="button"
            onClick={() => {
              if (playing) setPlaying(false)
              else {
                if (effBack === 0) setDaysBack(Math.min(56, maxBack))
                setPlaying(true)
              }
            }}
            disabled={maxBack === 0}
            title={playing ? 'Pause' : 'Walk forward a day at a time to today'}
            style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}
          >
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <span style={segLabel}>As of</span>
          <span style={{ fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', minWidth: '8.5rem' }}>{rewound ? dayLabel(asOfYmd) : `Today · ${dayLabel(todayYmd)}`}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '4.5rem' }}>{daysBackLabel(effBack)}</span>
          <input
            type="range"
            min={0}
            max={maxBack}
            value={maxBack - effBack}
            onChange={(e) => {
              setPlaying(false)
              setDaysBack(maxBack - Number(e.currentTarget.value))
            }}
            aria-label="As-of day: left is earlier, right is today"
            title="Drag, or use the arrow keys — one day per step"
            style={{ flex: '1 1 12rem', minWidth: '10rem', accentColor: '#2563eb' }}
          />
          <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
            {JOB_RUN_AS_OF_JUMPS.filter((j) => j.daysBack <= maxBack).map((j) => (
              <button
                key={j.daysBack}
                type="button"
                aria-pressed={effBack === j.daysBack}
                onClick={() => {
                  setPlaying(false)
                  setDaysBack(j.daysBack)
                }}
                style={{ fontSize: '0.72rem', padding: '0.1rem 0.55rem', borderRadius: 999, border: `1px solid ${effBack === j.daysBack ? '#2563eb' : 'var(--border)'}`, background: effBack === j.daysBack ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}
              >
                {j.label}
              </button>
            ))}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} title="Replayed from each job's Working, Billed, and Paid moves. Jobs deleted since then are gone; moves corrected later show their corrected dates.">
            replayed from status moves
          </span>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.5rem' }}>
        {isWeekly ? (
          <>
            <div style={tile}>
              <div style={tileK}>{rewound ? 'Running that week' : 'Running this week'}</div>
              <div style={tileV}>{weekly.currentTotal}</div>
              <div style={tileS}>{rewound ? `jobs touched in the week of ${dayLabel(asOfYmd)}` : 'jobs touched since Monday'}</div>
            </div>
            <div style={tile}>
              <div style={tileK}>Average per week</div>
              <div style={tileV}>{weekly.averageTotal.toFixed(1)}</div>
              <div style={tileS}>jobs touched per week, every week {rewound ? 'through the as-of day' : 'in the window'}</div>
            </div>
            <div style={tile}>
              <div style={tileK}>Peak week</div>
              <div style={tileV}>{weekly.peak ? weekly.peak.total : '—'}</div>
              <div style={tileS}>{weekly.peak ? `week of ${dayLabel(weekly.peak.weekStartYmd)}` : 'no runs in the window'}</div>
            </div>
          </>
        ) : (
          <>
            <div style={tile}>
              <div style={tileK}>{rewound ? `Running on ${dayLabel(asOfYmd)}` : 'Running today'}</div>
              <div style={tileV}>{series.todayTotal}</div>
              <div style={tileS}>{rewound ? 'jobs open that day' : 'jobs open right now'}</div>
            </div>
            <div style={tile}>
              <div style={tileK}>Average</div>
              <div style={tileV}>{series.averageTotal.toFixed(1)}</div>
              <div style={tileS}>jobs running per day, every day {rewound ? 'through the as-of day' : 'in the window'}</div>
            </div>
            <div style={tile}>
              <div style={tileK}>Peak</div>
              <div style={tileV}>{series.peak ? series.peak.total : '—'}</div>
              <div style={tileS}>{series.peak ? `on ${dayLabel(series.peak.ymd)}` : 'no runs in the window'}</div>
            </div>
          </>
        )}
        <div style={tile}>
          <div style={tileK}>Jobs in window</div>
          <div style={tileV}>{summary.jobs}</div>
          <div style={tileS}>{summary.open} still open · {summary.finished} {definition === 'worked' ? 'finished or idle' : 'finished'}</div>
        </div>
        <div style={tile}>
          <div style={tileK}>Median run</div>
          <div style={tileV}>{summary.medianRunDays == null ? '—' : `${Math.round(summary.medianRunDays)} d`}</div>
          <div style={tileS}>{definition === 'worked' ? 'first to last work' : 'Working to Billed'}{rewound ? ', as of then' : ''}</div>
        </div>
      </div>

      {isWeekly ? (
        <WeeklyChart weekly={weekly} weeklyToday={weeklyToday} dayYmds={dayYmds} todayYmd={asOfYmd} rewound={rewound} ticks={ticks} />
      ) : (
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.5rem 0.25rem' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Jobs running per day, stacked" style={{ display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
          {gridVals.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 6} y={yOf(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                {v}
              </text>
            </g>
          ))}
          <AxisTitle x={11} y={T + plotH / 2} label="jobs running that day" />
          {areaPaths.map((p) => (
            <path key={p.band} d={p.d} fill={BAND_COLOR[p.band]} opacity={0.82} />
          ))}
          <path d={avgPath} fill="none" stroke="var(--text-strong)" strokeWidth={1.5} />
          {rewound && todayIdx >= 0 && todayIdx + 1 < n ? (
            <g style={{ pointerEvents: 'none' }}>
              <rect x={L + (todayIdx + 1) * iw} y={T} width={(n - todayIdx - 1) * iw} height={plotH} fill="var(--bg-subtle)" opacity={0.65} />
              <path d={ghostPath} fill="none" stroke="var(--text-muted)" strokeWidth={1.2} strokeDasharray="3 3" />
              {realTodayIdx >= 0 ? <line x1={L + realTodayIdx * iw + iw / 2} x2={L + realTodayIdx * iw + iw / 2} y1={T} y2={T + plotH} stroke="var(--text-muted)" strokeDasharray="2 3" opacity={0.6} /> : null}
            </g>
          ) : null}
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
                {rewound ? 'as of' : 'today'} · {series.todayTotal}
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
          {hoverIdx != null && series.days[hoverIdx] ? (
            <HoverGuide
              x={L + hoverIdx * iw}
              width={Math.max(1, iw)}
              top={T}
              height={plotH}
              plotLeft={L}
              plotRight={W - R}
              label={`${dayLabel(series.days[hoverIdx]!.ymd)} · ${series.days[hoverIdx]!.total} running${canOpenSessionNotes && series.days[hoverIdx]!.total > 0 ? ' · click for notes' : ''}`}
            />
          ) : null}
          {series.days.map((d, i) => (
            <rect
              key={d.ymd}
              x={L + i * iw}
              y={T}
              width={Math.max(0.5, iw)}
              height={plotH}
              fill="transparent"
              style={{ cursor: canOpenSessionNotes && d.total > 0 ? 'pointer' : 'default' }}
              onMouseEnter={() => setHoverIdx(i)}
              onClick={() => {
                if (canOpenSessionNotes && d.total > 0) setSessionNotesDay(d.ymd)
              }}
            >
              <title>{`${dayLabel(d.ymd)} · ${d.total} running (${splitText(d.counts)}) · 7-day avg ${series.avg7[i]!.toFixed(1)}${canOpenSessionNotes && d.total > 0 ? ' · click for session notes' : ''}`}</title>
            </rect>
          ))}
        </svg>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-700)', padding: '0.35rem 0.25rem 0.2rem' }}>
          {bands.map((b) => (
            <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: BAND_COLOR[b] }} />
              {JOB_RUN_BAND_LABEL[b]}
              {colorBy === 'status' && b === 'working' ? <span style={{ color: 'var(--text-muted)' }}>(as of {rewound ? dayLabel(asOfYmd) : 'today'})</span> : null}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ display: 'inline-block', width: 14, height: 2, background: 'var(--text-strong)' }} />
            7-day average
          </span>
          {rewound ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ display: 'inline-block', width: 12, height: 8, border: '1px dashed var(--text-muted)', borderRadius: 2 }} />
              what came after
            </span>
          ) : null}
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>hover a day for its split{canOpenSessionNotes ? ' · click it for that day’s session notes' : ''}</span>
        </div>
      </div>
      )}

      {delta ? <DeltaStrip delta={delta} asOfYmd={asOfYmd} /> : null}

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
                      {colorSegmentsForRow(r, colorBy).map((s) => {
                        const a = dayIndex(s.startYmd)
                        const b = dayIndex(s.endYmd)
                        return (
                          <rect key={`${s.startYmd}-${s.band}`} x={BL + a * biw} y={y + 3} width={Math.max(1.5, (b - a + 1) * biw)} height={rowH - 6} rx={2} fill={BAND_COLOR[s.band]} opacity={s.band === 'paid' ? 0.7 : 1}>
                            <title>{`${r.label.number} ${r.label.name} · ${dayLabel(s.startYmd)} → ${dayLabel(s.endYmd)} · ${JOB_RUN_BAND_LABEL[s.band]}${r.open ? ' · still open' : ''}`}</title>
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

/** Weekly roll-up (v2.2746): one bar per Monday-keyed week — carried over under new that week. */
function WeeklyChart({ weekly, weeklyToday, dayYmds, todayYmd, rewound, ticks }: { weekly: JobRunningWeeklySeries; weeklyToday: JobRunningWeeklySeries | null; dayYmds: readonly string[]; todayYmd: string; rewound: boolean; ticks: ReadonlyArray<{ index: number; label: string }> }) {
  const W = 1000
  const H = 250
  const L = 48
  const R = 12
  const T = 16
  const B = 30
  const plotH = H - T - B
  const n = Math.max(1, dayYmds.length)
  const iw = (W - L - R) / n
  const dayIndex = (ymd: string) => Math.max(0, Math.min(n - 1, dayYmds.indexOf(ymd)))
  const maxY = Math.max(4, Math.ceil((Math.max(weekly.peak?.total ?? 0, weeklyToday?.peak?.total ?? 0) + 1) / 4) * 4)
  const yOf = (v: number) => T + plotH * (1 - v / maxY)
  const gridStep = maxY <= 12 ? 2 : maxY <= 40 ? 8 : Math.ceil(maxY / 5)
  const lastShownYmd = weekly.weeks[weekly.weeks.length - 1]?.weekEndYmd
  /** Weeks after the as-of week, as today knows them (v2.2807). */
  const ghostWeeks = weeklyToday && lastShownYmd ? weeklyToday.weeks.filter((w) => w.weekStartYmd > lastShownYmd) : []
  const gridVals: number[] = []
  for (let v = 0; v <= maxY; v += gridStep) gridVals.push(v)
  const thisWeekStart = weekly.weeks.find((w) => todayYmd >= w.weekStartYmd && todayYmd <= w.weekEndYmd)?.weekStartYmd
  const [hoverWeek, setHoverWeek] = useState<number | null>(null)
  const hw = hoverWeek != null ? weekly.weeks[hoverWeek] : undefined
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.5rem 0.25rem' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Jobs touched per week, carried over under new that week" style={{ display: 'block' }} onMouseLeave={() => setHoverWeek(null)}>
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={L - 6} y={yOf(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
              {v}
            </text>
          </g>
        ))}
        <AxisTitle x={11} y={T + plotH / 2} label="jobs touched that week" />
        {hw ? (
          <HoverGuide
            x={L + dayIndex(hw.weekStartYmd) * iw}
            width={Math.max(2, (dayIndex(hw.weekEndYmd) - dayIndex(hw.weekStartYmd) + 1) * iw)}
            top={T}
            height={plotH}
            plotLeft={L}
            plotRight={W - R}
            label={`week of ${dayLabel(hw.weekStartYmd)} · ${hw.total} jobs · ${hw.carried} carried · ${hw.fresh} new`}
          />
        ) : null}
        {ghostWeeks.length > 0 ? (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={L + dayIndex(ghostWeeks[0]!.weekStartYmd) * iw} y={T} width={(n - dayIndex(ghostWeeks[0]!.weekStartYmd)) * iw} height={plotH} fill="var(--bg-subtle)" opacity={0.65} />
            {ghostWeeks.map((w) => {
              const a = dayIndex(w.weekStartYmd)
              const b = dayIndex(w.weekEndYmd)
              return w.total > 0 ? <rect key={w.weekStartYmd} x={L + a * iw + 1} y={yOf(w.total)} width={Math.max(2, (b - a + 1) * iw - 2)} height={yOf(0) - yOf(w.total)} fill="none" stroke="var(--text-muted)" strokeDasharray="3 3" rx={1.5} /> : null
            })}
          </g>
        ) : null}
        {weekly.weeks.map((w, wi) => {
          const a = dayIndex(w.weekStartYmd)
          const b = dayIndex(w.weekEndYmd)
          const x = L + a * iw + 1
          const width = Math.max(2, (b - a + 1) * iw - 2)
          const carriedTop = yOf(w.carried)
          const totalTop = yOf(w.total)
          const isThis = w.weekStartYmd === thisWeekStart
          return (
            <g key={w.weekStartYmd} onMouseEnter={() => setHoverWeek(wi)}>
              {w.carried > 0 ? <rect x={x} y={carriedTop} width={width} height={yOf(0) - carriedTop} fill={WEEK_COLOR.carried} opacity={0.85} rx={1.5} /> : null}
              {w.fresh > 0 ? <rect x={x} y={totalTop} width={width} height={carriedTop - totalTop} fill={WEEK_COLOR.fresh} opacity={0.85} rx={1.5} /> : null}
              {isThis ? <rect x={x} y={T} width={width} height={plotH} fill="none" stroke="var(--text-red-700)" strokeDasharray="3 3" /> : null}
              {w.total > 0 ? (
                <text x={x + width / 2} y={totalTop - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--text-700)">
                  {w.total}
                </text>
              ) : null}
              <rect x={x} y={T} width={width} height={plotH} fill="transparent">
                <title>{`week of ${dayLabel(w.weekStartYmd)} → ${dayLabel(w.weekEndYmd)} · ${w.total} jobs touched (${w.carried} carried over · ${w.fresh} new this week)`}</title>
              </rect>
            </g>
          )
        })}
        {ticks.map((t) => (
          <g key={t.index}>
            <line x1={L + t.index * iw} x2={L + t.index * iw} y1={T + plotH} y2={T + plotH + 5} stroke="var(--border-strong)" />
            <text x={L + t.index * iw + 3} y={T + plotH + 16} fontSize={10} fill="var(--text-muted)">
              {t.label}
            </text>
          </g>
        ))}
        {weekly.peak ? (
          <text x={L + dayIndex(weekly.peak.weekStartYmd) * iw + 2} y={T - 4} fontSize={10} fontWeight={700} fill="var(--text-strong)">
            peak {weekly.peak.total} · week of {dayLabel(weekly.peak.weekStartYmd).replace(/^\w+ /, '')}
          </text>
        ) : null}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-700)', padding: '0.35rem 0.25rem 0.2rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: WEEK_COLOR.carried }} />
          carried over from before the week
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: WEEK_COLOR.fresh }} />
          started that week
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <i style={{ display: 'inline-block', width: 12, height: 8, border: '1px dashed var(--text-red-700)', borderRadius: 2 }} />
          {rewound ? 'as-of week' : 'this week'}
        </span>
        {rewound ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ display: 'inline-block', width: 12, height: 8, border: '1px dashed var(--text-muted)', borderRadius: 2 }} />
            what came after
          </span>
        ) : null}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>hover a week for its split · a job counts once per week it was running</span>
      </div>
    </div>
  )
}

/**
 * Hover guide (v2.2775): a soft band over the hovered column with thin edge
 * lines and a label pill naming the date and count, so the reader sees what
 * they're about to click. Pointer-events off — the transparent hit rects
 * beneath keep the hover and the click.
 */
function HoverGuide({ x, width, top, height, plotLeft, plotRight, label }: { x: number; width: number; top: number; height: number; plotLeft: number; plotRight: number; label: string }) {
  const pillW = Math.min(plotRight - plotLeft, label.length * 5.6 + 14)
  const center = x + width / 2
  const pillX = Math.max(plotLeft, Math.min(plotRight - pillW, center - pillW / 2))
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={x} y={top} width={width} height={height} fill="var(--text-strong)" opacity={0.08} />
      <line x1={x} x2={x} y1={top} y2={top + height} stroke="var(--text-muted)" strokeWidth={1} opacity={0.55} />
      <line x1={x + width} x2={x + width} y1={top} y2={top + height} stroke="var(--text-muted)" strokeWidth={1} opacity={0.55} />
      <rect x={pillX} y={top + 4} width={pillW} height={18} rx={9} fill="var(--surface)" stroke="var(--border-strong)" />
      <text x={pillX + pillW / 2} y={top + 16.5} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--text)">
        {label}
      </text>
    </g>
  )
}

/** Rotated y-axis title in the left gutter (v2.2791) — says what the numbers count. */
function AxisTitle({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <text transform={`rotate(-90 ${x} ${y})`} x={x} y={y} textAnchor="middle" fontSize={10} fill="var(--text-muted)" style={{ pointerEvents: 'none' }}>
      {label}
    </text>
  )
}

/** What changed between the as-of day and today (v2.2807), in the chart's own colors. */
function DeltaStrip({ delta, asOfYmd }: { delta: JobRunDeltaSince; asOfYmd: string }) {
  const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)', borderRadius: 999, padding: '0.1rem 0.6rem', background: 'var(--surface)', fontVariantNumeric: 'tabular-nums' }
  const swatch = (color: string): CSSProperties => ({ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color })
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-700)' }}>
      <span>Since {dayLabel(asOfYmd)}:</span>
      <span style={pill}>
        <i style={swatch(BAND_COLOR.working)} />
        <b>{delta.opened}</b> {delta.opened === 1 ? 'job' : 'jobs'} opened
      </span>
      <span style={pill}>
        <i style={swatch(BAND_COLOR.billed)} />
        <b>{delta.billed}</b> billed
      </span>
      <span style={pill}>
        <i style={swatch(BAND_COLOR.paid)} />
        <b>{delta.paid}</b> paid
      </span>
      <span style={pill}>
        <b>{delta.stillOpen}</b> open then and still open
      </span>
    </div>
  )
}
