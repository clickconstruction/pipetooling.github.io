import { supabase } from '../supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { LIEN_WAIVER_SIGNER_ROLES, lienWaiverSignerChoices, type LienWaiverSigner, type LienWaiverSignerRow } from '../jobs/lienWaiverSigners'
import type { LienWaiverFields, LienWaiverFormType } from '../jobsDocuments/lienWaiverRelease'
import { bidLienReleaseInsert, type BidLienReleaseRow } from './bidLienWaiver'

/**
 * Bids → Lien Release's reads and writes (v2.5958): the waivers recorded on a bid, with the names of
 * the screens they were signed on; the leaders who sign; a waiver minted for a paper; a print or a copy
 * stamped as sent. The database lets an estimator touch a bid's waivers only, and holds his row to the
 * paper he made until the leader's code signs it (migration 20261027020000).
 */

export type BidLienReleaseHistory = { rows: BidLienReleaseRow[]; deviceNames: Record<string, string> }

export async function loadBidLienReleases(bidId: string): Promise<BidLienReleaseHistory> {
  const data = await withSupabaseRetry(
    async () => await supabase.from('job_lien_releases').select('*').eq('bid_id', bidId).order('created_at', { ascending: false }),
    'load bid lien releases',
  )
  const rows = (data ?? []) as unknown as BidLienReleaseRow[]
  const ids = [...new Set(rows.map((r) => r.signed_on_device_of).filter((id): id is string => !!id))]
  const deviceNames: Record<string, string> = {}
  if (ids.length > 0) {
    try {
      const { data: users } = await supabase.from('users').select('id, name').in('id', ids)
      for (const u of (users ?? []) as { id: string; name: string | null }[]) {
        const name = (u.name ?? '').trim()
        if (name) deviceNames[u.id] = name
      }
    } catch {
      // The audit line drops "on Wendi's screen"; the record still names the device by id.
    }
  }
  return { rows, deviceNames }
}

/** The leaders who sign a waiver (masters, then devs), named the waiver's way. Empty when the read fails. */
export async function loadBidLienWaiverLeaders(): Promise<LienWaiverSigner[]> {
  try {
    const { data } = await supabase.from('users').select('id, name, notes, role, archived_at').in('role', [...LIEN_WAIVER_SIGNER_ROLES])
    return lienWaiverSignerChoices((data ?? []) as LienWaiverSignerRow[], null)
  } catch {
    return []
  }
}

export type MintBidLienReleaseResult = { ok: true; row: BidLienReleaseRow } | { ok: false; message: string }

/** Records this paper on the bid: issued, unsigned, the boxes as they print. */
export async function mintBidLienRelease(args: { bidId: string; formType: LienWaiverFormType; fields: LienWaiverFields; userId: string }): Promise<MintBidLienReleaseResult> {
  try {
    const row = await withSupabaseRetry(
      async () =>
        await supabase
          .from('job_lien_releases')
          .insert(bidLienReleaseInsert(args.bidId, args.formType, args.fields, args.userId, new Date().toISOString()) as never)
          .select('*')
          .single(),
      'mint bid lien release',
    )
    return { ok: true, row: row as unknown as BidLienReleaseRow }
  } catch (e) {
    const message = formatErrorMessage(e)
    return { ok: false, message: /violates row-level security|permission denied|training mode/i.test(message) ? 'This waiver could not be recorded on the bid from this sign-in.' : 'Could not record the waiver on the bid. Try again.' }
  }
}

/** A print or a copy for email went out: the waiver reads sent, once (best effort; the sent copy is filed apart). */
export async function stampBidLienReleaseSent(releaseId: string, userId: string): Promise<void> {
  try {
    await supabase
      .from('job_lien_releases')
      .update({ sent_to_customer_at: new Date().toISOString(), sent_channel: 'manual', sent_by: userId })
      .eq('id', releaseId)
      .is('sent_to_customer_at', null)
  } catch {
    // The history chip reads "made" instead of "sent"; nothing else hangs on it.
  }
}
