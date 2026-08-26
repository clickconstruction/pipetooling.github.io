import { RoadmapParallelBadge } from './RoadmapParallelBadge'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { approxDateLabel, paceProjection, taskSlotRectsWeighted, timelineRows, type TimelineRow } from '../../lib/roadmapTimeline'
import { averageEstimatedDays, effortDaysLabel, effortSumLabel, observedEffortPace, taskWeightDays } from '../../lib/roadmapEffort'
import { bandFraction, calendarBand, monthLabelStride, paceLabel } from '../../lib/roadmapCalendar'
import { stageNumbersByGroupId, taskNumbersByTaskId } from '../../lib/roadmapStageNumbers'
import { RoadmapStageNumberBadge, RoadmapTaskNumber } from './RoadmapStageNumberBadge'
import type { PlanTask } from '../../lib/roadmapPlanView'
import type { TechTreeEdge } from '../../lib/checklistTechTreeGraph'

type Props = {
  groups: Array<{ id: string; title: string }>
  /** Stages running ⇊ parallel (sequential = false); compact badge on the rail row. */
  parallelGroupIds?: ReadonlySet<string>
  tasks: PlanTask[]
  edges: TechTreeEdge[]
  unlockedIds: ReadonlySet<string>
  completeIds: ReadonlySet<string>
  users: Array<{ id: string; name: string; email: string }>
  /** Opens the task card modal. */
  onOpenTask: (taskId: string) => void
}

const FRONT = '#f59e0b'
const DONE = '#16a34a'

function waveName(index: number, count: number): string {
  if (index === 0) return 'Now'
  if (index === count - 1 && count > 2) return 'Goal'
  if (index === 1) return 'Next'
  if (index === 2) return 'Then'
  return 'Later'
}

/**
 * The roadmap Timeline view (v2.1979; per-task slots v2.2042): a Gantt whose
 * x-axis is dependency sequence. Rows staircase by (wave, stage order); each
 * stage bar is one successive slot per task (done green in true position,
 * next up amber-ringed); expanding a stage unfolds a waterfall — one lane
 * per task with its slot bar. Task-less stages render as ◆ milestones; the amber FRONT line marks
 * live progress through the current wave. A calendar band up top (v2.2089)
 * lays real months out with a today tick and a 🎯 flag where the remaining
 * work lands at the OBSERVED pace (completions in the last 4 weeks; all-time
 * fallback) — no stored dates, nothing to configure. A what-if dial
 * (v2.2090) drives a dashed ghost flag beside the solid one: ephemeral,
 * anchored by a "▲ you" tick at the observed pace, never mistaken for truth.
 * Tapping a row unfolds its N.M tasks; tapping a task opens the task card.
 */
export function ChecklistRoadmapTimelineView({ groups, tasks, edges, unlockedIds, completeIds, users, onOpenTask, parallelGroupIds }: Props) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  // What-if dial (v2.2090): ephemeral, never persisted — the solid flag stays the
  // observed truth; this only drives the dashed ghost. null until touched.
  const [whatIf, setWhatIf] = useState<number | null>(null)
  // Calendar band width (v2.2136): month labels thin to every Nth month on
  // narrow screens instead of overprinting each other ("AUG SEP OC NOVDEC…").
  const bandRef = useRef<HTMLDivElement | null>(null)
  const [bandPx, setBandPx] = useState(0)
  useEffect(() => {
    const el = bandRef.current
    if (!el) return
    const measure = () => setBandPx(el.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const tasksByGroup = useMemo(() => {
    const m = new Map<string, PlanTask[]>()
    for (const t of tasks) m.set(t.group_id, [...(m.get(t.group_id) ?? []), t])
    return m
  }, [tasks])

  const stageNumbers = useMemo(() => stageNumbersByGroupId(groups), [groups])
  const taskNumbers = useMemo(() => taskNumbersByTaskId(stageNumbers, tasksByGroup), [stageNumbers, tasksByGroup])
  const nameById = useMemo(() => new Map(users.map((u) => [u.id, u.name || u.email])), [users])

  // Effort weighting (v2.2358): estimated_days is a task's WEIGHT — never its
  // dates. avg fills unestimated tasks; with no estimates anywhere every
  // weight is 1 and all math below reduces to the old tasks/week behavior.
  const avg = useMemo(() => averageEstimatedDays(tasks), [tasks])
  const hasEstimates = useMemo(() => tasks.some((t) => t.estimated_days != null), [tasks])
  const rows = useMemo(
    () => timelineRows({ groups, tasksByGroup, edges, unlockedIds, completeIds, avgDays: avg }),
    [groups, tasksByGroup, edges, unlockedIds, completeIds, avg],
  )
  const now = useMemo(() => new Date(), [])
  // Observed pace (last 4 weeks; all-time fallback; null before any completion)
  // — the projection's only input. There is no dial: dates come from the real rate.
  const pace = useMemo(() => observedEffortPace(tasks, now), [tasks, now])
  const projection = useMemo(() => paceProjection(rows, pace?.daysPerWeek ?? 1, now), [rows, pace, now])
  const whatIfProjection = useMemo(() => (whatIf == null ? null : paceProjection(rows, whatIf, now)), [rows, whatIf, now])
  // Band months follow the real pace; with no real pace yet, the what-if dial alone stretches them.
  const band = useMemo(
    () => calendarBand(pace ? projection : (whatIfProjection ?? []), now),
    [pace, projection, whatIfProjection, now],
  )
  const remainingTotal = useMemo(() => rows.reduce((a, r) => a + r.remainingTasks, 0), [rows])
  const remainingDaysTotal = useMemo(() => rows.reduce((a, r) => a + r.remainingDays, 0), [rows])
  /** Dashed ghost flag for the what-if pace (only next to a real solid flag). */
  const ghost = useMemo(() => {
    if (!pace || whatIfProjection == null || whatIfProjection.length === 0) return null
    const finish = whatIfProjection[whatIfProjection.length - 1]!.finish
    return { left: Math.min(bandFraction(band, finish), 0.985), label: approxDateLabel(finish, now) }
  }, [pace, whatIfProjection, band, now])
  const ghostOnly = !pace && whatIfProjection != null
  const whatIfDefault = pace ? Math.min(Math.max(Math.round(pace.daysPerWeek), 1), 20) : 5
  // Unit label: estimates make the pace days-of-work; without any, days == tasks.
  const paceUnit = hasEstimates ? 'days/week' : 'tasks/week'

  // wave geometry: width share ∝ remaining tasks, with a floor so empty/done
  // waves stay visible; all fractions of the lane width
  const geometry = useMemo(() => {
    const waves = projection.map((p) => p.wave)
    const raw = projection.map((p) => Math.max(p.remainingDays, 1))
    const total = raw.reduce((a, b) => a + b, 0) || 1
    const minShare = 0.1
    let shares = raw.map((r) => Math.max(r / total, minShare))
    const sum = shares.reduce((a, b) => a + b, 0)
    shares = shares.map((s) => s / sum)
    const starts = new Map<number, number>()
    const widths = new Map<number, number>()
    let x = 0
    waves.forEach((w, i) => {
      starts.set(w, x)
      widths.set(w, shares[i]!)
      x += shares[i]!
    })
    // largest remaining stage per wave (bar width scale)
    const maxStage = new Map<number, number>()
    for (const r of rows) {
      maxStage.set(r.wave, Math.max(maxStage.get(r.wave) ?? 1, r.remainingDays))
    }
    return { starts, widths, maxStage }
  }, [projection, rows])

  const frontX = useMemo(() => {
    const current = projection.find((p) => p.remainingTasks > 0)
    if (!current) return 1
    const start = geometry.starts.get(current.wave) ?? 0
    const width = geometry.widths.get(current.wave) ?? 0
    const doneFrac = current.totalTasks === 0 ? 0 : (current.totalTasks - current.remainingTasks) / current.totalTasks
    return start + width * doneFrac
  }, [projection, geometry])

  const pct = (f: number) => `${(f * 100).toFixed(2)}%`
  const labelStride = monthLabelStride(bandPx, band.months[0]?.width ?? 1)
  /** Pace that would land the goal inside the visible horizon (clamped goals only). */
  const neededPaceLabel =
    band.goal?.clamped && remainingTotal > 0
      ? paceLabel(remainingDaysTotal / Math.max((band.horizonEnd.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000), 1))
      : null
  const horizonLabel = band.months[band.months.length - 1]?.label ?? ''

  const laneVlines = (
    <>
      {projection.slice(1).map((p) => (
        <span
          key={p.wave}
          style={{ position: 'absolute', top: 0, bottom: 0, left: pct(geometry.starts.get(p.wave) ?? 0), borderLeft: '1px dashed var(--border)' }}
        />
      ))}
    </>
  )

  const rectFor = (r: TimelineRow) => {
    const waveStart = geometry.starts.get(r.wave) ?? 0
    const waveWidth = geometry.widths.get(r.wave) ?? 0.1
    const maxStage = geometry.maxStage.get(r.wave) ?? 1
    const share = r.done ? 0.14 : Math.max(r.remainingDays / maxStage, 0.2)
    const width = Math.max(waveWidth * share - 0.008, 0.05)
    return { left: waveStart + 0.004, width }
  }

  /** First not-done task in stage order — the amber "next up" slot. */
  const nextUpIndexFor = (r: TimelineRow, stageTasks: PlanTask[]) =>
    r.locked || r.done ? -1 : stageTasks.findIndex((t) => !t.completed_at)

  const slotStyle = (r: TimelineRow, done: boolean, isNextUp: boolean) => ({
    borderRadius: 4,
    border: done ? `1px solid ${DONE}` : r.locked ? '1px dashed var(--border-strong)' : '1px solid var(--text-link)',
    background: done ? 'var(--bg-green-100)' : r.locked ? 'var(--bg-muted)' : 'var(--surface)',
    ...(isNextUp ? { outline: `1.5px solid ${FRONT}`, outlineOffset: 1 } : {}),
  })

  const barFor = (r: TimelineRow, stageTasks: PlanTask[]) => {
    const waveStart = geometry.starts.get(r.wave) ?? 0
    if (r.isMilestone) {
      // Hollow ◇ + muted label for a task-less stage with nothing before it —
      // "not planned yet" (v2.2127); it used to read ✓ reached.
      const color = r.done ? DONE : r.unplanned ? 'var(--text-muted)' : 'var(--text-violet-700)'
      return (
        <>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: '50%',
              left: pct(waveStart),
              transform: 'translate(-50%, -50%) rotate(45deg)',
              width: 12,
              height: 12,
              borderRadius: 2,
              boxSizing: 'border-box',
              background: r.unplanned ? 'var(--surface)' : color,
              border: r.unplanned ? '1.5px dashed var(--border-strong)' : undefined,
            }}
          />
          <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: `calc(${pct(waveStart)} + 12px)`, fontSize: '0.68rem', fontWeight: r.unplanned ? 600 : 700, color, whiteSpace: 'nowrap' }}>
            {r.done ? '✓ reached' : r.unplanned ? 'not planned yet' : 'milestone'}
          </span>
        </>
      )
    }
    const rect = rectFor(r)
    if (r.done) {
      return (
        <div
          style={{
            position: 'absolute',
            top: 5,
            bottom: 5,
            left: pct(rect.left),
            width: pct(rect.width),
            borderRadius: 6,
            border: `1px solid ${DONE}`,
            background: 'var(--bg-green-100)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 7px',
            fontSize: '0.66rem',
            color: DONE,
            fontWeight: 700,
          }}
        >
          ✓
        </div>
      )
    }
    // Segmented (v2.2042): one successive slot per task, in task order — done
    // green in true position, the next task amber-ringed, the rest outlined.
    const slots = taskSlotRectsWeighted(rect.left, rect.width, stageTasks.map((t) => taskWeightDays(t, avg)))
    const nextUp = nextUpIndexFor(r, stageTasks)
    return (
      <>
        {stageTasks.map((t, i) => {
          const slot = slots[i]
          if (!slot) return null
          const done = t.completed_at != null
          const state = done ? 'done' : i === nextUp ? 'next up' : r.locked ? 'locked' : 'remaining'
          const est = t.estimated_days != null ? `${effortDaysLabel(t.estimated_days)} est` : `≈${effortDaysLabel(avg)} avg`
          return (
            <span
              key={t.id}
              title={`${taskNumbers.get(t.id) ?? ''} ${t.title} — ${state} — ${est}`}
              style={{
                position: 'absolute',
                top: 6,
                bottom: 6,
                left: pct(slot.left),
                width: pct(slot.width),
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                ...slotStyle(r, done, i === nextUp),
              }}
            >
              {slot.width >= 0.035 && taskNumbers.has(t.id) ? (
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: done ? DONE : 'var(--text-muted)', pointerEvents: 'none' }}>
                  {taskNumbers.get(t.id)}
                </span>
              ) : null}
            </span>
          )
        })}
      </>
    )
  }

  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
      {/* calendar band: real months, today tick, runway, wave dots, 🎯 goal flag */}
      <div style={{ padding: '0.65rem 0.8rem 0.55rem', borderBottom: '1px solid var(--border)' }}>
        <div
          ref={bandRef}
          aria-label={band.goal ? `Calendar: projected finish ${band.goal.label}` : 'Calendar'}
          style={{ position: 'relative', height: 46, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}
        >
          {band.months.map((m, i) => (
            <span
              key={m.label}
              title={m.label}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: pct(m.left),
                width: pct(m.width),
                borderLeft: i === 0 ? 'none' : '1px solid var(--border)',
                background: i % 2 === 1 ? 'var(--bg-slate-tint)' : undefined,
              }}
            >
              {i % labelStride === 0 ? (
                <span style={{ position: 'absolute', top: 4, left: 6, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {m.label}
                </span>
              ) : null}
            </span>
          ))}
          {band.runway ? (
            <span
              style={{ position: 'absolute', top: 26, height: 10, left: pct(band.runway.left), width: pct(band.runway.width), borderRadius: 5, background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', boxSizing: 'border-box' }}
            />
          ) : null}
          {band.markers.map((mk) => (
            <span key={mk.index} style={{ position: 'absolute', top: 29, left: pct(mk.left), width: 5, height: 5, borderRadius: '50%', background: 'var(--text-link)', transform: 'translateX(-2px)' }}>
              <span style={{ position: 'absolute', top: -15, left: -4, fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {waveName(mk.index, projection.length)}
              </span>
            </span>
          ))}
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: pct(band.todayLeft), borderLeft: `2px solid ${FRONT}` }}>
            <span style={{ position: 'absolute', top: 15, left: 4, fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: FRONT, whiteSpace: 'nowrap' }}>
              today
            </span>
          </span>
          {ghost ? (
            <span style={{ position: 'absolute', top: 0, bottom: 0, left: pct(ghost.left), borderLeft: '2px dashed var(--text-link)' }}>
              <span
                style={{
                  position: 'absolute',
                  bottom: 2,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  color: 'var(--text-link)',
                  whiteSpace: 'nowrap',
                  ...(ghost.left > 0.8 ? { right: 4 } : { left: 4 }),
                }}
              >
                what-if {ghost.label}
              </span>
            </span>
          ) : null}
          {band.goal && band.goal.clamped ? (
            // goal beyond the 12-month horizon: the runway runs off the edge; the date lives in the caption
            <span style={{ position: 'absolute', top: 20, right: 4, fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1 }}>⟶</span>
          ) : band.goal && ghostOnly ? (
            // no real pace yet: the only flag IS the what-if — draw it dashed so it never reads as truth
            <span style={{ position: 'absolute', top: 0, bottom: 0, left: pct(band.goal.left), borderLeft: '2px dashed var(--text-link)' }}>
              <span
                style={{
                  position: 'absolute',
                  bottom: 2,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  color: 'var(--text-link)',
                  whiteSpace: 'nowrap',
                  ...(band.goal.left > 0.8 ? { right: 4 } : { left: 4 }),
                }}
              >
                what-if {band.goal.label}
              </span>
            </span>
          ) : band.goal ? (
            <span style={{ position: 'absolute', top: 2, left: pct(band.goal.left), transform: 'translateX(-4px)', fontSize: '0.95rem', lineHeight: 1 }}>
              🎯
              <span
                style={{
                  position: 'absolute',
                  top: 1,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: 'var(--text-strong)',
                  whiteSpace: 'nowrap',
                  ...(band.goal.left > 0.82 ? { right: 18 } : { left: 18 }),
                }}
              >
                {band.goal.label}
              </span>
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline', marginTop: 7, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {band.goal && pace ? (
            <>
              {(() => {
                // Caption order (v2.2136): when the honest date is clamped past the
                // 12-month horizon, lead with what's actionable — tasks left and
                // the pace that lands inside the year — and demote the far date.
                const leftNode = hasEstimates ? (
                  <span>
                    <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{effortSumLabel(remainingDaysTotal).replace('≈ ', '≈')}</b> of work left ({remainingTotal} task{remainingTotal === 1 ? '' : 's'})
                  </span>
                ) : (
                  <span>
                    <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{remainingTotal}</b> task{remainingTotal === 1 ? '' : 's'} left
                  </span>
                )
                const paceNode = (
                  <span>
                    at your {pace.basis === 'recent' ? 'recent' : 'all-time'} pace —{' '}
                    <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{paceLabel(pace.daysPerWeek)} {hasEstimates ? 'days/week done' : 'tasks/week'}</b>
                    {pace.basis === 'recent' ? ' over the last 4 weeks' : ''}
                  </span>
                )
                const goalNode = (
                  <span>
                    🎯 {band.goal.clamped ? 'at that pace' : 'goal'} <b style={{ color: 'var(--text-strong)' }}>{band.goal.label}</b>
                  </span>
                )
                const neededNode =
                  neededPaceLabel != null ? (
                    <span>
                      <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{neededPaceLabel}</b> {paceUnit.replace('/week', '')}/week would finish by {horizonLabel}
                    </span>
                  ) : null
                const parts = neededNode ? [leftNode, neededNode, paceNode, goalNode] : [goalNode, paceNode, leftNode]
                return parts.map((p, i) => (
                  <Fragment key={i}>
                    {i > 0 ? <span style={{ color: 'var(--border-strong)' }}>·</span> : null}
                    {p}
                  </Fragment>
                ))
              })()}
              {ghost && whatIf != null ? (
                <>
                  <span style={{ color: 'var(--border-strong)' }}>·</span>
                  <span style={{ color: 'var(--text-link)' }}>
                    what-if <b style={{ fontVariantNumeric: 'tabular-nums' }}>{whatIf} {paceUnit}</b> ≈ {ghost.label.replace('≈ ', '')}
                  </span>
                </>
              ) : null}
            </>
          ) : ghostOnly && band.goal && whatIf != null ? (
            <span style={{ color: 'var(--text-link)' }}>
              what-if <b style={{ fontVariantNumeric: 'tabular-nums' }}>{whatIf} {paceUnit}</b> ≈ {band.goal.label.replace('≈ ', '')} — no completions yet, so this
              is only the dial
            </span>
          ) : (
            <span>Complete tasks to project a finish date — the calendar uses your real completion pace.</span>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto' }}>
            <span>what if</span>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <input
                type="range"
                min={1}
                max={20}
                value={whatIf ?? whatIfDefault}
                onChange={(e) => setWhatIf(Number(e.target.value))}
                aria-label={`What-if pace, ${paceUnit}`}
                style={{ width: 130 }}
              />
              {pace ? (
                <span
                  title={`your real pace: ${paceLabel(pace.daysPerWeek)} ${paceUnit}`}
                  style={{
                    position: 'absolute',
                    bottom: -9,
                    left: `${((Math.min(Math.max(pace.daysPerWeek, 1), 20) - 1) / 19) * 100}%`,
                    transform: 'translateX(-50%)',
                    fontSize: '0.52rem',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: FRONT,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}
                >
                  ▲ you
                </span>
              ) : null}
            </span>
            <b style={{ color: 'var(--text-link)', fontVariantNumeric: 'tabular-nums' }}>{whatIf ?? whatIfDefault} {paceUnit}</b>
            {whatIf != null ? (
              <button
                type="button"
                onClick={() => setWhatIf(null)}
                style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem', padding: 0, textDecoration: 'underline' }}
              >
                clear
              </button>
            ) : null}
          </label>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 660 }}>
          {/* wave header */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            <div className="roadmap-timeline-rail" style={{ flex: 'none' }} />
            <div style={{ flex: 1, position: 'relative', height: 26 }}>
              {laneVlines}
              {projection.map((p, i) => (
                <div
                  key={p.wave}
                  style={{
                    position: 'absolute',
                    top: 4,
                    left: pct((geometry.starts.get(p.wave) ?? 0) + 0.004),
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: i === 0 ? FRONT : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {waveName(i, projection.length)}
                  {p.remainingTasks > 0 ? ` · ${p.remainingTasks}` : ''}
                  {hasEstimates && p.remainingDays > 0 ? ` · ${effortSumLabel(p.remainingDays)}` : ''}
                </div>
              ))}
            </div>
          </div>

          {rows.map((r) => {
            const expanded = expandedGroupId === r.groupId
            const stageTasks = tasksByGroup.get(r.groupId) ?? []
            return (
              <div key={r.groupId}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedGroupId(expanded ? null : r.groupId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpandedGroupId(expanded ? null : r.groupId)
                    }
                  }}
                  aria-expanded={expanded}
                  aria-label={`Stage ${r.stageNumber}: ${r.title} — ${
                    r.isMilestone ? (r.done ? 'reached' : r.unplanned ? 'not planned yet' : 'milestone') : `${r.doneTasks} of ${r.totalTasks} done`
                  }${r.locked ? ', locked' : ''}`}
                  style={{ display: 'flex', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: expanded ? 'var(--bg-slate-tint)' : undefined }}
                >
                  <div className="roadmap-timeline-rail" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 7, padding: '0.4rem 0.6rem', minWidth: 0 }}>
                    <RoadmapStageNumberBadge n={r.stageNumber} />
                    <span className="roadmap-timeline-rail-title" style={{ fontSize: '0.76rem', fontWeight: 600, color: r.locked ? 'var(--text-muted)' : 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title}
                    </span>
                    {parallelGroupIds?.has(r.groupId) ? <RoadmapParallelBadge compact /> : null}
                    {!r.isMilestone ? (
                      <span className="roadmap-timeline-rail-title" style={{ flex: 'none', marginLeft: 'auto', fontSize: '0.64rem', color: r.done ? DONE : 'var(--text-muted)', fontWeight: r.done ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                        {r.locked ? '🔒 ' : ''}{r.doneTasks}/{r.totalTasks}{hasEstimates && !r.done && r.remainingDays > 0 ? ` · ${effortSumLabel(r.remainingDays)}` : ''}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ flex: 1, position: 'relative', minHeight: 32 }}>
                    {laneVlines}
                    {barFor(r, stageTasks)}
                    <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: pct(frontX), borderLeft: `2px solid ${FRONT}`, opacity: 0.55, pointerEvents: 'none' }} />
                  </div>
                </div>
                {expanded && stageTasks.length > 0 ? (
                  (() => {
                    const rect = rectFor(r)
                    const slots = taskSlotRectsWeighted(rect.left, rect.width, stageTasks.map((t) => taskWeightDays(t, avg)))
                    const nextUp = nextUpIndexFor(r, stageTasks)
                    return (
                      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-slate-tint)' }}>
                        {stageTasks.map((t, i) => {
                          const slot = slots[i]
                          const done = t.completed_at != null
                          const num = taskNumbers.get(t.id)
                          // Title runs from the rail up to its own bar (owner draft,
                          // v2.2049): anchored in the lane, reaching back into the
                          // rail via calc so every row's title starts at the same x
                          // and can never collide with its bar.
                          const titleWidth = `calc(var(--roadmap-timeline-rail-w) - 64px + ${pct(Math.max((slot?.left ?? 0) - 0.006, 0))})`
                          return (
                            <div key={t.id} style={{ display: 'flex', borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                              <div className="roadmap-timeline-rail" style={{ flex: 'none', display: 'flex', alignItems: 'center', padding: '0.18rem 0.6rem 0.18rem 1.5rem', minWidth: 0 }}>
                                {num ? <RoadmapTaskNumber label={num} /> : null}
                              </div>
                              <div style={{ flex: 1, position: 'relative', minHeight: 24 }}>
                                {laneVlines}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onOpenTask(t.id)
                                  }}
                                  title={`${num ?? ''} ${t.title}`}
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: 'calc(64px - var(--roadmap-timeline-rail-w))',
                                    width: titleWidth,
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    fontSize: '0.72rem',
                                    color: done ? 'var(--text-muted)' : 'var(--text-700)',
                                  }}
                                >
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: done ? 'line-through' : undefined }}>
                                    {t.title}
                                  </span>
                                  {t.assigneeIds.length > 0 ? (
                                    <span style={{ flex: 'none', marginLeft: 6, fontSize: '0.64rem', color: 'var(--text-faint)' }}>
                                      · {t.assigneeIds.map((id) => nameById.get(id) ?? '…').join(', ')}
                                    </span>
                                  ) : null}
                                  {hasEstimates ? (
                                    <span style={{ flex: 'none', marginLeft: 6, fontSize: '0.64rem', color: t.estimated_days != null ? 'var(--text-muted)' : 'var(--text-faint)' }}>
                                      · {t.estimated_days != null ? effortDaysLabel(t.estimated_days) : `≈${effortDaysLabel(avg)}`}
                                    </span>
                                  ) : null}
                                </button>
                                {slot ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onOpenTask(t.id)
                                    }}
                                    title={`${num ?? ''} ${t.title}`}
                                    aria-label={`Open task ${t.title}`}
                                    style={{
                                      position: 'absolute',
                                      top: 4,
                                      bottom: 4,
                                      left: pct(slot.left),
                                      width: pct(slot.width),
                                      padding: 0,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      overflow: 'hidden',
                                      ...slotStyle(r, done, i === nextUp),
                                    }}
                                  >
                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: done ? DONE : 'var(--text-muted)', pointerEvents: 'none' }}>
                                      {done ? '✓' : num ?? ''}
                                    </span>
                                  </button>
                                ) : null}
                                <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: pct(frontX), borderLeft: `2px solid ${FRONT}`, opacity: 0.55, pointerEvents: 'none' }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      <p style={{ margin: 0, padding: '0.45rem 0.8rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        Columns are dependency waves from the Map's arrows — sequence, not calendar. The calendar up top projects real dates from your observed pace (remaining days of work ÷ days done per week, wave by wave; a task with no ⏱ estimate counts as an average one). Slot width ≈ estimated effort, in stage order — green done, amber ring next up · ◆ = milestone stage · ◇ = not planned yet (no tasks, nothing before it) · the amber line is the work front.
      </p>
    </div>
  )
}
