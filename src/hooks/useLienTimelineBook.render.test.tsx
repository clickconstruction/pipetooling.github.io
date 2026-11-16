// @vitest-environment jsdom
/**
 * By job's read beside the desk's (v2.7463): the hook starts reading as soon as the tab is open, before the
 * desk hands its items over, folds the book once both are in hand without a second read, and reads again when
 * the desk hands over a new list (its refetch behind a write). Made-up jobs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { LienDeskItemRow } from '../lib/jobs/lienDesk'

const month = (jobId: string, workMonth: string) => ({
  job_id: jobId, work_month: workMonth, approved_hours: 10, deadline: '2026-10-15', noticed: false, open_balance: 500,
  customer_id: 'c1', gc_customer_id: 'gc-1', property_kind: 'non_residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null,
})
const RPC: Record<string, unknown[]> = {
  list_lien_notice_months: [month('A', '2026-08'), month('Z', '2026-08')],
  list_lien_affidavit_windows: [{ job_id: 'B', last_month: '2026-07', deadline: '2026-11-16', is_sub: true, noticed: true, filed: false, open_balance: 300, customer_id: 'c1', gc_customer_id: 'gc-1', property_kind: 'residential', has_owner: true }],
}
const job = (id: string, name: string) => ({ id, hcp_number: id, click_number: null, job_name: name, job_address: `${id} Main St`, customer_name: 'Ann Lee', gc_customer_id: 'gc-1', customer_address_id: null, revenue: 900, payments_made: 400, last_work_date: '2026-08-20', in_kind_arrangement_id: null })
const TABLES: Record<string, unknown[]> = {
  jobs_ledger: [job('A', '101 Hill Street'), job('B', 'Marrow Lane'), job('Z', 'ZZ TEST lien')],
  customers: [{ id: 'gc-1', name: 'Kestrin Builders', lien_notice_policy: 'ask' }],
}
const calls: string[] = []
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      calls.push(table)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'is', 'in']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: TABLES[table] ?? [], error: null })
      return chain
    },
    rpc: (name: string) => {
      calls.push(name)
      return Promise.resolve({ data: RPC[name] ?? [], error: null })
    },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  formatErrorMessage: (_e: unknown, fallback: string) => fallback,
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))

const { useLienTimelineBook } = await import('./useLienTimelineBook')

const TODAY = '2026-10-09'
const ITEMS = [{ id: 'iA', job_id: 'A', kind: 'notice_53_056', status: 'held', months: ['2026-08'], created_at: '2026-10-01', voided_at: null }] as unknown as LienDeskItemRow[]
/** The reads of one pass, each one trip: seven here, where no job has a property record to read. */
const ONE_PASS = ['customers', 'job_demand_letters', 'job_lien_filings', 'job_property_owners', 'jobs_ledger', 'list_lien_affidavit_windows', 'list_lien_notice_months']

beforeEach(() => {
  calls.length = 0
})

describe('useLienTimelineBook', () => {
  it('reads nothing until the tab is open', async () => {
    const { result } = renderHook(() => useLienTimelineBook(false, TODAY, ITEMS, true))
    await new Promise((r) => setTimeout(r, 10))
    expect(calls).toEqual([])
    expect(result.current).toMatchObject({ book: null, loading: false, error: '' })
  })

  it('reads beside the desk: its trips are made before the items come, and the book folds when they do, with no second read', async () => {
    const { result, rerender } = renderHook(({ items }: { items: LienDeskItemRow[] | null }) => useLienTimelineBook(true, TODAY, items, true), { initialProps: { items: null as LienDeskItemRow[] | null } })
    // The desk has handed nothing over yet: the book says it is on its way from the first moment.
    expect(result.current).toMatchObject({ book: null, loading: true })
    await waitFor(() => expect([...calls].sort()).toEqual(ONE_PASS))
    expect(result.current).toMatchObject({ book: null, loading: true, error: '' })

    rerender({ items: ITEMS })
    await waitFor(() => expect(result.current.book).not.toBeNull())
    expect(result.current.loading).toBe(false)
    // A and B are in the book, the ZZ test job is not; A's held notice came from the desk's items.
    expect(result.current.book!.rows.map((r) => r.jobId).sort()).toEqual(['A', 'B'])
    expect(result.current.book!.gcs).toEqual([{ id: 'gc-1', name: 'Kestrin Builders', count: 2 }])
    await new Promise((r) => setTimeout(r, 10))
    expect([...calls].sort()).toEqual(ONE_PASS)
  })

  it('the tab opened after the desk is read: one pass, then the book', async () => {
    const { result } = renderHook(() => useLienTimelineBook(true, TODAY, ITEMS, false))
    await waitFor(() => expect(result.current.book).not.toBeNull())
    expect(result.current.book!.rows.map((r) => r.jobId).sort()).toEqual(['A', 'B', 'Z'])
    expect([...calls].sort()).toEqual(ONE_PASS)
  })

  it('reads again when the desk hands over a new list of items', async () => {
    const { result, rerender } = renderHook(({ items }: { items: LienDeskItemRow[] | null }) => useLienTimelineBook(true, TODAY, items, true), { initialProps: { items: ITEMS as LienDeskItemRow[] | null } })
    await waitFor(() => expect(result.current.book).not.toBeNull())
    expect(calls).toHaveLength(ONE_PASS.length)
    const first = result.current.book
    rerender({ items: [...ITEMS] })
    await waitFor(() => expect(calls).toHaveLength(ONE_PASS.length * 2))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.book).toEqual(first)
  })
})
