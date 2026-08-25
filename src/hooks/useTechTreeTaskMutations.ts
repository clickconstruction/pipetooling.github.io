import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { ChecklistCardEvent } from '../lib/checklistCardEvents'

/** The slice of a roadmap task the mutations need to decide what to write. */
export type MutableTechTreeTask = {
  id: string
  group_id: string
  title: string
  assigneeIds: ReadonlyArray<string>
  pinned_at: string | null
  completed_at: string | null
}

/**
 * The roadmap task card's write path (v2.2182; moved verbatim out of
 * ChecklistTechTreeTab — the "optional later move" from the v2.2156
 * sub-decomposition): rename + assignees, Plan tap-tap staffing, ★ pin,
 * done/reopen, and the card's activity thread (events read + comment post).
 * One hook, two hosts — the Roadmap tab and the Review tab's "Where this task
 * fits" sheet — so editing a task behaves identically wherever its card opens.
 *
 * `getTask` reads the host's current row (skip-untouched saves, toggles);
 * `isGroupUnlocked` feeds the done rule; `reload` is the host's refetch
 * (the tab's re-runs the bridge sync RPC).
 */
export function useTechTreeTaskMutations(args: {
  authUserId: string | null
  canEditStructure: boolean
  getTask: (taskId: string) => MutableTechTreeTask | undefined
  isGroupUnlocked: (groupId: string) => boolean
  /** Sequential stages (v2.2264): true = an earlier sibling is still open. */
  isTaskWaiting?: (taskId: string) => boolean
  reload: () => Promise<void>
  setError: (s: string | null) => void
}) {
  const { authUserId, canEditStructure, getTask, isGroupUnlocked, isTaskWaiting, reload, setError } = args

  /** Staff always; otherwise the stage must be unlocked, the task not waiting
   *  behind an earlier sibling (sequential stages), AND the user an assignee —
   *  unassigned tasks are staff-only. Staff bypass the waiting rule on purpose:
   *  unblocking a stuck chain from the Map is a two-tap fix. */
  const canActOnTask = useCallback(
    (t: Pick<MutableTechTreeTask, 'assigneeIds' | 'id'>, groupUnlocked: boolean) => {
      if (!authUserId) return false
      if (canEditStructure) return true
      if (!groupUnlocked) return false
      if (isTaskWaiting?.(t.id)) return false
      if (t.assigneeIds.length === 0) return false
      return t.assigneeIds.includes(authUserId)
    },
    [authUserId, canEditStructure, isTaskWaiting],
  )

  /** Done ⇄ open. Same field the Map checkbox writes, so bridge / Goals / Timeline agree instantly. */
  const toggleTaskDone = useCallback(
    async (taskId: string): Promise<boolean> => {
      const t = getTask(taskId)
      if (!t || !authUserId) return false
      const unlocked = isGroupUnlocked(t.group_id)
      if (!canActOnTask(t, unlocked)) return false
      const next = t.completed_at
        ? { completed_at: null as null, completed_by_user_id: null as null }
        : { completed_at: new Date().toISOString(), completed_by_user_id: authUserId }
      try {
        setError(null)
        await withSupabaseRetry(
          () => supabase.from('checklist_tech_tree_group_tasks').update(next).eq('id', taskId),
          'toggle tech tree task',
        )
        await reload()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update task')
        return false
      }
    },
    [authUserId, canActOnTask, getTask, isGroupUnlocked, reload, setError],
  )

  const loadInstanceEvents = useCallback(async (instanceId: string): Promise<ChecklistCardEvent[]> => {
    const { data } = await supabase
      .from('checklist_instance_events')
      .select('id, instance_id, event_type, actor_user_id, body, created_at')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true })
    return (data ?? []) as ChecklistCardEvent[]
  }, [])

  const postInstanceComment = useCallback(
    async (instanceId: string, body: string): Promise<boolean> => {
      if (!authUserId) return false
      const { error: e } = await supabase.from('checklist_instance_events').insert({
        instance_id: instanceId,
        event_type: 'comment',
        actor_user_id: authUserId,
        body,
      })
      if (e) {
        setError(e.message)
        return false
      }
      return true
    },
    [authUserId, setError],
  )

  /** Plan-view staffing: add one assignee, then reload (the tab's load re-runs the sync RPC). */
  const assignTaskToUser = useCallback(
    async (taskId: string, userId: string): Promise<boolean> => {
      if (!canEditStructure) return false
      try {
        setError(null)
        await withSupabaseRetry(
          () => supabase.from('checklist_tech_tree_task_assignees').insert({ task_id: taskId, user_id: userId }),
          'assign tech tree task',
        )
        await reload()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not assign task')
        return false
      }
    },
    [canEditStructure, reload, setError],
  )

  const updateTaskInGroup = useCallback(
    async (taskId: string, title: string, assigneeUserIds: string[]): Promise<boolean> => {
      if (!canEditStructure || !title.trim()) return false
      // Skip untouched halves: the task card saves per interaction (an
      // assignee tap sends the unchanged title and vice versa).
      const current = getTask(taskId)
      const trimmed = title.trim()
      const titleChanged = !current || current.title !== trimmed
      const assigneesChanged =
        !current ||
        current.assigneeIds.length !== assigneeUserIds.length ||
        !assigneeUserIds.every((id) => current.assigneeIds.includes(id))
      try {
        setError(null)
        if (titleChanged) {
          await withSupabaseRetry(
            () => supabase.from('checklist_tech_tree_group_tasks').update({ title: trimmed }).eq('id', taskId),
            'update tech tree task title',
          )
        }
        if (assigneesChanged) {
          await withSupabaseRetry(
            () => supabase.from('checklist_tech_tree_task_assignees').delete().eq('task_id', taskId),
            'clear tech tree task assignees',
          )
          for (const uid of assigneeUserIds) {
            await withSupabaseRetry(
              () => supabase.from('checklist_tech_tree_task_assignees').insert({ task_id: taskId, user_id: uid }),
              'insert tech tree task assignee',
            )
          }
        }
        if (titleChanged || assigneesChanged) await reload()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update task')
        return false
      }
    },
    [canEditStructure, getTask, reload, setError],
  )

  /** ★ pin toggle (v2.2140): the owner's "this one, now" — leads the Next up shortlist. Editors only. */
  const toggleTaskPin = useCallback(
    async (taskId: string): Promise<boolean> => {
      if (!canEditStructure) return false
      const current = getTask(taskId)
      if (!current) return false
      const next = current.pinned_at ? null : new Date().toISOString()
      try {
        setError(null)
        await withSupabaseRetry(
          () => supabase.from('checklist_tech_tree_group_tasks').update({ pinned_at: next }).eq('id', taskId),
          'toggle tech tree task pin',
        )
        await reload()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not pin task')
        return false
      }
    },
    [canEditStructure, getTask, reload, setError],
  )

  return { canActOnTask, toggleTaskDone, loadInstanceEvents, postInstanceComment, assignTaskToUser, updateTaskInGroup, toggleTaskPin }
}
