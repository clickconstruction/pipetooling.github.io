// @vitest-environment jsdom
/**
 * Lien releases owed and ZZ test jobs (punch list #61, PR 3): once the owed jobs are read, a release on a ZZ job
 * leaves before the count and the queue are made again. The release kernels are stand-ins here (their own suite
 * covers the clearance rules): every release's job counts as owed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const RELEASES = [
  { id: 'rA', job_id: 'A', invoice_ids: [], amount: 500, voided_at: null, created_at: '2026-10-01' },
  { id: 'rZ', job_id: 'Z', invoice_ids: [], amount: 2200, voided_at: null, created_at: '2026-10-01' },
]
const JOBS = [
  { id: 'A', hcp_number: '101', click_number: null, job_name: '101 Hill Street', customer_name: 'Ann Lee', job_address: '' },
  { id: 'Z', hcp_number: '999', click_number: null, job_name: 'Hill Street remodel', customer_name: 'ZZ Test Customer', job_address: '' },
]
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'is', 'in']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({ data: table === 'job_lien_releases' ? RELEASES : table === 'jobs_ledger' ? JOBS : [], error: null })
      return chain
    },
  },
}))
type R = { job_id: string; amount: number }
let owedCalls = 0
vi.mock('../lib/jobs/lienReleaseTracking', () => ({
  liveLienReleases: (rows: R[]) => rows,
  appliedByInvoiceIdFromPayments: () => new Map(),
  owedLienReleasesByJob: (rows: R[]) => {
    owedCalls += 1
    const byJob = new Map<string, R[]>()
    for (const r of rows) byJob.set(r.job_id, [...(byJob.get(r.job_id) ?? []), r])
    return byJob
  },
  summarizeLienUnconditionalOwed: (byJob: Map<string, R[]>) => ({
    count: [...byJob.values()].reduce((s, l) => s + l.length, 0),
    total: [...byJob.values()].flat().reduce((s, r) => s + r.amount, 0),
    jobIds: [...byJob.keys()],
  }),
  buildLienUnconditionalQueue: (rows: R[]) => rows.map((r) => ({ jobId: r.job_id })),
}))

const { useLienReleasesOwedNudge } = await import('./useLienReleasesOwedNudge')

describe('useLienReleasesOwedNudge · ZZ test jobs', () => {
  beforeEach(() => {
    owedCalls = 0
  })

  it('a release on a ZZ job leaves the count, the dollars and the queue', async () => {
    const { result } = renderHook(() => useLienReleasesOwedNudge(true, true))
    await waitFor(() => expect(result.current.owed).not.toBeNull())
    expect(result.current.owed).toEqual({ count: 1, total: 500, jobIds: ['A'] })
    expect(result.current.queue).toEqual([{ jobId: 'A' }])
    expect(owedCalls).toBe(1) // worked out once, the ZZ job dropped from the map (review on #5250)
  })

  it('without the option, counts as before', async () => {
    const { result } = renderHook(() => useLienReleasesOwedNudge(true, false))
    await waitFor(() => expect(result.current.owed).not.toBeNull())
    expect(result.current.owed).toEqual({ count: 2, total: 2700, jobIds: ['A', 'Z'] })
  })
})
