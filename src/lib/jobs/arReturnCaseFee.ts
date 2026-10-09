/**
 * The returned-check fee (v2.5033; the owner's call of 2026-10-09, sent by Punchlist). On a case for a check that
 * came back, one press — *Add the $30 fee to bill 2* — puts the most Texas allows on the bill the check was meant
 * for, once per case (`add_ar_return_case_fee`, migration 20261010003000). The case's line says what it is and
 * why it is $30; the hover quotes the statute.
 *
 * Tex. Bus. & Com. Code § 3.506(b), as amended by H.B. 2793 (82nd Leg., R.S., ch. 333, eff. Sept. 1, 2011), and
 * the § 3.506(c) exclusion. A sent Stripe invoice cannot take a line, so a check that paid only Stripe bills says
 * so instead of offering the press. Pure: the pane draws what this says.
 */
import type { ArReturnCaseView } from './arReturnCase'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/** § 3.506(b)'s ceiling, in dollars. */
export const AR_RETURNED_CHECK_FEE = 30

/** The case's line, beside the press or the fee once it is on. */
export const AR_RETURNED_CHECK_FEE_LINE = '$30 — the most Texas allows, Bus. & Com. Code § 3.506'

/** The hover: § 3.506(b) as amended in 2011, and (c)'s exclusion. */
export const AR_RETURNED_CHECK_FEE_STATUTE =
  'Tex. Bus. & Com. Code § 3.506(b), as amended by H.B. 2793 (2011): “On return of a payment device to the holder following dishonor of the payment device by a payor, the holder … may charge the drawer or indorser a maximum processing fee of $30.” § 3.506(c): no fee may be charged if a reimbursement fee was collected under Code of Criminal Procedure art. 102.007(e), and a fee already collected is refunded if one later is.'

/** One bill the check paid, as `list_ar_return_case_fees` reads it. */
export type ArCaseFeeBill = {
  invoice_id: string
  job_id: string
  /** 0-based, as the bills are stored; "bill 1" is 0. */
  sequence_order: number | null
  status: string | null
  stripe: boolean
  job_number: string
  job_name: string | null
}

/** A case's fee and the bills its check paid (`list_ar_return_case_fees`). */
export type ArCaseFeeRow = {
  case_id: string
  fee_amount: number | string | null
  fee_invoice_id: string | null
  fee_added_at: string | null
  fee_added_by: string | null
  bills: ArCaseFeeBill[]
}

export type ArCaseFeeOffer =
  | { kind: 'offer'; invoiceId: string; button: string; line: string; title: string }
  | { kind: 'added'; words: string; line: string; title: string }
  | { kind: 'blocked'; words: string; line: string; title: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function billWords(b: ArCaseFeeBill, manyJobs: boolean): string {
  const n = typeof b.sequence_order === 'number' ? `bill ${b.sequence_order + 1}` : 'its bill'
  return manyJobs && b.job_number ? `${n} on ${b.job_number}` : n
}

/**
 * What the case says about the fee, or null when the fee is not its question: a check that never reached the bank
 * (rejected, unbanked) or a Stripe case, or a case whose fee read has not come back. The bill is the oldest the
 * check paid that is not a Stripe invoice.
 */
export function arCaseFeeOffer(view: Pick<ArReturnCaseView, 'source'>, row: ArCaseFeeRow | null | undefined): ArCaseFeeOffer | null {
  if (view.source !== 'bank' && view.source !== 'hand') return null
  if (!row) return null
  const line = AR_RETURNED_CHECK_FEE_LINE
  const title = AR_RETURNED_CHECK_FEE_STATUTE
  const bills = [...row.bills].sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
  const manyJobs = new Set(bills.map((b) => b.job_id)).size > 1
  if (row.fee_added_at) {
    const on = bills.find((b) => b.invoice_id === row.fee_invoice_id)
    const ymd = calendarYmdInAppTzFromIso(row.fee_added_at)
    const day = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}` : ''
    const who = (row.fee_added_by ?? '').trim()
    return { kind: 'added', words: `The $${AR_RETURNED_CHECK_FEE} fee is on ${on ? billWords(on, manyJobs) : 'its bill'}${day ? `, added ${day}` : ''}${who ? ` by ${who}` : ''}.`, line, title }
  }
  const target = bills.find((b) => !b.stripe)
  if (target) return { kind: 'offer', invoiceId: target.invoice_id, button: `Add the $${AR_RETURNED_CHECK_FEE} fee to ${billWords(target, manyJobs)}`, line, title }
  const stripe = bills[0]
  if (stripe) {
    const n = billWords(stripe, manyJobs)
    return { kind: 'blocked', words: `${n[0]!.toUpperCase()}${n.slice(1)} is a Stripe invoice, and a sent Stripe invoice cannot take a line.`, line, title }
  }
  return { kind: 'blocked', words: 'The check paid no bill by name, so the fee has no bill to go on.', line, title }
}

/** The `fee_lines` entries on a job's bills that name one of `keys`, summed in cents. An amount that does not read counts as nothing. */
function feeLineCents(bills: ReadonlyArray<object> | null | undefined, keys: readonly string[]): number {
  let cents = 0
  for (const inv of bills ?? []) {
    const lines = (inv as { fee_lines?: unknown }).fee_lines
    if (!Array.isArray(lines)) continue
    for (const l of lines) {
      if (l == null || typeof l !== 'object') continue
      const named = keys.some((k) => {
        const v = (l as Record<string, unknown>)[k]
        return typeof v === 'string' && v.trim() !== ''
      })
      if (!named) continue
      const amount = Number((l as { amount?: unknown }).amount)
      if (Number.isFinite(amount) && amount > 0) cents += Math.round(amount * 100)
    }
  }
  return cents
}

/**
 * The returned check fees on a job's bills, in cents: each `fee_lines` entry that names its case. That is the line
 * `add_ar_return_case_fee` writes, and it raised the job's revenue by the same amount. A line that names no case is
 * not a returned check fee.
 */
export function returnedCheckFeeCents(bills: ReadonlyArray<object> | null | undefined): number {
  return feeLineCents(bills, ['case_id'])
}

/**
 * Every fee that rides on a job's bills, in cents: a returned check fee (an entry that names its case) and a GC card
 * fee (an entry that names its card bill, `gc_card_bill_finish`, v2.5113). Each raised the job's revenue as it went
 * on, so a rewrite of the revenue from the line items adds this back (`jobFormRiderFeesDollars`; `job_rider_fees` in
 * SQL). A line that names neither is not a rider.
 */
export function riderFeeLineCents(bills: ReadonlyArray<object> | null | undefined): number {
  return feeLineCents(bills, ['case_id', 'card_bill'])
}

/** The fee lines a billed bill carries (`jobs_ledger_invoices.fee_lines`), for the printed bill's own rows. */
export function billFeeLines(inv: object | null | undefined): Array<{ description: string; amountDollars: number }> {
  const raw = (inv as { fee_lines?: unknown } | null | undefined)?.fee_lines
  if (!Array.isArray(raw)) return []
  return raw.flatMap((l) => {
    const description = typeof (l as { description?: unknown })?.description === 'string' ? (l as { description: string }).description.trim() : ''
    const amountDollars = Number((l as { amount?: unknown })?.amount)
    return description && Number.isFinite(amountDollars) && amountDollars > 0 ? [{ description, amountDollars }] : []
  })
}
