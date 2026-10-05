import { describe, expect, it } from 'vitest'
import { SUBMITTAL_STAGE_ABOUT, SUBMITTAL_TOUR_STEPS, SUBMITTAL_WORDS, SUBMITTAL_WORDS_STOP, stageAbout, tourStopForStage } from './submittalTour'
import { PLAIN_WORDS_GLUE as GLUE, PLAIN_WORDS_MAX_SENTENCE_WORDS as MAX_WORDS, plainWordsSentences as sentences } from '../plainWords'

/**
 * The plain-words rules for the walkthrough (owner, 2026-09-29: the stops were
 * hard to follow for someone who is not very smart). The mechanical rules — one idea
 * per sentence, no sentence over 20 words, nothing glued together with dashes,
 * semicolons, parentheses or dot lists — live in `src/lib/plainWords.ts` (the
 * convention since v2.4233). Words that fail here are rewritten, never exempted.
 */

describe('submittal walkthrough plain words', () => {
  it('walks fifteen stops, each anchor once: the words first, then the strip', () => {
    expect(SUBMITTAL_TOUR_STEPS).toHaveLength(15)
    expect(new Set(SUBMITTAL_TOUR_STEPS.map((s) => s.anchor)).size).toBe(15)
    expect(SUBMITTAL_TOUR_STEPS[0]).toBe(SUBMITTAL_WORDS_STOP)
    expect(SUBMITTAL_TOUR_STEPS[1]!.title).toBe('Where you are')
  })

  it('2026-10-04 · the words page: a centred stop that names each word once and says what it means in plain sentences', () => {
    expect(SUBMITTAL_WORDS_STOP).toMatchObject({ center: true, terms: SUBMITTAL_WORDS })
    expect(SUBMITTAL_WORDS_STOP.missingBody).toBeUndefined()
    const words = SUBMITTAL_WORDS.map((t) => t.word)
    expect(new Set(words).size).toBe(words.length)
    // The words the owner named, and the three picks the page asks for on every fixture.
    for (const w of ['Cut sheet', 'Tag', 'Rev', 'Package', 'GC sees it', 'Order only', 'Left out', 'Their answer']) expect(words).toContain(w)
    for (const t of SUBMITTAL_WORDS) {
      expect(t.means, t.word).not.toMatch(GLUE)
      expect(sentences(t.means).length, t.word).toBeLessThanOrEqual(2)
      for (const s of sentences(t.means)) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(MAX_WORDS)
    }
    // The page's own trade words keep their plain word here too.
    expect(SUBMITTAL_WORDS.find((t) => t.word === 'Cut sheet')!.means).toMatch(/maker’s page/)
    expect(SUBMITTAL_WORDS.find((t) => t.word === 'Rev')!.means).toMatch(/first version/)
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
    // The words stop says Tap Next; the strip's stop is the one that only describes.
    expect(SUBMITTAL_WORDS_STOP.body).toMatch(verbs)
    for (const step of SUBMITTAL_TOUR_STEPS.slice(2)) expect(step.body, step.title).toMatch(verbs)
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
  it('2026-10-03 · the sentences that name a revision follow the one on screen, in the same plain words', () => {
    for (let n = 1; n <= 8; n++) {
      expect(stageAbout(n, null)).toBe(SUBMITTAL_STAGE_ABOUT[n])
      expect(stageAbout(n, { number: 1, isNewest: true })).toBe(SUBMITTAL_STAGE_ABOUT[n])
    }
    expect(stageAbout(2, { number: 4, isNewest: true })).toBe('Rev 4 is the version you are working on. Each earlier version stays as the record.')
    expect(stageAbout(2, { number: 3, isNewest: false })).toBe('Rev 3 is an earlier version. It stays as the record.')
    expect(stageAbout(7, { number: 4, isNewest: true })).toBe('Rows the GC sent back come here. Start a Rev 5 draft with them and the rows with no answer yet. Or carry every row when a product changed.')
    expect(stageAbout(3, { number: 4, isNewest: true })).toBe(SUBMITTAL_STAGE_ABOUT[3])
    for (const about of [stageAbout(2, { number: 4, isNewest: true }), stageAbout(2, { number: 3, isNewest: false }), stageAbout(7, { number: 4, isNewest: true })]) {
      expect(about).not.toMatch(GLUE)
      for (const s of sentences(about)) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(MAX_WORDS)
    }
  })
  it('2026-10-04 · stops 6 and 7 say how the page works now: answers can be typed in, and a resubmit carries the rows with no answer', () => {
    const their = SUBMITTAL_TOUR_STEPS.find((s) => s.title === 'Step 6. Their answer')!
    // The step itself, not the Share step's link box.
    expect(their.anchor).toBe('submittals-review')
    expect(their.body).toContain('Tap Their answer on a row and type what they said.')
    expect(their.missingBody).not.toMatch(/after you share/)
    const resubmit = SUBMITTAL_TOUR_STEPS.find((s) => s.title === 'Step 7. Resubmit')!
    expect(resubmit.body).toContain('Rows with no answer yet go on it too.')
    expect(`${resubmit.body} ${SUBMITTAL_STAGE_ABOUT[7]}`).not.toMatch(/only those rows/)
    expect(SUBMITTAL_STAGE_ABOUT[6]).toContain('type it in with Their answer')
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
