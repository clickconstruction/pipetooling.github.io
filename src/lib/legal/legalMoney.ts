/**
 * Money that foots (punch list #85, item 5). The small rules every reader of a
 * legal packet shares, so the office desk, the firm's page and both prints add
 * up the same way:
 *
 *   - the statement of account with a running balance, whose last line is the
 *     Balance by construction (`legalRunningLedger`),
 *   - which matter entries are the firm's fees and costs the debtor owes, and
 *     which is the firm's own contingency on a recovery the office applied
 *     (`firmFeeEntries`, `isContingencyEntry`, `firmDemand`),
 *   - the plain words a ledger line uses for how a bill went out and how a
 *     payment came in (`invoiceSentWords`, `paymentHowWords`).
 *
 * Pure: no React, no supabase.
 */
import type { LegalEntryRow } from './legalMatters'
import { formatLegalMoney } from './legalPacket'
import { instrumentWord } from '../jobs/billsAndPayments'

const round2 = (n: number): number => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// The running balance
// ---------------------------------------------------------------------------

/** A ledger row with the balance after it. The rows arrive in the packet's own order (by date). */
export function legalRunningLedger<E extends { amount: number }>(ledger: ReadonlyArray<E>): Array<E & { running: number }> {
  let running = 0
  return ledger.map((e) => {
    running = round2(running + e.amount)
    return { ...e, running }
  })
}

// ---------------------------------------------------------------------------
// The firm's fees and costs
// ---------------------------------------------------------------------------

/** The meta Mark applied writes on the contingency row, so every reader can leave it out of what the debtor owes. */
export const CONTINGENCY_ENTRY_META = { contingency: true } as const

/** The body Mark applied writes on that row: `Contingency 33% of $3,000.00`. */
export function contingencyEntryBody(pct: number, amountWords: string): string {
  return `Contingency ${Math.round(pct * 100)}% of ${amountWords}`
}

/**
 * The firm's own share of a recovery the office applied. Tagged rows say so in their meta; rows the
 * office wrote before the tag (v2.4615 and earlier) are caught by the body Mark applied always wrote.
 */
export function isContingencyEntry(e: Pick<LegalEntryRow, 'kind' | 'body' | 'meta' | 'via_portal'>): boolean {
  const m = e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : {}
  if (m.contingency === true) return true
  return e.kind === 'cost' && !e.via_portal && /^Contingency \d+% of /.test(e.body ?? '')
}

/** The firm's fees and costs the debtor owes: every fee and cost entry except the contingency rows. */
export function firmFeeEntries<E extends Pick<LegalEntryRow, 'kind' | 'body' | 'meta' | 'via_portal'> & { voided_at?: string | null }>(entries: ReadonlyArray<E>): E[] {
  // An undone fee or cost (#85 item 18) is out of every total: the demand, the print, the desk and Needs You.
  return firmFeeRows(entries).filter((e) => !e.voided_at)
}

/** The fee and cost rows a table lists, the undone ones included (struck through, with their reason); never the contingency. */
export function firmFeeRows<E extends Pick<LegalEntryRow, 'kind' | 'body' | 'meta' | 'via_portal'>>(entries: ReadonlyArray<E>): E[] {
  return entries.filter((e) => (e.kind === 'fee' || e.kind === 'cost') && !isContingencyEntry(e))
}

/** The contingency rows, shown on their own line under the fees so the firm still sees what it earned. */
export function contingencyEntries<E extends Pick<LegalEntryRow, 'kind' | 'body' | 'meta' | 'via_portal'>>(entries: ReadonlyArray<E>): E[] {
  return entries.filter((e) => (e.kind === 'fee' || e.kind === 'cost') && isContingencyEntry(e))
}

/**
 * The claim + the firm's fees and costs = the demand, never below 0 (an overpaid account owes nothing; its credit is a
 * ledger line). One sum for the matter card, the desk and the print. The first argument was the open balance until
 * v2.6696 (punch list #171, the owner's call of 2026-11-08): the firm's callers now pass `worth.claim`, the balance
 * plus the retainage no bill asks for and the office's typed lines, so the firm's demand and the desk's *How much?*
 * read one figure. With nothing past the bills the claim is the balance, and nothing changes.
 */
export function firmDemand(claim: number, entries: ReadonlyArray<Pick<LegalEntryRow, 'kind' | 'body' | 'meta' | 'via_portal' | 'amount'> & { voided_at?: string | null }>): { feesTotal: number; demand: number } {
  const feesTotal = round2(firmFeeEntries(entries).reduce((s, e) => s + Number(e.amount ?? 0), 0))
  return { feesTotal, demand: Math.max(0, round2(claim + feesTotal)) }
}

/**
 * The line under the firm's demand figure (v2.6696): what the demand is made of. *balance $14,400.00* when the claim
 * is the open bills alone, *the claim $16,240.00, open bills $14,400.00 inside it* when it reaches past them, and
 * *+ fees and costs $450.00* when the firm has any.
 */
export function firmDemandWords(worth: { balance: number; claim: number }, feesTotal: number): string {
  const base = worth.claim > worth.balance + 0.004 ? `the claim ${formatLegalMoney(worth.claim)}, open bills ${formatLegalMoney(worth.balance)} inside it` : `balance ${formatLegalMoney(worth.balance)}`
  return `total demand · ${base}${feesTotal > 0.004 ? ` + fees and costs ${formatLegalMoney(feesTotal)}` : ''}`
}

// ---------------------------------------------------------------------------
// Plain words for a ledger line
// ---------------------------------------------------------------------------

const SEND_CHANNEL_WORDS: Record<string, string> = {
  stripe: 'through Stripe',
  stripe_manual: 'through Stripe',
  housecallpro: 'through Housecall Pro',
  physical: 'on paper',
  email: 'by email',
}

/**
 * How a bill reached the customer, in words: `sent 2026-06-03 through Stripe`, `sent by email`,
 * `never sent`. The raw channel (`stripe_manual`) and Stripe's status (`open`, `uncollectible`) stay
 * out: the running balance already says what is open.
 */
export function invoiceSentWords(channel: string | null | undefined, sentYmd: string | null, reached: boolean): string {
  if (!reached) return 'never sent'
  const how = SEND_CHANNEL_WORDS[(channel ?? '').trim()] ?? ''
  return ['sent', sentYmd, how].filter(Boolean).join(' ')
}

/** How a payment came in: `check no. 2291`, `ACH`, `card · ref ch_123`, `in kind` (v2.6816); '' when nothing is known. */
export function paymentHowWords(paymentType: string | null | undefined, reference: string | null | undefined): string {
  const word = instrumentWord(paymentType)
  const ref = (reference ?? '').trim()
  const kind = word === 'ach' ? 'ACH' : (word ?? '')
  if (kind === 'check' && ref) return `check no. ${ref}`
  return [kind, ref ? `ref ${ref}` : ''].filter(Boolean).join(' · ')
}
