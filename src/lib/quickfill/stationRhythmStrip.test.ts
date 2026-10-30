import { describe, expect, it } from 'vitest'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { addDaysYmd } from './markHistory'
import { roundRows, type RoundRow } from './round'
import {
  RHYTHM_STRIP_CELLS,
  RHYTHM_STRIP_DAYS_BACK,
  filterRoundRows,
  rhythmDueYmd,
  rhythmMarksBySection,
  rhythmStripAxis,
  rhythmStripChip,
  roundHeadChipWords,
  roundHeadChips,
  stationRhythmStrip,
} from './stationRhythmStrip'

// A Wednesday at 3 p.m. company time (CDT), so a day's marks and the strip share one calendar.
const now = new Date('2026-10-28T20:00:00Z')
const todayYmd = calendarYmdInAppTzFromIso(now.toISOString())
const daysAgo = (d: number, h = 0) => new Date(now.getTime() - d * 86_400_000 - h * 3_600_000).toISOString()

function row(over: Partial<RoundRow>): RoundRow {
  return {
    sectionId: 'billed-awaiting-payment',
    label: 'Billed Awaiting Payment',
    personal: false,
    needsNote: false,
    state: 'due',
    rhythmDays: 3,
    overDays: 2,
    dueAtMs: null,
    count: 4,
    countSource: 'open',
    lastMarkedAt: daysAgo(5),
    lastMarkedByName: 'Rosa',
    ...over,
  }
}

describe('stationRhythmStrip · the cells', () => {
  it('runs fourteen days back to four ahead with today between', () => {
    const s = stationRhythmStrip(row({}), [], now)
    expect(s.cells).toHaveLength(RHYTHM_STRIP_CELLS)
    expect(s.todayIndex).toBe(RHYTHM_STRIP_DAYS_BACK)
    expect(s.cells[0]!.ymd).toBe(addDaysYmd(todayYmd, -14))
    expect(s.cells[14]!.ymd).toBe(todayYmd)
    expect(s.cells[14]!.today).toBe(true)
    expect(s.cells[18]!.ymd).toBe(addDaysYmd(todayYmd, 4))
    expect(s.cells.filter((c) => c.future).map((c) => c.ymd)).toEqual([1, 2, 3, 4].map((d) => addDaysYmd(todayYmd, d)))
  })

  it('a filled dot per day with a look, two marks one day counted, and the last five flagged as the rhythm', () => {
    const marks = [daysAgo(5), daysAgo(5, 3), daysAgo(8), daysAgo(11), daysAgo(13), daysAgo(16), daysAgo(20)]
    const s = stationRhythmStrip(row({}), marks, now)
    const byYmd = new Map(s.cells.map((c) => [c.ymd, c]))
    expect(byYmd.get(addDaysYmd(todayYmd, -5))).toMatchObject({ looks: 2, inRhythm: true })
    expect(byYmd.get(addDaysYmd(todayYmd, -8))).toMatchObject({ looks: 1, inRhythm: true })
    expect(byYmd.get(addDaysYmd(todayYmd, -11))).toMatchObject({ looks: 1, inRhythm: true })
    // The fifth mark back is the 13-days-ago one; the 16- and 20-day marks are off the strip and out of the rhythm.
    expect(byYmd.get(addDaysYmd(todayYmd, -13))).toMatchObject({ looks: 1, inRhythm: true })
    expect(s.cells.reduce((n, c) => n + c.looks, 0)).toBe(5)
    expect(s.words).toBe('5 looks in two weeks · every 3 d · due ' + dayWords(addDaysYmd(todayYmd, -2)) + ' · 2 d over · Rosa')
  })
})

function dayWords(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

describe('stationRhythmStrip · the due line and the red run', () => {
  it('a due station: the line at the last mark plus the rhythm, red from the day after up to today', () => {
    const s = stationRhythmStrip(row({ state: 'due', overDays: 2, lastMarkedAt: daysAgo(5), rhythmDays: 3 }), [daysAgo(5)], now)
    expect(s.dueYmd).toBe(addDaysYmd(todayYmd, -2))
    expect(s.duePlace).toBe('in')
    expect(s.dueIndex).toBe(12)
    expect(s.cells[12]!.due).toBe(true)
    expect(s.cells.filter((c) => c.late).map((c) => c.ymd)).toEqual([addDaysYmd(todayYmd, -1), todayYmd])
    expect(s.chip).toEqual({ words: '2 d over', tone: 'red' })
  })

  it('a station not yet due: the line ahead of today, nothing red', () => {
    const dueAtMs = now.getTime() + 2 * 86_400_000
    const s = stationRhythmStrip(row({ state: 'not_yet', overDays: null, dueAtMs, lastMarkedAt: daysAgo(5), rhythmDays: 7 }), [daysAgo(5)], now)
    expect(s.dueIndex).toBe(16)
    expect(s.cells.some((c) => c.late)).toBe(false)
    expect(s.chip.tone).toBe('grey')
    expect(s.chip.words.startsWith('due ')).toBe(true)
    expect(s.words).toBe(`1 look in two weeks · every 7 d · due ${dayWords(addDaysYmd(todayYmd, 2))} · Rosa`)
  })

  it('a due day further ahead than the strip, and one long before it', () => {
    const weekly = stationRhythmStrip(row({ state: 'not_yet', overDays: null, dueAtMs: now.getTime() + 6 * 86_400_000, lastMarkedAt: daysAgo(1), rhythmDays: 7 }), [daysAgo(1)], now)
    expect(weekly.duePlace).toBe('after')
    expect(weekly.dueIndex).toBeNull()
    const stale = stationRhythmStrip(row({ state: 'due', overDays: 17, lastMarkedAt: daysAgo(20), rhythmDays: 3 }), [daysAgo(20)], now)
    expect(stale.duePlace).toBe('before')
    expect(stale.cells.filter((c) => c.late)).toHaveLength(15)
    expect(stale.cells.reduce((n, c) => n + c.looks, 0)).toBe(0)
    expect(stale.words).toBe(`no look in two weeks · every 3 d · due ${dayWords(addDaysYmd(todayYmd, -17))} · 17 d over · Rosa`)
  })

  it('a station never marked: no dots, the line at day one, red to today', () => {
    const s = stationRhythmStrip(row({ state: 'never', overDays: null, rhythmDays: null, lastMarkedAt: null, lastMarkedByName: null, count: null, countSource: 'none' }), [], now)
    expect(s.dueIndex).toBe(0)
    expect(s.cells[0]!.due).toBe(true)
    expect(s.cells[0]!.late).toBe(false)
    expect(s.cells.filter((c) => c.late)).toHaveLength(14)
    expect(s.chip).toEqual({ words: 'never marked', tone: 'red' })
    expect(s.words).toBe('no look in two weeks · never marked')
  })

  it('under three marks the flat 30 h rule places the line', () => {
    const last = daysAgo(1, 16)
    expect(rhythmDueYmd(last, null)).toBe(calendarYmdInAppTzFromIso(new Date(Date.parse(last) + 30 * 3_600_000).toISOString()))
    expect(rhythmDueYmd(null, 3)).toBeNull()
    expect(rhythmDueYmd('nonsense', 3)).toBeNull()
    expect(rhythmDueYmd(daysAgo(5), 3)).toBe(addDaysYmd(todayYmd, -2))
  })

  it('a fresh station is green with its time, a personal door has no line and opens the page', () => {
    const fresh = stationRhythmStrip(row({ state: 'fresh', overDays: null, lastMarkedAt: daysAgo(0, 2), rhythmDays: 1 }), [daysAgo(0, 2), daysAgo(1, 2), daysAgo(2, 2)], now)
    expect(fresh.chip.tone).toBe('green')
    expect(fresh.chip.words).toMatch(/^fresh · \d{1,2}:\d{2} [AP]M$/)
    expect(fresh.cells.some((c) => c.late)).toBe(false)
    expect(fresh.dueIndex).toBe(15)
    const door = stationRhythmStrip(row({ sectionId: 'my-inbox', label: 'My Inbox', personal: true, state: 'never', rhythmDays: null, overDays: null, lastMarkedAt: null, lastMarkedByName: null }), [], now)
    expect(door.dueYmd).toBeNull()
    expect(door.duePlace).toBeNull()
    expect(door.cells.some((c) => c.late)).toBe(false)
    expect(door.chip).toEqual({ words: 'opens the page', tone: 'grey' })
    expect(door.words).toBe('no mark · opens the page')
  })

  it('an afternoon station before its hour reads after 3 p.m.', () => {
    expect(rhythmStripChip(row({ sectionId: 'office-leaving', state: 'due' }), now, 10)).toEqual({ words: 'after 3 p.m.', tone: 'grey' })
    expect(rhythmStripChip(row({ sectionId: 'office-leaving', state: 'due_today', overDays: null }), now, 16)).toEqual({ words: 'due today', tone: 'amber' })
  })
})

describe('rhythmStripAxis and the marks map', () => {
  it('labels the first day, today and the last day over the same cells', () => {
    const a = rhythmStripAxis(now)
    expect(a.cells).toBe(RHYTHM_STRIP_CELLS)
    expect(a.todayIndex).toBe(14)
    expect(a.today).toBe('today')
    expect(a.first).toBe(new Date(`${addDaysYmd(todayYmd, -14)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    expect(a.last).toBe(new Date(`${addDaysYmd(todayYmd, 4)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
  })

  it('groups the round events by station and skips a bad row', () => {
    const m = rhythmMarksBySection([
      { section_id: 'a', marked_at: daysAgo(1), outstanding_count: 0 },
      { section_id: 'b', marked_at: daysAgo(2), outstanding_count: 1 },
      { section_id: 'a', marked_at: daysAgo(3), outstanding_count: 0 },
      null as unknown as { section_id: string; marked_at: string; outstanding_count: number },
    ])
    expect(m.get('a')).toEqual([daysAgo(1), daysAgo(3)])
    expect(m.get('b')).toEqual([daysAgo(2)])
  })
})

describe('the phone head as chips', () => {
  const sections = [
    { sectionId: 'a', label: 'A', personal: false, needsNote: false },
    { sectionId: 'b', label: 'B', personal: false, needsNote: false },
    { sectionId: 'c', label: 'C', personal: false, needsNote: false },
    { sectionId: 'd', label: 'D', personal: false, needsNote: false },
    { sectionId: 'my-inbox', label: 'My Inbox', personal: true, needsNote: false },
  ]
  const marks = {
    a: { marked_at: daysAgo(19), marked_by_name: null },
    b: { marked_at: daysAgo(0, 2), marked_by_name: null },
    c: { marked_at: daysAgo(3), marked_by_name: null },
  }
  const events = [
    ...[19, 26, 33].map((d) => ({ section_id: 'a', marked_at: daysAgo(d), outstanding_count: 1 })),
    ...[0, 1, 2].map((d) => ({ section_id: 'b', marked_at: daysAgo(d, 2), outstanding_count: 0 })),
    ...[3, 10, 17].map((d) => ({ section_id: 'c', marked_at: daysAgo(d), outstanding_count: 0 })),
  ]
  const rows = roundRows(sections, marks, events, () => null, now)

  it('counts due (never included), due today, not yet and fresh; zero chips drop except due', () => {
    expect(rows.map((r) => [r.sectionId, r.state])).toEqual([
      ['a', 'due'],
      ['d', 'never'],
      ['c', 'not_yet'],
      ['b', 'fresh'],
      ['my-inbox', 'never'],
    ])
    expect(roundHeadChips(rows)).toEqual([
      { filter: 'due', label: 'due', n: 2, tone: 'red' },
      { filter: 'not_yet', label: 'not yet', n: 1, tone: 'grey' },
      { filter: 'fresh', label: 'fresh', n: 1, tone: 'green' },
    ])
    expect(roundHeadChips([])).toEqual([{ filter: 'due', label: 'due', n: 0, tone: 'red' }])
  })

  it('a pressed chip keeps only its stations and hides the doors; none pressed keeps every row', () => {
    expect(filterRoundRows(rows, 'due').map((r) => r.sectionId)).toEqual(['a', 'd'])
    expect(filterRoundRows(rows, 'fresh').map((r) => r.sectionId)).toEqual(['b'])
    expect(filterRoundRows(rows, 'due_today')).toEqual([])
    expect(filterRoundRows(rows, null)).toHaveLength(5)
    expect(roundHeadChipWords({ filter: 'due', label: 'due', n: 2, tone: 'red' }, false)).toBe('due · 2')
    expect(roundHeadChipWords({ filter: 'due', label: 'due', n: 2, tone: 'red' }, true)).toBe('due · 2 · showing only these')
  })
})
