/**
 * Per-user display order for checklist items.
 * New items go to bottom; order is stored in checklist_item_assignees.display_order.
 */

import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from './errorHandling'
import { nextDisplayOrders } from '../lib/tasks/newTaskSend'

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
  // One past the highest each person holds: the rule is the send's own (`nextDisplayOrders`), shared with the dev seat.
  return nextDisplayOrders((data ?? []) as Array<{ user_id: string; display_order: number | null }>, userIds)
}
