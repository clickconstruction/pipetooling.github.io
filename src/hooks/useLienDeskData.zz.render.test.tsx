// @vitest-environment jsdom
/**
 * The Lien desk and ZZ test jobs (punch list #61, PR 3): a ZZ job leaves all four lists (the due months, the
 * items, the affidavit and retainage windows) and the jobs right after the jobs join, by the joined rows' own
 * names, before any queue is built. Without the option the desk reads as before. Made-up jobs, light mode.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const month = (jobId: string) => ({
  job_id: jobId, work_month: '2026-08', approved_hours: 10, deadline: '2026-10-15', noticed: false, open_balance: 500,
  customer_id: 'c1', gc_customer_id: 'gc-1', property_kind: 'commercial', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null,
})
const RPC: Record<string, unknown[]> = {
  list_lien_notice_months: [month('A'), month('Z')],
  list_lien_affidavit_windows: [
    { job_id: 'Y', last_month: '2026-08', deadline: '2026-11-15', is_sub: true, noticed: false, filed: false, open_balance: 300, customer_id: 'c1', gc_customer_id: 'gc-1', property_kind: 'commercial', has_owner: true },
  ],
  list_lien_retainage_windows: [
    { job_id: 'Z', retainage_held: 100, contract_ended_on: null, contract_ended_how: null, deadline: null, noticed: false, open_balance: 100, customer_id: 'c1', gc_customer_id: 'gc-1', property_kind: 'commercial', has_owner: true },
  ],
}
const job = (id: string, name: string, customer: string) => ({ id, hcp_number: id, click_number: null, job_name: name, customer_name: customer, gc_customer_id: 'gc-1', revenue: 500, payments_made: 0 })
const TABLES: Record<string, unknown[]> = {
  job_lien_desk_items: [
    { id: 'iA', job_id: 'A', kind: 'notice_53_056', status: 'held', months: ['2026-08'], created_at: '2026-10-01', voided_at: null },
    { id: 'iZ', job_id: 'Z', kind: 'notice_53_056', status: 'held', months: ['2026-08'], created_at: '2026-10-01', voided_at: null },
  ],
  // Z is a ZZ job by its own name, Y by its customer's.
  jobs_ledger: [job('A', '101 Hill Street', 'Ann Lee'), job('Z', 'ZZ TEST lien', 'Ann Lee'), job('Y', 'Hill Street remodel', 'ZZ Test Customer')],
  customers: [{ id: 'gc-1', name: 'Knight Builders', address: '', contact_info: null, lien_notice_policy: null, lien_notice_policy_note: null }],
}
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'is', 'order', 'in', 'eq']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: TABLES[table] ?? [], error: null })
      return chain
    },
    rpc: (name: string) => Promise.resolve({ data: RPC[name] ?? [], error: null }),
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))

const { useLienDeskData } = await import('./useLienDeskData')

const read = async (hideZzTestJobs: boolean) => {
  const { result } = renderHook(() => useLienDeskData(true, '2026-10-09', { light: true, hideZzTestJobs }))
  await waitFor(() => expect(result.current.data).not.toBeNull())
  return result.current.data!
}

describe('useLienDeskData · ZZ test jobs', () => {
  it('drops a ZZ job, by its own name or its customer’s, from all four lists and the jobs', async () => {
    const data = await read(true)
    expect(data.rows.map((r) => r.job_id)).toEqual(['A'])
    expect(data.items.map((i) => i.job_id)).toEqual(['A'])
    expect(data.affidavitRows).toEqual([])
    expect(data.retainageRows).toEqual([])
    expect(Object.keys(data.jobsById).sort()).toEqual(['A'])
  })

  it('without the option, reads every job as before', async () => {
    const data = await read(false)
    expect(data.rows.map((r) => r.job_id).sort()).toEqual(['A', 'Z'])
    expect(data.affidavitRows.map((r) => r.job_id)).toEqual(['Y'])
    expect(Object.keys(data.jobsById).sort()).toEqual(['A', 'Y', 'Z'])
  })
})
