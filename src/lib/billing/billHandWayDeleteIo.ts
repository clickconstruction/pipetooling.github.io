/**
 * Deleting a way nobody used (punch list #443, row 3): the count and the delete. The rule is `billHandWayDelete.ts`.
 *
 * Both run as the signed-in person. The table's own policy lets a dev delete and nobody else
 * (`bill_hand_ways_delete_dev`), so a delete by any other role reaches no row and is said as a refusal.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { BILLS_SENT_BY_HAND_KIND } from './billsSent'
import { handWayDeleteProblem, handWayDeleteUsedProblem } from './billHandWayDelete'
import type { BillHandWay } from './billHandWays'

/**
 * How many bills were recorded with this way: the by-hand records that carry its key (`source_snapshot.how`).
 * Throws when the read fails, so a way is never deleted on no answer.
 */
export async function countBillHandWayRecords(key: string): Promise<number> {
  const result = await supabase.from('sent_documents').select('id', { count: 'exact' }).eq('kind', BILLS_SENT_BY_HAND_KIND).eq('source_snapshot->>how', key).limit(1)
  if (result.error) throw result.error
  if (typeof result.count !== 'number') throw new Error('The bills recorded with this way could not be counted. Nothing was deleted.')
  return result.count
}

/**
 * Delete one way. The records are counted again here, right before the delete, and a way that fails the rule is
 * refused with its reason. The delete names only a row that is taken off, and a delete that reaches no row is said.
 * The delete is sent once: a second send after a lost answer would find no row and call a way that went still there.
 */
export async function deleteBillHandWayNobodyUsed(way: BillHandWay): Promise<void> {
  const fixed = handWayDeleteProblem(way)
  if (fixed) throw new Error(fixed)
  const used = handWayDeleteUsedProblem(way, await countBillHandWayRecords(way.key))
  if (used) throw new Error(used)
  const gone = await withSupabaseRetry(() => supabase.from('bill_hand_ways').delete().eq('id', way.id).not('retired_at', 'is', null).select('id'), 'delete the way', { maxRetries: 0 })
  if (!gone || gone.length === 0) throw new Error('The way was not deleted. You may not have leave to delete it, or it is back on the list.')
}
