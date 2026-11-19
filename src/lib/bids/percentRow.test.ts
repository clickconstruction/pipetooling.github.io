import { describe, expect, it } from 'vitest'
import {
  parsePercent,
  parsePercentRule,
  percentRowAnswer,
  percentRowDrift,
  percentRuleChip,
  percentRuleToDb,
  percentRuleWords,
  percentSourceFromKey,
  percentSourceKey,
  percentSourceOptions,
  percentSourceRows,
  percentWindowPreview,
  percentWindowStart,
  readPercentRowLast,
  writePercentRowLast,
  PERCENT_ROW_LAST_KEY,
  type PercentGridRow,
  type PercentRule,
  type PercentWindowValue,
} from './percentRow'

const row = (over: Partial<PercentGridRow> & { id: string; name: string }): PercentGridRow => ({
  kind: 'fixture',
  tags: [],
  count: 1,
  revenue: 0,
  cost: 0,
  unitPrice: 0,
  priced: false,
  isFixedPrice: false,
  rule: null,
  ...over,
})

const pipe = (id: string, name: string, count: number, unit: number, over: Partial<PercentGridRow> = {}): PercentGridRow =>
  row({ id, name, kind: 'pipe', count, unitPrice: unit, revenue: count * unit, priced: true, ...over })

const RULE: PercentRule = { pct: 40, basis: 'revenue', source: { kind: 'pipe' } }

/** The mock-up's bid: two fixtures, five pipe rows that sell for $6,200.00. */
const BID: PercentGridRow[] = [
  row({ id: 'wc', name: 'WC', count: 2, unitPrice: 2500, revenue: 5000, cost: 620, priced: true }),
  row({ id: 'lav', name: 'LAV', count: 2, unitPrice: 2000, revenue: 4000, cost: 1680, priced: true }),
  pipe('w34', 'ft of 3/4IN WATER', 60, 30, { tags: ['water'] }),
  pipe('w12', 'ft of 1/2IN WATER', 80, 15, { tags: ['water'] }),
  pipe('v2', 'ft of 2IN VENT', 50, 20),
  pipe('w4', 'ft of 4IN WASTE', 90, 20),
  pipe('w3', 'ft of 3IN WASTE', 20, 20),
]

const connections = (over: Partial<PercentGridRow> = {}): PercentGridRow => row({ id: 'conn', name: 'Connections', kind: 'fitting', rule: RULE, ...over })

describe('a percent as typed', () => {
  it.each([
    ['40', 40],
    ['37.5%', 37.5],
    [' 1,000 ', 1000],
    [12.12549, 12.125],
  ])('%s reads %s', (raw, want) => expect(parsePercent(raw)).toBe(want))

  it.each(['', '0', '-5', '1000.5', 'forty', null, undefined])('%s is no percent', (raw) => expect(parsePercent(raw)).toBeNull())
})

describe("the column's value", () => {
  it('reads a rule by kind and a rule by tag, and writes each back as it was', () => {
    const byKind = parsePercentRule({ pct: 40, basis: 'revenue', source: { kind: 'pipe' } })
    const byTag = parsePercentRule({ pct: 12.5, basis: 'cost', source: { tag: ' Water ' } })
    expect(byKind).toEqual(RULE)
    expect(byTag).toEqual({ pct: 12.5, basis: 'cost', source: { tag: 'water' } })
    expect(percentRuleToDb(byKind!)).toEqual({ pct: 40, basis: 'revenue', source: { kind: 'pipe' } })
    expect(percentRuleToDb(byTag!)).toEqual({ pct: 12.5, basis: 'cost', source: { tag: 'water' } })
  })

  it.each([
    null,
    undefined,
    '40%',
    [],
    { pct: '40', basis: 'revenue', source: { kind: 'pipe' } },
    { pct: 0, basis: 'revenue', source: { kind: 'pipe' } },
    { pct: 40, basis: 'profit', source: { kind: 'pipe' } },
    { pct: 40, basis: 'revenue', source: { kind: 'sprinkler' } },
    { pct: 40, basis: 'revenue', source: { rows: ['a', 'b'] } },
    { pct: 40, basis: 'revenue' },
  ])('reads %j as no rule', (raw) => expect(parsePercentRule(raw)).toBeNull())

  it('keys a source both ways', () => {
    expect(percentSourceKey({ kind: 'pipe' })).toBe('kind:pipe')
    expect(percentSourceKey({ tag: 'water' })).toBe('tag:water')
    expect(percentSourceFromKey('kind:pipe')).toEqual({ kind: 'pipe' })
    expect(percentSourceFromKey('tag:water')).toEqual({ tag: 'water' })
    expect(percentSourceFromKey('kind:sprinkler')).toBeNull()
    expect(percentSourceFromKey('')).toBeNull()
  })
})

describe('what a rule comes to', () => {
  it('is 40% of what the five pipe rows sell for', () => {
    expect(percentRowAnswer([...BID, connections()], RULE, { id: 'conn', count: 1, isFixedPrice: false })).toEqual({ sourceCount: 5, base: 6200, revenue: 2480, unitPrice: 2480 })
  })

  it('follows a footage change', () => {
    const longer = BID.map((r) => (r.id === 'w4' ? pipe('w4', r.name, 120, 20) : r))
    expect(percentRowAnswer(longer, RULE, { id: 'conn', count: 1, isFixedPrice: false }).revenue).toBe(2720)
  })

  it('reads a tag in place of a kind', () => {
    const answer = percentRowAnswer(BID, { pct: 40, basis: 'revenue', source: { tag: 'water' } }, { id: null, count: 1, isFixedPrice: false })
    expect(answer).toMatchObject({ sourceCount: 2, base: 3000, revenue: 1200 })
  })

  it('reads cost when asked, and nothing where the rows carry none', () => {
    expect(percentRowAnswer(BID, { pct: 10, basis: 'cost', source: { kind: 'fixture' } }, { id: null, count: 1, isFixedPrice: false })).toMatchObject({ base: 2300, revenue: 230 })
    expect(percentRowAnswer(BID, { pct: 40, basis: 'cost', source: { kind: 'pipe' } }, { id: null, count: 1, isFixedPrice: false })).toMatchObject({ sourceCount: 5, base: 0, revenue: 0 })
  })

  it('spreads the revenue over a row counted more than once, and not over a fixed price', () => {
    expect(percentRowAnswer(BID, RULE, { id: null, count: 4, isFixedPrice: false }).unitPrice).toBe(620)
    expect(percentRowAnswer(BID, RULE, { id: null, count: 4, isFixedPrice: true }).unitPrice).toBe(2480)
    expect(percentRowAnswer(BID, RULE, { id: null, count: 0, isFixedPrice: false }).unitPrice).toBe(2480)
  })

  it('never reads itself or another row with a rule, so rules cannot chain', () => {
    const selfPipe = connections({ kind: 'pipe', revenue: 2480, unitPrice: 2480, priced: true })
    const other = row({ id: 'gas', name: 'Gas connections', kind: 'pipe', revenue: 900, unitPrice: 900, priced: true, rule: { pct: 10, basis: 'revenue', source: { kind: 'fixture' } } })
    const rows = [...BID, selfPipe, other]
    expect(percentSourceRows(rows, RULE.source, 'conn').map((r) => r.id)).toEqual(['w34', 'w12', 'v2', 'w4', 'w3'])
    expect(percentRowAnswer(rows, RULE, selfPipe).base).toBe(6200)
  })
})

describe('the words', () => {
  it('says the rule as the chip does', () => {
    expect(percentRuleWords(RULE)).toBe('40% of Pipe revenue')
    expect(percentRuleWords({ pct: 37.5, basis: 'cost', source: { kind: 'fixture' } })).toBe('37.5% of Fixtures cost')
    expect(percentRuleWords({ pct: 40, basis: 'revenue', source: { tag: 'water' } })).toBe('40% of water revenue')
    expect(percentRuleChip(RULE, 6200)).toBe('40% of Pipe revenue · $6,200.00')
  })
})

describe('the prices the Workbench writes so each rule row follows', () => {
  it('writes a rule row nothing prices yet', () => {
    expect(percentRowDrift([...BID, connections()])).toEqual([{ rowId: 'conn', name: 'Connections', unitPrice: 2480, saved: null, answer: { sourceCount: 5, base: 6200, revenue: 2480, unitPrice: 2480 } }])
  })

  it('writes nothing when the saved price is the rule to the cent', () => {
    expect(percentRowDrift([...BID, connections({ priced: true, unitPrice: 2480, revenue: 2480 })])).toEqual([])
    expect(percentRowDrift([...BID, connections({ priced: true, unitPrice: 2480.004, revenue: 2480 })])).toEqual([])
  })

  it('writes the new price after a pipe row moves, and names what was saved', () => {
    const longer = BID.map((r) => (r.id === 'w4' ? pipe('w4', r.name, 120, 20) : r))
    const drift = percentRowDrift([...longer, connections({ priced: true, unitPrice: 2480, revenue: 2480 })])
    expect(drift).toHaveLength(1)
    expect(drift[0]).toMatchObject({ rowId: 'conn', unitPrice: 2720, saved: 2480 })
  })

  it('prices a rule row at $0.00 when its rows are gone, and leaves rows with no rule alone', () => {
    const noPipe = BID.filter((r) => r.kind !== 'pipe')
    expect(percentRowDrift([...noPipe, connections({ priced: true, unitPrice: 2480, revenue: 2480 })])[0]).toMatchObject({ unitPrice: 0, saved: 2480 })
    expect(percentRowDrift(BID)).toEqual([])
  })
})

describe('what a rule may read', () => {
  it('lists each kind with rows, in the breakdown order, then each tag', () => {
    expect(percentSourceOptions(BID, null).map((o) => [o.key, o.label, o.revenue, o.cost])).toEqual([
      ['kind:fixture', 'Fixtures · 2 rows', 9000, 2300],
      ['kind:pipe', 'Pipe · 5 rows', 6200, 0],
      ['tag:water', 'tagged water · 2 rows', 3000, 0],
    ])
  })

  it('leaves out the row itself and rows with a rule', () => {
    const rows = [...BID, connections({ kind: 'pipe', tags: ['water'] })]
    expect(percentSourceOptions(rows, 'conn').map((o) => o.label)).toEqual(['Fixtures · 2 rows', 'Pipe · 5 rows', 'tagged water · 2 rows'])
    expect(percentSourceOptions(rows, null).map((o) => o.label)).toEqual(['Fixtures · 2 rows', 'Pipe · 5 rows', 'tagged water · 2 rows'])
    expect(percentSourceOptions([row({ id: 'a', name: 'One valve', kind: 'fitting' })], 'a')).toEqual([])
  })
})

describe('the window', () => {
  const value = (over: Partial<PercentWindowValue> = {}): PercentWindowValue => ({ name: 'Connections', kind: 'fitting', pct: '40', basis: 'revenue', sourceKey: 'kind:pipe', follow: true, ...over })

  it('draws the new row, the bid before and after, and a press that names the act', () => {
    const p = percentWindowPreview({ rows: BID, self: null, value: value() })
    expect(p.ruleToSave).toEqual(RULE)
    expect(p.answer).toEqual({ sourceCount: 5, base: 6200, revenue: 2480, unitPrice: 2480 })
    expect(p.chip).toBe('40% of Pipe revenue · $6,200.00')
    expect([p.bidRevenueBefore, p.bidRevenueAfter]).toEqual([15200, 17680])
    expect(p.hold).toBeNull()
    expect(p.label).toBe('Add Connections at $2,480.00')
  })

  it('moves as she types 35, picks a tag, or unticks Keep following', () => {
    expect(percentWindowPreview({ rows: BID, self: null, value: value({ pct: '35' }) })).toMatchObject({ chip: '35% of Pipe revenue · $6,200.00', label: 'Add Connections at $2,170.00', bidRevenueAfter: 17370 })
    expect(percentWindowPreview({ rows: BID, self: null, value: value({ sourceKey: 'tag:water' }) })).toMatchObject({ chip: '40% of water revenue · $3,000.00', label: 'Add Connections at $1,200.00' })
    const once = percentWindowPreview({ rows: BID, self: null, value: value({ follow: false }) })
    expect(once).toMatchObject({ ruleToSave: null, chip: null, label: 'Add Connections at $2,480.00', hold: null })
  })

  it('holds the press with its reason: no name, no percent, no rows', () => {
    expect(percentWindowPreview({ rows: BID, self: null, value: value({ name: '  ' }) }).hold).toBe('Name the row first.')
    expect(percentWindowPreview({ rows: BID, self: null, value: value({ pct: '' }) })).toMatchObject({ hold: 'Type a percent above 0.', label: 'Add Connections', answer: null })
    expect(percentWindowPreview({ rows: BID, self: null, value: value({ sourceKey: '' }) }).hold).toBe('Pick the rows it is a percent of.')
  })

  it('sets a row already on the bid, taking its old price out of the bid first', () => {
    const self = connections({ rule: null, priced: true, unitPrice: 2000, revenue: 2000 })
    const p = percentWindowPreview({ rows: [...BID, self], self, value: value() })
    expect(p).toMatchObject({ hold: null, label: 'Set Connections to $2,480.00', bidRevenueBefore: 17200, bidRevenueAfter: 17680 })
    expect(p.target?.id).toBe('conn')
  })

  it('until a percent is typed the bid reads as it stands, with the row\'s old price still in it', () => {
    const typed = connections({ rule: null, priced: true, unitPrice: 2000, revenue: 2000 })
    const p = percentWindowPreview({ rows: [...BID, typed], self: typed, value: value({ pct: '' }) })
    expect(p).toMatchObject({ answer: null, bidRevenueBefore: 17200, bidRevenueAfter: 17200, hold: 'Type a percent above 0.' })
  })

  it('a name typed for a new row that is already on the bid sets that row, whatever its letters\' case', () => {
    const typed = connections({ rule: null, priced: true, unitPrice: 2000, revenue: 2000 })
    const p = percentWindowPreview({ rows: [...BID, typed], self: null, value: value({ name: ' connections ' }) })
    expect(p).toMatchObject({ hold: null, label: 'Set Connections to $2,480.00', bidRevenueAfter: 17680 })
    expect(p.target?.id).toBe('conn')
    // A name on no row is a new row.
    expect(percentWindowPreview({ rows: [...BID, typed], self: null, value: value({ name: 'Gas connections' }) })).toMatchObject({ target: null, label: 'Add Gas connections at $2,480.00' })
  })

  it('keeps a number sent from the calculator when Keep following is off', () => {
    const p = percentWindowPreview({ rows: BID, self: null, value: value({ pct: '', sourceKey: '', follow: false }), fixedRevenue: 1234.567 })
    expect(p).toMatchObject({ ruleToSave: null, hold: null, label: 'Add Connections at $1,234.57' })
    expect(p.answer).toMatchObject({ revenue: 1234.57, unitPrice: 1234.57 })
    // On again, the rule decides and the sent number is set aside.
    expect(percentWindowPreview({ rows: BID, self: null, value: value(), fixedRevenue: 1234.567 }).label).toBe('Add Connections at $2,480.00')
  })
})

describe('the window, putting a number on a row already here', () => {
  const value = (over: Partial<PercentWindowValue> = {}): PercentWindowValue => ({ name: '', kind: 'fitting', pct: '', basis: 'revenue', sourceKey: 'kind:pipe', follow: false, rowId: null, ...over })

  it('holds the press until a row is picked, then sets that row to the number sent', () => {
    expect(percentWindowPreview({ rows: BID, self: null, value: value(), fixedRevenue: 900, pickRow: true })).toMatchObject({ hold: 'Pick the row first.', target: null })
    const p = percentWindowPreview({ rows: BID, self: null, value: value({ rowId: 'lav' }), fixedRevenue: 900, pickRow: true })
    expect(p).toMatchObject({ hold: null, label: 'Set LAV to $900.00', ruleToSave: null, bidRevenueBefore: 15200, bidRevenueAfter: 12100 })
    // $900.00 over two lavatories.
    expect(p.answer).toMatchObject({ revenue: 900, unitPrice: 450 })
    expect(p.target?.id).toBe('lav')
  })

  it('opens with no name and no row, and Keep following off for a plain number', () => {
    expect(percentWindowStart({ rows: BID, self: null, last: null, from: { pct: null, basis: null, sourceKey: null }, pickRow: true })).toEqual({ name: '', kind: 'fitting', pct: '', basis: 'revenue', sourceKey: 'kind:pipe', follow: false, rowId: null })
  })
})

describe('what the window opens on', () => {
  it('suggests no percent the first time: Connections, Pipe, Revenue, the percent empty', () => {
    expect(percentWindowStart({ rows: BID, self: null, last: null })).toEqual({ name: 'Connections', kind: 'fitting', pct: '', basis: 'revenue', sourceKey: 'kind:pipe', follow: true })
  })

  it("opens filled with this device's last rule when its rows are on the bid", () => {
    const last = { name: 'Connections', kind: 'fitting' as const, pct: '40', basis: 'revenue' as const, sourceKey: 'kind:pipe' }
    expect(percentWindowStart({ rows: BID, self: null, last })).toEqual({ ...last, follow: true })
    // A bid with no pipe rows cannot use it.
    expect(percentWindowStart({ rows: BID.filter((r) => r.kind !== 'pipe'), self: null, last })).toMatchObject({ pct: '', sourceKey: 'kind:fixture' })
  })

  it("opens a row's own rule, and a calculator answer as it was sent", () => {
    const self = connections({ rule: { pct: 37.5, basis: 'revenue', source: { tag: 'water' } } })
    expect(percentWindowStart({ rows: [...BID, self], self, last: null })).toEqual({ name: 'Connections', kind: 'fitting', pct: '37.5', basis: 'revenue', sourceKey: 'tag:water', follow: true })
    expect(percentWindowStart({ rows: BID, self: null, last: null, from: { pct: 40, basis: 'revenue', sourceKey: 'kind:pipe' } })).toMatchObject({ pct: '40', sourceKey: 'kind:pipe', follow: true })
    // A plain number has no rule behind it: Keep following starts off.
    expect(percentWindowStart({ rows: BID, self: null, last: null, from: { pct: null, basis: null, sourceKey: null } })).toMatchObject({ pct: '', follow: false })
  })

  it('remembers the last rule on this device and shrugs off a broken note', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(readPercentRowLast(storage)).toBeNull()
    writePercentRowLast(storage, { name: 'Connections', kind: 'fitting', pct: '40', basis: 'revenue', sourceKey: 'kind:pipe' })
    expect(readPercentRowLast(storage)).toEqual({ name: 'Connections', kind: 'fitting', pct: '40', basis: 'revenue', sourceKey: 'kind:pipe' })
    store.set(PERCENT_ROW_LAST_KEY, '{"name":"x","pct":"0","sourceKey":"kind:pipe"}')
    expect(readPercentRowLast(storage)).toBeNull()
    store.set(PERCENT_ROW_LAST_KEY, 'not json')
    expect(readPercentRowLast(storage)).toBeNull()
    expect(readPercentRowLast(null)).toBeNull()
  })
})
