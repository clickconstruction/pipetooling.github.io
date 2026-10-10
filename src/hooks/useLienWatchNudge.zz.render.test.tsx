// @vitest-environment jsdom
/**
 * The lien watch and ZZ test jobs (punch list #61, review on #5250): a ZZ test job leaves the watch by the job's or
 * the customer's name on its own read. The watch kernel is a stand-in here (its own suite covers the deadlines):
 * every job it is handed is due a notice. Made-up jobs.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const job = (id: string, jobName: string, customerName: string) => ({
  id, job_name: jobName, customer_name: customerName, status: 'billed', gc_customer_id: 'gc-1', last_work_date: '2026-08-01',
  lien_last_work_on: null, revenue: 500, payments_made: 0, customer_address_id: null,
})
const JOBS = [job('A', '101 Hill Street', 'Ann Lee'), job('Z', 'ZZ TEST lien', 'Ann Lee'), job('Y', 'Hill Street remodel', 'ZZ Test Customer')]
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'is', 'in']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: table === 'jobs_ledger' ? JOBS : [], error: null })
      return chain
    },
  },
}))
vi.mock('../lib/jobs/lienBilledOpen', () => ({ lienBilledOpen: () => 500 }))
vi.mock('../lib/jobs/lienDeadlines', () => ({
  assessLienWatch: (jobs: { id: string }[]) => ({ noticeDue: jobs.map((j) => j.id), filingDue: [], serveDue: [], suitDue: [], trackingOwed: [] }),
}))

const { useLienWatchNudge } = await import('./useLienWatchNudge')

const read = async (hide: boolean) => {
  const { result } = renderHook(() => useLienWatchNudge(true, hide))
  await waitFor(() => expect(result.current.watch).not.toBeNull())
  return result.current.watch!.noticeDue as unknown as string[]
}

describe('useLienWatchNudge · ZZ test jobs', () => {
  it('a ZZ job, by its own or its customer’s name, leaves the watch', async () => {
    expect(await read(true)).toEqual(['A'])
  })

  it('for a dev who shows ZZ jobs, the watch keeps every job', async () => {
    expect(await read(false)).toEqual(['A', 'Z', 'Y'])
  })
})
