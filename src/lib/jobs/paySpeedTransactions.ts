/**
 * Kernel for the Data health drill-down (v2.2289): parses
 * get_pay_speed_transactions() and drives the modal's filter pills.
 *
 * Buckets mirror the strip's counts — measurable / unlinked / quarantined /
 * excluded for payments, plus the all-time undated-bills backlog as its own
 * lens. Excluded wins over the other statuses (the owner said so), matching
 * the RPC's CASE order.
 */

export type PaySpeedTxnStatus = 'measurable' | 'unlinked' | 'quarantined' | 'excluded'

export type PaySpeedTxn = {
  paymentId: string
  paidYmd: string
  /** When the payment was SENT (check date) — null until someone records it (v2.2309). */
  sentYmd: string | null
  amount: number
  paymentType: string | null
  customerName: string | null
  jobId: string | null
  jobName: string | null
  address: string | null
  billedYmd: string | null
  gapDays: number | null
  status: PaySpeedTxnStatus
}

export type UndatedBill = {
  invoiceId: string
  amount: number
  status: string | null
  customerName: string | null
  jobId: string | null
  jobName: string | null
  address: string | null
}

export type PaySpeedTransactions = {
  payments: PaySpeedTxn[]
  undatedBills: UndatedBill[]
  /** Dev-set floor (v2.2303): payments paid before this YMD are not counted anywhere. */
  noCountDate: string | null
}

export type DataHealthLens = 'all' | PaySpeedTxnStatus | 'undated'

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const STATUSES: PaySpeedTxnStatus[] = ['measurable', 'unlinked', 'quarantined', 'excluded']

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

function asTxn(v: unknown): PaySpeedTxn | null {
  if (v == null || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const paymentId = str(o.paymentId)
  const paidYmd = typeof o.paidYmd === 'string' && YMD_RE.test(o.paidYmd) ? o.paidYmd : null
  const amount = typeof o.amount === 'number' && Number.isFinite(o.amount) ? o.amount : null
  const status = STATUSES.includes(o.status as PaySpeedTxnStatus) ? (o.status as PaySpeedTxnStatus) : null
  if (paymentId == null || paidYmd == null || amount == null || status == null) return null
  const gap = o.gapDays
  return {
    paymentId,
    paidYmd,
    sentYmd: typeof o.sentYmd === 'string' && YMD_RE.test(o.sentYmd) ? o.sentYmd : null,
    amount,
    paymentType: str(o.paymentType),
    customerName: str(o.customerName),
    jobId: str(o.jobId),
    jobName: str(o.jobName),
    address: str(o.address),
    billedYmd: typeof o.billedYmd === 'string' && YMD_RE.test(o.billedYmd) ? o.billedYmd : null,
    gapDays: typeof gap === 'number' && Number.isFinite(gap) && gap >= 0 ? Math.round(gap) : null,
    status,
  }
}

function asBill(v: unknown): UndatedBill | null {
  if (v == null || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const invoiceId = str(o.invoiceId)
  const amount = typeof o.amount === 'number' && Number.isFinite(o.amount) ? o.amount : null
  if (invoiceId == null || amount == null) return null
  return {
    invoiceId,
    amount,
    status: str(o.status),
    customerName: str(o.customerName),
    jobId: str(o.jobId),
    jobName: str(o.jobName),
    address: str(o.address),
  }
}

/** Defensive parse; null on gate-refused or malformed payloads. */
export function parsePaySpeedTransactions(raw: unknown): PaySpeedTransactions | null {
  if (raw == null || typeof raw !== 'object') return null
  const p = (raw as { payments?: unknown }).payments
  const u = (raw as { undatedInvoices?: unknown }).undatedInvoices
  if (!Array.isArray(p) || !Array.isArray(u)) return null
  const noCount = (raw as { noCountDate?: unknown }).noCountDate
  return {
    payments: p.map(asTxn).filter((t): t is PaySpeedTxn => t != null),
    undatedBills: u.map(asBill).filter((b): b is UndatedBill => b != null),
    noCountDate: typeof noCount === 'string' && YMD_RE.test(noCount) ? noCount : null,
  }
}

export function lensCounts(data: PaySpeedTransactions): Record<DataHealthLens, number> {
  const c: Record<DataHealthLens, number> = {
    all: data.payments.length,
    measurable: 0,
    unlinked: 0,
    quarantined: 0,
    excluded: 0,
    undated: data.undatedBills.length,
  }
  for (const t of data.payments) c[t.status] += 1
  return c
}

function matchesQuery(hay: (string | null)[], q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (needle === '') return true
  return hay.some((h) => h != null && h.toLowerCase().includes(needle))
}

export function filterTxns(data: PaySpeedTransactions, lens: DataHealthLens, query: string): PaySpeedTxn[] {
  if (lens === 'undated') return []
  return data.payments.filter(
    (t) => (lens === 'all' || t.status === lens) && matchesQuery([t.customerName, t.jobName, t.address], query),
  )
}

export function filterBills(data: PaySpeedTransactions, query: string): UndatedBill[] {
  return data.undatedBills.filter((b) => matchesQuery([b.customerName, b.jobName, b.address], query))
}

export type PaymentLineItem = {
  name: string
  count: number
  unitPrice: number | null
  description: string | null
  amount: number | null
}

export type PaymentLineItems = {
  /** true = these are the linked bill's lines; false = the job's lines shown as context. */
  linked: boolean
  billAmount: number | null
  items: PaymentLineItem[]
}

/** Defensive parse of get_payment_line_items; null on gate-refused/malformed. */
export function parsePaymentLineItems(raw: unknown): PaymentLineItems | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.linked !== 'boolean' || !Array.isArray(o.items)) return null
  const items: PaymentLineItem[] = []
  for (const v of o.items) {
    if (v == null || typeof v !== 'object') continue
    const it = v as Record<string, unknown>
    const name = typeof it.name === 'string' ? it.name : null
    const count = typeof it.count === 'number' && Number.isFinite(it.count) ? it.count : null
    if (name == null || count == null) continue
    items.push({
      name,
      count,
      unitPrice: typeof it.unitPrice === 'number' && Number.isFinite(it.unitPrice) ? it.unitPrice : null,
      description: typeof it.description === 'string' && it.description.trim() !== '' ? it.description : null,
      amount: typeof it.amount === 'number' && Number.isFinite(it.amount) ? it.amount : null,
    })
  }
  return {
    linked: o.linked,
    billAmount: typeof o.billAmount === 'number' && Number.isFinite(o.billAmount) ? o.billAmount : null,
    items,
  }
}

/** Defensive parse of get_payment_line_items_bulk: paymentId → PaymentLineItems. */
export function parsePaymentLineItemsBulk(raw: unknown): Record<string, PaymentLineItems> {
  const out: Record<string, PaymentLineItems> = {}
  if (raw == null || typeof raw !== 'object') return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parsePaymentLineItems(v)
    if (parsed != null) out[id] = parsed
  }
  return out
}
