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
 * 2026-10-01: Dunmere's bills sat under five homeowners (Ulric Karrow, Rilvo, …) and Kestrin's
 * GC-only jobs (no customer) under nobody.
 */
const TODAY = '2026-10-01'
const DUNMERE = 'gc-dunmere'
const KESTRIN = 'gc-kestrin'
const speeds: PaySpeedData = {
  company: { medianDays: 6, samples: 227 },
  customers: { [DUNMERE]: { medianDays: 35, samples: 4 }, [KESTRIN]: { medianDays: 24, samples: 17 } },
  segments: { residential: null, commercial: null },
  customerTypes: { [DUNMERE]: 'commercial' },
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

// Linmor Hill: owner Ulric Karrow, GC Dunmere on the gc rule, billed Apr 20 (well past 35 days).
const linmor = row({ jobId: '273', invoiceId: 'i273', customerId: 'cust-ulric', customerName: 'Ulric Karrow', gcId: DUNMERE, gcName: 'RLC- Dunmere Mallin', billToParty: 'gc', amount: 13420, billedAt: '2026-04-20T15:00:00Z' })
// Tarrow Rd: owner Rilvo, same GC.
const tarrow = row({ jobId: '890', invoiceId: 'i890', customerId: 'cust-rilvo', customerName: 'Rilvo Sorn Zelmar', gcId: DUNMERE, gcName: 'RLC- Dunmere Mallin', billToParty: 'gc', amount: 285, billedAt: '2026-07-15T15:00:00Z' })
// A Kestrin GC job: no customer at all.
const kestrin = row({ jobId: '789', invoiceId: 'i789', customerId: null, customerName: null, gcId: KESTRIN, gcName: 'Kestrin Contracting', amount: 1200, billedAt: '2026-07-01T15:00:00Z' })
// A homeowner who pays their own bill, and one billed to a typed recipient.
const direct = row({ jobId: '1060', invoiceId: 'i1060', customerId: 'cust-carrow', customerName: 'John Carrow', amount: 350, billedAt: '2026-08-01T15:00:00Z' })
const tenant = row({ jobId: '1070', invoiceId: 'i1070', customerId: 'cust-lee', customerName: 'Kim Lee', amount: 90, billedAt: '2026-08-01T15:00:00Z', billToEmail: 'tenant@example.com' })
const rows = [linmor, tarrow, kestrin, direct, tenant]
const invOf = (r: StageRow) => (r.kind === 'job' ? null : r.inv)

describe('listPayer', () => {
  it('files a GC-billed bill under the GC, a GC job under the GC, and a typed recipient under the job customer', () => {
    expect(listPayer(linmor.job, invOf(linmor))).toEqual({ id: DUNMERE, name: 'RLC- Dunmere Mallin' })
    expect(listPayer(kestrin.job, invOf(kestrin))).toEqual({ id: KESTRIN, name: 'Kestrin Contracting' })
    expect(listPayer(tenant.job, invOf(tenant))).toEqual({ id: 'cust-lee', name: 'Kim Lee' })
    expect(listPayer({ customer_id: null, gc_customer_id: null }, null)).toEqual({ id: null, name: null })
  })
})

describe('Call mode', () => {
  it('one card per payer: Dunmere holds both homeowners’ bills, Kestrin’s GC job appears', () => {
    const q = buildPaymentChaseQueue(rows, speeds, null, null, TODAY)
    const names = q.due.map((c) => c.name)
    expect(names).toContain('RLC- Dunmere Mallin')
    expect(names).toContain('Kestrin Contracting')
    expect(names).not.toContain('Ulric Karrow')
    expect(names).not.toContain('Rilvo Sorn Zelmar')
    const dunmere = q.due.find((c) => c.customerId === DUNMERE)!
    expect(dunmere.bills.map((b) => b.jobId).sort()).toEqual(['273', '890'])
    expect(dunmere.bills[0]!.model.label).toContain('pays in ~35d')
  })
  it('a call logged under the homeowner on a builder’s job still quiets the builder’s card', () => {
    const t: ChaseTouch = { id: 't1', customerId: 'cust-ulric', jobId: '273', outcome: 'note', note: 'left a message', promisedYmd: null, snoozeDays: null, createdAt: '2026-09-30T15:00:00Z', resolvedAt: null, createdByName: 'Taunya' } as unknown as ChaseTouch
    const q = buildPaymentChaseQueue(rows, speeds, null, [t], TODAY)
    expect(q.waiting.map((c) => c.customerId)).toContain(DUNMERE)
    expect(q.due.map((c) => c.customerId)).not.toContain(DUNMERE)
  })
})

describe('Money waiting and the Pay speeds breakdown', () => {
  it('group by payer and read the payer’s own pace', () => {
    const mw = buildMoneyWaiting(rows, speeds, TODAY)!
    const dunmere = mw.rows.find((r) => r.customerId === DUNMERE)!
    expect(dunmere.name).toBe('RLC- Dunmere Mallin')
    expect(dunmere.baselineDays).toBe(35)
    expect(dunmere.bills).toHaveLength(2)
    expect(mw.rows.some((r) => r.customerId === KESTRIN)).toBe(true)
    expect(openBillsForCustomers(rows, speeds, TODAY).get(DUNMERE)).toHaveLength(2)
    const bd = buildPaySpeedsBreakdown(rows, speeds)
    expect(bd.ranked.map((r) => r.name)).toEqual(['RLC- Dunmere Mallin', 'Kestrin Contracting'])
    expect(bd.thin.map((r) => r.name).sort()).toEqual(['John Carrow', 'Kim Lee'])
  })
})

describe('Billed by customer', () => {
  it('groups a GC-billed bill under the GC and stamps the payer on each bill', () => {
    const groups = buildBilledByCustomerBreakdown(rows, new Date('2026-10-01T17:00:00Z'))
    const dunmere = groups.find((g) => g.customerName === 'RLC- Dunmere Mallin')!
    expect(dunmere.count).toBe(2)
    expect(dunmere.bills.every((b) => b.customerId === DUNMERE)).toBe(true)
    expect(groups.some((g) => g.customerName === 'Ulric Karrow')).toBe(false)
  })
})

describe('the Money waiting email', () => {
  it('files a row under payer_id once the payload carries it, else under the job customer', () => {
    const base = { customer_id: 'cust-ulric', customer_name: 'Ulric Karrow' }
    expect(moneyWaitingRowPayer({ ...base, payer_id: DUNMERE, payer_name: 'RLC- Dunmere Mallin' })).toEqual({ id: DUNMERE, name: 'RLC- Dunmere Mallin' })
    expect(moneyWaitingRowPayer({ ...base, payer_id: null, payer_name: null })).toEqual({ id: 'cust-ulric', name: 'Ulric Karrow' })
    expect(moneyWaitingRowPayer(base)).toEqual({ id: 'cust-ulric', name: 'Ulric Karrow' })
    expect(moneyWaitingRowPayer({ customer_id: null, customer_name: null, payer_id: KESTRIN, payer_name: 'Kestrin Contracting' }).id).toBe(KESTRIN)
  })
})
