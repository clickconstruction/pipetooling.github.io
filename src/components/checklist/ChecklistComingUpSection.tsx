import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { sequentialWaiting, type SequentialTaskLite } from '../../lib/checklistTechTreeGraph'

type ComingUpRow = {
  taskId: string
  title: string
  stageTitle: string
  blockerTitle: string
  blockerNames: string[]
}

/**
 * "⏳ Coming up" (v2.2264): the viewer's roadmap tasks that wait their turn in
 * a sequential stage — grayed, untouchable, each naming the task ahead of it
 * and who's doing it. Self-contained (own fetch; RLS: task assignment grants
 * roadmap read since v2.2261). Renders nothing while empty or for viewers with
 * no waiting tasks.
 */
export function ChecklistComingUpSection({ authUserId }: { authUserId: string | null }) {
  const [rows, setRows] = useState<ComingUpRow[]>([])

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
        const out: ComingUpRow[] = []
        for (const taskId of waitingIds) {
          if (!myIds.has(taskId)) continue
          const t = rowById.get(taskId)
          const blocker = blockerByTaskId.get(taskId)
          if (!t || !blocker) continue
          const blockerRow = rowById.get(blocker.id)
          out.push({
            taskId,
            title: t.title,
            stageTitle: stageTitleById.get(t.group_id) ?? '',
            blockerTitle: blocker.title,
            blockerNames: (blockerRow?.checklist_tech_tree_task_assignees ?? []).map(
              (a) => nameById.get(a.user_id) ?? '…',
            ),
          })
        }
        if (!cancelled) setRows(out)
      } catch {
        // RLS/load failure: the section simply doesn't render.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUserId])

  if (rows.length === 0) return null

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-strong)' }}>⏳ Coming up</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>yours, once the step ahead clears</span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((r) => (
          <li
            key={r.taskId}
            style={{
              border: '1.5px dashed var(--border-strong)',
              borderRadius: 11,
              padding: '0.55rem 0.75rem',
              marginBottom: '0.45rem',
              opacity: 0.75,
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>{r.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
              after <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>{r.blockerTitle}</b>
              {r.blockerNames.length > 0 ? (
                <>
                  {' · '}
                  {r.blockerNames.map((n) => (
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
                  ))}
                  <span>is on it</span>
                </>
              ) : (
                <span>· not staffed yet</span>
              )}
              {r.stageTitle ? <span style={{ whiteSpace: 'nowrap' }}>· ⛰ {r.stageTitle}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
