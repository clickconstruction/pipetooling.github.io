/**
 * The customer's answer to a with-and-without alternate (alternates round two, v2.4197).
 * `bids.alternate_group_tags` says which count-row groups were offered with and without;
 * `bids.accepted_alternate_tags` says which of them the customer TOOK, written by the Won
 * dialog, the per-GC packet's Won, or the bid room's signature. `bids.agreed_value` is the
 * sent base plus the accepted alternates; `bids.bid_value` stays what was sent. Once the bid
 * is won, a declined alternate's rows stay on the bid and leave the job's numbers through
 * `jobScopeRows`. Pure; no React, no DB.
 */
import { isAlternateRow, normalizeGroupTag } from './countSheet'
import { addAlternateGroupKey } from './coverLetterAddAlternates'
import { parseCoverLetterAltTexts, type CoverLetterAltTexts } from './coverLetterSamePage'

export type AcceptanceBid = {
  outcome: string | null
  alternate_group_tags: string[] | null
  accepted_alternate_tags: string[] | null
}

export type OfferedAlternate = {
  tag: string
  /** `group:<normalized tag>` — the key in cover_letter_alt_texts.groups. */
  key: string
  /** The add-on the letter last stamped (null when never priced or never sent). */
  amount: number | null
  /** False when the estimator unticked Offer on the letter. */
  offered: boolean
  accepted: boolean
}

/** Won, or a job already opened from the bid (the trigger's 'started_or_complete'). */
export function bidIsWon(outcome: string | null | undefined): boolean {
  return outcome === 'won' || outcome === 'started_or_complete'
}

export function isAcceptedTag(tag: string, accepted: readonly string[] | null | undefined): boolean {
  const key = normalizeGroupTag(tag)
  return key !== '' && (accepted ?? []).some((t) => normalizeGroupTag(t) === key)
}

/** The bid's alternates with what the letter stamped and whether the customer took each. */
export function offeredAlternates(
  bid: AcceptanceBid & { cover_letter_alt_texts?: unknown },
  texts?: CoverLetterAltTexts,
): OfferedAlternate[] {
  const t = texts ?? parseCoverLetterAltTexts(bid.cover_letter_alt_texts)
  return (bid.alternate_group_tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '')
    .map((tag) => {
      const key = addAlternateGroupKey(tag)
      const g = t.groups?.[key]
      return { tag, key, amount: g?.amount ?? null, offered: g?.offered !== false, accepted: isAcceptedTag(tag, bid.accepted_alternate_tags) }
    })
}

/** True once the bid is won and this row sits in an alternate the customer did not take. */
export function isDeclinedRow(row: { group_tag: string | null }, bid: AcceptanceBid): boolean {
  if (!bidIsWon(bid.outcome)) return false
  if (!isAlternateRow(row, bid.alternate_group_tags ?? [])) return false
  return !isAcceptedTag(row.group_tag ?? '', bid.accepted_alternate_tags)
}

/** The rows that are the JOB: every row until the bid is won, then the base plus the accepted alternates. */
export function jobScopeRows<T extends { group_tag: string | null }>(rows: readonly T[], bid: AcceptanceBid | null | undefined): T[] {
  if (!bid || !bidIsWon(bid.outcome)) return [...rows]
  return rows.filter((r) => !isDeclinedRow(r, bid))
}

/** The sent value plus what the accepted alternates add; null while nothing was sent. */
export function agreedValueFromAcceptance(bidValue: number | null, alternates: readonly OfferedAlternate[], accepted: readonly string[]): number | null {
  if (bidValue == null || !Number.isFinite(bidValue)) return null
  const add = alternates.filter((a) => isAcceptedTag(a.tag, accepted)).reduce((s, a) => s + (a.amount ?? 0), 0)
  return Math.round((bidValue + add) * 100) / 100
}

/** Add or remove one tag, keeping spelling and order; case-insensitive. */
export function toggleAcceptedTag(accepted: readonly string[], tag: string, on: boolean): string[] {
  const key = normalizeGroupTag(tag)
  const rest = accepted.filter((t) => normalizeGroupTag(t) !== key)
  return on && key ? [...rest, tag.trim()] : rest
}

/** "with Break room" · "with Break room and Annex" · "without the alternate" · "" (no alternates). */
export function acceptanceWords(bid: AcceptanceBid): string {
  const offered = (bid.alternate_group_tags ?? []).filter((t) => t.trim())
  if (offered.length === 0 || !bidIsWon(bid.outcome)) return ''
  const took = offered.filter((t) => isAcceptedTag(t, bid.accepted_alternate_tags))
  if (took.length === 0) return offered.length === 1 ? 'without the alternate' : 'without the alternates'
  return 'with ' + (took.length === 1 ? took[0] : took.slice(0, -1).join(', ') + ' and ' + took[took.length - 1])
}
