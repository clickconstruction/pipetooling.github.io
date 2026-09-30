import { describe, expect, it } from 'vitest'
import {
  addDays,
  buildProcurementLog,
  approveBy,
  buildProcurementUpdateHtml,
  gcScheduleWord,
  gcSubmittalWord,
  groupRowsByStage,
  isPlausibleLogDate,
  longDate,
  monthDay,
  procurementAsks,
  stageDatesWords,
  daysBetween,
  diffProcurementLog,
  fixtureHead,
  floatText,
  procurementHeadline,
  procurementUpdateText,
  readLogDateEntry,
  shortDate,
  shortDateYear,
  daysAgoWords,
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

  it('a date box presents its date with a two-digit year, and says how far it is from today', () => {
    expect(shortDateYear('2026-09-28')).toBe('09/28/26')
    expect(shortDateYear('2030-01-05')).toBe('01/05/30')
    expect(shortDateYear(null)).toBe('')
    expect(shortDateYear('nope')).toBe('')
    expect(daysAgoWords('2026-09-30', '2026-09-30')).toBe('today')
    expect(daysAgoWords('2026-09-29', '2026-09-30')).toBe('1 day ago')
    expect(daysAgoWords('2026-09-18', '2026-09-30')).toBe('12 days ago')
    expect(daysAgoWords('2026-10-01', '2026-09-30')).toBe('in 1 day')
    expect(daysAgoWords('2026-10-12', '2026-09-30')).toBe('in 12 days')
    // Across a year end, and nothing to say for a box with no date.
    expect(daysAgoWords('2025-12-31', '2026-01-02')).toBe('2 days ago')
    expect(daysAgoWords(null, '2026-09-30')).toBe('')
    expect(daysAgoWords('nope', '2026-09-30')).toBe('')
  })

  it('a log date is plausible only as a real day with a full year (a date box hands over 0002-… while the year is typed)', () => {
    expect(isPlausibleLogDate('2026-09-30')).toBe(true)
    expect(isPlausibleLogDate('2000-01-01')).toBe(true)
    expect(isPlausibleLogDate('2100-12-31')).toBe(true)
    // The year "2026" one digit at a time, and the date found on B375.
    for (const typing of ['0002-09-30', '0020-09-30', '0202-09-30', '0001-02-12']) expect(isPlausibleLogDate(typing)).toBe(false)
    expect(isPlausibleLogDate('1999-12-31')).toBe(false)
    expect(isPlausibleLogDate('2101-01-01')).toBe(false)
    expect(isPlausibleLogDate('20260-09-30')).toBe(false)
    // Not a day on the calendar, not the shape, nothing at all.
    expect(isPlausibleLogDate('2026-02-30')).toBe(false)
    expect(isPlausibleLogDate('2026-13-01')).toBe(false)
    expect(isPlausibleLogDate('2028-02-29')).toBe(true)
    expect(isPlausibleLogDate('2026-02-29')).toBe(false)
    expect(isPlausibleLogDate('09/30/2026')).toBe(false)
    expect(isPlausibleLogDate('2026-09-30T00:00:00Z')).toBe(false)
    expect(isPlausibleLogDate('')).toBe(false)
    expect(isPlausibleLogDate(null)).toBe(false)
    expect(isPlausibleLogDate(undefined)).toBe(false)
  })

  it('reads a date box: a finished date saves, an empty box clears, the stored date is no change, a half-typed year is unfinished', () => {
    expect(readLogDateEntry('2026-09-30', null)).toEqual({ kind: 'save', value: '2026-09-30' })
    expect(readLogDateEntry('2026-09-30', '2026-09-24')).toEqual({ kind: 'save', value: '2026-09-30' })
    expect(readLogDateEntry('', '2026-09-24')).toEqual({ kind: 'save', value: null })
    expect(readLogDateEntry('  ', '2026-09-24')).toEqual({ kind: 'save', value: null })
    expect(readLogDateEntry('2026-09-24', '2026-09-24')).toEqual({ kind: 'unchanged' })
    expect(readLogDateEntry('', null)).toEqual({ kind: 'unchanged' })
    expect(readLogDateEntry('0002-09-30', null)).toEqual({ kind: 'unfinished' })
    expect(readLogDateEntry('0202-09-30', '2026-09-24')).toEqual({ kind: 'unfinished' })
    // A bad date already stored (B375's 0001-02-12) can still be cleared or replaced; it is never re-saved.
    expect(readLogDateEntry('', '0001-02-12')).toEqual({ kind: 'save', value: null })
    expect(readLogDateEntry('2026-02-12', '0001-02-12')).toEqual({ kind: 'save', value: '2026-02-12' })
    expect(readLogDateEntry('0001-02-12', '0001-02-12')).toEqual({ kind: 'unchanged' })
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

  const letterhead = { companyName: 'Click Plumbing and Electrical', tagline: 'Plumbing, Electrical, and HVAC', phone: '(512) 360-0599', mailingAddress: '5501 Balcones Dr A141 Austin TX 78731', logoDataUrl: 'data:image/png;base64,AAAA' }
  const letter = { bidLabel: 'B482 Shipley Do-Nuts', companyName: 'Click Plumbing and Electrical', stageDates, letterhead, projectAddress: '4410 Fredericksburg Rd, San Antonio TX', gcName: 'Structura', preparedBy: 'Wendi Aguilar', roomUrl: 'https://pipetooling.com/submittal?t=abc', roomQrSvg: '<svg data-qr="1"></svg>' }

  it('prints an update as a letter to the GC: letterhead, To, the asks first, rows by stage, changed rows marked, the room code, the estimator’s line', () => {
    const changes = diffProcurementLog(snapshotRows(before), after)
    const input = { ...letter, kind: 'update' as const, updateNumber: 4, sentOn: '2026-09-28', sinceOn: '2026-09-21', rows: after, changes, line: 'BFP-1: can Rough In wait for the RPZ?' }
    const html = buildProcurementUpdateHtml(input)
    expect(html).toContain('<h1>Procurement log — update 4</h1>')
    expect(html).toContain('September 28, 2026 · changes since September 21, 2026 marked')
    expect(html).toContain('src="data:image/png;base64,AAAA"')
    expect(html).toContain('Plumbing, Electrical, and HVAC')
    expect(html).toContain('<b>To</b>Structura')
    expect(html).toContain('4410 Fredericksburg Rd, San Antonio TX')
    expect(html).toContain('<b>Schedule you gave us</b>Rough In Oct 6 · Top Out Oct 27 · Trim Set Nov 17')
    expect(html).toContain('<b>From</b>Wendi Aguilar · Click Plumbing and Electrical · (512) 360-0599')
    // The estimator's line leads the asks; then the rows waiting on the GC.
    const asks = html.slice(html.indexOf('What we need from you'), html.indexOf('<table>'))
    expect(asks.indexOf('BFP-1: can Rough In wait for the RPZ?')).toBeLessThan(asks.indexOf('<strong>HS-1</strong>'))
    expect(asks).toContain('<strong>HS-1</strong> Advance Tabco 7-PS-66 — returned Sep 22; needs your approval by Nov 3 to make Trim Set')
    expect(asks).toContain('<strong>S-3</strong> Elkay sink — awaiting your approval; needs your approval by Nov 10 to make Trim Set')
    expect(asks).toContain('<strong>Grease interceptor 750 gal</strong> — expected Nov 13, 38 days after Rough In starts')
    // Rows by stage, the stage's date once; the rough-in group before trim set.
    expect(html.indexOf('Rough In <span')).toBeLessThan(html.indexOf('Trim Set <span'))
    expect(html).toContain('needed on site Oct 6 · 3 items, 2 behind')
    expect(html).toContain('needed on site Nov 17 · 4 items')
    // The GC's words in the cells; the changed row carries the dot and its change under the note.
    expect(html).toContain('Returned for revision Sep 22')
    expect(html).toContain('Awaiting your approval')
    expect(html).toContain('supplier’s date')
    expect(html).toContain('Sep 24 · PO 118')
    expect(html).toContain('delivered Sep 26')
    expect(html).toContain('<span class="dot"></span><strong>BFP-1</strong>')
    expect(html).toContain('Ferguson: 10/20 earliest<br/><span style="color:#6b7280">since Sep 21: expected 10/23 → 10/20 (house)</span>')
    expect(html).not.toContain('<span class="dot"></span><strong>WH-1</strong>')
    expect(html).toContain('<svg data-qr="1"></svg>')
    expect(html).toContain('This log lives at <b>https://pipetooling.com/submittal?t=abc</b>')
    expect(html).toContain('Verified true and current by Wendi Aguilar, Click Plumbing and Electrical — signature')
    // The email carries the asks and the changes.
    const text = procurementUpdateText(input)
    expect(text).toContain('What we need from you:\n• BFP-1 Watts 909 RPZ 2": the supplier says Oct 20, 14 days after Rough In starts — Ferguson: 10/20 earliest\n• HS-1 Advance Tabco 7-PS-66: returned Sep 22; needs your approval by Nov 3 to make Trim Set')
    expect(text).toContain('Changed since the last update:')
    expect(text).toContain('• BFP-1 Watts 909 RPZ 2": expected 10/23 → 10/20 (house); Ferguson: 10/20 earliest')
    expect(text).toContain('• WH-1 A.O. Smith BTH-199: Ordered 09/24, expected 11/05, required 11/17, 12 d')
    expect(text).toContain('• FS-2 Zurn Z1900 floor sink: Delivered 09/26, required 10/06, on site')
  })

  it('Print the log says as of, marks nothing, and prints the row’s own note; without a letterhead the name stands alone', () => {
    const changes = diffProcurementLog(snapshotRows(before), after)
    const html = buildProcurementUpdateHtml({ ...letter, letterhead: null, roomUrl: null, roomQrSvg: null, kind: 'print', updateNumber: 4, sentOn: '2026-09-28', sinceOn: null, rows: after, changes, line: '' })
    expect(html).toContain('<h1>Procurement log</h1>')
    expect(html).toContain('as of September 28, 2026')
    expect(html).not.toContain('update 4')
    expect(html).not.toContain('class="dot"')
    expect(html).not.toContain('since Sep')
    expect(html).toContain('Ferguson: 10/20 earliest')
    expect(html).toContain('<b style="font-size:1.1rem">Click Plumbing and Electrical</b>')
    expect(html).not.toContain('This log lives at')
    expect(html).toContain('Verified true and current by Wendi Aguilar, Click Plumbing and Electrical')
  })

  it('a first update marks nothing and carries no “since” line (v2.4133 — the live pass on B398 printed “since : released 09/17”)', () => {
    const changes = diffProcurementLog(null, after)
    const html = buildProcurementUpdateHtml({ ...letter, kind: 'update', updateNumber: 1, sentOn: '2026-09-28', sinceOn: null, rows: after, changes, line: '' })
    expect(html).toContain('first update')
    expect(html).not.toContain('class="dot"></span><strong>')
    expect(html).not.toContain('since :')
    expect(html).not.toContain('since ')
  })

  it('a sheet with no fields beyond the rows still prints (the old call shape)', () => {
    const html = buildProcurementUpdateHtml({ bidLabel: 'B1', companyName: 'Click', updateNumber: 1, sentOn: '2026-09-28', sinceOn: null, rows: [], changes: [], line: '', stageDates: {} })
    expect(html).toContain('No items on the log.')
    expect(html).toContain('first update')
    expect(html).toContain('no stage schedule yet')
    expect(html).toContain('<b>To</b>—')
    expect(html).toContain('Verified true and current by Click — signature')
  })
})

describe('the GC’s words', () => {
  const rows = buildProcurementLog({ items, records, tagStage, stageDates })
  const byTag = (t: string) => rows.find((r) => r.tag === t)!

  it('names the submittal decision and the schedule as the GC reads them', () => {
    expect(gcSubmittalWord(byTag('WH-1'))).toBe('Approved Sep 22')
    expect(gcSubmittalWord(byTag('HS-1'))).toBe('Returned for revision Sep 22')
    expect(gcSubmittalWord(byTag('S-3'))).toBe('Awaiting your approval')
    expect(gcSubmittalWord(rows.find((r) => r.isHand)!)).toBe('—')
    expect(gcScheduleWord(byTag('WH-1'), '2026-09-28')).toBe('12 days ahead')
    expect(gcScheduleWord(byTag('BFP-1'), '2026-09-28')).toBe('14 days behind')
    expect(gcScheduleWord(byTag('FS-2'), '2026-09-28')).toBe('delivered Sep 26')
    expect(gcScheduleWord(byTag('L-1'), '2026-09-28')).toBe('we order by Nov 10')
    expect(gcScheduleWord(byTag('S-3'), '2026-09-28')).toBe('approve by Nov 10')
    expect(gcScheduleWord(byTag('S-3'), '2026-11-10')).toBe('needs approval now')
    expect(gcScheduleWord({ ...byTag('WH-1'), floatDays: 0 }, '2026-09-28')).toBe('on time')
    expect(gcScheduleWord({ ...byTag('WH-1'), floatDays: -1 }, '2026-09-28')).toBe('1 day behind')
  })

  it('approve by is required minus the lead time, and null without either', () => {
    expect(approveBy({ requiredOn: '2026-11-17', leadTimeDays: 7 })).toBe('2026-11-10')
    expect(approveBy({ requiredOn: null, leadTimeDays: 7 })).toBeNull()
    expect(approveBy({ requiredOn: '2026-11-17', leadTimeDays: null })).toBeNull()
  })

  it('the asks are the rows waiting on the GC, and say now once the date has passed', () => {
    expect(procurementAsks(rows, '2026-09-28').map((a) => [a.tag ?? a.product, a.text])).toEqual([
      ['BFP-1', 'the supplier says Oct 20, 14 days after Rough In starts — Ferguson: 10/20 earliest'],
      ['HS-1', 'returned Sep 22; needs your approval by Nov 3 to make Trim Set'],
      ['S-3', 'awaiting your approval; needs your approval by Nov 10 to make Trim Set'],
      ['Grease interceptor 750 gal', 'expected Nov 13, 38 days after Rough In starts'],
    ])
    expect(procurementAsks(rows, '2026-11-12').find((a) => a.tag === 'S-3')?.text).toBe('awaiting your approval; needs your approval now to make Trim Set')
    expect(procurementAsks([], '2026-09-28')).toEqual([])
  })

  it('groups the rows by stage in build order, the stage’s date on the group, no-stage rows last', () => {
    const groups = groupRowsByStage(rows, stageDates)
    expect(groups.map((g) => [g.label, g.neededOn, g.rows.map((r) => r.tag ?? r.product)])).toEqual([
      ['Rough In', '2026-10-06', ['BFP-1', 'FS-2', 'Grease interceptor 750 gal']],
      ['Trim Set', '2026-11-17', ['HS-1', 'L-1', 'S-3', 'WH-1']],
    ])
    const noStage = groupRowsByStage([{ ...rows[0]!, stage: null }], stageDates)
    expect(noStage.map((g) => [g.label, g.neededOn])).toEqual([['No stage yet', null]])
  })

  it('words a date for the letter', () => {
    expect(monthDay('2026-09-05')).toBe('Sep 5')
    expect(longDate('2026-09-28')).toBe('September 28, 2026')
    expect(monthDay(null)).toBe('')
    expect(stageDatesWords({})).toBe('')
  })
})
