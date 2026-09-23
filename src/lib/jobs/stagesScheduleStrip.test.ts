import { describe, expect, it } from 'vitest'
import type { StagesUpcomingAppointment } from '../stagesUpcomingSchedule'
import {
  buildTwoWeekStrip,
  deriveStagesWhen,
  describeStagesWhen,
  formatStripEnds,
  formatStripLast,
  stripWeekStartYmd,
} from './stagesScheduleStrip'

// Tue Sep 22 2026 — the day on Taunya's screen.
const TODAY = '2026-09-22'

function up(over: Partial<StagesUpcomingAppointment> = {}): StagesUpcomingAppointment {
  return {
    ymd: '2026-09-23',
    timeStart: '08:00:00',
    timeEnd: '10:00:00',
    assigneeNames: ['Abraham', 'Paige'],
    note: null,
    bookedYmds: ['2026-09-23', '2026-09-24', '2026-09-25'],
    lastYmd: '2026-09-25',
    visitCount: 3,
    ...over,
  }
}

describe('stripWeekStartYmd', () => {
  it('walks back to Monday', () => {
    expect(stripWeekStartYmd('2026-09-22')).toBe('2026-09-21') // Tue → Mon
    expect(stripWeekStartYmd('2026-09-21')).toBe('2026-09-21') // Mon
    expect(stripWeekStartYmd('2026-09-27')).toBe('2026-09-21') // Sun → the Monday before
  })
  it('rejects a bad key', () => {
    expect(stripWeekStartYmd('nope')).toBeNull()
  })
})

describe('buildTwoWeekStrip', () => {
  it('draws ten weekday cells, Monday first, today outlined, booked filled', () => {
    const s = buildTwoWeekStrip({ todayYmd: TODAY, bookedYmds: ['2026-09-23', '2026-09-24', '2026-09-25'] })
    expect(s.cells.map((c) => c.letter).join('')).toBe('MTWTFMTWTF')
    expect(s.cells.map((c) => c.ymd)[0]).toBe('2026-09-21')
    expect(s.cells.find((c) => c.today)?.ymd).toBe(TODAY)
    expect(s.cells.filter((c) => c.booked).map((c) => c.ymd)).toEqual(['2026-09-23', '2026-09-24', '2026-09-25'])
    expect(s.cells[5]!.weekStart).toBe(true) // the second Monday — weekends are dropped
    expect(s.cells.filter((c) => c.weekStart)).toHaveLength(1)
    expect(s.bookedInWindow).toBe(3)
    expect(s.laterCount).toBe(0)
  })

  it('marks only unbooked days before today as past', () => {
    const s = buildTwoWeekStrip({ todayYmd: TODAY, bookedYmds: ['2026-09-21'] })
    expect(s.cells[0]).toMatchObject({ ymd: '2026-09-21', booked: true, past: false })
    expect(s.cells[1]).toMatchObject({ ymd: TODAY, today: true, past: false })
    const s2 = buildTwoWeekStrip({ todayYmd: '2026-09-24', bookedYmds: [] })
    expect(s2.cells.slice(0, 3).every((c) => c.past)).toBe(true)
    expect(s2.cells[3]!.past).toBe(false)
  })

  it('shows a weekend cell only when a block sits on it', () => {
    const s = buildTwoWeekStrip({ todayYmd: TODAY, bookedYmds: ['2026-09-26'] }) // Saturday
    expect(s.cells.map((c) => c.letter).join('')).toBe('MTWTFSMTWTF')
    expect(s.cells[5]).toMatchObject({ ymd: '2026-09-26', weekend: true, booked: true })
  })

  it('counts booked days beyond next Sunday as later', () => {
    const s = buildTwoWeekStrip({ todayYmd: TODAY, bookedYmds: ['2026-09-23', '2026-10-05', '2026-10-06'] })
    expect(s.laterCount).toBe(2)
    expect(s.bookedInWindow).toBe(1)
  })

  it('ignores dates that are not YYYY-MM-DD', () => {
    const s = buildTwoWeekStrip({ todayYmd: TODAY, bookedYmds: ['garbage', '2026-09-23'] })
    expect(s.bookedInWindow).toBe(1)
  })
})

describe('deriveStagesWhen', () => {
  const base = { lastWorkDate: null, lastScheduleWorkDate: null, pctComplete: null, status: 'working', todayYmd: TODAY }

  it('scheduled: next window and the last booked day with the visit count', () => {
    const w = deriveStagesWhen({ ...base, upcoming: up() })
    expect(w).toEqual({
      kind: 'scheduled',
      nextYmd: '2026-09-23',
      nextWindow: '8–10 AM',
      nextNames: ['Abraham', 'Paige'],
      endsYmd: '2026-09-25',
      visits: 3,
    })
    expect(formatStripEnds(w as Extract<typeof w, { kind: 'scheduled' }>)).toBe('Fri Sep 25 · 3 visits')
  })

  it('scheduled, one visit: ends the same day', () => {
    const w = deriveStagesWhen({ ...base, upcoming: up({ bookedYmds: ['2026-09-23'], lastYmd: '2026-09-23', visitCount: 1 }) })
    expect(formatStripEnds(w as Extract<typeof w, { kind: 'scheduled' }>)).toBe('same day · 1 visit')
  })

  it('unscheduled Working job: amber, with the last worked day', () => {
    const w = deriveStagesWhen({ ...base, upcoming: null, lastWorkDate: '2026-09-17' })
    expect(w).toEqual({ kind: 'unscheduled', tone: 'amber', lastYmd: '2026-09-17', lastKind: 'worked' })
    expect(formatStripLast('2026-09-17', 'worked')).toBe('Thu Sep 17 · worked')
  })

  it('unscheduled with a past block nobody clocked: says booked, no hours', () => {
    const w = deriveStagesWhen({ ...base, upcoming: null, lastWorkDate: '2026-09-10', lastScheduleWorkDate: '2026-09-18' })
    expect(w).toMatchObject({ kind: 'unscheduled', lastYmd: '2026-09-18', lastKind: 'scheduled' })
    expect(formatStripLast('2026-09-18', 'scheduled')).toBe('Fri Sep 18 · booked, no hours')
  })

  it('unscheduled Waiting job: muted, not amber', () => {
    const w = deriveStagesWhen({ ...base, upcoming: null, status: 'waiting' })
    expect(w).toMatchObject({ kind: 'unscheduled', tone: 'muted', lastYmd: null, lastKind: null })
    expect(formatStripLast(null, null)).toBe('never worked')
  })

  it('done: 100 % with nothing booked, or a stage past Working', () => {
    expect(deriveStagesWhen({ ...base, upcoming: null, pctComplete: 100, lastWorkDate: '2026-09-21' })).toEqual({ kind: 'done', lastYmd: '2026-09-21' })
    expect(deriveStagesWhen({ ...base, upcoming: null, status: 'billed', lastWorkDate: '2026-09-01' })).toEqual({ kind: 'done', lastYmd: '2026-09-01' })
    expect(deriveStagesWhen({ ...base, upcoming: null, status: 'ready_to_bill' })).toEqual({ kind: 'done', lastYmd: null })
  })

  it('a booked future day beats 100 % — the calendar still says scheduled', () => {
    expect(deriveStagesWhen({ ...base, upcoming: up(), pctComplete: 100 }).kind).toBe('scheduled')
  })

  it('accepts timestamps for the last work date', () => {
    const w = deriveStagesWhen({ ...base, upcoming: null, lastWorkDate: '2026-09-17T14:00:00+00:00' })
    expect(w).toMatchObject({ lastYmd: '2026-09-17' })
  })
})

describe('describeStagesWhen', () => {
  it('reads as one sentence per state', () => {
    expect(describeStagesWhen(deriveStagesWhen({ upcoming: up(), lastWorkDate: null, lastScheduleWorkDate: null, pctComplete: null, status: 'working', todayYmd: TODAY })))
      .toBe('Next Wed Sep 23 8–10 AM · Abraham, Paige; ends Fri Sep 25 · 3 visits')
    expect(describeStagesWhen({ kind: 'unscheduled', tone: 'amber', lastYmd: '2026-09-17', lastKind: 'worked' }))
      .toBe('Not scheduled — last Thu Sep 17 · worked')
    expect(describeStagesWhen({ kind: 'done', lastYmd: null })).toBe('Done — nothing on the calendar')
    expect(describeStagesWhen({ kind: 'unscheduled', tone: 'muted', lastYmd: null, lastKind: null })).toBe('Not scheduled — never worked')
  })
})
