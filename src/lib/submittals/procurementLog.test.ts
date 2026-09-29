import { describe, expect, it } from 'vitest'
import {
  addDays,
  buildProcurementLog,
  buildProcurementUpdateHtml,
  daysBetween,
  diffProcurementLog,
  fixtureHead,
  floatText,
  procurementHeadline,
  procurementUpdateText,
  shortDate,
  snapshotRows,
  stageDatesFromJob,
  stageOfStageName,
  stageOfWeights,
  statusText,
  tagMatchesFixture,
  type ProcurementItemSource,
  type ProcurementRecord,
} from './procurementLog'

const item = (p: Partial<ProcurementItemSource> & { tag: string; product: string }): ProcurementItemSource => ({ supplyHouse: null, leadTimeDays: null, decision: null, shared: true, ...p })
const rec = (p: Partial<ProcurementRecord> & { tag: string | null }): ProcurementRecord => ({ id: 'r-' + (p.tag ?? p.label ?? 'x'), label: '', leadTimeDays: null, stage: null, orderedOn: null, poRef: '', expectedOn: null, deliveredOn: null, note: '', sortOrder: 0, ...p })
const approved = (at: string) => ({ kind: 'approved' as const, at })

// The mock-up's job: Rough In 10/06 · Top Out 10/27 · Trim Set 11/17.
const stageDates = { rough_in: '2026-10-06', top_out: '2026-10-27', trim_set: '2026-11-17' }
const items = [
  item({ tag: 'WH-1', product: 'A.O. Smith BTH-199', leadTimeDays: 42, decision: approved('2026-09-22T15:00:00Z') }),
  item({ tag: 'FS-2', product: 'Zurn Z1900 floor sink', leadTimeDays: 0, decision: approved('2026-09-22T15:00:00Z') }),
  item({ tag: 'BFP-1', product: 'Watts 909 RPZ 2"', leadTimeDays: 28, decision: approved('2026-09-22T15:00:00Z') }),
  item({ tag: 'HS-1', product: 'Advance Tabco 7-PS-66', leadTimeDays: 14, decision: { kind: 'revise', at: '2026-09-22T15:00:00Z' } }),
  item({ tag: 'L-1', product: 'Kohler K-2005 lav', leadTimeDays: 7, decision: approved('2026-09-22T15:00:00Z') }),
  item({ tag: 'S-3', product: 'Elkay sink', leadTimeDays: 7 }),
]
const records = [
  rec({ tag: 'WH-1', orderedOn: '2026-09-24', poRef: '118' }),
  rec({ tag: 'FS-2', orderedOn: '2026-09-23', poRef: '117', deliveredOn: '2026-09-26' }),
  rec({ tag: 'BFP-1', orderedOn: '2026-09-25', poRef: '119', expectedOn: '2026-10-20', note: 'Ferguson: 10/20 earliest' }),
  rec({ tag: null, label: 'Grease interceptor 750 gal', leadTimeDays: 56, stage: 'rough_in', orderedOn: '2026-09-18', poRef: '115', sortOrder: 0 }),
]
const tagStage = { 'WH-1': 'trim_set', 'FS-2': 'rough_in', 'BFP-1': 'rough_in', 'HS-1': 'trim_set', 'L-1': 'trim_set', 'S-3': 'trim_set' } as const

describe('dates', () => {
  it('adds days and measures gaps on ISO dates without a timezone wobble', () => {
    expect(addDays('2026-09-24', 42)).toBe('2026-11-05')
    expect(addDays('2026-11-17', -14)).toBe('2026-11-03')
    expect(daysBetween('2026-10-20', '2026-10-06')).toBe(-14)
    expect(shortDate('2026-09-28')).toBe('09/28')
    expect(shortDate(null)).toBe('')
  })
})

describe('the log', () => {
  const rows = buildProcurementLog({ items, records, tagStage, stageDates })

  it('derives released from the approval, expected from the order plus the lead time, required from the stage, and the float', () => {
    const wh = rows.find((r) => r.tag === 'WH-1')!
    expect(wh).toMatchObject({ status: 'ordered', releasedOn: '2026-09-22', orderedOn: '2026-09-24', poRef: '118', expectedOn: '2026-11-05', expectedSource: 'derived', requiredOn: '2026-11-17', floatDays: 12, late: false, stage: 'trim_set' })
    expect(floatText(wh)).toBe('12 d')
    expect(statusText(wh)).toBe('Ordered 09/24')
  })

  it('lets the house’s date win and flags the row late', () => {
    const bfp = rows.find((r) => r.tag === 'BFP-1')!
    expect(bfp).toMatchObject({ expectedOn: '2026-10-20', expectedSource: 'house', requiredOn: '2026-10-06', floatDays: -14, late: true })
    expect(floatText(bfp)).toBe('−14 d')
  })

  it('a delivered row is on site with no float; a sent-back row is not released; an unordered released row says order by', () => {
    expect(rows.find((r) => r.tag === 'FS-2')).toMatchObject({ status: 'delivered', expectedOn: null, floatDays: null })
    expect(floatText(rows.find((r) => r.tag === 'FS-2')!)).toBe('on site')
    const hs = rows.find((r) => r.tag === 'HS-1')!
    expect(hs).toMatchObject({ status: 'sent_back', releasedOn: null, orderBy: '2026-11-03' })
    expect(statusText(hs)).toBe('Sent back 09/22')
    expect(floatText(hs)).toBe('order by 11/03')
    const l1 = rows.find((r) => r.tag === 'L-1')!
    expect(l1).toMatchObject({ status: 'released', orderBy: '2026-11-10' })
    expect(rows.find((r) => r.tag === 'S-3')).toMatchObject({ status: 'awaiting', submittal: 'open' })
  })

  it('carries hand rows after the tags with their own stage and lead time', () => {
    const hand = rows[rows.length - 1]!
    expect(hand).toMatchObject({ isHand: true, tag: null, product: 'Grease interceptor 750 gal', status: 'ordered', expectedOn: '2026-11-13', requiredOn: '2026-10-06', floatDays: -38, late: true })
    expect(rows.map((r) => r.tag)).toEqual(['BFP-1', 'FS-2', 'HS-1', 'L-1', 'S-3', 'WH-1', null])
  })

  it('counts and words the headline', () => {
    expect(procurementHeadline(rows)).toBe('4 released · 4 ordered · 1 delivered · 2 behind schedule · 1 sent back')
  })

  it('has blank required dates and no float before the bid is a job', () => {
    const r = buildProcurementLog({ items: items.slice(0, 1), records: records.slice(0, 1), tagStage, stageDates: {} })[0]!
    expect(r).toMatchObject({ requiredOn: null, floatDays: null, orderBy: null, expectedOn: '2026-11-05' })
  })
})

describe('the stage of a tag and the job’s stage dates', () => {
  it('reads a takeoff fixture’s head and matches it to a tag by the normalized tag or by the letters', () => {
    expect(fixtureHead('(3) HS - HAND SINK')).toBe('HS')
    expect(fixtureHead('WC-1 - WATER CLOSET')).toBe('WC-1')
    expect(fixtureHead('3-COMP - 3 COMPARTMENT SINK')).toBe('3-COMP')
    expect(tagMatchesFixture('WC-1', 'wc 1 - WATER CLOSET')).toBe(true)
    expect(tagMatchesFixture('HS-1', '(3) HS - HAND SINK')).toBe(true)
    expect(tagMatchesFixture('WH-1', 'WC-1 - WATER CLOSET')).toBe(false)
    // v2.4118 · a row split from a combined count carries one of the tags the name spells out.
    expect(tagMatchesFixture('WC-2', 'WC 1&2 - WATER CLOSET')).toBe(true)
    expect(tagMatchesFixture('WC-3', 'WC 1&2 - WATER CLOSET')).toBe(false)
    expect(tagMatchesFixture('L-1', '')).toBe(false)
  })

  it('takes the heaviest stage of a split, the earliest on a tie', () => {
    expect(stageOfWeights({ rough_in: 0.5, top_out: 0.5, trim_set: 0 })).toBe('rough_in')
    expect(stageOfWeights({ rough_in: 0, top_out: 0.3, trim_set: 0.7 })).toBe('trim_set')
    expect(stageOfWeights(null)).toBeNull()
  })

  it('maps the job’s Order stages to the three by name and takes each stage’s earliest window', () => {
    expect(stageOfStageName('Rough-in')).toBe('rough_in')
    expect(stageOfStageName('Underground')).toBe('rough_in')
    expect(stageOfStageName('Top out')).toBe('top_out')
    expect(stageOfStageName('Trim')).toBe('trim_set')
    expect(stageOfStageName('Mobilization')).toBeNull()
    const d = stageDatesFromJob(
      [
        { id: 'f1', name: 'Rough-in', stage_kind: 'order' },
        { id: 'f2', name: 'Top-out', stage_kind: 'order' },
        { id: 'f3', name: 'Trim', stage_kind: 'order' },
        { id: 'f4', name: 'Water heater', stage_kind: 'any' },
      ],
      [
        { fixture_id: 'f1', window_start: '2026-10-08' },
        { fixture_id: 'f1', window_start: '2026-10-06' },
        { fixture_id: 'f3', window_start: '2026-11-17T00:00:00' },
        { fixture_id: 'f4', window_start: '2026-10-01' },
      ],
    )
    expect(d).toEqual({ rough_in: '2026-10-06', trim_set: '2026-11-17' })
  })
})

describe('updates', () => {
  const before = buildProcurementLog({ items, records: [rec({ tag: 'WH-1', orderedOn: '2026-09-24', poRef: '118' }), rec({ tag: 'FS-2', orderedOn: '2026-09-23', poRef: '117' }), rec({ tag: 'BFP-1', orderedOn: '2026-09-25', poRef: '119' })], tagStage, stageDates })
  const after = buildProcurementLog({ items, records, tagStage, stageDates })

  it('says what changed since the last snapshot, in the words the sheet leads with', () => {
    const changes = diffProcurementLog(snapshotRows(before), after)
    expect(changes.map((c) => [c.tag ?? c.product, c.text])).toEqual([
      ['BFP-1', 'expected 10/23 → 10/20 (house); Ferguson: 10/20 earliest'],
      ['FS-2', 'delivered 09/26'],
      ['Grease interceptor 750 gal', 'added to the log; ordered 09/18 (PO 115); expected 11/13; 38 days behind'],
    ])
  })

  it('a first update lists every row with something to say, and a row that left the log is named', () => {
    const first = diffProcurementLog(null, after.slice(0, 2))
    expect(first.map((c) => c.tag)).toEqual(['BFP-1', 'FS-2'])
    const gone = diffProcurementLog(snapshotRows(after), after.filter((r) => r.tag !== 'L-1'))
    expect(gone.find((c) => c.tag === 'L-1')?.text).toBe('no longer on the log')
  })

  it('prints the sheet with changed rows first and the one line, and the text for the email', () => {
    const changes = diffProcurementLog(snapshotRows(before), after)
    const input = { bidLabel: 'B482 Shipley Do-Nuts', companyName: 'Click Plumbing and Electrical', updateNumber: 4, sentOn: '2026-09-28', sinceOn: '2026-09-21', rows: after, changes, line: 'BFP-1: can Rough In wait for the RPZ?', stageDates }
    const html = buildProcurementUpdateHtml(input)
    expect(html).toContain('Procurement log update')
    expect(html).toContain('update 4 · 09/28 · since 09/21')
    expect(html).toContain('BFP-1: can Rough In wait for the RPZ?')
    expect(html.indexOf('BFP-1')).toBeLessThan(html.indexOf('WH-1'))
    expect(html).toContain('(house)')
    expect(html).toContain('Rough In 10/06 · Top Out 10/27 · Trim Set 11/17')
    const text = procurementUpdateText(input)
    expect(text).toContain('Changed since the last update:')
    expect(text).toContain('• BFP-1 Watts 909 RPZ 2": expected 10/23 → 10/20 (house); Ferguson: 10/20 earliest')
    expect(text).toContain('• WH-1 A.O. Smith BTH-199: Ordered 09/24, expected 11/05, required 11/17, 12 d')
    expect(text).toContain('• FS-2 Zurn Z1900 floor sink: Delivered 09/26, required 10/06, on site')
  })
})
