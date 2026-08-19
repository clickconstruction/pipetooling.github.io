import { describe, expect, it } from 'vitest'
import { nudgeScheduleBlockTimes } from './personDayBlockNudge'

describe('nudgeScheduleBlockTimes', () => {
  it('shifts the whole block both ways, duration preserved', () => {
    expect(nudgeScheduleBlockTimes('08:00', '12:00', 'shift-fwd')).toEqual({ ok: true, timeStart: '08:30', timeEnd: '12:30' })
    expect(nudgeScheduleBlockTimes('08:00', '12:00', 'shift-back')).toEqual({ ok: true, timeStart: '07:30', timeEnd: '11:30' })
  })

  it('moves only the end for end nudges', () => {
    expect(nudgeScheduleBlockTimes('08:00', '12:00', 'end-fwd')).toEqual({ ok: true, timeStart: '08:00', timeEnd: '12:30' })
    expect(nudgeScheduleBlockTimes('08:00', '12:00', 'end-back')).toEqual({ ok: true, timeStart: '08:00', timeEnd: '11:30' })
  })

  it('accepts HH:MM:SS column values', () => {
    expect(nudgeScheduleBlockTimes('08:00:00', '12:00:00', 'end-fwd')).toEqual({ ok: true, timeStart: '08:00', timeEnd: '12:30' })
  })

  it('refuses to cross the start of the day', () => {
    const r = nudgeScheduleBlockTimes('00:15', '04:00', 'shift-back')
    expect(r.ok).toBe(false)
  })

  it('refuses to run past the end of the day (shift and end alike)', () => {
    expect(nudgeScheduleBlockTimes('20:00', '23:45', 'shift-fwd').ok).toBe(false)
    expect(nudgeScheduleBlockTimes('20:00', '23:45', 'end-fwd').ok).toBe(false)
  })

  it('never shrinks a block below 30 minutes', () => {
    expect(nudgeScheduleBlockTimes('08:00', '08:45', 'end-back').ok).toBe(false)
    expect(nudgeScheduleBlockTimes('08:00', '09:00', 'end-back')).toEqual({ ok: true, timeStart: '08:00', timeEnd: '08:30' })
  })

  it('bails to Edit on malformed or inverted times', () => {
    expect(nudgeScheduleBlockTimes('', '12:00', 'shift-fwd').ok).toBe(false)
    expect(nudgeScheduleBlockTimes('12:00', '08:00', 'shift-fwd').ok).toBe(false)
  })
})
