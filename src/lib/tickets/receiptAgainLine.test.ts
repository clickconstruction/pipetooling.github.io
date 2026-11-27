/**
 * The Team queue's line on a charge the office texted again (punch list #299, v2.8728): the one sentence, when it is
 * said and when it is not, and the clock it reads. Every name and time is made up.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { receiptLineWithAgain, receiptTextedAgainWords, type ReceiptRequestAgainState } from './receiptAgainLine'
import { receiptLineWords } from './receiptText'

// Thu Nov 5, 2:30 PM on the company's clock.
const NOW = Date.parse('2026-11-05T20:30:00.000Z')
const request = (over: Partial<ReceiptRequestAgainState> = {}): ReceiptRequestAgainState => ({ holder_name: 'Jordan Vance', no_text_why: null, texted_at: '2026-11-03T00:14:00.000Z', reminded_at: '2026-11-04T00:00:00.000Z', answered_at: null, closed_at: null, text_tries: 0, ...over })

describe('the sentence for Text again', () => {
  it('says nothing until the office has pressed', () => {
    expect(receiptTextedAgainWords({}, NOW)).toBeNull()
    expect(receiptTextedAgainWords({ again_at: null, again_count: 0 }, NOW)).toBeNull()
    // A count the database did not hand back as a whole number is not guessed at.
    expect(receiptTextedAgainWords({ again_at: '2026-11-05T15:02:00.000Z', again_count: null }, NOW)).toBeNull()
  })

  it('one press says when: the time alone for today, the weekday for another day', () => {
    expect(receiptTextedAgainWords({ again_at: '2026-11-05T15:02:00.000Z', again_count: 1 }, NOW)).toBe('The office texted again 9:02 AM.')
    expect(receiptTextedAgainWords({ again_at: '2026-11-04T15:02:00.000Z', again_count: 1 }, NOW)).toBe('The office texted again Wed 9:02 AM.')
    // 03:40 UTC on the 5th is still Wednesday evening where the company is.
    expect(receiptTextedAgainWords({ again_at: '2026-11-05T03:40:00.000Z', again_count: 1 }, NOW)).toBe('The office texted again Wed 9:40 PM.')
  })

  it('more presses say how many, and when the last one went', () => {
    expect(receiptTextedAgainWords({ again_at: '2026-11-05T15:02:00.000Z', again_count: 2 }, NOW)).toBe('The office texted again twice, last 9:02 AM.')
    expect(receiptTextedAgainWords({ again_at: '2026-11-04T15:02:00.000Z', again_count: 7 }, NOW)).toBe('The office texted again 7 times, last Wed 9:02 AM.')
    expect(receiptTextedAgainWords({ again_at: null, again_count: 2 }, NOW)).toBe('The office texted again twice.')
  })
})

describe('the charge’s line', () => {
  it('a charge texted again says so between the reminder and No receipt yet', () => {
    expect(receiptLineWithAgain(request({ again_at: '2026-11-05T15:02:00.000Z', again_count: 1 }), NOW)).toEqual({ chip: 'Texted Mon 6:14 PM', words: 'Reminded Tue 6:00 PM. The office texted again 9:02 AM. No receipt yet.', tone: 'waiting', next: null })
    expect(receiptLineWithAgain(request({ again_at: '2026-11-04T15:02:00.000Z', again_count: 2 }), NOW)?.words).toBe('Reminded Tue 6:00 PM. The office texted again twice, last Wed 9:02 AM. No receipt yet.')
  })

  it('a charge not texted again reads as the shared kernel writes it', () => {
    for (const r of [request(), request({ again_count: 0 }), request({ reminded_at: null }), request({ texted_at: null, reminded_at: null })]) {
      expect(receiptLineWithAgain(r, NOW)).toEqual(receiptLineWords(r, NOW))
    }
  })

  it('a charge whose receipt came, a closed one and one that could not be texted keep their own line', () => {
    const again = { again_at: '2026-11-05T15:02:00.000Z', again_count: 1 }
    expect(receiptLineWithAgain(request({ ...again, answered_at: '2026-11-05T16:00:00.000Z' }), NOW)).toBeNull()
    expect(receiptLineWithAgain(request({ ...again, closed_at: '2026-11-05T16:00:00.000Z' }), NOW)).toBeNull()
    // A STOP after the third text: the line is the held one, with its own press, and says nothing of the third text.
    const stopped = request({ ...again, no_text_why: 'opted_out' })
    expect(receiptLineWithAgain(stopped, NOW)).toEqual(receiptLineWords(stopped, NOW))
    expect(receiptLineWithAgain(stopped, NOW)?.tone).toBe('held')
  })

  it('every sentence holds to the plain-words rule', () => {
    const said = [
      receiptTextedAgainWords({ again_at: '2026-11-05T15:02:00.000Z', again_count: 1 }, NOW)!,
      receiptTextedAgainWords({ again_at: '2026-11-04T15:02:00.000Z', again_count: 2 }, NOW)!,
      receiptTextedAgainWords({ again_at: null, again_count: 2 }, NOW)!,
    ]
    for (const s of said) expect(plainWordsFailures(s), s).toEqual([])
  })
})
