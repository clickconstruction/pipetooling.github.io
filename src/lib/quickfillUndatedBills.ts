import { ageLabel, ageStateForDays, compareOldestFirst, UNDATED_BILL_AGE, ymdAgeDays, type AgeDescription } from './ageState'
import { formatYmdSlash } from './jobs/paySpeedsBreakdown'

/**
 * Kernel for the Quickfill "Missing bill dates" station (v2.2326): parses
 * get_undated_bill_worklist() and builds each row's date clue. The worklist is
 * the undated-bills backlog scoped by the No Count Date — only bills that
 * still affect the pay-speed math.
 *
 * Punch list #184 sweep B: the RPC orders by the latest activity, newest
 * first, with no LIMIT, so the station re-sorts after the read — the bill
 * made longest ago leads — and each row carries an age chip on the
 * `UNDATED_BILL_AGE` scale. No migration.
 */

export type UndatedBillPayment = { paidYmd: string; amount: number | null }

export type UndatedWorklistBill = {
  invoiceId: string
  amount: number
  status: string | null
  createdYmd: string | null
  /** Non-null only for billed-after-paid rows (v2.2337): the provably wrong recorded date. */
  billedYmd: string | null
  customerName: string | null
  jobId: string | null
  jobName: string | null
  address: string | null
  hcpNumber: string | null
  /** Newest first — the strongest clue for what the bill date was. */
  payments: UndatedBillPayment[]
}

export type UndatedBillWorklist = {
  noCountDate: string | null
  bills: UndatedWorklistBill[]
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

function ymd(v: unknown): string | null {
  return typeof v === 'string' && YMD_RE.test(v) ? v : null
}

function asBill(v: unknown): UndatedWorklistBill | null {
  if (v == null || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const invoiceId = str(o.invoiceId)
  const amount = typeof o.amount === 'number' && Number.isFinite(o.amount) ? o.amount : null
  if (invoiceId == null || amount == null) return null
  const payments: UndatedBillPayment[] = []
  if (Array.isArray(o.payments)) {
    for (const p of o.payments) {
      if (p == null || typeof p !== 'object') continue
      const paidYmd = ymd((p as Record<string, unknown>).paidYmd)
      if (paidYmd == null) continue
      const amt = (p as Record<string, unknown>).amount
      payments.push({ paidYmd, amount: typeof amt === 'number' && Number.isFinite(amt) ? amt : null })
    }
  }
  return {
    invoiceId,
    amount,
    status: str(o.status),
    createdYmd: ymd(o.createdYmd),
    billedYmd: ymd(o.billedYmd),
    customerName: str(o.customerName),
    jobId: str(o.jobId),
    jobName: str(o.jobName),
    address: str(o.address),
    hcpNumber: str(o.hcpNumber),
    payments,
  }
}

/** Defensive parse; null on gate-refused or malformed payloads. */
export function parseUndatedBillWorklist(raw: unknown): UndatedBillWorklist | null {
  if (raw == null || typeof raw !== 'object') return null
  const b = (raw as { bills?: unknown }).bills
  if (!Array.isArray(b)) return null
  const noCount = (raw as { noCountDate?: unknown }).noCountDate
  return {
    noCountDate: ymd(noCount),
    bills: b.map(asBill).filter((x): x is UndatedWorklistBill => x != null),
  }
}

/**
 * The row's date clue: a billed-after-paid row names its provably wrong date
 * ("billed 08/19 after paid 08/14" — v2.2337 guard); otherwise, when its
 * money landed ("paid 08/24", "paid 08/19 + 2 more") — the payment date is
 * usually days after the true bill date — or, for unpaid bills, when the
 * bill was created.
 */
export function undatedBillClue(bill: UndatedWorklistBill): string {
  const [first, ...rest] = bill.payments
  if (bill.billedYmd != null) {
    // payments are newest-first; name the earliest one the date contradicts
    const contradicted = [...bill.payments].reverse().find((p) => p.paidYmd < bill.billedYmd!)
    if (contradicted != null) {
      return `billed ${formatYmdSlash(bill.billedYmd)} after paid ${formatYmdSlash(contradicted.paidYmd)}`
    }
  }
  if (first != null) {
    const more = rest.length > 0 ? ` + ${rest.length} more` : ''
    return `paid ${formatYmdSlash(first.paidYmd)}${more}`
  }
  const created = bill.createdYmd ? ` · created ${formatYmdSlash(bill.createdYmd)}` : ''
  return `billed, unpaid${created}`
}

/** Search across the fields an assistant reaches for: customer, job, address, HCP. */
export function filterUndatedBills(bills: UndatedWorklistBill[], query: string): UndatedWorklistBill[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return bills
  return bills.filter((b) =>
    [b.customerName, b.jobName, b.address, b.hcpNumber].some((h) => h != null && h.toLowerCase().includes(needle)),
  )
}

/** Oldest first (punch list #184 sweep B): the bill made longest ago leads, a bill with no made date sinks last, ties keep the worklist's order. */
export function sortUndatedBillsOldestFirst<T extends Pick<UndatedWorklistBill, 'createdYmd'>>(bills: ReadonlyArray<T>): T[] {
  return [...bills].sort((a, b) => compareOldestFirst(a.createdYmd, b.createdYmd))
}

/** The row's age chip: whole days since the bill was made, on the UNDATED_BILL_AGE scale; null with no made date. */
export function undatedBillAge(bill: Pick<UndatedWorklistBill, 'createdYmd'>, todayYmd: string): AgeDescription | null {
  const days = ymdAgeDays(bill.createdYmd, todayYmd)
  if (days == null) return null
  return { days, state: ageStateForDays(days, UNDATED_BILL_AGE), label: ageLabel(days) }
}
