import { describe, it, expect } from 'vitest'
// Deno edge module (supabase/functions/_shared) — dependency-free, tested here.
import {
  buildPortalBills,
  dedupeJobsById,
  jobIsAsGc,
  jobLabel,
  jobTradeTag,
  type PortalJobRow,
} from '../../../supabase/functions/_shared/portalMergedBills'

const VIEWER = 'cust-knight'

function job(over: Partial<PortalJobRow> & { id: string }): PortalJobRow {
  return {
    hcp_number: null,
    click_number: null,
    job_name: null,
    job_address: null,
    status: 'billed',
    revenue: null,
    payments_made: null,
    customer_id: VIEWER,
    gc_customer_id: null,
    ...over,
  }
}

describe('dedupeJobsById', () => {
  it('keeps the first occurrence of a job that matches both sides of the union', () => {
    const a = job({ id: 'j1' })
    const b = job({ id: 'j1', job_name: 'dup' })
    const c = job({ id: 'j2' })
    expect(dedupeJobsById([a, b, c])).toEqual([a, c])
  })
})

describe('jobIsAsGc', () => {
  it('is true only when the job belongs to another account', () => {
    expect(jobIsAsGc(job({ id: 'j', customer_id: 'someone-else' }), VIEWER)).toBe(true)
    expect(jobIsAsGc(job({ id: 'j', customer_id: VIEWER }), VIEWER)).toBe(false)
    expect(jobIsAsGc(job({ id: 'j', customer_id: null }), VIEWER)).toBe(false)
  })
})

describe('buildPortalBills', () => {
  it('marks GC rows with asGc + ownerName in the merged view only', () => {
    const jobs = [
      job({ id: 'own', job_name: 'Vet clinic', hcp_number: '963' }),
      // The GC owes this one (bill_to_party gc, v2.3345) — a GC-side job the OWNER pays never rides in the GC's ledger (v2.3375).
      job({ id: 'gc', job_name: 'Bexar Lofts', hcp_number: '1302', customer_id: 'cust-lofts', gc_customer_id: VIEWER, bill_to_party: 'gc' }),
    ]
    const invoices = [
      { id: 'i1', job_id: 'own', amount: 2200, status: 'billed', billed_at: '2026-08-12', sequence_order: 1, hosted_invoice_url: null },
      { id: 'i2', job_id: 'gc', amount: 28500, status: 'billed', billed_at: '2026-08-20', sequence_order: 1, hosted_invoice_url: 'https://pay.example/x' },
    ]
    const merged = buildPortalBills({
      jobs,
      invoices,
      payments: [],
      viewerCustomerId: VIEWER,
      markGcRows: true,
      ownerNames: { 'cust-lofts': 'Bexar Lofts LLC' },
    })
    expect(merged.map((b) => [b.jobNumber, b.asGc, b.ownerName])).toEqual([
      ['1302', true, 'Bexar Lofts LLC'],
      ['963', false, null],
    ])

    const scoped = buildPortalBills({
      jobs,
      invoices,
      payments: [],
      viewerCustomerId: VIEWER,
      markGcRows: false,
      ownerNames: { 'cust-lofts': 'Bexar Lofts LLC' },
    })
    expect(scoped.every((b) => !b.asGc && b.ownerName === null)).toBe(true)
  })

  it('subtracts payments per invoice and drops settled lines', () => {
    const jobs = [job({ id: 'j1', hcp_number: '10' })]
    const invoices = [
      { id: 'i1', job_id: 'j1', amount: 1000, status: 'billed', billed_at: '2026-08-01', sequence_order: 1, hosted_invoice_url: null },
      { id: 'i2', job_id: 'j1', amount: 500, status: 'billed', billed_at: '2026-08-02', sequence_order: 2, hosted_invoice_url: null },
    ]
    const payments = [
      { invoice_id: 'i1', amount: 400 },
      { invoice_id: 'i1', amount: 350 },
      { invoice_id: 'i2', amount: 500 },
    ]
    const bills = buildPortalBills({ jobs, invoices, payments, viewerCustomerId: VIEWER, markGcRows: true })
    expect(bills).toHaveLength(1)
    expect(bills[0]?.amount).toBe(250)
  })

  it('falls back to the job-level remainder for billed jobs with no billed line', () => {
    const jobs = [job({ id: 'shell', hcp_number: '77', revenue: 900, payments_made: 150, customer_id: 'other', gc_customer_id: VIEWER, bill_to_party: 'gc' })]
    const bills = buildPortalBills({ jobs, invoices: [], payments: [], viewerCustomerId: VIEWER, markGcRows: true })
    expect(bills).toHaveLength(1)
    expect(bills[0]?.amount).toBe(750)
    expect(bills[0]?.asGc).toBe(true)
    expect(bills[0]?.ownerName).toBeNull() // owner name unknown → tag still renders, name omitted
  })

  it('sorts undated rows first, then newest billed (matching the shipped statement order)', () => {
    const jobs = [job({ id: 'a', hcp_number: '1' }), job({ id: 'b', hcp_number: '2' }), job({ id: 'c', hcp_number: '3', revenue: 10 })]
    const invoices = [
      { id: 'ia', job_id: 'a', amount: 100, status: 'billed', billed_at: '2026-08-01', sequence_order: 1, hosted_invoice_url: null },
      { id: 'ib', job_id: 'b', amount: 100, status: 'billed', billed_at: '2026-08-15', sequence_order: 1, hosted_invoice_url: null },
    ]
    const bills = buildPortalBills({ jobs, invoices, payments: [], viewerCustomerId: VIEWER, markGcRows: true })
    expect(bills.map((b) => b.jobNumber)).toEqual(['3', '2', '1'])
  })

  it('a non-billed job with no billed invoice contributes nothing (no shell remainder)', () => {
    const jobs = [job({ id: 'j1', status: 'in_progress', revenue: 500 })]
    expect(buildPortalBills({ jobs, invoices: [], payments: [], viewerCustomerId: VIEWER, markGcRows: true })).toEqual([])
  })

  it('a billed invoice on a working job IS a bill (membership rule in portalBillMembership.ts)', () => {
    const jobs = [job({ id: 'w', hcp_number: '977', status: 'working', revenue: 50000 })]
    const invoices = [
      { id: 'i1', job_id: 'w', amount: 5000, status: 'billed', billed_at: '2026-09-01', sequence_order: 1, hosted_invoice_url: 'https://pay.example/i1' },
    ]
    const bills = buildPortalBills({ jobs, invoices, payments: [], viewerCustomerId: VIEWER, markGcRows: true })
    expect(bills.map((b) => [b.jobNumber, b.amount, b.billedOn])).toEqual([['977', 5000, '2026-09-01']])
  })
})

describe('jobLabel', () => {
  it('composes name and number like the statement expects', () => {
    expect(jobLabel(job({ id: 'j', job_name: 'Vet clinic', hcp_number: '963' }))).toBe('Vet clinic · Job 963')
    expect(jobLabel(job({ id: 'j', job_name: '', hcp_number: '12' }))).toBe('Job 12')
    expect(jobLabel(job({ id: 'j' }))).toBe('Job')
  })
})

describe('jobTradeTag', () => {
  it('maps the embedded service type to the board trade tags; unknown/absent → null', () => {
    expect(jobTradeTag(job({ id: 'j', service_types: { name: 'Plumbing' } }))).toBe('plum')
    expect(jobTradeTag(job({ id: 'j', service_types: { name: 'Electrical' } }))).toBe('elec')
    expect(jobTradeTag(job({ id: 'j', service_types: { name: 'HVAC' } }))).toBe('hvac')
    expect(jobTradeTag(job({ id: 'j', service_types: { name: 'Landscaping' } }))).toBeNull()
    expect(jobTradeTag(job({ id: 'j' }))).toBeNull()
  })

  it('bills carry serviceTag + bare jobName for the trade-first statement line', () => {
    const bills = buildPortalBills({
      jobs: [job({ id: 'j1', job_name: 'Vet clinic', hcp_number: '963', revenue: 100, payments_made: 0, service_types: { name: 'HVAC' } })],
      invoices: [],
      payments: [],
      viewerCustomerId: VIEWER,
      markGcRows: false,
      ownerNames: {},
    })
    expect(bills[0]).toMatchObject({ serviceTag: 'hvac', jobName: 'Vet clinic' })
  })
})

// Share this bill (v2.3375): the ledger is owed-only; the shared card is the stamp.
import { buildPortalSharedBills } from '../../../supabase/functions/_shared/portalMergedBills'

describe('share this bill (v2.3375)', () => {
  const GC = 'cust-gc'
  const ownerPays = job({ id: 'j1', hcp_number: '1017', job_name: 'Sewer line repair', job_address: '4410 Cedar Hollow, Kyle, TX 78640', customer_id: VIEWER, gc_customer_id: GC, bill_to_party: 'customer' })
  const gcPays = job({ id: 'j2', hcp_number: '1042', job_name: 'Pretest', job_address: '7712 Ranch Rd 12, Wimberley, TX', customer_id: VIEWER, gc_customer_id: GC, bill_to_party: 'gc' })
  const line = (id: string, job_id: string, amount: number, billed_at: string, shown_to_party: string | null) => ({
    id,
    job_id,
    amount,
    status: 'billed',
    billed_at,
    sequence_order: 1,
    hosted_invoice_url: `https://pay.example/${id}`,
    shown_to_party,
  })
  const names = { [VIEWER]: 'Maria Delgado', [GC]: 'Done Right Foundation' }

  it('the ledger carries only what the viewer owes — the other party’s bill is not in the list, stamped or not', () => {
    const invoices = [line('i1', 'j1', 6420, '2026-08-03', 'gc'), line('i2', 'j2', 250, '2026-09-02', null)]
    const ownerLedger = buildPortalBills({ jobs: [ownerPays, gcPays], invoices, payments: [], viewerCustomerId: VIEWER, markGcRows: true })
    expect(ownerLedger.map((b) => b.jobNumber)).toEqual(['1017'])
    const gcLedger = buildPortalBills({ jobs: [ownerPays, gcPays], invoices, payments: [], viewerCustomerId: GC, markGcRows: true })
    expect(gcLedger.map((b) => b.jobNumber)).toEqual(['1042'])
  })

  it('the GC’s card lists the bill stamped for them: the owner’s name, what is open, what was received', () => {
    const invoices = [line('i1', 'j1', 6420, '2026-08-03', 'gc'), line('i3', 'j1', 1180, '2026-09-09', null)]
    const payments = [{ invoice_id: 'i1', amount: 2000 }]
    const shared = buildPortalSharedBills({ jobs: [ownerPays], invoices, payments, viewerCustomerId: GC, partyNames: names })
    expect(shared).toHaveLength(1)
    expect(shared[0]).toMatchObject({ jobNumber: '1017', billedTo: 'Maria Delgado', amount: 4420, billedAmount: 6420, totalPaid: 2000, billedOn: '2026-08-03', viewerRole: 'gc' })
    // The owner sees nothing shared on their own job's owner-paid bills.
    expect(buildPortalSharedBills({ jobs: [ownerPays], invoices, payments, viewerCustomerId: VIEWER, partyNames: names })).toEqual([])
  })

  it('a GC-paid bill stamped for the customer shows on the owner’s card as the builder’s bill', () => {
    const invoices = [line('i2', 'j2', 250, '2026-09-02', 'customer')]
    const shared = buildPortalSharedBills({ jobs: [gcPays], invoices, payments: [], viewerCustomerId: VIEWER, partyNames: names })
    expect(shared).toHaveLength(1)
    expect(shared[0]).toMatchObject({ billedTo: 'Done Right Foundation', amount: 250, viewerRole: 'customer' })
    expect(buildPortalSharedBills({ jobs: [gcPays], invoices: [line('i2', 'j2', 250, '2026-09-02', null)], payments: [], viewerCustomerId: VIEWER, partyNames: names })).toEqual([])
  })

  it('a billed job with no invoice row follows the job’s memory', () => {
    const shell = job({ id: 'j3', hcp_number: '1031', status: 'billed', revenue: 3150, payments_made: 0, customer_id: VIEWER, gc_customer_id: GC, bill_to_party: 'customer', show_bills_to_other_party: true })
    const shared = buildPortalSharedBills({ jobs: [shell], invoices: [], payments: [], viewerCustomerId: GC, partyNames: names })
    expect(shared.map((b) => [b.jobNumber, b.amount, b.billedOn])).toEqual([['1031', 3150, null]])
    const quiet = { ...shell, show_bills_to_other_party: false }
    expect(buildPortalSharedBills({ jobs: [quiet], invoices: [], payments: [], viewerCustomerId: GC, partyNames: names })).toEqual([])
    // A settled shell shows nothing.
    expect(buildPortalSharedBills({ jobs: [{ ...shell, payments_made: 3150 }], invoices: [], payments: [], viewerCustomerId: GC, partyNames: names })).toEqual([])
  })

  it('oldest billed first, undated shells last, and a name fallback when the party is unknown', () => {
    const other = job({ id: 'j4', hcp_number: '1039', customer_id: VIEWER, gc_customer_id: GC, bill_to_party: 'customer' })
    const shell = job({ id: 'j5', hcp_number: '1050', status: 'billed', revenue: 900, payments_made: 0, customer_id: VIEWER, gc_customer_id: GC, bill_to_party: 'customer', show_bills_to_other_party: true })
    const invoices = [line('a', 'j4', 2300, '2026-09-09', 'gc'), line('b', 'j1', 6420, '2026-08-03', 'gc')]
    const shared = buildPortalSharedBills({ jobs: [ownerPays, other, shell], invoices, payments: [], viewerCustomerId: GC })
    expect(shared.map((b) => b.jobNumber)).toEqual(['1017', '1039', '1050'])
    expect(shared[0]!.billedTo).toBe('the owner')
  })
})
