import { describe, expect, it } from 'vitest'
import { payWeeksEndingAt } from '../people/utilization'
import { plainWordsFailures } from '../plainWords'
import { sentenceParts } from '../valuesInPlace'
import {
  MY_TIME_DAY_FLOOR_SECONDS,
  MY_TIME_WEEKS,
  buildMyTimeWeeks,
  myTimeCappedSentence,
  myTimeColumnPct,
  myTimeDayLabel,
  myTimeDayTop,
  myTimeDuration,
  myTimeDurationWords,
  myTimeHm,
  myTimeOnClockSentence,
  myTimeSessionSeconds,
  myTimeWeekLabel,
  myTimeWeekRange,
  myTimeWeekSunday,
  myTimeWeekTop,
  type MyTimeSession,
} from './myTimeWeeks'

// Wednesday Nov 25, 2026, 2:30 PM Central (20:30 UTC). The week is Sun Nov 22 to Sat Nov 28.
const TODAY = '2026-11-25'
const NOW = Date.parse('2026-11-25T20:30:00Z')
const weeks = payWeeksEndingAt(TODAY, MY_TIME_WEEKS)

/** A session on the company clock in November: Central is UTC minus 6. */
const session = (day: string, inHm: string, outHm: string | null, over: Partial<MyTimeSession> = {}): MyTimeSession => {
  const at = (hm: string) => {
    const [h, m] = hm.split(':').map(Number)
    return new Date(Date.parse(`${day}T00:00:00Z`) + ((h ?? 0) + 6) * 3600_000 + (m ?? 0) * 60_000).toISOString()
  }
  return { work_date: day, clocked_in_at: at(inHm), clocked_out_at: outHm ? at(outHm) : null, ...over }
}

describe('buildMyTimeWeeks', () => {
  const built = buildMyTimeWeeks({
    weeks,
    todayYmd: TODAY,
    nowMs: NOW,
    sessions: [
      session('2026-11-23', '08:00', '16:15'),
      session('2026-11-24', '08:00', '12:00'),
      session('2026-11-24', '12:30', '16:00'),
      session('2026-11-25', '08:00', null),
      session('2026-11-18', '07:00', '15:00'),
      session('2026-09-01', '07:00', '15:00'),
    ],
  })
  const now = built[built.length - 1]!

  it('draws eight weeks of seven days, the current one last', () => {
    expect(built).toHaveLength(8)
    expect(built.every((w) => w.days.length === 7)).toBe(true)
    expect(now.current).toBe(true)
    expect(built.filter((w) => w.current)).toHaveLength(1)
    expect(now.week).toEqual({ start: '2026-11-22', end: '2026-11-28' })
    expect(now.days.map((d) => d.dow)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('adds a day up from its sessions, and a week from its days', () => {
    expect(now.days[1]!.seconds).toBe(8.25 * 3600)
    expect(now.days[2]!.seconds).toBe(7.5 * 3600)
    expect(now.days[2]!.sessions).toBe(2)
    expect(now.seconds).toBe((8.25 + 7.5 + 6.5) * 3600)
    expect(built[6]!.seconds).toBe(8 * 3600)
  })

  it('counts the session running today up to now, and says when it started', () => {
    expect(now.days[3]!.seconds).toBe(6.5 * 3600)
    expect(now.days[3]!.openSince).toBe(session(TODAY, '08:00', null).clocked_in_at)
    expect(now.days[1]!.openSince).toBeNull()
  })

  it('knows a day gone, today and a day still to come', () => {
    expect(now.days.map((d) => d.kind)).toEqual(['done', 'done', 'done', 'today', 'come', 'come', 'come'])
    expect(built[6]!.days.every((d) => d.kind === 'done')).toBe(true)
  })

  it('leaves out a session older than the weeks shown', () => {
    expect(built.reduce((a, w) => a + w.seconds, 0)).toBe((8.25 + 7.5 + 6.5 + 8) * 3600)
  })
})

describe('a session nobody closed', () => {
  it('counts for nothing once its day is gone', () => {
    expect(myTimeSessionSeconds(session('2026-11-24', '08:00', null), TODAY, NOW)).toBe(0)
  })

  it('is marked when the end-of-day stop closed it, until the office approves it', () => {
    const stopped = { work_date: '2026-11-22', clocked_in_at: '2026-11-22T15:15:00Z', clocked_out_at: '2026-11-23T05:59:59.999999Z' }
    const one = buildMyTimeWeeks({ weeks, todayYmd: TODAY, nowMs: NOW, sessions: [stopped] })
    expect(one[7]!.days[0]!.capped).toBe(true)
    expect(one[7]!.days[0]!.seconds).toBe(14 * 3600 + 44 * 60 + 59)
    const approved = buildMyTimeWeeks({ weeks, todayYmd: TODAY, nowMs: NOW, sessions: [{ ...stopped, approved_at: '2026-11-23T15:00:00Z' }] })
    expect(approved[7]!.days[0]!.capped).toBe(false)
    const closedByHand = buildMyTimeWeeks({ weeks, todayYmd: TODAY, nowMs: NOW, sessions: [session('2026-11-23', '08:00', '16:00')] })
    expect(closedByHand[7]!.days[1]!.capped).toBe(false)
  })
})

describe('the figures', () => {
  it('splits a time into whole hours and the minutes over', () => {
    expect(myTimeHm(14 * 3600 + 45 * 60 + 59)).toEqual({ h: 14, m: 45 })
    expect(myTimeHm(0)).toEqual({ h: 0, m: 0 })
    expect(myTimeHm(-5)).toEqual({ h: 0, m: 0 })
  })

  it('prints a figure on one line and inside a sentence', () => {
    expect(myTimeDuration(7 * 3600 + 24 * 60)).toBe('7h 24m')
    expect(myTimeDuration(45 * 60)).toBe('45m')
    expect(myTimeDuration(0)).toBe('0m')
    expect(myTimeDurationWords(14 * 3600 + 45 * 60)).toBe('14 h 45 m')
    expect(myTimeDurationWords(8 * 3600)).toBe('8 h')
    expect(myTimeDurationWords(45 * 60)).toBe('45 m')
  })

  it('draws a column against the tallest, never against a quota', () => {
    const built = buildMyTimeWeeks({ weeks, todayYmd: TODAY, nowMs: NOW, sessions: [session('2026-11-23', '08:00', '10:00'), session('2026-11-17', '06:00', '18:00')] })
    expect(myTimeDayTop(built[7]!)).toBe(MY_TIME_DAY_FLOOR_SECONDS)
    expect(myTimeDayTop(built[6]!)).toBe(12 * 3600)
    expect(myTimeWeekTop(built)).toBe(12 * 3600)
    expect(myTimeColumnPct(2 * 3600, MY_TIME_DAY_FLOOR_SECONDS)).toBe(25)
    expect(myTimeColumnPct(60, MY_TIME_DAY_FLOOR_SECONDS)).toBe(4)
    expect(myTimeColumnPct(0, MY_TIME_DAY_FLOOR_SECONDS)).toBe(0)
    expect(myTimeColumnPct(20 * 3600, MY_TIME_DAY_FLOOR_SECONDS)).toBe(100)
  })
})

describe('the words', () => {
  const built = buildMyTimeWeeks({ weeks, todayYmd: TODAY, nowMs: NOW, sessions: [session('2026-11-23', '08:00', '16:15')] })

  it('names each week', () => {
    expect(myTimeWeekLabel(built, 7)).toBe('This week')
    expect(myTimeWeekLabel(built, 6)).toBe('Last week')
    expect(myTimeWeekLabel(built, 4)).toBe('Week of Nov 1')
    expect(myTimeWeekLabel(built, 0)).toBe('Week of Oct 4')
    expect(myTimeWeekRange(built[4]!.week)).toBe('Nov 1 to Nov 7')
    expect(myTimeWeekSunday(built[4]!.week)).toBe('11/1')
    expect(myTimeWeekSunday(built[0]!.week)).toBe('10/4')
  })

  it('says a stopped day in plain words, with the day and the time marked', () => {
    const day = { ...built[7]!.days[0]!, seconds: 14 * 3600 + 45 * 60, capped: true }
    const office = myTimeCappedSentence(day, false)
    const self = myTimeCappedSentence(day, true)
    expect(sentenceParts(office).filter((p) => typeof p !== 'string')).toEqual([
      { kind: 'day', text: 'Sunday' },
      { kind: 'time', text: '14 h 45 m' },
    ])
    expect(office.endsWith('Ask the office to fix it.')).toBe(true)
    expect(self.endsWith('Press the day to fix it.')).toBe(true)
    const plain = sentenceParts(office).map((p) => (typeof p === 'string' ? p : p.text)).join('')
    expect(plainWordsFailures(plain)).toEqual([])
  })

  it('says a running clock, and reads a day aloud', () => {
    const line = myTimeOnClockSentence('8:00 AM')
    expect(sentenceParts(line).map((p) => (typeof p === 'string' ? p : p.text)).join('')).toBe('On the clock since 8:00 AM.')
    expect(myTimeDayLabel(built[7]!.days[1]!)).toBe('Monday Nov 23, 8 h 15 m')
    expect(myTimeDayLabel(built[7]!.days[3]!)).toBe('Wednesday Nov 25, 0 m, today')
    expect(myTimeDayLabel(built[7]!.days[5]!)).toBe('Friday Nov 27, still to come')
    expect(myTimeDayLabel({ ...built[7]!.days[0]!, seconds: 3600, capped: true })).toBe('Sunday Nov 22, 1 h, the clock stopped itself at midnight')
  })
})
