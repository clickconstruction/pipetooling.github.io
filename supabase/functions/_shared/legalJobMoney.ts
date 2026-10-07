/**
 * One job's money for a legal matter (punch list #85, item 5's rule, moved here by the item 20 review so
 * the firm's card and `submit-legal-portal`'s settlement floor read ONE rule). A payment linked to a bill
 * is that bill's; a payment with no bill pays the work on no sent bill first, then the sent bills oldest
 * first (`attributeJobPayments`). The balance is what the open billed lines still need, less any credit;
 * a refund on no bill is added back; a written-down part is not owed; a bill marked paid without money is
 * settled. A job with no open billed line owes its total less what was written down, paid, or marked paid.
 *
 * Pure and Deno-safe: `src/lib/legal/legalJobMoney.ts` is the client's door, and the packet kernel
 * (`legalPacket.ts` `legalJobMoney`) reads it.
 */
import { attributeJobPayments, isSentBill } from './paymentAttribution.ts'

export type LegalMoneyInvoice = {
  id: string
  amount?: number | string | null
  status?: string | null
  sequence_order?: number | null
  billed_at?: string | null
  agreed_write_down_at?: string | null
  agreed_write_down_previous_amount?: number | string | null
}
export type LegalMoneyPayment = { invoice_id?: string | null; amount?: number | string | null; paid_on?: string | null }
export type LegalMoneyJob = { revenue?: number | string | null; payments_made?: number | string | null; invoices?: ReadonlyArray<LegalMoneyInvoice> | null; payments?: ReadonlyArray<LegalMoneyPayment> | null }

export type LegalJobMoney = {
  balance: number
  /** What each open billed line still needs after its own money and its share of unlinked money. */
  openByInvoice: Map<string, number>
  /** Money that paid work on no sent bill: unlinked money the rule spent there, and money linked to a line never sent. */
  offBill: number
  /** Bills marked paid whose recorded money falls short of them: what no payment covers. */
  settledShort: Array<{ invoiceId: string; amount: number }>
  /** True when the job has no billed line and owes its job-level remainder. */
  shell: boolean
  /** Money paid beyond everything owed on the job: a credit to the customer, never a negative demand. 0 when none. */
  credit: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : 0
  return Number.isFinite(n) ? n : 0
}

/** What an agreed write-down took off a bill (its previous amount less what it bills now); 0 when none. */
export function invoiceWrittenDown(inv: Pick<LegalMoneyInvoice, 'amount' | 'agreed_write_down_at' | 'agreed_write_down_previous_amount'>): number {
  const prev = inv.agreed_write_down_previous_amount == null ? null : num(inv.agreed_write_down_previous_amount)
  const amt = num(inv.amount)
  return inv.agreed_write_down_at && prev != null && prev > amt ? round2(prev - amt) : 0
}

export function legalJobMoneyOf(job: LegalMoneyJob): LegalJobMoney {
  const invoices = [...(job.invoices ?? [])]
  const payments = [...(job.payments ?? [])]
  const billed = invoices.filter((i) => i.status === 'billed')
  const sent = invoices.filter((i) => isSentBill(i.status))
  const sentIds = new Set(sent.map((i) => i.id))
  // The written-down part of a bill is no longer owed; it is not work on no bill, so the rule gets the job total less it.
  const writtenDown = sent.reduce((s, i) => s + invoiceWrittenDown(i), 0)
  const jobTotal = job.revenue == null ? null : num(job.revenue) - writtenDown
  const att = attributeJobPayments(
    invoices.map((i) => ({ id: i.id, amount: i.amount ?? null, status: i.status ?? null, sequence_order: i.sequence_order ?? null, billed_at: i.billed_at ?? null })),
    payments.map((p) => ({ invoice_id: p.invoice_id ?? null, amount: p.amount ?? null, paid_on: p.paid_on ?? null })),
    jobTotal,
  )
  const appliedOf = (id: string) => att.byBill.get(id)?.applied ?? 0
  // A refund (a negative payment on no bill) is money handed back: the rule skips it, so it is added back here.
  const refunds = round2(payments.filter((p) => !p.invoice_id && num(p.amount) < 0).reduce((s, p) => s - num(p.amount), 0))
  // A bill marked paid whose recorded money falls short: no payment covers that part, and nobody owes it.
  const settledShort = sent
    .filter((i) => i.status === 'paid')
    .map((i) => ({ invoiceId: i.id, amount: round2(num(i.amount) - appliedOf(i.id)) }))
    .filter((x) => x.amount > 0.004)
  const shortTotal = settledShort.reduce((s, x) => s + x.amount, 0)
  if (billed.length === 0) {
    const raw = round2(num(job.revenue) - writtenDown - num(job.payments_made) - shortTotal)
    return { balance: Math.max(0, raw), openByInvoice: new Map(), offBill: 0, settledShort, shell: true, credit: Math.max(0, round2(-raw)) }
  }
  const openByInvoice = new Map<string, number>()
  let open = 0
  for (const i of billed) {
    const o = Math.max(0, round2(num(i.amount) - appliedOf(i.id)))
    openByInvoice.set(i.id, o)
    open += o
  }
  const overpaid = sent.reduce((s, i) => s + Math.max(0, round2(appliedOf(i.id) - num(i.amount))), 0)
  const linkedElsewhere = payments.filter((p) => p.invoice_id && !sentIds.has(p.invoice_id)).reduce((s, p) => s + num(p.amount), 0)
  const raw = round2(open - att.surplus - overpaid + refunds)
  return { balance: raw, openByInvoice, offBill: round2(att.offBill + linkedElsewhere), settledShort, shell: false, credit: Math.max(0, round2(-raw)) }
}
