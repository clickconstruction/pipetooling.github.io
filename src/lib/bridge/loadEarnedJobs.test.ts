import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { byJobLabel, loadEarnedJobs, type BridgeJobRow } from './loadBridgeData'

/**
 * v2.5983: the jobs read in `loadEarnedJobs` has no ORDER BY, so a dev's read and the weekly send's (as the service role)
 * came back in different orders and the Monday sheet's "Price jobs …" move named different jobs on the page and in the
 * mail. The loader now returns the jobs in job-number order, whatever order the rows arrive in.
 */
type Row = { id: string; job_name: string | null; hcp_number: string | null; click_number: string | null; revenue: number | null; pct_complete: number | null; status: string }
function fakeDb(jobRows: Row[]) {
  return {
    from(table: string) {
      const builder: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: table === 'jobs_ledger' ? jobRows : [], error: null })
            return () => builder
          },
        },
      )
      return builder
    },
  } as unknown as SupabaseClient<Database>
}
const row = (id: string, number: string, name: string): Row => ({ id, job_name: name, hcp_number: number, click_number: null, revenue: null, pct_complete: null, status: 'working' })
const rows = [row('a', '1086', 'Big Easy sink drain'), row('b', '1024', 'Lawver install'), row('c', '999', 'Small service call'), row('d', '1075', 'DRF Line Repair'), row('e', '1017', 'Terrell concrete')]

describe('loadEarnedJobs returns its jobs in job-number order (v2.5983)', () => {
  it('whatever order the rows arrive in, the jobs and the earned-revenue jobs come out the same', async () => {
    const one = await loadEarnedJobs(fakeDb(rows), rows.map((r) => r.id))
    const two = await loadEarnedJobs(fakeDb([...rows].reverse()), rows.map((r) => r.id))
    const labels = one.jobs.map((j) => j.label)
    expect(labels).toEqual(['999 Small service call', '1017 Terrell concrete', '1024 Lawver install', '1075 DRF Line Repair', '1086 Big Easy sink drain'])
    expect(two.jobs.map((j) => j.label)).toEqual(labels)
    expect(two.earnedJobs.map((j) => j.id)).toEqual(one.earnedJobs.map((j) => j.id))
  })

  it('compares the numbers as numbers, and breaks a tie on the id', () => {
    const job = (id: string, label: string): BridgeJobRow => ({ id, label, revenueUsd: null, pctComplete: null, status: 'working' })
    expect([job('x', '1017 B'), job('y', '999 A')].sort(byJobLabel).map((j) => j.label)).toEqual(['999 A', '1017 B'])
    expect([job('z', '1017 A'), job('y', '1017 A')].sort(byJobLabel).map((j) => j.id)).toEqual(['y', 'z'])
  })
})
