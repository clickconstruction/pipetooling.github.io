/**
 * Record which option the GC took (v2.4728): the chosen version reads `won`, any other option
 * that read `won` goes back to unanswered, the chosen version becomes the bid's active version,
 * and the caller gets the option's sent value for the agreed value. The Won section of Edit
 * Bid is the door; the bid room's signature does the same server-side (sign-bid-room).
 */

import { supabase } from '../supabase'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { latestSendByVersion } from './versionSends'
import { letterOptionVersions, wonOptionWrites, type OptionVersion } from './wonOption'

export async function recordWonOption(args: { bidId: string; chosenVersionId: string }): Promise<{ sentValue: number | null } | { error: string }> {
  const [{ data: versions, error: vErr }, { data: sends }] = await Promise.all([
    supabase.from('bid_versions').select('id, name, sort_order, include_in_submission, is_alternate, outcome, customer_id').eq('bid_id', args.bidId),
    supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', args.bidId),
  ])
  if (vErr) return { error: vErr.message }
  const options = letterOptionVersions((versions ?? []) as OptionVersion[], null)
  if (!options.some((o) => o.id === args.chosenVersionId)) return { error: 'That option is not in the letter.' }
  const writes = wonOptionWrites(options, args.chosenVersionId)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  if (writes.cleared.length > 0) {
    const { error } = await supabase.from('bid_versions').update({ outcome: null, outcome_at: null }).in('id', writes.cleared)
    if (error) return { error: error.message }
  }
  if (writes.won.length > 0) {
    const { error } = await supabase.from('bid_versions').update({ outcome: 'won', outcome_at: today, loss_category: null }).in('id', writes.won)
    if (error) return { error: error.message }
  }
  const { error: bErr } = await supabase.from('bids').update({ selected_bid_version_id: args.chosenVersionId }).eq('id', args.bidId)
  if (bErr) return { error: bErr.message }
  const latest = latestSendByVersion((sends ?? []) as Parameters<typeof latestSendByVersion>[0])
  return { sentValue: latest[args.chosenVersionId]?.value ?? null }
}
