import { describe, expect, it } from 'vitest'
import { deriveCustomersList, isMissingRpcError, parseCustomersListBundle } from './customersListBundle'

const raw = {
  projects: [{ customer_id: 'c1', n: 2 }],
  bids: [
    { customer_id: 'c1', n: 3, latest: '2026-09-01T10:00:00+00:00' },
    { customer_id: 'c2', n: '1', latest: null },
  ],
  notes: [{ customer_id: 'c2', n: 4 }],
  estimates: [{ customer_id: 'c1', latest: '2026-09-05T10:00:00+00:00' }],
  jobs: [
    { id: 'j1', customer_id: 'c1', status: 'billed', revenue: 1000, payments_made: 0, created_at: '2026-08-01T00:00:00+00:00' },
    { id: 'j2', customer_id: 'c1', status: 'paid', revenue: '500', payments_made: 500, created_at: '2026-07-01T00:00:00+00:00' },
    { id: 'j3', customer_id: 'c2', status: 'paid', revenue: 250, payments_made: 250, created_at: '2026-06-01T00:00:00+00:00' },
    { id: '', customer_id: 'c9' },
  ],
  invoices: [{ id: 'i1', job_id: 'j1', status: 'billed', amount: 1000 }],
  payments: [{ job_id: 'j2', invoice_id: null, amount: 500, paid_on: '2026-07-10' }],
  unlinked_jobs: 7,
}

describe('parseCustomersListBundle', () => {
  it('shapes counts, stamps, rows and the unlinked count; drops rows with no id', () => {
    const b = parseCustomersListBundle(raw)!
    expect(b.projectCounts).toEqual({ c1: 2 })
    expect(b.bidCounts).toEqual({ c1: 3, c2: 1 })
    expect(b.noteCounts).toEqual({ c2: 4 })
    expect(b.latestSignal).toEqual({ c1: '2026-09-05T10:00:00+00:00' })
    expect(b.jobs.map((j) => j.id)).toEqual(['j1', 'j2', 'j3'])
    expect(b.jobs[1]!.revenue).toBe(500)
    expect(b.invoices).toEqual([{ id: 'i1', job_id: 'j1', status: 'billed', amount: 1000 }])
    expect(b.payments[0]!.paid_on).toBe('2026-07-10')
    expect(b.unlinkedJobs).toBe(7)
  })
  it('returns null for anything that is not an object', () => {
    expect(parseCustomersListBundle(null)).toBeNull()
    expect(parseCustomersListBundle([])).toBeNull()
    expect(parseCustomersListBundle('x')).toBeNull()
  })
  it('tolerates missing sections', () => {
    const b = parseCustomersListBundle({})!
    expect(b.jobs).toEqual([])
    expect(b.unlinkedJobs).toBeNull()
  })
})

describe('deriveCustomersList', () => {
  it('counts jobs from the rows, keys every listed customer, and finds unrecorded paid jobs', () => {
    const d = deriveCustomersList(parseCustomersListBundle(raw)!, ['c1', 'c2', 'c3'])
    expect(d.countsByCustomerId.c1).toEqual({ projects: 2, jobs: 2, bids: 3, notes: 0 })
    expect(d.countsByCustomerId.c2).toEqual({ projects: 0, jobs: 1, bids: 1, notes: 4 })
    expect(d.countsByCustomerId.c3).toEqual({ projects: 0, jobs: 0, bids: 0, notes: 0 })
    expect(d.rollupByCustomerId.c1?.openBalance).toBe(1000)
    expect(d.rollupByCustomerId.c1?.lifetimePaid).toBe(500)
    // j3 is paid with revenue and no payment rows; j2 has a payment row.
    expect(d.unrecordedPaidCount).toBe(1)
    expect(d.recentSignalByCustomerId).toEqual({ c1: '2026-09-05T10:00:00+00:00' })
    expect(d.unlinkedJobsCount).toBe(7)
  })
})

describe('isMissingRpcError', () => {
  it('recognises PostgREST 202 either way', () => {
    expect(isMissingRpcError('Could not find the function public.get_customers_list_bundle')).toBe(true)
    expect(isMissingRpcError('PGRST202')).toBe(true)
    expect(isMissingRpcError('permission denied')).toBe(false)
    expect(isMissingRpcError(null)).toBe(false)
  })
})
