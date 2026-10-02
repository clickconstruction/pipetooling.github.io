/**
 * Deno port of the Money-waiting view-model for money-waiting-email-dispatch
 * (v2.2565). SOURCE OF TRUTH: src/lib/jobs/moneyWaiting.ts (buildMoneyWaiting
 * + billWaitTone) — keep in sync. Operates on the payload RPC's invoice rows
 * (get_money_waiting_email_payload: the forecast payload rows + job_address)
 * instead of client StageRows; the grouping, baselines, tones, and sort are
 * verbatim.
 */
import {
  PAY_SPEED_MIN_SAMPLES,
  billedReferenceYmd,
  daysBetweenYmd,
  type PayloadPaySpeeds,
} from './paymentForecastCore.ts'

export type MoneyWaitingPayloadRow = {
  invoice_id: string
  job_id: string
  display_number: string | null
  job_name: string | null
  job_address: string | null
  customer_id: string | null
  customer_name: string | null
  /** v2.4362: whoever the bill went to (the GC on a GC-billed bill); null = someone else. Absent on an older payload. */
  payer_id?: string | null
  payer_name?: string | null
  billed_at: string | null
  est_bill_ymd: string | null
  remaining: number
}

/**
 * Who the list files a row under (v2.4367, the app's `listPayer`): the payer once the payload
 * carries it, else (a bill typed to someone else, or an older payload) the job's customer.
 */
export function moneyWaitingRowPayer(r: Pick<MoneyWaitingPayloadRow, 'payer_id' | 'payer_name' | 'customer_id' | 'customer_name'>): { id: string | null; name: string | null } {
  if (r.payer_id) return { id: r.payer_id, name: (r.payer_name ?? '').trim() || null }
  const id = (r.customer_id ?? '').trim() || null
  return { id, name: id ? (r.customer_name ?? '').trim() || null : null }
}

export type MoneyWaitingEmailPayload = {
  generated_at: string
  today: string
  rows: MoneyWaitingPayloadRow[]
  pay_speeds: PayloadPaySpeeds | null
}

export type OpenBillTone = 'ok' | 'warn' | 'late' | 'undated'

export type OpenBill = {
  jobId: string | null
  jobName: string
  /** Full job address as stored — city included, never truncated (owner ask). */
  address: string | null
  billedYmd: string | null
  waitDays: number | null
  open: number
  tone: OpenBillTone
}

export type MoneyWaitingRow = {
  customerId: string
  name: string
  segment: 'residential' | 'commercial' | null
  ownMedianDays: number | null
  baselineDays: number
  oldestWaitDays: number
  open: number
  bills: OpenBill[]
}

export type MoneyWaiting = {
  rows: MoneyWaitingRow[]
  onPaceCount: number
  onPaceOpen: number
  companyMedianDays: number
}

/** ok at/under baseline · warn over it · late at twice it or more · undated when the bill has no date. */
export function billWaitTone(waitDays: number | null, baselineDays: number): OpenBillTone {
  if (waitDays == null) return 'undated'
  if (baselineDays > 0 && waitDays >= baselineDays * 2) return 'late'
  if (waitDays > baselineDays) return 'warn'
  return 'ok'
}

export function buildMoneyWaitingFromPayload(p: MoneyWaitingEmailPayload): MoneyWaiting | null {
  const paySpeeds = p.pay_speeds
  const company = paySpeeds?.company
  if (!paySpeeds || !company) return null

  type RawBill = Omit<OpenBill, 'tone'>
  type Acc = { name: string; open: number; bills: RawBill[] }
  const byCustomer = new Map<string, Acc>()
  for (const r of p.rows) {
    const open = Number(r.remaining) || 0
    if (open <= 0) continue
    const payer = moneyWaitingRowPayer(r)
    const customerId = payer.id
    if (!customerId) continue
    const refYmd = billedReferenceYmd({ billed_at: r.billed_at, est_bill_ymd: r.est_bill_ymd })
    const rawWait = refYmd ? daysBetweenYmd(refYmd, p.today) : null
    const waitDays = rawWait != null && rawWait >= 0 ? rawWait : null
    const acc = byCustomer.get(customerId) ?? {
      name: payer.name || '—',
      open: 0,
      bills: [],
    }
    acc.open += open
    acc.bills.push({
      jobId: r.job_id ?? null,
      jobName: (r.job_name ?? '').trim() || '—',
      address: (r.job_address ?? '').trim() || null,
      billedYmd: refYmd,
      waitDays,
      open,
    })
    byCustomer.set(customerId, acc)
  }

  const offPace: MoneyWaitingRow[] = []
  let onPaceCount = 0
  let onPaceOpen = 0
  for (const [customerId, acc] of byCustomer) {
    const own = paySpeeds.customers[customerId]
    const hasOwn = own != null && own.samples >= PAY_SPEED_MIN_SAMPLES
    const baselineDays = hasOwn ? own.medianDays : company.medianDays
    const oldestWaitDays = acc.bills.reduce<number | null>(
      (max, b) => (b.waitDays != null && (max == null || b.waitDays > max) ? b.waitDays : max),
      null,
    )
    if (oldestWaitDays == null || oldestWaitDays <= baselineDays) {
      onPaceCount++
      onPaceOpen += acc.open
      continue
    }
    const bills = acc.bills
      .map((b) => ({ ...b, tone: billWaitTone(b.waitDays, baselineDays) }))
      .sort((a, b) => (b.waitDays ?? -1) - (a.waitDays ?? -1) || b.open - a.open)
    offPace.push({
      customerId,
      name: acc.name,
      segment: paySpeeds.customerTypes[customerId] ?? null,
      ownMedianDays: hasOwn ? own.medianDays : null,
      baselineDays,
      oldestWaitDays,
      open: acc.open,
      bills,
    })
  }

  offPace.sort((a, b) => b.oldestWaitDays - a.oldestWaitDays || b.open - a.open)
  return { rows: offPace, onPaceCount, onPaceOpen, companyMedianDays: company.medianDays }
}
