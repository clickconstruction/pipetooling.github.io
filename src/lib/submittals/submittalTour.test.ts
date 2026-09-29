import { describe, expect, it } from 'vitest'
import { SUBMITTAL_STAGE_ABOUT, SUBMITTAL_TOUR_STEPS, tourStopForStage } from './submittalTour'

/**
 * The plain-words rules for the walkthrough (owner, 2026-09-29: the stops were
 * hard to follow for someone who is not very smart). One idea per sentence, no
 * sentence over 20 words, nothing glued together with dashes, semicolons,
 * parentheses or dot lists. Words that fail here are rewritten, never exempted.
 */
const MAX_WORDS = 20
const GLUE = /[—;()·]/

function sentences(text: string): string[] {
  return text.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean)
}

describe('submittal walkthrough plain words', () => {
  it('walks thirteen stops, each anchor once', () => {
    expect(SUBMITTAL_TOUR_STEPS).toHaveLength(13)
    expect(new Set(SUBMITTAL_TOUR_STEPS.map((s) => s.anchor)).size).toBe(13)
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
