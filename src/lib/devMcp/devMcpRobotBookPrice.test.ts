import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  ROBOT_BOOK_BIDS_LIMIT,
  ROBOT_BOOK_ENTRIES_MAX,
  ROBOT_BOOK_LOG_LINE_MAX,
  ROBOT_BOOK_RUNS_LIMIT,
  ROBOT_BOOK_USES_LIMIT,
  isRobotBookPriceVerb,
  readRobotBookWorld,
  robotBookAfter,
  robotBookAppliedWords,
  robotBookLogLine,
  robotBookMatches,
  robotBookPriceDryRun,
  robotBookPriceInput,
  robotBookPricePatch,
  robotBookPricePatchQuery,
  robotBookStepWords,
  type RobotBookChange,
  type RobotBookEntryRow,
  type RobotBookPricePayload,
  type RobotBookReads,
  type RobotBookStep,
  type RobotBookWorld,
} from '../../../supabase/functions/_shared/devMcpRobotBookPrice'
import { WRITE_VERBS, alreadyApplied, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { SHADOW_RUNS_COLUMNS } from '../../../supabase/functions/_shared/devMcpShadowRuns'
import { resolvePricingWriteTarget } from '../bids/pricingWriteTarget'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const PRICING_TAB = readFileSync('src/components/bids/BidsPricingTab.tsx', 'utf8')
const TWIN_SEAT = readFileSync('supabase/functions/twin-mcp/index.ts', 'utf8')

// A made-up book: no real price, bid or name.
const BOOK = 'bbbbbbbb-0000-4000-8000-000000000001'
const TRADE = 'cccccccc-0000-4000-8000-000000000001'
const eid = (n: number) => `eeeeeeee-0000-4000-8000-00000000000${n}`
const bidId = (n: number) => `dddddddd-0000-4000-8000-00000000000${n}`
const entry = (n: number, name: string, total: number, over: Partial<RobotBookEntryRow> = {}): RobotBookEntryRow => ({ id: eid(n), fixture_type_id: `ffffffff-0000-4000-8000-00000000000${n}`, name, total_price: total, rough_in_price: total, top_out_price: 0, trim_set_price: 0, ...over })
const ENTRIES = [
  entry(1, 'Water closet', 850),
  entry(2, 'Lavatory', 600),
  entry(3, 'Floor drain', 400, { rough_in_price: 250, top_out_price: 100, trim_set_price: 50 }),
  entry(4, 'Hose bibb', 300, { rough_in_price: 0 }),
  entry(5, 'Mop sink', 900),
  entry(6, 'mop sink', 950),
]
const use = (b: number, e: number, override: number | null = null) => ({ bid_id: bidId(b), price_book_entry_id: eid(e), unit_price_override: override })
const world = (over: Partial<RobotBookWorld> = {}): RobotBookWorld => ({ books: [{ id: BOOK, name: '🤖 Robot Default', service_type_id: TRADE }], tradeName: 'Plumbing', entries: ENTRIES, uses: [], bids: [], runs: [], ...over })
const p = (entries: Array<Record<string, unknown>>, over: Record<string, unknown> = {}): RobotBookPricePayload => {
  const built = robotBookPriceInput('plan_robot_book_price', { prices: { service_type_id: TRADE, reason: 'Mirrored from the supplier sheet of 11 Nov', entries, ...over } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
const plan = (entries: Array<Record<string, unknown>>, w: Partial<RobotBookWorld> = {}) => {
  const dry = robotBookPriceDryRun(p(entries), world(w))
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply as { book: Record<string, unknown>; changes: RobotBookChange[]; unchanged: string[]; held: Array<{ asked: string; why: string }>; reach: Record<string, unknown> | null; warnings: string[]; then: string }
}
const refusal = (entries: Array<Record<string, unknown>>, w: Partial<RobotBookWorld> = {}): string => {
  const dry = robotBookPriceDryRun(p(entries), world(w))
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('a robot book’s price from the dev seat (v2.7939)', () => {
  it('is two write verbs on the allowlist with no wrapper RPC', () => {
    expect(WRITE_VERBS.plan_robot_book_price).toEqual({ rpc: null, step: 'plan' })
    expect(WRITE_VERBS.apply_robot_book_price).toEqual({ rpc: null, step: 'apply' })
    expect(isRobotBookPriceVerb('apply_robot_book_price')).toBe(true)
    expect(isRobotBookPriceVerb('plan_bid_pricing')).toBe(false)
    expect(planVerbFor('apply_robot_book_price')).toBe('plan_robot_book_price')
  })

  it('takes one book, a reason and up to twenty entries, each named once with a price', () => {
    expect(p([{ name: '  Water closet ', price: 900.456 }, { entry_id: eid(3).toUpperCase(), price: 450, rough_in: 300, top_out: 100, trim_set: 50 }])).toEqual({
      service_type_id: TRADE,
      reason: 'Mirrored from the supplier sheet of 11 Nov',
      entries: [{ name: 'Water closet', price: 900.46 }, { entry_id: eid(3), price: 450, stages: { rough_in: 300, top_out: 100, trim_set: 50 } }],
    })
    const bad = (prices: Record<string, unknown>): string => {
      const built = robotBookPriceInput('plan_robot_book_price', { prices })
      if (built.ok) throw new Error('expected a refusal')
      return built.error
    }
    const one = [{ name: 'Water closet', price: 900 }]
    const reason = 'Mirrored from the supplier sheet'
    expect(bad({ reason, entries: one })).toContain('plan_robot_book_price needs prices — { one of: service_type_id')
    expect(bad({ service_type_id: TRADE, version_id: BOOK, reason, entries: one })).toContain('needs prices')
    expect(bad({ service_type_id: 'plumbing', reason, entries: one })).toContain('needs prices')
    expect(bad({ service_type_id: TRADE, reason: 'typo', entries: one })).toContain('reason says where the prices come from')
    expect(bad({ service_type_id: TRADE, reason, entries: [] })).toContain('needs prices')
    expect(bad({ service_type_id: TRADE, reason, entries: Array.from({ length: ROBOT_BOOK_ENTRIES_MAX + 1 }, (_, i) => ({ name: `F${i}`, price: 1 })) })).toContain('20 entries a call at most, and this one names 21.')
    expect(bad({ service_type_id: TRADE, reason, entries: [{ name: 'Water closet', entry_id: eid(1), price: 900 }] })).toContain('names its entry once')
    expect(bad({ service_type_id: TRADE, reason, entries: [{ price: 900 }] })).toContain('names its entry once')
    expect(bad({ service_type_id: TRADE, reason, entries: [{ name: 'Water closet', price: 900 }, { name: 'water closet ', price: 950 }] })).toContain('a second time')
    for (const price of [0, -5, '900', null, 1_000_000]) expect(bad({ service_type_id: TRADE, reason, entries: [{ name: 'Water closet', price }] })).toContain('price is dollars, a number above 0')
    expect(bad({ service_type_id: TRADE, reason, entries: [{ name: 'Floor drain', price: 450, rough_in: 300 }] })).toContain('all three or none')
    expect(bad({ service_type_id: TRADE, reason, entries: [{ name: 'Floor drain', price: 450, rough_in: 300, top_out: -1, trim_set: 0 }] })).toContain('top_out is dollars, 0 or more')
    expect(bad({ service_type_id: TRADE, reason, entries: [{ name: 'Water closet', price: 900, fixture_type_id: 'x' }] })).toContain('not fixture_type_id')
    expect(bad({ service_type_id: TRADE, reason, entries: one, bid_id: 'x' })).toContain('not bid_id')
    const built = writeRpcBody('apply_robot_book_price', { prices: { version_id: BOOK, reason, entries: one }, plan_hash: 'c'.repeat(64) })
    expect(built).toMatchObject({ ok: true, rpc: null, step: 'apply', body: { p: { version_id: BOOK, entries: [{ name: 'Water closet', price: 900 }] } }, dryRunBody: null, target: BOOK, planHash: 'c'.repeat(64) })
  })

  it('reads the book, its entries, the rows that read the named entries and the bids those are on', async () => {
    const asked: string[] = []
    const reads = (refuseUses = false, refuseRuns = false): RobotBookReads => ({
      rows: (table, query) => {
        asked.push(`${table}?${query}`)
        if (table === 'price_book_versions') return Promise.resolve([{ id: BOOK, name: '🤖 Robot Default', service_type_id: TRADE }])
        if (table === 'service_types') return Promise.resolve([{ id: TRADE, name: 'Plumbing' }])
        if (table === 'price_book_entries') return Promise.resolve([{ id: eid(1), fixture_type_id: 'f1', total_price: '850.00', rough_in_price: 850, top_out_price: 0, trim_set_price: 0, fixture_types: { name: ' Water closet ' } }, { id: eid(2), fixture_type_id: 'f2', total_price: 600, rough_in_price: 600, top_out_price: 0, trim_set_price: 0, fixture_types: null }])
        if (table === 'bid_pricing_assignments') return refuseUses ? Promise.reject(new Error('403')) : Promise.resolve([{ bid_id: bidId(1), price_book_entry_id: eid(1), unit_price_override: null }, { bid_id: bidId(2), price_book_entry_id: eid(1), unit_price_override: '700' }])
        if (table === 'bids') return Promise.resolve([{ id: bidId(1), bid_number: '9001', project_name: 'ZZ Shadow one', bid_date_sent: null, outcome: null }])
        if (table === 'rpc/list_shadow_runs') return refuseRuns ? Promise.reject(new Error('403')) : Promise.resolve([{ shadow_bid_number: '9001', status: 'locked' }])
        return Promise.resolve([])
      },
    })
    const w = await readRobotBookWorld(reads(), p([{ name: 'water closet', price: 900 }, { name: 'Bidet', price: 500 }]))
    expect(asked).toEqual([
      `price_book_versions?select=id,name,service_type_id&is_robot=is.true&bid_id=is.null&service_type_id=eq.${TRADE}&order=created_at.asc&limit=5`,
      `service_types?select=id,name&id=eq.${TRADE}&limit=1`,
      `price_book_entries?select=id,fixture_type_id,total_price,rough_in_price,top_out_price,trim_set_price,fixture_types(name)&version_id=eq.${BOOK}&order=sequence_order.asc&limit=1000`,
      `bid_pricing_assignments?select=bid_id,price_book_entry_id,unit_price_override&price_book_entry_id=in.(${eid(1)})&order=bid_id.asc&limit=${ROBOT_BOOK_USES_LIMIT}`,
      // Only the bid whose row carries no price of its own is looked up: the other is not reached.
      `bids?select=id,bid_number,project_name,bid_date_sent,outcome&id=in.(${bidId(1)})&limit=${ROBOT_BOOK_BIDS_LIMIT}`,
      // The runs through the staff RPC, every locked or scored one: the table itself answers a signed-in person no rows.
      `rpc/list_shadow_runs?select=shadow_bid_number,status&status=in.(locked,scored)&limit=${ROBOT_BOOK_RUNS_LIMIT}`,
    ])
    expect(w.tradeName).toBe('Plumbing')
    expect(w.entries[0]).toEqual({ id: eid(1), fixture_type_id: 'f1', name: 'Water closet', total_price: 850, rough_in_price: 850, top_out_price: 0, trim_set_price: 0 })
    expect(w.uses).toEqual([{ bid_id: bidId(1), price_book_entry_id: eid(1), unit_price_override: null }, { bid_id: bidId(2), price_book_entry_id: eid(1), unit_price_override: 700 }])
    expect(w.runs).toEqual([{ shadow_bid_number: '9001', status: 'locked' }])
    // A refused read of the runs is null, never an empty list.
    expect((await readRobotBookWorld(reads(false, true), p([{ name: 'water closet', price: 900 }]))).runs).toBeNull()
    // By the book's own id, and a refused read of the rows leaves the reach unknown, never empty.
    asked.length = 0
    const byId = await readRobotBookWorld(reads(true), p([{ entry_id: eid(1), price: 900 }], { service_type_id: undefined, version_id: BOOK }))
    expect(asked[0]).toBe(`price_book_versions?select=id,name,service_type_id&is_robot=is.true&bid_id=is.null&id=eq.${BOOK}&order=created_at.asc&limit=5`)
    expect(byId.uses).toBeNull()
    // No entry found: nothing past the book is asked.
    asked.length = 0
    await readRobotBookWorld(reads(), p([{ name: 'Bidet', price: 500 }]))
    expect(asked).toHaveLength(3)
    // The columns are the tables' own.
    const cols = (t: string) => Object.keys(CATALOG_TABLES[t]?.columns ?? {})
    expect(cols('price_book_versions')).toEqual(expect.arrayContaining(['id', 'name', 'service_type_id', 'is_robot', 'bid_id', 'created_at']))
    expect(cols('price_book_entries')).toEqual(expect.arrayContaining(['id', 'version_id', 'fixture_type_id', 'total_price', 'rough_in_price', 'top_out_price', 'trim_set_price', 'sequence_order']))
    expect(cols('bid_pricing_assignments')).toEqual(expect.arrayContaining(['bid_id', 'price_book_entry_id', 'unit_price_override']))
    for (const c of ['shadow_bid_number', 'status']) expect(SHADOW_RUNS_COLUMNS as readonly string[], c).toContain(c) // devMcpShadowRuns.test.ts holds those to the RPC's answer
  })

  it('finds an entry by its name whatever its case or padding, or by its id', () => {
    expect(robotBookMatches({ name: ' water CLOSET', price: 1 }, ENTRIES).map((e) => e.id)).toEqual([eid(1)])
    expect(robotBookMatches({ entry_id: eid(2), price: 1 }, ENTRIES).map((e) => e.id)).toEqual([eid(2)])
    expect(robotBookMatches({ name: 'Mop sink', price: 1 }, ENTRIES).map((e) => e.id)).toEqual([eid(5), eid(6)])
    expect(robotBookMatches({ name: 'Bidet', price: 1 }, ENTRIES)).toEqual([])
  })

  it('keeps an entry’s shape: rough-in follows a whole price, none stay none, and a split waits for its stages', () => {
    const whole = { total_price: 850, rough_in_price: 850, top_out_price: 0, trim_set_price: 0 }
    expect(robotBookAfter(whole, { name: 'x', price: 900 })).toEqual({ total_price: 900, rough_in_price: 900, top_out_price: 0, trim_set_price: 0 })
    expect(robotBookAfter({ total_price: 300, rough_in_price: 0, top_out_price: 0, trim_set_price: 0 }, { name: 'x', price: 350 })).toEqual({ total_price: 350, rough_in_price: 0, top_out_price: 0, trim_set_price: 0 })
    const split = { total_price: 400, rough_in_price: 250, top_out_price: 100, trim_set_price: 50 }
    expect(robotBookAfter(split, { name: 'x', price: 450 })).toBeNull()
    expect(robotBookAfter(split, { name: 'x', price: 450, stages: { rough_in: 300, top_out: 100, trim_set: 50 } })).toEqual({ total_price: 450, rough_in_price: 300, top_out_price: 100, trim_set_price: 50 })
    // extend_robot_book is where the whole-in-rough-in shape comes from.
    expect(TWIN_SEAT).toContain('total_price: entry.price, rough_in_price: entry.price, top_out_price: 0, trim_set_price: 0,')
  })

  it('plans each entry before → after and says no bid moves when no row reads them', () => {
    const reply = plan([{ name: 'Water closet', price: 900 }, { name: 'Hose bibb', price: 350 }])
    expect(reply.book).toEqual({ version_id: BOOK, name: '🤖 Robot Default', service_type_id: TRADE, trade: 'Plumbing', entries: 6 })
    expect(reply.changes).toEqual([
      { entry_id: eid(1), name: 'Water closet', before: { total_price: 850, rough_in_price: 850, top_out_price: 0, trim_set_price: 0 }, after: { total_price: 900, rough_in_price: 900, top_out_price: 0, trim_set_price: 0 }, reads_it: { rows: 0, bids: 0, own_price_rows: 0 } },
      { entry_id: eid(4), name: 'Hose bibb', before: { total_price: 300, rough_in_price: 0, top_out_price: 0, trim_set_price: 0 }, after: { total_price: 350, rough_in_price: 0, top_out_price: 0, trim_set_price: 0 }, reads_it: { rows: 0, bids: 0, own_price_rows: 0 } },
    ])
    expect(reply.reach).toEqual({ rows: 0, bids: 0, sent_bids: 0, locked_robot_bids: 0, at_least: false })
    expect(reply.warnings).toEqual([])
    expect(reply.then).toContain('apply writes those 2 prices on each entry\'s own row as you, as saving the entry on the Pricing tab\'s book panel does')
    expect(reply.then).toContain('A robot book is never copied into a bid, so a row assigned to an entry reads it live.')
    expect(reply.then).toContain('No count row reads them today, so no bid moves')
    expect(reply.then).toContain('the way back is this pair with the before prices')
    // The panel's own write, and the rule that a robot book is never cloned.
    expect(PRICING_TAB).toContain('.update({ fixture_type_id: fixtureTypeId, rough_in_price: rough, top_out_price: top, trim_set_price: trim, total_price: total })')
    expect(resolvePricingWriteTarget({ selectedPricingVersionId: BOOK, bidPricings: [], templates: [{ id: BOOK, name: '🤖 Robot Default', is_robot: true }] })).toEqual({ kind: 'robot', versionId: BOOK })
  })

  it('counts the rows and bids that read an entry live, and warns by name of a sent bid and a locked robot bid', () => {
    const reply = plan([{ name: 'Water closet', price: 900 }], {
      uses: [use(1, 1), use(1, 1), use(2, 1), use(3, 1, 700), use(4, 2)],
      bids: [
        { id: bidId(1), bid_number: '9001', project_name: 'ZZ Shadow one', bid_date_sent: null, outcome: null },
        { id: bidId(2), bid_number: '9002', project_name: 'Made-up office', bid_date_sent: '2026-11-01', outcome: null },
      ],
      runs: [{ shadow_bid_number: '9001', status: 'locked' }, { shadow_bid_number: '7777', status: 'scored' }],
    })
    expect(reply.changes[0]!.reads_it).toEqual({ rows: 3, bids: 2, own_price_rows: 1 })
    expect(reply.reach).toEqual({ rows: 3, bids: 2, sent_bids: 1, locked_robot_bids: 1, at_least: false })
    expect(reply.warnings).toEqual([
      '1 sent bid reads these entries live and would show a new number on the grid, where the paper that went out keeps the old one: b9002 Made-up office.',
      "1 robot bid with a locked or scored run reads these entries. The locked total on the run stays as it was locked; the bid's own grid would read the new price, so the two part: b9001 ZZ Shadow one.",
    ])
    expect(reply.then).toContain('3 count rows on 2 bids read them with no price of their own and would read the new price at once. A row with its own unit price is not reached.')
  })

  it('says so when the robots’ runs could not be read, and never counts that as none', () => {
    const w = {
      uses: [use(1, 1)],
      bids: [{ id: bidId(1), bid_number: '9001', project_name: 'ZZ Shadow one', bid_date_sent: null, outcome: null }],
    }
    const blind = plan([{ name: 'Water closet', price: 900 }], { ...w, runs: null })
    expect(blind.reach).toEqual({ rows: 1, bids: 1, sent_bids: 0, locked_robot_bids: null, at_least: false })
    expect(blind.warnings).toEqual(["The robots' runs could not be read, so the locked and scored robot bids among these are not counted. The Robots board lists them."])
    // Read and empty is a real none, and a bid number is matched whatever type the row carries it as.
    expect(plan([{ name: 'Water closet', price: 900 }], { ...w, runs: [] }).reach).toMatchObject({ locked_robot_bids: 0 })
    expect(plan([{ name: 'Water closet', price: 900 }], { ...w, runs: [{ shadow_bid_number: ' 9001 ', status: 'scored' }] }).reach).toMatchObject({ locked_robot_bids: 1 })
  })

  it('says so when the rows could not be read, when the read stopped at its limit, and when a bid could not be named', () => {
    const blind = plan([{ name: 'Water closet', price: 900 }], { uses: null })
    expect(blind.reach).toBeNull()
    expect(blind.changes[0]!.reads_it).toBeNull()
    expect(blind.warnings[0]).toContain('could not be read, so which bids move is not known')
    const full = plan([{ name: 'Water closet', price: 900 }], { uses: Array.from({ length: ROBOT_BOOK_USES_LIMIT }, () => use(1, 1)), bids: [] })
    expect(full.reach).toMatchObject({ rows: 1000, bids: 1, at_least: true })
    expect(full.warnings).toEqual(['The read of the rows stopped at 1000, so every count here is at least that many.', '1 of the 1 bids could not be read by name, so the sent and locked counts cover the 0 that could.'])
    expect(full.then).toContain('At least 1000 count rows on 1 bid')
  })

  it('holds what it cannot place and goes on with the rest: an unknown name, a shared name, a split, an entry named twice', () => {
    const reply = plan([{ name: 'Bidet', price: 500 }, { name: 'Mop sink', price: 975 }, { name: 'Floor drain', price: 450 }, { name: 'Water closet', price: 900 }, { entry_id: eid(1), price: 910 }, { name: 'Lavatory', price: 600 }])
    expect(reply.changes.map((c) => c.name)).toEqual(['Water closet'])
    expect(reply.unchanged).toEqual(['Lavatory'])
    expect(reply.held).toEqual([
      { asked: '"Bidet"', why: "no entry of this book has that name: the twin seat's extend_robot_book adds one, and its get_robot_book lists the names that stand" },
      { asked: '"Mop sink"', why: `2 entries of this book carry that name: name one by entry_id (${eid(5)}, ${eid(6)})` },
      { asked: '"Floor drain"', why: 'its stages are split (rough-in $250.00, top-out $100.00, trim $50.00): give rough_in, top_out and trim_set with the price' },
      { asked: eid(1), why: '"Water closet" is named twice in this plan, once by its name and once by its id' },
    ])
    expect(reply.warnings[reply.warnings.length - 1]).toContain('4 of 6 asked are held and not in this plan.')
    // The split goes through once its stages are given, and a shared name by its id.
    expect(plan([{ name: 'Floor drain', price: 450, rough_in: 300, top_out: 100, trim_set: 50 }, { entry_id: eid(6), price: 975 }]).changes.map((c) => [c.name, c.after.total_price])).toEqual([['Floor drain', 450], ['mop sink', 975]])
  })

  it('refuses in words: no robot book, two books for one trade, and a plan that changes nothing', () => {
    expect(refusal([{ name: 'Water closet', price: 900 }], { books: [] })).toContain(`No 🤖 robot price book reads as service type ${TRADE}.`)
    expect(refusal([{ name: 'Water closet', price: 900 }], { books: [{ id: BOOK, name: 'A', service_type_id: TRADE }, { id: eid(9), name: 'B', service_type_id: TRADE }] })).toContain('2 robot price books read as service type')
    expect(refusal([{ name: 'Water closet', price: 850 }])).toBe('Nothing to apply on 🤖 Robot Default (Plumbing): "Water closet" already reads that way.')
    expect(refusal([{ name: 'Bidet', price: 500 }])).toContain('Nothing to apply on 🤖 Robot Default (Plumbing): no entry would change. Held: "Bidet" (no entry of this book has that name')
  })

  it('the plan commits to the prices that stand and to the rows that read them', async () => {
    const payload = p([{ name: 'Water closet', price: 900 }])
    const a = robotBookPriceDryRun(payload, world({ uses: [use(1, 1)] }))
    const same = robotBookPriceDryRun(payload, world({ uses: [use(1, 1)] }))
    const repriced = robotBookPriceDryRun(payload, world({ uses: [use(1, 1)], entries: ENTRIES.map((e) => (e.id === eid(1) ? { ...e, total_price: 860, rough_in_price: 860 } : e)) }))
    const assigned = robotBookPriceDryRun(payload, world({ uses: [use(1, 1), use(2, 1)] }))
    if (!a.ok || !same.ok || !repriced.ok || !assigned.ok) throw new Error('expected plans')
    const hash = await planHash('plan_robot_book_price', payload, a.reply)
    expect(await planHash('apply_robot_book_price', payload, same.reply)).toBe(hash)
    expect(await planHash('apply_robot_book_price', payload, repriced.reply)).not.toBe(hash)
    expect(await planHash('apply_robot_book_price', payload, assigned.reply)).not.toBe(hash)
    expect(await planHash('plan_robot_book_price', p([{ name: 'Water closet', price: 900 }], { reason: 'Another reason entirely' }), a.reply)).not.toBe(hash)
  })

  it('the write is the panel’s prices on the entry’s own row, and the log line carries each price before and after', () => {
    const change = plan([{ name: 'Water closet', price: 900 }]).changes[0]!
    expect(robotBookPricePatch(change.after)).toEqual({ total_price: 900, rough_in_price: 900, top_out_price: 0, trim_set_price: 0 })
    expect(Object.keys(robotBookPricePatch(change.after))).not.toContain('fixture_type_id') // the fixture is left as it is
    expect(robotBookPricePatchQuery({ id: BOOK }, change)).toBe(`id=eq.${eid(1)}&version_id=eq.${BOOK}`)
    expect(robotBookStepWords(change)).toBe('$850.00 → $900.00')
    const book = { id: BOOK, name: '🤖 Robot Default', service_type_id: TRADE }
    expect(robotBookLogLine(book, [change])).toBe(`${BOOK} 🤖 Robot Default · "Water closet" 850 → 900`)
    const many = Array.from({ length: 60 }, (_, i) => ({ ...change, name: `Fixture number ${i} with a long name` }))
    const line = robotBookLogLine(book, many)
    expect(line.length).toBeLessThanOrEqual(ROBOT_BOOK_LOG_LINE_MAX)
    expect(line).toMatch(/ · and \d+ more$/)
    const steps: RobotBookStep[] = [
      { entry_id: eid(1), name: 'Water closet', ok: true, words: '$850.00 → $900.00' },
      { entry_id: eid(2), name: 'Lavatory', ok: false, words: 'no row changed: the entry left the book a moment ago, or RLS let no row through' },
    ]
    expect(robotBookAppliedWords(steps, book)).toBe('Priced 1 entry on 🤖 Robot Default: "Water closet" $850.00 → $900.00. Held: "Lavatory" (no row changed: the entry left the book a moment ago, or RLS let no row through). Plan again for an entry still to change. Every row that reads an entry with no price of its own reads the new one now. The twin seat\'s get_robot_book lists the book as it stands.')
    expect(robotBookAppliedWords([steps[1]!], book)).toContain('Nothing priced on 🤖 Robot Default.')
    expect(alreadyApplied('apply_robot_book_price', { target: BOOK, at: null })).toContain('Nothing written: this plan was already applied')
  })

  it('the server declares the pair, writes entries alone, and the docs carry the door', () => {
    for (const verb of ['plan_robot_book_price', 'apply_robot_book_price']) {
      expect(SERVER).toContain(`name: '${verb}'`)
      expect(SERVER).toContain(`case '${verb}':`)
    }
    const from = SERVER.indexOf("case 'plan_robot_book_price':")
    const branch = SERVER.slice(from, SERVER.indexOf("case 'plan_price_matrix_request':", from))
    expect(branch).toContain("if (who.role !== 'dev') return refused(`${name} writes, and only a dev's own key may write.`)")
    expect(branch).toContain('world = await readRobotBookWorld(reads, p)')
    expect(branch).toContain("await restRows(session, 'PATCH', 'price_book_entries', `${robotBookPricePatchQuery(dry.book, change)}&select=id`, robotBookPricePatch(change.after), 'return=representation')")
    expect(branch.match(/restRows\(/g)).toHaveLength(1) // entries alone: no assignment, no bid, no fixture type
    expect(branch).toContain('{ target: robotBookLogLine(dry.book, landedChanges), rowCount: landedChanges.length }')
    expect(branch).toContain('if (fresh !== built.planHash) return refused(planMismatch(')
    expect(branch).toContain('const prior = await hooks.priorApply(name, fresh)')
    expect(SERVER).toContain("const SERVER_VERSION = '0.125.0'")
    expect(SERVER).toContain('Writes are one hundred and fifty-six verbs and nothing else')
    expect(SERVER).toContain('plan_robot_book_price → apply_robot_book_price (prices that stand in a 🤖 Robot Default price book')
    expect(README).toContain('| `plan_robot_book_price(prices)` · `apply_robot_book_price(prices, plan_hash)` |')
    expect(README).toContain("one hundred and thirty-seven since v2.7939's robot book pair")
    expect(README).toContain('one hundred and fifty-six `plan_` / `apply_` / `revert_` verbs')
    expect(EDGE).toContain("v2.7939 (server 0.111.0) — a robot book's price changed from the seat")
  })
})
