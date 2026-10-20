// @vitest-environment jsdom
/**
 * The Dashboard's Billed pin and ZZ test jobs (punch list #61, v2.5120). With the option the pin's
 * Owed loses a ZZ job's bill, found by the shared ids because this read carries no names; without
 * it, the pin reads as before and the ids are never asked for. Made-up jobs and amounts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const job = (id: string) => ({ id, status: 'billed', revenue: id === 'Z' ? 2200 : 500, payments_made: 0, collections_at: null, uncollectible_at: null })
const bill = (id: string, jobId: string, amount: number) => ({ id, job_id: jobId, amount, status: 'billed', sequence_order: 1, billed_at: '2026-09-01' })
const TABLES: Record<string, unknown[]> = {
  jobs_ledger: [job('A'), job('Z')],
  jobs_ledger_invoices: [bill('i1', 'A', 500), bill('iz', 'Z', 2200)],
  jobs_ledger_payments: [{ invoice_id: 'iz', amount: 100 }],
}
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'or', 'eq', 'in']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: TABLES[table] ?? [], error: null })
      return chain
    },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown }>) => (await op()).data,
}))
const unlinked = vi.fn(async (_jobIds: string[]) => ({ unlinkedPayments: [], paidBills: [], paidBillPayments: [] }))
vi.mock('../lib/billing/loadUnlinkedMoney', () => ({ loadUnlinkedMoney: (jobIds: string[]) => unlinked(jobIds) }))
const loadIds = vi.fn(async (_userId: string | null | undefined) => new Set(['Z']))
vi.mock('../lib/jobs/zzTestJobRows', () => ({ loadZzTestJobIds: (userId: string | null | undefined) => loadIds(userId) }))

const { useBilledTotal } = await import('./useBilledTotal')

beforeEach(() => {
  loadIds.mockClear()
  unlinked.mockClear()
})

describe('useBilledTotal · ZZ test jobs', () => {
  it('without the option, the pin counts the ZZ job’s bill and never asks for the ids', async () => {
    const { result } = renderHook(() => useBilledTotal(true, 0, false))
    await waitFor(() => expect(result.current.total).not.toBeNull())
    expect(result.current).toMatchObject({ count: 2, total: 2600 })
    expect(loadIds).not.toHaveBeenCalled()
  })

  it('with it, the pin falls by exactly the ZZ job’s open bill, read for this user', async () => {
    const { result } = renderHook(() => useBilledTotal(true, 0, true, 'u-ann'))
    await waitFor(() => expect(result.current.total).not.toBeNull())
    expect(result.current).toMatchObject({ count: 1, total: 500 })
    expect(loadIds).toHaveBeenCalledWith('u-ann')
  })

  it('drops the ZZ job before the unlinked money is read, so its money is never fetched (review on #5241)', async () => {
    const { result } = renderHook(() => useBilledTotal(true, 0, true, 'u-ann'))
    await waitFor(() => expect(result.current.total).not.toBeNull())
    expect(unlinked).toHaveBeenCalledWith(['A'])
  })

  it('a failed id read leaves the pin empty rather than counting the ZZ job', async () => {
    loadIds.mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useBilledTotal(true, 0, true, 'u-ann'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current).toMatchObject({ count: null, total: null })
  })
})
