/**
 * One sending to a sub, and their credit (punch list #347; the owner, 2026-11-13: "overpayment -> credit").
 *
 * A sending is one money movement: one check, one transfer. It may be more than the sheet it was typed on needs.
 * The extra goes first to the sub's other open sheets, oldest first, and what is still left is kept as their
 * credit. The next payment to that sub offers the credit before any new money.
 *
 * This file plans it. `record_sub_sending` and `apply_sub_credit` (migration 20261114020000) write it.
 * Pure: no React, no Supabase.
 */
import { parseSubPaymentAmount, SUB_PAYMENT_TOLERANCE } from './subPaymentWindow'

const cents = (n: number): number => Math.round(n * 100) / 100
const usd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** One sheet as the plan reads it. `key` is whose it is by the Pay view's rule (`sheetParties`). */
export type SendingSheet = {
  id: string
  key: string
  /** `1048 Tison per plans`. */
  label: string
  /** What the sheet still owes. Zero or below is settled. */
  remaining: number
  /** The day the sheet is dated, for Oldest first. */
  day: string
}

/** What the window knows about the sub behind a sheet. */
export type SendingContext = {
  /** Their roster id. Null when the sheet's sub is not one person on the roster: such a sub cannot hold a credit. */
  personId: string | null
  /** The credit they hold today. */
  credit: number
  /** Their other sheets with something left, oldest first. */
  others: SendingSheet[]
}

/** A sheet's sub as a roster id: the key of a lone roster contractor is `id:<people.id>`. */
export function personIdOfKey(key: string): string | null {
  return key.startsWith('id:') && key.length > 3 ? key.slice(3) : null
}

export function sendingContext(sheetId: string, sheets: readonly SendingSheet[], creditByPersonId: ReadonlyMap<string, number> | null | undefined): SendingContext | null {
  const sheet = sheets.find((s) => s.id === sheetId)
  if (!sheet) return null
  const personId = personIdOfKey(sheet.key)
  const others = sheet.key
    ? sheets
        .filter((s) => s.id !== sheetId && s.key === sheet.key && s.remaining > SUB_PAYMENT_TOLERANCE)
        .sort((a, b) => (a.day || '9999').localeCompare(b.day || '9999') || a.label.localeCompare(b.label))
    : []
  const credit = personId ? Math.max(0, cents(creditByPersonId?.get(personId) ?? 0)) : 0
  return { personId, credit, others }
}

export type SendingLine = { jobId: string; label: string; amount: number; settles: boolean }

export type SendingPlan =
  | {
      ok: true
      /** What left the bank: the lines and the credit together. */
      sent: number
      /** The sheet the window was opened on comes first. */
      lines: SendingLine[]
      /** Kept as the person's credit. */
      credit: number
      /** What stays due on the window's own sheet. */
      leaves: number
      /** True when the amount went past the window's own sheet. */
      spills: boolean
    }
  | { ok: false; reason: 'blank' | 'invalid' | 'nothing_left' | 'over'; error: string }

/**
 * What a typed amount becomes. Up to what the sheet owes it is one payment, as it always was. Past that the extra
 * fills the sub's other open sheets oldest first (when `spill` is on) and the rest is their credit. With no roster
 * person to hold a credit, an amount with nowhere to go is refused and says why: nothing is clipped, because a
 * clipped payment would not match the bank.
 */
export function planSubSending(amountText: string, sheet: { id: string; label: string; remaining: number }, ctx: SendingContext | null, opts: { spill: boolean } = { spill: true }): SendingPlan {
  if (!amountText.trim()) return { ok: false, reason: 'blank', error: 'Type the amount that was paid.' }
  const typed = parseSubPaymentAmount(amountText)
  const sent = cents(typed)
  if (!Number.isFinite(typed) || typed <= 0 || sent <= 0) return { ok: false, reason: 'invalid', error: 'Type an amount above zero, in dollars and cents.' }
  const left = cents(Math.max(0, sheet.remaining))
  if (left <= SUB_PAYMENT_TOLERANCE) return { ok: false, reason: 'nothing_left', error: 'This sheet has nothing left to pay.' }
  if (sent <= left + SUB_PAYMENT_TOLERANCE) {
    const leaves = Math.max(0, cents(left - sent))
    return { ok: true, sent, lines: [{ jobId: sheet.id, label: sheet.label, amount: sent, settles: leaves <= SUB_PAYMENT_TOLERANCE }], credit: 0, leaves, spills: false }
  }
  const lines: SendingLine[] = [{ jobId: sheet.id, label: sheet.label, amount: left, settles: true }]
  let extra = cents(sent - left)
  if (opts.spill) {
    for (const other of ctx?.others ?? []) {
      if (extra <= SUB_PAYMENT_TOLERANCE) break
      const owes = cents(other.remaining)
      const amount = Math.min(extra, owes)
      lines.push({ jobId: other.id, label: other.label, amount, settles: amount >= owes - SUB_PAYMENT_TOLERANCE })
      extra = cents(extra - amount)
    }
  }
  if (extra > SUB_PAYMENT_TOLERANCE && !ctx?.personId) {
    const where = lines.length > 1 ? 'this sheet and their other open sheets need' : 'this sheet needs'
    return { ok: false, reason: 'over', error: `${usd(sent)} is ${usd(extra)} more than ${where}. The extra would be kept as a credit, and a credit needs the sub on the roster as one person. Record up to ${usd(cents(sent - extra))} here.` }
  }
  return { ok: true, sent, lines, credit: extra > SUB_PAYMENT_TOLERANCE ? extra : 0, leaves: 0, spills: true }
}

/** The line under the amount when one sheet takes it all. Empty for a refusal and for a sending that spills, which draws its own list. */
export function sendingAfterWords(plan: SendingPlan): string {
  if (!plan.ok || plan.spills) return ''
  return plan.leaves <= SUB_PAYMENT_TOLERANCE ? 'This pays the sheet in full.' : `A part payment. ${usd(plan.leaves)} stays due on the sheet.`
}

/** `$1,000.00 on this sheet, paid in full` · `$300.00 on 2117 Alder Street` · `$200.00 kept as their credit`. */
export function sendingSpillLines(plan: SendingPlan): string[] {
  if (!plan.ok || !plan.spills) return []
  const out = plan.lines.map((l, i) => `${usd(l.amount)} on ${i === 0 ? 'this sheet' : l.label}${l.settles ? ', paid in full' : ''}`)
  if (plan.credit > 0) out.push(`${usd(plan.credit)} kept as their credit`)
  return out
}

/** What the credit can pay on a sheet today: the smaller of the two, to the cent. Zero when there is nothing to use. */
export function creditUsableOn(credit: number, remaining: number): number {
  const n = cents(Math.min(Math.max(0, credit), Math.max(0, remaining)))
  return n > SUB_PAYMENT_TOLERANCE ? n : 0
}

/** `Calloway Tile has a credit of $200.00.` */
export function creditOfferWords(name: string, credit: number): string {
  return `${name.trim() || 'This sub'} has a credit of ${usd(credit)}.`
}

/** `credit $200.00`, or '' when there is none. A figure below zero says so: a credit was taken away after it was used. */
export function creditNoteWords(credit: number): string {
  if (credit > SUB_PAYMENT_TOLERANCE) return `credit ${usd(credit)}`
  if (credit < -SUB_PAYMENT_TOLERANCE) return `credit short by ${usd(-credit)}`
  return ''
}
