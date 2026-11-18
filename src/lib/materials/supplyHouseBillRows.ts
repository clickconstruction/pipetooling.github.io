/**
 * A supply house's bills, shaped for the windows that draw them.
 *
 * These were built inside `SupplyHousesTab`'s render, with no test: what each bill lists for once a payment has
 * taken part of it, what paid it, which receipt link it shows, and the job label the card and both payment windows
 * repeat. Lifted as they stood (SupplyHousesTab map, extraction step 1), so the card, the phone screen, Record a
 * payment and a payment's own window read one rule each.
 */
import type { SupplyBillCardRow } from '../../components/materials/SupplyHouseBillsCard'
import type { RecordSupplyPaymentBill } from '../../components/materials/RecordSupplyPaymentModal'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { parsePoGeneratorCodeFromPurchaseOrderName } from '../parsePoGeneratorCodeFromPurchaseOrderName'
import { rowLinesWords, type PaperRow } from './lines/paperRows'
import { interestTitle } from './payments/supplyInterest'
import { billPaidBy, houseOnAccount, paidByBill, partPaidWords, supplyBillOpen, type SupplyPayment, type SupplyPaymentLine } from './payments/supplyPayment'
import { billMoveTrace, type MoveBill, type SupplyPaymentEvent } from './payments/supplyPaymentMove'
import { creditPairingLine } from './supplyHouseInvoiceForm'

/** The jobs a house's bills are put to, by job id, as the tab reads them from `get_jobs_ledger_by_ids`. */
export type SupplyBillJobNames = Readonly<Record<string, { hcp_number: string; click_number?: string; job_name: string } | undefined>>

/** A `get_jobs_ledger_by_ids` row, as far as the supply house windows read it. */
export type JobsLedgerNameRow = { id: string; hcp_number?: string | null; click_number?: string | null; job_name?: string | null; job_address?: string | null }

/** The jobs by id, every missing word an empty string. The tab wrote this map three times. */
export function jobsLedgerNames(rows: ReadonlyArray<JobsLedgerNameRow>): Record<string, { hcp_number: string; click_number: string; job_name: string }> {
  const map: Record<string, { hcp_number: string; click_number: string; job_name: string }> = {}
  for (const r of rows) map[r.id] = { hcp_number: r.hcp_number ?? '', click_number: r.click_number ?? '', job_name: r.job_name ?? '' }
  return map
}

/** The same map with each job's address, for the invoice form's job cards. */
export function jobsLedgerNamesWithAddress(rows: ReadonlyArray<JobsLedgerNameRow>): Record<string, { hcp_number: string; click_number: string; job_name: string; job_address: string }> {
  const map: Record<string, { hcp_number: string; click_number: string; job_name: string; job_address: string }> = {}
  for (const r of rows) map[r.id] = { hcp_number: r.hcp_number ?? '', click_number: r.click_number ?? '', job_name: r.job_name ?? '', job_address: r.job_address ?? '' }
  return map
}

/** A house's payments as the tab holds them (`HousePayments`). */
export type SupplyBillPayments = { payments: ReadonlyArray<SupplyPayment>; lines: ReadonlyArray<SupplyPaymentLine>; events?: ReadonlyArray<SupplyPaymentEvent> }

/** A bill as the house's detail read hands it over: the row, with the jobs it is put to. */
export type SupplyBillSource = {
  id: string
  invoice_number: string
  purchase_order_number: string | null
  invoice_date: string
  due_date: string | null
  amount: number
  is_paid: boolean
  paid_at: string | null
  link: string | null
  payment_link?: string | null
  on_job_account: boolean | null
  bill_read?: unknown
  is_interest?: boolean | null
  late_invoice_id?: string | null
  document_kind?: string | null
  credits_invoice_id?: string | null
  job_allocations?: ReadonlyArray<{ job_id: string; pct: number }>
}

/** `1017 · Elm Street`, or the job id's first eight letters while its name has not read. */
export function allocationJobLabel(jobId: string, jobs: SupplyBillJobNames): string {
  const d = jobs[jobId]
  return d ? `${effectiveJobLedgerNumber(d.hcp_number, d.click_number)} · ${d.job_name}` : jobId.slice(0, 8)
}

/** The bills a house's card lists: every bill with Show paid on, else the unpaid ones and any marked paid on this visit, which stay where they were. */
export function supplyBillsToList<T extends { id: string; is_paid: boolean }>(invoices: ReadonlyArray<T>, showPaid: boolean, paidThisVisit: ReadonlySet<string>): ReadonlyArray<T> {
  return showPaid ? invoices : invoices.filter((inv) => !inv.is_paid || paidThisVisit.has(inv.id))
}

/**
 * The card's rows. `shown` is what is listed, `all` is every bill of the house, paid ones too: a credit and the bill
 * it credits name each other across both, and so does interest and the bill that ran late.
 */
export function supplyBillCardRows(input: {
  shown: ReadonlyArray<SupplyBillSource>
  all: ReadonlyArray<SupplyBillSource>
  payments: SupplyBillPayments
  jobs: SupplyBillJobNames
  /** The house's PO Generator codes; null when that read failed, and then no bill wears the warning. */
  ledgerCodes: ReadonlySet<number> | null
  papers: ReadonlyMap<string, PaperRow>
  paperNames: ReadonlyMap<string, string>
}): SupplyBillCardRow[] {
  const { shown, all, payments, jobs, ledgerCodes, papers, paperNames } = input
  const paidOnBills = paidByBill(payments.payments, payments.lines)
  return shown.map((inv) => {
    const poGenCode = parsePoGeneratorCodeFromPurchaseOrderName(inv.purchase_order_number ?? '')
    // Supply house bill lines (punch list #298 PR 1b): what was read off the PDF, and Look when there is a paper.
    const paper = papers.get(inv.id) ?? null
    // What paid it: the payment's method and number, and how many bills it covered.
    const paidBy = billPaidBy(inv.id, payments.payments, payments.lines, { sayMissing: true })
    // A bill paid in part lists for what is left on it, and says what was paid.
    const paidOnIt = paidOnBills.get(inv.id) ?? 0
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      purchase_order_number: inv.purchase_order_number,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      amount: inv.is_paid ? inv.amount : supplyBillOpen(inv, paidOnIt),
      partPaid: partPaidWords(inv, paidOnIt),
      is_paid: inv.is_paid,
      paidYmd: inv.paid_at ? calendarYmdInAppTzFromIso(inv.paid_at) : null,
      paidBy: inv.is_paid ? paidBy.words : '',
      seePayment: inv.is_paid && paidBy.typed.length > 0,
      needsHow: inv.is_paid && paidBy.needsHowId != null,
      link: inv.link,
      // The bill's own receipt link first (a by-hand Mark paid's, and every bill paid before payments were rows).
      payment_link: inv.payment_link ?? paidBy.receiptLink,
      on_job_account: inv.on_job_account,
      jobs: (inv.job_allocations ?? []).map((a) => ({ label: allocationJobLabel(a.job_id, jobs), pct: a.pct })),
      poMismatch: poGenCode != null && ledgerCodes != null && !ledgerCodes.has(poGenCode),
      // v2.5035 · a credit and the invoice it credits name each other; read against every row, paid ones too.
      pairLine: creditPairingLine(inv, all),
      interest: interestTitle(inv, all),
      // Where a payment's money moved to or from this bill, and who moved it.
      trace: billMoveTrace(inv.id, payments.events ?? []),
      lines: rowLinesWords(paper, { link: inv.link, hasFile: !!inv.bill_read }, paper?.acceptedBy ? paperNames.get(paper.acceptedBy) : null),
    }
  })
}

/** The phone screen's bills: an unpaid bill lists for what is left on it, and says what was paid. A bill nothing is on comes back as it was. */
export function supplyPhoneBills<T extends { id: string; amount: number; is_paid: boolean }>(invoices: ReadonlyArray<T>, payments: SupplyBillPayments): Array<T | (T & { partPaid: string })> {
  const paidOnBills = paidByBill(payments.payments, payments.lines)
  return invoices.map((inv) => {
    const paidOnIt = paidOnBills.get(inv.id) ?? 0
    return inv.is_paid || paidOnIt === 0 ? inv : { ...inv, amount: supplyBillOpen(inv, paidOnIt), partPaid: partPaidWords(inv, paidOnIt) }
  })
}

/** The paid bills a typed payment stands behind: their press opens the payment, since Mark unpaid would not unmake it. */
export function typedPaidBillIds(invoices: ReadonlyArray<{ id: string; is_paid: boolean }>, payments: SupplyBillPayments): Set<string> {
  return new Set(invoices.filter((inv) => inv.is_paid && billPaidBy(inv.id, payments.payments, payments.lines).typed.length > 0).map((inv) => inv.id))
}

/** What the house holds on account: the sum of what its payments sent past their bills. */
export function houseOnAccountTotal(payments: SupplyBillPayments): number {
  return houseOnAccount(payments.payments, payments.lines).reduce((sum, x) => sum + x.amount, 0)
}

const jobLabels = (inv: SupplyBillSource, jobs: SupplyBillJobNames): string[] => (inv.job_allocations ?? []).map((a) => allocationJobLabel(a.job_id, jobs))

/** Record a payment's bills. A bill's title is its interest words, else its jobs, else its PO's words, else that it has no job. */
export function recordPaymentBills(all: ReadonlyArray<SupplyBillSource>, jobs: SupplyBillJobNames): RecordSupplyPaymentBill[] {
  return all.map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    due_date: inv.due_date,
    amount: inv.amount,
    is_paid: inv.is_paid,
    is_interest: inv.is_interest,
    title: interestTitle(inv, all) ?? (jobLabels(inv, jobs).join(', ') || inv.purchase_order_number?.trim() || 'No job on this bill'),
  }))
}

/** A payment's own window lists the house's bills by their interest words or their jobs. A bill on no job has an empty title there. */
export function paymentWindowBills(all: ReadonlyArray<SupplyBillSource>, jobs: SupplyBillJobNames): MoveBill[] {
  return all.map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    title: interestTitle(inv, all) ?? jobLabels(inv, jobs).join(', '),
    amount: inv.amount,
    is_paid: inv.is_paid,
    due_date: inv.due_date,
  }))
}
