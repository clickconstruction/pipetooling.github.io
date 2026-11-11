import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  PRODUCT_STATUSES,
  REASON_KINDS,
  SUBMITTAL_ROWS_MAX,
  SUBMITTAL_VERBS,
  findHouse,
  getSubmittals,
  isSubmittalVerb,
  logDryRun,
  readSubmittalWorld,
  revisionLine,
  rowsDryRun,
  statusForNewRow,
  statusText,
  submittalAppliedWords,
  submittalBoard,
  submittalInput,
  submittalWrites,
  submittalsReply,
  type ItemRow,
  type LogPayload,
  type RowsPayload,
  type SubmittalExtras,
  type SubmittalWorld,
} from '../../../supabase/functions/_shared/devMcpSubmittals'
import type { Reader, Row, RowsQuery } from '../../../supabase/functions/_shared/devMcpComposites'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planReply, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { STATUS_LABELS, REASON_LABELS } from '../submittals/productStatus'
import { procurementItemsFrom } from '../submittals/procurementLogIo'
import { buildProcurementLog } from '../submittals/procurementLog'
import { procurementSteps } from '../submittals/procurementBoard'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const TAB = readFileSync('src/components/bids/BidsSubmittalsTab.tsx', 'utf8')
const PANEL = readFileSync('src/components/bids/SubmittalProcurementPanel.tsx', 'utf8')

const BID = 'aaaaaaaa-1111-4111-8111-111111111111'
const REV1 = 'bbbbbbbb-1111-4111-8111-111111111111'
const REV2 = 'bbbbbbbb-2222-4222-8222-222222222222'
const HOUSE = 'cccccccc-1111-4111-8111-111111111111'
const HOUSE2 = 'cccccccc-2222-4222-8222-222222222222'
const JOB = 'dddddddd-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const TODAY = '2026-11-09'

const item = (over: Partial<ItemRow> & { id: string; tag: string }): ItemRow => ({
  submittal_id: REV1,
  sequence_order: 1,
  specified_manufacturer: null,
  specified_model: null,
  specified_description: null,
  submitted_manufacturer: null,
  submitted_model: null,
  submitted_label: null,
  supply_house_id: null,
  status: 'proposed',
  reason_kind: null,
  reason_note: null,
  lead_time_days: null,
  order_only: false,
  sheet_pages: [],
  source_count_row_id: null,
  review_decision: null,
  review_note: null,
  reviewed_at: null,
  reviewed_by_name: null,
  ...over,
})

const rev = (id: string, n: number, status: string) => ({ id, rev_number: n, status, title: 'Plumbing fixtures & equipment', note: null, shared_at: status === 'shared' ? '2026-10-01T15:00:00Z' : null, sent_outside_at: null, package_path: null, created_at: '2026-09-29T00:00:00Z' })

const world = (over: Partial<SubmittalWorld> = {}): SubmittalWorld => ({
  bid: { id: BID, label: 'B398', projectName: 'ZZ Test' },
  job: null,
  revisions: [rev(REV1, 1, 'draft')],
  items: [
    item({ id: 'i-wc', tag: 'WC-1', sequence_order: 1, submitted_manufacturer: 'Toto', submitted_model: 'CST744', lead_time_days: 14, supply_house_id: HOUSE }),
    item({ id: 'i-lav', tag: 'LAV-1', sequence_order: 2, submitted_label: 'Kohler K-2210' }),
  ],
  parts: [],
  records: [],
  houses: [
    { id: HOUSE, name: 'Moore Supply', default_lead_time_days: null },
    { id: HOUSE2, name: 'National Wholesale Supply', default_lead_time_days: 7 },
  ],
  countRows: [],
  splits: [],
  stageDates: {},
  ...over,
})

const rowsP = (rows: unknown[], bid = 'b398'): RowsPayload => {
  const built = submittalInput('plan_submittal_rows', { submittal: { bid, rows } })
  if (!built.ok) throw new Error(built.error)
  return built.p as RowsPayload
}
const logP = (lines: unknown[]): LogPayload => {
  const built = submittalInput('plan_submittal_log', { log: { bid: 'b398', lines } })
  if (!built.ok) throw new Error(built.error)
  return built.p as LogPayload
}
const reply = (dry: ReturnType<typeof rowsDryRun>) => {
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply
}

describe('the grammar', () => {
  it('names two pairs, both in WRITE_VERBS with no RPC', () => {
    expect(SUBMITTAL_VERBS).toEqual(['plan_submittal_rows', 'apply_submittal_rows', 'plan_submittal_log', 'apply_submittal_log'])
    for (const v of SUBMITTAL_VERBS) {
      expect(isSubmittalVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
    }
    expect(isSubmittalVerb('plan_job')).toBe(false)
    expect(planVerbFor('apply_submittal_rows')).toBe('plan_submittal_rows')
    expect(planVerbFor('apply_submittal_log')).toBe('plan_submittal_log')
  })

  it('is on the server and in the README', () => {
    expect(SERVER).toContain("const SERVER_VERSION = '0.70.0'")
    expect(SERVER).toContain('Writes are eighty-three verbs and nothing else:')
    for (const v of [...SUBMITTAL_VERBS, 'get_submittals']) expect(SERVER).toContain(`name: '${v}'`)
    expect(SERVER).toContain("case 'get_submittals':")
    expect(README).toContain('`get_submittals(bid)`')
    expect(README).toContain('`plan_submittal_rows(submittal)` · `apply_submittal_rows(submittal, plan_hash)`')
    expect(README).toContain('`plan_submittal_log(log)` · `apply_submittal_log(log, plan_hash)`')
    expect(README).toContain('eighty-three `plan_` / `apply_` / `revert_` verbs')
  })

  it('writes the tables the tab writes', () => {
    expect(TAB).toContain("db.from('bid_submittals').insert({ bid_id: bidId, rev_number: 1, status: 'draft'")
    expect(TAB).toContain("db.from('bid_submittal_items').insert({ submittal_id: selectedRev.id, sequence_order: editing.sequence_order")
    expect(PANEL).toContain("supabase.from('bid_procurement_items').update(patch).eq('id', recordId)")
    expect(PANEL).toContain("supabase.from('bid_procurement_items').insert({ bid_id: bidId, tag: row.tag")
  })

  it('offers the statuses and reasons the tab offers', () => {
    expect([...PRODUCT_STATUSES].sort()).toEqual(Object.keys(STATUS_LABELS).sort())
    expect([...REASON_KINDS].sort()).toEqual(Object.keys(REASON_LABELS).sort())
  })

  it('goes through writeRpcBody with no RPC and the payload as p', () => {
    const built = writeRpcBody('plan_submittal_rows', { submittal: { bid: ' b398 ', rows: [{ tag: ' WC-2 ', submitted: { manufacturer: 'Toto', model: 'CST744' } }] } })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'plan', target: 'b398', body: { p: { action: 'rows', bid: 'b398', rows: [{ tag: 'WC-2', submitted_manufacturer: 'Toto', submitted_model: 'CST744' }] } } })
    expect(writeRpcBody('apply_submittal_log', { log: { bid: 'b398', lines: [{ tag: 'WC-1', ordered_on: '2026-11-01' }] } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('apply_submittal_log', { log: { bid: 'b398', lines: [{ tag: 'WC-1', ordered_on: '2026-11-01' }] }, plan_hash: HASH })).toMatchObject({ ok: true, step: 'apply', planHash: HASH })
  })

  it('says a second apply of one plan wrote nothing', () => {
    expect(alreadyApplied('apply_submittal_rows', { target: BID, at: '2026-11-09T12:00:00Z' })).toContain('already applied on this bid at 2026-11-09T12:00:00Z')
    expect(alreadyApplied('apply_submittal_log', { target: BID, at: null })).toContain('get_submittals reads it back')
  })
})

describe('submittalInput', () => {
  it('shapes rows: words trimmed, null clears, a key left out is left alone', () => {
    const p = rowsP([{ tag: 'WC-1', specified: { manufacturer: ' American Standard ', model: '2234.001' }, submitted: { label: null }, status: 'ALTERNATE', reason_kind: 'lead_time', reason_note: ' 12 weeks out ', lead_time_days: 0, supply_house: 'Moore', order_only: false }])
    expect(p.rows[0]).toEqual({ tag: 'WC-1', specified_manufacturer: 'American Standard', specified_model: '2234.001', submitted_label: null, status: 'alternate', reason_kind: 'lead_time', reason_note: '12 weeks out', lead_time_days: 0, supply_house: 'Moore', order_only: false })
    expect('submitted_manufacturer' in p.rows[0]!).toBe(false)
  })

  it('refuses in words', () => {
    const bad = (rows: unknown, bid: unknown = 'b398') => submittalInput('plan_submittal_rows', { submittal: { bid, rows } })
    expect(submittalInput('plan_submittal_rows', {})).toMatchObject({ ok: false, error: expect.stringContaining('plan_submittal_rows needs submittal') })
    expect(bad([{ tag: 'WC-1' }], '')).toMatchObject({ ok: false })
    expect(bad([])).toMatchObject({ ok: false })
    expect(bad(Array.from({ length: SUBMITTAL_ROWS_MAX + 1 }, (_, i) => ({ tag: `T-${i}` })))).toMatchObject({ ok: false })
    expect(bad([{ tag: ' ' }])).toMatchObject({ ok: false, error: expect.stringContaining('row 1 needs a tag') })
    expect(bad([{ tag: 'x'.repeat(41) }])).toMatchObject({ ok: false })
    expect(bad([{ tag: 'WC-1' }, { tag: 'wc-1 ' }])).toMatchObject({ ok: false, error: expect.stringContaining('named twice') })
    expect(bad([{ tag: 'WC-1', status: 'approved' }])).toMatchObject({ ok: false, error: expect.stringContaining('status is one of') })
    expect(bad([{ tag: 'WC-1', reason_kind: 'because' }])).toMatchObject({ ok: false, error: expect.stringContaining('reason_kind') })
    expect(bad([{ tag: 'WC-1', lead_time_days: 1.5 }])).toMatchObject({ ok: false, error: expect.stringContaining('lead_time_days') })
    expect(bad([{ tag: 'WC-1', lead_time_days: 731 }])).toMatchObject({ ok: false })
    expect(bad([{ tag: 'WC-1', specified: 'Toto' }])).toMatchObject({ ok: false, error: expect.stringContaining('specified is {') })
    expect(bad([{ tag: 'WC-1', order_only: 'yes' }])).toMatchObject({ ok: false, error: expect.stringContaining('order_only') })
  })

  it('shapes log lines: one of line or tag, a real day, at least one fact', () => {
    expect(logP([{ tag: 'WC-1', all_parts: true, ordered_on: '2026-11-01', po_ref: ' PO-7 ', delivered_on: null }]).lines[0]).toEqual({ tag: 'WC-1', all_parts: true, ordered_on: '2026-11-01', po_ref: 'PO-7', delivered_on: null })
    const bad = (lines: unknown) => submittalInput('plan_submittal_log', { log: { bid: 'b398', lines } })
    expect(bad([{ ordered_on: '2026-11-01' }])).toMatchObject({ ok: false, error: expect.stringContaining('one of line') })
    expect(bad([{ line: 'WC-1', tag: 'WC-1', ordered_on: '2026-11-01' }])).toMatchObject({ ok: false })
    expect(bad([{ tag: 'WC-1' }])).toMatchObject({ ok: false, error: expect.stringContaining('names no fact') })
    expect(bad([{ tag: 'WC-1', ordered_on: '11/01/2026' }])).toMatchObject({ ok: false, error: expect.stringContaining('YYYY-MM-DD') })
    expect(bad([{ tag: 'WC-1', ordered_on: '2026-02-30' }])).toMatchObject({ ok: false })
    expect(bad([{ line: 'part:abc', all_parts: true, note: 'x' }])).toMatchObject({ ok: false, error: expect.stringContaining('all_parts goes with a tag') })
    expect(bad([{ tag: 'WC-1', po_ref: 'x'.repeat(61) }])).toMatchObject({ ok: false })
  })

  it('an apply quotes a 64-hex hash', () => {
    expect(submittalInput('apply_submittal_rows', { submittal: { bid: 'b398', rows: [{ tag: 'WC-1' }] }, plan_hash: 'nope' })).toMatchObject({ ok: false, error: expect.stringContaining('plan_submittal_rows replied with') })
    expect(submittalInput('apply_submittal_rows', { submittal: { bid: 'b398', rows: [{ tag: 'WC-1' }] }, plan_hash: HASH.toUpperCase() })).toMatchObject({ ok: true, planHash: HASH })
  })
})

describe('statusForNewRow and findHouse', () => {
  it('works the status out as the tab does', () => {
    expect(statusForNewRow({ tag: 'A' })).toBe('missing')
    expect(statusForNewRow({ tag: 'A', submitted_label: 'Kohler K-2210' })).toBe('proposed')
    expect(statusForNewRow({ tag: 'A', specified_model: 'K-2210' })).toBe('missing')
    expect(statusForNewRow({ tag: 'A', specified_manufacturer: 'Kohler', specified_model: 'K-2210', submitted_manufacturer: 'Kohler', submitted_model: 'K-2210' })).toBe('as_specified')
    expect(statusForNewRow({ tag: 'A', specified_manufacturer: 'Kohler', specified_model: 'K-2210', submitted_manufacturer: 'Toto', submitted_model: 'LT540' })).toBe('alternate')
    expect(statusForNewRow({ tag: 'A', specified_model: 'K-2210', submitted_model: 'LT540', status: 'equal' })).toBe('equal')
  })

  it('finds a house by id, by name, by the one name that holds the words', () => {
    const houses = world().houses
    expect(findHouse(houses, HOUSE.toUpperCase())).toMatchObject({ name: 'Moore Supply' })
    expect(findHouse(houses, 'moore supply')).toMatchObject({ id: HOUSE })
    expect(findHouse(houses, 'National')).toMatchObject({ id: HOUSE2 })
    expect(findHouse(houses, 'Supply')).toMatchObject({ refused: expect.stringContaining('fits 2 supply houses') })
    expect(findHouse(houses, 'Ferguson')).toMatchObject({ refused: expect.stringContaining('no supply house named') })
  })
})

describe('rowsDryRun', () => {
  it('adds new tags after the last row and changes a tag already there, the named fields only', () => {
    const r = reply(rowsDryRun(rowsP([
      { tag: 'UR-1', submitted: { manufacturer: 'Sloan', model: 'SU-1009' }, lead_time_days: 21, supply_house: 'national' },
      { tag: 'lav-1', lead_time_days: 5 },
      { tag: 'WC-1', lead_time_days: 14 },
    ]), world()))
    expect(r.counts).toEqual({ add: 1, change: 1, unchanged: 1, held: 0 })
    expect(r.will).toBe('add 1 row, change 1 row')
    expect(r.revision).toMatchObject({ id: REV1, rev: 1, made_by_this_plan: false })
    const writes = r.writes as { make_revision: boolean; inserts: Row[]; patches: Row[] }
    expect(writes.make_revision).toBe(false)
    expect(writes.inserts).toEqual([expect.objectContaining({ tag: 'UR-1', sequence_order: 3, status: 'proposed', submitted_manufacturer: 'Sloan', lead_time_days: 21, supply_house_id: HOUSE2, order_only: false, sheet_pages: [] })])
    expect(writes.patches).toEqual([{ id: 'i-lav', tag: 'LAV-1', patch: { lead_time_days: 5 } }])
    expect((r.rows as Row[]).map((x) => x.action)).toEqual(['add', 'change', 'unchanged'])
  })

  it('makes Rev 1 when the bid has no revision', () => {
    const r = reply(rowsDryRun(rowsP([{ tag: 'WC-1', submitted: { label: 'Toto CST744' } }]), world({ revisions: [], items: [] })))
    expect(r.revision).toMatchObject({ id: null, rev: 1, made_by_this_plan: true })
    expect(r.will).toBe('add 1 row, make Rev 1 as a draft')
    const writes = submittalWrites(r, { userId: DEV })
    expect(writes[0]).toEqual({ kind: 'make_revision', table: 'bid_submittals', body: { bid_id: BID, rev_number: 1, status: 'draft', created_by: DEV } })
    expect(writes[1]).toMatchObject({ kind: 'insert_rows', table: 'bid_submittal_items', body: [expect.objectContaining({ submittal_id: null, tag: 'WC-1', sequence_order: 1 })] })
  })

  it('refuses a revision the GC holds and names the press', () => {
    const dry = rowsDryRun(rowsP([{ tag: 'UR-1' }]), world({ revisions: [rev(REV2, 2, 'shared'), rev(REV1, 1, 'superseded')] }))
    expect(dry).toMatchObject({ ok: false, refused: expect.stringContaining('Rev 2 on B398 is shared with the GC') })
    expect(dry.ok ? '' : dry.refused).toContain('step 7, Resubmit')
  })

  it('holds what it cannot do and goes on with the rest', () => {
    const w = world({
      items: [
        item({ id: 'i-wc', tag: 'WC-1', review_decision: 'approved', reviewed_at: '2026-10-02T00:00:00Z' }),
        item({ id: 'i-lav', tag: 'LAV-1', sequence_order: 2 }),
      ],
      parts: [{ id: 'p1', item_id: 'i-lav', sequence_order: 1 } as never],
    })
    const r = reply(rowsDryRun(rowsP([{ tag: 'WC-1', lead_time_days: 3 }, { tag: 'LAV-1', lead_time_days: 3 }, { tag: 'FD-1', supply_house: 'Ferguson' }, { tag: 'HB-1', specified: { model: 'Woodford 24' }, status: 'proposed' }, { tag: 'EWC-1' }]), w))
    expect(r.counts).toEqual({ add: 1, change: 0, unchanged: 0, held: 4 })
    const held = r.held as Array<{ tag: string; why: string }>
    expect(held.map((h) => h.tag)).toEqual(['WC-1', 'LAV-1', 'FD-1', 'HB-1'])
    expect(held[0]!.why).toContain('the GC answered this row (Approved 10/02)')
    expect(held[1]!.why).toContain('carries 1 part')
    expect(held[2]!.why).toContain('no supply house named "Ferguson"')
    expect(held[3]!.why).toContain('Proposed is for a row the plans named nothing for')
  })

  it('refuses when nothing is ready, with the reasons', () => {
    expect(rowsDryRun(rowsP([{ tag: 'WC-1', lead_time_days: 14 }]), world())).toMatchObject({ ok: false, refused: expect.stringContaining('1 row already reads that way') })
    expect(rowsDryRun(rowsP([{ tag: 'FD-1', supply_house: 'Ferguson' }]), world())).toMatchObject({ ok: false, refused: expect.stringContaining('Held: FD-1 (no supply house named') })
  })

  it('warns on an alternate with no reason', () => {
    const r = reply(rowsDryRun(rowsP([{ tag: 'UR-1', specified: { manufacturer: 'Sloan', model: 'SU-1009' }, submitted: { manufacturer: 'Zurn', model: 'Z5755' } }]), world()))
    expect(r.warnings).toEqual(["UR-1 is Alternate with no reason: the GC's page asks why."])
    const quiet = reply(rowsDryRun(rowsP([{ tag: 'UR-1', specified: { manufacturer: 'Sloan', model: 'SU-1009' }, submitted: { manufacturer: 'Zurn', model: 'Z5755' }, reason_kind: 'in_stock' }]), world()))
    expect(quiet.warnings).toEqual([])
  })

  it('hashes with the world: a row added since changes the plan', async () => {
    const p = rowsP([{ tag: 'UR-1', submitted: { label: 'Sloan SU-1009' } }])
    const a = await planHash('plan_submittal_rows', p, reply(rowsDryRun(p, world())))
    const b = await planHash('apply_submittal_rows', p, reply(rowsDryRun(p, world())))
    const w2 = world()
    w2.items.push(item({ id: 'i-new', tag: 'FD-1', sequence_order: 3 }))
    const c = await planHash('apply_submittal_rows', p, reply(rowsDryRun(p, w2)))
    expect(a).toBe(b)
    expect(c).not.toBe(a)
    expect(planReply('plan_submittal_rows', reply(rowsDryRun(p, world())), a)).toMatchObject({ plan_hash: a, next: expect.stringContaining('apply_submittal_rows') })
  })
})

describe('the board and logDryRun', () => {
  const shared = () =>
    world({
      revisions: [rev(REV1, 1, 'shared')],
      items: [
        item({ id: 'i-wc', tag: 'WC-1', submitted_manufacturer: 'Toto', submitted_model: 'CST744', lead_time_days: 14, supply_house_id: HOUSE, review_decision: 'approved', reviewed_at: '2026-10-02T00:00:00Z' }),
        item({ id: 'i-lav', tag: 'LAV-1', sequence_order: 2, submitted_label: 'Kohler K-2210' }),
      ],
      records: [{ id: 'r-wc', tag: 'WC-1', partKey: null, label: '', leadTimeDays: null, stage: null, orderedOn: null, poRef: '', expectedOn: null, deliveredOn: null, note: '', sortOrder: 0 }],
    })

  it('draws the log the tab draws', async () => {
    const w = shared()
    const board = submittalBoard(w)
    // The same rows through the tab's own door (procurementItemsFrom over a client that answers with the houses).
    const client = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: w.houses, error: null }) }) }) } as never
    const tabSources = await procurementItemsFrom(client, w.items, true, [])
    expect(board.sources).toEqual(tabSources)
    const tabLog = buildProcurementLog({ items: tabSources, records: w.records, tagStage: {}, stageDates: {} })
    expect(board.log).toEqual(tabLog)
    expect(procurementSteps(board.log, board.draftRev).map((s) => [s.label, s.count])).toEqual([['Waiting on the GC', 1], ['To order', 1], ['On order', 0], ['On site', 0]])
  })

  it('keeps a row that stands approved on an earlier revision', () => {
    const w = world({
      revisions: [rev(REV2, 2, 'draft'), rev(REV1, 1, 'shared')],
      items: [
        item({ id: 'i-wc', submittal_id: REV1, tag: 'WC-1', submitted_label: 'Toto CST744', review_decision: 'approved', reviewed_at: '2026-10-02T00:00:00Z' }),
        item({ id: 'i-lav1', submittal_id: REV1, tag: 'LAV-1', sequence_order: 2, submitted_label: 'Kohler K-2210', review_decision: 'rejected', reviewed_at: '2026-10-02T00:00:00Z' }),
        item({ id: 'i-lav2', submittal_id: REV2, tag: 'LAV-1', submitted_label: 'Kohler K-2214' }),
      ],
    })
    const board = submittalBoard(w)
    expect(board.draftRev).toBe(2)
    expect(board.rows.map((r) => r.id)).toEqual(['i-lav2'])
    expect(board.log.map((r) => [r.key, r.status, r.standsOnRev ?? null])).toEqual([['LAV-1', 'not_submitted', null], ['WC-1', 'released', 1]])
  })

  it('writes facts on a line, updating its record or making one, and says where the line will stand', () => {
    const r = reply(logDryRun(logP([{ tag: 'wc-1', ordered_on: '2026-11-03', po_ref: 'PO-7', expected_on: '2026-11-20' }, { line: 'LAV-1', note: 'bought ahead' }]), shared(), TODAY))
    expect(r.counts).toEqual({ write: 2, unchanged: 0, held: 0 })
    // The writes run in the log's own order, tag by tag.
    expect(r.writes).toEqual([
      { line: 'LAV-1', record_id: null, insert: { bid_id: BID, tag: 'LAV-1', sort_order: 1, note: 'bought ahead' } },
      { line: 'WC-1', record_id: 'r-wc', patch: { ordered_on: '2026-11-03', po_ref: 'PO-7', expected_on: '2026-11-20' } },
    ])
    const lines = r.lines as Array<{ line: string; from: string; to: string }>
    expect(lines.find((l) => l.line === 'WC-1')).toMatchObject({ from: expect.stringContaining('To order'), to: expect.stringContaining('On order') })
    expect(r.steps).toEqual({ now: 'Waiting on the GC 1 · To order 1 · On order 0 · On site 0', after: 'Waiting on the GC 1 · To order 0 · On order 1 · On site 0' })
    expect(submittalWrites(r, { userId: DEV })).toEqual([
      { kind: 'insert_line', table: 'bid_procurement_items', body: { bid_id: BID, tag: 'LAV-1', sort_order: 1, note: 'bought ahead' }, what: 'LAV-1' },
      { kind: 'patch_line', table: 'bid_procurement_items', id: 'r-wc', body: { ordered_on: '2026-11-03', po_ref: 'PO-7', expected_on: '2026-11-20' }, what: 'WC-1' },
    ])
  })

  it('marks a part delivered: On site, and warns when the GC has not approved it', () => {
    const r = reply(logDryRun(logP([{ tag: 'LAV-1', ordered_on: '2026-11-01', delivered_on: '2026-11-08' }]), shared(), TODAY))
    expect((r.lines as Array<{ to: string }>)[0]!.to).toContain('On site')
    expect(r.warnings).toEqual([expect.stringContaining('the GC has not approved this part (Waiting on the GC)')])
    expect(r.not_done).toEqual(expect.arrayContaining([expect.stringContaining('puts nothing in a cage or box')]))
  })

  it('holds a day that has not happened, an unknown line, and a tag with several lines', () => {
    const w = shared()
    w.parts = [
      { id: 'p1', item_id: 'i-wc', bid_id: BID, sequence_order: 1, label: 'Toto CST744 bowl', quantity: 1, on_submittal: true, source: 'takeoff', procure_key: 'k-bowl', supply_house_id: null, lead_time_days: null, stage: null, review_decision: null, reviewed_at: null, review_note: null, assembly: null, priced_label: null } as never,
      { id: 'p2', item_id: 'i-wc', bid_id: BID, sequence_order: 2, label: 'Zurn carrier', quantity: 1, on_submittal: false, source: 'takeoff', procure_key: 'k-carrier', supply_house_id: null, lead_time_days: null, stage: null, review_decision: null, reviewed_at: null, review_note: null, assembly: null, priced_label: null } as never,
    ]
    const dry = logDryRun(logP([{ tag: 'WC-1', po_ref: 'PO-9' }, { line: 'part:nope', po_ref: 'x' }, { tag: 'LAV-1', delivered_on: '2026-12-01' }, { tag: 'ZZ-9', note: 'x' }]), w, TODAY)
    expect(dry).toMatchObject({ ok: false })
    const refusal = dry.ok ? '' : dry.refused
    expect(refusal).toContain('pass all_parts: true')
    expect(refusal).toContain('part:k-bowl (Toto CST744 bowl)')
    expect(refusal).toContain('no line on the log has this key')
    expect(refusal).toContain('delivered_on 2026-12-01 is after today (2026-11-09)')
    expect(refusal).toContain('no row on the submittal carries this tag')
    const all = reply(logDryRun(logP([{ tag: 'WC-1', all_parts: true, po_ref: 'PO-9' }]), w, TODAY))
    // The tag's own line holds nothing, so the log draws the two parts alone (a line with dates from before the parts would stay).
    expect((all.writes as Row[]).map((x) => x.line).sort()).toEqual(['part:k-bowl', 'part:k-carrier'])
    expect((all.writes as Row[]).find((x) => x.line === 'part:k-bowl')).toMatchObject({ record_id: null, insert: { bid_id: BID, tag: 'WC-1', part_key: 'k-bowl', po_ref: 'PO-9' } })
  })

  it('refuses when every line already reads that way, and a bid with no log', () => {
    const w = shared()
    w.records[0]!.orderedOn = '2026-11-03'
    expect(logDryRun(logP([{ tag: 'WC-1', ordered_on: '2026-11-03' }]), w, TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('1 line already reads that way') })
    expect(logDryRun(logP([{ tag: 'WC-1', ordered_on: '2026-11-03' }]), world({ revisions: [], items: [] }), TODAY)).toMatchObject({ ok: false, refused: expect.stringContaining('has no line on its order log') })
  })

  it('a second plan after the write is not the first plan', async () => {
    const p = logP([{ tag: 'WC-1', ordered_on: '2026-11-03' }])
    const before = await planHash('plan_submittal_log', p, reply(logDryRun(p, shared(), TODAY)))
    const w = shared()
    w.records[0]!.poRef = 'PO-1'
    const after = await planHash('apply_submittal_log', p, reply(logDryRun(p, w, TODAY)))
    expect(after).toBe(before) // a PO typed beside it does not change what this plan writes or where the line stands
    w.records[0]!.deliveredOn = '2026-11-05'
    expect(await planHash('apply_submittal_log', p, reply(logDryRun(p, w, TODAY)))).not.toBe(before)
  })
})

describe('the read', () => {
  const EXTRAS: SubmittalExtras = { room: { status: 'open', shared_at: '2026-10-01T15:00:00Z', closed_at: null }, people: [{ name: 'Dana Whitfield', role: 'architect', may_decide: true, open_count: 3, last_seen_at: '2026-10-02T00:00:00Z', closed_at: null }], updates: [], onSite: { liveBoxes: 0, deliveredRows: 0, capped: false } }

  it('says where the revision, the rows and the log stand', () => {
    const w = world({
      job: { id: JOB, label: 'JP1113', name: 'ZZ Test Walk' },
      revisions: [rev(REV1, 1, 'shared')],
      items: [
        item({ id: 'i-wc', tag: 'WC-1', submitted_manufacturer: 'Toto', submitted_model: 'CST744', supply_house_id: HOUSE, review_decision: 'approved', reviewed_at: '2026-10-02T00:00:00Z', reviewed_by_name: 'Dana Whitfield', sheet_pages: [2, 3] }),
        item({ id: 'i-lav', tag: 'LAV-1', sequence_order: 2, status: 'alternate', reason_kind: 'lead_time', reason_note: '12 weeks', submitted_label: 'Kohler K-2210', review_decision: 'rejected', reviewed_at: '2026-10-02T00:00:00Z' }),
        item({ id: 'i-fd', tag: 'FD-1', sequence_order: 3, submitted_label: 'Zurn Z415' }),
      ],
      records: [{ id: 'r-wc', tag: 'WC-1', partKey: null, label: '', leadTimeDays: null, stage: null, orderedOn: '2026-10-20', poRef: 'PO-7', expectedOn: null, deliveredOn: '2026-11-01', note: '', sortOrder: 0 }],
    })
    const out = submittalsReply(w, EXTRAS, TODAY)
    expect(out.stands).toBe('Rev 1 · shared with the GC · 3 rows · 1 approved, 1 sent back, 1 not answered')
    expect(revisionLine(w.revisions[0]!, w.items)).toBe(out.stands)
    expect(out.working_revision).toMatchObject({ rev: 1, takes_rows: false })
    const rows = out.rows as Row[]
    expect(rows[0]).toMatchObject({ tag: 'WC-1', submitted: 'Toto CST744', supply_house: 'Moore Supply', cut_sheet_pages: 2, their_answer: { answer: 'Approved', by: 'Dana Whitfield', on: '2026-10-02' } })
    expect(rows[1]).toMatchObject({ status_words: 'Alternate: a stand-in for what the plans named, say why', reason: 'Lead time · 12 weeks' })
    const log = out.order_log as { steps: Array<{ step: string; parts: number }>; lines: Row[]; next: string }
    expect(log.steps.map((s) => [s.step, s.parts])).toEqual([['Waiting on the GC', 2], ['To order', 0], ['On order', 0], ['On site', 1]])
    expect(log.lines.find((l) => l.line === 'WC-1')).toMatchObject({ step: 'On site', delivered_on: '2026-11-01', po_ref: 'PO-7', status: expect.stringContaining('On site 11/01') })
    expect(out.delivered).toMatchObject({ marked_on_the_log: 1, materials_on_site: { live_boxes: 0, delivered_rows: 0 } })
    expect(out.room).toMatchObject({ status: 'open', people: [{ name: 'Dana Whitfield', open_count: 3 }] })
    const text = out.status_text as string
    expect(text.split('\n')[0]).toBe('B398 ZZ Test — submittals as of 11/09')
    expect(text).toContain('Waiting on the GC 2 (1 sent back) · To order 0 (nothing approved yet) · On order 0 · On site 1 (last 11/01)')
    expect(text).toContain('- WC-1 · Toto CST744: On site, ✓ On site 11/01')
    expect(statusText(w, submittalBoard(w), TODAY)).toBe(text)
  })

  it('a bid with no submittal says so, and a draft says nobody was sent it', () => {
    const none = submittalsReply(world({ revisions: [], items: [] }), { room: null, people: [], updates: [], onSite: null }, TODAY)
    expect(none.stands).toBe('No submittal has been started on this bid.')
    expect(none.working_revision).toMatchObject({ rev: null, takes_rows: true })
    expect(none.delivered).toMatchObject({ materials_on_site: 'the bid is not a job yet' })
    expect(submittalsReply(world(), { room: null, people: [], updates: [], onSite: null }, TODAY).status_text).toContain('The GC has not been sent this revision.')
  })

  it('reads the world through the door and resolves the bid by text', async () => {
    const tables: Record<string, Row[]> = {
      bids: [{ id: BID, bid_number: '398', project_name: 'ZZ Test', service_type_id: 's1' }],
      service_types: [{ id: 's1', ledger_job_prefix: 'JP', ledger_bid_prefix: 'BP' }],
      jobs_ledger: [{ id: JOB, hcp_number: '', click_number: '1113', job_name: 'ZZ Test Walk', service_type_id: 's1', bid_id: BID, created_at: '2026-11-08T00:00:00Z' }],
      bid_submittals: [{ id: REV1, bid_id: BID, rev_number: 1, status: 'draft', title: 'Plumbing fixtures & equipment', created_at: '2026-09-29T00:00:00Z' }],
      bid_submittal_items: [{ id: 'i-wc', submittal_id: REV1, tag: 'WC-1', sequence_order: 1, status: 'proposed', submitted_label: 'Toto CST744', supply_house_id: HOUSE, order_only: false, sheet_pages: [] }],
      bid_submittal_item_parts: [],
      bid_procurement_items: [{ id: 'r-wc', bid_id: BID, tag: 'WC-1', part_key: null, label: '', po_ref: 'PO-7', note: '', ordered_on: '2026-11-01', sort_order: 0, created_at: '2026-11-01T00:00:00Z' }],
      supply_houses: [{ id: HOUSE, name: 'Moore Supply', default_lead_time_days: 10 }],
      bids_count_rows: [],
      bid_takeoff_stage_splits: [],
      jobs_ledger_fixtures: [{ id: 'f1', job_id: JOB, name: 'Order rough-in', stage_kind: 'order' }],
      job_stage_windows: [{ job_id: JOB, fixture_id: 'f1', window_start: '2026-12-01' }],
      bid_submittal_rooms: [],
      bid_procurement_updates: [],
      job_containers: [{ id: 'c1', job_id: JOB, retired_at: null }],
      job_material_movements: [{ id: 'm1', job_id: JOB, reason: 'delivered' }],
    }
    const asked: string[] = []
    const reader: Reader = {
      rpc: async (name) => {
        asked.push(`rpc:${name}`)
        return [{ id: BID, bid_number: '398', project_name: 'ZZ Test', service_type_id: 's1' }]
      },
      rows: async (table: string, q: RowsQuery) => {
        asked.push(table)
        let rows = tables[table]
        if (!rows) throw new Error(`"${table}" is not a readable table`)
        for (const f of q.filters ?? []) {
          rows = rows.filter((r) => (f.op === 'eq' ? r[f.column] === f.value : f.op === 'in' ? (f.value as unknown[]).includes(r[f.column]) : f.op === 'gt' ? String(r[f.column]) > String(f.value) : true))
        }
        return rows
      },
    }
    const w = await readSubmittalWorld(reader, 'b398')
    if ('refused' in w) throw new Error(w.refused)
    expect(asked[0]).toBe('rpc:search_bids_for_clock')
    expect(w.bid).toEqual({ id: BID, label: 'BP398', projectName: 'ZZ Test' })
    expect(w.job).toEqual({ id: JOB, label: 'JP1113', name: 'ZZ Test Walk' })
    expect(w.stageDates).toEqual({ rough_in: '2026-12-01' })
    expect(w.records).toEqual([expect.objectContaining({ id: 'r-wc', tag: 'WC-1', orderedOn: '2026-11-01', poRef: 'PO-7' })])
    const out = await getSubmittals(reader, BID, TODAY)
    expect(out).toMatchObject({ stands: 'Rev 1 · draft · 1 row · 1 not answered', delivered: { marked_on_the_log: 0, materials_on_site: { live_boxes: 1, delivered_rows: 1 } } })
    expect((out as { order_log: { lines: Row[] } }).order_log.lines[0]).toMatchObject({ line: 'WC-1', supply_house: 'Moore Supply', lead_time_days: 10, ordered_on: '2026-11-01' })
    expect(await readSubmittalWorld({ ...reader, rpc: async () => [] }, 'b999')).toEqual({ refused: 'No bid matches "b999".' })
  })
})

describe('the apply words', () => {
  it('names what landed, what failed, and the read', () => {
    const r = reply(rowsDryRun(rowsP([{ tag: 'UR-1', submitted: { label: 'Sloan SU-1009' } }]), world()))
    expect(submittalAppliedWords(r, { landed: ['1 row added: UR-1'], failed: [], revisionId: REV1 })).toEqual({ bid_id: BID, label: 'B398', revision_id: REV1, landed: ['1 row added: UR-1'], next: 'get_submittals { bid: "B398" } reads it back as Bids → Submittals draws it.' })
    expect(submittalAppliedWords(r, { landed: [], failed: [{ what: 'UR-1', why: 'refused' }], revisionId: REV1 })).toMatchObject({ failed: [{ what: 'UR-1', why: 'refused' }], note: expect.stringContaining('what landed stays') })
  })
})
