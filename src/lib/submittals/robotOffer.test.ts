import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { robotOfferText, robotSeatState, SEAT_LIVE_WINDOW_MS, staleAsk } from './robotOffer'

const now = Date.parse('2026-09-29T18:00:00Z')
const ago = (ms: number) => new Date(now - ms).toISOString()

describe('robotSeatState (v2.4136)', () => {
  it('no seat, or a seat never used, is not live', () => {
    expect(robotSeatState(null, now)).toEqual({ live: false, line: 'No robot seat exists.' })
    expect(robotSeatState({ unrevoked_seats: 0, last_used_at: ago(1000) }, now)).toEqual({ live: false, line: 'No robot seat exists.' })
    expect(robotSeatState({ unrevoked_seats: 2, last_used_at: null }, now)).toEqual({ live: false, line: 'No robot has run yet.' })
  })
  it('a seat used inside seven days is live, and the line says how long ago', () => {
    expect(robotSeatState({ unrevoked_seats: 1, last_used_at: ago(12 * 60_000) }, now)).toEqual({ live: true, line: 'A robot was working 12 min ago.' })
    expect(robotSeatState({ unrevoked_seats: 1, last_used_at: ago(5 * 3_600_000) }, now)).toEqual({ live: true, line: 'A robot last ran 5 h ago.' })
    expect(robotSeatState({ unrevoked_seats: 1, last_used_at: ago(3 * 86_400_000) }, now)).toEqual({ live: true, line: 'A robot last ran 3 days ago.' })
    expect(robotSeatState({ unrevoked_seats: 1, last_used_at: ago(SEAT_LIVE_WINDOW_MS + 86_400_000) }, now)).toEqual({ live: false, line: 'No robot has run in 8 days.' })
  })
})

describe('robotOfferText (v2.4136)', () => {
  it('every kind says what it does, what it needs, what you do after, and names its button', () => {
    for (const kind of ['read_schedule', 'file_cut_sheets', 'read_redlines'] as const) {
      const t = robotOfferText(kind, { hasPlans: true })
      expect(t.does).toMatch(/^The robot can /)
      expect(t.needs.text).toMatch(/^Needs /)
      expect(t.after).toMatch(/You (tick|confirm)/)
      expect(t.button).toMatch(/^Ask the robot to /)
      for (const s of [t.does, t.after]) for (const sentence of s.split(/(?<=[.?!])\s+/)) expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20)
    }
  })
  it('the schedule read needs the plans on the bid', () => {
    expect(robotOfferText('read_schedule', { hasPlans: true }).needs).toEqual({ ok: true, text: 'Needs the plans on this bid ✓' })
    expect(robotOfferText('read_schedule', { hasPlans: false }).needs).toEqual({ ok: false, text: 'Needs the plans on this bid ✗ Add the plans link on the bid first.' })
  })
})

describe('staleAsk (2026-10-03): a queued ask that nobody is coming for', () => {
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })
  const live = robotSeatState({ unrevoked_seats: 1, last_used_at: ago(12 * 60_000) }, now)
  const gone = robotSeatState({ unrevoked_seats: 1, last_used_at: ago(12 * 86_400_000) }, now)

  it('an ask made minutes ago with a robot awake is an ordinary wait', () => {
    expect(staleAsk('read_schedule', ago(10 * 60_000), live, now, day)).toBeNull()
    expect(staleAsk('read_schedule', null, gone, now, day)).toBeNull()
  })

  it('no robot on shift: the line says the day it was asked, that nobody is coming, and what to do by hand', () => {
    // BP375: asked four days ago, no seat used in twelve.
    expect(staleAsk('read_schedule', ago(4 * 86_400_000), gone, now, day)).toEqual({
      daysWaited: 4,
      head: 'You asked the robot on Sep 25. No robot has run in 12 days.',
      detail: 'Nobody is reading the plans. Type the schedule yourself, or leave the ask in place.',
      suffix: 'asked Sep 25 · no robot has run in 12 days',
    })
    expect(staleAsk('file_cut_sheets', ago(60_000), robotSeatState(null, now), now, day)?.suffix).toBe('asked Sep 29 · no robot seat exists')
    expect(staleAsk('read_redlines', ago(60_000), gone, now, day)?.detail).toBe('Nobody is reading this file. Type their answers yourself, or leave the ask in place.')
  })

  it('a robot is awake but has not taken it in a day: it says that, not how lately one ran', () => {
    expect(staleAsk('read_schedule', ago(2 * 86_400_000), live, now, day)).toMatchObject({ head: 'You asked the robot on Sep 27. A robot was working 12 min ago. It has not picked this up.', suffix: 'asked Sep 27 · not picked up yet' })
  })

  it('v2.4690 · a week on, the ask is old: the line counts the days and says nobody came, whether or not a robot is awake', () => {
    expect(staleAsk('read_schedule', ago(8 * 86_400_000), live, now, day)).toEqual({ daysWaited: 8, head: 'You asked the robot 8 days ago. Nobody has picked it up.', detail: 'Nobody is reading the plans. Type the schedule yourself, or leave the ask in place.', suffix: 'asked 8 days ago · nobody picked it up' })
    expect(staleAsk('file_cut_sheets', ago(7 * 86_400_000), gone, now, day)?.suffix).toBe('asked 7 days ago · nobody picked it up')
    expect(staleAsk('read_schedule', ago(6 * 86_400_000), live, now, day)?.daysWaited).toBe(6)
  })

  it('reads in plain words', () => {
    for (const kind of ['read_schedule', 'file_cut_sheets', 'read_redlines'] as const) {
      const a = staleAsk(kind, ago(4 * 86_400_000), gone, now, day)!
      for (const sentence of `${a.head} ${a.detail}`.split(/(?<=[.?!])\s+/)) expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20)
      expect(`${a.head} ${a.detail}`).not.toMatch(/[—;()]/)
    }
  })
})
