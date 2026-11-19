/**
 * The sheet's tie to one bill (v2.7835, punch list #388, step 1 of 3).
 *
 * A sub's sheet waits at Waiting on customer until the customer pays. The sheet is tied to a job, and a job
 * can hold several bills, so the tie says which one the sheet rides on (`people_labor_jobs.draw_invoice_id`).
 * The database makes the tie by itself when the job has exactly one open bill
 * (`people_labor_jobs_draw_tie()`); with several, the office picks in the window these words fill.
 *
 * `drawTieOnArrival` restates the trigger's rule for the screen, so the window shows exactly when the
 * database will not decide. A bill is open until it is paid: a draft (`ready_to_bill`) or a sent bill
 * (`billed`). Pure: no React, no Supabase.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { daysBetweenYmd } from './sheetRail'

/** One of the job's bills, as `jobs_ledger_invoices` holds it. */
export type DrawBill = {
  id: string
  status: string | null
  sequence_order: number | null
  billed_at: string | null
  amount: number | null
  created_at?: string | null
}

export type DrawBillState = 'billed' | 'draft' | 'paid'

export type DrawBillOption = {
  id: string
  /** "Bill 2 of 3", or "The only bill". */
  label: string
  /** "$4,800 · billed Oct 21 · open", "$1,200 · not billed yet", "$900 · paid". */
  detail: string
  state: DrawBillState
}

export const DRAW_BILL_WINDOW_TITLE = 'Which bill does this sheet ride on?'
export const DRAW_BILL_NONE_LABEL = 'No bill'
export const DRAW_BILL_NONE_DETAIL = 'Their page stays on Draw requested until you queue the payment. You can pick a bill later from the sheet’s row.'
/** Under the title when the job holds no bill at all. */
export const DRAW_BILL_NO_BILLS = 'This job has no bill yet. Make the bill first, then pick it here.'
export const DRAW_BILL_REQUEST_PRESS = 'Request the draw'
export const DRAW_BILL_SAVE_PRESS = 'Save the bill'

/** The line under the window's title: what the pick does on the sub's page (step 2). */
export function drawBillWindowLead(subName: string): string {
  const who = subName.trim()
  return who ? `${who}’s page will say the customer paid when this bill is paid in full.` : 'The sub’s page will say the customer paid when this bill is paid in full.'
}

export function drawBillState(status: string | null | undefined): DrawBillState {
  return status === 'paid' ? 'paid' : status === 'billed' ? 'billed' : 'draft'
}

/** The job's bills in their own order: by sequence, then by the day they were made. */
export function orderedDrawBills<T extends DrawBill>(bills: readonly T[]): T[] {
  return [...bills].sort(
    (a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0) || (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id),
  )
}

/** A bill is open until it is paid. The trigger's own rule: `status <> 'paid'`. */
export function openDrawBills<T extends DrawBill>(bills: readonly T[]): T[] {
  return orderedDrawBills(bills).filter((b) => drawBillState(b.status) !== 'paid')
}

const money = (n: number | null): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`

/** "Bill 2 of 3" by the bill's place among the job's bills; a job with one bill reads "The only bill". */
export function drawBillLabel(bills: readonly DrawBill[], id: string): string | null {
  const ordered = orderedDrawBills(bills)
  const i = ordered.findIndex((b) => b.id === id)
  if (i < 0) return null
  return ordered.length === 1 ? 'The only bill' : `Bill ${i + 1} of ${ordered.length}`
}

function drawBillDetail(bill: DrawBill): string {
  const state = drawBillState(bill.status)
  const amount = money(bill.amount)
  if (state === 'paid') return `${amount} · paid`
  if (state === 'draft') return `${amount} · not billed yet`
  const ymd = bill.billed_at ? calendarYmdInAppTzFromIso(bill.billed_at) : ''
  return ymd ? `${amount} · billed ${formatWorkDateYmdMonthDayShort(ymd)} · open` : `${amount} · billed · open`
}

/** Every bill of the job as a row of the window: open bills first, in their order, then the paid ones. */
export function drawBillOptions(bills: readonly DrawBill[]): DrawBillOption[] {
  const ordered = orderedDrawBills(bills)
  const row = (b: DrawBill): DrawBillOption => ({ id: b.id, label: drawBillLabel(ordered, b.id) ?? 'Bill', detail: drawBillDetail(b), state: drawBillState(b.status) })
  return [...ordered.filter((b) => drawBillState(b.status) !== 'paid').map(row), ...ordered.filter((b) => drawBillState(b.status) === 'paid').map(row)]
}

/**
 * What happens to the tie when a sheet arrives at Waiting on customer.
 *
 * - `none`: the job has no open bill. Nothing to tie and nothing to ask.
 * - `auto`: the job has exactly one open bill. The database ties it and the office is not asked.
 * - `pick`: the job has several. The office picks. `preselect` is the one sent bill when exactly one is
 *   sent and the rest are drafts, since that is the bill a draw was just requested on.
 */
export type DrawTieOnArrival = { kind: 'none' } | { kind: 'auto'; billId: string } | { kind: 'pick'; preselect: string | null }

export function drawTieOnArrival(bills: readonly DrawBill[]): DrawTieOnArrival {
  const open = openDrawBills(bills)
  if (open.length === 0) return { kind: 'none' }
  if (open.length === 1) return { kind: 'auto', billId: open[0]!.id }
  const sent = open.filter((b) => drawBillState(b.status) === 'billed')
  return { kind: 'pick', preselect: sent.length === 1 ? sent[0]!.id : null }
}

/**
 * The line on the office's row for a sheet that waits on the customer, and the press that opens the window.
 * Null off that stage, where a sheet rides on no bill. `bills` is the job's bills when the screen holds
 * them; without them a tied sheet still says it is tied.
 */
export type DrawTieRowWords = { text: string; tied: boolean; press: string }

export function drawTieRowWords(input: { stage: string | null | undefined; drawInvoiceId: string | null | undefined; bills: readonly DrawBill[] | null }): DrawTieRowWords | null {
  if (input.stage !== 'customer_pay') return null
  const id = (input.drawInvoiceId ?? '').trim()
  if (!id) return { text: 'No bill tied', tied: false, press: 'Pick the bill this sheet rides on' }
  const label = input.bills ? drawBillLabel(input.bills, id) : null
  const text = label == null ? 'Rides on a bill' : label === 'The only bill' ? 'Rides on the only bill' : `Rides on ${label.charAt(0).toLowerCase()}${label.slice(1)}`
  return { text, tied: true, press: 'Change the bill this sheet rides on' }
}

/** Days a paid sheet may sit with no pay day before the office's row turns amber (the owner's call 5, 2026-11-17). */
export const CUSTOMER_PAID_QUIET_DAYS = 2

/**
 * What the sub reads about the customer's payment, said on the office's row (punch list #388, step 2), so
 * the office reads what the sub reads. Null when the sub's page says nothing new: the customer has not paid
 * the tied bill in full, or the sheet is already queued for a pay run and the page says Queued.
 *
 * Grey is nothing to do. Amber is a sheet the customer paid more than two days ago that has no pay day: the
 * sub can see the day, so the office sees the same clock. A held sheet stays grey, since the hold is the
 * office's answer and the sub reads its reason under the sentence.
 */
export type SubSeesWords = { text: string; tone: 'grey' | 'amber'; title: string }

export function subSeesCustomerPaid(input: {
  stage: string | null | undefined
  customerPaidOn: string | null | undefined
  payableAfter: string | null | undefined
  payHoldReason: string | null | undefined
  todayYmd: string
}): SubSeesWords | null {
  if (input.stage !== 'customer_pay') return null
  const paidOn = (input.customerPaidOn ?? '').trim()
  if (!paidOn || (input.payableAfter ?? '').trim() !== '') return null
  const day = formatWorkDateYmdMonthDayShort(paidOn)
  if ((input.payHoldReason ?? '').trim() !== '') {
    return { text: `Sub sees: Customer paid ${day} · on hold`, tone: 'grey', title: 'Their page says the customer paid, with the hold’s reason under it.' }
  }
  const days = daysBetweenYmd(paidOn, input.todayYmd)
  if (days > CUSTOMER_PAID_QUIET_DAYS) {
    return { text: `Customer paid ${day} · not queued, ${days} days`, tone: 'amber', title: 'Their page has said the customer paid since that day. Set a payable-after date to queue it, or type why it waits.' }
  }
  return { text: `Sub sees: Customer paid ${day}`, tone: 'grey', title: 'Their page says the customer paid and that their payment is next.' }
}
