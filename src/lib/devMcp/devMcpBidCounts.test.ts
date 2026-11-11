import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BID_COUNTS_VERBS,
  CHILD_TABLES,
  COUNTS_INSERT_ACTION,
  COUNTS_MAX_ROWS,
  bidCountsAppliedWords,
  bidCountsDryRun,
  bidCountsInput,
  countRowProblem,
  isBidCountsVerb,
  readBidCountsWorld,
  rowWords,
  rowsInScope,
  shapeCountRow,
  sheetSummaryWords,
  type BidCountsPayload,
  type BidCountsWorld,
  type CountRow,
  type CountsReads,
  type PlanRemove,
  type PlanRow,
} from '../../../supabase/functions/_shared/devMcpBidCounts'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { BID_ACTIONS } from '../bids/bidActionHeader'
import { COUNT_UNITS } from '../bids/countRowUnit'
import { findDuplicateFixture } from '../bids/countSheet'
import { COUNT_GROUP_PREFIX_RE } from '../bids/parseCountsImportText'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const TWIN = readFileSync('supabase/functions/twin-mcp/index.ts', 'utf8')
const TAB = readFileSync('src/components/bids/BidsCountsTab.tsx', 'utf8')

// A made-up bid and made-up rows: no real name, number or amount.
const BID = 'eeeeeeee-1111-4111-8111-111111111111'
const VERSION = 'dddddddd-1111-4111-8111-111111111111'
const row = (id: string, fixture: string, count: number, over: Partial<CountRow> = {}): CountRow => ({ id, fixture, count, unit: 'ea', page: null, group_tag: null, sequence_order: 1, ...over })

const world = (over: Partial<BidCountsWorld> = {}): BidCountsWorld => ({
  bid: { id: BID, bid_number: '9001', project_name: 'ZZ TEST seat bid', selected_bid_version_id: null, alternate_group_tags: [], bid_date_sent: null, outcome: null },
  versions: [],
  versionId: null,
  rows: [],
  maxSequence: 0,
  hasEstimate: false,
  children: {},
  ...over,
})

const p = (counts: Record<string, unknown>): BidCountsPayload => {
  const built = bidCountsInput('plan_bid_counts', { counts: { bid_id: BID, ...counts } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
type Reply = { rows: PlanRow[]; remove: PlanRemove[]; counts: Record<string, number>; alternates: { before: string[]; after: string[]; joined: string[] }; sheet: { before: string; after: string; rows_before: number; rows_after: number }; after_write: string[]; warnings: string[]; version: unknown; version_words: string }
const plan = (counts: Record<string, unknown>, w: Partial<BidCountsWorld> = {}): Reply => {
  const dry = bidCountsDryRun(p(counts), world(w))
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply as Reply
}
const refusal = (counts: Record<string, unknown>, w: Partial<BidCountsWorld> = {}): string => {
  const dry = bidCountsDryRun(p(counts), world(w))
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('devMcpBidCounts — the verbs on the allowlist', () => {
  it('are one write pair with no RPC, and the server and the README name both', () => {
    expect(BID_COUNTS_VERBS).toEqual(['plan_bid_counts', 'apply_bid_counts'])
    for (const v of BID_COUNTS_VERBS) {
      expect(isBidCountsVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_bid_counts')).toBe('plan_bid_counts')
    expect(isBidCountsVerb('plan_count')).toBe(false) // Materials on site's count of a box
    expect(README).toContain('`plan_bid_counts(counts)` · `apply_bid_counts(counts, plan_hash)`')
    expect(README).toContain("eighty-nine since v2.6967's bid counts")
  })
})

describe('devMcpBidCounts — held to the app’s own', () => {
  it('names only columns the tables have, and every table a deleted row takes with it', () => {
    const columnsOf = (table: string): string[] => Object.keys(CATALOG_TABLES[table]?.columns ?? {})
    expect(columnsOf('bids_count_rows')).toEqual(expect.arrayContaining(['id', 'bid_id', 'bid_version_id', 'fixture', 'count', 'unit', 'page', 'group_tag', 'sequence_order', 'source_shares']))
    expect(columnsOf('bids')).toEqual(expect.arrayContaining(['selected_bid_version_id', 'alternate_group_tags', 'bid_date_sent', 'outcome']))
    expect(columnsOf('bid_versions')).toEqual(expect.arrayContaining(['id', 'name', 'sort_order', 'locked_at', 'locked_by', 'bid_id']))
    expect(columnsOf('cost_estimates')).toEqual(expect.arrayContaining(['id', 'bid_id']))
    for (const { table } of CHILD_TABLES) expect(columnsOf(table), table).toContain('count_row_id')
  })
  it('writes a new row with the columns the sheet’s insert sends, under the sheet’s history tag', () => {
    const sent = [...(TAB.slice(TAB.indexOf('async function insertCountRows')).split('// v2.4720')[0] ?? '').matchAll(/^\s{6}([a-z_]+):/gm)].map((m) => m[1] ?? '')
    expect(sent).toEqual(['bid_id', 'bid_version_id', 'fixture', 'count', 'group_tag', 'page', 'sequence_order', 'unit', 'source_shares'])
    const add = plan({ rows: [{ fixture: 'Water closet', count: 4 }] }).rows[0]
    expect(add?.status === 'add' ? Object.keys(add.row) : []).toEqual(sent)
    expect(COUNTS_INSERT_ACTION).toBe(BID_ACTIONS.countsImport)
    expect(SERVER).toContain("{ 'x-bid-action': COUNTS_INSERT_ACTION }")
  })
  it('shapes a row as twin-mcp’s paste_counts does: the same prefix, the same units', () => {
    expect(TWIN).toContain(`const GROUP_PREFIX_RE = ${String(COUNT_GROUP_PREFIX_RE)}`)
    expect(TWIN).toContain(`const UNITS = [${COUNT_UNITS.map((u) => `'${u}'`).join(', ')}]`)
    expect(TWIN).toContain(".trim().slice(0, 300)")
    expect(TWIN).toContain(".trim().slice(0, 80) || null")
    expect(TWIN).toContain(".trim().slice(0, 40) || null")
  })
  it('keeps the sheet’s duplicate rule: one row a fixture in a scope', () => {
    const rows = [row('r1', 'Water closet', 4, { group_tag: 'Restroom A' }), row('r2', 'Water closet', 1, { group_tag: 'Break room' })]
    // Both base: the sheet calls the second a duplicate, and so does the seat.
    expect(findDuplicateFixture(rows, 'water closet', undefined, { alternateTags: [], groupTag: 'Level 2' })?.id).toBe('r1')
    expect(rowsInScope(rows, 'water closet', 'Level 2', []).map((r) => r.id)).toEqual(['r1', 'r2'])
    // Break room an alternate: one in the base bid, one in the alternate.
    expect(rowsInScope(rows, 'Water closet', null, ['Break room']).map((r) => r.id)).toEqual(['r1'])
    expect(rowsInScope(rows, 'Water closet', 'break room', ['Break room']).map((r) => r.id)).toEqual(['r2'])
    expect(findDuplicateFixture(rows, 'Water closet', undefined, { alternateTags: ['Break room'], groupTag: 'Break room' })?.id).toBe('r2')
  })
})

describe('shapeCountRow and bidCountsInput', () => {
  it('lifts a [Group] prefix off the name, trims, and reads a count typed as text', () => {
    expect(shapeCountRow({ fixture: ' [Break room] Water closet ', count: '2', unit: 'EA', page: ' P-101 ' }, 1)).toMatchObject({ fixture: 'Water closet', group: 'Break room', count: 2, unit: 'ea', page: 'P-101', has: { group: true, unit: true, page: true } })
    expect(shapeCountRow({ fixture: '[Area 2] Lavatory', count: 1, group: 'Level 1' }, 1)).toMatchObject({ fixture: 'Lavatory', group: 'Level 1' })
    expect(shapeCountRow({ fixture: 'Lavatory', count: 1 }, 1)).toMatchObject({ group: null, unit: null, page: null, alternate: false, has: { group: false, unit: false, page: false } })
  })
  it('names a row’s fault in the sheet’s words', () => {
    expect(countRowProblem({ fixture: '', count: 1, unit: null, alternate: false, group: null })).toContain('fixture name')
    expect(countRowProblem({ fixture: 'Lavatory', count: 0, unit: null, alternate: false, group: null })).toContain('above zero')
    expect(countRowProblem({ fixture: 'Lavatory', count: Number.NaN, unit: null, alternate: false, group: null })).toContain('above zero')
    expect(countRowProblem({ fixture: 'Lavatory', count: 1, unit: 'each', alternate: false, group: null })).toContain('ea, ft, px, sqft')
    expect(countRowProblem({ fixture: 'Lavatory', count: 1, unit: null, alternate: true, group: null })).toContain('group')
    expect(countRowProblem({ fixture: 'Lavatory', count: 1.5, unit: 'ft', alternate: true, group: 'Alt 1' })).toBeNull()
  })
  it('refuses the ask only for its shape; a faulty row is kept for the plan to hold', () => {
    expect(bidCountsInput('plan_bid_counts', {})).toMatchObject({ ok: false, error: expect.stringContaining('plan_bid_counts needs counts') })
    expect(bidCountsInput('plan_bid_counts', { counts: { bid_id: 'b9001', rows: [] } })).toMatchObject({ ok: false })
    expect(bidCountsInput('plan_bid_counts', { counts: { bid_id: BID } })).toMatchObject({ ok: false, error: expect.stringContaining('nothing to do') })
    expect(bidCountsInput('plan_bid_counts', { counts: { bid_id: BID, rows: 'WC 4' } })).toMatchObject({ ok: false })
    expect(bidCountsInput('plan_bid_counts', { counts: { bid_id: BID, rows: Array.from({ length: COUNTS_MAX_ROWS + 1 }, () => ({ fixture: 'x', count: 1 })) } })).toMatchObject({ ok: false, error: expect.stringContaining('at most 200') })
    expect(bidCountsInput('plan_bid_counts', { counts: { bid_id: BID, rows: [{ fixture: 'x', count: 1 }], version_id: 'v1' } })).toMatchObject({ ok: false, error: expect.stringContaining('bid_versions.id') })
    expect(p({ rows: [{ fixture: '', count: -1 }] }).rows).toHaveLength(1)
    expect(writeRpcBody('apply_bid_counts', { counts: { bid_id: BID, rows: [{ fixture: 'x', count: 1 }] } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('plan_bid_counts', { counts: { bid_id: BID.toUpperCase(), remove: [{ fixture: ' Lavatory ' }] } })).toMatchObject({ ok: true, rpc: null, step: 'plan', target: BID, body: { p: { bid_id: BID, rows: [], remove: [{ n: 1, fixture: 'Lavatory', group: null }] } } })
  })
})

describe('readBidCountsWorld — the reads the door sees', () => {
  it('reads the bid, its versions, the active version’s rows as the sheet loads them, and what hangs on a row to remove', async () => {
    const asked: string[] = []
    const reads: CountsReads = {
      rows: (table, query) => {
        asked.push(`${table}?${query}`)
        if (table === 'bids') return Promise.resolve([{ id: BID, bid_number: '9001', project_name: 'ZZ TEST seat bid', selected_bid_version_id: VERSION, alternate_group_tags: ['Break room'], bid_date_sent: null, outcome: null }])
        if (table === 'bid_versions') return Promise.resolve([{ id: VERSION, name: 'To Plans', sort_order: '0', locked_at: null, locked_by: null }])
        if (table === 'bids_count_rows' && query.includes('order=sequence_order.desc')) return Promise.resolve([{ sequence_order: '7' }])
        if (table === 'bids_count_rows') return Promise.resolve([{ id: 'r1', fixture: 'Lavatory', count: '3', unit: 'ea', page: null, group_tag: null, sequence_order: '7' }])
        if (table === 'bids_takeoff_rough_part_lines') return Promise.resolve([{ count_row_id: 'r1' }, { count_row_id: 'r1' }])
        if (table === 'bid_pricing_assignments') return Promise.resolve([{ count_row_id: 'r1' }])
        return Promise.resolve([])
      },
    }
    const w = await readBidCountsWorld(reads, p({ remove: [{ fixture: 'lavatory' }] }))
    expect(asked).toEqual(expect.arrayContaining([
      `bids?select=id,bid_number,project_name,selected_bid_version_id,alternate_group_tags,bid_date_sent,outcome&id=eq.${BID}`,
      `bid_versions?select=id,name,sort_order,locked_at,locked_by&bid_id=eq.${BID}&order=sort_order.asc`,
      `bids_count_rows?select=sequence_order&bid_id=eq.${BID}&order=sequence_order.desc&limit=1`,
      `cost_estimates?select=id&bid_id=eq.${BID}&limit=1`,
      `bids_count_rows?select=id,fixture,count,unit,page,group_tag,sequence_order&bid_id=eq.${BID}&bid_version_id=eq.${VERSION}&order=sequence_order.asc,id.asc&limit=200&offset=0`,
      'bids_takeoff_rough_part_lines?select=count_row_id&count_row_id=in.(r1)&limit=1000',
    ]))
    expect(w).toMatchObject({ versionId: VERSION, maxSequence: 7, hasEstimate: false, rows: [{ id: 'r1', count: 3, sequence_order: 7 }], children: { r1: { takeoff_lines: 2, price_assignments: 1, custom_prices: 0, custom_costs: 0 } } })
  })
  it('reads an unsplit bid’s rows where the version is null', async () => {
    const asked: string[] = []
    const reads: CountsReads = { rows: (table, query) => { asked.push(`${table}?${query}`); return Promise.resolve(table === 'bids' ? [{ id: BID, bid_number: '9001', project_name: 'ZZ', selected_bid_version_id: null, alternate_group_tags: null, bid_date_sent: null, outcome: null }] : []) } }
    const w = await readBidCountsWorld(reads, p({ rows: [{ fixture: 'x', count: 1 }] }))
    expect(asked.some((q) => q.includes('bid_version_id=is.null'))).toBe(true)
    expect(w).toMatchObject({ versionId: null, rows: [], maxSequence: 0 })
  })
})

describe('bidCountsDryRun — a count sheet entered from paper', () => {
  const ASK = { rows: [{ fixture: 'Water closet', count: 4, group: 'Restroom A', page: 'P-101' }, { fixture: 'Lavatory', count: 3 }, { fixture: 'ft of 2" copper', count: 48.5 }] }
  it('adds each row after the bid’s last, the unit read off the name, on the version the sheet would write', () => {
    const r = plan(ASK, { maxSequence: 7 })
    expect(r.counts).toEqual({ add: 3, change: 0, unchanged: 0, remove: 0, held: 0 })
    expect(r.rows.map((x) => (x.status === 'add' ? x.row : null))).toEqual([
      { bid_id: BID, bid_version_id: null, fixture: 'Water closet', count: 4, group_tag: 'Restroom A', page: 'P-101', sequence_order: 8, unit: 'ea', source_shares: null },
      { bid_id: BID, bid_version_id: null, fixture: 'Lavatory', count: 3, group_tag: null, page: null, sequence_order: 9, unit: 'ea', source_shares: null },
      { bid_id: BID, bid_version_id: null, fixture: 'ft of 2" copper', count: 48.5, group_tag: null, page: null, sequence_order: 10, unit: 'ft', source_shares: null },
    ])
    expect(r.rows.map((x) => x.reads)).toEqual(['4 × Water closet (Restroom A, p. P-101)', '3 × Lavatory', '48.5 ft ft of 2" copper'])
    expect(r.sheet).toEqual({ before: 'no rows', after: '2 counts (7 ea) · 1 line type (48.5 ft)', rows_before: 0, rows_after: 3 })
    expect(r.version).toBeNull()
    expect(r.version_words).toContain('never been split')
    expect(r.after_write.join('\n')).toContain('has no labor estimate yet')
    expect(r.after_write.join('\n')).toContain('reads $0 on Pricing until it is priced')
    expect(plan(ASK, { versions: [{ id: VERSION, name: 'To Plans', sort_order: 0, locked_at: null, locked_by: null }], versionId: VERSION }).rows[0]).toMatchObject({ row: { bid_version_id: VERSION } })
  })
  it('changes a row already on the sheet in the fields the ask names, and leaves one that already reads that way', () => {
    const rows = [row('r1', 'Water closet', 4, { group_tag: 'Restroom A', page: 'P-101' }), row('r2', 'Lavatory', 3)]
    const r = plan({ rows: [{ fixture: 'water closet', count: 6 }, { fixture: 'Lavatory', count: 3 }, { fixture: 'Urinal', count: 1, group: 'Restroom A' }] }, { rows, maxSequence: 2, hasEstimate: true })
    expect(r.rows).toEqual([
      { status: 'change', n: 1, id: 'r1', reads: '4 × Water closet (Restroom A, p. P-101) → 6 × Water closet (Restroom A, p. P-101)', patch: { count: 6 }, before: { count: 4 } },
      { status: 'unchanged', n: 2, id: 'r2', reads: '3 × Lavatory' },
      { status: 'add', n: 3, reads: '1 × Urinal (Restroom A)', row: expect.objectContaining({ sequence_order: 3 }) },
    ])
    expect(r.sheet.before).toBe('2 counts (7 ea)')
    expect(r.sheet.after).toBe('3 counts (10 ea)')
    expect(r.after_write.join('\n')).toContain('load sync mints a labor row')
    // A page, a unit and a group change only when the ask names them; null clears a page.
    expect(plan({ rows: [{ fixture: 'Water closet', count: 4, page: null, group: 'Level 1', unit: 'ea' }] }, { rows }).rows[0]).toMatchObject({ status: 'change', patch: { page: null, group_tag: 'Level 1' }, before: { page: 'P-101', group_tag: 'Restroom A' } })
  })
  it('holds a faulty row with its reason and lets the rest go on', () => {
    const r = plan({ rows: [{ fixture: 'Water closet', count: 4 }, { fixture: '', count: 2 }, { fixture: 'Lavatory', count: 0 }, { fixture: 'Sink', count: 1, unit: 'each' }, { fixture: 'Hose bibb', count: 1, alternate: true }] })
    expect(r.counts).toMatchObject({ add: 1, held: 4 })
    expect(r.rows.filter((x) => x.status === 'held').map((x) => (x.status === 'held' ? x.why : ''))).toEqual([expect.stringContaining('fixture name'), expect.stringContaining('above zero'), expect.stringContaining('ea, ft, px, sqft'), expect.stringContaining('group')])
  })
  it('holds the same fixture named twice in the base bid, as quick add refuses it', () => {
    const r = plan({ rows: [{ fixture: 'Water closet', count: 4, group: 'Level 1' }, { fixture: 'water closet', count: 3, group: 'Level 2' }, { fixture: 'Lavatory', count: 2 }] })
    expect(r.counts).toMatchObject({ add: 1, held: 2 })
    expect(r.rows[0]).toMatchObject({ status: 'held', why: expect.stringContaining('rows 1 and 2 name the same fixture in the base bid') })
    // A row several rows already wear (an import leaves them so) is held unless the group picks one.
    const rows = [row('r1', 'Water closet', 4, { group_tag: 'Level 1' }), row('r2', 'Water closet', 3, { group_tag: 'Level 2' })]
    expect(plan({ rows: [{ fixture: 'Water closet', count: 9 }, { fixture: 'Sink', count: 1 }] }, { rows }).rows[0]).toMatchObject({ status: 'held', why: expect.stringContaining('2 rows already wear "Water closet" in the base bid') })
    expect(plan({ rows: [{ fixture: 'Water closet', count: 9, group: 'level 2' }] }, { rows }).rows[0]).toMatchObject({ status: 'change', id: 'r2', patch: { count: 9 } })
  })
  it('an alternate is its own scope and joins the bid’s alternates', () => {
    const rows = [row('r1', 'Water closet', 4, { group_tag: 'Restroom A' })]
    const r = plan({ rows: [{ fixture: 'Water closet', count: 1, group: 'Break room', alternate: true }] }, { rows, maxSequence: 1 })
    expect(r.rows[0]).toMatchObject({ status: 'add', reads: '1 × Water closet (Break room)' })
    expect(r.alternates).toEqual({ before: [], after: ['Break room'], joined: ['Break room'] })
    expect(r.sheet.after).toBe('2 counts (5 ea) · 1 alternate: Break room (1 ea)')
    // Already an alternate on the bid: nothing to join, and the row is found in its own scope.
    const again = plan({ rows: [{ fixture: 'Water closet', count: 2, group: 'Break room', alternate: true }] }, { rows: [...rows, row('r2', 'Water closet', 1, { group_tag: 'Break room' })], bid: { ...world().bid!, alternate_group_tags: ['Break room'] } })
    expect(again.rows[0]).toMatchObject({ status: 'change', id: 'r2', patch: { count: 2 } })
    expect(again.alternates.joined).toEqual([])
    // A held alternate row joins nothing.
    expect(refusal({ rows: [{ fixture: 'Sink', count: 0, group: 'Alt 2', alternate: true }] })).toContain('Nothing ready')
  })
  it('removes a row and names what goes with it', () => {
    const rows = [row('r1', 'Water closet', 4), row('r2', 'Lavatory', 3)]
    const r = plan({ remove: [{ fixture: 'lavatory' }, { fixture: 'Urinal' }] }, { rows, children: { r2: { takeoff_lines: 5, price_assignments: 1, custom_prices: 0, custom_costs: 1 } }, bid: { ...world().bid!, bid_date_sent: '2026-06-02' } })
    expect(r.remove).toEqual([
      { status: 'remove', n: 1, id: 'r2', reads: '3 × Lavatory', takes_with_it: { takeoff_lines: 5, price_assignments: 1, custom_prices: 0, custom_costs: 1 } },
      { status: 'held', n: 2, reads: 'Urinal', why: 'no row on the sheet wears that fixture there' },
    ])
    expect(r.sheet.after).toBe('1 count (4 ea)')
    expect(r.warnings.join('\n')).toContain('takes its takeoff lines and its prices with it')
    expect(r.warnings.join('\n')).toContain('was sent on 2026-06-02')
    // The same row in rows and remove is held in rows; the remove still stands.
    const both = plan({ rows: [{ fixture: 'Lavatory', count: 9 }], remove: [{ fixture: 'Lavatory' }] }, { rows })
    expect(both.rows[0]).toMatchObject({ status: 'held', why: expect.stringContaining('remove') })
    expect(both.counts).toMatchObject({ remove: 1, held: 1 })
  })
  it('refuses a bid not visible, a version the bid does not have, and a plan with nothing ready', () => {
    expect(refusal({ rows: [{ fixture: 'x', count: 1 }] }, { bid: null })).toContain('No bid')
    expect(refusal({ rows: [{ fixture: 'x', count: 1 }], version_id: VERSION })).toContain('has never been split')
    expect(refusal({ rows: [{ fixture: 'Lavatory', count: 3 }] }, { rows: [row('r2', 'Lavatory', 3)] })).toBe('Nothing ready on b9001 ZZ TEST seat bid. Every row already reads that way.')
    expect(refusal({ rows: [{ fixture: '', count: 1 }] })).toContain('Held:')
  })
  it('warns on a locked version, and commits the hash to the sheet as it stood', async () => {
    const versions = [{ id: VERSION, name: 'To Plans', sort_order: 0, locked_at: '2026-11-01T00:00:00Z', locked_by: 'someone' }]
    expect(plan({ rows: [{ fixture: 'x', count: 1 }] }, { versions, versionId: VERSION }).warnings.join('\n')).toContain('is locked')
    const payload = p({ rows: [{ fixture: 'Water closet', count: 6 }] })
    const a = bidCountsDryRun(payload, world({ rows: [row('r1', 'Water closet', 4)] }))
    const b = bidCountsDryRun(payload, world({ rows: [row('r1', 'Water closet', 4)] }))
    const moved = bidCountsDryRun(payload, world({ rows: [row('r1', 'Water closet', 5)] }))
    if (!a.ok || !b.ok || !moved.ok) throw new Error('expected plans')
    const hash = await planHash('plan_bid_counts', payload, a.reply)
    expect(await planHash('apply_bid_counts', payload, b.reply)).toBe(hash)
    expect(await planHash('plan_bid_counts', payload, moved.reply)).not.toBe(hash)
  })
})

describe('the apply’s words', () => {
  it('say what landed, name what failed with its reason, and read the sheet back', () => {
    expect(rowWords({ fixture: 'ft of 2" copper', count: 48.5, unit: null, group_tag: null, page: null })).toBe('48.5 ft ft of 2" copper')
    expect(sheetSummaryWords([row('r1', 'Water closet', 4), row('r2', 'Water closet', 1, { group_tag: 'Break room' })], ['Break room'])).toBe('2 counts (5 ea) · 1 alternate: Break room (1 ea)')
    const done = bidCountsAppliedWords('b9001 ZZ TEST seat bid', { added: 2, changed: [{ n: 3, reads: 'x' }], removed: [], alternates: ['Break room'] }, [], 1, '3 counts (9 ea)')
    expect(done).toMatchObject({ landed: '2 added, 1 changed, 1 alternate joined (Break room)', failed: [], held_in_plan: 1, sheet_now: '3 counts (9 ea)', next: expect.stringContaining('reads as planned') })
    const partly = bidCountsAppliedWords('b9001', { added: 0, changed: [], removed: [{ n: 1, reads: '3 × Lavatory' }], alternates: [] }, [{ n: 2, what: '4 × Sink', why: '403' }], 0, null)
    expect(partly).toMatchObject({ landed: '1 removed', next: expect.stringContaining('1 did not') })
    expect(alreadyApplied('apply_bid_counts', { target: BID, at: null })).toContain('already applied on this bid')
  })
  it('the server writes each kind of row its own way', () => {
    expect(SERVER).toContain("restRows(session, 'POST', 'bids_count_rows', 'select=id', adds.map((a) => a.row), undefined, { 'x-bid-action': COUNTS_INSERT_ACTION })")
    expect(SERVER).toContain("restRows(session, 'PATCH', 'bids_count_rows', `id=eq.${c.id}&select=id`, c.patch, 'return=representation')")
    expect(SERVER).toContain("restRows(session, 'DELETE', 'bids_count_rows', `id=eq.${r.id}&select=id`, null, 'return=representation')")
    expect(SERVER).toContain("{ alternate_group_tags: alt.after }")
  })
})
