import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { sequentialWaiting, type SequentialTaskLite } from '../../lib/checklistTechTreeGraph'

export type WaitingGroup = {
  blockerId: string
  blockerTitle: string
  /** Resolved assignee names on the blocking task (unknowns filtered out). */
  blockerNames: string[]
  stageTitle: string
  tasks: Array<{
    taskId: string
    title: string
    /** Not directly behind the blocker — queued behind a waiting sibling. */
    queued: boolean
  }>
}

const VISIBLE_GROUPS = 3

/**
 * Fetch half of "⏳ Waiting For" (extracted v2.2650 so the Dashboard's My Inbox
 * strip can read the count without rendering the section): the viewer's roadmap
 * tasks waiting their turn in a sequential stage, grouped under the open task
 * holding them. Returns [] while loading, on failure, or with nothing waiting.
 */
export function useComingUpWaitingGroups(authUserId: string | null): WaitingGroup[] {
  const [groups, setGroups] = useState<WaitingGroup[]>([])

  useEffect(() => {
    if (!authUserId) return
    let cancelled = false
    void (async () => {
      try {
        const mine = (await withSupabaseRetry(
          () => supabase.from('checklist_tech_tree_task_assignees').select('task_id').eq('user_id', authUserId),
          'load my roadmap assignments',
        )) as Array<{ task_id: string }> | null
        const myTaskIds = (mine ?? []).map((r) => r.task_id)
        if (myTaskIds.length === 0) return
        const myTasks = (await withSupabaseRetry(
          () =>
            supabase
              .from('checklist_tech_tree_group_tasks')
              .select('id, group_id, completed_at')
              .in('id', myTaskIds)
              .is('completed_at', null),
          'load my roadmap tasks',
        )) as Array<{ id: string; group_id: string }> | null
        const groupIds = [...new Set((myTasks ?? []).map((t) => t.group_id))]
        if (groupIds.length === 0) return
        const [groups, siblings, users] = await Promise.all([
          withSupabaseRetry(
            () => supabase.from('checklist_tech_tree_groups').select('id, title, sequential').in('id', groupIds),
            'load stages for coming up',
          ) as Promise<Array<{ id: string; title: string; sequential: boolean }> | null>,
          withSupabaseRetry(
            () =>
              supabase
                .from('checklist_tech_tree_group_tasks')
                .select('id, title, group_id, sort_index, completed_at, checklist_tech_tree_task_assignees(user_id)')
                .in('group_id', groupIds)
                .order('sort_index', { ascending: true }),
            'load stage siblings for coming up',
          ) as Promise<Array<{
            id: string
            title: string
            group_id: string
            sort_index: number
            completed_at: string | null
            checklist_tech_tree_task_assignees: Array<{ user_id: string }>
          }> | null>,
          withSupabaseRetry(
            () => supabase.from('users').select('id, name, email'),
            'load names for coming up',
          ) as Promise<Array<{ id: string; name: string | null; email: string | null }> | null>,
        ])
        if (cancelled) return
        const nameById = new Map((users ?? []).map((u) => [u.id, (u.name ?? '').trim() || u.email || '…']))
        const tasksByGroup = new Map<string, SequentialTaskLite[]>()
        const rowById = new Map((siblings ?? []).map((t) => [t.id, t]))
        for (const t of siblings ?? []) {
          tasksByGroup.set(t.group_id, [...(tasksByGroup.get(t.group_id) ?? []), t])
        }
        const sequentialByGroupId = new Map((groups ?? []).map((g) => [g.id, g.sequential !== false]))
        const stageTitleById = new Map((groups ?? []).map((g) => [g.id, g.title]))
        const { waitingIds, blockerByTaskId } = sequentialWaiting({ tasksByGroup, sequentialByGroupId })
        const myIds = new Set(myTaskIds)
        const byBlocker = new Map<string, WaitingGroup>()
        for (const taskId of waitingIds) {
          if (!myIds.has(taskId)) continue
          const t = rowById.get(taskId)
          const blocker = blockerByTaskId.get(taskId)
          if (!t || !blocker) continue
          let g = byBlocker.get(blocker.id)
          if (!g) {
            const blockerRow = rowById.get(blocker.id)
            g = {
              blockerId: blocker.id,
              blockerTitle: blocker.title,
              blockerNames: (blockerRow?.checklist_tech_tree_task_assignees ?? [])
                .map((a) => nameById.get(a.user_id))
                .filter((n): n is string => !!n && n !== '…'),
              stageTitle: stageTitleById.get(t.group_id) ?? '',
              tasks: [],
            }
            byBlocker.set(blocker.id, g)
          }
          g.tasks.push({ taskId, title: t.title, queued: false })
        }
        const out = [...byBlocker.values()]
        for (const g of out) {
          // siblings arrive sort_index-ordered, so within a group the first
          // waiting task is directly behind the blocker; the rest are queued
          g.tasks.sort((a, b) => (rowById.get(a.taskId)?.sort_index ?? 0) - (rowById.get(b.taskId)?.sort_index ?? 0))
          g.tasks.forEach((t2, i) => {
            t2.queued = i > 0
          })
        }
        out.sort((a, b) => b.tasks.length - a.tasks.length || a.stageTitle.localeCompare(b.stageTitle))
        if (!cancelled) setGroups(out)
      } catch {
        // RLS/load failure: the section simply doesn't render.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUserId])

  return groups
}

/**
 * The grouped waiting list itself (dashed group cards + show-more), shared by
 * the Checklist/Dashboard section and the My Inbox strip. `groupBackground`
 * paints each dashed card (the strip sits on --bg-subtle, so its cards use
 * --surface); the default stays transparent.
 */
export function ComingUpWaitingGroupList({ groups, groupBackground }: { groups: WaitingGroup[]; groupBackground?: string }) {
  const [expanded, setExpanded] = useState(false)

  if (groups.length === 0) return null

  const visible = expanded ? groups : groups.slice(0, VISIBLE_GROUPS)
  const hiddenCount = groups.length - visible.length

  return (
    <>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {visible.map((g) => (
          <li
            key={g.blockerId}
            style={{
              border: '1.5px dashed var(--border-strong)',
              borderRadius: 11,
              padding: '0.55rem 0.75rem 0.6rem',
              marginBottom: '0.5rem',
              opacity: 0.85,
              background: groupBackground,
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
              after <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>{g.blockerTitle}</b>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                {g.blockerNames.length > 0 ? (
                  g.blockerNames.map((n) => (
                    <span
                      key={n}
                      style={{
                        background: 'var(--bg-blue-tint)',
                        color: 'var(--text-blue-800)',
                        borderRadius: 999,
                        padding: '1px 8px',
                        fontWeight: 600,
                      }}
                    >
                      {n}
                    </span>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>not staffed yet</span>
                )}
                {g.stageTitle ? <span style={{ whiteSpace: 'nowrap', color: 'var(--text-soft, var(--text-muted))' }}>· ⛰ {g.stageTitle}</span> : null}
              </div>
            </div>
            <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
              {g.tasks.map((t) => (
                <li
                  key={t.taskId}
                  style={{ display: 'flex', gap: 7, alignItems: 'baseline', fontSize: '0.85rem', color: 'var(--text-muted)', padding: '2.5px 0' }}
                >
                  <span aria-hidden style={{ fontSize: '0.7rem', opacity: 0.7, flexShrink: 0 }}>⏳</span>
                  <span style={{ minWidth: 0 }}>
                    {t.title}
                    {t.queued ? <i style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}> then</i> : null}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((o) => !o)}
          style={{
            width: '100%',
            textAlign: 'center',
            border: '1px dashed var(--border)',
            background: 'none',
            color: 'var(--text-muted)',
            borderRadius: 10,
            padding: 7,
            fontSize: '0.8rem',
            cursor: 'pointer',
            marginTop: 2,
          }}
        >
          {expanded ? 'show fewer ⌃' : `…and ${hiddenCount} more step${hiddenCount === 1 ? '' : 's'} ahead ⌄`}
        </button>
      ) : null}
    </>
  )
}

/**
 * "⏳ Waiting For" (v2.2264, grouped v2.2269): header + grouped waiting list as
 * a standalone section — the Checklist Today tab's rendering. The Dashboard
 * moved to the My Inbox footer strip in v2.2650 (same hook + list, different
 * shell in DashboardMyInboxCard). Renders nothing while empty.
 */
export function ChecklistComingUpSection({ authUserId }: { authUserId: string | null }) {
  const groups = useComingUpWaitingGroups(authUserId)

  if (groups.length === 0) return null

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-strong)' }}>⏳ Waiting For</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>yours, once the step ahead clears</span>
      </div>
      <ComingUpWaitingGroupList groups={groups} />
    </div>
  )
}
