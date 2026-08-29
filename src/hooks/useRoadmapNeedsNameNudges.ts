import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useFarmModeEnabled } from './useFarmModeEnabled'
import { canSeeRoadmapTab } from '../lib/roadmapVisibility'
import { buildRoadmapNudges, type RoadmapNudge } from '../lib/dashboardRoadmapNudge'
import type { UserRole } from './useAuth'

/**
 * Roadmap "needs a person" nudges (v2.2138), extracted verbatim from
 * DashboardRoadmapNeedsNameBanner for the Needs You card (v2.2489).
 * Self-gating: empty unless the viewer can see the Roadmap tab (same gate as
 * the tab) and a roadmap clears ROADMAP_NUDGE_MIN_COUNT; empty on load error.
 */
export function useRoadmapNeedsNameNudges(
  authUserId: string | undefined,
  role: UserRole | null,
): { nudges: RoadmapNudge[] } {
  const [farmModeEnabled] = useFarmModeEnabled(authUserId ?? null)
  const allowed = Boolean(authUserId) && canSeeRoadmapTab(role, farmModeEnabled)
  const [nudges, setNudges] = useState<RoadmapNudge[]>([])

  useEffect(() => {
    if (!allowed) {
      setNudges([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [{ data: rms }, { data: grps }, { data: edgs }] = await Promise.all([
          supabase.from('checklist_tech_tree_roadmaps').select('id, title').order('sort_index'),
          supabase.from('checklist_tech_tree_groups').select('id, roadmap_id, title, sort_index'),
          supabase.from('checklist_tech_tree_edges').select('from_group_id, to_group_id'),
        ])
        if (cancelled || !rms || rms.length === 0 || !grps || grps.length === 0) return
        const { data: tsks } = await supabase
          .from('checklist_tech_tree_group_tasks')
          .select('id, group_id, title, sort_index, completed_at, checklist_tech_tree_task_assignees(user_id)')
          .in('group_id', grps.map((g) => g.id))
        if (cancelled) return
        const tasks = (tsks ?? []).map((t) => ({
          id: t.id,
          group_id: t.group_id,
          title: t.title,
          sort_index: t.sort_index,
          completed_at: t.completed_at,
          assigneeIds: ((t as { checklist_tech_tree_task_assignees?: Array<{ user_id: string }> | null }).checklist_tech_tree_task_assignees ?? []).map((a) => a.user_id),
        }))
        setNudges(
          buildRoadmapNudges({
            roadmaps: rms,
            groups: grps,
            tasks,
            edges: (edgs ?? []).map((e) => ({ fromGroupId: e.from_group_id, toGroupId: e.to_group_id })),
          }),
        )
      } catch {
        if (!cancelled) setNudges([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowed])

  return { nudges }
}
