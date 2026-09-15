/**
 * One row of the Job window's Bill-tab Invoices list, as words (v2.3478).
 *
 * Every bill reads the same three lines:
 *   1. chip · amount · actions          (the component)
 *   2. whoLine   — "sent Sep 4 to RMC-Dudley Mason" / "not sent · bills Maria"
 *   3. moneyLead · moneyDetail · promise — "$9,800 open · 21 d past expected · They said Sep 19"
 *
 * A bill is paid or it isn't (customers don't part-pay), so the state is the
 * chip and there is no per-row bar. A payment short of the amount — never in
 * practice — reads "$X short" in the detail rather than being a fourth state.
 * A row stamped paid with no payment behind it (a handful of pre-billing-model
 * stubs from early 2026) reads "marked paid · no payment on record" and counts
 * for nothing in the sum line — the sum uses the tiles' math (payments), so the
 * list and the tiles above it always agree.
 */
import { daysBetweenYmd, formatYmdMonthDay, type ExpectedPayModel } from './billedExpectedPay'

export type InvoiceLedgerState = 'draft' | 'open' | 'paid'

export type InvoiceLedgerPayment = { amount: number; paidOnYmd: string | null }

export type InvoiceLedgerRowInput = {
  /** jobs_ledger_invoices.status — ready_to_bill · billed · paid (anything else is not listed). */
  status: string | null
  amount: number
  /** The day the bill went out (sent_to_customer_at, else billed_at), YYYY-MM-DD. */
  sentYmd: string | null
  payments: ReadonlyArray<InvoiceLedgerPayment>
  /** Who the bill goes to, already resolved (customer / GC / someone else); null = unknown. */
  billsTo: string | null
  /** Stage Plan draw label ("Draw 2 · Top-out"), when the bill is a draw. */
  drawLabel: string | null
  /** The auto-maintained remainder draft. */
  isAutoRemainder: boolean
  /** The job's expected-pay model for this bill (Stages-card math), when the viewer may see it. */
  expected: ExpectedPayModel | null
}

export type InvoiceLedgerRow = {
  state: InvoiceLedgerState
  amount: number
  paid: number
  whoLine: string
  /** Muted tail on the who line. */
  whoNote: string | null
  moneyLead: string
  moneyDetail: string | null
  moneyTone: 'late' | 'muted' | null
  /** The customer's own word — "They said Sep 19", "· 3 d past" when broken. */
  promise: string | null
}

/** "$9,800" for whole dollars, "$9,800.50" otherwise. */
export function ledgerDollars(n: number): string {
  const whole = Math.abs(n - Math.round(n)) < 0.005
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`
}

/** Which rows the list shows, in the order it shows them: what needs sending, then what needs chasing, then what's done. */
export function invoiceLedgerState(status: string | null, amount: number, paid: number): InvoiceLedgerState | null {
  if (status === 'ready_to_bill') return 'draft'
  if (status === 'paid') return 'paid'
  if (status === 'billed') return paid >= amount - 0.005 && amount > 0 ? 'paid' : 'open'
  return null
}

const STATE_ORDER: Record<InvoiceLedgerState, number> = { draft: 0, open: 1, paid: 2 }

export function compareInvoiceLedgerRows(a: { state: InvoiceLedgerState; sentYmd: string | null }, b: { state: InvoiceLedgerState; sentYmd: string | null }): number {
  const d = STATE_ORDER[a.state] - STATE_ORDER[b.state]
  if (d !== 0) return d
  // Within a state, oldest first — the bill that has waited longest is nearest the top.
  return (a.sentYmd ?? '').localeCompare(b.sentYmd ?? '')
}

export function invoiceLedgerRow(input: InvoiceLedgerRowInput): InvoiceLedgerRow | null {
  const amount = Number(input.amount) || 0
  const paid = input.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const state = invoiceLedgerState(input.status, amount, paid)
  if (!state) return null

  const sent = input.sentYmd ? formatYmdMonthDay(input.sentYmd) : null
  const to = input.billsTo?.trim() || null

  if (state === 'draft') {
    return {
      state,
      amount,
      paid,
      whoLine: to ? `not sent · bills ${to}` : 'not sent',
      whoNote: input.isAutoRemainder ? 'auto remainder' : input.drawLabel,
      moneyLead: `${ledgerDollars(amount)} to bill`,
      moneyDetail: null,
      moneyTone: null,
      promise: null,
    }
  }

  const whoLine = sent ? (to ? `sent ${sent} to ${to}` : `sent ${sent}`) : to ? `bills ${to}` : 'sent'

  if (state === 'paid') {
    if (paid <= 0.005) {
      return {
        state,
        amount,
        paid,
        whoLine,
        whoNote: input.drawLabel,
        moneyLead: `${ledgerDollars(amount)} marked paid`,
        moneyDetail: 'no payment on record',
        moneyTone: 'muted',
        promise: null,
      }
    }
    const paidYmd = input.payments.reduce<string | null>((m, p) => (p.paidOnYmd && (!m || p.paidOnYmd > m) ? p.paidOnYmd : m), null)
    const days = paidYmd && input.sentYmd ? daysBetweenYmd(input.sentYmd, paidYmd) : null
    const detail = paidYmd ? `${formatYmdMonthDay(paidYmd)}${days != null && days >= 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}` : null
    return {
      state,
      amount,
      paid,
      whoLine,
      whoNote: input.drawLabel,
      moneyLead: `${ledgerDollars(amount)} paid`,
      moneyDetail: detail,
      moneyTone: detail ? 'muted' : null,
      promise: null,
    }
  }

  // open
  const short = paid > 0.005 && paid < amount ? amount - paid : 0
  let moneyDetail: string | null = null
  let moneyTone: InvoiceLedgerRow['moneyTone'] = null
  let promise: string | null = null
  const m = input.expected
  if (m?.source === 'promised') {
    promise = m.state === 'late' ? `They said ${formatYmdMonthDay(m.expectedYmd)} · ${m.daysLate} d past` : `They said ${formatYmdMonthDay(m.expectedYmd)}`
  } else if (m) {
    moneyDetail = m.state === 'late' ? `${m.daysLate} d past expected` : `expect ~${formatYmdMonthDay(m.expectedYmd)}`
    moneyTone = m.state === 'late' ? 'late' : 'muted'
  }
  if (short > 0) {
    moneyDetail = moneyDetail ? `${ledgerDollars(short)} short · ${moneyDetail}` : `${ledgerDollars(short)} short`
    moneyTone = moneyTone ?? 'late'
  }
  return {
    state,
    amount,
    paid,
    whoLine,
    whoNote: input.drawLabel,
    moneyLead: `${ledgerDollars(short > 0 ? short : amount)} open`,
    moneyDetail,
    moneyTone,
    promise,
  }
}

/**
 * The sum line under the list: paid + open = billed (drafts are not billed
 * yet). Paid is the payments on the listed bills — the tiles' math — so a row
 * marked paid with nothing behind it adds nothing; `unappliedPaid` is money
 * received on the job but on no bill, shown so the line still reaches the tiles.
 */
export function invoiceLedgerTotals(
  rows: ReadonlyArray<Pick<InvoiceLedgerRow, 'state' | 'amount' | 'paid'>>,
  unappliedPaid = 0,
): {
  paid: number
  open: number
  billed: number
  toBill: number
  unapplied: number
} {
  let paid = 0
  let open = 0
  let toBill = 0
  for (const r of rows) {
    if (r.state === 'paid') paid += r.paid
    else if (r.state === 'open') {
      paid += r.paid
      open += r.amount - r.paid
    } else toBill += r.amount
  }
  return { paid, open, billed: paid + open, toBill, unapplied: Math.max(0, unappliedPaid) }
}
