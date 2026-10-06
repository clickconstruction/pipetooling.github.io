/** Punch list #85, item 9: the firm's page measures a promise the way the office's desk does. */
import { describe, expect, it } from 'vitest'
import { billedAtPromise } from './legalPromiseBilled'
import { classifyPromises } from '../jobs/paymentPromises'

const invoices = [
  { job_id: 'j1', status: 'billed', amount: 4000, billed_at: '2026-06-27T16:00:00+00:00' },
  { job_id: 'j1', status: 'billed', amount: 14400, billed_at: '2026-08-06T16:00:00+00:00' },
  { job_id: 'j1', status: 'draft', amount: 999, billed_at: null },
  { job_id: 'j2', status: 'billed', amount: 500, billed_at: '2026-06-01T16:00:00+00:00' },
]

describe('billedAtPromise', () => {
  it('counts only the job’s billed or paid lines dated at or before the promise', () => {
    expect(billedAtPromise(invoices, 'j1', '2026-07-05T15:00:00+00:00')).toBe(4000)
    expect(billedAtPromise(invoices, 'j1', '2026-08-16T15:00:00+00:00')).toBe(18400)
    expect(billedAtPromise(invoices, 'j1', '2026-06-01T00:00:00+00:00')).toBe(0)
  })

  it('falls back to created_at, then the send, and counts an undated line', () => {
    expect(billedAtPromise([{ job_id: 'j', status: 'paid', amount: 10, billed_at: null, created_at: '2026-09-02T00:00:00Z' }], 'j', '2026-09-01T00:00:00Z')).toBe(0)
    expect(billedAtPromise([{ job_id: 'j', status: 'paid', amount: 10, billed_at: null, sent_to_customer_at: '2026-08-02T00:00:00Z' }], 'j', '2026-09-01T00:00:00Z')).toBe(10)
    expect(billedAtPromise([{ job_id: 'j', status: 'billed', amount: 10 }], 'j', '2026-09-01T00:00:00Z')).toBe(10)
  })

  it('lets a promise kept on the first draw stay kept after the final bill', () => {
    const payments = [{ paidOn: '2026-07-12', amount: 4000 }]
    const records = [
      { id: 'p1', jobId: 'j1', customerId: null, promisedYmd: '2026-07-11', createdAt: '2026-07-05T15:00:00+00:00', source: 'office' as const, billedTotal: billedAtPromise(invoices, 'j1', '2026-07-05T15:00:00+00:00'), payments },
      { id: 'p2', jobId: 'j1', customerId: null, promisedYmd: '2026-08-24', createdAt: '2026-08-16T15:00:00+00:00', source: 'office' as const, billedTotal: billedAtPromise(invoices, 'j1', '2026-08-16T15:00:00+00:00'), payments },
    ]
    expect(classifyPromises(records, '2026-10-05').map((o) => o.state)).toEqual(['kept', 'broken'])
  })
})
