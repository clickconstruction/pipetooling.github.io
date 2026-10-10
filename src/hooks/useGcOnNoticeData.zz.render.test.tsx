// @vitest-environment jsdom
/**
 * GC on notice and ZZ test jobs (punch list #61, PR 3): a ZZ job under the GC leaves the run (its months, desk
 * items, line items, bills and payments) right after the jobs are read, by the joined rows' own names. Without
 * the option the run reads as before. Made-up jobs.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const month = (jobId: string) => ({
  job_id: jobId, work_month: '2026-08', approved_hours: 10, deadline: '2026-10-15', noticed: false, open_balance: 500,
  customer_id: 'c1', gc_customer_id: 'gc-1', property_kind: 'commercial', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null,
  is_billed: true, job_status: 'billed', last_work_month: '2026-08',
})
const job = (id: string, name: string) => ({ id, hcp_number: id, click_number: null, job_name: name, customer_name: 'Ann Lee', gc_customer_id: 'gc-1', revenue: 500, payments_made: 0, status: 'billed', pct_complete: 100 })
const TABLES: Record<string, unknown[]> = {
  jobs_ledger: [job('A', '101 Hill Street'), job('Z', 'ZZ TEST lien')],
  jobs_ledger_invoices: [
    { id: 'iA', job_id: 'A', amount: 500, status: 'billed', sequence_order: 1 },
    { id: 'iZ', job_id: 'Z', amount: 500, status: 'billed', sequence_order: 1 },
  ],
  customers: [{ id: 'gc-1', name: 'Knight Builders', address: '', contact_info: null, lien_notice_policy: null, lien_notice_policy_note: null, payment_terms: null, payment_terms_note: null }],
}
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'is', 'order', 'in', 'eq']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: TABLES[table] ?? [], error: null })
      return chain
    },
    rpc: (name: string) => Promise.resolve({ data: name === 'list_gc_unpaid_months' ? [month('A'), month('Z')] : [], error: null }),
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))

const { useGcOnNoticeData } = await import('./useGcOnNoticeData')

const read = async (hideZzTestJobs: boolean) => {
  const { result } = renderHook(() => useGcOnNoticeData('gc-1', '2026-10-09', hideZzTestJobs))
  await waitFor(() => expect(result.current.data).not.toBeNull())
  return result.current.data!
}

describe('useGcOnNoticeData · ZZ test jobs', () => {
  it('a ZZ job under the GC leaves the run, with its bills', async () => {
    const data = await read(true)
    expect(data.rows.map((r) => r.job_id)).toEqual(['A'])
    expect(Object.keys(data.workByJob)).toEqual(['A'])
    expect(data.workByJob.A!.invoices.map((i) => (i as { id: string }).id)).toEqual(['iA'])
  })

  it('without the option, the run reads every job', async () => {
    const data = await read(false)
    expect(data.rows.map((r) => r.job_id).sort()).toEqual(['A', 'Z'])
  })
})
