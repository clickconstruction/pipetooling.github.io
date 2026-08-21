import { useMemo, useState } from 'react'
import { approxDateLabel, paceProjection, timelineRows, type TimelineRow } from '../../lib/roadmapTimeline'
import { stageNumbersByGroupId, taskNumbersByTaskId } from '../../lib/roadmapStageNumbers'
import { RoadmapStageNumberBadge, RoadmapTaskNumber } from './RoadmapStageNumberBadge'
import type { PlanTask } from '../../lib/roadmapPlanView'
import type { TechTreeEdge } from '../../lib/checklistTechTreeGraph'

type Props = {
  groups: Array<{ id: string; title: string }>
  tasks: PlanTask[]
  edges: TechTreeEdge[]
  unlockedIds: ReadonlySet<string>
  completeIds: ReadonlySet<string>
  users: Array<{ id: string; name: string; email: string }>
  /** Opens the task card modal. */
  onOpenTask: (taskId: string) => void
}

const PACE_KEY = 'roadmap_timeline_pace_v1'
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
 * The roadmap Timeline view (v2.1979): a Gantt whose x-axis is dependency
 * sequence. Rows staircase by (wave, stage order); bar width = remaining
 * tasks; task-less stages render as ◆ milestones; the amber FRONT line marks
 * live progress through the current wave; the pace slider projects ≈dates
 * (remaining ÷ tasks-per-week, wave by wave) without storing a single date.
 * Tapping a row unfolds its N.M tasks; tapping a task opens the task card.
 */
export function ChecklistRoadmapTimelineView({ groups, tasks, edges, unlockedIds, completeIds, users, onOpenTask }: Props) {
  const [pace, setPace] = useState<number>(() => {
    const raw = typeof localStorage !== 'undefined' ? Number(localStorage.getItem(PACE_KEY)) : NaN
    return Number.isFinite(raw) && raw >= 1 && raw <= 20 ? raw : 5
  })
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

  const tasksByGroup = useMemo(() => {
    const m = new Map<string, PlanTask[]>()
    for (const t of tasks) m.set(t.group_id, [...(m.get(t.group_id) ?? []), t])
    return m
  }, [tasks])

  const stageNumbers = useMemo(() => stageNumbersByGroupId(groups), [groups])
  const taskNumbers = useMemo(() => taskNumbersByTaskId(stageNumbers, tasksByGroup), [stageNumbers, tasksByGroup])
  const nameById = useMemo(() => new Map(users.map((u) => [u.id, u.name || u.email])), [users])

  const rows = useMemo(
    () => timelineRows({ groups, tasksByGroup, edges, unlockedIds, completeIds }),
    [groups, tasksByGroup, edges, unlockedIds, completeIds],
  )
  const projection = useMemo(() => paceProjection(rows, pace, new Date()), [rows, pace])
  const now = useMemo(() => new Date(), [])

  // wave geometry: width share ∝ remaining tasks, with a floor so empty/done
  // waves stay visible; all fractions of the lane width
  const geometry = useMemo(() => {
    const waves = projection.map((p) => p.wave)
    const raw = projection.map((p) => Math.max(p.remainingTasks, 1))
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
      maxStage.set(r.wave, Math.max(maxStage.get(r.wave) ?? 1, r.remainingTasks))
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

  const goal = projection[projection.length - 1]

  const setPacePersisted = (v: number) => {
    setPace(v)
    try {
      localStorage.setItem(PACE_KEY, String(v))
    } catch {
      // storage unavailable — the slider still works for this session
    }
  }

  const pct = (f: number) => `${(f * 100).toFixed(2)}%`

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

  const barFor = (r: TimelineRow) => {
    const waveStart = geometry.starts.get(r.wave) ?? 0
    const waveWidth = geometry.widths.get(r.wave) ?? 0.1
    if (r.isMilestone) {
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
              background: r.done ? DONE : 'var(--text-violet-700)',
            }}
          />
          <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: `calc(${pct(waveStart)} + 12px)`, fontSize: '0.68rem', fontWeight: 700, color: r.done ? DONE : 'var(--text-violet-700)', whiteSpace: 'nowrap' }}>
            {r.done ? '✓ reached' : 'milestone'}
          </span>
        </>
      )
    }
    const maxStage = geometry.maxStage.get(r.wave) ?? 1
    const share = r.done ? 0.14 : Math.max(r.remainingTasks / maxStage, 0.2)
    const width = Math.max(waveWidth * share - 0.008, 0.05)
    const fillPct = r.totalTasks === 0 ? 0 : (r.doneTasks / r.totalTasks) * 100
    return (
      <div
        style={{
          position: 'absolute',
          top: 5,
          bottom: 5,
          left: pct(waveStart + 0.004),
          width: pct(width),
          borderRadius: 6,
          border: r.done ? `1px solid ${DONE}` : r.locked ? '1px dashed var(--border-strong)' : '1px solid var(--text-link)',
          background: r.done ? 'var(--bg-green-100)' : r.locked ? 'var(--bg-muted)' : 'var(--surface)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          padding: '0 7px',
          fontSize: '0.66rem',
          color: r.done ? DONE : 'var(--text-muted)',
          fontWeight: r.done ? 700 : 400,
          whiteSpace: 'nowrap',
        }}
      >
        {!r.done && fillPct > 0 ? (
          <span style={{ position: 'absolute', inset: 0, width: `${fillPct}%`, background: 'var(--bg-green-100)', borderRight: `2px solid ${DONE}` }} />
        ) : null}
        <span style={{ position: 'relative' }}>
          {r.done ? '✓' : r.locked ? `🔒 ${r.totalTasks} task${r.totalTasks === 1 ? '' : 's'}` : `${r.doneTasks} of ${r.totalTasks}`}
        </span>
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '0.5rem 0.8rem', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          at{' '}
          <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>
            {pace} task{pace === 1 ? '' : 's'}/week
          </b>
          <input
            type="range"
            min={1}
            max={20}
            value={pace}
            onChange={(e) => setPacePersisted(Number(e.target.value))}
            aria-label="Projection pace, tasks per week"
            style={{ width: 130 }}
          />
        </label>
        {goal ? (
          <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text-strong)' }}>
            🎯 goal {approxDateLabel(goal.finish, now)}
          </span>
        ) : null}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 660 }}>
          {/* wave header */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            <div className="roadmap-timeline-rail" style={{ flex: 'none' }} />
            <div style={{ flex: 1, position: 'relative', height: 40 }}>
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
                  <span style={{ display: 'block', textTransform: 'none', letterSpacing: 0, fontWeight: 600, color: 'var(--text-violet-700)' }}>
                    {approxDateLabel(p.finish, now)}
                  </span>
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
                  style={{ display: 'flex', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: expanded ? 'var(--bg-slate-tint)' : undefined }}
                >
                  <div className="roadmap-timeline-rail" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 7, padding: '0.4rem 0.6rem', minWidth: 0 }}>
                    <RoadmapStageNumberBadge n={r.stageNumber} />
                    <span className="roadmap-timeline-rail-title" style={{ fontSize: '0.76rem', fontWeight: 600, color: r.locked ? 'var(--text-muted)' : 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title}
                    </span>
                  </div>
                  <div style={{ flex: 1, position: 'relative', minHeight: 32 }}>
                    {laneVlines}
                    {barFor(r)}
                    <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: pct(frontX), borderLeft: `2px solid ${FRONT}`, opacity: 0.55, pointerEvents: 'none' }} />
                  </div>
                </div>
                {expanded && stageTasks.length > 0 ? (
                  <ul style={{ listStyle: 'none', margin: 0, padding: '0.35rem 0.8rem 0.5rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-slate-tint)' }}>
                    {stageTasks.map((t) => (
                      <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.18rem 0', fontSize: '0.76rem' }}>
                        {taskNumbers.has(t.id) ? <RoadmapTaskNumber label={taskNumbers.get(t.id)!} /> : null}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenTask(t.id)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                            flex: 1,
                            minWidth: 0,
                            cursor: 'pointer',
                            fontSize: '0.76rem',
                            color: t.completed_at ? 'var(--text-muted)' : 'var(--text-700)',
                            textDecoration: t.completed_at ? 'line-through' : undefined,
                          }}
                        >
                          {t.title}
                        </button>
                        {t.assigneeIds.length > 0 ? (
                          <span style={{ flex: 'none', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {t.assigneeIds.map((id) => nameById.get(id) ?? '…').join(', ')}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      <p style={{ margin: 0, padding: '0.45rem 0.8rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        Sequence, not calendar: columns are dependency waves from the Map's arrows; dates are what-ifs from the pace slider. Bar width = remaining work · ◆ = milestone stage · the amber line is the work front.
      </p>
    </div>
  )
}
