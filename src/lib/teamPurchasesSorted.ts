/**
 * Team purchases follow-up → Sorted (v2.4566): the words for a card charge the office already
 * sorted, and the sum that says whether the invoices ticked for a charge add up to it.
 * Pure — the read is `list_recently_sorted_mercury_transactions_for_tally_staff`.
 */
import type { Json } from '../types/database'
import { APP_CALENDAR_TZ, denverCalendarDayKey } from '../utils/dateUtils'
import { formatJobLedgerShortLine, type LedgerPrefixMap } from './ledgerDisplayPrefixes'

/** One row of `list_recently_sorted_mercury_transactions_for_tally_staff`. */
export type SortedTeamPurchaseRow = {
  target_user_id: string
  target_name: string | null
  mercury_transaction_id: string
  posted_at: string | null
  amount: number
  counterparty_name: string | null
  note: string | null
  mercury_account_id: string | null
  currency: string | null
  mercury_id: string | null
  raw: Json | null
  job_splits: Json | null
  invoice_links: Json | null
  sorted_at: string | null
  sorted_by_name: string | null
}

export type SortedJobSplit = {
  jobId: string
  amount: number
  hcpNumber: string | null
  clickNumber: string | null
  jobName: string | null
  serviceTypeId: string | null
}

export type SortedInvoiceLink = {
  invoiceId: string
  invoiceNumber: string
  supplyHouseName: string
  amount: number
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
const cents = (n: number): number => Math.round(n * 100)

function money(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function parseSortedJobSplits(json: Json | null | undefined): SortedJobSplit[] {
  if (!Array.isArray(json)) return []
  const out: SortedJobSplit[] = []
  for (const item of json) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const jobId = str(o.job_id)
    if (!jobId) continue
    out.push({
      jobId,
      amount: num(o.amount),
      hcpNumber: str(o.hcp_number),
      clickNumber: str(o.click_number),
      jobName: str(o.job_name),
      serviceTypeId: str(o.service_type_id),
    })
  }
  return out
}

export function parseSortedInvoiceLinks(json: Json | null | undefined): SortedInvoiceLink[] {
  if (!Array.isArray(json)) return []
  const out: SortedInvoiceLink[] = []
  for (const item of json) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const invoiceId = str(o.invoice_id)
    if (!invoiceId) continue
    out.push({
      invoiceId,
      invoiceNumber: str(o.invoice_number) ?? '—',
      supplyHouseName: str(o.supply_house_name) ?? 'Supply house',
      amount: num(o.amount),
    })
  }
  return out
}

export type InvoiceTotalTone = 'none' | 'match' | 'short' | 'over'

export type InvoiceTotal = {
  tone: InvoiceTotalTone
  /** Dollars of the charge no ticked invoice covers; 0 unless `short`. */
  shortBy: number
  /** One line for the picker and the Sorted row; empty when nothing is ticked. */
  words: string
}

/**
 * Do the ticked invoices add up to the card charge? Compared in cents. A charge is negative on
 * the bank's side and an invoice positive, so the charge is taken by its size.
 */
export function invoiceTotalForCharge(chargeAmount: number, invoiceAmounts: readonly number[]): InvoiceTotal {
  if (invoiceAmounts.length === 0) return { tone: 'none', shortBy: 0, words: '' }
  const charge = Math.abs(cents(chargeAmount))
  const total = invoiceAmounts.reduce((s, a) => s + cents(a), 0)
  const diff = charge - total
  if (diff === 0) return { tone: 'match', shortBy: 0, words: 'The invoices add up to the charge' }
  if (diff > 0) {
    return { tone: 'short', shortBy: diff / 100, words: `${money(diff / 100)} of the charge has no invoice yet` }
  }
  return { tone: 'over', shortBy: 0, words: `The invoices come to ${money(-diff / 100)} more than the charge` }
}

/** True when the row is matched to invoices that leave part of the charge uncovered. */
export function sortedRowIsShort(row: Pick<SortedTeamPurchaseRow, 'amount' | 'invoice_links'>): boolean {
  const invoices = parseSortedInvoiceLinks(row.invoice_links)
  return invoiceTotalForCharge(Number(row.amount), invoices.map((i) => i.amount)).tone === 'short'
}

/** Where the charge went, one line per kind: the jobs, then the invoices. */
export function sortedWentToLines(
  row: Pick<SortedTeamPurchaseRow, 'job_splits' | 'invoice_links'>,
  prefixMap: LedgerPrefixMap,
): string[] {
  const lines: string[] = []
  const jobs = parseSortedJobSplits(row.job_splits)
  const label = (j: SortedJobSplit) =>
    formatJobLedgerShortLine(prefixMap, j.serviceTypeId, j.hcpNumber, j.jobName, j.clickNumber)
  if (jobs.length === 1) lines.push(label(jobs[0]!))
  else if (jobs.length > 1) {
    lines.push(`${jobs.length} jobs · ${jobs.map((j) => `${label(j)} ${money(Math.abs(j.amount))}`).join(', ')}`)
  }
  const invoices = parseSortedInvoiceLinks(row.invoice_links)
  if (invoices.length > 0) {
    const each = invoices.map((i) => `${i.supplyHouseName} #${i.invoiceNumber} (${money(i.amount)})`).join(', ')
    lines.push(`${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'} · ${each}`)
  }
  return lines
}

/** "sorted today by Taunya" · "sorted Oct 2 by Taunya" · "sorted Oct 2". */
export function sortedWhenWords(sortedAtIso: string | null, byName: string | null, nowMs: number): string {
  const by = byName?.trim() ? ` by ${byName.trim().split(/\s+/)[0]}` : ''
  if (!sortedAtIso) return `sorted${by}`
  const ms = new Date(sortedAtIso).getTime()
  if (!Number.isFinite(ms)) return `sorted${by}`
  if (denverCalendarDayKey(ms) === denverCalendarDayKey(nowMs)) return `sorted today${by}`
  const day = new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })
  return `sorted ${day}${by}`
}
