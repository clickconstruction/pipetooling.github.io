import { useMemo, useState } from 'react'
import {
  goalMilestones,
  planHeaderStats,
  planNowStages,
  planUpNextStages,
  type PlanTask,
} from '../../lib/roadmapPlanView'
import { lockedStageHint } from '../../lib/roadmapBridge'
import type { TechTreeEdge } from '../../lib/checklistTechTreeGraph'

type UserRow = { id: string; name: string; email: string }

type Props = {
  groups: Array<{ id: string; title: string }>
  tasks: PlanTask[]
  edges: TechTreeEdge[]
  unlockedIds: ReadonlySet<string>
  completeIds: ReadonlySet<string>
  users: UserRow[]
  currentUserId: string | null
  canEditStructure: boolean
  /** Adds one assignee to a task; parent reloads + re-syncs on success. */
  onAssign: (taskId: string, userId: string) => Promise<boolean>
  /** Opens the task card modal (thread + notes). */
  onOpenTask: (taskId: string) => void
}

/**
 * The roadmap Plan view (v2.1913): the same tech tree as a flat work surface —
 * header truth (done / assigned / unstaffed), the Now list sorted by momentum
 * with tap-tap staffing, Up next with named blockers, and task-less goal
 * stages as milestones measured by their feeder tasks. Built for phones and
 * for the "85 unassigned tasks" problem: pick a name once, tap tasks to hand
 * them out; the bridge sync puts them on Today lists immediately.
 */
export function ChecklistRoadmapPlanView({
  groups,
  tasks,
  edges,
  unlockedIds,
  completeIds,
  users,
  currentUserId,
  canEditStructure,
  onAssign,
  onOpenTask,
}: Props) {
  const [staffingGroupId, setStaffingGroupId] = useState<string | null>(null)
  const [pickedUserId, setPickedUserId] = useState<string | null>(null)
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null)

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) m.set(u.id, u.name || u.email)
    return m
  }, [users])

  const usersOrdered = useMemo(() => {
    if (!currentUserId) return users
    const me = users.find((u) => u.id === currentUserId)
    if (!me) return users
    return [me, ...users.filter((u) => u.id !== currentUserId)]
  }, [users, currentUserId])

  const tasksByGroup = useMemo(() => {
    const m = new Map<string, PlanTask[]>()
    for (const t of tasks) m.set(t.group_id, [...(m.get(t.group_id) ?? []), t])
    return m
  }, [tasks])

  const stats = useMemo(() => planHeaderStats(tasks), [tasks])
  const nowStages = useMemo(
    () => planNowStages({ groups, tasksByGroup, unlockedIds, completeIds, edges }),
    [groups, tasksByGroup, unlockedIds, completeIds, edges],
  )
  const upNext = useMemo(
    () => planUpNextStages({ groups, tasksByGroup, unlockedIds, completeIds, edges }),
    [groups, tasksByGroup, unlockedIds, completeIds, edges],
  )
  const goals = useMemo(
    () => goalMilestones({ groups, tasksByGroup, completeIds, edges }),
    [groups, tasksByGroup, completeIds, edges],
  )

  async function assign(taskId: string) {
    if (!pickedUserId || assigningTaskId) return
    setAssigningTaskId(taskId)
    try {
      await onAssign(taskId, pickedUserId)
    } finally {
      setAssigningTaskId(null)
    }
  }

  const pct = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100)

  const chip = (label: string, key?: string) => (
    <span
      key={key ?? label}
      style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: 'var(--bg-blue-tint)',
        color: 'var(--text-blue-800)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )

  return (
    <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '0.5rem 0 2rem' }}>
      <div
        style={{
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          padding: '0.8rem 1rem',
          marginBottom: '1.1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: '0.8125rem', color: 'var(--text-700)', marginBottom: 6 }}>
          <span>
            <strong style={{ color: 'var(--text-strong)' }}>{stats.done}</strong> of {stats.total} tasks done
          </span>
          <span>
            {stats.assigned} assigned ·{' '}
            <span style={{ color: stats.unstaffed > 0 ? 'var(--text-red-700)' : 'var(--text-muted)', fontWeight: stats.unstaffed > 0 ? 600 : 400 }}>
              {stats.unstaffed} unstaffed
            </span>
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--bg-muted)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(pct, stats.done > 0 ? 2 : 0)}%`, height: '100%', background: '#16a34a' }} />
        </div>
      </div>

      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-slate-500)' }}>
        Now — {nowStages.length} stage{nowStages.length === 1 ? '' : 's'} open
      </h3>
      {nowStages.map((s) => {
        const stageTasks = tasksByGroup.get(s.groupId) ?? []
        const staffing = staffingGroupId === s.groupId
        return (
          <div
            key={s.groupId}
            style={{
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              padding: '0.7rem 0.9rem',
              marginBottom: '0.6rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{s.title}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 999,
                  ...(s.done > 0
                    ? { background: 'var(--bg-green-100)', color: 'var(--text-green-700)' }
                    : { background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--text-muted)' }),
                }}
              >
                {s.done} of {s.total} done
              </span>
              {canEditStructure ? (
                <button
                  type="button"
                  onClick={() => {
                    setStaffingGroupId(staffing ? null : s.groupId)
                    setPickedUserId(null)
                  }}
                  style={{
                    marginLeft: 'auto',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border-strong)',
                    background: staffing ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    color: staffing ? 'var(--text-blue-800)' : 'var(--text-700)',
                    cursor: 'pointer',
                  }}
                >
                  {staffing ? 'Done staffing' : 'Staff this stage'}
                </button>
              ) : null}
            </div>
            {s.feeds.length > 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>feeds {s.feeds.join(', ')}</div>
            ) : null}
            {staffing ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0.6rem 0 0.2rem' }}>
                {usersOrdered.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setPickedUserId(pickedUserId === u.id ? null : u.id)}
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: pickedUserId === u.id ? 600 : 400,
                      padding: '4px 12px',
                      borderRadius: 999,
                      border: '1px solid var(--border-strong)',
                      background: pickedUserId === u.id ? '#2563eb' : 'var(--surface)',
                      color: pickedUserId === u.id ? 'white' : 'var(--text-700)',
                      cursor: 'pointer',
                    }}
                  >
                    {u.name || u.email}
                  </button>
                ))}
              </div>
            ) : null}
            {staffing && !pickedUserId ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Pick a name, then tap tasks to hand them out.</div>
            ) : null}
            <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
              {stageTasks.map((t) => {
                const open = t.completed_at == null
                const assignable = staffing && pickedUserId && open && !t.assigneeIds.includes(pickedUserId)
                return (
                  <li
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '0.3rem 0',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => (assignable ? void assign(t.id) : onOpenTask(t.id))}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: open ? 'var(--text-strong)' : 'var(--text-muted)',
                        textDecoration: open ? 'none' : 'line-through',
                      }}
                    >
                      {t.title}
                    </button>
                    {assigningTaskId === t.id ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>…</span>
                    ) : t.assigneeIds.length > 0 ? (
                      t.assigneeIds.map((id) => chip(nameById.get(id) ?? '…', `${t.id}-${id}`))
                    ) : assignable ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)' }}>tap to assign</span>
                    ) : open ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>unassigned</span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      {nowStages.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Nothing open — add tasks or unlock a stage.</p>
      ) : null}

      {upNext.length > 0 ? (
        <>
          <h3 style={{ margin: '1.2rem 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-slate-500)' }}>
            Up next — locked until the front moves
          </h3>
          {upNext.map((s) => (
            <div
              key={s.groupId}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '0.55rem 0.9rem',
                marginBottom: '0.4rem',
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)' }}>🔒 {s.title}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {s.total} task{s.total === 1 ? '' : 's'} · {lockedStageHint(s.blockingTitles, false) ?? 'blocked'}
              </span>
            </div>
          ))}
        </>
      ) : null}

      {goals.length > 0 ? (
        <>
          <h3 style={{ margin: '1.2rem 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-slate-500)' }}>
            Goals — milestones, measured by their feeders
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {goals.map((g) => (
              <div
                key={g.groupId}
                style={{
                  border: `1px solid ${g.complete ? '#16a34a' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '0.6rem 0.8rem',
                }}
              >
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }}>
                  {g.complete ? '✓ ' : '⛰ '}
                  {g.title}
                </div>
                <div style={{ height: 6, background: 'var(--bg-muted)', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${g.feederTotal === 0 ? 0 : Math.round((g.feederDone / g.feederTotal) * 100)}%`,
                      height: '100%',
                      background: g.complete ? '#16a34a' : '#7c3aed',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 5 }}>
                  {g.feederDone} of {g.feederTotal} feeder tasks · {g.feederStages} stage{g.feederStages === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
