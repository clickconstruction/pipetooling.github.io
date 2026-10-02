import { describe, expect, it } from 'vitest'
import { SUBMITTAL_STAGE_ABOUT, SUBMITTAL_TOUR_STEPS, tourStopForStage } from './submittalTour'
import { PLAIN_WORDS_GLUE as GLUE, PLAIN_WORDS_MAX_SENTENCE_WORDS as MAX_WORDS, plainWordsSentences as sentences } from '../plainWords'

/**
 * The plain-words rules for the walkthrough (owner, 2026-09-29: the stops were
 * hard to follow for someone who is not very smart). The mechanical rules — one idea
 * per sentence, no sentence over 20 words, nothing glued together with dashes,
 * semicolons, parentheses or dot lists — live in `src/lib/plainWords.ts` (the
 * convention since v2.4233). Words that fail here are rewritten, never exempted.
 */

describe('submittal walkthrough plain words', () => {
  it('walks fourteen stops, each anchor once', () => {
    expect(SUBMITTAL_TOUR_STEPS).toHaveLength(14)
    expect(new Set(SUBMITTAL_TOUR_STEPS.map((s) => s.anchor)).size).toBe(14)
  })

  it('v2.4366 · the catch-up stop shows only where the blue box is: it carries no missing words', () => {
    const stop = SUBMITTAL_TOUR_STEPS.find((s) => s.anchor === 'submittals-catch-up')
    expect(stop?.missingBody).toBeUndefined()
    expect(stop?.body).toContain('Refresh from the takeoff')
    expect(stop?.body).toContain('Make it a part')
  })

  it.each(SUBMITTAL_TOUR_STEPS.map((s) => [s.title, s] as const))('%s — short sentences, nothing glued', (_title, step) => {
    for (const text of [step.title, step.body, step.missingBody ?? '']) {
      expect(text, text).not.toMatch(GLUE)
      for (const sentence of sentences(text)) {
        expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(MAX_WORDS)
      }
    }
    expect(step.title.split(/\s+/).length, step.title).toBeLessThanOrEqual(8)
    expect(sentences(step.body).length, step.body).toBeLessThanOrEqual(7)
  })

  it('every stop after the strip says what to do, with a verb the page carries', () => {
    const verbs = /\b(Tap|Tick|Type|Pick|Ask|Paste|Give|Repeat|Fix|type|tap)\b/
    for (const step of SUBMITTAL_TOUR_STEPS.slice(1)) expect(step.body, step.title).toMatch(verbs)
  })
})

describe('the stage sentences and the ? on each stage (v2.4125)', () => {
  it('every stage has one short plain sentence', () => {
    for (let n = 1; n <= 8; n++) {
      const about = SUBMITTAL_STAGE_ABOUT[n] ?? ''
      expect(about, String(n)).not.toMatch(GLUE)
      for (const s of sentences(about)) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(MAX_WORDS)
    }
  })
  it('each stage opens the tour on its own stop, in order', () => {
    const stops = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => tourStopForStage(n))
    expect(stops[0]).toBeGreaterThan(0)
    for (let i = 1; i < stops.length; i++) expect(stops[i], `stage ${i + 1}`).toBeGreaterThan(stops[i - 1]!)
    expect(SUBMITTAL_TOUR_STEPS[stops[7]!]?.anchor).toBe('submittals-procure')
    expect(tourStopForStage(9)).toBe(0)
  })
})

describe('a trade word gets its plain word beside it the first time (v2.4140)', () => {
  const TRADE: Array<[RegExp, RegExp]> = [
    [/cut sheet/i, /maker’s page/],
    [/\bRev 1\b/, /first version/],
    [/\brevision\b/i, /version/],
  ]
  it.each([
    ['the walkthrough', SUBMITTAL_TOUR_STEPS.map((s) => s.body)],
    ['the stage sentences', [1, 2, 3, 4, 5, 6, 7, 8].map((n) => SUBMITTAL_STAGE_ABOUT[n] ?? '')],
  ])('%s', (_name, texts) => {
    for (const [word, plain] of TRADE) {
      const first = texts.find((t) => word.test(t))
      if (first) expect(first, `${word} first appears without its plain word`).toMatch(plain)
    }
  })
})
