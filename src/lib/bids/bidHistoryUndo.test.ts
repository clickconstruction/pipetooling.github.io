import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { groupBidHistory, type BidHistoryAction, type BidHistoryRow } from './bidHistory'
import { bidRemovalKey, type BidPutBackResult, type BidRestoreResult } from './bidHistoryPutBack'
import {
  BID_UNDO_REMOVABLE_TABLES,
  BID_UNDO_UNSEEN_NONE,
  BID_UNDO_UNSEEN_TABLES,
  BID_UNDO_UNSEEN_UNREAD,
  bidUndoDoneWords,
  bidUndoGateUnseen,
  bidUndoLabel,
  bidUndoPlan,
  bidUndoRemovedCountRows,
  bidUndoTitle,
  bidUndoUnseenReason,
  runBidUndo,
  type BidUndoPlan,
} from './bidHistoryUndo'

// Made-up people, bids and values.
let n = 0
const row = (over: Partial<BidHistoryRow>): BidHistoryRow => {
  n += 1
  return {
    source: 'ledger', id: n, archiveId: null, bidId: 'bid-1', bidNumber: 'B494', table: 'bid_count_row_custom_prices', recordId: `p-${n}`,
    countRowId: 'c-1', op: 'update', changed: ['unit_price'], oldValues: { unit_price: 9800 }, newValues: { unit_price: 10300 },
    label: 'Lav-1', changedBy: 'u-ann', changedByName: 'Ann', changedAt: '2026-10-08T15:00:00.000Z', action: null, byApp: null,
    ...over,
  }
}
const at = (s: number) => new Date(Date.parse('2026-10-08T15:00:00.000Z') + s * 1000).toISOString()
/** The one action a burst of rows makes. */
const actionOf = (rows: BidHistoryRow[]): BidHistoryAction => {
  const all = groupBidHistory(rows)
  expect(all).toHaveLength(1)
  return all[0]!
}
const plan = (rows: BidHistoryRow[], later: BidHistoryRow[] = [], restorable: ReadonlyMap<string, string> = new Map()) =>
  bidUndoPlan(actionOf(rows), { openBidId: 'bid-1', restorable, history: [...rows, ...later] })
const ready = (p: BidUndoPlan | null) => {
  expect(p?.ready, p && !p.ready ? p.reason : 'a plan').toBe(true)
  return p as Extract<BidUndoPlan, { ready: true }>
}

// An import of three count rows.
const imported = (over: Partial<BidHistoryRow> = {}) =>
  [1, 2, 3].map((i) => row({ table: 'bids_count_rows', recordId: `c-${i}`, countRowId: `c-${i}`, op: 'insert', changed: ['fixture', 'count'], oldValues: null, newValues: { fixture: `Lav-${i}`, count: i }, label: `Lav-${i}`, changedAt: at(i), action: 'counts-import', ...over }))

describe('bidUndoPlan · changed values', () => {
  it('puts back every changed value, newest first', () => {
    const rows = [row({ changedAt: at(0), label: 'Lav-1' }), row({ changedAt: at(1), label: 'WC-1', recordId: 'p-wc' })]
    const p = ready(plan(rows))
    expect(p.steps).toEqual([
      { kind: 'value', changeId: rows[1]!.id, table: 'bid_count_row_custom_prices', what: 'WC-1', writesOver: 0 },
      { kind: 'value', changeId: rows[0]!.id, table: 'bid_count_row_custom_prices', what: 'Lav-1', writesOver: 0 },
    ])
    expect(p).toMatchObject({ changes: 2, writesOver: 0, removes: 0 })
    expect(bidUndoTitle(p)).toBe('Puts back its 2 changes, newest first.')
  })

  it('counts a value a person set again since, but not one the app set', () => {
    const rows = [row({ changedAt: at(0), recordId: 'p-a' }), row({ changedAt: at(1), recordId: 'p-b' })]
    const person = row({ changedAt: at(60), recordId: 'p-a', changedBy: 'u-ben', changedByName: 'Ben' })
    const app = row({ changedAt: at(70), recordId: 'p-b', byApp: true, action: 'labor-sync' })
    const p = ready(plan(rows, [person, app]))
    expect(p.writesOver).toBe(1)
    expect(p.steps.map((s) => (s.kind === 'value' ? s.writesOver : null))).toEqual([0, 1])
  })

  it('is off when a row it changed was removed since, and says to put it back first', () => {
    const rows = [row({ changedAt: at(0), recordId: 'p-a', label: 'Lav-1' }), row({ changedAt: at(1), recordId: 'p-b' })]
    const removed = row({ changedAt: at(60), recordId: 'p-a', op: 'delete', changedBy: 'u-ben' })
    expect(plan(rows, [removed])).toEqual({ ready: false, reason: 'Undo is off. A row it changed was removed since: Lav-1. Put it back first.' })
  })

  it('skips a change of keys only', () => {
    const rows = [row({ changedAt: at(0), changed: ['bid_version_id'] }), row({ changedAt: at(1) })]
    expect(ready(plan(rows)).steps).toHaveLength(1)
  })
})

describe('bidUndoPlan · removed rows', () => {
  const T = at(0)
  const sump = row({ table: 'bids_count_rows', recordId: 'c-sump', countRowId: 'c-sump', op: 'delete', changed: ['fixture', 'count'], oldValues: { fixture: 'SUMP', count: 2 }, newValues: null, label: 'SUMP', changedAt: T })
  const price = row({ recordId: 'p-sump', countRowId: 'c-sump', op: 'delete', oldValues: { unit_price: 3700 }, newValues: null, label: 'SUMP', changedAt: T })
  const wc = row({ table: 'bids_count_rows', recordId: 'c-wc', countRowId: 'c-wc', op: 'delete', changed: ['fixture', 'count'], oldValues: { fixture: 'WC-1', count: 1 }, newValues: null, label: 'WC-1', changedAt: at(1) })
  const restorable = new Map([
    [bidRemovalKey('bids_count_rows', 'c-sump', T), 'ar-sump'],
    [bidRemovalKey('bid_count_row_custom_prices', 'p-sump', T), 'ar-price'],
    [bidRemovalKey('bids_count_rows', 'c-wc', at(1)), 'ar-wc'],
  ])

  it('brings each count row back with what hung on it, newest first', () => {
    const p = ready(plan([sump, price, wc], [], restorable))
    expect(p.steps).toEqual([
      { kind: 'restore', archiveId: 'ar-wc', table: 'bids_count_rows', what: 'WC-1' },
      { kind: 'restore', archiveId: 'ar-sump', table: 'bids_count_rows', what: 'SUMP' },
    ])
    expect(p.changes).toBe(3)
  })

  it('skips a row put back since', () => {
    const back = row({ table: 'bids_count_rows', recordId: 'c-wc', countRowId: 'c-wc', op: 'insert', action: 'put-back', changedAt: at(60) })
    const onlySump = new Map([...restorable].filter(([k]) => !k.includes('c-wc')))
    expect(ready(plan([sump, price, wc], [back], onlySump)).steps.map((s) => s.what)).toEqual(['SUMP'])
  })

  it('is off when the archive no longer holds a removal', () => {
    expect(plan([sump, price, wc], [], new Map())).toEqual({ ready: false, reason: 'Undo is off. 2 rows it removed can no longer come back. The archive keeps a removed row 90 days.' })
  })

  it('restores a removed version first, and its rows of the same delete ride with it', () => {
    const version = row({ table: 'bid_versions', recordId: 'v-9', countRowId: null, op: 'delete', oldValues: { name: 'ZZ walk' }, newValues: null, label: 'ZZ walk', changedAt: T })
    const onIt = row({ table: 'bids_count_rows', recordId: 'c-on', countRowId: 'c-on', op: 'delete', oldValues: { fixture: 'Tub', bid_version_id: 'v-9' }, newValues: null, label: 'Tub', changedAt: T })
    const before = row({ table: 'bids_count_rows', recordId: 'c-early', countRowId: 'c-early', op: 'delete', oldValues: { fixture: 'WC', bid_version_id: 'v-9' }, newValues: null, label: 'WC', changedAt: at(-1) })
    const keys = new Map([
      [bidRemovalKey('bid_versions', 'v-9', T), 'ar-v'],
      [bidRemovalKey('bids_count_rows', 'c-on', T), 'ar-on'],
      [bidRemovalKey('bids_count_rows', 'c-early', at(-1)), 'ar-early'],
    ])
    // c-on went in the version's delete; c-early went a second before, in a delete of its own.
    expect(ready(plan([onIt, version, before], [], keys)).steps.map((s) => s.what)).toEqual(['ZZ walk', 'WC'])
  })

  it('says nothing of a row put back and removed again since: the later line’s Undo answers for it', () => {
    const back = row({ table: 'bids_count_rows', recordId: 'c-wc', countRowId: 'c-wc', op: 'insert', action: 'put-back', changedAt: at(60) })
    const again = row({ table: 'bids_count_rows', recordId: 'c-wc', countRowId: 'c-wc', op: 'delete', changedAt: at(90) })
    expect(plan([wc, row({ table: 'bids_count_rows', recordId: 'c-x', countRowId: 'c-x', op: 'delete', changedAt: at(1), label: 'X' })], [back, again], new Map())).toEqual({ ready: false, reason: 'Undo is off. A row it removed can no longer come back. The archive keeps a removed row 90 days.' })
    expect(plan([wc], [back, again], new Map())).toBeNull()
  })

  it('is off for a removed schedule line, which the archive does not keep', () => {
    const lines = [0, 1].map((i) => row({ table: 'bid_sov_lines', recordId: `s-${i}`, countRowId: null, op: 'delete', newValues: null, label: null, changedAt: at(i) }))
    expect(plan(lines)).toEqual({ ready: false, reason: 'Undo is off. It removed 2 schedule lines, and the archive does not keep those.' })
  })
})

describe('bidUndoPlan · added rows', () => {
  it('removes the rows an import added, in one step per table', () => {
    const rows = imported()
    const p = ready(plan(rows))
    expect(p.steps).toEqual([{ kind: 'remove', table: 'bids_count_rows', ids: ['c-3', 'c-2', 'c-1'], what: '3 count rows' }])
    expect(p).toMatchObject({ changes: 3, removes: 3 })
    expect(bidUndoLabel(actionOf(rows))).toBe('Undo Imported 3 rows from CountTooling')
  })

  it('lets a count row take what the action hung on it, and skips a change to a row it added', () => {
    const rows = [
      row({ table: 'bids_count_rows', recordId: 'c-9', countRowId: 'c-9', op: 'insert', changed: ['fixture'], oldValues: null, newValues: { fixture: 'Tub' }, label: 'Tub', changedAt: at(0), action: 'robot-paste' }),
      row({ table: 'bid_pricing_assignments', recordId: 'a-9', countRowId: 'c-9', op: 'insert', oldValues: null, label: 'Tub', changedAt: at(1), action: 'robot-paste' }),
      row({ table: 'bids_count_rows', recordId: 'c-9', countRowId: 'c-9', op: 'update', changed: ['count'], label: 'Tub', changedAt: at(2), action: 'robot-paste' }),
    ]
    const p = ready(plan(rows))
    expect(p.steps).toEqual([{ kind: 'remove', table: 'bids_count_rows', ids: ['c-9'], what: 'Tub' }])
    expect(p.changes).toBe(3)
  })

  it('is off when a person’s later change hangs on a row it added, and names it', () => {
    const later = [
      row({ recordId: 'p-new', countRowId: 'c-2', op: 'insert', label: 'Lav-2', changedAt: at(120), changedBy: 'u-ben' }),
      row({ table: 'bids_count_rows', recordId: 'c-3', countRowId: 'c-3', changed: ['count'], label: 'Lav-3', changedAt: at(130), changedBy: 'u-ben' }),
    ]
    expect(plan(imported(), later)).toEqual({ ready: false, reason: 'Undo is off. 2 later changes hang on rows it added: Lav-3 count and Lav-2 price.' })
  })

  it('takes the app’s own later book picks with the rows, since the app makes them again', () => {
    const minted = row({ table: 'bid_pricing_assignments', recordId: 'a-1', countRowId: 'c-1', op: 'insert', oldValues: null, changedAt: at(120), action: 'labor-sync', byApp: true })
    expect(ready(plan(imported(), [minted])).removes).toBe(3)
  })

  it('offers Undo again once its rows were removed and put back since: the same rows, nothing hung on them', () => {
    const later = imported().flatMap((r) => [
      row({ table: 'bids_count_rows', recordId: r.recordId, countRowId: r.recordId, op: 'delete', label: r.label, changedAt: at(120), action: 'put-back' }),
      row({ table: 'bids_count_rows', recordId: r.recordId, countRowId: r.recordId, op: 'insert', label: r.label, changedAt: at(180), action: 'put-back' }),
    ])
    expect(ready(plan(imported(), later)).removes).toBe(3)
  })

  it('skips a row removed since, and what hung on it went with it', () => {
    const later = [
      row({ recordId: 'p-new', countRowId: 'c-2', op: 'insert', label: 'Lav-2', changedAt: at(120) }),
      row({ table: 'bids_count_rows', recordId: 'c-2', countRowId: 'c-2', op: 'delete', label: 'Lav-2', changedAt: at(180) }),
    ]
    expect(ready(plan(imported(), later)).steps).toEqual([{ kind: 'remove', table: 'bids_count_rows', ids: ['c-3', 'c-1'], what: '2 count rows' }])
  })

  it('offers nothing once every row it added is gone', () => {
    const cleared = imported().map((r) => ({ ...r, id: r.id! + 1000, op: 'delete' as const, changedAt: at(300), action: 'counts-clear-all' }))
    expect(plan(imported(), cleared)).toBeNull()
  })

  it('is off when it added rows Undo cannot remove', () => {
    const lines = [0, 1].map((i) => row({ table: 'bid_sov_lines', recordId: `s-${i}`, countRowId: null, op: 'insert', oldValues: null, label: null, changedAt: at(i) }))
    expect(plan(lines)).toEqual({ ready: false, reason: 'Undo is off. It added 2 schedule lines, and Undo cannot remove those.' })
    const version = [row({ table: 'bid_versions', recordId: 'v-2', countRowId: null, op: 'insert', oldValues: null, label: 'To Plans', changedAt: at(0) }), ...imported().map((r) => ({ ...r, action: null, changedAt: at(1) }))]
    expect(plan(version)).toEqual({ ready: false, reason: 'Undo is off. It added a version, and Undo cannot remove that.' })
    const estimate = [row({ table: 'cost_estimates', recordId: 'e-2', countRowId: null, op: 'insert', oldValues: null, label: null, changedAt: at(0) }), row({ table: 'cost_estimate_labor_rows', recordId: 'l-2', countRowId: null, op: 'insert', oldValues: null, label: 'Tub', changedAt: at(1) })]
    expect(plan(estimate)).toEqual({ ready: false, reason: 'Undo is off. It added an estimate, and Undo cannot remove that.' })
  })
})

describe('bidUndoPlan · none', () => {
  it('offers nothing for another bid’s action, the app’s own writes, or an action cut at the page’s edge', () => {
    const rows = [row({ changedAt: at(0) }), row({ changedAt: at(1) })]
    expect(bidUndoPlan(actionOf(rows), { openBidId: 'bid-0', restorable: new Map(), history: rows })).toBeNull()
    const app = rows.map((r) => ({ ...r, byApp: true, action: 'labor-sync' }))
    expect(bidUndoPlan(actionOf(app), { openBidId: 'bid-1', restorable: new Map(), history: app })).toBeNull()
    expect(bidUndoPlan({ ...actionOf(rows), continues: true }, { openBidId: 'bid-1', restorable: new Map(), history: rows })).toBeNull()
  })
})

describe('the lists the SQL bed holds to the schema', () => {
  // supabase/tests/bid_changes case 21 runs on the schema main builds (the sql-beds check): every
  // table Undo removes from still has zzz_archive_on_delete, and what hangs on a count row outside
  // the ledger is exactly BID_UNDO_UNSEEN_TABLES. These keep the bed's lists and the kernel's equal.
  const bed = readFileSync(resolve(__dirname, '../../../supabase/tests/bid_changes/20_scenario.sql'), 'utf8')
  const caseText = bed.slice(bed.indexOf('-- 21 · Undo a whole action'))

  it('the archived tables are the ones Undo removes from', () => {
    const list = /unnest\(ARRAY\[([\s\S]*?)\]::text\[\]\)/.exec(caseText)
    expect(list, 'case 21 lists the tables').not.toBeNull()
    expect([...list![1]!.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]).sort()).toEqual([...BID_UNDO_REMOVABLE_TABLES].sort())
  })

  it('the keys outside the ledger that hang on a count row are the ones Undo reads first', () => {
    const want = /'undo: what hangs on a count row outside the ledger[^']*',[\s\S]*?'([a-z0-9_. ]+)'\);/.exec(caseText)
    expect(want, 'case 21 names the keys').not.toBeNull()
    expect(want![1]).toBe(BID_UNDO_UNSEEN_TABLES.map((t) => `${t.table}.${t.column}`).sort().join(' '))
  })

  it('every table Undo removes from is a ledger table', () => {
    const sql = readdirSync(resolve(__dirname, '../../../supabase/migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(resolve(__dirname, '../../../supabase/migrations', f), 'utf8'))
    const marker = 'CREATE OR REPLACE FUNCTION public.bid_changes_tables()'
    const def = sql.filter((x) => x.includes(marker)).pop()!
    const ledger = [...(/ARRAY\[([\s\S]*?)\]::text\[\]/.exec(def.slice(def.indexOf(marker)))![1]!).matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!)
    for (const t of BID_UNDO_REMOVABLE_TABLES) expect(ledger, t).toContain(t)
  })
})

describe('what hangs on a count row outside the ledger', () => {
  const removing: Extract<BidUndoPlan, { ready: true }> = {
    ready: true, changes: 2, writesOver: 0, removes: 2,
    steps: [{ kind: 'remove', table: 'bids_count_rows', ids: ['c-1', 'c-2'], what: '2 count rows' }, { kind: 'remove', table: 'bid_count_row_custom_prices', ids: ['p-9'], what: 'Lav-9' }],
  }
  const read = (id: string, over: Partial<typeof BID_UNDO_UNSEEN_NONE>) => new Map([[id, { ...BID_UNDO_UNSEEN_NONE, ...over }]])

  it('is read for the count rows a plan removes, and only those', () => {
    expect(bidUndoRemovedCountRows(removing)).toEqual(['c-1', 'c-2'])
    expect(bidUndoRemovedCountRows({ ready: false, reason: 'x' })).toEqual([])
  })

  it('turns Undo off for each kind, and names it', () => {
    expect(bidUndoGateUnseen(removing, read('c-1', { ticks: 2 }))).toEqual({ ready: false, reason: 'Undo is off. Rows it added carry work History cannot see: 2 submittal ticks.' })
    expect(bidUndoGateUnseen(removing, read('c-2', { items: 1 }))).toEqual({ ready: false, reason: 'Undo is off. Rows it added carry work History cannot see: 1 submittal item.' })
    expect(bidUndoGateUnseen(removing, read('c-1', { hides: 1 }))).toEqual({ ready: false, reason: 'Undo is off. Rows it added carry work History cannot see: 1 row hidden from the pricing page.' })
    expect(bidUndoGateUnseen(removing, read('c-2', { mappings: 3 }))).toEqual({ ready: false, reason: 'Undo is off. Rows it added carry work History cannot see: 3 By Stage picks.' })
    expect(bidUndoUnseenReason({ ticks: 1, hides: 0, items: 2, mappings: 0 })).toBe('Undo is off. Rows it added carry work History cannot see: 1 submittal tick and 2 submittal items.')
  })

  it('offers Undo when nothing hangs there, waits while the read is out, and stays off when it failed', () => {
    expect(bidUndoGateUnseen(removing, new Map())).toBe(removing)
    expect(bidUndoGateUnseen(removing, read('c-other', { ticks: 1 }))).toBe(removing)
    expect(bidUndoGateUnseen(removing, null)).toBeNull()
    expect(bidUndoGateUnseen(removing, 'failed')).toEqual({ ready: false, reason: BID_UNDO_UNSEEN_UNREAD })
    const noCountRows: BidUndoPlan = { ...removing, steps: [removing.steps[1]!] }
    expect(bidUndoGateUnseen(noCountRows, null)).toBe(noCountRows)
  })
})

describe('runBidUndo', () => {
  const result: BidPutBackResult = { table: 'bid_count_row_custom_prices', record_id: 'p-1', label: 'Lav-1', columns: ['unit_price'], before: {}, after: {} }
  const restored: BidRestoreResult = { ok: true, bid_id: 'bid-1', restored: 2, tables: {}, warnings: ['x'] }
  const p: Extract<BidUndoPlan, { ready: true }> = {
    ready: true,
    changes: 5,
    writesOver: 0,
    removes: 2,
    steps: [
      { kind: 'remove', table: 'bids_count_rows', ids: ['c-1', 'c-2'], what: '2 count rows' },
      { kind: 'value', changeId: 7, table: 'bid_count_row_custom_prices', what: 'Lav-1', writesOver: 1 },
      { kind: 'restore', archiveId: 'ar-1', table: 'bids_count_rows', what: 'SUMP' },
    ],
  }

  it('runs each step in order, every column of a value, and says what it touched', async () => {
    const calls: string[] = []
    const out = await runBidUndo(p, {
      putBack: vi.fn(async (id: number, col: string | null) => { calls.push(`value ${id} ${col}`); return result }),
      restore: vi.fn(async (id: string) => { calls.push(`restore ${id}`); return restored }),
      remove: vi.fn(async (t: string, ids: ReadonlyArray<string>) => { calls.push(`remove ${t} ${ids.join(',')}`); return ids.length }),
    })
    expect(calls).toEqual(['remove bids_count_rows c-1,c-2', 'value 7 null', 'restore ar-1'])
    expect(out).toEqual({ done: 3, refusals: [], tables: ['bids_count_rows', 'bid_count_row_custom_prices'], removed: 2, cleared: 1, wroteOver: 1 })
  })

  it('a row already back, brought by its parent earlier in the run, counts as done', async () => {
    const out = await runBidUndo({ ...p, steps: p.steps.slice(2) }, {
      putBack: async () => result,
      restore: async () => { throw new Error('That removed row is not waiting to be put back.') },
      remove: async () => 0,
    })
    expect(out).toMatchObject({ done: 1, refusals: [] })
  })

  it('a removal that took only some of its rows counts what went and says the rest', async () => {
    const out = await runBidUndo({ ...p, steps: p.steps.slice(0, 1) }, { putBack: async () => result, restore: async () => restored, remove: async () => 1 })
    expect(out).toMatchObject({ done: 1, removed: 1, refusals: [{ what: '2 count rows', words: 'Only 1 of 2 were removed. You cannot change this bid, or the rest are gone already.' }] })
    expect(bidUndoDoneWords({ caption: 'Imported 2 rows from CountTooling' }, out).text).toBe('“Imported 2 rows from CountTooling” is partly undone. 2 count rows: Only 1 of 2 were removed. You cannot change this bid, or the rest are gone already. The row it added is in the delete archive now. Its Put back brings it back.')
  })

  it('says each refusal in the function’s words and still runs the rest', async () => {
    const out = await runBidUndo(p, {
      putBack: async () => { throw new Error('That row was removed since. Put the row back first.') },
      restore: async () => restored,
      remove: async () => 0,
    })
    expect(out.done).toBe(1)
    // The refused put back wrote over nothing.
    expect(out.wroteOver).toBe(0)
    expect(out.refusals).toEqual([
      { what: '2 count rows', words: 'You cannot change this bid, or those rows are gone already.' },
      { what: 'Lav-1', words: 'That row was removed since. Put the row back first.' },
    ])
  })
})

describe('bidUndoDoneWords', () => {
  const a = { caption: 'Imported 3 rows from CountTooling' }
  const out = { done: 1, refusals: [], tables: ['bids_count_rows'], removed: 0, cleared: 0, wroteOver: 0 }

  it('says it is undone, and where removed rows went', () => {
    expect(bidUndoDoneWords(a, out)).toEqual({ text: '“Imported 3 rows from CountTooling” is undone.', ok: true })
    expect(bidUndoDoneWords(a, { ...out, removed: 3 }).text).toBe('“Imported 3 rows from CountTooling” is undone. The 3 rows it added are in the delete archive now. Each one\'s Put back brings it back.')
    expect(bidUndoDoneWords(a, { ...out, removed: 1 }).text).toMatch(/The row it added is in the delete archive now\. Its Put back brings it back\.$/)
  })

  it('says what it wrote over, and fields that came back empty', () => {
    expect(bidUndoDoneWords(a, { ...out, wroteOver: 2, cleared: 1 }).text).toBe('“Imported 3 rows from CountTooling” is undone. 2 of its values had changed again since. Undo wrote over those later changes. One field pointed at a row that is gone, so it is empty now.')
  })

  it('says a refusal in the function’s words, partly or wholly', () => {
    const refusals = [{ what: 'SUMP', words: 'That row, or one like it, is already on the bid, so it cannot come back.' }, { what: 'Lav-1', words: 'x' }]
    expect(bidUndoDoneWords(a, { ...out, refusals })).toEqual({ text: '“Imported 3 rows from CountTooling” is partly undone. SUMP: That row, or one like it, is already on the bid, so it cannot come back. 1 more step could not be undone.', ok: false })
    expect(bidUndoDoneWords(a, { ...out, done: 0, refusals: refusals.slice(0, 1) })).toEqual({ text: 'Nothing was undone. SUMP: That row, or one like it, is already on the bid, so it cannot come back.', ok: false })
  })
})
