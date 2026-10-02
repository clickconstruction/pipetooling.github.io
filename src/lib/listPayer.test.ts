import { describe, expect, it } from 'vitest'
import { listPayer } from './jobs/billToParty'
import { buildPaymentChaseQueue, type ChaseTouch } from './jobs/paymentChase'
import { buildMoneyWaiting, openBillsForCustomers } from './jobs/moneyWaiting'
import { buildPaySpeedsBreakdown } from './jobs/paySpeedsBreakdown'
import { buildBilledByCustomerBreakdown } from './jobs/billedByCustomerBreakdown'
import { moneyWaitingRowPayer } from '../../supabase/functions/_shared/moneyWaitingCore'
import type { PaySpeedData } from './jobs/billedExpectedPay'
import type { StageRow } from './jobsStagesBoard'
import type { JobWithDetails } from '../types/jobWithDetails'

/**
 * v2.4367: every "who owes us" list files a bill under whoever it went to. Shapes from
 * 2026-10-01: Dudley's bills sat under five homeowners (Umar Khan, Rizvi, …) and Knight's
 * GC-only jobs (no customer) under nobody.
 */
const TODAY = '2026-10-01'
const DUDLEY = 'gc-dudley'
const KNIGHT = 'gc-knight'
const speeds: PaySpeedData = {
  company: { medianDays: 6, samples: 227 },
  customers: { [DUDLEY]: { medianDays: 35, samples: 4 }, [KNIGHT]: { medianDays: 24, samples: 17 } },
  segments: { residential: null, commercial: null },
  customerTypes: { [DUDLEY]: 'commercial' },
  receipts: {},
  quality: null,
} as unknown as PaySpeedData

function row(o: { jobId: string; invoiceId: string; customerId: string | null; customerName: string | null; gcId?: string | null; gcName?: string | null; billToParty?: string; amount: number; billedAt: string; billToEmail?: string }): StageRow {
  const job = {
    id: o.jobId,
    hcp_number: o.jobId,
    click_number: null,
    job_name: `Job ${o.jobId}`,
    job_address: '1 Main St',
    customer_id: o.customerId,
    customer_name: o.customerName,
    gc_customer_id: o.gcId ?? null,
    gcCustomer: o.gcId ? { id: o.gcId, name: o.gcName ?? '' } : null,
    bill_to_party: o.billToParty ?? 'customer',
    payments: [],
    invoices: [],
    fixtures: [],
  } as unknown as JobWithDetails
  return {
    kind: 'invoice',
    job,
    inv: { id: o.invoiceId, job_id: o.jobId, amount: o.amount, status: 'billed', sequence_order: 1, estimated_bill_date: null, billed_at: o.billedAt, bill_to_email: o.billToEmail ?? null },
  } as unknown as StageRow
}

// Lenox Hill: owner Umar Khan, GC Dudley on the gc rule, billed Apr 20 (well past 35 days).
const lenox = row({ jobId: '273', invoiceId: 'i273', customerId: 'cust-umar', customerName: 'Umar Khan', gcId: DUDLEY, gcName: 'RMC- Dudley Mason', billToParty: 'gc', amount: 13420, billedAt: '2026-04-20T15:00:00Z' })
// Terrell Rd: owner Rizvi, same GC.
const terrell = row({ jobId: '890', invoiceId: 'i890', customerId: 'cust-rizvi', customerName: 'Rizvi Syed Zulfiqar', gcId: DUDLEY, gcName: 'RMC- Dudley Mason', billToParty: 'gc', amount: 285, billedAt: '2026-07-15T15:00:00Z' })
// A Knight GC job: no customer at all.
const knight = row({ jobId: '789', invoiceId: 'i789', customerId: null, customerName: null, gcId: KNIGHT, gcName: 'Knight Contracting', amount: 1200, billedAt: '2026-07-01T15:00:00Z' })
// A homeowner who pays their own bill, and one billed to a typed recipient.
const direct = row({ jobId: '1060', invoiceId: 'i1060', customerId: 'cust-cano', customerName: 'John Cano', amount: 350, billedAt: '2026-08-01T15:00:00Z' })
const tenant = row({ jobId: '1070', invoiceId: 'i1070', customerId: 'cust-lee', customerName: 'Kim Lee', amount: 90, billedAt: '2026-08-01T15:00:00Z', billToEmail: 'tenant@example.com' })
const rows = [lenox, terrell, knight, direct, tenant]
const invOf = (r: StageRow) => (r.kind === 'job' ? null : r.inv)

describe('listPayer', () => {
  it('files a GC-billed bill under the GC, a GC job under the GC, and a typed recipient under the job customer', () => {
    expect(listPayer(lenox.job, invOf(lenox))).toEqual({ id: DUDLEY, name: 'RMC- Dudley Mason' })
    expect(listPayer(knight.job, invOf(knight))).toEqual({ id: KNIGHT, name: 'Knight Contracting' })
    expect(listPayer(tenant.job, invOf(tenant))).toEqual({ id: 'cust-lee', name: 'Kim Lee' })
    expect(listPayer({ customer_id: null, gc_customer_id: null }, null)).toEqual({ id: null, name: null })
  })
})

describe('Call mode', () => {
  it('one card per payer: Dudley holds both homeowners’ bills, Knight’s GC job appears', () => {
    const q = buildPaymentChaseQueue(rows, speeds, null, null, TODAY)
    const names = q.due.map((c) => c.name)
    expect(names).toContain('RMC- Dudley Mason')
    expect(names).toContain('Knight Contracting')
    expect(names).not.toContain('Umar Khan')
    expect(names).not.toContain('Rizvi Syed Zulfiqar')
    const dudley = q.due.find((c) => c.customerId === DUDLEY)!
    expect(dudley.bills.map((b) => b.jobId).sort()).toEqual(['273', '890'])
    expect(dudley.bills[0]!.model.label).toContain('pays in ~35d')
  })
  it('a call logged under the homeowner on a builder’s job still quiets the builder’s card', () => {
    const t: ChaseTouch = { id: 't1', customerId: 'cust-umar', jobId: '273', outcome: 'note', note: 'left a message', promisedYmd: null, snoozeDays: null, createdAt: '2026-09-30T15:00:00Z', resolvedAt: null, createdByName: 'Taunya' } as unknown as ChaseTouch
    const q = buildPaymentChaseQueue(rows, speeds, null, [t], TODAY)
    expect(q.waiting.map((c) => c.customerId)).toContain(DUDLEY)
    expect(q.due.map((c) => c.customerId)).not.toContain(DUDLEY)
  })
})

describe('Money waiting and the Pay speeds breakdown', () => {
  it('group by payer and read the payer’s own pace', () => {
    const mw = buildMoneyWaiting(rows, speeds, TODAY)!
    const dudley = mw.rows.find((r) => r.customerId === DUDLEY)!
    expect(dudley.name).toBe('RMC- Dudley Mason')
    expect(dudley.baselineDays).toBe(35)
    expect(dudley.bills).toHaveLength(2)
    expect(mw.rows.some((r) => r.customerId === KNIGHT)).toBe(true)
    expect(openBillsForCustomers(rows, speeds, TODAY).get(DUDLEY)).toHaveLength(2)
    const bd = buildPaySpeedsBreakdown(rows, speeds)
    expect(bd.ranked.map((r) => r.name)).toEqual(['RMC- Dudley Mason', 'Knight Contracting'])
    expect(bd.thin.map((r) => r.name).sort()).toEqual(['John Cano', 'Kim Lee'])
  })
})

describe('Billed by customer', () => {
  it('groups a GC-billed bill under the GC and stamps the payer on each bill', () => {
    const groups = buildBilledByCustomerBreakdown(rows, new Date('2026-10-01T17:00:00Z'))
    const dudley = groups.find((g) => g.customerName === 'RMC- Dudley Mason')!
    expect(dudley.count).toBe(2)
    expect(dudley.bills.every((b) => b.customerId === DUDLEY)).toBe(true)
    expect(groups.some((g) => g.customerName === 'Umar Khan')).toBe(false)
  })
})

describe('the Money waiting email', () => {
  it('files a row under payer_id once the payload carries it, else under the job customer', () => {
    const base = { customer_id: 'cust-umar', customer_name: 'Umar Khan' }
    expect(moneyWaitingRowPayer({ ...base, payer_id: DUDLEY, payer_name: 'RMC- Dudley Mason' })).toEqual({ id: DUDLEY, name: 'RMC- Dudley Mason' })
    expect(moneyWaitingRowPayer({ ...base, payer_id: null, payer_name: null })).toEqual({ id: 'cust-umar', name: 'Umar Khan' })
    expect(moneyWaitingRowPayer(base)).toEqual({ id: 'cust-umar', name: 'Umar Khan' })
    expect(moneyWaitingRowPayer({ customer_id: null, customer_name: null, payer_id: KNIGHT, payer_name: 'Knight Contracting' }).id).toBe(KNIGHT)
  })
})
