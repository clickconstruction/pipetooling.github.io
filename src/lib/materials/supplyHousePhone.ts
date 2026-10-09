import { AGING_BUCKETS, daysPastDue, type AgingBucketKey, type SupplyHouseAgingRow } from '../supplyHouseAging'
import { isSupplyCredit } from '../supplyHouseDocument'
import { creditPairingLine } from './supplyHouseInvoiceForm'

/**
 * Supply houses on a phone (punch list #30, PR 5c). Pure: the balance per
 * house (lifted out of the tab's loader, where it had no test), the money a
 * house's card carries for the office, and a house's invoices as rows.
 */

export interface SupplyHouseBalanceInvoice {
  supply_house_id: string
  amount: number
  is_paid: boolean
  updated_at: string | null
  paid_at: string | null
}

export interface SupplyHouseBalanceRow {
  supply_house_id: string
  name: string
  /** Every unpaid paper on the house, credits included — what the balance nets to. */
  outstanding: number
  monthlyPaymentDay: number | null
  lastInvoiceUpdatedAt: string | null
  lastInvoicePaidAt: string | null
}

/** One row per house, the most owed first. A house with no invoices is listed at zero; an invoice on an unknown house is ignored. */
export function summarizeSupplyHouseBalances(houses: ReadonlyArray<{ id: string; name: string; monthly_payment_day: number | null }>, invoices: ReadonlyArray<SupplyHouseBalanceInvoice>): SupplyHouseBalanceRow[] {
  const owed = new Map<string, number>(houses.map((h) => [h.id, 0]))
  const updated = new Map<string, string>()
  const paid = new Map<string, string>()
  for (const inv of invoices) {
    if (!inv.is_paid && owed.has(inv.supply_house_id)) owed.set(inv.supply_house_id, (owed.get(inv.supply_house_id) ?? 0) + Number(inv.amount || 0))
    // ISO 8601 timestamps sort as text.
    if (inv.updated_at && inv.updated_at > (updated.get(inv.supply_house_id) ?? '')) updated.set(inv.supply_house_id, inv.updated_at)
    if (inv.is_paid && inv.paid_at && inv.paid_at > (paid.get(inv.supply_house_id) ?? '')) paid.set(inv.supply_house_id, inv.paid_at)
  }
  return houses
    .map((h) => ({ supply_house_id: h.id, name: h.name, outstanding: owed.get(h.id) ?? 0, monthlyPaymentDay: h.monthly_payment_day, lastInvoiceUpdatedAt: updated.get(h.id) ?? null, lastInvoicePaidAt: paid.get(h.id) ?? null }))
    .sort((a, b) => b.outstanding - a.outstanding)
}

export function ordinalDay(n: number): string {
  const v = n % 100
  const s = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${s}`
}

export interface SupplyHouseCardMoney {
  outstanding: number
  /** The aging buckets with anything in them, oldest last, as shares of what is owed. */
  segments: { key: AgingBucketKey; label: string; amount: number; share: number }[]
  /** `pays on the 10th`, '' when the house has no pay day. */
  payDayWords: string
}

/** What a house's card shows the office: the balance, the aging bar, the pay day. Keyed by house id; a house owing nothing still has an entry. */
export function supplyHouseCardMoney(balances: ReadonlyArray<SupplyHouseBalanceRow>, aging: ReadonlyArray<SupplyHouseAgingRow>): Record<string, SupplyHouseCardMoney> {
  const agingById = new Map(aging.map((r) => [r.supplyHouseId, r]))
  const out: Record<string, SupplyHouseCardMoney> = {}
  for (const b of balances) {
    const a = agingById.get(b.supply_house_id)
    const segments = a && a.total > 0.005 ? AGING_BUCKETS.filter((k) => a.buckets[k.key] > 0.005).map((k) => ({ key: k.key, label: k.label, amount: a.buckets[k.key], share: a.buckets[k.key] / a.total })) : []
    out[b.supply_house_id] = { outstanding: b.outstanding, segments, payDayWords: b.monthlyPaymentDay ? `pays on the ${ordinalDay(b.monthlyPaymentDay)}` : '' }
  }
  return out
}

export type SupplyHouseInvoiceTab = 'unpaid' | 'paid' | 'credits'

export interface SupplyHousePhoneInvoice {
  id: string
  invoice_number: string | null
  purchase_order_number: string | null
  due_date: string | null
  amount: number
  is_paid: boolean
  on_job_account?: boolean | null
  job_allocations?: { job_id: string; pct: number }[]
  /** v2.5035 · the kind and the pair, for the pair's words; optional until the types regenerate. */
  document_kind?: string | null
  credits_invoice_id?: string | null
}

const tabOf = (inv: SupplyHousePhoneInvoice): SupplyHouseInvoiceTab => (inv.is_paid ? 'paid' : isSupplyCredit(inv.amount) ? 'credits' : 'unpaid')

export function supplyHouseInvoiceTabCounts(invoices: ReadonlyArray<SupplyHousePhoneInvoice>): Record<SupplyHouseInvoiceTab, number> {
  const counts = { unpaid: 0, paid: 0, credits: 0 }
  for (const inv of invoices) counts[tabOf(inv)] += 1
  return counts
}

export interface SupplyHousePhoneInvoiceRow {
  id: string
  /** `88121 · PO-1041` */
  title: string
  /** `due Oct 2 · J1017 · J988 60%` */
  sub: string
  amountWords: string
  credit: boolean
  /** Days past due on an unpaid invoice, 0 when not. */
  pastDueDays: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDay = (ymd: string) => (/^\d{4}-\d{2}-\d{2}/.test(ymd) ? `${MONTHS[Number(ymd.slice(5, 7)) - 1] ?? ''} ${Number(ymd.slice(8, 10))}` : ymd)

/** A tab's invoices as rows, in the order handed in. `jobLabel` names a job id — the number, as the desk's table prints it. */
export function supplyHousePhoneInvoiceRows(
  invoices: ReadonlyArray<SupplyHousePhoneInvoice>,
  tab: SupplyHouseInvoiceTab,
  opts: { todayYmd: string; jobLabel: (jobId: string) => string; formatMoney: (n: number) => string },
): SupplyHousePhoneInvoiceRow[] {
  return invoices
    .filter((inv) => tabOf(inv) === tab)
    .map((inv) => {
      const credit = isSupplyCredit(inv.amount)
      const po = (inv.purchase_order_number ?? '').trim()
      const allocs = inv.job_allocations ?? []
      const jobs = allocs.map((a) => `${opts.jobLabel(a.job_id)}${allocs.length > 1 || a.pct !== 100 ? ` ${a.pct}%` : ''}`)
      const parts: string[] = []
      if (inv.due_date) parts.push(`due ${shortDay(inv.due_date)}`)
      else if (!inv.is_paid && !credit) parts.push('no due date')
      if (inv.on_job_account) parts.push('job account')
      parts.push(...jobs)
      // v2.5035 · a credit and the invoice it credits name each other.
      const pair = creditPairingLine(inv, invoices)
      if (pair) parts.push(pair.charAt(0).toLowerCase() + pair.slice(1))
      const past = !inv.is_paid && !credit && inv.due_date ? Math.max(0, daysPastDue(inv.due_date, opts.todayYmd)) : 0
      return {
        id: inv.id,
        title: [(inv.invoice_number ?? '').trim() || 'no number', po].filter(Boolean).join(' · '),
        sub: parts.join(' · '),
        amountWords: credit ? `− ${opts.formatMoney(Math.abs(inv.amount))}` : opts.formatMoney(inv.amount),
        credit,
        pastDueDays: past,
      }
    })
}
