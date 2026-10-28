import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { OFFICE_HOURS } from './hasRule'
import {
  backAt,
  backWords,
  holderOffWords,
  NO_PUSH_HOURS,
  parsePushHours,
  pushDecision,
  PUSH_HOURS_DEFAULT,
  PUSH_HOURS_WORDS,
  pushDraftFrom,
  pushDraftProblem,
  pushedNow,
  pushHoursLine,
  pushHoursOf,
  pushRowOf,
  samePushDraft,
  type PushHoursDraft,
} from './pushHours'

/** Mon to Fri, 6 AM to 8 PM, as the mock-up's example person set it. */
const WEEKDAYS = parsePushHours({ days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00' })!

/** Chicago, 2026-10-28 (a Wednesday, CDT = UTC−5). */
const wed = (hm: string) => `2026-10-28T${hm}:00-05:00`

describe('Push me (punch list #141 PR 2): the row read back', () => {
  it('reads a row as the office hours kernel reads hours, the switch off', () => {
    expect(WEEKDAYS).toEqual({ ...OFFICE_HOURS, days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00', always: false })
  })

  it('sorts and dedupes the days and pads the times', () => {
    expect(parsePushHours({ days: [5, 1, 3, 1], opens: '6:00', closes: '8:30' })).toMatchObject({ days: [1, 3, 5], opens: '06:00', closes: '08:30' })
  })

  it('reads no row, and any row it cannot read, as any time, so a bad row never holds a push', () => {
    expect(parsePushHours(null)).toBeNull()
    expect(parsePushHours(undefined)).toBeNull()
    expect(parsePushHours({ days: [], opens: '06:00', closes: '20:00' })).toBeNull()
    expect(parsePushHours({ days: [7], opens: '06:00', closes: '20:00' })).toBeNull()
    expect(parsePushHours({ days: 'weekdays', opens: '06:00', closes: '20:00' })).toBeNull()
    expect(parsePushHours({ days: [1], opens: 'six', closes: '20:00' })).toBeNull()
    expect(parsePushHours({ days: [1], opens: '20:00', closes: '06:00' })).toBeNull()
    expect(parsePushHours({ days: [1], opens: '09:00', closes: '09:00' })).toBeNull()
  })
})

describe('whether a push reaches the person now', () => {
  it('always, with no hours', () => {
    expect(pushedNow(wed('03:00'), null)).toBe(true)
    expect(backAt(wed('03:00'), null)).toBeNull()
  })

  it('inside the hours on a day that is on, from the from up to the to', () => {
    expect(pushedNow(wed('06:00'), WEEKDAYS)).toBe(true)
    expect(pushedNow(wed('12:00'), WEEKDAYS)).toBe(true)
    expect(pushedNow(wed('19:59'), WEEKDAYS)).toBe(true)
    expect(pushedNow(wed('20:00'), WEEKDAYS)).toBe(false)
    expect(pushedNow(wed('05:59'), WEEKDAYS)).toBe(false)
  })

  it('never on a day that is off, whatever the hour', () => {
    const sat = '2026-10-31T12:00:00-05:00'
    expect(pushedNow(sat, WEEKDAYS)).toBe(false)
    expect(pushedNow(sat, parsePushHours({ days: [6], opens: '06:00', closes: '20:00' }))).toBe(true)
    for (let d = 0; d <= 6; d++) {
      const only = parsePushHours({ days: [d], opens: '00:00', closes: '23:59' })
      expect(pushedNow(wed('12:00'), only), `day ${d}`).toBe(d === 3)
    }
  })

  it('says when the hours next open, Chicago, and null while pushed', () => {
    expect(backAt(wed('12:00'), WEEKDAYS)).toBeNull()
    expect(backAt(wed('21:00'), WEEKDAYS)).toBe('2026-10-29T11:00:00.000Z')
    // Friday night waits for Monday 6 AM, which is CST by then (UTC−6).
    expect(backAt('2026-10-30T21:00:00-05:00', WEEKDAYS)).toBe('2026-11-02T12:00:00.000Z')
  })
})

describe('the words', () => {
  it('reads the hours back as one line', () => {
    expect(pushHoursLine(WEEKDAYS)).toBe('Pushed Mon to Fri, 6:00 AM to 8:00 PM.')
    expect(pushHoursLine(PUSH_HOURS_DEFAULT)).toBe('Pushed every day, 6:00 AM to 8:00 PM.')
    expect(pushHoursLine(parsePushHours({ days: [6], opens: '07:30', closes: '12:00' }))).toBe('Pushed Sat, 7:30 AM to 12:00 PM.')
    expect(pushHoursLine(null)).toBe('Pushed any time.')
  })

  it('say the hold is real now, with nothing about the next update (PR 3)', () => {
    expect(PUSH_HOURS_WORDS.hold.startsWith('A push outside these hours waits for you.')).toBe(true)
    expect(PUSH_HOURS_WORDS.hold).not.toContain('next update')
  })

  it('are plain', () => {
    for (const [key, text] of Object.entries(PUSH_HOURS_WORDS)) {
      expect(plainWordsFailures(text), key).toEqual([])
    }
    expect(plainWordsFailures(pushHoursLine(WEEKDAYS))).toEqual([])
    expect(plainWordsFailures(holderOffWords('Dana', 'Luis', '2026-10-29T11:00:00.000Z', wed('21:00')))).toEqual([])
    expect(plainWordsFailures(holderOffWords('Dana', 'Luis', null, wed('21:00')))).toEqual([])
  })
})

describe('the hold (punch list #141 PR 3)', () => {
  const ROSA = 'u-rosa'
  const TOM = 'u-tom'
  const LUIS = 'u-luis'
  /** Rosa weekdays 6 to 8, Tom any time by a row he cleared, Luis no row. */
  const hours = new Map([
    [ROSA, WEEKDAYS],
    [TOM, null],
  ])

  it('splits one push into the people pushed now and the people held, each with when they are back', () => {
    expect(pushDecision({ userIds: [ROSA, TOM, LUIS] }, hours, wed('12:00'))).toEqual({ send: [ROSA, TOM, LUIS], held: [] })
    expect(pushDecision({ userIds: [ROSA, TOM, LUIS] }, hours, wed('21:00'))).toEqual({
      send: [TOM, LUIS],
      held: [{ userId: ROSA, backAt: '2026-10-29T11:00:00.000Z' }],
    })
  })

  it('pushes everyone with no hours read, and decides a person named twice once', () => {
    expect(pushDecision({ userIds: [ROSA, ROSA] }, NO_PUSH_HOURS, wed('21:00'))).toEqual({ send: [ROSA], held: [] })
    expect(pushDecision({ userIds: [ROSA, ROSA] }, hours, wed('21:00')).held).toHaveLength(1)
    expect(pushDecision({ userIds: [] }, hours, wed('21:00'))).toEqual({ send: [], held: [] })
  })

  it('says when a held person is back: the time within the day, the day and time past it', () => {
    expect(backWords('2026-10-29T11:00:00.000Z', wed('21:00'))).toBe('6 AM')
    expect(backWords('2026-10-28T12:30:00-05:00', wed('05:00'))).toBe('12:30 PM')
    // Friday night: Monday 6 AM, CST by then.
    expect(backWords('2026-11-02T12:00:00.000Z', '2026-10-30T21:00:00-05:00')).toBe('Mon 6 AM')
  })

  it('tells the office who is off and until when, then nothing more', () => {
    expect(holderOffWords('Dana', 'Luis', '2026-10-29T11:00:00.000Z', wed('21:00'))).toBe('Dana wrote to Luis, who is off until 6 AM.')
    expect(holderOffWords('Dana', 'Luis', '2026-11-02T12:00:00.000Z', '2026-10-30T21:00:00-05:00')).toBe('Dana wrote to Luis, who is off until Mon 6 AM.')
    expect(holderOffWords('Dana', 'Luis', null, wed('21:00'))).toBe('Dana wrote to Luis, who is off right now.')
  })
})

describe('the draft the block edits', () => {
  const d = (only: boolean, days: number[], opens: string, closes: string): PushHoursDraft => ({ only, days, opens, closes })

  it('starts from the hours as they are, or any time over the default window', () => {
    expect(pushDraftFrom(WEEKDAYS)).toEqual(d(true, [1, 2, 3, 4, 5], '06:00', '20:00'))
    expect(pushDraftFrom(null)).toEqual(d(false, [0, 1, 2, 3, 4, 5, 6], '06:00', '20:00'))
  })

  it('knows when nothing changed, and any time is any time whatever the hidden fields hold', () => {
    expect(samePushDraft(d(true, [1, 2], '06:00', '20:00'), d(true, [2, 1], '06:00', '20:00'))).toBe(true)
    expect(samePushDraft(d(true, [1, 2], '06:00', '20:00'), d(true, [1, 2], '06:00', '21:00'))).toBe(false)
    expect(samePushDraft(d(false, [1], '06:00', '20:00'), d(false, [3], '09:00', '10:00'))).toBe(true)
    expect(samePushDraft(d(false, [1], '06:00', '20:00'), d(true, [1], '06:00', '20:00'))).toBe(false)
  })

  it('stops a save with the block’s own words, the office card’s rule', () => {
    expect(pushDraftProblem(d(false, [], '', ''))).toBeNull()
    expect(pushDraftProblem(d(true, [], '06:00', '20:00'))).toBe('Pick at least one day.')
    expect(pushDraftProblem(d(true, [1], '', '20:00'))).toBe('Pick a from time and a to time.')
    expect(pushDraftProblem(d(true, [1], '20:00', '06:00'))).toBe('To must come after From.')
    expect(pushDraftProblem(d(true, [1], '06:00', '20:00'))).toBeNull()
  })

  it('turns a good draft into hours and a row, and any time into null', () => {
    expect(pushHoursOf(d(false, [1], '06:00', '20:00'))).toBeNull()
    expect(pushHoursOf(d(true, [1], '20:00', '06:00'))).toBeNull()
    const hours = pushHoursOf(d(true, [5, 1], '6:00', '20:00'))!
    expect(hours).toMatchObject({ days: [1, 5], opens: '06:00', closes: '20:00', always: false })
    expect(pushRowOf(hours)).toEqual({ days: [1, 5], opens: '06:00', closes: '20:00' })
  })
})
