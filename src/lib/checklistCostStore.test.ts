import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The dev-only checklist cost-estimate store: one shared load into a
 * module cache, estimate writes and removals, the "actual hours" write, and
 * the window event that fans every change out to mounted chips. Module state
 * is reset between tests by re-importing the store.
 */
type Step = { method: string; args: unknown[] }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (steps: Step[]) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
const getSession = vi.fn(async () => ({ data: { session: { user: { id: 'u-dev' } } as { user: { id: string } } | null } }))
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(steps))
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
    auth: { getSession: () => getSession() },
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))
const dispatched: Array<{ type: string; detail: unknown }> = []
;(globalThis as unknown as { window: unknown }).window = { dispatchEvent: (e: Event) => dispatched.push({ type: e.type, detail: (e as CustomEvent).detail }) }

const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
const rows = [
  { cost_key: 'task-1', person_user_id: 'u1', person_name: 'Ana', hours: '2.5', rate: '40', updated_at: '2026-09-01T00:00:00Z', actual_hours: null },
  { cost_key: 'item-9', person_user_id: null, person_name: 'Bob', hours: 1, rate: 35, updated_at: '2026-09-02T00:00:00Z', actual_hours: '1.25' },
]
const loadStore = async () => {
  vi.resetModules()
  return await import('./checklistCostStore')
}

beforeEach(() => {
  queries.length = 0
  dispatched.length = 0
  route = () => ({ data: rows, error: null })
  getSession.mockClear()
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u-dev' } } } })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-07T18:00:00Z'))
})

describe('ensureChecklistCostEstimatesLoaded', () => {
  it('loads every estimate once into the cache (numbers coerced), shares the fetch between concurrent callers, and announces the load', async () => {
    const store = await loadStore()
    expect(store.cachedChecklistCostEstimates()).toEqual({})
    await Promise.all([store.ensureChecklistCostEstimatesLoaded(), store.ensureChecklistCostEstimatesLoaded()])
    await store.ensureChecklistCostEstimatesLoaded()
    expect(queries).toHaveLength(1)
    expect(queries[0]!.table).toBe('checklist_item_costs')
    expect(argsOf(queries[0]!.steps, 'select')).toEqual([['cost_key, person_user_id, person_name, hours, rate, updated_at, actual_hours']])
    expect(store.cachedChecklistCostEstimates()).toEqual({
      'task-1': { userId: 'u1', personName: 'Ana', hours: 2.5, rate: 40, updatedAt: '2026-09-01T00:00:00Z', actualHours: null },
      'item-9': { userId: null, personName: 'Bob', hours: 1, rate: 35, updatedAt: '2026-09-02T00:00:00Z', actualHours: 1.25 },
    })
    expect(dispatched).toEqual([{ type: store.CHECKLIST_COST_CHANGED_EVENT, detail: null }])
  })
  it('a failed load rejects and lets the next call retry; a null result empties the cache', async () => {
    const store = await loadStore()
    route = () => ({ data: null, error: { message: 'rls' } })
    await expect(store.ensureChecklistCostEstimatesLoaded()).rejects.toThrow('rls')
    route = () => ({ data: null, error: null })
    await store.ensureChecklistCostEstimatesLoaded()
    expect(queries).toHaveLength(2)
    expect(store.cachedChecklistCostEstimates()).toEqual({})
  })
})

describe('writeChecklistCostEstimate', () => {
  it('upserts the estimate stamped with the signer and now, keeps a known actual, and fans the key out', async () => {
    const store = await loadStore()
    await store.ensureChecklistCostEstimatesLoaded()
    dispatched.length = 0
    queries.length = 0
    await store.writeChecklistCostEstimate('item-9', { userId: 'u2', personName: 'Cy', hours: 3, rate: 50, updatedAt: 'ignored', actualHours: null })
    expect(argsOf(queries[0]!.steps, 'upsert')).toEqual([[{ cost_key: 'item-9', person_user_id: 'u2', person_name: 'Cy', hours: 3, rate: 50, created_by_user_id: 'u-dev', updated_at: '2026-09-07T18:00:00.000Z' }]])
    expect(store.cachedChecklistCostEstimates()['item-9']).toEqual({ userId: 'u2', personName: 'Cy', hours: 3, rate: 50, updatedAt: 'ignored', actualHours: 1.25 }) // the recorded actual survives a re-estimate
    expect(dispatched).toEqual([{ type: store.CHECKLIST_COST_CHANGED_EVENT, detail: 'item-9' }])
    getSession.mockResolvedValueOnce({ data: { session: null } })
    queries.length = 0
    await store.writeChecklistCostEstimate('new-key', { userId: null, personName: 'Dee', hours: 1, rate: 1, updatedAt: 'x', actualHours: 0.5 })
    expect((argsOf(queries[0]!.steps, 'upsert')[0]![0] as { created_by_user_id: unknown }).created_by_user_id).toBeNull()
    expect(store.cachedChecklistCostEstimates()['new-key']!.actualHours).toBe(0.5)
  })
  it('a null estimate deletes the row by key and drops it from the cache; a failed write leaves the cache alone and throws', async () => {
    const store = await loadStore()
    await store.ensureChecklistCostEstimatesLoaded()
    queries.length = 0
    dispatched.length = 0
    await store.writeChecklistCostEstimate('task-1', null)
    expect(queries[0]!.steps.some((s) => s.method === 'delete')).toBe(true)
    expect(argsOf(queries[0]!.steps, 'eq')).toEqual([['cost_key', 'task-1']])
    expect(Object.keys(store.cachedChecklistCostEstimates())).toEqual(['item-9'])
    expect(dispatched).toEqual([{ type: store.CHECKLIST_COST_CHANGED_EVENT, detail: 'task-1' }])
    route = () => ({ data: null, error: { message: 'read only' } })
    await expect(store.writeChecklistCostEstimate('item-9', null)).rejects.toThrow('read only')
    expect(Object.keys(store.cachedChecklistCostEstimates())).toEqual(['item-9'])
  })
})

describe('writeChecklistCostActual', () => {
  it('records the actual with who and when, or clears all three with null; updates a cached estimate but is a no-op on the cache for an unknown key', async () => {
    const store = await loadStore()
    await store.ensureChecklistCostEstimatesLoaded()
    queries.length = 0
    dispatched.length = 0
    await store.writeChecklistCostActual('task-1', 4)
    expect(argsOf(queries[0]!.steps, 'update')).toEqual([[{ actual_hours: 4, actual_recorded_by_user_id: 'u-dev', actual_recorded_at: '2026-09-07T18:00:00.000Z' }]])
    expect(argsOf(queries[0]!.steps, 'eq')).toEqual([['cost_key', 'task-1']])
    expect(store.cachedChecklistCostEstimates()['task-1']!.actualHours).toBe(4)
    queries.length = 0
    await store.writeChecklistCostActual('task-1', null)
    expect(argsOf(queries[0]!.steps, 'update')).toEqual([[{ actual_hours: null, actual_recorded_by_user_id: null, actual_recorded_at: null }]])
    expect(store.cachedChecklistCostEstimates()['task-1']!.actualHours).toBeNull()
    await store.writeChecklistCostActual('unknown', 2)
    expect(store.cachedChecklistCostEstimates()['unknown']).toBeUndefined()
    expect(dispatched.map((d) => d.detail)).toEqual(['task-1', 'task-1', 'unknown'])
  })
})
