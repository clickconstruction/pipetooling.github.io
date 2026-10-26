import { describe, expect, it } from 'vitest'
import { parseRatingState, RATE_WORDS, SCORE_LABELS, scoreOk, thanksFor, tokenOk } from './rating'
import { plainWordsFailures } from '../plainWords'

describe('the rating page rules', () => {
  it('takes our tokens and refuses anything else', () => {
    expect(tokenOk('a'.repeat(32))).toBe(true)
    expect(tokenOk('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true)
    expect(tokenOk('a'.repeat(31))).toBe(false)
    expect(tokenOk('<script>' + 'a'.repeat(32))).toBe(false)
    expect(tokenOk(null)).toBe(false)
    expect(tokenOk(undefined)).toBe(false)
  })

  it('holds the score to one of the five', () => {
    expect([1, 2, 3, 4, 5].every(scoreOk)).toBe(true)
    expect(scoreOk(0)).toBe(false)
    expect(scoreOk(6)).toBe(false)
    expect(scoreOk(4.5)).toBe(false)
    expect(scoreOk('5')).toBe(false)
    expect(SCORE_LABELS).toHaveLength(5)
  })

  it('reads the function answer and nothing else', () => {
    expect(parseRatingState({ ok: true, name: 'Dana', score: 4, words: 'Fast and clean.', answered: true })).toEqual({
      name: 'Dana',
      score: 4,
      words: 'Fast and clean.',
      answered: true,
    })
    expect(parseRatingState({ ok: true })).toEqual({ name: '', score: null, words: '', answered: false })
    expect(parseRatingState({ ok: true, score: 9 })).toEqual({ name: '', score: null, words: '', answered: false })
    expect(parseRatingState({ error: 'This link has expired.' })).toBeNull()
    expect(parseRatingState(null)).toBeNull()
  })

  it('thanks a low score with the honest line, and every word passes the plain words rules', () => {
    expect(thanksFor(1)).toBe(RATE_WORDS.thanksLow)
    expect(thanksFor(2)).toBe(RATE_WORDS.thanksLow)
    expect(thanksFor(3)).toBe(RATE_WORDS.thanks)
    expect(thanksFor(5)).toBe(RATE_WORDS.thanks)
    for (const w of [RATE_WORDS.title('Dana'), RATE_WORDS.title(''), RATE_WORDS.sub, RATE_WORDS.thanks, RATE_WORDS.thanksLow, RATE_WORDS.send, RATE_WORDS.sent, RATE_WORDS.change, RATE_WORDS.badLink, RATE_WORDS.problem]) {
      expect(plainWordsFailures(w)).toEqual([])
    }
  })
})
