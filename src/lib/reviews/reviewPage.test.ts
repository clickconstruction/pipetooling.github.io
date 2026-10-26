import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { answered, parseReviewAnswer, portalReadable, REVIEW_WORDS, reviewView, sampleReviewAnswer, sendWords, showGoogleAsk, starWord } from './reviewPage'

const ANSWER = {
  ok: true,
  state: 'open',
  first: 'Dana',
  jobName: 'the water heater',
  company: { name: 'Click Plumbing and Electrical', phone: '(512) 360-0599' },
  lang: 'en',
  stars: null,
  words: null,
  better: null,
  googleLink: 'https://g.page/r/abc/review',
  googlePressed: false,
  portalUrl: 'https://my.clickplumbing.com/dana-whitfield',
}

describe('reviewPage (v2.5896, punch list #185)', () => {
  it('shows the Google ask to everyone who answered, never without a link, and only at five under the other rule', () => {
    expect(showGoogleAsk(5, 'https://g.page/r/x')).toBe(true)
    expect(showGoogleAsk(2, 'https://g.page/r/x')).toBe(true)
    expect(showGoogleAsk(2, 'https://g.page/r/x', 'five')).toBe(false)
    expect(showGoogleAsk(5, 'https://g.page/r/x', 'five')).toBe(true)
    expect(showGoogleAsk(5, null)).toBe(false)
    expect(showGoogleAsk(null, 'https://g.page/r/x')).toBe(false)
  })

  it('words the stars and the Send button in both languages', () => {
    expect(starWord(0, 'en')).toBe('Tap a star')
    expect(starWord(5, 'en')).toBe('Great')
    expect(starWord(2, 'es')).toBe('Podría ser mejor')
    expect(sendWords(0, false, 'en')).toBe('Send')
    expect(sendWords(1, false, 'en')).toBe('Send 1 star')
    expect(sendWords(5, false, 'es')).toBe('Enviar 5 estrellas')
    expect(sendWords(5, true, 'en')).toBe('Sending…')
    expect(REVIEW_WORDS.en.question('Dana', 'the water heater')).toBe('How did we do on the water heater, Dana?')
    expect(REVIEW_WORDS.es.question('', 'el calentador')).toBe('¿Cómo lo hicimos con el calentador?')
  })

  it('parses the answer defensively and reads the page state from the status', () => {
    const a = parseReviewAnswer(ANSWER)!
    expect(a.state).toBe('open')
    expect(a.googleLink).toBe('https://g.page/r/abc/review')
    expect(parseReviewAnswer({ ...ANSWER, googleLink: 'javascript:alert(1)' })!.googleLink).toBeNull()
    expect(parseReviewAnswer({ ...ANSWER, stars: 9 })!.stars).toBeNull()
    expect(parseReviewAnswer({ ...ANSWER, state: 'weird' })).toBeNull()
    expect(parseReviewAnswer({ error: 'not_found' })).toBeNull()
    expect(reviewView(404, { error: 'not_found' })).toEqual({ kind: 'not_found' })
    expect(reviewView(410, { error: 'expired' })).toEqual({ kind: 'expired' })
    expect(reviewView(500, null)).toEqual({ kind: 'error' })
    expect(reviewView(200, ANSWER).kind).toBe('ready')
    expect(reviewView(200, { ok: false }).kind).toBe('error')
  })

  it('draws the thanks from what was typed, and reads the portal address without its scheme', () => {
    const a = answered(parseReviewAnswer(ANSWER)!, 5, '  Luis was great. ')
    expect(a.state).toBe('answered')
    expect(a.stars).toBe(5)
    expect(a.words).toBe('Luis was great.')
    expect(answered(parseReviewAnswer(ANSWER)!, 2, '   ').words).toBeNull()
    expect(portalReadable('https://my.clickplumbing.com/dana-whitfield/')).toBe('my.clickplumbing.com/dana-whitfield')
  })

  it('has a sample for What customers see, open and answered', () => {
    expect(sampleReviewAnswer('live')).toMatchObject({ state: 'open', first: 'Sam', sample: true, stars: null })
    expect(sampleReviewAnswer('done')).toMatchObject({ state: 'answered', stars: 5 })
  })

  it('reads in plain words, in English', () => {
    const w = REVIEW_WORDS.en
    const lines = [w.sub, w.wordsHint, w.fine('Click Plumbing'), w.googleAsk, w.googleAskLow, w.copied, w.better, w.betterHint, w.betterSent, w.call, w.notFound, w.expired, w.error, w.alreadyAnswered]
    for (const line of lines) expect(plainWordsFailures(line), line).toEqual([])
  })
})
