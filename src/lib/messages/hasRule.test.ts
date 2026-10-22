import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  OFFICE_HOURS,
  afterHoursAnswer,
  autoAnswerDue,
  handOff,
  handOffDue,
  handOffEvent,
  hasHover,
  hasPill,
  lastClosing,
  nextOpening,
  officeOpen,
  parseOfficeHours,
  phoneWords,
  techHoldUntil,
  whoHasReply,
  type HasRuleInput,
  type TechText,
} from './hasRule'

/** A Chicago wall time in October 2026 (CDT, five hours behind UTC). */
const cdt = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00-05:00`).toISOString()
/** A Chicago wall time after the clocks go back on Sun Nov 1, 2026 (CST, six hours behind UTC). */
const cst = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00-06:00`).toISOString()

const TUE = '2026-10-13'
const WED = '2026-10-14'
const FRI = '2026-10-16'
const SAT = '2026-10-17'
const MON = '2026-10-19'

const LUIS = 'user-luis'
const ROSA = 'user-rosa'
/** Luis texted Dana from the job at 9:02 AM on Tuesday: "On our way". */
const luisText: TechText = { userId: LUIS, name: 'Luis', at: cdt(TUE, '09:02') }
const withLuis: HasRuleInput = { techText: luisText, officeUserId: ROSA, officeName: 'Rosa' }
const noTech: HasRuleInput = { techText: null, officeUserId: ROSA, officeName: 'Rosa' }

describe('the office hours setting', () => {
  it('falls back to Monday to Friday, 7:30 AM to 5 PM, with no after-hours number', () => {
    for (const bad of [null, '', 'not json', '[]', 'null', '{"days":[],"opens":"9","closes":"25:00"}']) {
      expect(parseOfficeHours(bad)).toEqual(OFFICE_HOURS)
    }
  })

  it('reads each field the owner set and keeps the default for the rest', () => {
    expect(parseOfficeHours('{"days":[6,1,2,2,9],"opens":"8:00","techUntil":"16:30","emergency":"(512) 555-0144"}')).toEqual({
      days: [1, 2, 6],
      opens: '08:00',
      closes: '17:00',
      techUntil: '16:30',
      emergency: '512-555-0144',
      always: false,
    })
  })

  it('reads a row written before the switch as before: not around the clock', () => {
    expect(parseOfficeHours('{"days":[1,2,3,4,5],"opens":"07:30","closes":"17:00","techUntil":"17:00","emergency":null,"savedAt":"2026-10-21T15:00:00.000Z"}').always).toBe(false)
    expect(parseOfficeHours('{"always":"true"}').always).toBe(false)
    expect(parseOfficeHours('{"always":1}').always).toBe(false)
  })

  it('reads the switch on, and keeps the days and times under it', () => {
    expect(parseOfficeHours('{"days":[1,2,3],"opens":"08:00","closes":"16:00","always":true}')).toEqual({
      days: [1, 2, 3],
      opens: '08:00',
      closes: '16:00',
      techUntil: '17:00',
      emergency: null,
      always: true,
    })
  })

  it('takes both defaults when the opening is not before the close', () => {
    const h = parseOfficeHours('{"opens":"18:00","closes":"09:00"}')
    expect([h.opens, h.closes]).toEqual(['07:30', '17:00'])
  })

  it('writes the after-hours number without parentheses, and drops one it cannot read', () => {
    expect(phoneWords('(512) 555-0144')).toBe('512-555-0144')
    expect(phoneWords('+1 512.555.0144')).toBe('512-555-0144')
    expect(phoneWords('555-0144')).toBeNull()
    expect(parseOfficeHours('{"emergency":"call Robert"}').emergency).toBeNull()
  })
})

describe('when the office is open, in Chicago', () => {
  it('opens at 7:30 AM and closes at 5 PM on a weekday', () => {
    expect(officeOpen(cdt(TUE, '07:29'))).toBe(false)
    expect(officeOpen(cdt(TUE, '07:30'))).toBe(true)
    expect(officeOpen(cdt(TUE, '16:59'))).toBe(true)
    expect(officeOpen(cdt(TUE, '17:00'))).toBe(false)
    expect(officeOpen(cdt(SAT, '10:00'))).toBe(false)
  })

  it('opens next on the morning after, and on Monday after a Friday evening or a weekend', () => {
    expect(nextOpening(cdt(TUE, '21:00'))).toBe(cdt(WED, '07:30'))
    expect(nextOpening(cdt(WED, '06:00'))).toBe(cdt(WED, '07:30'))
    expect(nextOpening(cdt(FRI, '17:10'))).toBe(cdt(MON, '07:30'))
    expect(nextOpening(cdt(SAT, '10:00'))).toBe(cdt(MON, '07:30'))
  })

  it('keeps the clock across the fall change: Saturday Oct 31 opens Monday Nov 2 at 7:30 AM, CST', () => {
    expect(nextOpening(cdt('2026-10-31', '10:00'))).toBe(cst('2026-11-02', '07:30'))
    expect(nextOpening(cdt('2026-10-31', '10:00'))).toBe('2026-11-02T13:30:00.000Z')
  })

  it('says where the night began: the last close', () => {
    expect(lastClosing(cdt(TUE, '21:00'))).toBe(cdt(TUE, '17:00'))
    expect(lastClosing(cdt(WED, '06:00'))).toBe(cdt(TUE, '17:00'))
    expect(lastClosing(cdt(SAT, '10:00'))).toBe(cdt(FRI, '17:00'))
  })
})

describe('the office around the clock (punch list #141 PR 1)', () => {
  const always = parseOfficeHours('{"days":[1,2,3,4,5],"opens":"07:30","closes":"17:00","always":true}')
  const SUN = '2026-10-18'

  it('is open at 3 AM on a Sunday, with no next opening but now, no last close and no answer due', () => {
    expect(officeOpen(cdt(SUN, '03:00'), always)).toBe(true)
    expect(officeOpen(cdt(TUE, '23:59'), always)).toBe(true)
    expect(nextOpening(cdt(SUN, '03:00'), always)).toBe(cdt(SUN, '03:00'))
    expect(lastClosing(cdt(SUN, '03:00'), always)).toBeNull()
    expect(autoAnswerDue(cdt(SUN, '03:00'), null, always)).toBe(false)
    expect(autoAnswerDue(cdt(SUN, '03:00'), cdt(FRI, '19:00'), always)).toBe(false)
  })

  it('never gives a reply to nobody: the tech’s hold, then the office’s pick, at any hour', () => {
    const night = whoHasReply({ ...noTech, hours: always }, cdt(SUN, '03:00'))
    expect(night).toMatchObject({ has: 'office', userId: ROSA, name: 'Rosa', until: null, reason: 'noTech', autoAnswer: null })
    expect(hasPill(night)).toBe('Open · Rosa')
    expect(hasHover(night, 'Dana')).toBe('No tech has texted Dana from a job today. Rosa has the replies.')
    const evening = whoHasReply({ ...withLuis, hours: always }, cdt(TUE, '17:10'))
    expect(evening).toMatchObject({ has: 'office', userId: ROSA, reason: 'techDone', autoAnswer: null })
    expect(hasHover(evening, 'Dana')).toBe('Luis had the replies until 5 PM. Rosa has them now.')
    const held = whoHasReply({ ...withLuis, hours: always }, cdt(TUE, '09:04'))
    expect(held).toMatchObject({ has: 'tech', userId: LUIS, until: cdt(TUE, '17:00') })
  })

  it('still ends the tech’s hold at the tech’s hour', () => {
    expect(techHoldUntil(cdt(TUE, '09:02'), always)).toBe(cdt(TUE, '17:00'))
    expect(techHoldUntil(cdt(TUE, '19:00'), always)).toBe(cdt(WED, '00:00'))
  })

  it('hands off to the office with no opening time, at 5 PM on a Friday as on a Tuesday', () => {
    expect(handOff({ from: 'Luis', officeUserId: ROSA, officeName: 'Rosa', hours: always }, cdt(FRI, '17:00'))).toEqual({
      write: { has_user_id: ROSA, has_since: cdt(FRI, '17:00'), has_how: 'rule', has_until: null },
      line: 'Passed from Luis to Rosa.',
    })
    expect(handOffEvent('Luis', null, cdt(SAT, '00:00'), always)).toBe('Passed from Luis to the office.')
  })
})

describe('the tech’s hold', () => {
  it('runs to 5 PM on the day of the text', () => {
    expect(techHoldUntil(cdt(TUE, '09:02'))).toBe(cdt(TUE, '17:00'))
  })

  it('runs to midnight for a text sent after 5 PM, so an evening call hears the answer', () => {
    expect(techHoldUntil(cdt(TUE, '19:00'))).toBe(cdt(WED, '00:00'))
    const rule = whoHasReply({ ...noTech, techText: { ...luisText, at: cdt(TUE, '19:00') } }, cdt(TUE, '19:10'))
    expect(rule.has).toBe('tech')
    expect(rule.autoAnswer).toBeNull()
    expect(hasPill(rule)).toBe('Open · Luis until midnight')
  })
})

describe('who has a reply', () => {
  it('gives a 9:04 AM reply to Luis’s 9:02 text to Luis until 5 PM', () => {
    const rule = whoHasReply(withLuis, cdt(TUE, '09:04'))
    expect(rule).toMatchObject({ has: 'tech', userId: LUIS, name: 'Luis', until: cdt(TUE, '17:00'), reason: 'tech', autoAnswer: null })
    expect(rule.write).toEqual({ has_user_id: LUIS, has_since: cdt(TUE, '09:04'), has_how: 'rule', has_until: cdt(TUE, '17:00') })
    expect(hasPill(rule)).toBe('Open · Luis until 5 PM')
    expect(hasHover(rule, 'Dana')).toBe('Luis texted Dana from the job at 9:02 AM. Replies go to Luis until 5 PM. Then the office has them.')
  })

  it('gives a reply at 5:10 PM to nobody: the office has closed, so the app answers and the row waits', () => {
    const rule = whoHasReply(withLuis, cdt(TUE, '17:10'))
    expect(rule).toMatchObject({ has: 'nobody', userId: null, until: cdt(WED, '07:30'), reason: 'closed', autoAnswer: 'send' })
    expect(rule.write).toEqual({ has_user_id: null, has_since: null, has_how: null, has_until: null })
    expect(hasPill(rule)).toBe('Open · waits for Wed 7:30 AM')
  })

  it('gives a reply at 9 PM to nobody, and the app answers once that night', () => {
    const first = whoHasReply(withLuis, cdt(TUE, '21:00'))
    expect(first).toMatchObject({ has: 'nobody', until: cdt(WED, '07:30'), autoAnswer: 'send' })
    const again = whoHasReply({ ...withLuis, lastAutoAnswerAt: cdt(TUE, '21:00') }, cdt(TUE, '23:30'))
    expect(again.autoAnswer).toBe('sent')
    const dawn = whoHasReply({ ...withLuis, lastAutoAnswerAt: cdt(TUE, '21:00') }, cdt(WED, '06:00'))
    expect(dawn.autoAnswer).toBe('sent')
    const nextNight = whoHasReply({ ...withLuis, lastAutoAnswerAt: cdt(TUE, '21:00') }, cdt(WED, '21:00'))
    expect(nextNight.autoAnswer).toBe('send')
  })

  it('names the answer that went on the pill’s hover, so the office knows Dana was answered', () => {
    const rule = whoHasReply({ ...noTech, lastAutoAnswerAt: cdt(FRI, '19:00') }, cdt(SAT, '10:00'))
    expect(hasHover(rule, 'Dana')).toBe(
      'The office is closed until Mon Oct 19 at 7:30 AM. The reply waits on Needs a reply for the office. The app told Dana we open Monday at 7:30 AM.',
    )
  })

  it('gives a Saturday reply to the office’s Monday, with one answer for the whole weekend', () => {
    const rule = whoHasReply(noTech, cdt(SAT, '10:00'))
    expect(rule).toMatchObject({ has: 'nobody', until: cdt(MON, '07:30'), autoAnswer: 'send' })
    expect(hasPill(rule)).toBe('Open · waits for Mon 7:30 AM')
    expect(afterHoursAnswer('Dana', rule.until!)).toBe(
      'Hi Dana. Thanks for your message. The office is closed right now. We open Monday at 7:30 AM and will answer you then.',
    )
    expect(autoAnswerDue(cdt('2026-10-18', '20:00'), cdt(SAT, '10:00'))).toBe(false)
  })

  it('lets a tech who texts on a Saturday hear the answer: the hold wins over the office hours', () => {
    const rule = whoHasReply({ ...noTech, techText: { ...luisText, at: cdt(SAT, '08:15') } }, cdt(SAT, '08:20'))
    expect(rule).toMatchObject({ has: 'tech', userId: LUIS, until: cdt(SAT, '17:00'), autoAnswer: null })
  })

  it('gives the reply of a customer no tech has texted to the office', () => {
    const rule = whoHasReply(noTech, cdt(TUE, '10:00'))
    expect(rule).toMatchObject({ has: 'office', userId: ROSA, name: 'Rosa', until: null, reason: 'noTech', autoAnswer: null })
    expect(rule.write).toEqual({ has_user_id: ROSA, has_since: cdt(TUE, '10:00'), has_how: 'rule', has_until: null })
    expect(hasPill(rule)).toBe('Open · Rosa')
    expect(hasHover(rule, 'Dana')).toBe('No tech has texted Dana from a job today. Rosa has the replies.')
  })

  it('leaves the office’s reply for whoever answers first when nobody holds the seat', () => {
    const rule = whoHasReply({ techText: null }, cdt(TUE, '10:00'))
    expect(rule).toMatchObject({ has: 'office', userId: null, name: null })
    expect(rule.write.has_user_id).toBeNull()
    expect(hasPill(rule)).toBe('Open · the office')
  })

  it('gives yesterday’s tech text no hold: the office has it the next morning', () => {
    const rule = whoHasReply(withLuis, cdt(WED, '08:00'))
    expect(rule).toMatchObject({ has: 'office', userId: ROSA, reason: 'noTech' })
  })

  it('says the tech’s hold ended when it ended today, under hours where the office stays open past it', () => {
    const hours = parseOfficeHours('{"techUntil":"16:00"}')
    const rule = whoHasReply({ ...withLuis, hours }, cdt(TUE, '16:30'))
    expect(rule).toMatchObject({ has: 'office', userId: ROSA, reason: 'techDone' })
    expect(hasHover(rule, 'Dana')).toBe('Luis had the replies until 4 PM. Rosa has them now.')
  })

  it('takes the caller’s end for the hold', () => {
    const rule = whoHasReply({ ...withLuis, hasUntil: cdt(TUE, '18:00') }, cdt(TUE, '17:30'))
    expect(rule).toMatchObject({ has: 'tech', until: cdt(TUE, '18:00') })
  })
})

describe('the after-hours answer', () => {
  it('ends with the leak line when the owner set an after-hours number', () => {
    const hours = parseOfficeHours('{"emergency":"(512) 555-0144"}')
    expect(afterHoursAnswer('Dana', cdt(WED, '07:30'), hours.emergency)).toBe(
      'Hi Dana. Thanks for your message. The office is closed right now. We open Wednesday at 7:30 AM and will answer you then. For a leak you cannot stop, call 512-555-0144.',
    )
  })

  it('greets a person with no first name plainly', () => {
    expect(afterHoursAnswer('  ', cdt(WED, '07:30')).startsWith('Hi. Thanks')).toBe(true)
  })
})

describe('the hand-off at 5 PM', () => {
  it('is due once the rule’s hold has come, and never for a take or a hand-off', () => {
    const write = whoHasReply(withLuis, cdt(TUE, '09:04')).write
    expect(handOffDue(write, cdt(TUE, '16:59'))).toBe(false)
    expect(handOffDue(write, cdt(TUE, '17:00'))).toBe(true)
    expect(handOffDue({ ...write, has_how: 'took' }, cdt(TUE, '17:00'))).toBe(false)
  })

  it('lands on a closed office at 5 PM: nobody has it, and the line says when it opens', () => {
    expect(handOff({ from: 'Luis', officeUserId: ROSA, officeName: 'Rosa' }, cdt(TUE, '17:00'))).toEqual({
      write: { has_user_id: null, has_since: null, has_how: null, has_until: null },
      line: 'Passed from Luis to the office. It opens tomorrow at 7:30 AM.',
    })
    expect(handOffEvent('Luis', null, cdt(FRI, '17:00'))).toBe('Passed from Luis to the office. It opens Monday at 7:30 AM.')
  })

  it('lands on the office’s pick while the office is open', () => {
    const hours = parseOfficeHours('{"techUntil":"16:00"}')
    expect(handOff({ from: 'Luis', officeUserId: ROSA, officeName: 'Rosa', hours }, cdt(TUE, '16:00'))).toEqual({
      write: { has_user_id: ROSA, has_since: cdt(TUE, '16:00'), has_how: 'rule', has_until: null },
      line: 'Passed from Luis to Rosa.',
    })
    expect(handOffEvent('Luis', null, cdt(TUE, '16:00'), hours)).toBe('Passed from Luis to the office.')
  })
})

describe('plain words', () => {
  it('holds every sentence the rule writes for a person to read', () => {
    const hours = parseOfficeHours('{"emergency":"(512) 555-0144","techUntil":"16:00"}')
    const rules = [
      whoHasReply(withLuis, cdt(TUE, '09:04')),
      whoHasReply({ ...withLuis, hours }, cdt(TUE, '16:30')),
      whoHasReply(noTech, cdt(TUE, '10:00')),
      whoHasReply({ ...noTech, lastAutoAnswerAt: cdt(FRI, '19:00') }, cdt(SAT, '10:00')),
    ]
    const texts = [
      ...rules.map((r) => hasHover(r, 'Dana')),
      afterHoursAnswer('Dana', cdt(MON, '07:30'), hours.emergency),
      handOffEvent('Luis', null, cdt(TUE, '17:00')),
      handOffEvent('Luis', 'Rosa', cdt(TUE, '16:00'), hours),
    ]
    expect(texts.flatMap(plainWordsFailures)).toEqual([])
  })
})
