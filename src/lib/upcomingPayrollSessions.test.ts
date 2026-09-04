import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { loadUpcomingClockSessions } from './upcomingPayrollSessions'

/**
 * Fake client that mimics PostgREST's silent `max_rows` cap: un-ranged
 * queries return at most 1000 rows with NO error, ranged queries slice.
 * A four-month roster window is past the cap in prod (the v2.2756 tripwire's
 * first live catch), so an un-paged read understated upcoming payroll.
 */
function makeFakeSupabase(rows: Array<Record<string, unknown>>) {
  const calls: Array<{ ranged: boolean; inSize: number }> = []
  function builder() {
    let range: [number, number] | null = null
    let ids: unknown[] = []
    let gte: string | null = null
    const b = {
      select: () => b,
      in: (_c: string, vals: unknown[]) => { ids = vals; return b },
      gte: (_c: string, v: string) => { gte = v; return b },
      is: () => b,
      order: () => b,
      range: (from: number, to: number) => { range = [from, to]; return b },
      then: (resolve: (r: { data: unknown[]; error: null }) => unknown, reject?: (e: unknown) => unknown) => {
        calls.push({ ranged: range != null, inSize: ids.length })
        const filtered = rows.filter((r) => ids.includes(r.user_id) && (gte == null || (r.work_date as string) >= gte))
        const data = range ? filtered.slice(range[0], range[1] + 1) : filtered.slice(0, 1000)
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return b
  }
  const client = { from: () => builder() } as unknown as SupabaseClient<Database>
  return { client, calls }
}

const sessions = Array.from({ length: 2400 }, (_, i) => ({
  id: `s${i}`,
  user_id: `u${i % 12}`,
  work_date: `2026-0${5 + Math.floor(i / 800)}-${String(1 + (i % 28)).padStart(2, '0')}`,
  clocked_in_at: 'x',
  clocked_out_at: 'y',
}))

describe('loadUpcomingClockSessions', () => {
  it('pages past the 1000-row cap and returns every roster session in the window', async () => {
    const { client, calls } = makeFakeSupabase(sessions)
    const ids = Array.from({ length: 12 }, (_, i) => `u${i}`)
    const rows = await loadUpcomingClockSessions(client, ids, '2026-05-01')
    expect(rows).toHaveLength(2400)
    expect(calls.every((c) => c.ranged)).toBe(true)
    expect(calls.length).toBeGreaterThanOrEqual(3)
  })

  it('honors the window start and returns [] for an empty roster without a query', async () => {
    const { client, calls } = makeFakeSupabase(sessions)
    expect(await loadUpcomingClockSessions(client, [], '2026-05-01')).toEqual([])
    expect(calls).toHaveLength(0)
    const late = await loadUpcomingClockSessions(client, ['u0'], '2026-07-01')
    expect(late.every((r) => r.work_date >= '2026-07-01')).toBe(true)
    expect(late.length).toBeGreaterThan(0)
  })
})
