/**
 * Move a customer payment to the right job (v2.3576, PR 3 of the payment move/remove train —
 * the sub-sheet half is `subPaymentMoveRemove.ts`). Pure: which rows may move and why not, the
 * before / after money on both jobs, and the grey trace lines both jobs' Payments received
 * tables draw from `jobs_ledger_payment_events`.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PaymentRow } from './jobFormTypes'
import { jobsLedgerInvoiceIsStripeLinked, paymentRowLinkedToInvoice } from './jobFormPaymentPredicates'

export type PaymentMoveBlock = 'unsaved' | 'stripe' | 'sent-bill'

/**
 * Null when the row may move. A row not yet saved has nothing to move; a Stripe-hosted bill's
 * payment stays with Stripe; a payment a SENT bill already counted stays until it is unlinked —
 * the customer was told a number. A payment on an unsent bill moves (and is unlinked on the
 * way); a bank-deposit-linked payment moves with its deposit.
 */
export function paymentMoveBlock(row: PaymentRow, job: JobWithDetails | null, persisted: boolean): PaymentMoveBlock | null {
  if (!persisted) return 'unsaved'
  if (paymentRowLinkedToInvoice(row) && job) {
    const inv = (job.invoices ?? []).find((i) => i.id === row.invoice_id)
    if (inv) {
      if (jobsLedgerInvoiceIsStripeLinked(inv)) return 'stripe'
      if (inv.sent_to_customer_at) return 'sent-bill'
    }
  }
  return null
}

export function paymentMoveBlockText(block: PaymentMoveBlock, billAmountUsd?: number | null): string {
  if (block === 'unsaved') return 'Save the job first, then it can move'
  if (block === 'stripe') return 'Recorded from the Stripe bill — Stripe owns it'
  const bill = billAmountUsd != null ? ` the $${Math.round(billAmountUsd).toLocaleString('en-US')} bill` : ' the bill'
  return `A sent bill counted it — unlink it from${bill} first`
}

export type JobMoneySide = { label: string; paidBefore: number; paidAfter: number; openBefore: number; openAfter: number }
export type JobPaymentMovePlan = { from: JobMoneySide; to: JobMoneySide; toPaidInFull: boolean }

/** Both jobs' paid and open before and after, for the dialog's What changes panel. */
export function planJobPaymentMove(input: {
  amountUsd: number
  from: { label: string; revenueUsd: number; paidUsd: number }
  to: { label: string; revenueUsd: number; paidUsd: number }
}): JobPaymentMovePlan {
  const amt = Math.max(0, input.amountUsd)
  const side = (s: { label: string; revenueUsd: number; paidUsd: number }, delta: number): JobMoneySide => {
    const paidAfter = s.paidUsd + delta
    return {
      label: s.label,
      paidBefore: s.paidUsd,
      paidAfter,
      openBefore: Math.max(0, s.revenueUsd - s.paidUsd),
      openAfter: Math.max(0, s.revenueUsd - paidAfter),
    }
  }
  const to = side(input.to, amt)
  return { from: side(input.from, -amt), to, toPaidInFull: input.to.revenueUsd > 0 && to.paidAfter + 0.005 >= input.to.revenueUsd }
}

export type JobPaymentEvent = {
  id: string
  kind: string
  payment_id: string | null
  from_job_id: string | null
  to_job_id: string | null
  amount: number
  paid_on: string | null
  reason: string | null
  actor_name: string | null
  created_at: string
}

/**
 * The grey lines under a job's Payments received table: what left it and what arrived, with
 * who and why. `labelFor` names the other job (J922 · Michael Palmer); `money` formats dollars.
 */
export function jobPaymentTraceLines(
  events: readonly JobPaymentEvent[],
  thisJobId: string,
  labelFor: (jobId: string) => string,
  money: (usd: number) => string,
): Array<{ id: string; text: string; direction: 'out' | 'in' }> {
  const out: Array<{ id: string; text: string; direction: 'out' | 'in' }> = []
  for (const e of events) {
    if (e.kind !== 'moved') continue
    const who = (e.actor_name ?? '').trim()
    const why = (e.reason ?? '').trim()
    const tail = [who, why].filter(Boolean).join(' · ')
    if (e.from_job_id === thisJobId && e.to_job_id) {
      out.push({ id: e.id, direction: 'out', text: `${money(e.amount)} moved → ${labelFor(e.to_job_id)}${tail ? ` · ${tail}` : ''}` })
    } else if (e.to_job_id === thisJobId && e.from_job_id) {
      out.push({ id: e.id, direction: 'in', text: `${money(e.amount)} moved here from ${labelFor(e.from_job_id)}${tail ? ` · ${tail}` : ''}` })
    }
  }
  return out
}
