/**
 * Move a customer payment to the right job (v2.3576, PR 3 of the payment move/remove train —
 * the sub-sheet half is `subPaymentMoveRemove.ts`). Pure: which rows may move and why not, the
 * before / after money on both jobs, and the grey trace lines both jobs' Payments received
 * tables draw from `jobs_ledger_payment_events` (with v2.5008, a *removed* line under a moved
 * payment that was later removed).
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { PaymentRow } from './jobFormTypes'
import { jobsLedgerInvoiceIsStripeLinked, paymentRowLinkedToInvoice, stripeOwnsPaymentRow } from './jobFormPaymentPredicates'

export type PaymentMoveBlock = 'unsaved' | 'stripe' | 'sent-bill'

/**
 * Null when the row may move. A row not yet saved has nothing to move; a payment Stripe holds a
 * record of (a credit note, a bill marked paid in Stripe) stays with Stripe; a payment a SENT
 * bill already counted stays until it is unlinked — the customer was told a number. A payment on
 * an unsent bill moves (and is unlinked on the way); a bank-deposit-linked payment moves with its
 * deposit. v2.4801: a row on a Stripe bill Stripe has not heard of — a check Mark Paid holds until
 * it clears, a deposit matched in Accounts Receivable — moves too: the pay link is still open and
 * the customer's number is unchanged, so the bill just reads Billed again.
 */
export function paymentMoveBlock(row: PaymentRow, job: JobWithDetails | null, persisted: boolean): PaymentMoveBlock | null {
  if (!persisted) return 'unsaved'
  if (paymentRowLinkedToInvoice(row) && job) {
    const inv = (job.invoices ?? []).find((i) => i.id === row.invoice_id)
    if (inv) {
      if (jobsLedgerInvoiceIsStripeLinked(inv)) return stripeOwnsPaymentRow(row, job) ? 'stripe' : null
      if (inv.sent_to_customer_at) return 'sent-bill'
    }
  }
  return null
}

/** The Why box's word when nobody types one (v2.4895: a placeholder, never text the typing runs onto). */
export const PAYMENT_MOVE_DEFAULT_REASON = 'wrong job'

/** The reason a move records: what was typed, else *wrong job*. */
export function paymentMoveReason(typed: string | null | undefined): string {
  return (typed ?? '').trim() || PAYMENT_MOVE_DEFAULT_REASON
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
  /** The bill the payment sat on when the event was written; null when no bill held it. */
  invoice_id?: string | null
  amount: number
  paid_on: string | null
  reason: string | null
  actor_name: string | null
  created_at: string
}

/**
 * What a removal's stored reason reads as on the trace line. Remove stores *unlinked* on every
 * plain removal, so with no bill behind the payment it adds nothing: the line already says
 * *removed* (the owner's call of 2026-10-09). The other codes Remove stores read as words.
 */
export function jobPaymentRemovedReasonWords(reason: string | null | undefined, heldByBill: boolean): string | null {
  const r = (reason ?? '').trim()
  if (!r) return null
  if (r === 'unlinked') return heldByBill ? 'unlinked from its bill' : null
  if (r === 'unlinked_stripe_bill_unrecorded') return 'unlinked from its Stripe bill'
  const bank = /^bank_failed(?::\s*(.*))?$/.exec(r)
  if (bank) return ['the bank returned it', (bank[1] ?? '').trim()].filter(Boolean).join(' · ')
  return r
}

export type JobPaymentTraceLine = { id: string; text: string; direction: 'out' | 'in' | 'removed' }

/**
 * The grey lines under a job's Payments received table: what left it and what arrived, with
 * who and why. A payment moved here and later removed draws a *removed* line right under its
 * *moved here* line (the owner's call of 2026-10-09), so the arrival never sits over no payment.
 * `labelFor` names the other job (J922 · Michael Palmer); `money` formats dollars.
 */
export function jobPaymentTraceLines(
  events: readonly JobPaymentEvent[],
  thisJobId: string,
  labelFor: (jobId: string) => string,
  money: (usd: number) => string,
): JobPaymentTraceLine[] {
  const tailOf = (who: string | null, why: string | null) => [(who ?? '').trim(), (why ?? '').trim()].filter(Boolean).join(' · ')
  // Each removal here goes under its payment's latest arrival (a removed payment never arrives again).
  const removalUnder = new Map<string, JobPaymentEvent>()
  for (const r of events) {
    if (r.kind !== 'removed' || r.from_job_id !== thisJobId || !r.payment_id) continue
    let arrival: JobPaymentEvent | null = null
    for (const m of events) {
      if (m.kind !== 'moved' || m.to_job_id !== thisJobId || m.payment_id !== r.payment_id) continue
      if (!arrival || m.created_at > arrival.created_at) arrival = m
    }
    if (arrival) removalUnder.set(arrival.id, r)
  }
  const out: JobPaymentTraceLine[] = []
  for (const e of events) {
    if (e.kind !== 'moved') continue
    const tail = tailOf(e.actor_name, e.reason)
    if (e.from_job_id === thisJobId && e.to_job_id) {
      out.push({ id: e.id, direction: 'out', text: `${money(e.amount)} moved → ${labelFor(e.to_job_id)}${tail ? ` · ${tail}` : ''}` })
    } else if (e.to_job_id === thisJobId && e.from_job_id) {
      out.push({ id: e.id, direction: 'in', text: `${money(e.amount)} moved here from ${labelFor(e.from_job_id)}${tail ? ` · ${tail}` : ''}` })
      const gone = removalUnder.get(e.id)
      if (gone) {
        const goneTail = tailOf(gone.actor_name, jobPaymentRemovedReasonWords(gone.reason, !!gone.invoice_id))
        out.push({ id: gone.id, direction: 'removed', text: `${money(gone.amount)} removed${goneTail ? ` · ${goneTail}` : ''}` })
      }
    }
  }
  return out
}
