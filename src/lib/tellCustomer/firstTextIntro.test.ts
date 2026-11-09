/**
 * A first text says who is writing (v2.6771, punch list #291): the first-text rule off the thread's tail, the words'
 * rule (the sender's name or the company, else held), the opening put back once, and the words in plain words.
 */
import { describe, expect, it } from 'vitest'
import type { RecipientLine } from '../messages/compose'
import { plainWordsFailures } from '../plainWords'
import { FIRST_TEXT_WORDS, firstTextReason, introHeld, introPresent, isFirstText, lastOurTextTo, lineOpening, quietDays, withOpeningBack } from './firstTextIntro'

const NOW = Date.parse('2026-11-09T21:32:00Z')
const DAY = 86_400_000
const out = (channelId: string, agoDays: number): RecipientLine => ({ channelId, direction: 'out', at: new Date(NOW - agoDays * DAY).toISOString() })
const inn = (channelId: string, agoDays: number): RecipientLine => ({ channelId, direction: 'in', at: new Date(NOW - agoDays * DAY).toISOString() })

describe('the first-text rule off the thread’s tail', () => {
  it('a number we never texted is a first text, even when they texted us from it', () => {
    expect(lastOurTextTo([inn('ch-1', 2)], 'ch-1')).toBeNull()
    expect(isFirstText([inn('ch-1', 2)], 'ch-1', NOW)).toBe(true)
    expect(firstTextReason([], 'ch-1', NOW)).toBe('first')
    expect(quietDays([], 'ch-1', NOW)).toBeNull()
  })
  it('a number we texted is not a first text; the newest of ours counts, and another number’s texts do not', () => {
    const lines = [out('ch-1', 40), out('ch-1', 3), out('ch-2', 1)]
    expect(lastOurTextTo(lines, 'ch-1')).toBe(NOW - 3 * DAY)
    expect(isFirstText(lines, 'ch-1', NOW)).toBe(false)
    expect(firstTextReason(lines, 'ch-1', NOW)).toBeNull()
    expect(isFirstText([out('ch-2', 1)], 'ch-1', NOW)).toBe(true)
  })
  it('a quiet spell is the box’s silence reason, never a first text', () => {
    const lines = [out('ch-1', 45)]
    expect(firstTextReason(lines, 'ch-1', NOW)).toBe('silence')
    expect(isFirstText(lines, 'ch-1', NOW)).toBe(false)
    expect(quietDays(lines, 'ch-1', NOW)).toBe(45)
  })
  it('no number picked: nothing to judge, so it reads as a first text and the sheet’s own hold speaks first', () => {
    expect(isFirstText([out('ch-1', 1)], null, NOW)).toBe(true)
  })
})

describe('the words’ rule', () => {
  const LINE = 'Hi Dana, this is Rosa with Click Plumbing. Your bill for the water heater is ready, $1,850.00. Text me here with any question. Pay it here: https://my.clickplumbing.com/pay/k7x2m9pq4n'
  it('the line as the app wrote it names both; the company alone or the name alone is enough', () => {
    expect(introPresent(LINE, 'Rosa')).toBe(true)
    expect(introPresent('Your bill is ready. Click Plumbing', 'Rosa')).toBe(true)
    expect(introPresent('Dana, Rosa here. Your bill is ready.', 'Rosa')).toBe(true)
    expect(introPresent('dana, rosa here.', 'Rosa')).toBe(true)
  })
  it('the trimmed opening names neither, and a name inside another word does not count', () => {
    expect(introPresent('Your bill for the water heater is ready, $1,850.00. Pay it here: https://my.clickplumbing.com/pay/k7x2m9pq4n', 'Rosa')).toBe(false)
    expect(introPresent('Your prosaic bill is ready.', 'Rosa')).toBe(false)
    expect(introPresent('', 'Rosa')).toBe(false)
    expect(introPresent('Your bill is ready.', null)).toBe(false)
  })
  it('holds only a first text whose words name neither', () => {
    const trimmed = 'Your bill for the water heater is ready, $1,850.00. Pay it here: https://my.clickplumbing.com/pay/k7x2m9pq4n'
    expect(introHeld(true, trimmed, 'Rosa')).toBe(true)
    expect(introHeld(true, LINE, 'Rosa')).toBe(false)
    expect(introHeld(false, trimmed, 'Rosa')).toBe(false)
  })
})

describe('Put the opening back', () => {
  const START = 'Hi Dana, this is Rosa with Click Plumbing. Your bill for the water heater is ready, $1,850.00. Text me here with any question. Pay it here: https://x/pay/k7x2m9pq4n'
  it('the opening is the line’s first sentence, in either language', () => {
    expect(lineOpening(START)).toBe('Hi Dana, this is Rosa with Click Plumbing.')
    expect(lineOpening('Hola Dana, soy Rosa de Click Plumbing. Su factura está lista.')).toBe('Hola Dana, soy Rosa de Click Plumbing.')
    expect(lineOpening('No stop at all')).toBe('No stop at all')
  })
  it('puts the opening ahead of the words as typed, once', () => {
    const trimmed = 'Your bill for the water heater is ready, $1,850.00. Pay it here: https://x/pay/k7x2m9pq4n'
    const back = withOpeningBack(trimmed, START)
    expect(back).toBe('Hi Dana, this is Rosa with Click Plumbing. Your bill for the water heater is ready, $1,850.00. Pay it here: https://x/pay/k7x2m9pq4n')
    expect(withOpeningBack(back, START)).toBe(back)
    expect(withOpeningBack('', START)).toBe('Hi Dana, this is Rosa with Click Plumbing.')
  })
})

describe('the words', () => {
  it('read plain', () => {
    const all = [FIRST_TEXT_WORDS.chip, FIRST_TEXT_WORDS.hint('Dana'), FIRST_TEXT_WORDS.hint(null), FIRST_TEXT_WORDS.hold('Dana', 'Rosa'), FIRST_TEXT_WORDS.hold(null, null), FIRST_TEXT_WORDS.putBack, FIRST_TEXT_WORDS.laterNote, FIRST_TEXT_WORDS.previewChip('Dana'), FIRST_TEXT_WORDS.previewHint, FIRST_TEXT_WORDS.previewLater]
    for (const w of all) expect(plainWordsFailures(w), w).toEqual([])
    expect(FIRST_TEXT_WORDS.hold('Dana', 'Rosa')).toBe('This is Dana’s first text from us, so it has to say who is writing. Put ‘this is Rosa with Click Plumbing’ back, or press Put the opening back.')
    expect(FIRST_TEXT_WORDS.hint('Dana')).toBe('Dana’s first text from us names you and Click Plumbing. The app adds the carriers’ opt-out line under it. Preview shows both.')
  })
})
