/**
 * Two chips that act (punch list #208, design spike, the owner's ask after the backfill walk):
 * *not in <development>* puts the piece in the development (one `development_id`, the column Edit Bid's and
 * Edit Job's picker set; the same-master backstop still holds), and *archived* puts a bid back
 * on the Unsent/Working board (the two archive stamps cleared, as the Bid window's own *Back onto the
 * Unsent / Working board* does). Each is one column on one row, read back so a policy's silent
 * refusal is an error, and each has its way back for the toast.
 */
import { supabase } from '../supabase'

const REFUSED = 'The change was not applied. The row may have moved, or you may not have the right to change it.'

async function setDevelopment(kind: 'bid' | 'job', id: string, developmentId: string | null): Promise<void> {
  const table = kind === 'bid' ? 'bids' : 'jobs_ledger'
  const { data, error } = await supabase.from(table).update({ development_id: developmentId } as never).eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error(REFUSED)
}

/** Put the piece in the development. */
export async function putInDevelopment(kind: 'bid' | 'job', id: string, developmentId: string): Promise<void> {
  await setDevelopment(kind, id, developmentId)
}

/** Put every named bid and job in the development in one transaction (PR 3, `put_in_development`): the counts that moved come back; a row the caller may not update stays. */
export async function putAllInDevelopment(developmentId: string, bidIds: readonly string[], jobIds: readonly string[]): Promise<{ bids: number; jobs: number }> {
  const { data, error } = await supabase.rpc('put_in_development' as never, { p_development_id: developmentId, p_bid_ids: [...bidIds], p_job_ids: [...jobIds] } as never)
  if (error) throw new Error(error.message)
  const r = (data ?? {}) as { bids?: number; jobs?: number }
  return { bids: Number(r.bids ?? 0), jobs: Number(r.jobs ?? 0) }
}

/** The way back: the piece carries no development again. */
export async function takeOutOfDevelopment(kind: 'bid' | 'job', id: string): Promise<void> {
  await setDevelopment(kind, id, null)
}

/** Put the bid back on the Unsent/Working board: the archive stamps cleared, nothing else. */
export async function putBackOnBoard(bidId: string): Promise<void> {
  const { data, error } = await supabase.from('bids').update({ working_board_archived_at: null, working_board_archived_by: null }).eq('id', bidId).select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error(REFUSED)
}

/** The way back: the bid hidden from the board again, with the stamps it had. */
export async function hideFromBoardAgain(bidId: string, archivedAt: string, archivedBy: string | null): Promise<void> {
  const { data, error } = await supabase.from('bids').update({ working_board_archived_at: archivedAt, working_board_archived_by: archivedBy }).eq('id', bidId).select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error(REFUSED)
}
