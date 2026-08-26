import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { BridgeState } from '../lib/roadmapBridge'
import type { Database } from '../types/database'

type GroupRow = Database['public']['Tables']['checklist_tech_tree_groups']['Row']
type TaskRow = Database['public']['Tables']['checklist_tech_tree_group_tasks']['Row']
type EdgeRow = Database['public']['Tables']['checklist_tech_tree_edges']['Row']

/** A tech-tree task row plus its assignee ids (the shape every roadmap view consumes). */
export type TaskView = TaskRow & { assigneeIds: string[] }

/**
 * The Roadmap tab's data engine (extracted verbatim from ChecklistTechTreeTab
 * in v2.2156 — sub-decomposition move 1 of the CHECKLIST_TABS_ARCHITECTURE
 * map). Runs the bridge sync RPC, then loads the roadmap's groups, tasks (+
 * assignees), edges (fetched unscoped, filtered to the roadmap's groups),
 * users, and the bridge rows. `blockingLoadOverlayRef`: only the first fetch
 * per (auth, roadmap) shows the full-page loader; refetches keep the graph
 * mounted.
 */
export function useChecklistTechTreeData(
  authUserId: string | null,
  roadmapId: string | null,
  setError: (s: string | null) => void,
) {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [tasks, setTasks] = useState<TaskView[]>([])
  const [treeEdges, setTreeEdges] = useState<EdgeRow[]>([])
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [loading, setLoading] = useState(true)
  /** taskId -> latest bridged instance state (checklist_items.roadmap_group_task_id). */
  const [bridgeByTaskId, setBridgeByTaskId] = useState<Map<string, BridgeState>>(new Map())
  /** First fetch after each auth (or fresh hook) shows the full-page loader; refetches do not, so the graph is not unmounted. */
  const blockingLoadOverlayRef = useRef(true)
  useEffect(() => {
    blockingLoadOverlayRef.current = true
  }, [authUserId, roadmapId])

  const load = useCallback(async () => {
    if (!authUserId || !roadmapId) {
      setGroups([])
      setTasks([])
      setTreeEdges([])
      setLoading(false)
      return
    }
    setError(null)
    if (blockingLoadOverlayRef.current) {
      setLoading(true)
    }
    try {
      // Bridge sync (v2.1876): materialize newly-unlocked assigned tasks as
      // checklist items BEFORE reading, so the canvas reflects fresh state.
      // The RPC self-gates (dev/editor) — viewers just skip it.
      try {
        await supabase.rpc('sync_roadmap_to_checklist', { p_roadmap_id: roadmapId })
      } catch {
        // non-editors / offline: canvas still renders
      }
      const gRes = await withSupabaseRetry(
        () =>
          supabase
            .from('checklist_tech_tree_groups')
            .select('*')
            .eq('roadmap_id', roadmapId)
            .order('sort_index', { ascending: true }),
        'load checklist_tech_tree_groups',
      )
      const groupIds = gRes.map((g) => g.id)
      const groupIdSet = new Set(groupIds)

      const [tRes, eResRaw, uRes] = await Promise.all([
        groupIds.length === 0
          ? Promise.resolve([] as unknown[])
          : withSupabaseRetry(
              () =>
                supabase
                  .from('checklist_tech_tree_group_tasks')
                  // `*` (not a column list) so `pinned_at` (v2.2140) arrives once its
                  // migration is pushed and the read never 400s before that.
                  .select('*, checklist_tech_tree_task_assignees(user_id)')
                  .in('group_id', groupIds)
                  .order('sort_index', { ascending: true }),
              'load checklist_tech_tree_group_tasks',
            ),
        withSupabaseRetry(
          () => supabase.from('checklist_tech_tree_edges').select('*'),
          'load checklist_tech_tree_edges',
        ),
        withSupabaseRetry(
          () =>
            supabase.from('users').select('id, name, email').is('archived_at', null).order('name'),
          'load users for tech tree',
        ),
      ] as const)

      const eRes = (eResRaw as EdgeRow[]).filter(
        (e) => groupIdSet.has(e.from_group_id) && groupIdSet.has(e.to_group_id),
      )

      setGroups(gRes)
      setTreeEdges(eRes)
      setUsers(uRes)
      {
        const taskIds = (tRes as Array<{ id: string }>).map((t) => t.id)
        if (taskIds.length > 0) {
          const { data: bridgeRows } = await supabase
            .from('checklist_items')
            .select('roadmap_group_task_id, checklist_instances(id, completed_at, reviewed_at)')
            .in('roadmap_group_task_id', taskIds)
          const bmap = new Map<string, BridgeState>()
          for (const row of (bridgeRows ?? []) as Array<{ roadmap_group_task_id: string | null; checklist_instances: Array<{ id: string; completed_at: string | null; reviewed_at: string | null }> | null }>) {
            if (!row.roadmap_group_task_id) continue
            const inst = (row.checklist_instances ?? [])[0]
            if (inst) bmap.set(row.roadmap_group_task_id, { instanceCompletedAt: inst.completed_at, reviewedAt: inst.reviewed_at, instanceId: inst.id })
          }
          setBridgeByTaskId(bmap)
        } else {
          setBridgeByTaskId(new Map())
        }
      }
      setTasks(
        (tRes as unknown[]).map((row) => {
          const r = row as {
            id: string
            group_id: string
            title: string
            sort_index: number
            completed_at: string | null
            completed_by_user_id: string | null
            created_at: string
            pinned_at: string | null
            estimated_days: number | null
            checklist_tech_tree_task_assignees: { user_id: string }[] | null
          }
          const assigneeIds = (r.checklist_tech_tree_task_assignees ?? []).map((a) => a.user_id)
          return {
            id: r.id,
            group_id: r.group_id,
            title: r.title,
            sort_index: r.sort_index,
            completed_at: r.completed_at,
            completed_by_user_id: r.completed_by_user_id,
            created_at: r.created_at,
            pinned_at: r.pinned_at,
            estimated_days: r.estimated_days,
            assigneeIds,
          }
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roadmap')
    } finally {
      setLoading(false)
      blockingLoadOverlayRef.current = false
    }
  }, [authUserId, roadmapId, setError])

  useEffect(() => {
    void load()
  }, [load])

  return { groups, tasks, treeEdges, users, loading, load, bridgeByTaskId }
}
