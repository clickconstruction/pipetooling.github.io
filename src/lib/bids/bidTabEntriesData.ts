/**
 * bid_tab_entries reads/writes (v2.2296, paste capture). Fail-soft by design:
 * until migration 20260825193140 is pushed the table doesn't exist — reads
 * report `available: false` (callers hide the ladder) and writes surface a
 * plain error message (callers toast; the summary columns still saved).
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { BidTabEntryDraft } from './bidTabPaste'

export type BidTabEntryRow = BidTabEntryDraft & { id: string }

export async function fetchBidTabEntries(
  bidId: string,
): Promise<{ available: boolean; entries: BidTabEntryRow[] }> {
  const { data, error } = await supabase
    .from('bid_tab_entries')
    .select('id, amount, alternate_amount, bidder_name, is_ours')
    .eq('bid_id', bidId)
    .order('amount', { ascending: true })
  if (error) return { available: false, entries: [] }
  return {
    available: true,
    entries: (data ?? []).map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      alternateAmount: r.alternate_amount != null ? Number(r.alternate_amount) : null,
      bidderName: r.bidder_name,
      isOurs: r.is_ours,
    })),
  }
}

/** Replace the bid's tab wholesale (a paste is the new truth; re-pastes overwrite). */
export async function replaceBidTabEntries(
  bidId: string,
  drafts: readonly BidTabEntryDraft[],
  createdBy: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await withSupabaseRetry(
      () => supabase.from('bid_tab_entries').delete().eq('bid_id', bidId),
      'clear bid tab entries',
    )
    if (drafts.length === 0) return { ok: true }
    await withSupabaseRetry(
      () =>
        supabase.from('bid_tab_entries').insert(
          drafts.map((d) => ({
            bid_id: bidId,
            amount: d.amount,
            alternate_amount: d.alternateAmount,
            bidder_name: d.bidderName,
            is_ours: d.isOurs,
            created_by: createdBy,
          })),
        ),
      'save bid tab entries',
    )
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save the tab' }
  }
}

/** Clear the full tab alongside a summary "Remove bid tab" (quiet data fix). */
export async function clearBidTabEntries(bidId: string): Promise<void> {
  await supabase.from('bid_tab_entries').delete().eq('bid_id', bidId)
}
