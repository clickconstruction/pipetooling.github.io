/**
 * The office side of a paid claim (punch list #129, v2.5650). A customer's word that they paid (`job_payment_promises`
 * kind `paid_claim`, v2.5648) does work at two moments: when a deposit lands, the Accounts Receivable allocation names
 * the claim's job; and when nothing lands in `STALE_AFTER_DAYS`, the claim comes back to the person who heard it, as
 * a Needs you line and amber on the money line, and the office leaves the row alone. Pure: the read is
 * `list_paid_claims` (`paidClaimsIo.ts`), one row per live claim with its job, its customer and what landed on the
 * job on or after the day they named.
 */
import type { PaidMethod, PromiseChannel } from './paymentPromises'
import { PAID_METHOD_WORDS } from './paymentPromises'

/** Days after the day they named with nothing landed before the claim comes back to who heard it. */
export const STALE_AFTER_DAYS = 7

export type PaidClaim = {
  id: string
  jobId: string
  /** The job's number as the board shows it; '' when it has none. */
  jobNumber: string
  jobName: string
  jobStatus: string | null
  /** The bid the job came from, for the estimator's door. */
  bidId: string | null
  customerId: string | null
  customerName: string | null
  payerCustomerId: string | null
  /** The day they say they paid. */
  paidYmd: string
  method: PaidMethod | null
  /** The amount they say, or null for all of it. */
  amount: number | null
  saidBy: string | null
  heardById: string | null
  heardByName: string | null
  channel: PromiseChannel | null
  note: string | null
  createdAt: string
  /** What landed on the job on or after the day they named: the sum, and the latest day. */
  landedSince: number
  landedOn: string | null
}

const YMD = /^\d{4}-\d{2}-\d{2}$/
const METHODS = new Set(Object.keys(PAID_METHOD_WORDS))
const CHANNELS = new Set(['phone', 'text', 'email', 'in_person', 'portal', 'backfill'])

/** Defensive parse of `list_paid_claims`: null on a refused read or a shape that is not it. */
export function parsePaidClaimsRpc(raw: unknown): PaidClaim[] | null {
  if (!Array.isArray(raw)) return null
  const out: PaidClaim[] = []
  for (const v of raw) {
    if (v == null || typeof v !== 'object') continue
    const r = v as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.jobId !== 'string' || typeof r.paidYmd !== 'string' || !YMD.test(r.paidYmd) || typeof r.createdAt !== 'string') continue
    const amount = r.amount == null ? null : Number(r.amount)
    out.push({
      id: r.id,
      jobId: r.jobId,
      jobNumber: typeof r.jobNumber === 'string' ? r.jobNumber : '',
      jobName: typeof r.jobName === 'string' ? r.jobName : '',
      jobStatus: typeof r.jobStatus === 'string' ? r.jobStatus : null,
      bidId: typeof r.bidId === 'string' ? r.bidId : null,
      customerId: typeof r.customerId === 'string' ? r.customerId : null,
      customerName: typeof r.customerName === 'string' && r.customerName.trim() ? r.customerName.trim() : null,
      payerCustomerId: typeof r.payerCustomerId === 'string' ? r.payerCustomerId : null,
      paidYmd: r.paidYmd,
      method: typeof r.method === 'string' && METHODS.has(r.method) ? (r.method as PaidMethod) : null,
      amount: amount != null && Number.isFinite(amount) && amount > 0 ? amount : null,
      saidBy: typeof r.saidBy === 'string' && r.saidBy.trim() ? r.saidBy.trim() : null,
      heardById: typeof r.heardById === 'string' ? r.heardById : null,
      heardByName: typeof r.heardByName === 'string' && r.heardByName.trim() ? r.heardByName.trim() : null,
      channel: typeof r.channel === 'string' && CHANNELS.has(r.channel) ? (r.channel as PromiseChannel) : null,
      note: typeof r.note === 'string' && r.note.trim() ? r.note.trim() : null,
      createdAt: r.createdAt,
      landedSince: Number.isFinite(Number(r.landedSince)) ? Number(r.landedSince) : 0,
      landedOn: typeof r.landedOn === 'string' && YMD.test(r.landedOn) ? r.landedOn : null,
    })
  }
  return out
}

const DAY_MS = 86_400_000
const at = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))

/** Days from the day they named to today; negative before it. */
export function daysSinceClaim(claim: Pick<PaidClaim, 'paidYmd'>, todayYmd: string): number {
  return Math.round((at(todayYmd) - at(claim.paidYmd)) / DAY_MS)
}

/** Nothing landed on the job since the day they named. */
export function claimOpen(claim: Pick<PaidClaim, 'landedSince'>): boolean {
  return !(claim.landedSince > 0)
}

/** Stale: open, and `STALE_AFTER_DAYS` or more since the day they named. */
export function claimStale(claim: Pick<PaidClaim, 'paidYmd' | 'landedSince'>, todayYmd: string, after = STALE_AFTER_DAYS): boolean {
  return claimOpen(claim) && daysSinceClaim(claim, todayYmd) >= after
}

/** The stale claims among a person's, the oldest day first. */
export function staleClaims(claims: readonly PaidClaim[], todayYmd: string, after = STALE_AFTER_DAYS): PaidClaim[] {
  return claims.filter((c) => claimStale(c, todayYmd, after)).sort((a, b) => a.paidYmd.localeCompare(b.paidYmd) || a.createdAt.localeCompare(b.createdAt))
}

/** The stale claims the signed-in person heard: the Needs you line is theirs, not the office's. */
export function myStaleClaims(claims: readonly PaidClaim[], userId: string | null | undefined, todayYmd: string, after = STALE_AFTER_DAYS): PaidClaim[] {
  if (!userId) return []
  return staleClaims(claims, todayYmd, after).filter((c) => c.heardById === userId)
}

/** "a check in the mail", as a claim says it. */
export function claimHow(claim: Pick<PaidClaim, 'method'>): string {
  return claim.method ? PAID_METHOD_WORDS[claim.method] : 'not sure how'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
function monthDay(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`
}

/** "nothing landed in 9 days" — the amber on the row and the line. */
export function staleWords(claim: Pick<PaidClaim, 'paidYmd'>, todayYmd: string): string {
  const days = daysSinceClaim(claim, todayYmd)
  return `nothing landed in ${days === 1 ? '1 day' : `${days} days`}`
}

/** The Needs you line's words: "J1032 Whitfield repipe · Dana said a check went out Oct 20 · nothing landed in 9 days". */
export function staleClaimLine(claim: PaidClaim, todayYmd: string): string {
  const who = claim.saidBy || claim.customerName || 'They'
  const said = claim.method === 'check_mailed' ? `${who} said a check went out ${monthDay(claim.paidYmd)}` : `${who} said they paid ${monthDay(claim.paidYmd)} · ${claimHow(claim)}`
  const job = `${claim.jobNumber ? `J${claim.jobNumber} ` : ''}${claim.jobName}`.trim()
  return `${job} · ${said} · ${staleWords(claim, todayYmd)}`
}

/** The Needs you card's count words: "1 to ask about". */
export function staleCountWords(n: number): string {
  return `${n} to ask about`
}

/**
 * The deposit a claim fits (the AR allocation's suggestion): the claim is open, the deposit's amount is the claim's
 * amount, or the job's open money when the claim names none, within a dollar, and the deposit came on or after the
 * day they named. The customer's name in the counterparty is a second sign, never a requirement: banks write what
 * they write.
 */
export function claimFitsDeposit(
  claim: Pick<PaidClaim, 'amount' | 'paidYmd' | 'landedSince' | 'customerName'>,
  deposit: { amount: number; ymd: string | null; counterparty: string | null },
  jobOpen: number | null,
): { fits: boolean; nameToo: boolean } {
  if (!claimOpen(claim)) return { fits: false, nameToo: false }
  const expected = claim.amount ?? jobOpen
  const amountFits = expected != null && Math.abs(expected - deposit.amount) < 1
  const dayFits = !deposit.ymd || deposit.ymd >= claim.paidYmd
  const last = (claim.customerName ?? '').trim().split(/\s+/).pop()?.toLowerCase() ?? ''
  const nameToo = last.length > 2 && (deposit.counterparty ?? '').toLowerCase().includes(last)
  return { fits: amountFits && dayFits, nameToo }
}

/** "Theo wrote Oct 21: Dana says she paid, a check in the mail Oct 20" — the suggestion's words beside the deposit. */
export function claimSuggestionWords(claim: PaidClaim): string {
  const who = claim.saidBy || claim.customerName || 'They'
  const wrote = claim.heardByName ? `${claim.heardByName} wrote ${monthDay(claim.createdAt.slice(0, 10))}: ` : ''
  return `${wrote}${who} ${who === 'They' ? 'say' : 'says'} they paid, ${claimHow(claim)} ${monthDay(claim.paidYmd)}${claim.note ? ` · “${claim.note}”` : ''}`
}
