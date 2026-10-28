/**
 * The pair mode's three writes (punch list #208, design spike): pair a job to a bid (one
 * `jobs_ledger.bid_id`, the same column Edit Job's Disconnect clears), unpair it, and mark paired
 * bids won. Each is the row's own update under the caller's policies, and each reads the updated
 * id back so a policy's silent refusal (zero rows) is an error and not a quiet nothing. Nothing else
 * moves: the job keeps its customer, address, development and budget copy; the bid keeps its
 * outcome until the won press, which is the person's.
 */
import { supabase } from '../supabase'

const REFUSED = 'The change was not applied. The row may have moved, or you may not have the right to change it.'

async function updateJobBid(jobId: string, bidId: string | null): Promise<void> {
  const { data, error } = await supabase.from('jobs_ledger').update({ bid_id: bidId }).eq('id', jobId).select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error(REFUSED)
}

/** Pair: the job came from this bid. One bid may take several jobs. */
export async function pairJobToBid(jobId: string, bidId: string): Promise<void> {
  await updateJobBid(jobId, bidId)
}

/** Unpair: the job came from no bid. Put it back pairs it again with the same id. */
export async function unpairJob(jobId: string): Promise<void> {
  await updateJobBid(jobId, null)
}

/**
 * Pair several at once: each pair is its own write, so one refusal never stops the rest; the
 * result names what went through and what did not, with its reason.
 */
export async function pairMany(pairs: ReadonlyArray<{ jobId: string; bidId: string }>): Promise<{ done: number; failed: Array<{ jobId: string; reason: string }> }> {
  let done = 0
  const failed: Array<{ jobId: string; reason: string }> = []
  for (const p of pairs) {
    try {
      await updateJobBid(p.jobId, p.bidId)
      done += 1
    } catch (e) {
      failed.push({ jobId: p.jobId, reason: e instanceof Error ? e.message : REFUSED })
    }
  }
  return { done, failed }
}

/**
 * Won, as a counted press, never automatic: sets `bids.outcome` to won on the bids named (the
 * database stamps `outcome_at`, as the quick lost capture relies on). The Bid Board moves them, so
 * the press is the owner's.
 */
export async function markBidsWon(bidIds: readonly string[]): Promise<{ done: number; failed: Array<{ bidId: string; reason: string }> }> {
  let done = 0
  const failed: Array<{ bidId: string; reason: string }> = []
  for (const bidId of bidIds) {
    const { data, error } = await supabase.from('bids').update({ outcome: 'won' }).eq('id', bidId).select('id')
    if (error) failed.push({ bidId, reason: error.message })
    else if (!data || data.length === 0) failed.push({ bidId, reason: REFUSED })
    else done += 1
  }
  return { done, failed }
}
