/**
 * Per-user display order for checklist items.
 * New items go to bottom; order is stored in checklist_item_assignees.display_order.
 */

import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from './errorHandling'

/**
 * Returns the next display_order for each user (max + 1).
 * Used when inserting new assignees so they appear at the bottom.
 */
export async function getNextDisplayOrders(
  userIds: string[]
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map()
  const data = await withSupabaseRetry(
    async () => {
      const result = await supabase
        .from('checklist_item_assignees')
        .select('user_id, display_order')
        .in('user_id', userIds)
      return result
    },
    'get next display orders for checklist assignees'
  )
  const maxByUser = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ user_id: string; display_order: number | null }>) {
    const current = maxByUser.get(row.user_id) ?? 0
    maxByUser.set(row.user_id, Math.max(current, row.display_order ?? 0))
  }
  const result = new Map<string, number>()
  for (const uid of userIds) {
    result.set(uid, (maxByUser.get(uid) ?? 0) + 1)
  }
  return result
}
