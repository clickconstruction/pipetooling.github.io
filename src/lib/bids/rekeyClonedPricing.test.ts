/**
 * The clone re-key, as `BidsPricingTab` ran it inline before the move (decomposition queue row 1).
 * A fake client records every read and write in order, so the test pins which child moves to
 * which row, which is deleted, the order across the three tables, what the counts say, and where
 * a failed write stops the run.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { REKEY_CHILD_TABLES, rekeyClonedPricingToVersion, rekeyPlan, rekeyRowMap, rekeyTableCounts } from './rekeyClonedPricing'

type Step = [string, ...unknown[]]
type Op = { table: string; steps: Step[] }
const ops: Op[] = []
/** What each query answers, given the table and the steps chained on it. */
let answer: (op: Op) => { data: unknown; error: { message: string } | null }

const supabase = {
  from: (table: string) => {
    const op: Op = { table, steps: [] }
    ops.push(op)
    const p: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(answer(op))
          return (...a: unknown[]) => {
            op.steps.push([String(prop), ...a])
            return p
          }
        },
      },
    )
    return p
  },
} as unknown as SupabaseClient

const kind = (op: Op) => op.steps[0]?.[0]
const eqOf = (op: Op, col: string) => op.steps.find((s) => s[0] === 'eq' && s[1] === col)?.[2]
/** The writes only, as short words: `update prices wc-a→wc-b`, `delete hides lav-a`. */
const SHORT: Record<string, string> = { bid_count_row_custom_prices: 'prices', bid_pricing_assignments: 'assignments', bid_count_row_submission_hides: 'hides' }
const writes = () =>
  ops
    .filter((op) => kind(op) === 'update' || kind(op) === 'delete')
    .map((op) => (kind(op) === 'update' ? `update ${SHORT[op.table]} ${String(eqOf(op, 'count_row_id'))}→${String((op.steps[0]?.[1] as { count_row_id: string }).count_row_id)}` : `delete ${SHORT[op.table]} ${String(eqOf(op, 'count_row_id'))}`))

/** GC A's version (the source) and GC B's (the target): the same fixtures under each version's own row ids. */
const SOURCE_ROWS = [
  { id: 'wc-a', fixture: 'Water closet', group_tag: null },
  { id: 'lav-a', fixture: 'Lavatory', group_tag: null },
  { id: 'fd-a', fixture: 'Floor drain', group_tag: null },
  { id: 'wc-alt-a', fixture: 'Water closet', group_tag: 'Alt 1' },
]
const TARGET_ROWS = [
  { id: 'wc-b', fixture: ' water closet ', group_tag: null },
  { id: 'fd-b', fixture: 'Floor drain', group_tag: null },
  { id: 'fd-b2', fixture: 'FLOOR DRAIN', group_tag: null },
  { id: 'wc-alt-b', fixture: 'Water closet', group_tag: 'Alt 1' },
]
const CHILDREN: Record<string, string[]> = {
  bid_count_row_custom_prices: ['wc-a', 'lav-a', 'fd-a', 'wc-alt-a'],
  bid_pricing_assignments: ['wc-a', 'lav-a'],
  bid_count_row_submission_hides: ['fd-a', 'wc-alt-a'],
}
const ARGS = { bidId: 'bid-1', pricingId: 'clone-1', sourceBidVersionId: 'ver-a', targetBidVersionId: 'ver-b', alternateGroupTags: ['Alt 1'] }

function standardAnswer(op: Op): { data: unknown; error: { message: string } | null } {
  if (op.table === 'bids_count_rows') return { data: eqOf(op, 'bid_version_id') === 'ver-a' ? SOURCE_ROWS : TARGET_ROWS, error: null }
  if (kind(op) === 'select') return { data: (CHILDREN[op.table] ?? []).map((count_row_id) => ({ count_row_id })), error: null }
  return { data: null, error: null }
}

beforeEach(() => {
  ops.length = 0
  answer = standardAnswer
})

describe('rekeyRowMap', () => {
  it('pairs a fixture with its one counterpart, by trimmed name in any case', () => {
    const map = rekeyRowMap(SOURCE_ROWS, TARGET_ROWS, ['Alt 1'])
    expect(map.get('wc-a')).toBe('wc-b')
  })
  it('a name the target carries twice pairs with neither, and a name it lacks pairs with nothing', () => {
    const map = rekeyRowMap(SOURCE_ROWS, TARGET_ROWS, ['Alt 1'])
    expect(map.has('fd-a')).toBe(false)
    expect(map.has('lav-a')).toBe(false)
  })
  it('the same fixture in the base and in an alternate pairs within its own scope', () => {
    const map = rekeyRowMap(SOURCE_ROWS, TARGET_ROWS, ['Alt 1'])
    expect(map.get('wc-alt-a')).toBe('wc-alt-b')
    expect([...map.entries()]).toEqual([
      ['wc-a', 'wc-b'],
      ['wc-alt-a', 'wc-alt-b'],
    ])
  })
  it('with no alternate tags on the bid the two Water closets are one name twice, and pair with nothing', () => {
    expect([...rekeyRowMap(SOURCE_ROWS, TARGET_ROWS, []).entries()]).toEqual([])
  })
})

describe('rekeyPlan', () => {
  const map = new Map([
    ['wc-a', 'wc-b'],
    ['wc-alt-a', 'wc-alt-b'],
  ])
  it('moves a child whose row has a counterpart and drops one whose row has none, in the order read', () => {
    expect(rekeyPlan(['wc-a', 'lav-a', 'fd-a', 'wc-alt-a'], map)).toEqual([
      { countRowId: 'wc-a', moveTo: 'wc-b' },
      { countRowId: 'lav-a', moveTo: null },
      { countRowId: 'fd-a', moveTo: null },
      { countRowId: 'wc-alt-a', moveTo: 'wc-alt-b' },
    ])
  })
  it('no children is no steps', () => {
    expect(rekeyPlan([], map)).toEqual([])
  })
  it('the toast counts prices only', () => {
    expect(REKEY_CHILD_TABLES.map((t) => [t, rekeyTableCounts(t)])).toEqual([
      ['bid_count_row_custom_prices', true],
      ['bid_pricing_assignments', false],
      ['bid_count_row_submission_hides', false],
    ])
  })
})

describe('rekeyClonedPricingToVersion', () => {
  it("reads both versions' rows for the bid, the source first", async () => {
    await rekeyClonedPricingToVersion(supabase, ARGS)
    const reads = ops.filter((op) => op.table === 'bids_count_rows')
    expect(reads.map((op) => op.steps)).toEqual([
      [
        ['select', 'id, fixture, group_tag'],
        ['eq', 'bid_id', 'bid-1'],
        ['eq', 'bid_version_id', 'ver-a'],
      ],
      [
        ['select', 'id, fixture, group_tag'],
        ['eq', 'bid_id', 'bid-1'],
        ['eq', 'bid_version_id', 'ver-b'],
      ],
    ])
  })

  it("reads each table's children by the clone's id", async () => {
    await rekeyClonedPricingToVersion(supabase, ARGS)
    const reads = ops.filter((op) => op.table !== 'bids_count_rows' && kind(op) === 'select')
    expect(reads.map((op) => [op.table, ...op.steps])).toEqual(
      REKEY_CHILD_TABLES.map((t) => [t, ['select', 'count_row_id'], ['eq', 'price_book_version_id', 'clone-1']]),
    )
  })

  it('moves and drops every child, a table at a time, prices then assignments then hides', async () => {
    const res = await rekeyClonedPricingToVersion(supabase, ARGS)
    expect(writes()).toEqual([
      'update prices wc-a→wc-b',
      'delete prices lav-a',
      'delete prices fd-a',
      'update prices wc-alt-a→wc-alt-b',
      'update assignments wc-a→wc-b',
      'delete assignments lav-a',
      'delete hides fd-a',
      'update hides wc-alt-a→wc-alt-b',
    ])
    // Two prices matched and two were dropped; the assignments and hides moved too but are not counted.
    expect(res).toEqual({ ok: true, matched: 2, dropped: 2 })
  })

  it("every write names the clone and the child's old row", async () => {
    await rekeyClonedPricingToVersion(supabase, ARGS)
    const first = ops.find((op) => kind(op) === 'update')!
    expect(first.table).toBe('bid_count_row_custom_prices')
    expect(first.steps).toEqual([
      ['update', { count_row_id: 'wc-b' }],
      ['eq', 'price_book_version_id', 'clone-1'],
      ['eq', 'count_row_id', 'wc-a'],
    ])
    const firstDelete = ops.find((op) => kind(op) === 'delete')!
    expect(firstDelete.steps).toEqual([['delete'], ['eq', 'price_book_version_id', 'clone-1'], ['eq', 'count_row_id', 'lav-a']])
  })

  it('a clone with no children writes nothing and counts nothing', async () => {
    answer = (op) => (op.table === 'bids_count_rows' ? standardAnswer(op) : { data: [], error: null })
    expect(await rekeyClonedPricingToVersion(supabase, ARGS)).toEqual({ ok: true, matched: 0, dropped: 0 })
    expect(writes()).toEqual([])
  })

  it('a read that comes back null is no rows: every child is dropped', async () => {
    answer = (op) => (op.table === 'bids_count_rows' ? { data: null, error: null } : standardAnswer(op))
    expect(await rekeyClonedPricingToVersion(supabase, ARGS)).toEqual({ ok: true, matched: 0, dropped: 4 })
    expect(writes().every((w) => w.startsWith('delete'))).toBe(true)
  })

  it("a rows read that fails says why and touches no child; the target's read still runs", async () => {
    answer = (op) => (op.table === 'bids_count_rows' && eqOf(op, 'bid_version_id') === 'ver-a' ? { data: null, error: { message: 'source rows refused' } } : standardAnswer(op))
    expect(await rekeyClonedPricingToVersion(supabase, ARGS)).toEqual({ ok: false, error: 'source rows refused' })
    expect(ops.map((op) => op.table)).toEqual(['bids_count_rows', 'bids_count_rows'])
  })

  it("when both rows reads fail the target's reason is the one said", async () => {
    answer = (op) => (op.table === 'bids_count_rows' ? { data: null, error: { message: `${String(eqOf(op, 'bid_version_id'))} refused` } } : standardAnswer(op))
    expect(await rekeyClonedPricingToVersion(supabase, ARGS)).toEqual({ ok: false, error: 'ver-b refused' })
  })

  it("a children read that fails stops there: the tables before it stay moved", async () => {
    answer = (op) => (op.table === 'bid_pricing_assignments' && kind(op) === 'select' ? { data: null, error: { message: 'assignments refused' } } : standardAnswer(op))
    expect(await rekeyClonedPricingToVersion(supabase, ARGS)).toEqual({ ok: false, error: 'assignments refused' })
    expect(writes()).toEqual(['update prices wc-a→wc-b', 'delete prices lav-a', 'delete prices fd-a', 'update prices wc-alt-a→wc-alt-b'])
  })

  it('a move that fails stops the run where it stands', async () => {
    answer = (op) => (kind(op) === 'update' && eqOf(op, 'count_row_id') === 'wc-alt-a' ? { data: null, error: { message: 'move refused' } } : standardAnswer(op))
    expect(await rekeyClonedPricingToVersion(supabase, ARGS)).toEqual({ ok: false, error: 'move refused' })
    expect(writes()).toEqual(['update prices wc-a→wc-b', 'delete prices lav-a', 'delete prices fd-a', 'update prices wc-alt-a→wc-alt-b'])
  })

  it('a delete that fails stops the run where it stands', async () => {
    answer = (op) => (kind(op) === 'delete' ? { data: null, error: { message: 'delete refused' } } : standardAnswer(op))
    expect(await rekeyClonedPricingToVersion(supabase, ARGS)).toEqual({ ok: false, error: 'delete refused' })
    expect(writes()).toEqual(['update prices wc-a→wc-b', 'delete prices lav-a'])
  })
})
