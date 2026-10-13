/**
 * Residential build, R8 · 14: the Customers line's counts for today, from Follow up's own reads (`FollowUpIo.loadQueue`)
 * through its queue, so the line and the page say one number. The hook imports this file on demand, after first paint,
 * so the Dashboard's own chunk does not carry the Follow up kernels.
 */
import { customerMessageCounts, type CustomerMessagesCounts } from './customerCounts'
import { supabaseFollowUpIo, type FollowUpIo } from './followUpIo'
import { followUpInputFromRows } from './followUpRows'
import { followUpQueue } from './queue'

/** The counts for today, or null when no customer waits on us and nothing is to sort. */
export async function loadCustomerMessagesCounts(
  todayYmd: string,
  io: Pick<FollowUpIo, 'loadQueue'> = supabaseFollowUpIo(),
): Promise<CustomerMessagesCounts | null> {
  const input = followUpInputFromRows(await io.loadQueue(todayYmd), todayYmd, {})
  const counts = customerMessageCounts(followUpQueue(input), input.contacts)
  return counts.needReply + counts.weOwe + counts.toSort > 0 ? counts : null
}
