import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { parsePushHours, type PushHoursByUser } from './pushHours'
import { coverageGaps, coverageLine, offPillTip, offPillWords, offThenWords, threadOff, type CoverageMember } from './whoIsOff'

/** Mon to Fri, 6 AM to 8 PM. */
const WEEKDAYS = parsePushHours({ days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00' })!
/** Every day, 6 AM to 8 PM: the default window. */
const EVERY_DAY = parsePushHours({ days: [0, 1, 2, 3, 4, 5, 6], opens: '06:00', closes: '20:00' })!

/** Chicago, 2026-10-28 (a Wednesday, CDT = UTC−5). */
const wed = (hm: string) => `2026-10-28T${hm}:00-05:00`
const fri = (hm: string) => `2026-10-30T${hm}:00-05:00`

const hours = (entries: Array<[string, ReturnType<typeof parsePushHours>]>): PushHoursByUser => new Map(entries)

describe('who is off on a thread (punch list #141 PR 4): the pill', () => {
  const base = { holderId: 'u-rosa', holderName: 'Rosa', mine: false, officeIds: ['u-rosa', 'u-evan', 'u-me'] }

  it('says the holder is off until their hours open, the time alone within the day and the day past it', () => {
    const rosa = hours([['u-rosa', WEEKDAYS]])
    expect(threadOff({ ...base, hours: rosa, now: wed('23:00') })).toEqual({ kind: 'holder', mine: false, name: 'Rosa', until: '6 AM' })
    expect(threadOff({ ...base, hours: rosa, now: fri('21:00') })).toEqual({ kind: 'holder', mine: false, name: 'Rosa', until: 'Mon 6 AM' })
  })

  it('says nobody is off while the holder is on, or has no row', () => {
    expect(threadOff({ ...base, hours: hours([['u-rosa', WEEKDAYS]]), now: wed('10:00') })).toBeNull()
    expect(threadOff({ ...base, hours: hours([]), now: wed('23:00') })).toBeNull()
    expect(threadOff({ ...base, hours: hours([['u-rosa', null]]), now: wed('23:00') })).toBeNull()
  })

  it('with nobody holding it, the office is off only while every member is, and is back when the first is', () => {
    const late = parsePushHours({ days: [1, 2, 3, 4, 5], opens: '05:00', closes: '21:00' })
    const all = hours([
      ['u-rosa', WEEKDAYS],
      ['u-evan', late],
      ['u-me', EVERY_DAY],
    ])
    expect(threadOff({ ...base, holderId: null, holderName: null, hours: all, now: wed('23:00') })).toEqual({ kind: 'office', until: '5 AM' })
    // Evan has no row: pushed any time, so the office is never off.
    expect(threadOff({ ...base, holderId: null, holderName: null, hours: hours([['u-rosa', WEEKDAYS]]), now: wed('23:00') })).toBeNull()
    expect(threadOff({ ...base, holderId: null, holderName: null, officeIds: [], hours: all, now: wed('23:00') })).toBeNull()
  })

  it('the words, plain', () => {
    const rosa = threadOff({ ...base, hours: hours([['u-rosa', WEEKDAYS]]), now: wed('23:00') })!
    const mine = threadOff({ ...base, mine: true, holderName: 'You', hours: hours([['u-rosa', WEEKDAYS]]), now: wed('23:00') })!
    const office = threadOff({ ...base, holderId: null, holderName: null, officeIds: ['u-rosa'], hours: hours([['u-rosa', WEEKDAYS]]), now: wed('23:00') })!
    expect(offPillWords(rosa)).toBe('off until 6 AM')
    expect(offPillWords(office)).toBe('the office is off until 6 AM')
    expect(offPillTip(rosa)).toBe('Rosa has the replies and is off until 6 AM. The office hears at once. Rosa sees what waited on their Dashboard at 6 AM.')
    expect(offPillTip(mine)).toBe('You are off until 6 AM, so a push waits for you. The office hears at once. Your Dashboard lists what waited.')
    expect(offPillTip(office)).toBe('Everyone in the office is off until 6 AM. The reply waits on Needs a reply. Each of them sees it on their Dashboard at 6 AM.')
    for (const words of [offPillTip(rosa), offPillTip(mine), offPillTip(office)]) expect(plainWordsFailures(words)).toEqual([])
  })
})

describe('the coverage line (punch list #141 PR 4): where the switch and the people’s hours meet', () => {
  const member = (name: string, h: CoverageMember['hours']): CoverageMember => ({ name, hours: h })
  const DAY = 24 * 60

  it('everyone on the same window every day: one gap a night, said once', () => {
    const members = [member('Rosa Delgado', EVERY_DAY), member('Evan Hart', EVERY_DAY), member('Taunya Reed', EVERY_DAY)]
    const gaps = coverageGaps(members)
    expect(gaps).toHaveLength(7)
    expect(gaps.every((g) => g.start % DAY === 20 * 60 && g.end - g.start === 10 * 60)).toBe(true)
    expect(coverageLine(gaps, members.map((m) => m.name))).toBe('Nobody hears a reply from 8 PM to 6 AM. Rosa, Evan and Taunya are all off then.')
  })

  it('weekdays only: the nights named by day, and the weekend as one stretch from Friday to Monday', () => {
    const members = [member('Rosa', WEEKDAYS), member('Evan', WEEKDAYS)]
    const line = coverageLine(coverageGaps(members), ['Rosa', 'Evan'])
    expect(line).toBe('Nobody hears a reply from 8 PM to 6 AM on Mon to Thu. Nobody hears a reply from Fri 8 PM to Mon 6 AM. Rosa and Evan are both off then.')
  })

  it('windows that meet cover the day between them: two shifts leave one gap a night', () => {
    const early = parsePushHours({ days: [0, 1, 2, 3, 4, 5, 6], opens: '06:00', closes: '14:00' })
    const late = parsePushHours({ days: [0, 1, 2, 3, 4, 5, 6], opens: '14:00', closes: '22:00' })
    expect(coverageLine(coverageGaps([member('Rosa', early), member('Evan', late)]), ['Rosa', 'Evan'])).toBe('Nobody hears a reply from 10 PM to 6 AM. Rosa and Evan are both off then.')
  })

  it('no gap when anyone is pushed any time, or around the clock, or when there is nobody to read', () => {
    expect(coverageGaps([member('Rosa', WEEKDAYS), member('Evan', null)])).toEqual([])
    expect(coverageGaps([member('Rosa', { ...WEEKDAYS, always: true })])).toEqual([])
    expect(coverageGaps([])).toEqual([])
    expect(coverageLine([], ['Rosa'])).toBeNull()
  })

  it('names the people: one, two, many, and a count past six', () => {
    expect(offThenWords(['Rosa Delgado'])).toBe('Rosa is off then.')
    expect(offThenWords(['Rosa', 'Evan'])).toBe('Rosa and Evan are both off then.')
    expect(offThenWords(['Rosa', 'Evan', 'Taunya'])).toBe('Rosa, Evan and Taunya are all off then.')
    expect(offThenWords(['A', 'B', 'C', 'D', 'E', 'F', 'G'])).toBe('All 7 of the office are off then.')
    expect(offThenWords([])).toBe('')
  })

  it('the words, plain', () => {
    const line = coverageLine(coverageGaps([member('Rosa', WEEKDAYS), member('Evan', WEEKDAYS)]), ['Rosa', 'Evan'])!
    expect(plainWordsFailures(line)).toEqual([])
  })
})
