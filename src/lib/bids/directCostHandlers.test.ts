import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { DIRECT_COST_KINDS, type DirectCostKind } from './costEstimateDirectCosts'
import {
  DIRECT_COST_KIND_NOUN,
  blankDirectCostRow,
  directCostHandlersByKind,
  directCostHandlersFor,
  nextDirectCostSequenceOrder,
  type DirectCostTableBindings,
} from './directCostHandlers'

type Row = { id: string; sequence_order: number; note: string; rough_in: number; top_out: number; trim_set: number; cost_estimate_id: string }
const row = (id: string, sequence_order: number, over: Partial<Row> = {}): Row => ({ id, sequence_order, note: '', rough_in: 0, top_out: 0, trim_set: 0, cost_estimate_id: 'ce1', ...over })

/** A list with React's setter shape: a value or an updater. */
function list(initial: Row[]) {
  const box = { rows: initial }
  const setRows = (next: Row[] | ((prev: Row[]) => Row[])) => {
    box.rows = typeof next === 'function' ? next(box.rows) : next
  }
  return { box, setRows }
}

type Call = { table: string; op: 'insert' | 'delete'; payload?: unknown; id?: string }

/** A client that records the writes; `fail` names the op that errors; `events` records the order things happen in. */
function client(opts: { fail?: 'insert' | 'delete'; returns?: Row; events?: string[] } = {}) {
  const calls: Call[] = []
  const c = {
    from(table: string) {
      return {
        insert(payload: unknown) {
          calls.push({ table, op: 'insert', payload })
          return {
            select: () => ({
              single: async () => {
                opts.events?.push('insert answered')
                return opts.fail === 'insert' ? { data: null, error: { message: 'no room' } } : { data: opts.returns ?? row('new', 99), error: null }
              },
            }),
          }
        },
        delete() {
          return {
            eq: async (_col: string, id: string) => {
              calls.push({ table, op: 'delete', id })
              opts.events?.push('delete answered')
              return opts.fail === 'delete' ? { error: { message: 'locked' } } : { error: null }
            },
          }
        },
      }
    },
  }
  return { calls, client: c as unknown as SupabaseClient }
}

const errors = () => {
  const seen: Array<string | null> = []
  return { seen, setError: (m: string | null) => void seen.push(m) }
}

describe('nextDirectCostSequenceOrder / blankDirectCostRow', () => {
  it('a new row goes after the highest order on the list — 1 on an empty list, gaps kept', () => {
    expect(nextDirectCostSequenceOrder([])).toBe(1)
    expect(nextDirectCostSequenceOrder([row('a', 1), row('b', 2)])).toBe(3)
    expect(nextDirectCostSequenceOrder([row('a', 7), row('b', 2)])).toBe(8)
  })

  it('the blank row is all zeroes with an empty note, on this cost estimate', () => {
    expect(blankDirectCostRow('ce1', [row('a', 4)])).toEqual({ cost_estimate_id: 'ce1', note: '', rough_in: 0, top_out: 0, trim_set: 0, sequence_order: 5 })
  })
})

describe('directCostHandlersFor — update', () => {
  it('changes the one row in state and writes nothing', () => {
    const { box, setRows } = list([row('a', 1), row('b', 2)])
    const { calls, client: c } = client()
    const h = directCostHandlersFor(c, 'equipment', { rows: box.rows, setRows, costEstimateId: 'ce1', setError: () => {} })
    h.update('b', { note: 'Lift rental', rough_in: 450 })
    expect(box.rows).toEqual([row('a', 1), row('b', 2, { note: 'Lift rental', rough_in: 450 })])
    expect(calls).toEqual([])
  })

  it('an id that is not on the list changes nothing', () => {
    const { box, setRows } = list([row('a', 1)])
    directCostHandlersFor(client().client, 'permit', { rows: box.rows, setRows, costEstimateId: 'ce1', setError: () => {} }).update('zzz', { note: 'x' })
    expect(box.rows).toEqual([row('a', 1)])
  })
})

describe('directCostHandlersFor — add', () => {
  it('inserts a blank row after the last one and appends what the database returns', async () => {
    const { box, setRows } = list([row('a', 1), row('b', 5)])
    const returned = row('db-1', 6)
    const { calls, client: c } = client({ returns: returned })
    const e = errors()
    await directCostHandlersFor(c, 'waste', { rows: box.rows, setRows, costEstimateId: 'ce1', setError: e.setError }).add()
    expect(calls).toEqual([{ table: 'cost_estimate_waste_rows', op: 'insert', payload: { cost_estimate_id: 'ce1', note: '', rough_in: 0, top_out: 0, trim_set: 0, sequence_order: 6 } }])
    expect(box.rows.map((r) => r.id)).toEqual(['a', 'b', 'db-1'])
    expect(e.seen).toEqual([])
  })

  it('waits for the cost estimate: with none, nothing is written', async () => {
    for (const costEstimateId of [null, undefined, '']) {
      const { box, setRows } = list([])
      const { calls, client: c } = client()
      await directCostHandlersFor(c, 'other', { rows: box.rows, setRows, costEstimateId, setError: () => {} }).add()
      expect(calls).toEqual([])
      expect(box.rows).toEqual([])
    }
  })

  it('a failed insert says so and leaves the list as it was', async () => {
    const { box, setRows } = list([row('a', 1)])
    const e = errors()
    await directCostHandlersFor(client({ fail: 'insert' }).client, 'sub', { rows: box.rows, setRows, costEstimateId: 'ce1', setError: e.setError }).add()
    expect(e.seen).toEqual(['Failed to add subcontractor row: no room'])
    expect(box.rows).toEqual([row('a', 1)])
  })
})

describe('directCostHandlersFor — remove', () => {
  it('drops the row from the list first, then deletes it', async () => {
    const events: string[] = []
    const { box, setRows } = list([row('a', 1), row('b', 2)])
    const { calls, client: c } = client({ events })
    const watched = (next: Row[] | ((prev: Row[]) => Row[])) => {
      events.push('list changed')
      setRows(next)
    }
    await directCostHandlersFor(c, 'permit', { rows: box.rows, setRows: watched, costEstimateId: 'ce1', setError: () => {} }).remove('a')
    expect(events).toEqual(['list changed', 'delete answered'])
    expect(box.rows.map((r) => r.id)).toEqual(['b'])
    expect(calls).toEqual([{ table: 'cost_estimate_permit_rows', op: 'delete', id: 'a' }])
  })

  it('a failed delete says so, and the row stays off the list (no revert — the next load brings it back)', async () => {
    const { box, setRows } = list([row('a', 1), row('b', 2)])
    const e = errors()
    await directCostHandlersFor(client({ fail: 'delete' }).client, 'equipment', { rows: box.rows, setRows, costEstimateId: 'ce1', setError: e.setError }).remove('a')
    expect(e.seen).toEqual(['Failed to remove equipment row: locked'])
    expect(box.rows.map((r) => r.id)).toEqual(['b'])
  })

  it('removes without a cost estimate too — the row has its own id', async () => {
    const { box, setRows } = list([row('a', 1)])
    const { calls, client: c } = client()
    await directCostHandlersFor(c, 'other', { rows: box.rows, setRows, costEstimateId: null, setError: () => {} }).remove('a')
    expect(calls).toHaveLength(1)
    expect(box.rows).toEqual([])
  })
})

describe('directCostHandlersByKind', () => {
  const tables: Record<DirectCostKind, string> = {
    equipment: 'cost_estimate_equipment_rows',
    permit: 'cost_estimate_permit_rows',
    sub: 'cost_estimate_subcontractor_rows',
    waste: 'cost_estimate_waste_rows',
    other: 'cost_estimate_other_rows',
  }

  it('gives every kind its own table, its own list and its own words', async () => {
    const lists = Object.fromEntries(DIRECT_COST_KINDS.map((k) => [k, list([row(`${k}-1`, 1)])])) as Record<DirectCostKind, ReturnType<typeof list>>
    const bindings = Object.fromEntries(DIRECT_COST_KINDS.map((k) => [k, { rows: lists[k].box.rows, setRows: lists[k].setRows }])) as unknown as DirectCostTableBindings
    const { calls, client: c } = client({ fail: 'delete' })
    const e = errors()
    const handlers = directCostHandlersByKind(c, { costEstimateId: 'ce1', setError: e.setError, tables: bindings })
    expect(Object.keys(handlers)).toEqual([...DIRECT_COST_KINDS])
    for (const k of DIRECT_COST_KINDS) await handlers[k].remove(`${k}-1`)
    expect(calls.map((x) => x.table)).toEqual(DIRECT_COST_KINDS.map((k) => tables[k]))
    expect(e.seen).toEqual([
      'Failed to remove equipment row: locked',
      'Failed to remove permit row: locked',
      'Failed to remove subcontractor row: locked',
      'Failed to remove waste row: locked',
      'Failed to remove row: locked',
    ])
    for (const k of DIRECT_COST_KINDS) expect(lists[k].box.rows).toEqual([])
  })

  it('an edit to one kind leaves the other four lists alone', () => {
    const lists = Object.fromEntries(DIRECT_COST_KINDS.map((k) => [k, list([row('same-id', 1)])])) as Record<DirectCostKind, ReturnType<typeof list>>
    const bindings = Object.fromEntries(DIRECT_COST_KINDS.map((k) => [k, { rows: lists[k].box.rows, setRows: lists[k].setRows }])) as unknown as DirectCostTableBindings
    directCostHandlersByKind(client().client, { costEstimateId: 'ce1', setError: () => {}, tables: bindings }).waste.update('same-id', { trim_set: 75 })
    expect(lists.waste.box.rows[0]?.trim_set).toBe(75)
    for (const k of DIRECT_COST_KINDS.filter((x) => x !== 'waste')) expect(lists[k].box.rows[0]?.trim_set).toBe(0)
  })

  it('"Other" rows are just "row" in a message; the rest are named', () => {
    expect(DIRECT_COST_KIND_NOUN).toEqual({ equipment: 'equipment row', permit: 'permit row', sub: 'subcontractor row', waste: 'waste row', other: 'row' })
  })
})
