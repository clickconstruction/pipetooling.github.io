/**
 * Backfill the missing half of a pair (punch list #208, design spike, the owner's ask after the
 * pairing walk): a bid for a job that is already done, born won, paired with the job in the same
 * press; and Undo, which unpairs and deletes the bid it made. The bid's number comes from the
 * database (the `bids` number trigger), as every bid's does. The bid carries a note saying where it
 * came from, so the Bid Board and the win rate can tell a backfilled bid from one that was priced
 * and sent. The bid → job direction is New Job from a bid, which already exists.
 */
import { supabase } from '../supabase'

export type BackfillBidInput = {
  jobId: string
  jobLabel: string
  projectName: string
  address: string | null
  customerId: string | null
  developmentId: string | null
  serviceTypeId: string | null
  estimatorId: string | null
  /** What the bid was won for: the job's revenue unless the person changed it. */
  wonFor: number | null
  /** The day it was won, YYYY-MM-DD; the database stamps now() when null. */
  wonOn: string | null
  createdBy: string
}

const REFUSED = 'The change was not applied. You may not have the right to make a bid here.'

/** Makes the bid and pairs the job with it. Returns the new bid's id and number. */
export async function makeBidFromJob(input: BackfillBidInput): Promise<{ bidId: string; bidNumber: string | null }> {
  if (!input.serviceTypeId) throw new Error('The job has no trade, and a bid needs one. Set the trade on the job first.')
  const outcomeAt = input.wonOn ? `${input.wonOn}T12:00:00.000Z` : null
  const { data, error } = await supabase
    .from('bids')
    .insert({
      project_name: input.projectName.trim() || null,
      address: input.address,
      customer_id: input.customerId,
      development_id: input.developmentId,
      service_type_id: input.serviceTypeId,
      estimator_id: input.estimatorId,
      agreed_value: input.wonFor,
      bid_value: input.wonFor,
      outcome: 'won',
      ...(outcomeAt ? { outcome_at: outcomeAt } : {}),
      notes: `Made from ${input.jobLabel} on the Development page: the bid this job came from, filled in after the fact.`,
      created_by: input.createdBy,
      materials_model: 'rough',
    } as never)
    .select('id, bid_number')
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error(REFUSED)
  const bid = data as unknown as { id: string; bid_number: string | null }
  const paired = await supabase.from('jobs_ledger').update({ bid_id: bid.id }).eq('id', input.jobId).select('id')
  if (paired.error) throw new Error(`The bid was made, but the pair was not: ${paired.error.message}`)
  if (!paired.data || paired.data.length === 0) throw new Error('The bid was made, but the pair was not applied.')
  return { bidId: bid.id, bidNumber: bid.bid_number }
}

/**
 * Undo: unpair, then delete the bid this press made. A policy may refuse the delete (today a bid's
 * maker and a dev may delete); then the pair is undone and the error names the bid to delete by hand.
 */
export async function undoBackfill(jobId: string, bidId: string): Promise<void> {
  const unpaired = await supabase.from('jobs_ledger').update({ bid_id: null }).eq('id', jobId).select('id')
  if (unpaired.error) throw new Error(unpaired.error.message)
  const { data, error } = await supabase.from('bids').delete().eq('id', bidId).select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('The pair is undone, but the bid could not be deleted from here. Open it on the Bid Board and delete it there.')
}
