import { describe, expect, it } from 'vitest'
import { lienMonthDayWords, lienMonthLine, lienMonthLineDue } from './lienMonthLine'
import { LIEN_MONTH_RULE, LIEN_MONTH_ZONE_LABEL, LIEN_MONTH_ZONE_WORK, type LienMonth, type LienMonthZone, type LienMonthZoneKey, type LienMonthZoneState } from './lienMonthRhythm'

const SPAN: Record<LienMonthZoneKey, { from: number; to: number }> = { reminders: { from: 1, to: 5 }, notices: { from: 6, to: 9 }, liens: { from: 10, to: 13 }, catch_up: { from: 14, to: 15 }, quiet: { from: 16, to: 30 } }

const zone = (key: LienMonthZoneKey, state: LienMonthZoneState, over: Partial<LienMonthZone> = {}): LienMonthZone => ({
  key, label: LIEN_MONTH_ZONE_LABEL[key], work: LIEN_MONTH_ZONE_WORK[key], span: SPAN[key], days: SPAN[key].to - SPAN[key].from + 1, state,
  left: 0, done: 0, slipped: 0, jobs: [], breakdown: '', copies: 0, queue: key === 'quiet' ? { reminders: 0, notices: 0, liens: 0 } : null, ...over,
})

/** A November with today in `at`; every zone before it is behind, every one after it ahead. */
const month = (at: LienMonthZoneKey, today: number, over: Partial<Record<LienMonthZoneKey, Partial<LienMonthZone>>> = {}): LienMonth => {
  const keys: LienMonthZoneKey[] = ['reminders', 'notices', 'liens', 'catch_up', 'quiet']
  const i = keys.indexOf(at)
  return { month: '2026-11', today, daysInMonth: 30, todayPct: (today / 30) * 100, zone: at, zones: keys.map((k, n) => zone(k, n < i ? 'behind' : n === i ? 'now' : 'ahead', over[k])), rule: LIEN_MONTH_RULE }
}

describe('lienMonthLine', () => {
  it('liens week: the headline is what is left to file, and the line under it places the day', () => {
    const line = lienMonthLine(month('liens', 13, { liens: { left: 9, done: 0 } }))
    expect(line.head).toBe('9 liens to file')
    expect(line.sub).toBe('November, day 13 · liens week')
    expect(line.tone).toBe('now')
    expect(line.chip).toBeNull()
  })

  it('one of a thing reads as one', () => {
    expect(lienMonthLine(month('liens', 10, { liens: { left: 1 } })).head).toBe('1 lien to file')
    expect(lienMonthLine(month('notices', 6, { notices: { left: 1 } })).head).toBe('1 notice to send')
    expect(lienMonthLine(month('reminders', 2, { reminders: { left: 4 } })).head).toBe('4 reminders to send')
  })

  it('with the day the first row is due, the headline says by when and the chip how long is left', () => {
    const m = month('liens', 13, { liens: { left: 9 } })
    const line = lienMonthLine(m, { ymd: '2026-11-16', daysLeft: 3 })
    expect(line.head).toBe('9 liens to file by Mon Nov 16')
    expect(line.chip).toEqual({ words: '3 days', tone: 'red' })
    expect(lienMonthLine(m, { ymd: '2026-11-13', daysLeft: 0 }).chip).toEqual({ words: 'today', tone: 'red' })
    expect(lienMonthLine(m, { ymd: '2026-11-12', daysLeft: -1 }).chip).toEqual({ words: '1 day late', tone: 'red' })
    expect(lienMonthLine(m, { ymd: '2026-11-18', daysLeft: 5 }).chip).toEqual({ words: '5 days', tone: 'amber' })
    expect(lienMonthLine(m, { ymd: '2026-11-30', daysLeft: 17 }).chip).toEqual({ words: '17 days', tone: 'quiet' })
  })

  it('what slipped earlier in the month is named under the headline, counted once', () => {
    const line = lienMonthLine(month('liens', 13, { reminders: { slipped: 3 }, notices: { slipped: 5 }, liens: { left: 9 }, catch_up: { slipped: 8, left: 8 } }))
    // Catch-up is ahead here and counts the same slips again, so it adds nothing.
    expect(line.sub).toBe('November, day 13 · liens week · 8 slipped earlier')
  })

  it('nothing left in today’s zone says what went, in the zone’s own words', () => {
    const done = lienMonthLine(month('liens', 12, { liens: { left: 0, done: 12 } }))
    expect(done.head).toBe('Liens: all 12 filed')
    expect(done.tone).toBe('done')
    const none = lienMonthLine(month('notices', 7, { notices: { left: 0, done: 0 } }))
    expect(none.head).toBe('Notices: nothing to send')
    // A due day is for work that is left; with none there is no chip.
    expect(lienMonthLine(month('liens', 12, { liens: { left: 0, done: 12 } }), { ymd: '2026-11-16', daysLeft: 4 }).chip).toBeNull()
  })

  it('catch-up days: what is left to catch up, or a clean month', () => {
    const slips = lienMonthLine(month('catch_up', 14, { catch_up: { left: 11, slipped: 11 } }))
    expect(slips.head).toBe('11 to catch up')
    expect(slips.tone).toBe('slipped')
    expect(slips.sub).toBe('November, day 14 · catch-up days')
    const clean = lienMonthLine(month('catch_up', 15))
    expect(clean.head).toBe('Nothing slipped this month')
    expect(clean.tone).toBe('done')
  })

  it('after the 15th: nothing scheduled, or what is queuing for next month', () => {
    expect(lienMonthLine(month('quiet', 20)).head).toBe('Nothing scheduled')
    const q = lienMonthLine(month('quiet', 20, { quiet: { queue: { reminders: 1, notices: 2, liens: 0 } } }))
    expect(q.head).toBe('Next month: 1 reminder · 2 notices')
    expect(q.tone).toBe('quiet')
    expect(q.sub).toBe('November, day 20 · nothing scheduled')
  })

  it('the strip has the five zones, each as wide as its days, and marks a zone that slipped', () => {
    const line = lienMonthLine(month('liens', 13, { reminders: { slipped: 3 }, liens: { left: 9 } }))
    expect(line.segments.map((s) => s.key)).toEqual(['reminders', 'notices', 'liens', 'catch_up', 'quiet'])
    expect(line.segments.map((s) => s.days)).toEqual([5, 4, 4, 2, 15])
    expect(line.segments.map((s) => s.state)).toEqual(['behind', 'behind', 'now', 'ahead', 'ahead'])
    expect(line.segments.map((s) => s.slipped)).toEqual([true, false, false, false, false])
  })
})

describe('lienMonthDayWords', () => {
  it('reads a civil date as a weekday, a month and a day, whatever the timezone', () => {
    expect(lienMonthDayWords('2026-11-16')).toBe('Mon Nov 16')
    expect(lienMonthDayWords('2026-11-01')).toBe('Sun Nov 1')
    expect(lienMonthDayWords('2027-01-15')).toBe('Fri Jan 15')
  })

  it('hands back what it cannot read', () => {
    expect(lienMonthDayWords('soon')).toBe('soon')
  })
})

describe('lienMonthLineDue', () => {
  const job = (jobId: string) => ({ jobId, title: jobId, state: 'left' as const, words: '' })
  const m = month('liens', 13, { liens: { left: 2, jobs: [job('a'), job('b')] }, notices: { slipped: 1, jobs: [{ ...job('c'), state: 'slipped' as const }] } })

  it('is the earliest day among the rows of today’s zone', () => {
    const due = lienMonthLineDue(m, [
      { kind: 'affidavit', jobId: 'a', action: 'file_affidavit', dueOn: '2026-11-17', daysLeft: 4 },
      { kind: 'affidavit', jobId: 'b', action: 'file_affidavit', dueOn: '2026-11-16', daysLeft: 3 },
    ])
    expect(due).toEqual({ ymd: '2026-11-16', daysLeft: 3 })
  })

  it('leaves out a row of another zone, a row with no day and a row with no job', () => {
    const due = lienMonthLineDue(m, [
      { kind: 'notice', jobId: 'c', action: 'draft', dueOn: '2026-11-10', daysLeft: -3 },
      { kind: 'affidavit', jobId: 'a', action: 'file_affidavit', dueOn: null, daysLeft: null },
      { kind: 'affidavit', jobId: null, action: 'file_affidavit', dueOn: '2026-11-01', daysLeft: -12 },
      { kind: 'affidavit', jobId: 'b', action: 'file_affidavit', dueOn: '2026-11-16', daysLeft: 3 },
    ])
    expect(due).toEqual({ ymd: '2026-11-16', daysLeft: 3 })
  })

  it('is null when today’s zone has no row with a day', () => {
    expect(lienMonthLineDue(m, [])).toBeNull()
    expect(lienMonthLineDue(month('quiet', 20), [{ kind: 'affidavit', jobId: 'a', action: 'file_affidavit', dueOn: '2026-11-16', daysLeft: -4 }])).toBeNull()
  })
})
