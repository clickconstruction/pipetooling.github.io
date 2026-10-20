/**
 * The blanks over made-up people: Dana Whitfield, a homeowner on 4120 Oakridge Trl, Luis the tech and Rosa at the
 * office. Nothing here is a real customer.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { BLANKS, THEIRS, blankNames, blankWords, blanksIn, fillFirst, fillLine, type BlankFills } from './blanks'

const DANA: BlankFills = {
  first: 'Dana',
  me: 'Luis',
  address: '4120 Oakridge Trl',
  job: 'Oakridge sewer line',
  minutes: '25',
  window: '9:30 to 10:00',
  'back day': 'Fri, Oct 9',
  'back time': '8:00 AM',
  day: 'Thu',
  tech: 'Mateo',
  link: 'click.co/e/8Kp4',
  bill: 'https://clicktooling.com/pay/8f3k2q',
  amount: '$4,850',
  number: '1312',
  estimate: 'https://clicktooling.com/estimate/accept?t=4kQ2',
}

describe('the fill table', () => {
  it('lists the fifteen blanks the app fills, in the chip order', () => {
    expect(BLANKS.map((b) => b.key)).toEqual(['first', 'me', 'address', 'job', 'minutes', 'window', 'back day', 'back time', 'day', 'tech', 'link', 'amount', 'bill', 'number', 'estimate'])
  })

  it('keeps the person’s blanks off the table', () => {
    const keys = new Set<string>(BLANKS.map((b) => b.key))
    expect(THEIRS.map((b) => b.key)).toEqual(['thing', 'found'])
    for (const b of THEIRS) expect(keys.has(b.key)).toBe(false)
  })

  it('names the person as they, never her', () => {
    for (const b of [...BLANKS, ...THEIRS]) expect(b.words).not.toMatch(/\b(her|his|she|he)\b/i)
    expect(blankWords('first')).toBe('their first name')
    expect(blankWords('link')).toBe("their page's link")
  })

  it('gives every blank its words, and one nobody listed "yours to fill"', () => {
    expect(blankWords('minutes')).toBe('minutes out, from the drive')
    expect(blankWords('found')).toBe('what you found')
    expect(blankWords('serial')).toBe('yours to fill')
  })
})

describe('fillLine', () => {
  it('fills every blank in the table', () => {
    const all = BLANKS.map((b) => `{${b.key}}`).join(' ')
    const r = fillLine(all, DANA)
    expect(r.left).toEqual([])
    expect(r.text).toBe('Dana Luis 4120 Oakridge Trl Oakridge sewer line 25 9:30 to 10:00 Fri, Oct 9 8:00 AM Thu Mateo click.co/e/8Kp4 $4,850 https://clicktooling.com/pay/8f3k2q 1312 https://clicktooling.com/estimate/accept?t=4kQ2')
    expect(blanksIn(r.text)).toEqual([])
  })

  it('fills a line the way the phone sends it', () => {
    const r = fillLine('{first}, this is {me} with Click Plumbing. We are on our way to {address}, about {minutes} minutes out.', DANA)
    expect(r).toEqual({ text: 'Dana, this is Luis with Click Plumbing. We are on our way to 4120 Oakridge Trl, about 25 minutes out.', left: [] })
  })

  it('leaves a blank the table does not know for the person, in the text and in left', () => {
    const r = fillLine('{first}, here is what we found: {found}. {me} will send you the estimate today.', DANA)
    expect(r.text).toBe('Dana, here is what we found: {found}. Luis will send you the estimate today.')
    expect(r.left).toEqual(['found'])
  })

  it('names each blank left once, in order', () => {
    expect(fillLine('{thing} then {found} then {thing} for {first}', {}).left).toEqual(['thing', 'found', 'first'])
  })

  it('leaves a known blank the caller has no value for', () => {
    expect(fillLine('About {minutes} minutes out.', { first: 'Dana' }).left).toEqual(['minutes'])
  })

  it('does not fill with an empty value or only spaces', () => {
    expect(fillLine('{first}, {found}', { first: '  ', found: '' })).toEqual({ text: '{first}, {found}', left: ['first', 'found'] })
  })

  it('fills the person’s own blank once they type it', () => {
    const r = fillLine('Here is what we found: {found}.', { ...DANA, found: 'a cracked cleanout cap' })
    expect(r).toEqual({ text: 'Here is what we found: a cracked cleanout cap.', left: [] })
  })

  it('treats words in capitals or other braces as words, not blanks', () => {
    expect(fillLine('{First} and {first_name}', DANA)).toEqual({ text: '{First} and {first_name}', left: [] })
  })
})

describe('blanksIn', () => {
  it('lists the blanks in a text, each once, in order', () => {
    expect(blanksIn('{first}, we are back {back day} at {back time}. {first}?')).toEqual(['first', 'back day', 'back time'])
    expect(blanksIn('Got it, thank you.')).toEqual([])
  })
})

describe('the refusal', () => {
  it('says nothing when no blank is left', () => {
    expect(fillFirst([])).toBeNull()
  })

  it('names one blank', () => {
    expect(fillFirst(['found'])).toBe('Fill {found} first. The app does not know it.')
  })

  it('names two blanks in one sentence', () => {
    expect(fillFirst(['found', 'thing'])).toBe('Fill {found} and {thing} first. The app does not know them.')
  })

  it('names three with commas', () => {
    expect(blankNames(['found', 'thing', 'minutes'])).toBe('{found}, {thing} and {minutes}')
  })

  it('passes the plain-words rules', () => {
    for (const left of [['found'], ['found', 'thing'], ['found', 'thing', 'minutes']]) expect(plainWordsFailures(fillFirst(left) ?? '')).toEqual([])
    for (const b of [...BLANKS, ...THEIRS]) expect(plainWordsFailures(b.words)).toEqual([])
  })
})
