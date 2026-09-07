import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Dispatch crews ("swim lanes"): the two-table read folded into lane and
 * member maps, and the writes — create / rename / delete / reorder a lane,
 * assign (strict: delete any membership first, then insert) and remove a
 * person. Pins each statement and how errors come back as strings.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
vi.mock('./supabase', () => ({
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
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
  formatErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

import {
  assignUserToDispatchSwimLane,
  createDispatchSwimLane,
  deleteDispatchSwimLane,
  fetchDispatchSwimLanes,
  removeUserFromDispatchSwimLane,
  renameDispatchSwimLane,
  reorderDispatchSwimLanes,
} from './dispatchSwimLanes'

const trace = () => queries.map((q) => `${q.table} ${q.steps.map((s) => `${s.method}(${s.args.map((a) => JSON.stringify(a)).join(',')})`).join(' ')}`)
const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)

beforeEach(() => {
  queries.length = 0
  route = () => ({ data: [], error: null })
})

describe('fetchDispatchSwimLanes', () => {
  it('reads lanes by sort order then name and members by sort order, folding them into per-lane member lists and a person → lane map', async () => {
    route = (table) =>
      table === 'dispatch_swim_lanes'
        ? { data: [{ id: 'L1', name: 'Crew A', sort_order: 0, extra: 'dropped' }, { id: 'L2', name: 'Crew B', sort_order: 1 }], error: null }
        : { data: [{ lane_id: 'L1', user_id: 'u1', sort_order: 0 }, { lane_id: 'L2', user_id: 'u2', sort_order: 0 }, { lane_id: 'L1', user_id: 'u3', sort_order: 1 }], error: null }
    const r = await fetchDispatchSwimLanes()
    expect(argsOf(queries[0]!.steps, 'order')).toEqual([
      ['sort_order', { ascending: true }],
      ['name', { ascending: true }],
    ])
    expect(argsOf(queries[1]!.steps, 'order')).toEqual([['sort_order', { ascending: true }]])
    expect(r.error).toBeNull()
    expect(r.data.lanes).toEqual([
      { id: 'L1', name: 'Crew A', sort_order: 0 },
      { id: 'L2', name: 'Crew B', sort_order: 1 },
    ])
    expect([...r.data.memberIdsByLaneId]).toEqual([
      ['L1', ['u1', 'u3']],
      ['L2', ['u2']],
    ])
    expect([...r.data.laneIdByUserId]).toEqual([
      ['u1', 'L1'],
      ['u2', 'L2'],
      ['u3', 'L1'],
    ])
  })
  it('null results read as empty; a failed read comes back empty with the message', async () => {
    route = () => ({ data: null, error: null })
    const r = await fetchDispatchSwimLanes()
    expect(r).toEqual({ data: { lanes: [], memberIdsByLaneId: new Map(), laneIdByUserId: new Map() }, error: null })
    route = () => ({ data: null, error: { message: 'rls' } })
    const f = await fetchDispatchSwimLanes()
    expect(f.error).toBe('rls')
    expect(f.data.lanes).toEqual([])
  })
})

describe('lane writes', () => {
  it('create inserts the trimmed name with its order and creator; rename updates by id; both refuse a blank name before writing', async () => {
    expect(await createDispatchSwimLane('  Crew A ', 3, 'u1')).toEqual({ error: null })
    expect(await renameDispatchSwimLane('L1', ' Crew B ')).toEqual({ error: null })
    expect(trace()).toEqual([
      'dispatch_swim_lanes insert({"name":"Crew A","sort_order":3,"created_by":"u1"})',
      'dispatch_swim_lanes update({"name":"Crew B"}) eq("id","L1")',
    ])
    queries.length = 0
    expect(await createDispatchSwimLane('   ', 0, 'u1')).toEqual({ error: 'Lane name is required.' })
    expect(await renameDispatchSwimLane('L1', '')).toEqual({ error: 'Lane name is required.' })
    expect(queries).toHaveLength(0)
  })
  it('delete removes by id; reorder writes sort_order = position for every lane and stops at the first failure', async () => {
    expect(await deleteDispatchSwimLane('L1')).toEqual({ error: null })
    expect(trace()).toEqual(['dispatch_swim_lanes delete() eq("id","L1")'])
    queries.length = 0
    expect(await reorderDispatchSwimLanes(['L2', 'L1', 'L3'])).toEqual({ error: null })
    expect(trace()).toEqual([
      'dispatch_swim_lanes update({"sort_order":0}) eq("id","L2")',
      'dispatch_swim_lanes update({"sort_order":1}) eq("id","L1")',
      'dispatch_swim_lanes update({"sort_order":2}) eq("id","L3")',
    ])
    queries.length = 0
    let n = 0
    route = () => (++n === 2 ? { data: null, error: { message: 'locked' } } : { data: null, error: null })
    expect(await reorderDispatchSwimLanes(['L2', 'L1', 'L3'])).toEqual({ error: 'locked' })
    expect(queries).toHaveLength(2)
  })
  it('write failures come back as the server message', async () => {
    route = () => ({ data: null, error: { message: 'denied' } })
    expect(await createDispatchSwimLane('x', 0, 'u1')).toEqual({ error: 'denied' })
    expect(await renameDispatchSwimLane('L1', 'x')).toEqual({ error: 'denied' })
    expect(await deleteDispatchSwimLane('L1')).toEqual({ error: 'denied' })
  })
})

describe('membership (strict lanes)', () => {
  it('assigning a person removes any existing membership first, then inserts — so they move rather than appear twice', async () => {
    expect(await assignUserToDispatchSwimLane('u1', 'L2', 4)).toEqual({ error: null })
    expect(trace()).toEqual([
      'dispatch_swim_lane_members delete() eq("user_id","u1")',
      'dispatch_swim_lane_members insert({"lane_id":"L2","user_id":"u1","sort_order":4})',
    ])
  })
  it('a failed removal stops before the insert; a failed insert reports its message; remove deletes by person', async () => {
    let n = 0
    route = () => (++n === 1 ? { data: null, error: { message: 'delete denied' } } : { data: null, error: null })
    expect(await assignUserToDispatchSwimLane('u1', 'L2', 0)).toEqual({ error: 'delete denied' })
    expect(queries).toHaveLength(1)
    queries.length = 0
    n = 0
    route = () => (++n === 2 ? { data: null, error: { message: 'insert denied' } } : { data: null, error: null })
    expect(await assignUserToDispatchSwimLane('u1', 'L2', 0)).toEqual({ error: 'insert denied' })
    queries.length = 0
    route = () => ({ data: null, error: null })
    expect(await removeUserFromDispatchSwimLane('u1')).toEqual({ error: null })
    expect(trace()).toEqual(['dispatch_swim_lane_members delete() eq("user_id","u1")'])
  })
})
