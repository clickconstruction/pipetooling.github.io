import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  asksBetter,
  callPromised,
  parseRatingExtras,
  portalReadable,
  RATE_SAMPLE_LOW,
  RATE_WORDS,
  rateWordsFor,
  REVIEW_WORDS,
  sampleRating,
  showGoogleAsk,
  titleFor,
  wordsLabelFor,
} from './rating'

describe('the review ask on the rating page (v2.5934, punch list #185)', () => {
  it('shows the Google ask to everyone who answered, never without a link, and only at five under the other rule', () => {
    expect(showGoogleAsk(5, 'https://g.page/r/x/review')).toBe(true)
    expect(showGoogleAsk(2, 'https://g.page/r/x/review')).toBe(true)
    expect(showGoogleAsk(2, 'https://g.page/r/x/review', 'five')).toBe(false)
    expect(showGoogleAsk(5, 'https://g.page/r/x/review', 'five')).toBe(true)
    expect(showGoogleAsk(5, null)).toBe(false)
    expect(showGoogleAsk(null, 'https://g.page/r/x/review')).toBe(false)
  })

  it('asks what we could have done better below five, and promises the call at three or fewer', () => {
    expect([1, 2, 3, 4].every(asksBetter)).toBe(true)
    expect(asksBetter(5)).toBe(false)
    expect([1, 2, 3].every(callPromised)).toBe(true)
    expect(callPromised(4)).toBe(false)
    expect(callPromised(5)).toBe(false)
    expect(wordsLabelFor(5)).toBe(RATE_WORDS.wordsLabel)
    expect(wordsLabelFor(4)).toBe(REVIEW_WORDS.betterLabel)
  })

  it('names the job in the heading when the ask is about one', () => {
    expect(titleFor('Dana', 'the water heater')).toBe('Dana, how did we do on the water heater?')
    expect(titleFor('', 'the water heater')).toBe('How did we do on the water heater?')
    expect(titleFor('Dana', null)).toBe('Dana, how did we do?')
  })

  it('reads the extras defensively, refusing a link that is not https', () => {
    expect(parseRatingExtras({ jobName: 'Water heater', company: { name: 'Click', phone: '1' }, lang: 'es', googleLink: 'https://g.page/r/x/review', googlePressed: true, portalUrl: 'https://my.clickplumbing.com/dana' })).toEqual({
      jobName: 'Water heater',
      company: { name: 'Click', phone: '1' },
      lang: 'es',
      googleLink: 'https://g.page/r/x/review',
      googlePressed: true,
      portalUrl: 'https://my.clickplumbing.com/dana',
    })
    const bare = parseRatingExtras({ ok: true })
    expect(bare).toMatchObject({ jobName: null, lang: 'en', googleLink: null, googlePressed: false, portalUrl: null })
    expect(bare.company.name).toBe('Click Plumbing and Electrical')
    expect(parseRatingExtras({ googleLink: 'javascript:alert(1)' }).googleLink).toBeNull()
    expect(parseRatingExtras(null).googleLink).toBeNull()
    expect(portalReadable('https://my.clickplumbing.com/dana-whitfield/')).toBe('my.clickplumbing.com/dana-whitfield')
  })

  it('holds the Spanish behind the gate', () => {
    expect(rateWordsFor('es', false).rate).toBe(RATE_WORDS)
    expect(rateWordsFor('es', true).review.googleButton).toBe('Publicarlo en Google')
    expect(titleFor('Dana', 'el calentador', 'es', true)).toBe('Dana, ¿cómo lo hicimos con el calentador?')
    expect(rateWordsFor('es', true).labels).toHaveLength(5)
  })

  it('has a sample for each path What customers see draws, and none for a real token', () => {
    expect(sampleRating('sample')?.state).toMatchObject({ name: 'Sam', score: null, answered: false })
    expect(sampleRating('sample-done')?.state).toMatchObject({ score: 5, answered: true })
    expect(sampleRating(RATE_SAMPLE_LOW)?.state).toMatchObject({ score: 2, answered: true })
    expect(sampleRating('a'.repeat(32))).toBeNull()
    expect(sampleRating(null)).toBeNull()
  })

  it('reads in plain words, in English', () => {
    const w = REVIEW_WORDS
    for (const line of [w.titleOn('Dana', 'the water heater'), w.googleAsk, w.googleAskBelow, w.copied, w.googlePressed, w.call, w.tapStar]) {
      expect(plainWordsFailures(line), line).toEqual([])
    }
  })
})
