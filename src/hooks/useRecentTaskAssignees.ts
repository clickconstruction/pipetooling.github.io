import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { recentAssigneeIds } from '../lib/tasks/newTaskWindow'

/**
 * The people a giver gave tasks to last, newest first, for the faces of a task window (punch list #331).
 * Read from the giver's last thirty tasks while `enabled`; empty until it lands and for nobody signed in.
 */
export function useRecentTaskAssignees(meId: string | null, enabled: boolean): string[] {
  const [ids, setIds] = useState<string[]>([])
  useEffect(() => {
    if (!enabled) return
    if (!meId) {
      setIds([])
      return
    }
    let cancelled = false
    void supabase
      .from('checklist_items')
      .select('id')
      .eq('created_by_user_id', meId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(async ({ data: items }) => {
        const itemIds = (items ?? []).map((r) => r.id)
        if (itemIds.length === 0) {
          if (!cancelled) setIds([])
          return
        }
        const { data: assignees } = await supabase.from('checklist_item_assignees').select('checklist_item_id, user_id').in('checklist_item_id', itemIds)
        if (!cancelled) setIds(recentAssigneeIds(itemIds, (assignees ?? []) as Array<{ checklist_item_id: string; user_id: string }>, meId))
      })
    return () => {
      cancelled = true
    }
  }, [meId, enabled])
  return ids
}
