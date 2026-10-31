import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { PlanPageRow, PlanSubstrate } from './planText'
import {
  backingOf,
  checkWords,
  deriveFixtureRows,
  FIXTURES_NOT_YET_WORDS,
  fixtureButtonWords,
  fixtureSetLineWords,
  fixturesAddedToast,
  fixturesScoreOf,
  fixturesScoreWords,
  isSure,
  moneyWords,
  pairRobotFixtures,
  priceEachWords,
  reviewRobotFixtures,
  scheduleLineWords,
  sheetsOf,
  type FixturePullRow,
  type HerCountRow,
} from './robotFixtures'

const row = (p: Partial<FixturePullRow> & Pick<FixturePullRow, 'id' | 'tag' | 'name' | 'count' | 'sequence_order'>): FixturePullRow => ({
  pull_id: 'p1',
  unit: 'ea',
  confidence: 0.9,
  agreement: 'agree',
  robot_unit_price: null,
  ...p,
})

const wc = row({ id: 'wc', tag: 'WC-1', name: 'Water closet', count: 5, sequence_order: 1, robot_unit_price: 412, per_sheet: [{ sheet: 'P-201', page: 14, count: 3, pins: [{ x: 0.2, y: 0.3 }] }, { sheet: 'P-202', page: 15, count: 2 }], backing: [{ kind: 'schedule', sheet: 'P-601', page: 28, text: 'WC-1 WATER CLOSET', flags: [] }, { kind: 'note', sheet: 'P-001', page: 1, text: 'FLUSH VALVES BY PLUMBING CONTRACTOR', flags: ['scope_commitment'] }], remark: 'Five drawn, the riser shows five' })
const ms = row({ id: 'ms', tag: 'MS-1', name: 'Mop sink', count: 1, sequence_order: 2, robot_unit_price: 386 })
const fd = row({ id: 'fd', tag: 'FD-1', name: 'Floor drain', count: 8, sequence_order: 3, robot_unit_price: 212 })
const hb2 = row({ id: 'hb2', tag: 'HB-2', name: 'Hose bibb', count: 0, sequence_order: 4, confidence: 0.4, agreement: 'conflict', remark: 'On the schedule, none drawn.' })
const bfp = row({ id: 'bfp', tag: 'BFP-1', name: 'Backflow preventer', count: 1, sequence_order: 5, scope_flag: 'by_others', confidence: 0.95, robot_unit_price: 1940 })
const lav = row({ id: 'lav', tag: 'LAV-1', name: 'Lavatory', count: 6, sequence_order: 6 })

describe('pairing her rows to the robot’s', () => {
  it('pairs by the tag in her name, by her plan tag, by the exact name and by the stripped key, in that order', () => {
    const hers: HerCountRow[] = [
      { id: 'h1', fixture: 'WC-1', count: 5 },
      { id: 'h2', fixture: 'Floor drain', count: 6 },
      { id: 'h3', fixture: 'Mop Sink 1', count: 1 },
      { id: 'h4', fixture: 'Some sink', count: 2, plan_tag: 'lav-1' },
    ]
    const pairs = pairRobotFixtures([wc, ms, fd, hb2, bfp, lav], hers)
    expect(pairs.get('wc')?.id).toBe('h1')
    expect(pairs.get('fd')?.id).toBe('h2')
    expect(pairs.get('ms')?.id).toBe('h3')
    expect(pairs.get('lav')?.id).toBe('h4')
    expect(pairs.get('hb2')).toBeNull()
    expect(pairs.get('bfp')).toBeNull()
  })
  it('finds the tag inside a longer name as a whole token only', () => {
    const hers: HerCountRow[] = [{ id: 'h1', fixture: 'Water closet (WC-1)', count: 5 }, { id: 'h2', fixture: 'WC-12 wall hung', count: 2 }]
    const pairs = pairRobotFixtures([wc], hers)
    expect(pairs.get('wc')?.id).toBe('h1')
  })
  it('pairs through the book’s alias and never fuzzily', () => {
    const hers: HerCountRow[] = [{ id: 'h1', fixture: 'Toilet', count: 5 }, { id: 'h2', fixture: 'Water closets', count: 1 }]
    expect(pairRobotFixtures([wc], hers).get('wc')).toBeNull()
    const alias = (n: string) => (n === 'toilet' ? 'water closet' : n)
    expect(pairRobotFixtures([wc], hers, alias).get('wc')?.id).toBe('h1')
  })
  it('pairs nothing when a level holds two of hers, and a row of hers pairs once', () => {
    const hers: HerCountRow[] = [{ id: 'h1', fixture: 'WC-1', count: 5 }, { id: 'h2', fixture: 'WC-1 ADA', count: 1 }]
    expect(pairRobotFixtures([wc], hers).get('wc')).toBeNull()
    const two = [wc, row({ id: 'wc2', tag: 'WC-2', name: 'Water closet', count: 2, sequence_order: 7 })]
    const one: HerCountRow[] = [{ id: 'h1', fixture: 'Water closet', count: 5 }]
    const pairs = pairRobotFixtures(two, one)
    expect(pairs.get('wc')?.id).toBe('h1')
    expect(pairs.get('wc2')).toBeNull()
  })
  it('never offers a row the robot’s own take landed to another robot row', () => {
    const taken = row({ ...wc, taken_at: '2026-10-30T15:00:00Z', taken_as: 'added', count_row_id: 'landed' })
    const hers: HerCountRow[] = [{ id: 'landed', fixture: 'Water closet', count: 5, plan_tag: 'WC-1' }]
    const pairs = pairRobotFixtures([taken, row({ id: 'wc2', tag: 'WC-2', name: 'Water closet', count: 1, sequence_order: 8 })], hers)
    expect(pairs.get('wc')?.id).toBe('landed')
    expect(pairs.get('wc2')).toBeNull()
  })
})

describe('the review', () => {
  const hers: HerCountRow[] = [{ id: 'h1', fixture: 'Floor drain', count: 6 }, { id: 'h2', fixture: 'Lav', count: 5 }, { id: 'h3', fixture: 'Hose bibb', count: 0 }]
  const setAside = row({ id: 'sa', tag: 'EWC-1', name: 'Electric water cooler', count: 1, sequence_order: 9, set_aside_at: '2026-10-31T14:00:00Z', set_aside_reason: 'alternate' })
  const taken = row({ id: 'tk', tag: 'SK-1', name: 'Sink', count: 2, sequence_order: 10, taken_at: '2026-10-31T14:00:00Z', taken_as: 'added', count_row_id: 'h9', robot_unit_price: 286 })
  const review = reviewRobotFixtures([wc, ms, fd, hb2, bfp, setAside, taken], [...hers, { id: 'h9', fixture: 'Sink', count: 3 }])

  it('sorts the rows into the five buckets', () => {
    expect(review.byBucket.new.map((r) => r.row.tag)).toEqual(['WC-1', 'MS-1', 'BFP-1'])
    expect(review.byBucket.on_count.map((r) => r.row.tag)).toEqual(['FD-1'])
    expect(review.byBucket.same.map((r) => r.row.tag)).toEqual(['HB-2'])
    expect(review.byBucket.taken.map((r) => r.row.tag)).toEqual(['SK-1'])
    expect(review.byBucket.set_aside.map((r) => r.row.tag)).toEqual(['EWC-1'])
  })
  it('offers a taken row again once its count row is gone', () => {
    const gone = row({ id: 'gone', tag: 'UR-1', name: 'Urinal', count: 2, sequence_order: 11, taken_at: '2026-10-31T14:00:00Z', taken_as: 'added', count_row_id: null })
    const r = reviewRobotFixtures([gone], [])
    expect(r.rows[0]!.bucket).toBe('new')
    expect(r.rows[0]!.startTicked).toBe(true)
  })
  it('starts a sure new row ticked and a flagged or doubtful one unticked', () => {
    const by = Object.fromEntries(review.rows.map((r) => [r.row.tag, r]))
    expect(by['WC-1']!.startTicked).toBe(true)
    expect(by['MS-1']!.startTicked).toBe(true)
    expect(by['BFP-1']!.startTicked).toBe(false)
    expect(by['BFP-1']!.scope).toBe('by_others')
    expect(by['FD-1']!.startTicked).toBe(false)
    expect(isSure(hb2)).toBe(false)
  })
  it('counts and prices', () => {
    expect(review.found).toBe(7)
    expect(review.sure).toBe(5)
    expect(review.priced).toBe(5)
    expect(review.robotTotal).toBe(5 * 412 + 386 + 8 * 212 + 1940 + 2 * 286)
    expect(review.rows.find((r) => r.row.tag === 'WC-1')!.extended).toBe(2060)
  })
  it('reads the sheets, the pins and the backing', () => {
    const sheets = sheetsOf(wc)
    expect(sheets.map((s) => `${s.sheet}:${s.count}`)).toEqual(['P-201:3', 'P-202:2'])
    expect(sheets[0]!.pins).toEqual([{ x: 0.2, y: 0.3 }])
    const backing = backingOf(wc)
    expect(backing.map((b) => b.kind)).toEqual(['schedule', 'note'])
    expect(backing[1]!.flags).toEqual(['scope'])
  })
  it('every row line and check reads plain', () => {
    for (const r of review.rows) {
      expect(plainWordsFailures(r.words)).toEqual([])
      expect(plainWordsFailures(r.check)).toEqual([])
    }
    expect(review.rows.find((r) => r.row.tag === 'FD-1')!.words).toBe('Your row Floor drain has 6. The robot counted 8.')
    expect(review.rows.find((r) => r.row.tag === 'EWC-1')!.words).toBe('Set aside, alternate.')
    expect(checkWords(wc)).toBe('The schedule, the drawings and the riser agree. Five drawn, the riser shows five.')
    expect(checkWords(hb2)).toBe('The schedule and the drawings do not agree. On the schedule, none drawn.')
  })
})

describe('the button and the foot', () => {
  const hers: HerCountRow[] = [{ id: 'h1', fixture: 'Floor drain', count: 6 }, { id: 'h2', fixture: 'Lav', count: 5 }]
  const review = reviewRobotFixtures([wc, ms, fd, bfp], hers)
  it('is dead at nothing ticked and names the act', () => {
    const b = fixtureButtonWords({ add: new Set(), update: new Set() }, review, 2)
    expect(b.button).toBe('Add fixtures')
    expect(b.dead).toBe(true)
  })
  it('names the count, the price and what stays', () => {
    const b = fixtureButtonWords({ add: new Set(['wc', 'ms']), update: new Set() }, review, 2)
    expect(b.button).toBe('Add 2 fixtures')
    expect(b.foot).toBe('2 rows land on your count, shaded, $2,446 at the robot’s prices. Your book prices the ones it knows. The robot’s price fills the rest, marked. Your 2 other rows stay as they are.')
    expect(plainWordsFailures(b.foot)).toEqual([])
  })
  it('says the update too', () => {
    const b = fixtureButtonWords({ add: new Set(['wc']), update: new Set(['fd']) }, review, 2)
    expect(b.button).toBe('Add 1 · update 1')
    expect(b.foot).toContain('1 of your rows takes the robot’s count and keeps its parts and prices.')
    expect(b.foot).toContain('Your other row stays as it is.')
    expect(plainWordsFailures(b.foot)).toEqual([])
    const u = fixtureButtonWords({ add: new Set(), update: new Set(['fd']) }, review, 2)
    expect(u.button).toBe('Update 1 fixture')
  })
  it('the toast', () => {
    expect(fixturesAddedToast(15, 0)).toBe('15 fixtures added from the robot.')
    expect(fixturesAddedToast(1, 1)).toBe('1 fixture added from the robot, 1 row updated.')
  })
})

describe('the set line and the money words', () => {
  it('names the set, the sheets, the time, the counts and the price', () => {
    const line = fixtureSetLineWords({ pull: { source: 'robot', sheet_count: 31 }, setName: 'Issued set', when: 'Thu 2:08 PM', review: { found: 23, sure: 21, robotTotal: 31480 }, herRowCount: 6 })
    expect(line).toBe('From the set the robot read: Issued set, 31 sheets, read Thu 2:08 PM. 23 fixtures, 21 sure, $31,480 at the robot’s prices. Your count has 6 rows.')
    expect(plainWordsFailures(line)).toEqual([])
  })
  it('says so on a derived read', () => {
    const line = fixtureSetLineWords({ pull: { source: 'derived', sheet_count: null }, setName: null, when: 'Oct 22', review: { found: 9, sure: 0, robotTotal: null }, herRowCount: 1 })
    expect(line).toBe('From the robot’s read of Oct 22. Counts are the set’s totals, not per sheet. No prices. 9 fixtures, 0 sure. Your count has 1 row.')
    expect(plainWordsFailures(line)).toEqual([])
    expect(plainWordsFailures(FIXTURES_NOT_YET_WORDS)).toEqual([])
  })
  it('money', () => {
    expect(moneyWords(31480)).toBe('$31,480')
    expect(moneyWords(412.5)).toBe('$412.50')
    expect(priceEachWords(412)).toBe('$412 each')
    expect(priceEachWords(null)).toBeNull()
    expect(scheduleLineWords({ manufacturer: 'Kohler', model: 'K-96057', description: 'x', connections: { waste: '4"', cw: '1"' } })).toBe('Kohler K-96057 · waste 4" · cw 1"')
  })
})

describe('the fallback read of a substrate', () => {
  it('derives one row per fixture tag with its schedule row, the notes that name it and the callouts', () => {
    const sub = {
      sheets: [
        { sheet_no: 'P-001', notes: [{ text: { value: 'BACKFLOW PREVENTER BFP-1 BY SITE UTILITY CONTRACTOR' }, flags: ['exclusion_candidate'] }, { text: 'ALL WC-1 SHALL BE ADA', flags: ['scope_commitment'] }] },
        { sheet_no: 'P-601', schedules: [{ schedule_type: 'plumbing_fixture', rows: [{ tag: 'WC-1', description: 'Water closet, floor mounted', manufacturer: 'Kohler', model: 'K-96057', qty_scheduled: { value: 5 } }, { tag: 'BFP-1', description: 'Backflow preventer', qty_scheduled: null }] }] },
      ],
      rollup: { fixture_tags: [{ tag: 'BFP-1', qty: 1, reconciliation: 'full' }] },
    } as unknown as PlanSubstrate
    const pages: PlanPageRow[] = [{ page: 14, sheet_no: 'P-201', title: 'Plan', text: 'WC-1 (TYP OF 3)\nFD-1', has_text: true, source: 'round' }]
    const rows = deriveFixtureRows(sub, pages)
    expect(rows.map((r) => `${r.tag}:${r.name}:${r.count}`)).toEqual(['WC-1:Water closet, floor mounted:5', 'BFP-1:Backflow preventer:1'])
    const wcRow = rows[0]!
    expect(backingOf(wcRow).map((b) => b.kind)).toEqual(['schedule', 'note', 'callout'])
    expect(wcRow.robot_unit_price).toBeNull()
    expect(rows[1]!.scope_flag).toBe('by_others')
    expect(rows[1]!.agreement).toBe('agree')
  })
  it('is empty without a substrate', () => {
    expect(deriveFixtureRows(null, [])).toEqual([])
  })
})

describe('the fixtures score at send', () => {
  it('reads the column and says it plainly', () => {
    const s = fixturesScoreOf({ found: 23, taken: 19, changed: 2, set_aside: 2, left: 0, missed: 3, reasons: { by_others: 1, wrong_count: 1 } })
    expect(s).toEqual({ found: 23, taken: 19, changed: 2, set_aside: 2, left: 0, missed: 3, reasons: { by_others: 1, wrong_count: 1 } })
    expect(fixturesScoreWords(s!)).toBe('Fixtures: 19 of 23 taken, 2 changed, 2 set aside, 3 the robot missed.')
    expect(plainWordsFailures(fixturesScoreWords(s!))).toEqual([])
  })
  it('is null without a score and says only what is there', () => {
    expect(fixturesScoreOf(null)).toBeNull()
    expect(fixturesScoreOf([1])).toBeNull()
    expect(fixturesScoreWords(fixturesScoreOf({ found: '5', taken: 5 })!)).toBe('Fixtures: 5 of 5 taken.')
    expect(fixturesScoreWords(fixturesScoreOf({ found: 5, taken: 2, left: 3 })!)).toBe('Fixtures: 2 of 5 taken, 3 not taken.')
  })
})
