/**
 * Record payment on a sub sheet (v2.7176): what is left on the sheet, what a typed amount does to it, the refusal
 * past it, and how the payment was sent.
 *
 * The window is the pay stubs' Record payment window (People → Pay stubs) on a sub sheet, so a sheet is paid down
 * in parts the same way a pay report is. Two things differ, on purpose:
 *
 * - **An amount past what is left** was refused here until v2.7235. The owner's answer was a credit, and the
 *   window now plans the extra through `subSending.ts`. `planSubPayment` stays as the gate for a caller that
 *   knows nothing about the sub's other sheets.
 * - **The methods are a sub's**: a check and Zelle lead, since that is how subs are paid. The pay stubs' kinds
 *   (`lib/people/paySources.ts`) are shared with SQL functions and stay as they are.
 *
 * Pure: no React, no Supabase.
 */

/** How a sub was paid, in the order the chips draw. Stored on `people_labor_job_payments.method`. */
export const SUB_PAY_METHODS = ['check', 'zelle', 'mercury', 'cashapp', 'apple_pay', 'cash', 'client_direct', 'other'] as const
export type SubPayMethod = (typeof SUB_PAY_METHODS)[number]

export function isSubPayMethod(value: unknown): value is SubPayMethod {
  return typeof value === 'string' && (SUB_PAY_METHODS as readonly string[]).includes(value)
}

const METHOD_LABEL: Record<SubPayMethod, string> = {
  check: 'Check',
  zelle: 'Zelle',
  mercury: 'Mercury',
  cashapp: 'Cash App',
  apple_pay: 'Apple Pay',
  cash: 'Cash',
  client_direct: 'Client direct',
  other: 'Other',
}

/** A payment made from the sub's credit (v2.7235): no money left the bank. Stored as a method, never offered as a chip. */
export const SUB_PAY_FROM_CREDIT = 'credit'

export function subPayMethodLabel(method: SubPayMethod | string | null | undefined): string {
  if (method === SUB_PAY_FROM_CREDIT) return 'From credit'
  return isSubPayMethod(method) ? METHOD_LABEL[method] : ''
}

/** The chips, as the picker reads them. */
export const SUB_PAY_METHOD_OPTIONS: ReadonlyArray<{ key: SubPayMethod; label: string }> = SUB_PAY_METHODS.map((key) => ({ key, label: METHOD_LABEL[key] }))

/** The box a method opens for its own number, or null when it has none a person can read off. */
export function subPayMethodRefField(method: SubPayMethod | null): { label: string; placeholder: string } | null {
  if (method === 'check') return { label: 'Check number (optional)', placeholder: '1187' }
  if (method === 'cashapp') return { label: 'Cash App transaction id (optional)', placeholder: '#D-3V3MVPKVP' }
  if (method === 'zelle' || method === 'mercury') return { label: 'Confirmation number (optional)', placeholder: '' }
  return null
}

/** What is stored for a pick: the method and its number, trimmed; a number with no method is dropped. */
export function subPayMethodWrite(method: SubPayMethod | null, ref: string | null | undefined): { method: SubPayMethod | null; method_ref: string | null } {
  if (!method) return { method: null, method_ref: null }
  const r = subPayMethodRefField(method) ? (ref ?? '').trim() : ''
  return { method, method_ref: r || null }
}

/** `Check 1187` · `Zelle` · '' — how a payment says its method on a row. */
export function subPayMethodWords(p: { method?: string | null; method_ref?: string | null }): string {
  const label = subPayMethodLabel(p.method)
  if (!label) return ''
  const ref = (p.method_ref ?? '').trim()
  return ref ? `${label} ${ref}` : label
}

const cents = (n: number): number => Math.round(n * 100) / 100
const usd = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Under this many dollars a sheet is settled: a float's dust is not a balance. */
export const SUB_PAYMENT_TOLERANCE = 0.005

export type SubSheetMoney = {
  /** What the sheet is for. */
  total: number
  /** Payments so far. */
  paid: number
  /** Back-charges so far, as a positive number. */
  backcharged: number
  /** total − paid − backcharged, never below zero. */
  remaining: number
}

/** A sheet's money from its payment rows: a row above zero is a payment, a row below is a back-charge. */
export function subSheetMoney(total: number, payments: ReadonlyArray<{ amount: number | string }> | null | undefined): SubSheetMoney {
  let paid = 0
  let backcharged = 0
  for (const p of payments ?? []) {
    const a = Number(p.amount)
    if (!Number.isFinite(a)) continue
    if (a >= 0) paid += a
    else backcharged += -a
  }
  paid = cents(paid)
  backcharged = cents(backcharged)
  return { total: cents(total), paid, backcharged, remaining: Math.max(0, cents(total - paid - backcharged)) }
}

/** The Amount paid box as a number: commas and a dollar sign dropped, `NaN` when it is not one. */
export function parseSubPaymentAmount(amountText: string): number {
  const t = amountText.trim().replace(/[$,\s]/g, '')
  return /^\d*\.?\d+$|^\d+\.$/.test(t) ? parseFloat(t) : NaN
}

/** What the Amount paid box opens with: what is left, or blank when nothing is. */
export function subPaymentAmountDefault(remaining: number): string {
  return remaining > SUB_PAYMENT_TOLERANCE ? cents(remaining).toFixed(2) : ''
}

export type SubPaymentPlan =
  | { ok: true; amount: number; leaves: number; settles: boolean }
  | { ok: false; reason: 'blank' | 'invalid' | 'nothing_left' | 'over'; error: string; over?: number }

/**
 * The Record payment press's gate. An amount up to what is left is recorded whole, to the cent. An amount past it
 * is refused and says by how much: nothing is clipped, because a clipped payment would not match the bank.
 */
export function planSubPayment(amountText: string, remaining: number): SubPaymentPlan {
  if (!amountText.trim()) return { ok: false, reason: 'blank', error: 'Type the amount that was paid.' }
  const typed = parseSubPaymentAmount(amountText)
  if (!Number.isFinite(typed) || typed <= 0) return { ok: false, reason: 'invalid', error: 'Type an amount above zero, in dollars and cents.' }
  const amount = cents(typed)
  if (amount <= 0) return { ok: false, reason: 'invalid', error: 'Type an amount above zero, in dollars and cents.' }
  const left = cents(remaining)
  if (left <= SUB_PAYMENT_TOLERANCE) return { ok: false, reason: 'nothing_left', error: 'This sheet has nothing left to pay.' }
  if (amount > left + SUB_PAYMENT_TOLERANCE) {
    const over = cents(amount - left)
    return { ok: false, reason: 'over', over, error: `${usd(amount)} is ${usd(over)} more than the ${usd(left)} left on this sheet. Record up to ${usd(left)} here.` }
  }
  const leaves = Math.max(0, cents(left - amount))
  return { ok: true, amount, leaves, settles: leaves <= SUB_PAYMENT_TOLERANCE }
}

/** The line under the amount: what the sheet reads after this payment. Empty until the amount is one that can be recorded. */
export function subPaymentAfterWords(plan: SubPaymentPlan): string {
  if (!plan.ok) return ''
  return plan.settles ? 'This pays the sheet in full.' : `A part payment. ${usd(plan.leaves)} stays due on the sheet.`
}

/** `Sub Sam · HCP-77 · Total $500.00 · Paid $100.00 · Remaining $400.00`: the window's one grey line. */
export function subPaymentSummaryWords(t: { contractor: string; hcp: string; totalCost: number; paid: number; outstanding: number }): string {
  return [t.contractor, t.hcp, `Total ${usd(t.totalCost)}`, `Paid ${usd(t.paid)}`, `Remaining ${usd(Math.max(0, t.outstanding))}`].filter((s) => s && s.trim()).join(' · ')
}
