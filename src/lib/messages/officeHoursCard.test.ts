import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { OFFICE_HOURS, parseOfficeHours } from './hasRule'
import {
  DAY_LONG,
  DAY_SHORT,
  daysWords,
  draftFrom,
  draftProblem,
  hoursLine,
  OFFICE_HOURS_WORDS,
  officeHoursSet,
  sameDraft,
  serializeOfficeHours,
  techHourLine,
  timeWords,
  toggleDay,
  type OfficeHoursDraft,
} from './officeHoursCard'

/** A draft with the switch off, as the card held every draft before punch list #141. */
const d = (days: number[], opens: string, closes: string, always = false): OfficeHoursDraft => ({ always, days, opens, closes })

describe('the Office hours card (punch list #140 PR 1)', () => {
  it('starts its draft from the hours as they are', () => {
    expect(draftFrom(OFFICE_HOURS)).toEqual({ always: false, days: [1, 2, 3, 4, 5], opens: '07:30', closes: '17:00' })
    expect(draftFrom({ ...OFFICE_HOURS, days: [5, 1, 3, 1] })).toEqual({ always: false, days: [1, 3, 5], opens: '07:30', closes: '17:00' })
    expect(draftFrom({ ...OFFICE_HOURS, always: true })).toEqual({ always: true, days: [1, 2, 3, 4, 5], opens: '07:30', closes: '17:00' })
  })

  it('knows when nothing changed, whatever order the days are in, the switch counted', () => {
    expect(sameDraft(d([1, 2], '07:30', '17:00'), d([2, 1], '07:30 ', '17:00'))).toBe(true)
    expect(sameDraft(d([1, 2], '07:30', '17:00'), d([1], '07:30', '17:00'))).toBe(false)
    expect(sameDraft(d([1], '07:30', '17:00'), d([1], '08:00', '17:00'))).toBe(false)
    expect(sameDraft(d([1], '07:30', '17:00'), d([1], '07:30', '17:00', true))).toBe(false)
    expect(sameDraft(d([1], '07:30', '17:00', true), d([1], '07:30', '17:00', true))).toBe(true)
  })

  it('presses a day on or off and keeps the list sorted', () => {
    expect(toggleDay([1, 2, 3], 6)).toEqual([1, 2, 3, 6])
    expect(toggleDay([1, 2, 3, 6], 0)).toEqual([0, 1, 2, 3, 6])
    expect(toggleDay([1, 2, 3], 2)).toEqual([1, 3])
  })

  it('says what stops a save: no days, a time it cannot read, a close at or before the open', () => {
    expect(draftProblem(d([1], '07:30', '17:00'))).toBeNull()
    expect(draftProblem(d([], '07:30', '17:00'))).toBe(OFFICE_HOURS_WORDS.noDays)
    expect(draftProblem(d([1], '', '17:00'))).toBe(OFFICE_HOURS_WORDS.badTime)
    expect(draftProblem(d([1], '07:30', '25:00'))).toBe(OFFICE_HOURS_WORDS.badTime)
    expect(draftProblem(d([1], '17:00', '17:00'))).toBe(OFFICE_HOURS_WORDS.closeBeforeOpen)
    expect(draftProblem(d([1], '18:00', '09:00'))).toBe(OFFICE_HOURS_WORDS.closeBeforeOpen)
  })

  it('lets nothing stop a save while the switch is on: the days and times are hidden', () => {
    expect(draftProblem(d([], '07:30', '17:00', true))).toBeNull()
    expect(draftProblem(d([1], '18:00', '09:00', true))).toBeNull()
  })

  it('writes the days and times, keeps the tech’s hour and the after-hours number, and stamps when it saved', () => {
    const current = { ...OFFICE_HOURS, techUntil: '16:00', emergency: '512-555-0144' }
    const json = serializeOfficeHours(current, d([6, 1, 2], '8:00', '17:30'), '2026-10-21T15:00:00.000Z')
    expect(JSON.parse(json)).toEqual({ days: [1, 2, 6], opens: '08:00', closes: '17:30', techUntil: '16:00', emergency: '512-555-0144', always: false, savedAt: '2026-10-21T15:00:00.000Z' })
    // The rule reads it back as written and ignores the stamp.
    expect(parseOfficeHours(json)).toEqual({ days: [1, 2, 6], opens: '08:00', closes: '17:30', techUntil: '16:00', emergency: '512-555-0144', always: false })
    expect(officeHoursSet(json)).toBe(true)
  })

  it('writes the switch on with the days and times kept, so the switch off puts them back (punch list #141 PR 1)', () => {
    const current = { ...OFFICE_HOURS, days: [1, 2, 3], opens: '08:00', closes: '16:00' }
    const on = serializeOfficeHours(current, { ...draftFrom(current), always: true }, '2026-10-21T15:00:00.000Z')
    expect(JSON.parse(on)).toEqual({ days: [1, 2, 3], opens: '08:00', closes: '16:00', techUntil: '17:00', emergency: null, always: true, savedAt: '2026-10-21T15:00:00.000Z' })
    const read = parseOfficeHours(on)
    expect(read).toEqual({ days: [1, 2, 3], opens: '08:00', closes: '16:00', techUntil: '17:00', emergency: null, always: true })
    expect(hoursLine(read)).toBe('Open around the clock')
    // Off again: the draft starts from the kept hours, and the save writes them as they were.
    const off = serializeOfficeHours(read, { ...draftFrom(read), always: false }, '2026-10-22T15:00:00.000Z')
    expect(parseOfficeHours(off)).toEqual({ days: [1, 2, 3], opens: '08:00', closes: '16:00', techUntil: '17:00', emergency: null, always: false })
    expect(hoursLine(parseOfficeHours(off))).toBe('Mon to Wed, 8:00 AM to 4:00 PM')
  })

  it('reads the tech’s hour back as a line', () => {
    expect(techHourLine('17:00')).toBe('A tech who texts a customer keeps the replies until 5:00 PM.')
    expect(techHourLine('16:30')).toBe('A tech who texts a customer keeps the replies until 4:30 PM.')
  })

  it('reads a row the card never saved as not set', () => {
    expect(officeHoursSet(null)).toBe(false)
    expect(officeHoursSet('')).toBe(false)
    expect(officeHoursSet('{"days":[1,2,3,4,5],"opens":"07:30","closes":"17:00","techUntil":"17:00","emergency":null}')).toBe(false)
    expect(officeHoursSet('{"savedAt":"yesterday"}')).toBe(false)
    expect(officeHoursSet('not json')).toBe(false)
    expect(officeHoursSet('[1]')).toBe(false)
  })

  it('says a time in the office’s words', () => {
    expect(timeWords('07:30')).toBe('7:30 AM')
    expect(timeWords('17:00')).toBe('5:00 PM')
    expect(timeWords('00:00')).toBe('12:00 AM')
    expect(timeWords('12:15')).toBe('12:15 PM')
    expect(timeWords('')).toBe('')
  })

  it('says the days as a run, a list, one day or every day', () => {
    expect(daysWords([1, 2, 3, 4, 5])).toBe('Mon to Fri')
    expect(daysWords([1, 3, 5])).toBe('Mon, Wed and Fri')
    expect(daysWords([1, 3])).toBe('Mon and Wed')
    expect(daysWords([6])).toBe('Sat')
    expect(daysWords([0, 1, 2, 3, 4, 5, 6])).toBe('Every day')
    expect(daysWords([2, 1])).toBe('Mon and Tue')
    expect(daysWords([])).toBe('No days')
  })

  it('reads the hours back in one line, or the switch', () => {
    expect(hoursLine(OFFICE_HOURS)).toBe('Mon to Fri, 7:30 AM to 5:00 PM')
    expect(hoursLine({ days: [1, 3, 5], opens: '08:00', closes: '12:00' })).toBe('Mon, Wed and Fri, 8:00 AM to 12:00 PM')
    expect(hoursLine({ ...OFFICE_HOURS, always: true })).toBe('Open around the clock')
  })

  it('names the seven days twice, short and long, Sunday first as the rule counts them', () => {
    expect(DAY_SHORT).toHaveLength(7)
    expect(DAY_LONG).toHaveLength(7)
    expect(DAY_SHORT[0]).toBe('Sun')
    expect(DAY_LONG[1]).toBe('Monday')
  })

  it('keeps every sentence in plain words', () => {
    for (const words of Object.values(OFFICE_HOURS_WORDS)) expect(plainWordsFailures(words), words).toEqual([])
    expect(plainWordsFailures(hoursLine(OFFICE_HOURS))).toEqual([])
    expect(plainWordsFailures(hoursLine({ ...OFFICE_HOURS, always: true }))).toEqual([])
    expect(plainWordsFailures(techHourLine('17:00'))).toEqual([])
  })
})
