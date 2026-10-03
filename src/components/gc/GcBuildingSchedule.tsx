import { useMemo, type CSSProperties, type ReactNode } from 'react'
import {
  addDays,
  daysBetween,
  LOOKAHEAD_WEEKS,
  MILESTONE_GRACE_DAYS,
  RELIABILITY_WEEKS,
  scheduleMeasures,
  shortDate,
  type LookAheadState,
  type MilestoneRow,
  type ScheduleRow,
} from '../../lib/gcMode/gcModel'
import type { GcPaneProps } from './GcOfficeTabs'
import { Card, Chip, Why, type Tone } from './gcUi'

/**
 * GC mode design spike: the schedule (Building lane, owner's shape 2026-10-02). Each activity is a
 * line of a trade's statement of work, or a stage our own crew runs. Four measures on top, the
 * chart (the plan, the baseline under it, percent done, today, milestones), then the look-ahead.
 */

const DAY_PX = 6
const LABEL_W = 260

export function GcBuildingScheduleTab({ state, project }: GcPaneProps) {
  const m = useMemo(() => scheduleMeasures(state, project), [state, project])
  const schedule = project.schedule

  if (!schedule || m.rows.length === 0) {
    return (
      <div style={{ display: 'grid', gap: '0.9rem' }}>
        <ScheduleWhy />
        <Card>
          No schedule is drawn for this project yet. It is drawn while buying
          out, and Start locks it as the baseline.
        </Card>
      </div>
    )
  }

  const behind = m.work.daysBehind
  const nextMilestone = m.milestones.find((r) => r.state === 'due')
  const lateOnes = m.milestones.filter(
    (r) => r.state === 'late' || r.state === 'missed',
  )
  const rel = m.reliability

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <ScheduleWhy />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
          gap: '0.75rem',
        }}
      >
        <Measure
          label="Work done against the plan"
          value={`${Math.round(m.work.donePct)}% done`}
          tone={behind > 7 ? 'red' : behind > 0 ? 'amber' : 'green'}
          chip={
            behind > 0
              ? `${behind} ${behind === 1 ? 'day' : 'days'} behind`
              : behind < 0
                ? `${-behind} days ahead`
                : 'on plan'
          }
        >
          {Math.round(m.work.plannedPct)}% was planned by today, weighted by
          what each line is worth.
        </Measure>
        <Measure
          label="Critical path"
          value={`${m.critical.length} ${m.critical.length === 1 ? 'activity' : 'activities'}`}
          tone={m.critical.length > 0 ? 'amber' : 'green'}
          chip="no spare days"
        >
          {m.critical.length > 0
            ? m.critical.map((r) => `${r.trade} · ${r.label}`).join(', ')
            : 'Every open activity has spare days.'}
        </Measure>
        <Measure
          label="Milestones hit"
          value={
            m.hitRate.of > 0
              ? `${m.hitRate.hit} of ${m.hitRate.of}`
              : 'none yet'
          }
          tone={lateOnes.length > 0 ? 'red' : 'green'}
          chip={`within ${MILESTONE_GRACE_DAYS} days`}
        >
          {lateOnes
            .map((r) => `${r.milestone.label} is ${r.daysLate} days late.`)
            .join(' ')}{' '}
          {nextMilestone
            ? `Next: ${nextMilestone.milestone.label} ${shortDate(nextMilestone.milestone.planned)}.`
            : ''}
        </Measure>
        <Measure
          label="Look-ahead done as planned"
          value={
            rel.of > 0
              ? `${Math.round((rel.done / rel.of) * 100)}%`
              : 'none yet'
          }
          tone={rel.of > 0 && rel.done / rel.of < 0.8 ? 'amber' : 'green'}
          chip={`last ${RELIABILITY_WEEKS} weeks`}
        >
          {rel.done} of {rel.of} verified marks were done.{' '}
          {rel.waiting > 0
            ? `${rel.waiting} ${rel.waiting === 1 ? 'mark waits' : 'marks wait'} on our superintendent.`
            : ''}
        </Measure>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ScheduleChart
          rows={m.rows}
          float={m.float}
          milestones={m.milestones}
          today={state.today}
        />
      </Card>

      <LookAhead weeks={m.lookAhead} />
    </div>
  )
}

function ScheduleWhy() {
  return (
    <Why>
      Each activity is a line of a trade's statement of work, or a stage our own
      crew runs. We draw the dates and what each waits on while buying out.
      Start locks it as the baseline, the plan we measure against. Spare days
      are how long an activity can slip before the job finishes later. No spare
      days is the critical path.
    </Why>
  )
}

function Measure({
  label,
  value,
  tone,
  chip,
  children,
}: {
  label: string
  value: string
  tone: Tone
  chip: string
  children: ReactNode
}) {
  return (
    <Card>
      <div
        style={{
          fontSize: '0.7rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          marginTop: '0.15rem',
        }}
      >
        <span
          style={{
            fontSize: '1.3rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <Chip tone={tone}>{chip}</Chip>
      </div>
      <div
        style={{
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          marginTop: '0.3rem',
        }}
      >
        {children}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------------------------

const MS_COLORS: Record<MilestoneRow['state'], string> = {
  hit: '#16a34a',
  missed: '#dc2626',
  late: '#dc2626',
  due: 'var(--text-muted)',
}

function ScheduleChart({
  rows,
  float,
  milestones,
  today,
}: {
  rows: ScheduleRow[]
  float: Map<string, number>
  milestones: MilestoneRow[]
  today: string
}) {
  const dates = rows
    .flatMap((r) => [
      r.activity.start,
      r.activity.finish,
      r.baseline.start,
      r.baseline.finish,
    ])
    .concat(milestones.map((x) => x.milestone.planned))
  const first = addDays(
    dates.reduce((a, b) => (a < b ? a : b)),
    -3,
  )
  const last = addDays(
    dates.reduce((a, b) => (a > b ? a : b)),
    7,
  )
  const days = daysBetween(first, last) + 1
  const x = (iso: string) => daysBetween(first, iso) * DAY_PX
  const width = days * DAY_PX
  const months: { label: string; at: number }[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) {
    // A month's name, unless it would sit under the "today" mark.
    if ((d.endsWith('-01') || d === first) && Math.abs(x(d) - x(today)) > 44)
      months.push({ label: shortDate(d).split(' ')[0] ?? d, at: x(d) })
  }
  const trades = [...new Set(rows.map((r) => r.pkg.id))]
  const rowStyle: CSSProperties = {
    display: 'flex',
    borderTop: '1px solid var(--border)',
    minHeight: 30,
  }
  const labelStyle: CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 1,
    width: LABEL_W,
    minWidth: LABEL_W,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    padding: '0.3rem 0.6rem',
    fontSize: '0.8rem',
    boxSizing: 'border-box',
  }
  const todayLine = (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: x(today),
        width: 2,
        background: '#2563eb',
        opacity: 0.55,
      }}
    />
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ width: LABEL_W + width, minWidth: '100%' }}>
        {/* Months and today */}
        <div
          style={{
            ...rowStyle,
            borderTop: 'none',
            background: 'var(--bg-subtle)',
          }}
        >
          <div
            style={{
              ...labelStyle,
              background: 'var(--bg-subtle)',
              fontWeight: 600,
            }}
          >
            Activity
          </div>
          <div
            style={{
              position: 'relative',
              width,
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
            }}
          >
            {months.map((mo) => (
              <span
                key={mo.at}
                style={{
                  position: 'absolute',
                  left: mo.at + 3,
                  top: 8,
                  borderLeft: '1px solid var(--border-strong)',
                  paddingLeft: 3,
                }}
              >
                {mo.label}
              </span>
            ))}
            <span
              style={{
                position: 'absolute',
                left: x(today) - 16,
                top: 8,
                color: 'var(--text-link)',
                fontWeight: 700,
              }}
            >
              today
            </span>
          </div>
        </div>
        {/* Milestones */}
        <div style={rowStyle}>
          <div style={{ ...labelStyle, fontWeight: 600 }}>Milestones</div>
          <div style={{ position: 'relative', width, height: 42 }}>
            {todayLine}
            {[...milestones]
              .sort((p, q) =>
                p.milestone.planned < q.milestone.planned ? -1 : 1,
              )
              .map((r, i) => (
                <span
                  key={r.milestone.id}
                  title={`${r.milestone.label}: planned ${shortDate(r.milestone.planned)}${r.milestone.metOn ? `, met ${shortDate(r.milestone.metOn)}` : ''}`}
                  // Every other one a line lower, so labels near each other do not run together.
                  style={{
                    position: 'absolute',
                    left: x(r.milestone.planned) - 6,
                    top: i % 2 === 0 ? 4 : 22,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 11,
                      height: 11,
                      transform: 'rotate(45deg)',
                      background: MS_COLORS[r.state],
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color:
                        r.state === 'late' || r.state === 'missed'
                          ? 'var(--text-red-700)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {r.milestone.label}
                    {r.state === 'late' || r.state === 'missed'
                      ? `, ${r.daysLate} days late`
                      : ''}
                  </span>
                </span>
              ))}
          </div>
        </div>
        {trades.map((pkgId) => {
          const list = rows.filter((r) => r.pkg.id === pkgId)
          const head = list[0]
          if (!head) return null
          return (
            <div key={pkgId}>
              <div
                style={{
                  ...rowStyle,
                  background: 'var(--bg-subtle)',
                  minHeight: 24,
                }}
              >
                <div
                  style={{
                    ...labelStyle,
                    background: 'var(--bg-subtle)',
                    fontWeight: 700,
                  }}
                >
                  {head.trade}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                    · {head.company}
                  </span>
                </div>
                <div style={{ position: 'relative', width }}>{todayLine}</div>
              </div>
              {list.map((r) => (
                <ChartRow
                  key={r.activity.lineId}
                  row={r}
                  spare={float.get(r.activity.lineId) ?? 0}
                  x={x}
                  width={width}
                  rowStyle={rowStyle}
                  labelStyle={labelStyle}
                  todayLine={todayLine}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChartRow({
  row,
  spare,
  x,
  width,
  rowStyle,
  labelStyle,
  todayLine,
}: {
  row: ScheduleRow
  spare: number
  x: (iso: string) => number
  width: number
  rowStyle: CSSProperties
  labelStyle: CSSProperties
  todayLine: ReactNode
}) {
  const a = row.activity
  const done = row.actual >= 100
  const critical = spare === 0 && !done
  const behind = !done && row.actual + 0.5 < row.plannedToday
  const planLeft = x(a.start)
  const planW = (daysBetween(a.start, a.finish) + 1) * DAY_PX
  const baseLeft = x(row.baseline.start)
  const baseW =
    (daysBetween(row.baseline.start, row.baseline.finish) + 1) * DAY_PX
  const moved =
    row.baseline.start !== a.start || row.baseline.finish !== a.finish
  return (
    <div style={rowStyle}>
      <div style={labelStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '0.4rem',
          }}
        >
          <span>{row.label}</span>
          <span
            style={{
              fontVariantNumeric: 'tabular-nums',
              color: behind ? 'var(--text-amber-800)' : 'var(--text-muted)',
            }}
          >
            {Math.round(row.actual)}%
            {done ? '' : ` · plan ${Math.round(row.plannedToday)}%`}
          </span>
        </div>
        {!done && (
          <div
            style={{
              fontSize: '0.7rem',
              color: critical ? 'var(--text-red-700)' : 'var(--text-muted)',
            }}
          >
            {critical
              ? 'critical · no spare days'
              : `${spare} spare ${spare === 1 ? 'day' : 'days'}`}
            {row.slipDays > 0
              ? ` · ${row.slipDays} days later than planned at Start`
              : ''}
          </div>
        )}
      </div>
      <div style={{ position: 'relative', width }}>
        {todayLine}
        {moved && (
          <span
            title={`Planned at Start: ${shortDate(row.baseline.start)} to ${shortDate(row.baseline.finish)}`}
            style={{
              position: 'absolute',
              left: baseLeft,
              width: baseW,
              bottom: 4,
              height: 4,
              borderRadius: 2,
              background: 'var(--border-strong)',
            }}
          />
        )}
        <span
          title={`${shortDate(a.start)} to ${shortDate(a.finish)} · ${Math.round(row.actual)}% done`}
          style={{
            position: 'absolute',
            left: planLeft,
            width: planW,
            top: 7,
            height: 14,
            borderRadius: 4,
            background: done ? 'var(--bg-green-200)' : 'var(--bg-blue-200)',
            border: `1.5px solid ${critical ? '#dc2626' : done ? '#16a34a' : '#3b82f6'}`,
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              height: '100%',
              width: `${Math.min(100, row.actual)}%`,
              background: done ? '#22c55e' : '#3b82f6',
              opacity: 0.75,
            }}
          />
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// The look-ahead
// ---------------------------------------------------------------------------------------------

const MARK_WORDS: Record<LookAheadState, { tone: Tone; word: string }> = {
  done: { tone: 'green', word: 'done' },
  not: { tone: 'red', word: 'not done' },
  waiting: { tone: 'amber', word: 'waiting on our superintendent' },
  unmarked: { tone: 'grey', word: 'not marked yet' },
}

function LookAhead({
  weeks,
}: {
  weeks: ReturnType<typeof scheduleMeasures>['lookAhead']
}) {
  return (
    <Card>
      <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>
        The look-ahead · the next {LOOKAHEAD_WEEKS} weeks
      </div>
      <div
        style={{
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          marginBottom: '0.6rem',
        }}
      >
        Each week the trade marks each activity done or not in its portal. Our
        superintendent verifies the mark. Only a verified mark counts.
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
          gap: '0.75rem',
        }}
      >
        {weeks.map((w, i) => (
          <div
            key={w.weekOf}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.55rem 0.65rem',
              display: 'grid',
              gap: '0.35rem',
              alignContent: 'start',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              {i === 0 ? 'This week' : i === 1 ? 'Next week' : 'In two weeks'} ·{' '}
              {shortDate(w.weekOf)}
            </div>
            {w.items.length === 0 && (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Nothing planned.
              </span>
            )}
            {w.items.map(({ row, mark, state }) => (
              <div
                key={row.activity.lineId}
                style={{ fontSize: '0.82rem', display: 'grid', gap: '0.1rem' }}
              >
                <span>
                  {row.trade} · {row.label}{' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    · {row.company}
                  </span>
                </span>
                {i === 0 && (
                  <span
                    style={{
                      display: 'flex',
                      gap: '0.35rem',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Chip tone={MARK_WORDS[state].tone}>
                      {MARK_WORDS[state].word}
                    </Chip>
                    {mark && state === 'waiting' && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        they say{' '}
                        {mark.done
                          ? 'done'
                          : `not done${mark.reason ? `, ${mark.reason}` : ''}`}
                      </span>
                    )}
                    {mark && state === 'not' && mark.reason && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        {mark.reason}
                      </span>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}
