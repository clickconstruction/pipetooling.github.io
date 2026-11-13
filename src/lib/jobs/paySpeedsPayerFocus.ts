/**
 * One payer's record at the top of the Pay speeds window (v2.7013): what the Pipeline row's
 * "Pays in 3–67d" line stands on. The words are the line's own (`formatPaysIn`), the sentence under
 * them says what the two numbers are, and the payments and open bills are the ones the window's
 * By customer list already draws for that payer.
 *
 * Pure: no React, no supabase.
 */
import type { StageRow } from '../jobsStagesBoard'
import { PAY_SPEED_MIN_SAMPLES, type CustomerSegment, type PayReceipt, type PaySpeedData } from './billedExpectedPay'
import { openBillsForCustomers, type MoneyWaitingCalendars, type OpenBill } from './moneyWaiting'
import { formatPaysIn, paySpeedSpread, type PaySpeedSpread } from './paymentReliability'
import type { PayCalendarJob } from './payCalendarJob'

export type PaySpeedsPayer = {
  id: string
  name: string | null
  /** The job the press sat on (punch list #341): the window's Pay calendar line then opens on that job. */
  job?: PayCalendarJob | null
}

export type PaySpeedsPayerFocus = {
  customerId: string
  name: string
  segment: CustomerSegment | null
  /** The row's own words, "Pays in 3–67d"; null with no measurable payment. */
  paysIn: string | null
  /** What the range is, in one or two short sentences; with no payment, what the forecast uses instead. */
  sentence: string
  /** Their own median when they have one; null when the forecast borrows a pace. */
  medianDays: number | null
  samples: number
  /** The measurable payments behind the range, newest first. */
  receipts: PayReceipt[]
  /** What they owe now, one line per bill, longest wait first. */
  bills: OpenBill[]
  open: number
}

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** What "Pays in 3–67d" means for this many payments: the middle half from four up, every payment below that. */
export function payerRangeSentence(spread: PaySpeedSpread | null): string {
  if (!spread) return 'No payment of theirs can be measured yet. Their expected day borrows a pace from payers like them.'
  if (spread.samples === 1) return `Their one measured payment came ${days(spread.loDays)} after the bill.`
  if (spread.samples < 4) return `Their ${spread.samples} measured payments came ${spread.loDays} to ${days(spread.hiDays)} after the bill.`
  return `The middle half of their last ${spread.samples} measured payments came ${spread.loDays} to ${days(spread.hiDays)} after the bill. The middle one took ${days(spread.medianDays)}.`
}

/**
 * The payer's card. `rows` are the bills to look for theirs in: the window passes the still-open billed rows, with
 * the Collections rows too when the press came from one, so a chased payer's card still says what they owe.
 */
export function buildPaySpeedsPayerFocus(payer: PaySpeedsPayer, rows: StageRow[], paySpeeds: PaySpeedData | null, todayYmd: string, calendars?: MoneyWaitingCalendars | null): PaySpeedsPayerFocus {
  const receipts = paySpeeds?.receipts[payer.id] ?? []
  const spread = paySpeedSpread(receipts)
  const own = paySpeeds?.customers[payer.id]
  const bills = openBillsForCustomers(rows, paySpeeds, todayYmd, calendars).get(payer.id) ?? []
  return {
    customerId: payer.id,
    name: (payer.name ?? '').trim() || 'This customer',
    segment: paySpeeds?.customerTypes[payer.id] ?? null,
    paysIn: formatPaysIn(spread),
    sentence: payerRangeSentence(spread),
    medianDays: own != null && own.samples >= PAY_SPEED_MIN_SAMPLES ? own.medianDays : null,
    samples: own?.samples ?? receipts.length,
    receipts,
    bills,
    open: bills.reduce((sum, b) => sum + b.open, 0),
  }
}
