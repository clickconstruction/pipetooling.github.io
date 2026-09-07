import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The dispatch hub's Subs-lane loads: live sub work orders with their stage
 * window and fixture name, crews grouped by job, and sub off-days. The span
 * and range rules live in `subDispatch` (own suite); this pins the reads
 * sent, the follow-up reads that are skipped when nothing needs them, the
 * row mapping, the range filter hand-off, and the empty-plus-error shape.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table, steps))
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))
const labels: string[] = []
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>, label: string) => {
    labels.push(label)
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  formatErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'Unknown error'),
}))

import { fetchSubOffDaysForRange, fetchSubOrdersForRange, fetchTeamMembersByJobId } from './subDispatchFetch'

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const tables = () => queries.map((q) => q.table)
const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  person_id: 'p1',
  display_name: 'Jesse',
  job_id: 'j1',
  status: 'accepted',
  record_id: 'wo-1',
  picked_start: '2026-09-08',
  picked_end: '2026-09-09',
  proposed_start: null,
  proposed_end: null,
  stage_window_id: null,
  job: { hcp_number: '1004', job_name: 'Goforth', job_address: '2210 Goforth Rd' },
  ...over,
})

beforeEach(() => {
  queries.length = 0
  labels.length = 0
  route = () => ({ data: [], error: null })
})

describe('fetchSubOrdersForRange', () => {
  it('reads live orders with their job, then only the windows and fixtures those orders reference, and maps each order with its stage name', async () => {
    route = (table) => {
      if (table === 'step_commitments') return { data: [order({ stage_window_id: 'w1' }), order({ id: 'o2', stage_window_id: 'w1', job: [{ hcp_number: '1005', job_name: null, job_address: null }] }), order({ id: 'o3', job: null })], error: null }
      if (table === 'job_stage_windows') return { data: [{ id: 'w1', fixture_id: 'f1', window_start: '2026-09-10', window_end: '2026-09-12' }], error: null }
      if (table === 'jobs_ledger_fixtures') return { data: [{ id: 'f1', name: ' Rough-in ' }], error: null }
      return { data: [], error: null }
    }
    const r = await fetchSubOrdersForRange('2026-09-07', '2026-09-13')
    expect(r.error).toBeNull()
    expect(tables()).toEqual(['step_commitments', 'job_stage_windows', 'jobs_ledger_fixtures'])
    const sc = queries[0]!.steps
    expect(argsOf(sc, 'select')).toEqual([['id, person_id, display_name, job_id, status, record_id, picked_start, picked_end, proposed_start, proposed_end, stage_window_id, job:job_id(hcp_number, job_name, job_address)']])
    expect(argsOf(sc, 'in')).toEqual([['status', ['offered', 'accepted', 'approved']]])
    expect(argsOf(sc, 'limit')).toEqual([[1000]])
    expect(argsOf(queries[1]!.steps, 'in')).toEqual([['id', ['w1']]]) // deduped
    expect(argsOf(queries[2]!.steps, 'in')).toEqual([['id', ['f1']]])
    expect(labels).toEqual(['fetchSubOrdersForRange', 'fetchSubOrdersForRange.windows', 'fetchSubOrdersForRange.fixtures'])
    expect(r.data).toEqual([
      { id: 'o1', personId: 'p1', personName: 'Jesse', jobId: 'j1', jobLabel: '#1004 · 2210 Goforth Rd', status: 'accepted', pickedStart: '2026-09-08', pickedEnd: '2026-09-09', proposedStart: null, proposedEnd: null, windowStart: '2026-09-10', windowEnd: '2026-09-12', stageName: 'Rough-in', recordId: 'wo-1' },
      { id: 'o2', personId: 'p1', personName: 'Jesse', jobId: 'j1', jobLabel: '#1005', status: 'accepted', pickedStart: '2026-09-08', pickedEnd: '2026-09-09', proposedStart: null, proposedEnd: null, windowStart: '2026-09-10', windowEnd: '2026-09-12', stageName: 'Rough-in', recordId: 'wo-1' },
      { id: 'o3', personId: 'p1', personName: 'Jesse', jobId: 'j1', jobLabel: 'Sub work order', status: 'accepted', pickedStart: '2026-09-08', pickedEnd: '2026-09-09', proposedStart: null, proposedEnd: null, windowStart: null, windowEnd: null, stageName: null, recordId: 'wo-1' },
    ])
  })

  it('no referenced windows → no window or fixture read; a blank fixture name reads as no stage; a blank display name reads as "Sub"; the job label falls back to the name', async () => {
    route = (table) => {
      if (table === 'step_commitments') return { data: [order({ display_name: '  ', job: { hcp_number: ' ', job_name: 'Goforth', job_address: '' } })], error: null }
      return { data: [], error: null }
    }
    const r = await fetchSubOrdersForRange('2026-09-07', '2026-09-13')
    expect(tables()).toEqual(['step_commitments'])
    expect(r.data.map((o) => [o.personName, o.jobLabel, o.stageName])).toEqual([['Sub', 'Goforth', null]])

    queries.length = 0
    route = (table) => {
      if (table === 'step_commitments') return { data: [order({ stage_window_id: 'w1' })], error: null }
      if (table === 'job_stage_windows') return { data: [{ id: 'w1', fixture_id: 'f1', window_start: null, window_end: null }], error: null }
      if (table === 'jobs_ledger_fixtures') return { data: [{ id: 'f1', name: null }], error: null }
      return { data: [], error: null }
    }
    expect((await fetchSubOrdersForRange('2026-09-07', '2026-09-13')).data.map((o) => o.stageName)).toEqual([null])
  })

  it('keeps only orders whose span touches the range (an offered order sits on its window, not its pick; an undated order is dropped)', async () => {
    route = (table) => {
      if (table === 'step_commitments')
        return {
          data: [
            order({ id: 'in' }),
            order({ id: 'before', picked_start: '2026-09-01', picked_end: '2026-09-02' }),
            order({ id: 'offered-window', status: 'offered', picked_start: '2026-09-01', picked_end: '2026-09-02', proposed_start: '2026-09-13', proposed_end: '2026-09-14' }),
            order({ id: 'undated', picked_start: null, picked_end: null }),
          ],
          error: null,
        }
      return { data: [], error: null }
    }
    const r = await fetchSubOrdersForRange('2026-09-07', '2026-09-13')
    expect(r.data.map((o) => o.id)).toEqual(['in', 'offered-window'])
  })

  it('a failed read (first or follow-up) degrades to empty plus the message', async () => {
    route = () => ({ data: null, error: { message: 'timeout' } })
    expect(await fetchSubOrdersForRange('2026-09-07', '2026-09-13')).toEqual({ data: [], error: 'timeout' })
    route = (table) => (table === 'step_commitments' ? { data: [order({ stage_window_id: 'w1' })], error: null } : { data: null, error: { message: 'windows down' } })
    expect(await fetchSubOrdersForRange('2026-09-07', '2026-09-13')).toEqual({ data: [], error: 'windows down' })
    route = () => ({ data: null, error: null })
    expect(await fetchSubOrdersForRange('2026-09-07', '2026-09-13')).toEqual({ data: [], error: null })
  })
})

describe('fetchTeamMembersByJobId', () => {
  it('no ids → no read; ids are deduped, blanks dropped, read in slices of 150, and grouped by job with each user once', async () => {
    expect(await fetchTeamMembersByJobId([])).toEqual({ data: new Map(), error: null })
    expect(await fetchTeamMembersByJobId(['', ''])).toEqual({ data: new Map(), error: null })
    expect(queries).toEqual([])
    const ids = Array.from({ length: 151 }, (_, i) => `j${i}`)
    route = (_t, steps) => {
      const slice = argsOf(steps, 'in')[0]![1] as string[]
      return { data: slice[0] === 'j0' ? [{ job_id: 'j0', user_id: 'u1' }, { job_id: 'j0', user_id: 'u1' }, { job_id: 'j0', user_id: 'u2' }, { job_id: '', user_id: 'u3' }, { job_id: 'j1', user_id: '' }] : [{ job_id: 'j150', user_id: 'u9' }], error: null }
    }
    const r = await fetchTeamMembersByJobId([...ids, 'j0', ''])
    expect(tables()).toEqual(['jobs_ledger_team_members', 'jobs_ledger_team_members'])
    expect(queries.map((q) => (argsOf(q.steps, 'in')[0]![1] as string[]).length)).toEqual([150, 1])
    expect(argsOf(queries[0]!.steps, 'select')).toEqual([['job_id, user_id']])
    expect([...r.data]).toEqual([
      ['j0', ['u1', 'u2']],
      ['j150', ['u9']],
    ])
    expect(r.error).toBeNull()
    expect(labels).toEqual(['fetchTeamMembersByJobId', 'fetchTeamMembersByJobId'])
  })

  it('a failed slice returns what was grouped so far plus the message', async () => {
    route = (_t, steps) => ((argsOf(steps, 'in')[0]![1] as string[])[0] === 'j0' ? { data: [{ job_id: 'j0', user_id: 'u1' }], error: null } : { data: null, error: { message: 'boom' } })
    const r = await fetchTeamMembersByJobId(Array.from({ length: 151 }, (_, i) => `j${i}`))
    expect([...r.data]).toEqual([['j0', ['u1']]])
    expect(r.error).toBe('boom')
  })
})

describe('fetchSubOffDaysForRange', () => {
  it('reads off-kind availability inside the range and groups the days by person; a failure degrades to empty plus the message', async () => {
    route = () => ({ data: [{ person_id: 'p1', day: '2026-09-08' }, { person_id: 'p2', day: '2026-09-09' }, { person_id: 'p1', day: '2026-09-10' }], error: null })
    const r = await fetchSubOffDaysForRange('2026-09-07', '2026-09-13')
    const s = queries[0]!.steps
    expect(queries[0]!.table).toBe('person_availability')
    expect(argsOf(s, 'select')).toEqual([['person_id, day']])
    expect(argsOf(s, 'eq')).toEqual([['kind', 'off']])
    expect(argsOf(s, 'gte')).toEqual([['day', '2026-09-07']])
    expect(argsOf(s, 'lte')).toEqual([['day', '2026-09-13']])
    expect(argsOf(s, 'limit')).toEqual([[2000]])
    expect([...r.data]).toEqual([
      ['p1', ['2026-09-08', '2026-09-10']],
      ['p2', ['2026-09-09']],
    ])
    expect(labels).toEqual(['fetchSubOffDaysForRange'])
    route = () => ({ data: null, error: { message: 'nope' } })
    expect(await fetchSubOffDaysForRange('2026-09-07', '2026-09-13')).toEqual({ data: new Map(), error: 'nope' })
  })
})
