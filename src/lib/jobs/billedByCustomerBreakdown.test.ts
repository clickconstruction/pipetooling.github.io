import { describe, expect, it } from 'vitest'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { billedBreakdownTotal, buildBilledByCustomerBreakdown } from './billedByCustomerBreakdown'

const NOW = new Date('2026-08-20T12:00:00Z')

function job(overrides: Partial<JobWithDetails>): JobWithDetails {
  return {
    id: 'j1',
    job_name: 'Job',
    customer_id: 'c1',
    customer_name: 'Acme GC',
    hcp_number: '100',
    click_number: null,
    revenue: 10_000,
    payments_made: 0,
    invoices: [],
    payments: [],
    materials: [],
    fixtures: [],
    team_members: [],
    ...overrides,
  } as unknown as JobWithDetails
}

function invRow(
  j: JobWithDetails,
  overrides: Partial<Record<string, unknown>> & { id: string; amount: number },
): StageRow {
  return {
    kind: 'invoice',
    job: j,
    inv: {
      job_id: j.id,
      status: 'billed',
      sequence_order: 0,
      billed_at: null,
      estimated_bill_date: null,
      is_primary_rtb_bundle: false,
      ...overrides,
    },
  } as unknown as StageRow
}

describe('buildBilledByCustomerBreakdown', () => {
  it('groups bills by customer, sums remainders, tracks worst age, sorts groups by total desc', () => {
    const acmeJobA = job({ id: 'ja', job_name: 'Tower A', hcp_number: '101' })
    const acmeJobB = job({ id: 'jb', job_name: 'Tower B', hcp_number: '102' })
    const zeta = job({ id: 'jz', customer_id: 'c2', customer_name: 'Zeta Homes', job_name: 'Zeta job', hcp_number: '200' })
    const rows = [
      invRow(acmeJobA, { id: 'i1', amount: 1000, estimated_bill_date: '2026-08-15' }), // 5d
      invRow(acmeJobB, { id: 'i2', amount: 2000, estimated_bill_date: '2026-05-01' }), // 111d
      invRow(zeta, { id: 'i3', amount: 5000, estimated_bill_date: '2026-08-01' }), // 19d
    ]
    const groups = buildBilledByCustomerBreakdown(rows, NOW)
    expect(groups.map((g) => g.customerName)).toEqual(['Zeta Homes', 'Acme GC'])
    const acme = groups[1]!
    expect(acme.total).toBe(3000)
    expect(acme.count).toBe(2)
    expect(acme.worstAgeDays).toBe(111)
    // Oldest first within the group.
    expect(acme.bills.map((b) => b.invoiceId)).toEqual(['i2', 'i1'])
    expect(billedBreakdownTotal(groups)).toBe(8000)
  })

  it('carries the resend wiring: customer id/email, stripe identity, paid flag, sent date (v2.2604)', () => {
    const j = job({ customer_email: '  gc@acme.com  ' } as Partial<JobWithDetails>)
    const rows = [
      invRow(j, {
        id: 'i1',
        amount: 1000,
        stripe_invoice_id: ' in_123 ',
        stripe_invoice_status: 'open',
        sent_to_customer_at: '2026-08-10T15:00:00Z',
      }),
      invRow(j, { id: 'i2', amount: 500, stripe_invoice_id: 'in_456', stripe_invoice_status: 'paid' }),
      invRow(j, { id: 'i3', amount: 250 }),
    ]
    const bills = buildBilledByCustomerBreakdown(rows, NOW)[0]!.bills
    const byId = new Map(bills.map((b) => [b.invoiceId, b]))
    const stripeBill = byId.get('i1')!
    expect(stripeBill.customerId).toBe('c1')
    expect(stripeBill.customerEmail).toBe('gc@acme.com')
    expect(stripeBill.stripeInvoiceId).toBe('in_123')
    expect(stripeBill.stripePaid).toBe(false)
    expect(stripeBill.sentAtIso).toBe('2026-08-10T15:00:00Z')
    expect(byId.get('i2')!.stripePaid).toBe(true)
    const plainBill = byId.get('i3')!
    expect(plainBill.stripeInvoiceId).toBeNull()
    expect(plainBill.stripePaid).toBe(false)
    expect(plainBill.sentAtIso).toBeNull()
  })

  it('carries the physical-resend wiring: send channel + bill-to override (v2.2605)', () => {
    const j = job({ customer_email: 'gc@acme.com' } as Partial<JobWithDetails>)
    const rows = [
      invRow(j, { id: 'i1', amount: 1000, external_send_channel: 'physical', bill_to_email: ' owner@site.com ' }),
      invRow(j, { id: 'i2', amount: 500, external_send_channel: 'housecallpro' }),
      invRow(j, { id: 'i3', amount: 250 }),
    ]
    const bills = buildBilledByCustomerBreakdown(rows, NOW)[0]!.bills
    const byId = new Map(bills.map((b) => [b.invoiceId, b]))
    expect(byId.get('i1')!.externalSendChannel).toBe('physical')
    expect(byId.get('i1')!.billToEmail).toBe('owner@site.com')
    expect(byId.get('i2')!.externalSendChannel).toBe('housecallpro')
    expect(byId.get('i2')!.billToEmail).toBeNull()
    expect(byId.get('i3')!.externalSendChannel).toBeNull()
  })

  it('bill amounts net payments applied to that invoice; a fully-applied row stays as a $0 settled bill that never ages', () => {
    const j = job({
      id: 'jp',
      payments: [
        { invoice_id: 'i1', amount: 400 },
        { invoice_id: 'i2', amount: 1000 },
      ] as unknown as JobWithDetails['payments'],
    })
    const rows = [invRow(j, { id: 'i1', amount: 1000, estimated_bill_date: '2026-05-01' }), invRow(j, { id: 'i2', amount: 1000, estimated_bill_date: '2026-01-01' })]
    const groups = buildBilledByCustomerBreakdown(rows, NOW)
    expect(groups).toHaveLength(1)
    // bill truth (J4-1 b): the count matches the Pipeline strip — the settled row is kept, worth $0, undated
    expect(groups[0]!.bills).toHaveLength(2)
    expect(groups[0]!.total).toBe(600)
    const byId = new Map(groups[0]!.bills.map((b) => [b.invoiceId, b]))
    expect(byId.get('i1')).toMatchObject({ amount: 600, settled: false, ageDays: 111 })
    expect(byId.get('i2')).toMatchObject({ amount: 0, settled: true, ageDays: null })
    // the settled bill's 200+ day age must NOT make the customer look 200 days late
    expect(groups[0]!.worstAgeDays).toBe(111)
    expect(groups[0]!.bills[0]!.invoiceId).toBe('i1') // aged first, settled last
  })

  it('job-shell rows use revenue − payments and jump by jobId; undated bills sort last with null age', () => {
    const shellJob = job({ id: 'js', revenue: 4000, payments_made: 1000 })
    const rows: StageRow[] = [
      { kind: 'job', job: shellJob } as unknown as StageRow,
      invRow(shellJob, { id: 'i9', amount: 500, estimated_bill_date: '2026-08-10' }),
    ]
    const groups = buildBilledByCustomerBreakdown(rows, NOW)
    const bills = groups[0]!.bills
    expect(bills.map((b) => b.invoiceId)).toEqual(['i9', null])
    expect(bills[1]!.jobId).toBe('js')
    expect(bills[1]!.amount).toBe(3000)
    expect(bills[1]!.ageDays).toBeNull()
    expect(groups[0]!.worstAgeDays).toBe(10)
  })

  it('ages by billed_at when no est. bill date is set; a hand-set date wins and is flagged (v2.2130)', () => {
    const j = job({ id: 'jf' })
    const rows = [
      invRow(j, { id: 'b1', amount: 1000, billed_at: '2026-07-04T15:00:00Z' }), // 47d, app-stamped
      invRow(j, { id: 'b2', amount: 1000, billed_at: '2026-08-18T15:00:00Z', estimated_bill_date: '2026-03-01' }), // 172d, hand-set
      invRow(j, { id: 'b3', amount: 1000 }), // nothing → no date
    ]
    const g = buildBilledByCustomerBreakdown(rows, NOW)[0]!
    expect(g.bills.map((b) => [b.invoiceId, b.ageDays, b.ageHandSet])).toEqual([
      ['b2', 172, true],
      ['b1', 47, false],
      ['b3', null, false],
    ])
    expect(g.worstAgeDays).toBe(172)
    expect(g.worstAgeHandSet).toBe(true)
  })

  it('carries the trimmed job address onto each bill (v2.NNNN)', () => {
    const j = job({ id: 'ja', job_address: '  9703 Lenox Hl, Schertz TX 78154  ' })
    const bare = job({ id: 'jb' }) // no job_address on the row → blank
    const rows = [invRow(j, { id: 'i1', amount: 100 }), invRow(bare, { id: 'i2', amount: 100 })]
    const bills = buildBilledByCustomerBreakdown(rows, NOW)[0]!.bills
    expect(bills.find((b) => b.invoiceId === 'i1')!.jobAddress).toBe('9703 Lenox Hl, Schertz TX 78154')
    expect(bills.find((b) => b.invoiceId === 'i2')!.jobAddress).toBe('')
  })

  it('scopes line items to the bill: linked fixtures only, ×count labels, non-billable rows dropped', () => {
    const j = job({
      id: 'jf',
      fixtures: [
        { job_id: 'jf', invoice_id: 'i1', name: 'Water heater — 50 gal gas', count: 1, line_unit_price: 1850 },
        { job_id: 'jf', invoice_id: 'i1', name: 'Service call', count: 2, line_unit_price: 1085 },
        { job_id: 'jf', invoice_id: 'i1', name: '', count: 1, line_unit_price: 500 }, // unnamed → dropped
        { job_id: 'jf', invoice_id: 'i1', name: 'Zero line', count: 0, line_unit_price: 500 }, // 0 × unit → dropped
        { job_id: 'jf', invoice_id: 'other', name: 'Someone else’s segment', count: 1, line_unit_price: 999 },
      ] as unknown as JobWithDetails['fixtures'],
    })
    const bills = buildBilledByCustomerBreakdown([invRow(j, { id: 'i1', amount: 4020 })], NOW)[0]!.bills
    expect(bills[0]!.lineItems).toEqual([
      { label: 'Water heater — 50 gal gas', amount: 1850 },
      { label: 'Service call ×2', amount: 2170 },
    ])
  })

  it('primary bundle with no linked fixtures lists the exact-sum unlinked segments; job-shell rows list all billable lines', () => {
    const j = job({
      id: 'jp',
      revenue: 700,
      fixtures: [
        { job_id: 'jp', invoice_id: null, name: 'Rough-in', count: 1, line_unit_price: 400 },
        { job_id: 'jp', invoice_id: null, name: 'Trim set', count: 1, line_unit_price: 300 },
        { job_id: 'jp', invoice_id: 'i-linked', name: 'Change order', count: 1, line_unit_price: 250 },
      ] as unknown as JobWithDetails['fixtures'],
    })
    const bundleBills = buildBilledByCustomerBreakdown(
      [invRow(j, { id: 'i-bundle', amount: 700, is_primary_rtb_bundle: true })],
      NOW,
    )[0]!.bills
    expect(bundleBills[0]!.lineItems.map((l) => l.label)).toEqual(['Rough-in', 'Trim set'])

    const shellBills = buildBilledByCustomerBreakdown([{ kind: 'job', job: j } as unknown as StageRow], NOW)[0]!.bills
    expect(shellBills[0]!.lineItems.map((l) => l.label)).toEqual(['Rough-in', 'Trim set', 'Change order'])
  })

  it('suppresses the whole-job-proration fallback: an invoice with no linked fixtures lists no lines', () => {
    const j = job({
      id: 'jw',
      fixtures: [
        { job_id: 'jw', invoice_id: null, name: 'Job total (migrated)', count: 1, line_unit_price: 52_200 },
        { job_id: 'jw', invoice_id: 'i-other', name: 'Change order', count: 1, line_unit_price: 3500 },
      ] as unknown as JobWithDetails['fixtures'],
    })
    const bills = buildBilledByCustomerBreakdown([invRow(j, { id: 'i-partial', amount: 13_420 })], NOW)[0]!.bills
    expect(bills[0]!.lineItems).toEqual([])
  })

  it('missing customer groups under "No customer" keyed by name; blank name jobs merge there', () => {
    const a = job({ id: 'n1', customer_id: null, customer_name: '', job_name: 'Orphan 1' })
    const b = job({ id: 'n2', customer_id: null, customer_name: null, job_name: 'Orphan 2' })
    const rows = [invRow(a, { id: 'i1', amount: 100 }), invRow(b, { id: 'i2', amount: 200 })]
    const groups = buildBilledByCustomerBreakdown(rows, NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.customerName).toBe('No customer')
    expect(groups[0]!.total).toBe(300)
  })
})
