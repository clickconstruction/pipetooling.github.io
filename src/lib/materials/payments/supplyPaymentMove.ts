/**
 * Move a payment's money to another bill (the owner, 2026-11-16: "we will also often be told by a supply house
 * that they have applied our money to one bill instead of another").
 *
 * A house rarely re-applies a whole payment. It moves one invoice's worth, or part of one. So a move is of an
 * amount, from one bill to another bill of the same house, inside one payment: the money, its day and its method
 * stay, and only where it sits changes. "On account" stands for no bill, on either side.
 *
 * This file plans the move and words it: who it can go to, the What changes panel, the press, the line each bill
 * reads afterwards, and the payments removed lately that can still be put back. `move_supply_house_payment`
 * (migration 20261117010000) writes it, and checks it again.
 *
 * Pure: no React, no Supabase.
 */

import { SUPPLY_PAYMENT_TOLERANCE, fromCents, isPressPayment, paymentOnAccount, supplyBillOpen, supplyPayMethodWords, toCents, usd, type SupplyPayment, type SupplyPaymentLine } from './supplyPayment'
import { parsePayAmount } from './supplyPaymentWindow'

/** A row of `supply_house_payment_events`. */
export type SupplyPaymentEvent = {
  id: string
  payment_id: string
  kind: string
  from_invoice_id: string | null
  to_invoice_id: string | null
  from_invoice_number: string | null
  to_invoice_number: string | null
  amount: number | null
  reason: string | null
  note?: string | null
  undoes_event_id: string | null
  undone_by_event_id: string | null
  actor_name: string | null
  created_at: string
}

/** Why money moves, as the window's chips read. Stored on the event. */
export const MOVE_REASONS = [
  { key: 'house_applied', label: 'The house applied it differently' },
  { key: 'wrong_bill', label: 'I picked the wrong bill' },
  { key: 'other', label: 'Something else' },
] as const
export type MoveReason = (typeof MOVE_REASONS)[number]['key']

const REASON_WORDS: Record<string, string> = { house_applied: 'the house applied it differently', wrong_bill: 'picked the wrong bill', other: '', undo: '' }

/** The side of a move that is no bill: the money waits with the house. */
export const ON_ACCOUNT = 'account'

export type MoveBill = { id: string; invoice_number: string; title: string; amount: number; is_paid: boolean; due_date?: string | null }

export type MoveTarget = { id: string; label: string; open: number }

/** What this payment has on one bill. */
export function paymentOnBill(paymentId: string, billId: string, lines: ReadonlyArray<SupplyPaymentLine>): number {
  return fromCents(lines.reduce((s, l) => (l.payment_id === paymentId && l.invoice_id === billId ? s + toCents(Number(l.amount)) : s), 0))
}

/**
 * Where an amount can go: the house's bills that still have something open, oldest due first, then on account.
 * A press payment only says its bill was paid, so it has no "on account". Money already on account goes to a bill.
 */
export function moveTargets(payment: SupplyPayment, lines: ReadonlyArray<SupplyPaymentLine>, bills: ReadonlyArray<MoveBill>, paidOnBill: (billId: string) => number, fromId: string): MoveTarget[] {
  const out: MoveTarget[] = bills
    .filter((b) => b.id !== fromId && b.amount > 0)
    .map((b) => ({ bill: b, open: supplyBillOpen(b, paidOnBill(b.id)) }))
    .filter((x) => x.open > 0)
    .sort((a, b) => (a.bill.due_date ?? '9999').localeCompare(b.bill.due_date ?? '9999') || a.bill.invoice_number.localeCompare(b.bill.invoice_number, undefined, { numeric: true }))
    .map((x) => ({ id: x.bill.id, label: `${[x.bill.invoice_number, x.bill.title].filter(Boolean).join(' · ')} · ${usd(x.open)} open`, open: x.open }))
  if (fromId !== ON_ACCOUNT && !isPressPayment(payment, lines)) out.push({ id: ON_ACCOUNT, label: 'On account, no bill', open: Number.POSITIVE_INFINITY })
  return out
}

export type MovePlan = {
  /** What can be moved at most: what the payment has on the bill, or holds on account. */
  max: number
  amount: number
  /** The What changes panel, a line per bill and the line about the payment. */
  changes: string[]
  pressLabel: string
  /** Why the press is dead, or '' when it can be pressed. */
  reason: string
  /** The arguments of `move_supply_house_payment`, when the press is live. */
  move: { paymentId: string; fromInvoiceId: string | null; toInvoiceId: string | null; amount: number; reason: MoveReason } | null
}

const numberOf = (bills: ReadonlyArray<MoveBill>, id: string): string => bills.find((b) => b.id === id)?.invoice_number ?? 'a bill'

/** Read the Move window into what the press does, with the panel that says what changes. */
export function planMove(input: {
  payment: SupplyPayment
  lines: ReadonlyArray<SupplyPaymentLine>
  bills: ReadonlyArray<MoveBill>
  paidOnBill: (billId: string) => number
  house: string
  /** The bill the money is on now, or ON_ACCOUNT. */
  fromId: string
  /** The pick, or null before one is made. */
  toId: string | null
  amountText: string
  reason: MoveReason | null
}): MovePlan {
  const { payment, lines, bills, paidOnBill, fromId, toId } = input
  const maxC = fromId === ON_ACCOUNT ? toCents(paymentOnAccount(payment, lines)) : toCents(paymentOnBill(payment.id, fromId, lines))
  const typed = parsePayAmount(input.amountText)
  const amountC = Number.isFinite(typed) && typed > 0 ? toCents(typed) : 0
  const to = toId == null ? null : toId === ON_ACCOUNT ? null : (bills.find((b) => b.id === toId) ?? null)
  const toOpenC = to ? toCents(supplyBillOpen(to, paidOnBill(to.id))) : Number.POSITIVE_INFINITY
  const toWords = toId === ON_ACCOUNT ? 'on account' : to ? to.invoice_number : ''

  let reason = ''
  if (maxC <= 0) reason = 'Nothing of this payment is there to move.'
  else if (!input.amountText.trim()) reason = 'Type how much to move.'
  else if (amountC <= 0) reason = 'Type an amount above zero, in dollars and cents.'
  else if (amountC > maxC) reason = `Only ${usd(fromCents(maxC))} of this payment is there to move.`
  else if (toId == null) reason = 'Pick the bill it goes to.'
  else if (amountC > toOpenC) reason = `${toWords} has ${usd(fromCents(toOpenC))} open. Move that much, or pick another bill.`
  else if (!input.reason) reason = 'Say why it is moving.'

  const changes: string[] = []
  if (amountC > 0 && amountC <= maxC && toId != null && amountC <= toOpenC) {
    if (fromId === ON_ACCOUNT) {
      changes.push(`On account with ${input.house} · ${usd(fromCents(maxC))} → ${usd(fromCents(maxC - amountC))}`)
    } else {
      const from = bills.find((b) => b.id === fromId)
      const paidC = toCents(paidOnBill(fromId))
      const openC = from ? toCents(supplyBillOpen(from, fromCents(paidC))) : 0
      const after = from ? toCents(supplyBillOpen({ amount: from.amount, is_paid: false }, fromCents(paidC - amountC))) : 0
      changes.push(`${numberOf(bills, fromId)} · paid ${usd(fromCents(paidC))} → ${usd(fromCents(paidC - amountC))} · open ${usd(fromCents(openC))} → ${usd(fromCents(after))}${from?.is_paid ? ' · reads unpaid again' : ''}`)
    }
    if (to) {
      const paidC = toCents(paidOnBill(to.id))
      changes.push(`${to.invoice_number} · paid ${usd(fromCents(paidC))} → ${usd(fromCents(paidC + amountC))} · open ${usd(fromCents(toOpenC))} → ${usd(fromCents(toOpenC - amountC))}${toOpenC - amountC <= 0 ? ' · reads paid' : ''}`)
    } else {
      const acctC = toCents(paymentOnAccount(payment, lines))
      changes.push(`On account with ${input.house} · ${usd(fromCents(acctC))} → ${usd(fromCents(acctC + amountC))}`)
    }
    changes.push(`The payment still totals ${usd(Number(payment.amount))}. Its day and how it was sent stay as they are.`)
  }

  const live = reason === ''
  return {
    max: fromCents(maxC),
    amount: fromCents(amountC),
    changes,
    pressLabel: amountC > 0 && toWords ? `Move ${usd(fromCents(amountC))} ${toId === ON_ACCOUNT ? 'on account' : `to ${toWords}`}` : 'Move',
    reason,
    move: live && input.reason ? { paymentId: payment.id, fromInvoiceId: fromId === ON_ACCOUNT ? null : fromId, toInvoiceId: toId === ON_ACCOUNT ? null : toId, amount: fromCents(amountC), reason: input.reason } : null,
  }
}

/** A move that stands: not taken back, and not itself the taking back of another. */
export function standingMoves(events: ReadonlyArray<SupplyPaymentEvent>): SupplyPaymentEvent[] {
  return events.filter((e) => e.kind === 'moved' && !e.undone_by_event_id && !e.undoes_event_id)
}

/**
 * What a bill reads about the moves that touched it: `$1,000.00 moved to S4398120 · Dana · the house applied it
 * differently` on the bill the money left, `$1,000.00 moved here from S4393015 · Dana` on the bill it reached.
 * A move that was taken back says nothing on either bill.
 */
export function billMoveTrace(billId: string, events: ReadonlyArray<SupplyPaymentEvent>): string[] {
  const out: string[] = []
  for (const e of standingMoves(events)) {
    const amount = usd(Number(e.amount ?? 0))
    const who = (e.actor_name ?? '').trim().split(/\s+/)[0] ?? ''
    const why = REASON_WORDS[e.reason ?? ''] ?? ''
    if (e.from_invoice_id === billId) out.push([`${amount} moved ${e.to_invoice_number ? `to ${e.to_invoice_number}` : 'on account'}`, who, why].filter(Boolean).join(' · '))
    else if (e.to_invoice_id === billId) out.push([`${amount} moved here ${e.from_invoice_number ? `from ${e.from_invoice_number}` : 'from the account'}`, who].filter(Boolean).join(' · '))
  }
  return out
}

/** A payment's own history, newest first, for its window: each move, and whether it can still be taken back. */
export function paymentHistory(paymentId: string, events: ReadonlyArray<SupplyPaymentEvent>, dayWords: (ymd: string) => string, dayOf: (iso: string) => string): { id: string; words: string; canUndo: boolean }[] {
  return events
    .filter((e) => e.payment_id === paymentId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((e) => {
      const who = (e.actor_name ?? '').trim().split(/\s+/)[0] ?? ''
      const when = dayWords(dayOf(e.created_at))
      const amount = usd(Number(e.amount ?? 0))
      if (e.kind === 'removed') return { id: e.id, words: [`Removed ${when}`, who, (e.reason ?? '').trim()].filter(Boolean).join(' · '), canUndo: false }
      if (e.kind === 'restored') return { id: e.id, words: [`Put back ${when}`, who].filter(Boolean).join(' · '), canUndo: false }
      const from = e.from_invoice_number ?? 'the account'
      const to = e.to_invoice_number ?? 'the account'
      const taken = e.undoes_event_id ? 'Moved back' : 'Moved'
      const why = REASON_WORDS[e.reason ?? ''] ?? ''
      const tail = e.undone_by_event_id ? 'taken back' : ''
      return { id: e.id, words: [`${taken} ${amount} from ${from} to ${to}`, when, who, why, tail].filter(Boolean).join(' · '), canUndo: !e.undone_by_event_id && !e.undoes_event_id }
    })
}

/** The payments removed in the last 30 days, newest first: each can still be put back. */
export function removedLately(payments: ReadonlyArray<SupplyPayment & { removed_by_name?: string | null; removed_reason?: string | null }>, nowMs: number, dayWords: (ymd: string) => string, dayOf: (iso: string) => string): { payment: SupplyPayment; words: string }[] {
  const cutoff = nowMs - 30 * 86_400_000
  return payments
    .filter((p) => p.removed_at && Date.parse(p.removed_at) >= cutoff && Number(p.amount) > SUPPLY_PAYMENT_TOLERANCE)
    .sort((a, b) => (b.removed_at ?? '').localeCompare(a.removed_at ?? ''))
    .map((p) => {
      const how = supplyPayMethodWords(p)
      const who = (p.removed_by_name ?? '').trim().split(/\s+/)[0] ?? ''
      return {
        payment: p,
        words: [`${usd(Number(p.amount))} ${how ? `${how} ` : ''}payment of ${dayWords(p.paid_on)}`, `removed ${dayWords(dayOf(p.removed_at as string))}`, who, (p.removed_reason ?? '').trim()].filter(Boolean).join(' · '),
      }
    })
}
