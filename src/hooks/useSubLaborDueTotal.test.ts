import { describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ rows: {} as Record<string, unknown[]> }))

vi.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'in', 'order']) b[m] = () => b
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: db.rows[table] ?? [], error: null }).then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

import { fetchSubLaborDueJobRows } from './useSubLaborDueTotal'

describe('fetchSubLaborDueJobRows · a sheet made in the evening keeps its day (v2.4469)', () => {
  it('dates each owed sheet by the Central day it was made', async () => {
    const sheet = (id: string, created_at: string) => ({ id, assigned_to_name: 'Sam Sub', address: '', job_number: id, labor_rate: 50, distance_miles: 0, created_at })
    const item = (job_id: string) => ({ job_id, fixture: 'Rough-in', count: 1, hrs_per_unit: 0, is_fixed: true, labor_rate: null, direct_labor_amount: 500 })
    db.rows = {
      // 00:30 UTC on Sep 11 is 7:30 pm CDT on Sep 10; 00:30 UTC on Dec 2 is 6:30 pm CST on Dec 1.
      people_labor_jobs: [sheet('evening', '2026-09-11T00:30:00Z'), sheet('winter', '2026-12-02T00:30:00+00:00'), sheet('noon', '2026-09-11T12:00:00Z')],
      people_labor_job_items: [item('evening'), item('winter'), item('noon')],
      people_labor_job_payments: [],
    }
    const rows = await fetchSubLaborDueJobRows()
    expect(Object.fromEntries(rows.map((r) => [r.id, r.createdYmd]))).toEqual({ evening: '2026-09-10', winter: '2026-12-01', noon: '2026-09-11' })
  })
})
