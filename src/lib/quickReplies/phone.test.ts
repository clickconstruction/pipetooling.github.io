/**
 * The phone's lines over made-up people: Dana Whitfield, a homeowner on 4120 Oakridge Trl whose job is on Working,
 * Luis the tech pressing, Rosa at the office who marks the lines. The lines are the residential prototype's (v0.8).
 * Nothing here is a real customer.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { BlankFills } from './blanks'
import { PHONE_MAX, SOMETHING_ELSE, hintFor, phoneLines, shortName, wordsFor, type PhoneLine } from './phone'

function line(id: string, text: string, more: Partial<PhoneLine> = {}): PhoneLine {
  return {
    id,
    text,
    for: 'customer',
    stepId: null,
    scope: 'team',
    addedBy: 'rosa',
    addedAt: 0,
    removed: false,
    uses: {},
    lastUsed: null,
    phoneOrder: null,
    phoneName: null,
    textEs: null,
    ...more,
  }
}

const LUIS: BlankFills = {
  first: 'Dana',
  me: 'Luis',
  address: '4120 Oakridge Trl',
  minutes: '25',
  window: '9:30 to 10:00',
  'back day': 'Fri, Oct 9',
  'back time': '8:00 AM',
  day: 'Thu',
  link: 'click.co/e/8Kp4',
}

const ON_WAY = line('on-way', '{first}, this is {me} with Click Plumbing. We are on our way to {address}, about {minutes} minutes out.', {
  stepId: 'onway',
  phoneOrder: 1,
  phoneName: 'On our way',
  textEs: '{first}, le habla {me} de Click Plumbing. Vamos en camino a {address}, llegamos en unos {minutes} minutos.',
})
const LATE = line('late', '{first}, we are running behind this morning. Our new window at {address} is {window}. Sorry for the wait.', {
  stepId: 'onway',
  phoneOrder: 2,
  phoneName: 'Running late',
})
const FOUND = line('found', '{first}, here is what we found: {found}. {me} will send you the estimate today.', { stepId: 'found', phoneOrder: 3 })
const WATER = line('water', '{first}, the water is off at the house while we work on the line. It is back on before we leave today.', {
  stepId: 'working',
  phoneOrder: 4,
})
const DONE = line('done', '{first}, we are done for today at {address}. We are back {back day} at {back time} to finish.', {
  stepId: 'working',
  phoneOrder: 5,
  phoneName: 'Done for today',
})
const PHOTO = line('photo', '{first}, could you send a photo of {thing}? Reply to this text with the picture.', { phoneOrder: 6, phoneName: 'Send us a photo' })
const BOOKED = line('booked', '{first}, this is Click Plumbing. We have you down for {day} between {window}. Reply here if that changes.', { stepId: 'booked' })

const MARKED = [BOOKED, PHOTO, DONE, WATER, FOUND, LATE, ON_WAY]

describe('phoneLines', () => {
  it('puts the step the job is on first, then the rest by their places', () => {
    expect(phoneLines(MARKED, 'working').map((q) => q.id)).toEqual(['water', 'done', 'on-way', 'late', 'found', 'photo'])
  })

  it('keeps the places when no line is on the step, or there is no step', () => {
    const order = ['on-way', 'late', 'found', 'water', 'done', 'photo']
    expect(phoneLines(MARKED, 'billed').map((q) => q.id)).toEqual(order)
    expect(phoneLines(MARKED, null).map((q) => q.id)).toEqual(order)
  })

  it('leaves out a line not marked for the phone', () => {
    expect(phoneLines(MARKED, 'booked').map((q) => q.id)).not.toContain('booked')
  })

  it('leaves out a removed line, a line for anyone else and a line kept for one person', () => {
    const others = [
      line('removed', 'Gone.', { phoneOrder: 1, removed: true }),
      line('trade', 'Your quote is in your portal now, thank you.', { for: 'trade', phoneOrder: 2 }),
      line('any', 'Got it, thank you.', { for: 'any', phoneOrder: 3 }),
      line('mine', '{first}, this is Rosa at the office.', { scope: 'mine', phoneOrder: 4 }),
    ]
    expect(phoneLines([...others, ON_WAY], null).map((q) => q.id)).toEqual(['on-way'])
  })

  it('sends six at most, the step’s lines still first', () => {
    const more = [7, 8, 9].map((n) => line(`extra-${n}`, `Extra line ${n}.`, { phoneOrder: n }))
    const late = line('late-step', 'On the step but placed last.', { stepId: 'working', phoneOrder: 10 })
    const got = phoneLines([...MARKED, ...more, late], 'working')
    expect(PHONE_MAX).toBe(6)
    expect(got).toHaveLength(PHONE_MAX)
    expect(got.map((q) => q.id)).toEqual(['water', 'done', 'late-step', 'on-way', 'late', 'found'])
  })
})

describe('shortName', () => {
  it('takes the phone name when the line has one', () => {
    expect(shortName(ON_WAY, LUIS)).toBe('On our way')
  })

  it('takes the first sentence past the name it opens with, with a capital', () => {
    expect(shortName(WATER, LUIS)).toBe('The water is off at the house while we work on the line')
    expect(shortName(FOUND, LUIS)).toBe('Here is what we found')
  })

  it('skips a sentence that only says who is writing', () => {
    expect(shortName({ ...ON_WAY, phoneName: null }, LUIS)).toBe('We are on our way to 4120 Oakridge Trl, about 25 minutes out')
    expect(shortName(BOOKED, LUIS)).toBe('We have you down for Thu between 9:30 to 10:00')
  })

  it('keeps a first word that is not their name', () => {
    expect(shortName(line('quote', 'Your quote is in your portal now, thank you.'), LUIS)).toBe('Your quote is in your portal now, thank you')
  })

  it('falls back to the words when the phone name is only spaces', () => {
    expect(shortName({ ...DONE, phoneName: '   ' }, LUIS)).toBe('We are done for today at 4120 Oakridge Trl')
  })

  it('shows a blank it cannot fill as written', () => {
    expect(shortName({ ...DONE, phoneName: null }, {})).toBe('We are done for today at {address}')
  })
})

describe('hintFor', () => {
  it('says the drive for minutes, with the value when known', () => {
    expect(hintFor(ON_WAY.text, LUIS)).toBe('about 25 minutes, from the drive')
    expect(hintFor(ON_WAY.text)).toBe('minutes out, from the drive')
  })

  it('says the schedule for the window', () => {
    expect(hintFor(LATE.text, LUIS)).toBe('the new window 9:30 to 10:00, from the schedule')
    expect(hintFor(LATE.text)).toBe('the new window, from the schedule')
  })

  it('says the schedule for the next visit, with its time when known', () => {
    expect(hintFor(DONE.text, LUIS)).toBe('back Fri, Oct 9 at 8:00 AM, from the schedule')
    expect(hintFor(DONE.text, { 'back day': 'Fri, Oct 9' })).toBe('back Fri, Oct 9, from the schedule')
    expect(hintFor(DONE.text)).toBe('the next visit, from the schedule')
  })

  it('says the schedule for the day', () => {
    expect(hintFor('{first}, see you {day}.', LUIS)).toBe('Thu, from the schedule')
    expect(hintFor('{first}, see you {day}.')).toBe('the day of the visit, from the schedule')
  })

  it('says their page for the link, never showing it', () => {
    expect(hintFor('{first}, your bill is ready. Pay it here: {link}.', LUIS)).toBe('with the link to their page')
  })

  it('takes the first that fits, minutes before the link', () => {
    expect(hintFor('About {minutes} minutes out. Your page: {link}.', LUIS)).toBe('about 25 minutes, from the drive')
  })

  it('says ready to go when nothing is read', () => {
    expect(hintFor(WATER.text, LUIS)).toBe('ready to go')
    expect(hintFor(FOUND.text, LUIS)).toBe('ready to go')
  })
})

describe('wordsFor', () => {
  it('gives the Spanish to a person who reads Spanish when the line has it', () => {
    expect(wordsFor(ON_WAY, 'es')).toBe(ON_WAY.textEs)
  })

  it('falls back to the English when the line has no Spanish', () => {
    expect(wordsFor(LATE, 'es')).toBe(LATE.text)
    expect(wordsFor({ ...LATE, textEs: '  ' }, 'es')).toBe(LATE.text)
  })

  it('gives the English to a person who reads English', () => {
    expect(wordsFor(ON_WAY, 'en')).toBe(ON_WAY.text)
  })
})

describe('Something else', () => {
  it('is a note to the office in plain words', () => {
    expect(SOMETHING_ELSE.label).toBe('Something else')
    for (const words of Object.values(SOMETHING_ELSE)) expect(plainWordsFailures(words)).toEqual([])
  })

  it('every hint passes the plain-words rules', () => {
    for (const q of MARKED) expect(plainWordsFailures(hintFor(q.text, LUIS))).toEqual([])
  })
})
