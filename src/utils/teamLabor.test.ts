import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadTeamLaborData, loadTeamLaborDataForBids } from './teamLabor'

/**
 * Fake client that mimics PostgREST's silent `max_rows` cap: un-ranged
 * queries return at most 1000 rows with NO error, ranged queries slice.
 * Guards the paging in loadTeamLaborData/loadTeamLaborDataForBids —
 * people_crew_jobs and the 2-year people_hours window are both past the cap
 * in prod, so an un-paged fetch silently aggregates an arbitrary subset.
 */
function makeFakeSupabase(
  tables: Record<string, unknown[]>,
  rpcs: Record<string, unknown[]>,
): SupabaseClient {
  function builder(table: string) {
    let range: [number, number] | null = null
    const b = {
      select: () => b,
      gte: () => b,
      lte: () => b,
      in: () => b,
      order: () => b,
      contains: () => b,
      range: (from: number, to: number) => {
        range = [from, to]
        return b
      },
      then: (resolve: (r: { data: unknown[]; error: null }) => unknown, reject?: (e: unknown) => unknown) => {
        const rows = tables[table] ?? []
        const data = range ? rows.slice(range[0], range[1] + 1) : rows.slice(0, 1000)
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return b
  }
  return {
    from: (table: string) => builder(table),
    rpc: (name: string) => Promise.resolve({ data: rpcs[name] ?? [], error: null }),
  } as unknown as SupabaseClient
}

/** i days after 2025-01-01, as YYYY-MM-DD. */
function isoDate(i: number): string {
  return new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10)
}

const payConfigTable = [{ person_name: 'Al', person_id: 'p1', hourly_wage: 10 }]
const payFlagsRpc = [{ person_name: 'Al', person_id: 'p1', is_salary: false }]

describe('loadTeamLaborData', () => {
  it('pages past the 1000-row cap on crew days and hours', async () => {
    const days = 1500
    const supabase = makeFakeSupabase(
      {
        people_crew_jobs: Array.from({ length: days }, (_, i) => ({
          work_date: isoDate(i),
          person_name: 'Al',
          person_id: 'p1',
          job_assignments: [{ job_id: 'job-1', pct: 100 }],
        })),
        people_hours: Array.from({ length: days }, (_, i) => ({
          person_name: 'Al',
          person_id: 'p1',
          work_date: isoDate(i),
          hours: 1,
        })),
        people_pay_config: payConfigTable,
      },
      {
        list_people_pay_flags: payFlagsRpc,
        get_jobs_ledger_by_ids: [{ id: 'job-1', hcp_number: 'J100', job_name: 'Job One', job_address: '1 Main St' }],
      },
    )
    const rows = await loadTeamLaborData(supabase)
    expect(rows).toHaveLength(1)
    // Un-paged fetches would cap both tables at 1000 rows → 1000 hours.
    expect(rows[0]!.manHours).toBe(days)
    expect(rows[0]!.jobCost).toBe(days * 10)
    expect(rows[0]!.hcpNumber).toBe('J100')
  })
})

describe('loadTeamLaborDataForBids', () => {
  it('pages the hours fetch so crew-bid days past the cap still cost out', async () => {
    // Few crew-bid days, but they fall AFTER the 1000th hours row — an
    // un-paged hours fetch would zero them.
    const supabase = makeFakeSupabase(
      {
        people_crew_bids: Array.from({ length: 5 }, (_, i) => ({
          work_date: isoDate(1200 + i),
          person_name: 'Al',
          person_id: 'p1',
          bid_assignments: [{ bid_id: 'bid-1', pct: 100 }],
        })),
        people_hours: Array.from({ length: 1500 }, (_, i) => ({
          person_name: 'Al',
          person_id: 'p1',
          work_date: isoDate(i),
          hours: 1,
        })),
        people_pay_config: payConfigTable,
      },
      {
        list_people_pay_flags: payFlagsRpc,
        get_bids_by_ids: [{ id: 'bid-1', bid_number: 'B7', project_name: 'Proj', address: '2 Oak Ave' }],
      },
    )
    const rows = await loadTeamLaborDataForBids(supabase)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.manHours).toBe(5)
    expect(rows[0]!.bidCost).toBe(50)
  })
})
