/**
 * The writes behind the bid's Files window (punch list #306, PR 7): a pasted link saved to the column the bid's form
 * writes, the plans link the robot reads, and the project folder made by the app. The folder is made by the
 * `bid-photos` function's `make`, which names it by the office's bid pattern, puts it in the company's shared Drive
 * with the photo folder inside, and writes `bids.drive_link` itself. A write the database lets through and applies
 * to no row (a training account, a bid deleted meanwhile) is a refusal, said as one.
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import type { BidPhotoFolderState } from './bidPhotos'
import type { PastedLinkKind } from './bidFilesWindow'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from './updateGuard'

export interface BidFilesIo {
  /** Write one pasted link to its column on the bid. */
  saveLink: (bidId: string, kind: PastedLinkKind, value: string) => Promise<void>
  /** Write the plans link the robot reads, when the plan sets field names a set for it. */
  savePlansLink: (bidId: string, link: string) => Promise<void>
  /** Make the bid's project folder in the shared Drive. Answers with the folder's name. */
  makeFolder: (bidId: string) => Promise<{ projectName: string | null }>
}

async function updateBid(bidId: string, patch: { drive_link?: string; count_tooling_plans_link?: string; bid_submission_link?: string; plans_link?: string | null }): Promise<void> {
  const { data: rows, error } = await supabase.from('bids').update(patch).eq('id', bidId).select('id')
  if (error) throw error
  if (bidUpdateRefused(rows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
}

export async function saveBidFileLink(bidId: string, kind: PastedLinkKind, value: string): Promise<void> {
  if (kind === 'folder') return updateBid(bidId, { drive_link: value })
  if (kind === 'count') return updateBid(bidId, { count_tooling_plans_link: value })
  return updateBid(bidId, { bid_submission_link: value })
}

export async function saveBidPlansLink(bidId: string, link: string): Promise<void> {
  return updateBid(bidId, { plans_link: link.trim() || null })
}

export async function makeBidProjectFolder(bidId: string): Promise<{ projectName: string | null }> {
  const r = (await supabase.functions.invoke('bid-photos', { body: { action: 'make', bid_id: bidId } })) as FnResult
  const problem = await fnProblem(r, 'The folder was not made.')
  if (problem) throw new Error(problem)
  const folder = ((r.data ?? {}) as { folder?: BidPhotoFolderState }).folder ?? null
  return { projectName: folder?.projectName ?? null }
}

export const supabaseBidFilesIo: BidFilesIo = { saveLink: saveBidFileLink, savePlansLink: saveBidPlansLink, makeFolder: makeBidProjectFolder }
