// @vitest-environment jsdom
/**
 * Returned deposits and ZZ test jobs (punch list #61, v2.5122): a returned payment on a ZZ job leaves the card,
 * by its job's names and the shared ids. A returned deposit warns about real money and feeds the Pipeline's
 * Billed badges, so a failed id read falls back to the names instead of emptying the card (review on #5246).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const TABLES: Record<string, unknown[]> = {
  mercury_transactions: [
    { id: 'tA', status: 'failed', posted_at: '2026-10-01', amount: 500, kind: 'checkDeposit', failure_reason: 'NSF' },
    { id: 'tZ', status: 'failed', posted_at: '2026-10-01', amount: 200, kind: 'checkDeposit', failure_reason: 'NSF' },
    { id: 'tY', status: 'failed', posted_at: '2026-10-01', amount: 100, kind: 'checkDeposit', failure_reason: 'NSF' },
  ],
  jobs_ledger_payments: [
    { id: 'pA', job_id: 'A', amount: 500, mercury_transaction_id: 'tA' },
    { id: 'pZ', job_id: 'Z', amount: 200, mercury_transaction_id: 'tZ' },
    { id: 'pY', job_id: 'Y', amount: 100, mercury_transaction_id: 'tY' },
  ],
  // Y is a ZZ job only by an id the shared read knows; Z by its own name.
  jobs_ledger: [
    { id: 'A', hcp_number: '101', job_name: '101 Hill Street', customer_name: 'Ann Lee' },
    { id: 'Z', hcp_number: '999', job_name: 'ZZ TEST billed', customer_name: 'Ann Lee' },
    { id: 'Y', hcp_number: '998', job_name: 'Hill Street remodel', customer_name: 'Ann Lee' },
  ],
}
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'gt', 'order', 'limit', 'in']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: TABLES[table] ?? [], error: null })
      return chain
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}))
let idsFail = false
const loadIds = vi.fn(async (_u: unknown) => {
  if (idsFail) throw new Error('down')
  return new Set(['Z', 'Y'])
})
vi.mock('../lib/jobs/zzTestJobRows', () => ({ loadZzTestJobIds: (u: unknown) => loadIds(u) }))

const { useBankReturnedPaymentsNudge } = await import('./useBankReturnedPaymentsNudge')

const jobIdsOf = (returned: unknown) =>
  ((returned as { items?: Array<{ jobId: string }> } | null)?.items ?? []).map((i) => i.jobId).sort()

beforeEach(() => {
  idsFail = false
  loadIds.mockClear()
})

describe('useBankReturnedPaymentsNudge · ZZ test jobs', () => {
  it('drops a ZZ job by its name and by the shared ids', async () => {
    const { result } = renderHook(() => useBankReturnedPaymentsNudge(true, true, 'u-ann'))
    await waitFor(() => expect(result.current.returned).not.toBeNull())
    expect(jobIdsOf(result.current.returned)).toEqual(['A'])
  })

  it('a failed id read falls back to the names: the real job stays on the card', async () => {
    idsFail = true
    const { result } = renderHook(() => useBankReturnedPaymentsNudge(true, true, 'u-ann'))
    await waitFor(() => expect(result.current.returned).not.toBeNull())
    expect(jobIdsOf(result.current.returned)).toEqual(['A', 'Y'])
  })
})
