import { describe, expect, it } from 'vitest'
import { robotOfferText, robotSeatState, SEAT_LIVE_WINDOW_MS } from './robotOffer'

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
