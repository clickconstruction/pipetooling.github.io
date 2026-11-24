import { describe, expect, it } from 'vitest'
import {
  MODE_ROW_AWAY_MS,
  MODE_ROW_DEAD_MS,
  MODE_ROW_GONE,
  MODE_ROW_OUT_MS,
  MODE_ROW_SHOW_MS,
  modeRowCountDeadline,
  modeRowBackIsVisit,
  modeRowCountStep,
  modeRowOnScreen,
  modeRowSamePlaceVisit,
  modeRowTakesPress,
  type ModeRowCount,
  type ModeRowCountEvent,
  type ModeRowPlace,
} from './modeRowCount'

/** Feed the count a run of events, in order. */
function run(events: ModeRowCountEvent[], from: ModeRowCount = MODE_ROW_GONE): ModeRowCount {
  return events.reduce(modeRowCountStep, from)
}

const T0 = 1_000_000
const arrive = (now = T0, slideIn = false): ModeRowCountEvent => ({ type: 'arrive', now, slideIn })
const time = (now: number): ModeRowCountEvent => ({ type: 'time', now })
const LEAVE_MS = MODE_ROW_OUT_MS + MODE_ROW_DEAD_MS

describe('the five seconds', () => {
  it('a visit shows the row for five seconds, whole', () => {
    expect(MODE_ROW_SHOW_MS).toBe(5000)
    const shown = run([arrive()])
    expect(shown).toEqual({ phase: 'showing', showing: 1, slideIn: false, endsAt: T0 + 5000 })
    expect(modeRowCountDeadline(shown)).toBe(T0 + 5000)
    expect(modeRowOnScreen(shown)).toBe(true)
    expect(modeRowTakesPress(shown)).toBe(true)
  })

  it('stays until the five seconds are up, then leaves, then is gone', () => {
    expect(run([arrive(), time(T0 + 4999)]).phase).toBe('showing')
    const leaving = run([arrive(), time(T0 + 5000)])
    expect(leaving).toEqual({ phase: 'leaving', showing: 1, goneAt: T0 + 5000 + LEAVE_MS })
    expect(modeRowCountDeadline(leaving)).toBe(T0 + 5000 + LEAVE_MS)
    expect(run([arrive(), time(T0 + 5000), time(T0 + 5000 + LEAVE_MS - 1)]).phase).toBe('leaving')
    const gone = run([arrive(), time(T0 + 5000), time(T0 + 5000 + LEAVE_MS)])
    expect(gone).toEqual({ phase: 'gone', showing: 1 })
    expect(modeRowCountDeadline(gone)).toBeNull()
    expect(modeRowOnScreen(gone)).toBe(false)
  })

  it('a row on its way out is still on the page, as the dead strip, and takes no press', () => {
    const leaving = run([arrive(), time(T0 + 5000)])
    expect(modeRowOnScreen(leaving)).toBe(true)
    expect(modeRowTakesPress(leaving)).toBe(false)
    expect(run([{ type: 'press', now: T0 + 5100 }], leaving)).toBe(leaving)
    expect(run([{ type: 'touch', now: T0 + 5100, hold: 'finger' }], leaving)).toBe(leaving)
    // The strip stays dead for the slide and a moment more.
    expect(LEAVE_MS).toBe(540)
  })

  it('slides in only when the arrival says so, and a row already showing is not slid in again', () => {
    expect(run([arrive(T0, true)])).toMatchObject({ phase: 'showing', slideIn: true })
    expect(run([arrive(T0, false), arrive(T0 + 1000, true)])).toEqual({ phase: 'showing', showing: 2, slideIn: false, endsAt: T0 + 6000 })
    // Brought back while it is on its way out: it slides down again.
    expect(run([arrive(), time(T0 + 5000), arrive(T0 + 5100, true)])).toEqual({ phase: 'showing', showing: 2, slideIn: true, endsAt: T0 + 10100 })
  })
})

describe('a hold', () => {
  it('a finger on the row holds it past five seconds', () => {
    const held = run([arrive(), { type: 'touch', now: T0 + 4900, hold: 'finger' }])
    expect(held).toEqual({ phase: 'held', showing: 1, slideIn: false, holds: ['finger'] })
    expect(modeRowCountDeadline(held)).toBeNull()
    expect(run([time(T0 + 60_000)], held)).toBe(held)
    expect(modeRowTakesPress(held)).toBe(true)
  })

  it('the count starts whole when the finger lifts, never where it stopped', () => {
    const state = run([arrive(), { type: 'touch', now: T0 + 4900, hold: 'finger' }, { type: 'release', now: T0 + 9000, hold: 'finger' }])
    expect(state).toEqual({ phase: 'showing', showing: 2, slideIn: false, endsAt: T0 + 9000 + 5000 })
  })

  it('a finger and a focus each hold: the row waits for both to lift', () => {
    const both = run([arrive(), { type: 'touch', now: T0 + 100, hold: 'focus' }, { type: 'touch', now: T0 + 200, hold: 'finger' }, { type: 'touch', now: T0 + 300, hold: 'finger' }])
    expect(both).toMatchObject({ phase: 'held', holds: ['focus', 'finger'] })
    const one = run([{ type: 'release', now: T0 + 400, hold: 'finger' }], both)
    expect(one).toMatchObject({ phase: 'held', holds: ['focus'] })
    expect(run([{ type: 'release', now: T0 + 400, hold: 'finger' }], one)).toBe(one)
    expect(run([{ type: 'release', now: T0 + 700, hold: 'focus' }], one)).toEqual({ phase: 'showing', showing: 2, slideIn: false, endsAt: T0 + 5700 })
  })

  it('an arrival under a hold leaves the row held', () => {
    const held = run([arrive(), { type: 'touch', now: T0 + 100, hold: 'finger' }])
    expect(run([arrive(T0 + 200, true)], held)).toBe(held)
  })

  it('a release with nothing held changes nothing', () => {
    const shown = run([arrive()])
    expect(run([{ type: 'release', now: T0 + 100, hold: 'finger' }], shown)).toBe(shown)
    expect(run([{ type: 'release', now: T0 + 100, hold: 'finger' }])).toBe(MODE_ROW_GONE)
  })
})

describe('a press, a swipe and a page left', () => {
  it('a press gets a fresh five seconds', () => {
    expect(run([arrive(), { type: 'press', now: T0 + 3000 }])).toEqual({ phase: 'showing', showing: 2, slideIn: false, endsAt: T0 + 8000 })
  })

  it('a press under a finger leaves the hold to start the count', () => {
    const held = run([arrive(), { type: 'touch', now: T0 + 100, hold: 'finger' }])
    expect(run([{ type: 'press', now: T0 + 200 }], held)).toBe(held)
  })

  it('a swipe up sends the row away at once, held or not', () => {
    expect(run([arrive(), { type: 'swipe', now: T0 + 1000 }])).toEqual({ phase: 'leaving', showing: 1, goneAt: T0 + 1000 + LEAVE_MS })
    expect(run([arrive(), { type: 'touch', now: T0 + 900, hold: 'finger' }, { type: 'swipe', now: T0 + 1000 }]).phase).toBe('leaving')
    expect(run([{ type: 'swipe', now: T0 }])).toBe(MODE_ROW_GONE)
  })

  it('a page left, or a phone put away, takes the row off at once from any state', () => {
    expect(run([arrive(), { type: 'hide' }])).toEqual({ phase: 'gone', showing: 1 })
    expect(run([arrive(), { type: 'touch', now: T0, hold: 'finger' }, { type: 'hide' }])).toEqual({ phase: 'gone', showing: 1 })
    expect(run([arrive(), time(T0 + 5000), { type: 'hide' }])).toEqual({ phase: 'gone', showing: 1 })
    expect(run([{ type: 'hide' }])).toBe(MODE_ROW_GONE)
  })

  it('a timer that rings with nothing due changes nothing', () => {
    expect(run([time(T0)])).toBe(MODE_ROW_GONE)
    const shown = run([arrive()])
    expect(run([time(T0 + 10)], shown)).toBe(shown)
  })

  it('every whole start is numbered, so the bar is drawn again for each', () => {
    const state = run([arrive(), { type: 'press', now: T0 + 1 }, { type: 'touch', now: T0 + 2, hold: 'finger' }, { type: 'release', now: T0 + 3, hold: 'finger' }, time(T0 + 5003), time(T0 + 6000), arrive(T0 + 7000)])
    expect(state.showing).toBe(4)
  })
})

describe('what counts as a visit', () => {
  const dash: ModeRowPlace = { pathname: '/dashboard', search: '', key: 'a' }

  it('a press on the Dashboard link while on the Dashboard: the router moved and the address did not', () => {
    expect(modeRowSamePlaceVisit(dash, { ...dash, key: 'b' })).toBe(true)
    expect(modeRowSamePlaceVisit({ ...dash, search: '?tab=today' }, { ...dash, search: '?tab=today', key: 'b' })).toBe(true)
  })

  it('a window or a tab of the page opening changes the query, and is no visit', () => {
    expect(modeRowSamePlaceVisit(dash, { ...dash, search: '?task=12', key: 'b' })).toBe(false)
    expect(modeRowSamePlaceVisit({ ...dash, search: '?task=12' }, { ...dash, key: 'b' })).toBe(false)
    expect(modeRowSamePlaceVisit(dash, { ...dash, search: '#top', key: 'b' })).toBe(false)
  })

  it('a draw with no move is no visit, nor is the first place the row sees, nor a move from another page', () => {
    expect(modeRowSamePlaceVisit(dash, { ...dash })).toBe(false)
    expect(modeRowSamePlaceVisit(null, dash)).toBe(false)
    expect(modeRowSamePlaceVisit({ pathname: '/jobs', search: '', key: 'a' }, { ...dash, key: 'b' })).toBe(false)
  })

  it('coming back to the app is a visit after a minute away, and not after a glance elsewhere', () => {
    expect(MODE_ROW_AWAY_MS).toBe(60_000)
    expect(modeRowBackIsVisit(T0, T0 + 10_000)).toBe(false)
    expect(modeRowBackIsVisit(T0, T0 + 59_999)).toBe(false)
    expect(modeRowBackIsVisit(T0, T0 + 60_000)).toBe(true)
    expect(modeRowBackIsVisit(T0, T0 + 3_600_000)).toBe(true)
    expect(modeRowBackIsVisit(null, T0)).toBe(false)
  })
})
