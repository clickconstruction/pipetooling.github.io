import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeFakeRowCapSupabase } from '../test/fakeRowCapSupabase'

/**
 * The hub's jobs read against a client that caps an un-ranged read at 1,000 rows with no
 * error, as PostgREST does (docs/TROUBLESHOOTING.md § [row-cap]). v2.5571: the ledger carried
 * 871 non-billing-only jobs on 2026-10-15, so the read pages and job 1,001 is never dropped.
 * The kernels in this module keep their own file (scheduleDispatchHub.test.ts); this one mocks
 * the client.
 */
const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof makeFakeRowCapSupabase> | null }))
vi.mock('./supabase', () => ({
  supabase: { from: (table: string) => fake.current!.client.from(table) },
}))

import { fetchJobsLedgerForScheduleDispatchHub } from './scheduleDispatchHub'

/** `n` dispatchable jobs, newest HCP number first, as the hub orders them. */
const jobRows = (n: number, over: Record<string, unknown> = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: `j${String(i).padStart(4, '0')}`,
    hcp_number: String(2000 - i),
    click_number: null,
    job_name: `Job ${i}`,
    project_id: null,
    created_at: '2026-10-01T00:00:00Z',
    job_address: null,
    customer_name: null,
    status: 'working',
    billing_only: false,
    service_type: { name: 'PLUM' },
    ...over,
  }))

const HUB_SELECT =
  'id, hcp_number, click_number, job_name, project_id, created_at, job_address, customer_name, status, service_type:service_types(name)'

afterEach(() => {
  fake.current = null
})

describe('fetchJobsLedgerForScheduleDispatchHub (v2.5571: paged past the 1,000-row cap)', () => {
  it('reads a second page when the first is full, so job 1,001 is on the list', async () => {
    fake.current = makeFakeRowCapSupabase({ jobs_ledger: jobRows(1400) })
    const r = await fetchJobsLedgerForScheduleDispatchHub()
    expect(fake.current.calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(r.error).toBeNull()
    expect(r.data).toHaveLength(1400)
    expect(r.data[1399]!.id).toBe('j1399')
  })

  it('reads one page when it comes back short', async () => {
    fake.current = makeFakeRowCapSupabase({ jobs_ledger: jobRows(40) })
    const r = await fetchJobsLedgerForScheduleDispatchHub()
    expect(fake.current.calls).toHaveLength(1)
    expect(r).toEqual({ data: expect.any(Array), error: null })
    expect(r.data).toHaveLength(40)
  })

  it('reads a closing empty page when the ledger holds exactly one full page', async () => {
    fake.current = makeFakeRowCapSupabase({ jobs_ledger: jobRows(1000) })
    const r = await fetchJobsLedgerForScheduleDispatchHub()
    expect(fake.current.calls).toHaveLength(2)
    expect(r.data).toHaveLength(1000)
  })

  it('sends the hub select, the billing-only filter and the two-column order on a fresh query per page', async () => {
    const billingOnly = jobRows(5, { billing_only: true }).map((row) => ({ ...row, id: `bill-${row.id}` }))
    fake.current = makeFakeRowCapSupabase({ jobs_ledger: [...jobRows(1000), ...billingOnly] })
    const r = await fetchJobsLedgerForScheduleDispatchHub()
    const { calls } = fake.current
    expect(calls).toHaveLength(2)
    expect(calls[0]).not.toBe(calls[1])
    for (const call of calls) {
      expect(call.table).toBe('jobs_ledger')
      expect(call.select).toBe(HUB_SELECT)
      expect(call.eq).toEqual([['billing_only', false]])
      expect(call.order).toEqual(['hcp_number', 'id'])
      expect(call.in).toBeNull()
    }
    // A GC job's billing job carries only bills: it never reaches the hub (v2.4958).
    expect(r.data).toHaveLength(1000)
    expect(r.data.some((row) => row.id.startsWith('bill-'))).toBe(false)
  })

  it('a failed page is reported as an error with no rows, never as a shorter ledger', async () => {
    fake.current = makeFakeRowCapSupabase(
      { jobs_ledger: jobRows(1400) },
      { failOnCall: 2, failWith: { message: 'permission denied for table jobs_ledger', code: '42501' }, failStatus: 403 },
    )
    const r = await fetchJobsLedgerForScheduleDispatchHub()
    expect(fake.current.calls).toHaveLength(2)
    expect(r.data).toEqual([])
    expect(r.error).toBeTruthy()
  })
})
