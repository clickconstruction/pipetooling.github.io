/**
 * Payments that still need how they were paid (the owner's call 4, 2026-11-16: Mark paid stays one press, and the
 * payment waits on a finish-later list).
 *
 * Mark paid on a row is worth keeping on a busy day: it makes a payment with the day and the amount and no method.
 * Without a list, later never comes. So a payment with no method waits where it is counted: under Accounts payable
 * and on Needs you. A payment from before payments were rows never waits here, nor one that sent nothing.
 *
 * This file words the list and what finishing one writes. Pure: no React, no Supabase.
 */

import { needsHowPaid, supplyPayMethodWrite, usd, type SupplyPayChip, type SupplyPayment, type SupplyPaymentLine } from './supplyPayment'

/** A payment on the list, with what the list needs to name it. */
export type PaymentToFinish = SupplyPayment & { houseName: string; billNumbers: string[] }

export type FinishRow = {
  id: string
  /** `Pecan Supply · S4388310` · `Cedar Fork Supply · 2 bills` */
  title: string
  /** `marked paid 11/14` · `recorded 11/10` */
  sub: string
  amount: number
}

const bills = (n: number): string => `${n} ${n === 1 ? 'bill' : 'bills'}`

/** The list's rows, the oldest payment first: the one that has waited longest leads. */
export function finishRows(payments: ReadonlyArray<PaymentToFinish>, dayWords: (ymd: string) => string): FinishRow[] {
  return payments
    .filter(needsHowPaid)
    .sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.id.localeCompare(b.id))
    .map((p) => {
      const what = p.billNumbers.length === 1 ? p.billNumbers[0] : p.billNumbers.length > 1 ? bills(p.billNumbers.length) : 'on account'
      return {
        id: p.id,
        title: [p.houseName.trim() || 'A supply house', what].filter(Boolean).join(' · '),
        sub: `${p.source === 'mark_paid' ? 'marked paid' : 'recorded'} ${dayWords(p.paid_on)}`,
        amount: Number(p.amount),
      }
    })
}

/** `3 payments need how they were paid` · `1 payment needs how it was paid` · '' at none. */
export function finishHeading(count: number): string {
  if (count <= 0) return ''
  return count === 1 ? '1 payment needs how it was paid' : `${count} payments need how they were paid`
}

/** A payment's bills, by number, from the lines read with it. */
export function billNumbersOf(paymentId: string, lines: ReadonlyArray<SupplyPaymentLine & { invoice_number?: string | null }>): string[] {
  const seen = new Set<string>()
  for (const l of lines) if (l.payment_id === paymentId && l.invoice_number) seen.add(l.invoice_number)
  return [...seen]
}

export type HowSentInput = { chip: SupplyPayChip | null; ref: string; paidOn: string; receiptLink: string }

export type HowSentPlan =
  | { ok: true; patch: { method: string; method_ref: string | null; paid_on: string; receipt_link: string | null }; words: string }
  | { ok: false; reason: string }

/** What Save writes on a payment: the method and its number, the day and the receipt link. The method is what was missing, so it is needed. */
export function planHowSent(input: HowSentInput, payment: { amount: number }): HowSentPlan {
  const { method, method_ref } = supplyPayMethodWrite(input.chip, input.ref)
  if (!method) return { ok: false, reason: 'Pick how it was sent.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) return { ok: false, reason: 'Pick the day it was sent.' }
  return { ok: true, patch: { method, method_ref, paid_on: input.paidOn, receipt_link: input.receiptLink.trim() || null }, words: `How the ${usd(Number(payment.amount))} was sent is saved.` }
}
