/**
 * Record the customer's answer to the with-and-without alternates from the Bid Board's per-GC
 * Won (alternates round two, v2.4211): one yes/no per offered alternate, then one write of
 * `accepted_alternate_tags` and `agreed_value` (the sent base plus what was taken). The Edit
 * Bid dialog writes the same two fields through its own checklist; the bid room's signature
 * will too. Reads the bid itself so the callers (table cell, phone card, Followup) stay thin.
 */
import { supabase } from '../supabase'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from './updateGuard'
import { agreedValueFromAcceptance, offeredAlternates, setAlternateAnswer, toggleAcceptedTag, type AlternateAnswer } from './alternateAcceptance'
import { formatCurrency } from '../format'

export type AskYesNo = (opts: { title?: string; message: string; confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>

export async function askAndRecordAcceptedAlternates(args: { bidId: string; gcName?: string | null; ask: AskYesNo }): Promise<{ asked: number; accepted: string[]; agreedValue: number | null } | { error: string } | null> {
  const { data: bid, error } = await supabase
    .from('bids')
    .select('id, outcome, bid_value, alternate_group_tags, accepted_alternate_tags, declined_alternate_tags, cover_letter_alt_texts')
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
  // v2.4225: a "No" is an answer — those alternates are declined, said rather than inferred.
  const declined = alternates.map((a) => a.tag).filter((t) => !accepted.some((x) => x.toLowerCase() === t.toLowerCase()))
  const { data: rows, error: upErr } = await supabase
    .from('bids')
    .update({ accepted_alternate_tags: accepted, declined_alternate_tags: declined, ...(agreedValue != null ? { agreed_value: agreedValue } : {}) })
    .eq('id', args.bidId)
    .select('id')
  if (upErr) return { error: upErr.message }
  if (bidUpdateRefused(rows)) return { error: BID_UPDATE_NOT_APPLIED_MESSAGE }
  return { asked: alternates.length, accepted, agreedValue }
}

/**
 * v2.4225: one alternate's answer from the Counts tab's alternate heading on a won bid —
 * Taken / Not taken / (undo → unanswered). Rewrites both lists and, when anything was sent,
 * the agreed value (the sent base plus what is now taken).
 */
export async function recordAlternateAnswer(args: { bidId: string; tag: string; answer: AlternateAnswer }): Promise<{ accepted: string[]; declined: string[]; agreedValue: number | null } | { error: string }> {
  const { data: bid, error } = await supabase
    .from('bids')
    .select('id, outcome, bid_value, alternate_group_tags, accepted_alternate_tags, declined_alternate_tags, cover_letter_alt_texts')
    .eq('id', args.bidId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!bid) return { error: 'Bid not found' }
  const b = bid as { bid_value: number | string | null; accepted_alternate_tags: string[] | null; declined_alternate_tags?: string[] | null }
  const next = setAlternateAnswer({ accepted: b.accepted_alternate_tags ?? [], declined: b.declined_alternate_tags ?? [] }, args.tag, args.answer)
  const alternates = offeredAlternates(bid as Parameters<typeof offeredAlternates>[0])
  const agreedValue = agreedValueFromAcceptance(b.bid_value != null ? Number(b.bid_value) : null, alternates, next.accepted)
  const { data: rows, error: upErr } = await supabase
    .from('bids')
    .update({ accepted_alternate_tags: next.accepted, declined_alternate_tags: next.declined, ...(agreedValue != null ? { agreed_value: agreedValue } : {}) })
    .eq('id', args.bidId)
    .select('id')
  if (upErr) return { error: upErr.message }
  if (bidUpdateRefused(rows)) return { error: BID_UPDATE_NOT_APPLIED_MESSAGE }
  return { ...next, agreedValue }
}
