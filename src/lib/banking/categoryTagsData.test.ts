import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Supabase side of bank-category tags. The pure pieces (lookups, the
 * member diff) have their own suites; this pins what each write sends —
 * especially the evict-then-insert dance that keeps a category or label in
 * one tag only, and the merge that re-points accounting rules — plus the
 * read shapes and that every failure throws with the server's message.
 * (`useCategoryTags` is a React hook and is left to render smokes.)
 */
type Step = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string } | null }
const calls: Array<{ kind: 'from' | 'rpc'; name: string; steps: Step[] }> = []
let route: (kind: 'from' | 'rpc', name: string, steps: Step[]) => Result = () => ({ data: [], error: null })
function recorder(kind: 'from' | 'rpc', name: string) {
  const steps: Step[] = []
  calls.push({ kind, name, steps })
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return (resolve: (v: Result) => void) => resolve(route(kind, name, steps))
        return (...a: unknown[]) => {
          steps.push({ method: String(prop), args: a })
          return p
        }
      },
    },
  )
  return p
}
const getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } as { id: string } | null } }))
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => recorder('from', table),
    rpc: (fn: string) => recorder('rpc', fn),
    auth: { getUser: () => getUser() },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<Result>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))

import {
  deleteCategoryTag,
  fetchLabelIdByTxId,
  loadCategoryTags,
  mergeCategoryTags,
  resetDefaultCategoryTags,
  saveCategoryTag,
  saveCategoryTagMembers,
} from './categoryTagsData'

const ok = (data: unknown): Result => ({ data, error: null })
const fail = (message: string): Result => ({ data: null, error: { message } })
const argsOf = (steps: Step[], m: string) => steps.filter((s) => s.method === m).map((s) => s.args)
/** One line per query: "table method(args) method(args)…" — the shape assertions read best this way. */
const trace = () =>
  calls.map((c) => `${c.kind === 'rpc' ? 'rpc:' : ''}${c.name} ${c.steps.filter((s) => s.method !== 'select').map((s) => `${s.method}(${s.args.map((a) => JSON.stringify(a)).join(',')})`).join(' ')}`.trim())

beforeEach(() => {
  calls.length = 0
  route = () => ok([])
  getUser.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-07T18:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('loadCategoryTags', () => {
  it('reads tags by sort order then name, and the members, mapping both to the pure row shapes', async () => {
    route = (_k, name) =>
      name === 'mercury_category_tags'
        ? ok([{ id: 't1', name: 'Meals', icon: '🍔', color: 'amber', sort_order: 1, default_key: 'meals', show_as_cost_line: true, hide_from_picker: false, created_by: 'x', updated_at: 'y' }])
        : ok([{ tag_id: 't1', bank_category: 'Restaurants', label_id: null, extra: 1 }])
    const r = await loadCategoryTags()
    expect(r).toEqual({
      tags: [{ id: 't1', name: 'Meals', icon: '🍔', color: 'amber', sort_order: 1, default_key: 'meals', show_as_cost_line: true, hide_from_picker: false }],
      members: [{ tag_id: 't1', bank_category: 'Restaurants', label_id: null }],
    })
    expect(argsOf(calls[0]!.steps, 'order')).toEqual([['sort_order'], ['name']])
    expect(argsOf(calls[1]!.steps, 'select')).toEqual([['tag_id, bank_category, label_id']])
    route = () => fail('rls')
    await expect(loadCategoryTags()).rejects.toThrow('rls')
  })
})

describe('saveCategoryTag', () => {
  const draft = { id: null, name: '  Meals ', icon: '  ', color: 'amber' as const, show_as_cost_line: true, hide_from_picker: false }
  it('updates an existing tag with a trimmed name, a default icon and a timestamp, returning its id', async () => {
    expect(await saveCategoryTag({ ...draft, id: 't1' }, 9)).toBe('t1')
    expect(argsOf(calls[0]!.steps, 'update')).toEqual([[{ name: 'Meals', icon: '🏷', color: 'amber', show_as_cost_line: true, hide_from_picker: false, updated_at: '2026-09-07T18:00:00.000Z' }]])
    expect(argsOf(calls[0]!.steps, 'eq')).toEqual([['id', 't1']])
    expect(getUser).not.toHaveBeenCalled()
  })
  it('inserts a new tag at the given sort order, stamped with the signed-in user, and returns the new id', async () => {
    route = () => ok({ id: 't-new' })
    expect(await saveCategoryTag(draft, 9)).toBe('t-new')
    expect(argsOf(calls[0]!.steps, 'insert')).toEqual([[{ name: 'Meals', icon: '🏷', color: 'amber', show_as_cost_line: true, hide_from_picker: false, sort_order: 9, created_by: 'u1' }]])
    expect(argsOf(calls[0]!.steps, 'select')).toEqual([['id']])
    expect(calls[0]!.steps.some((s) => s.method === 'single')).toBe(true)
    getUser.mockResolvedValueOnce({ data: { user: null } })
    calls.length = 0
    await saveCategoryTag(draft, 1)
    expect((argsOf(calls[0]!.steps, 'insert')[0]![0] as { created_by: unknown }).created_by).toBeNull()
  })
  it('throws the server message on either path', async () => {
    route = () => fail('duplicate name')
    await expect(saveCategoryTag({ ...draft, id: 't1' }, 1)).rejects.toThrow('duplicate name')
    await expect(saveCategoryTag(draft, 1)).rejects.toThrow('duplicate name')
  })
})

describe('saveCategoryTagMembers', () => {
  const current = [
    { tag_id: 't1', bank_category: 'Meals', label_id: null },
    { tag_id: 't1', bank_category: 'Fuel', label_id: null },
    { tag_id: 't1', bank_category: null, label_id: 'L1' },
    { tag_id: 'other', bank_category: 'Rent', label_id: null },
  ]
  it('removes what left the tag, then evicts each addition from wherever it lived before inserting it', async () => {
    await saveCategoryTagMembers('t1', current, ['Meals', 'Rent'], ['L2'])
    expect(trace()).toEqual([
      'mercury_category_tag_members delete() eq("tag_id","t1") ilike("bank_category","Fuel")',
      'mercury_category_tag_members delete() eq("tag_id","t1") eq("label_id","L1")',
      'mercury_category_tag_members delete() ilike("bank_category","Rent")',
      'mercury_category_tag_members insert({"tag_id":"t1","bank_category":"Rent"})',
      'mercury_category_tag_members delete() eq("label_id","L2")',
      'mercury_category_tag_members insert({"tag_id":"t1","label_id":"L2"})',
    ])
  })
  it('sends nothing when the membership already matches, and stops at the first failure', async () => {
    await saveCategoryTagMembers('t1', current, ['Meals', 'Fuel'], ['L1'])
    expect(calls).toHaveLength(0)
    let n = 0
    route = () => (++n === 3 ? fail('unique index') : ok([]))
    await expect(saveCategoryTagMembers('t1', current, ['Meals', 'Rent'], ['L2'])).rejects.toThrow('unique index')
    expect(calls).toHaveLength(3)
  })
})

describe('fetchLabelIdByTxId', () => {
  it('asks nothing for no ids, otherwise reads the drag-sort assignments in chunks and maps tx → label', async () => {
    expect((await fetchLabelIdByTxId([])).size).toBe(0)
    expect(calls).toHaveLength(0)
    route = (_k, _n, steps) => {
      const chunk = argsOf(steps, 'in')[0]![1] as string[]
      return ok(chunk.filter((id) => id !== 'tx-none').map((id) => ({ mercury_transaction_id: id, label_id: `label-for-${id}` })))
    }
    const ids = Array.from({ length: 205 }, (_, i) => `tx${i}`).concat('tx-none')
    const map = await fetchLabelIdByTxId(ids)
    expect(map.size).toBe(205)
    expect(map.get('tx7')).toBe('label-for-tx7')
    expect(map.has('tx-none')).toBe(false)
    expect(calls.length).toBeGreaterThan(1) // chunked
    for (const c of calls) {
      expect(c.name).toBe('mercury_transaction_drag_sort_assignments')
      expect(argsOf(c.steps, 'order')).toEqual([['mercury_transaction_id']])
      expect(c.steps.some((s) => s.method === 'range')).toBe(true)
    }
  })
})

describe('mergeCategoryTags', () => {
  const rules = [
    { id: 'r1', criteria: { bankTag: { tagId: 'src', categories: ['Old'] }, other: 'kept' } },
    { id: 'r2', criteria: { bankTag: { tagId: 'elsewhere', categories: [] } } },
    { id: 'r3', criteria: null },
    { id: 'r4', criteria: ['not', 'an', 'object'] },
    { id: 'r5', criteria: { noBankTag: true } },
  ]
  it('moves the members, re-points only the rules that named the source (with the target’s fresh category snapshot), then deletes the source', async () => {
    route = (_k, name, steps) => {
      if (name === 'mercury_category_tag_members' && steps.some((s) => s.method === 'update')) return ok([{ id: 'm1' }, { id: 'm2' }])
      if (name === 'mercury_category_tag_members') return ok([{ bank_category: 'Meals' }, { bank_category: null }, { bank_category: 'Fuel' }])
      if (name === 'mercury_accounting_label_rules' && steps.some((s) => s.method === 'select')) return ok(rules)
      return ok([])
    }
    expect(await mergeCategoryTags('src', 'dst')).toEqual({ movedMembers: 2, repointedRules: 1 })
    expect(trace()).toEqual([
      'mercury_category_tag_members update({"tag_id":"dst"}) eq("tag_id","src")',
      'mercury_accounting_label_rules',
      'mercury_category_tag_members eq("tag_id","dst") not("bank_category","is",null)',
      'mercury_accounting_label_rules update({"criteria":{"bankTag":{"tagId":"dst","categories":["Meals","Fuel"]},"other":"kept"},"updated_at":"2026-09-07T18:00:00.000Z"}) eq("id","r1")',
      'mercury_category_tags delete() eq("id","src")',
    ])
  })
  it('refuses to merge a tag into itself, and stops at the first failing step', async () => {
    await expect(mergeCategoryTags('t1', 't1')).rejects.toThrow('Pick a different tag to merge into.')
    expect(calls).toHaveLength(0)
    route = (_k, name) => (name === 'mercury_accounting_label_rules' ? fail('rules rls') : ok([]))
    await expect(mergeCategoryTags('src', 'dst')).rejects.toThrow('rules rls')
    expect(calls.map((c) => c.name)).toEqual(['mercury_category_tag_members', 'mercury_accounting_label_rules'])
  })
})

describe('deleteCategoryTag / resetDefaultCategoryTags', () => {
  it('delete removes the tag by id; reset calls the seed RPC; both throw the server message', async () => {
    await deleteCategoryTag('t1')
    expect(trace()).toEqual(['mercury_category_tags delete() eq("id","t1")'])
    calls.length = 0
    await resetDefaultCategoryTags()
    expect(trace()).toEqual(['rpc:seed_default_mercury_category_tags'])
    route = () => fail('nope')
    await expect(deleteCategoryTag('t1')).rejects.toThrow('nope')
    await expect(resetDefaultCategoryTags()).rejects.toThrow('nope')
  })
})
