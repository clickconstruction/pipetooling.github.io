/**
 * Record the customer's answer to the with-and-without alternates from the Bid Board's per-GC
 * Won (alternates round two, v2.4196): one yes/no per offered alternate, then one write of
 * `accepted_alternate_tags` and `agreed_value` (the sent base plus what was taken). The Edit
 * Bid dialog writes the same two fields through its own checklist; the bid room's signature
 * will too. Reads the bid itself so the callers (table cell, phone card, Followup) stay thin.
 */
import { supabase } from '../supabase'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from './updateGuard'
import { agreedValueFromAcceptance, offeredAlternates, toggleAcceptedTag } from './alternateAcceptance'
import { formatCurrency } from '../format'

export type AskYesNo = (opts: { title?: string; message: string; confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>

export async function askAndRecordAcceptedAlternates(args: { bidId: string; gcName?: string | null; ask: AskYesNo }): Promise<{ asked: number; accepted: string[]; agreedValue: number | null } | { error: string } | null> {
  const { data: bid, error } = await supabase
    .from('bids')
    .select('id, outcome, bid_value, alternate_group_tags, accepted_alternate_tags, cover_letter_alt_texts')
    .eq('id', args.bidId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!bid) return null
  const alternates = offeredAlternates(bid as Parameters<typeof offeredAlternates>[0]).filter((a) => a.offered)
  if (alternates.length === 0) return null
  const who = args.gcName?.trim() || 'the customer'
  let accepted: string[] = []
  for (const a of alternates) {
    const yes = await args.ask({
      title: `Did ${who} take ${a.tag}?`,
      message: a.amount != null ? `The alternate adds $${formatCurrency(a.amount)} to the base bid.` : 'The letter never stamped a price for this alternate; its value will not be added.',
      confirmLabel: 'Yes, they took it',
      cancelLabel: 'No',
    })
    accepted = toggleAcceptedTag(accepted, a.tag, yes)
  }
  const agreedValue = agreedValueFromAcceptance(bid.bid_value != null ? Number(bid.bid_value) : null, alternates, accepted)
  const { data: rows, error: upErr } = await supabase
    .from('bids')
    .update({ accepted_alternate_tags: accepted, ...(agreedValue != null ? { agreed_value: agreedValue } : {}) })
    .eq('id', args.bidId)
    .select('id')
  if (upErr) return { error: upErr.message }
  if (bidUpdateRefused(rows)) return { error: BID_UPDATE_NOT_APPLIED_MESSAGE }
  return { asked: alternates.length, accepted, agreedValue }
}
