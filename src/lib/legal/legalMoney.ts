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
export function firmFeeEntries<E extends Pick<LegalEntryRow, 'kind' | 'body' | 'meta' | 'via_portal'>>(entries: ReadonlyArray<E>): E[] {
  return entries.filter((e) => (e.kind === 'fee' || e.kind === 'cost') && !isContingencyEntry(e))
}

/** The contingency rows, shown on their own line under the fees so the firm still sees what it earned. */
export function contingencyEntries<E extends Pick<LegalEntryRow, 'kind' | 'body' | 'meta' | 'via_portal'>>(entries: ReadonlyArray<E>): E[] {
  return entries.filter((e) => (e.kind === 'fee' || e.kind === 'cost') && isContingencyEntry(e))
}

/** Balance + the firm's fees and costs = the demand. One sum for the matter card and the print. */
export function firmDemand(balance: number, entries: ReadonlyArray<Pick<LegalEntryRow, 'kind' | 'body' | 'meta' | 'via_portal' | 'amount'>>): { feesTotal: number; demand: number } {
  const feesTotal = round2(firmFeeEntries(entries).reduce((s, e) => s + Number(e.amount ?? 0), 0))
  return { feesTotal, demand: round2(balance + feesTotal) }
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

/** How a payment came in: `check no. 2291`, `ACH`, `card · ref ch_123`; '' when nothing is known. */
export function paymentHowWords(paymentType: string | null | undefined, reference: string | null | undefined): string {
  const word = instrumentWord(paymentType)
  const ref = (reference ?? '').trim()
  const kind = word === 'ach' ? 'ACH' : (word ?? '')
  if (kind === 'check' && ref) return `check no. ${ref}`
  return [kind, ref ? `ref ${ref}` : ''].filter(Boolean).join(' · ')
}
