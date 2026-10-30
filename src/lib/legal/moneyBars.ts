import { settlementFloorDollars, type LegalSettlementFloor } from '../../../supabase/functions/_shared/legalSettlement'
import { formatLegalMoney } from './legalPacket'
import type { OfferStatus } from './legalOffers'

/**
 * The Legal desk's money, drawn (v2.6105, punch list #214, PR 2). *How much?* and *What's left for
 * us?* are a figure each with a sentence under it; this kernel turns the same facts into bars, so
 * the retainage has one place (inside the bill it sits on, or added once past the bills), the
 * claim is a length, every offer is a mark on that length, and the firm's cut is a stretch taken
 * off the end. Pure: it reads `LegalWorth`, the open bills, the Offers log and the floor, and
 * returns fractions of a width; the component draws them.
 *
 * - **On the bills**: one segment per open bill, oldest first, the whole bar the open balance.
 *   Under a job whose sent bills already carry retainage (#213, `retainageOnBillsByJob`) a bracket
 *   says so — the bracket is the job's, not one bill's, because the kernel that found it knows the
 *   job's bills as a set.
 * - **The claim**: drawn only when it says something the bills bar does not — retainage no bill
 *   asks for yet, an offer, or a floor. The bills as one block, the added retainage after it, and,
 *   when an offer or the floor reaches past the claim on record, a hatched stretch to the largest
 *   of them, named as such: the desk never invents a figure, it shows that one was asked for.
 * - **What's left for us**: keep · the firm's cut · the filing cost, on the claim; and on the bills
 *   alone when the claim is larger, because the firm's cut on a disputed claim is a different
 *   decision from its cut on an undisputed balance.
 */

export type MoneyBarBill = { key: string; jobId: string; jobLabel: string; ymd: string | null; text: string; open: number }
export type MoneyBarOffer = { key: string; direction: 'made' | 'received'; amount: number; status: OfferStatus; ymd: string; expiresOn: string | null }

export type MoneyBarsInput = {
  bills: ReadonlyArray<MoneyBarBill>
  /** By job id: the retainage that job's sent bills already carry (v2.6103); drawn as a bracket under its bills. */
  retainageOnBillsByJob: ReadonlyMap<string, number>
  retainageAdded: number
  balance: number
  claim: number
  contingencyPct: number
  fee: number
  filingCost: number
  net: number
  offers: ReadonlyArray<MoneyBarOffer>
  floor: LegalSettlementFloor | null
}

export type MoneyBarSegmentKind = 'bill' | 'bills' | 'retainage' | 'beyond' | 'keep' | 'fee' | 'filing' | 'short'
export type MoneyBarSegment = { key: string; kind: MoneyBarSegmentKind; label: string; title: string; amount: number; fraction: number }
export type MoneyBarBracket = { key: string; label: string; amount: number; fromFraction: number; toFraction: number }
export type MoneyBarMark = { key: string; kind: 'theirs' | 'ours' | 'floor'; label: string; amount: number; fraction: number; row: 0 | 1 }
export type MoneyBarKey = 'bills' | 'claim' | 'left_claim' | 'left_bills'
export type MoneyBar = { key: MoneyBarKey; caption: string; total: number; segments: MoneyBarSegment[]; brackets: MoneyBarBracket[]; marks: MoneyBarMark[] }

export type MoneyBars = { bars: MoneyBar[]; words: string }

const round2 = (n: number): number => Math.round(n * 100) / 100
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2026-07-09` → `Jul 9`; '' for anything else. A day, never an instant, so no zone is read. */
export function moneyBarDayWords(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ''
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  return m >= 1 && m <= 12 ? `${MONTH[m - 1]} ${d}` : ''
}

/** Offers the bar marks: made or received, still standing — open, countered or accepted; withdrawn and expired ones are history. */
export function offerStands(status: OfferStatus): boolean {
  return status === 'open' || status === 'countered' || status === 'accepted'
}

function frac(amount: number, scale: number): number {
  return scale > 0 ? Math.max(0, Math.min(1, amount / scale)) : 0
}

/** Marks at their amounts, alternating rows when two labels would sit within 18% of the width of each other. */
function placeMarks(marks: Array<Omit<MoneyBarMark, 'row'>>): MoneyBarMark[] {
  const sorted = marks.slice().sort((a, b) => a.fraction - b.fraction)
  const out: MoneyBarMark[] = []
  for (const m of sorted) {
    const prev = out[out.length - 1]
    const row: 0 | 1 = prev && m.fraction - prev.fraction < 0.18 ? (prev.row === 0 ? 1 : 0) : 0
    out.push({ ...m, row })
  }
  return out
}

export function moneyBars(input: MoneyBarsInput): MoneyBars {
  const bars: MoneyBar[] = []
  const bills = input.bills.filter((b) => b.open > 0.004).slice().sort((a, b) => (a.ymd ?? '9999').localeCompare(b.ymd ?? '9999') || a.key.localeCompare(b.key))
  const balance = round2(input.balance)

  // --- On the bills -------------------------------------------------------
  const billSegments: MoneyBarSegment[] = bills.map((b) => ({
    key: b.key,
    kind: 'bill',
    label: `${b.jobLabel}${moneyBarDayWords(b.ymd) ? ` · ${moneyBarDayWords(b.ymd)}` : ''}`,
    title: `${b.jobLabel} · ${b.text} · ${formatLegalMoney(b.open)} open`,
    amount: round2(b.open),
    fraction: frac(b.open, balance),
  }))
  const billsTotal = round2(bills.reduce((s, b) => s + b.open, 0))
  if (balance > 0.004 && billsTotal < balance - 0.004) {
    // A job with no sent bill owes its remainder (a shell), or the rows do not reach the balance: the rest is one quiet block.
    billSegments.push({ key: 'no-bill', kind: 'bills', label: 'on no bill yet', title: `${formatLegalMoney(round2(balance - billsTotal))} owed on no sent bill`, amount: round2(balance - billsTotal), fraction: frac(balance - billsTotal, balance) })
  }
  const brackets: MoneyBarBracket[] = []
  let at = 0
  const jobStart = new Map<string, number>()
  const jobSpan = new Map<string, number>()
  for (const s of billSegments) {
    const b = bills.find((x) => x.key === s.key)
    if (b) {
      if (!jobStart.has(b.jobId)) jobStart.set(b.jobId, at)
      jobSpan.set(b.jobId, (jobSpan.get(b.jobId) ?? 0) + s.fraction)
    }
    at += s.fraction
  }
  for (const [jobId, inside] of input.retainageOnBillsByJob) {
    if (inside <= 0.004 || !jobStart.has(jobId)) continue
    const from = jobStart.get(jobId) ?? 0
    const span = jobSpan.get(jobId) ?? 0
    const to = Math.min(from + span, from + frac(inside, balance))
    const label = bills.find((b) => b.jobId === jobId)?.jobLabel ?? jobId
    brackets.push({ key: `ret:${jobId}`, label: `retainage ${formatLegalMoney(round2(inside))} inside ${label}'s bills`, amount: round2(inside), fromFraction: from, toFraction: to })
  }
  if (balance > 0.004) {
    bars.push({
      key: 'bills',
      caption: `On the bills · ${bills.length === 1 ? 'one open bill' : `${bills.length} open bills`}`,
      total: balance,
      segments: billSegments,
      brackets,
      marks: [],
    })
  }

  // --- The claim ----------------------------------------------------------
  const claim = round2(input.claim)
  const added = round2(Math.max(0, input.retainageAdded))
  const standing = input.offers.filter((o) => offerStands(o.status) && o.amount > 0.004)
  const floorDollars = input.floor ? settlementFloorDollars(input.floor, balance) : null
  const scale = round2(Math.max(claim, ...standing.map((o) => o.amount), floorDollars ?? 0))
  const claimSays = added > 0.004 || standing.length > 0 || (floorDollars != null && floorDollars > 0.004)
  if (claimSays && scale > 0.004) {
    const segments: MoneyBarSegment[] = []
    if (balance > 0.004) segments.push({ key: 'bills', kind: 'bills', label: `the bills ${formatLegalMoney(balance)}`, title: `The open bills, ${formatLegalMoney(balance)}`, amount: balance, fraction: frac(balance, scale) })
    if (added > 0.004) segments.push({ key: 'retainage', kind: 'retainage', label: `retainage ${formatLegalMoney(added)}`, title: `Retainage held that no sent bill asks for yet, ${formatLegalMoney(added)}: the claim adds it once`, amount: added, fraction: frac(added, scale) })
    const beyond = round2(scale - claim)
    if (beyond > 0.004) segments.push({ key: 'beyond', kind: 'beyond', label: `asked beyond the claim on record · ${formatLegalMoney(beyond)}`, title: `An offer or the floor reaches ${formatLegalMoney(beyond)} past the claim the desk can count (${formatLegalMoney(claim)}); what it covers is in the narrative, not in the bills`, amount: beyond, fraction: frac(beyond, scale) })
    const marks = placeMarks([
      ...standing.map((o) => ({
        key: o.key,
        kind: (o.direction === 'received' ? 'theirs' : 'ours') as MoneyBarMark['kind'],
        label: o.direction === 'received' ? `their offer${moneyBarDayWords(o.ymd) ? ` · ${moneyBarDayWords(o.ymd)}` : ''}` : `our offer${o.expiresOn && moneyBarDayWords(o.expiresOn) ? ` · to ${moneyBarDayWords(o.expiresOn)}` : ''}`,
        amount: round2(o.amount),
        fraction: frac(o.amount, scale),
      })),
      ...(floorDollars != null && floorDollars > 0.004 ? [{ key: 'floor', kind: 'floor' as const, label: 'our floor', amount: round2(floorDollars), fraction: frac(floorDollars, scale) }] : []),
    ])
    bars.push({ key: 'claim', caption: `The claim · ${formatLegalMoney(claim)}${beyond > 0.004 ? ` · asked ${formatLegalMoney(scale)}` : ''}`, total: scale, segments, brackets: [], marks })
  }

  // --- What's left for us -------------------------------------------------
  const left = (key: MoneyBarKey, caption: string, total: number, feeAmt: number): MoneyBar => {
    const filing = round2(input.filingCost)
    const keep = round2(total - feeAmt - filing)
    const segments: MoneyBarSegment[] = []
    if (keep > 0.004) segments.push({ key: 'keep', kind: 'keep', label: `we keep ${formatLegalMoney(keep)}`, title: `${formatLegalMoney(keep)} left after the firm's cut and the filing cost`, amount: keep, fraction: frac(keep, total) })
    if (feeAmt > 0.004) segments.push({ key: 'fee', kind: 'fee', label: `firm ${Math.round(input.contingencyPct * 100)}% · ${formatLegalMoney(round2(feeAmt))}`, title: `The firm's contingency, ${Math.round(input.contingencyPct * 100)}% of ${formatLegalMoney(total)}`, amount: round2(feeAmt), fraction: frac(feeAmt, total) })
    if (filing > 0.004) segments.push({ key: 'filing', kind: 'filing', label: `filing ${formatLegalMoney(filing)}`, title: `The filing cost, ${formatLegalMoney(filing)}`, amount: filing, fraction: frac(filing, total) })
    if (keep < -0.004) segments.push({ key: 'short', kind: 'short', label: `${formatLegalMoney(-keep)} short`, title: `The firm's cut and the filing cost exceed the figure by ${formatLegalMoney(-keep)}`, amount: round2(-keep), fraction: frac(-keep, total) })
    return { key, caption: `${caption} · ${keep > 0.004 ? `${formatLegalMoney(keep)} left` : keep < -0.004 ? `${formatLegalMoney(-keep)} short` : 'nothing left'}`, total, segments, brackets: [], marks: [] }
  }
  if (claim > 0.004) bars.push(left('left_claim', claim > balance + 0.004 ? 'What’s left, on the claim' : 'What’s left for us', claim, round2(input.fee)))
  if (claim > balance + 0.004 && balance > 0.004) bars.push(left('left_bills', 'What’s left, on the bills alone', balance, round2(balance * input.contingencyPct)))

  // --- One sentence ---------------------------------------------------------
  const parts: string[] = []
  parts.push(bills.length === 0 ? `${formatLegalMoney(balance)} owed on no sent bill.` : `${bills.length === 1 ? 'One open bill' : `${bills.length} open bills`}, ${formatLegalMoney(balance)}.`)
  if (added > 0.004) parts.push(`The claim adds ${formatLegalMoney(added)} of retainage no bill asks for yet.`)
  const theirs = standing.filter((o) => o.direction === 'received').sort((a, b) => b.ymd.localeCompare(a.ymd))[0]
  if (theirs) parts.push(`Their offer of ${formatLegalMoney(theirs.amount)} ${theirs.amount >= claim - 0.004 ? 'covers the claim on record' : theirs.amount >= balance - 0.004 ? 'covers the bills' : `leaves ${formatLegalMoney(round2(claim - theirs.amount))} of the claim`}.`)
  return { bars, words: parts.join(' ') }
}
