/**
 * Residential build, R8 · 14: the Customers line's counts for today, from Follow up's own reads (`FollowUpIo.loadQueue`)
 * through its queue, New lane and all (`followUpNewLane`, as `useFollowUpQueue` builds it), so the line and the page say
 * one number. The hook imports this file on demand, after first paint, so the Dashboard's own chunk does not carry the
 * Follow up kernels.
 */
import { customerMessageCounts, type CustomerMessagesCounts } from './customerCounts'
import { supabaseFollowUpIo, type FollowUpIo } from './followUpIo'
import { followUpInputFromRows, followUpNewLane } from './followUpRows'
import { followUpQueue } from './queue'

/**
 * The counts for today, or null when no customer waits on us and nothing is to sort. With `textsElsewhere` (Quickfill,
 * whose Texts station holds the texts since v2.5823) a customer whose waiting line is a text is left out of *need a
 * reply*.
 */
export async function loadCustomerMessagesCounts(
  todayYmd: string,
  io: Pick<FollowUpIo, 'loadQueue'> = supabaseFollowUpIo(),
  nowIso: string = new Date().toISOString(),
  opts: { textsElsewhere?: boolean } = {},
): Promise<CustomerMessagesCounts | null> {
  const rows = await io.loadQueue(todayYmd)
  const input = followUpInputFromRows(rows, todayYmd, {})
  const queue = followUpQueue(input, { newLane: followUpNewLane(input, rows.jobStates ?? {}, nowIso) })
  const textsElsewhere = opts.textsElsewhere ? new Set(input.messages.filter((m) => m.channel === 'text' && m.direction === 'in').map((m) => m.id)) : undefined
  const counts = customerMessageCounts(queue, input.contacts, { textsElsewhere })
  return counts.needReply + counts.weOwe + counts.toSort > 0 ? counts : null
}
