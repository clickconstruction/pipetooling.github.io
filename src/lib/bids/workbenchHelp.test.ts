import { describe, expect, it } from 'vitest'

import { WORKBENCH_TOUR_STEPS, workbenchHelpFacts } from './workbenchHelp'
import { PLAIN_WORDS_GLUE as GLUE, PLAIN_WORDS_MAX_SENTENCE_WORDS as MAX_WORDS, plainWordsSentences as sentences } from '../plainWords'

const v = (id: string, name: string, sort_order: number) => ({ id, name, sort_order })

describe('workbenchHelpFacts', () => {
  it('a bid with one price and one GC at most is solo, and names that price', () => {
    expect(workbenchHelpFacts({ priceBookVersions: [v('p1', 'Base', 0)], selectedPricingVersionId: 'p1', bidVersionCount: 1 })).toEqual({ solo: true, firstScenarioName: 'Base' })
    expect(workbenchHelpFacts({ priceBookVersions: [v('p1', 'Base', 0)], selectedPricingVersionId: 'p1', bidVersionCount: 0 }).solo).toBe(true)
  })

  it('a second price or a second GC ends solo', () => {
    expect(workbenchHelpFacts({ priceBookVersions: [v('p1', 'Base', 0), v('p2', 'Alternate 1', 1)], selectedPricingVersionId: 'p1', bidVersionCount: 1 }).solo).toBe(false)
    expect(workbenchHelpFacts({ priceBookVersions: [v('p1', 'Base', 0)], selectedPricingVersionId: 'p1', bidVersionCount: 2 }).solo).toBe(false)
  })

  it('names the first price by sort order, not by arrival', () => {
    expect(workbenchHelpFacts({ priceBookVersions: [v('p2', 'Alternate 1', 5), v('p1', 'Base', 1)], selectedPricingVersionId: 'p2', bidVersionCount: 1 }).firstScenarioName).toBe('Base')
  })

  it('with no price of its own the bid reads the shared book; with nothing at all, "your price"', () => {
    expect(workbenchHelpFacts({ priceBookVersions: [], selectedPricingVersionId: 'shared', bidVersionCount: 1 })).toEqual({ solo: true, firstScenarioName: 'Standard prices' })
    expect(workbenchHelpFacts({ priceBookVersions: [], selectedPricingVersionId: null, bidVersionCount: 1 })).toEqual({ solo: true, firstScenarioName: 'your price' })
  })

  it('does not reorder the list it was handed', () => {
    const list = [v('p2', 'Alternate 1', 5), v('p1', 'Base', 1)]
    workbenchHelpFacts({ priceBookVersions: list, selectedPricingVersionId: 'p2', bidVersionCount: 1 })
    expect(list.map((x) => x.id)).toEqual(['p2', 'p1'])
  })
})

/**
 * The plain-words rules (v2.4228, punch list #58): the mechanical ones — one idea per
 * sentence, no sentence over 20 words, nothing glued together with dashes, semicolons,
 * parentheses or dot lists — live in `src/lib/plainWords.ts` (the convention since
 * v2.4233). Words that fail here are rewritten, never exempted.
 */

describe('WORKBENCH_TOUR_STEPS', () => {
  it('walks the section top to bottom, each stop with an anchor of its own and words to say', () => {
    expect(WORKBENCH_TOUR_STEPS.map((s) => s.anchor)).toEqual(['send-to', 'workbench-scenarios', 'workbench-summary', 'workbench-solver', 'workbench-rows'])
    for (const s of WORKBENCH_TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.body.length).toBeGreaterThan(0)
    }
  })

  it.each(WORKBENCH_TOUR_STEPS.map((s) => [s.title, s] as const))('%s — short sentences, nothing glued', (_title, step) => {
    for (const text of [step.title, step.body, step.missingBody ?? '']) {
      expect(text, text).not.toMatch(GLUE)
      for (const sentence of sentences(text)) {
        expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(MAX_WORDS)
      }
    }
    expect(step.title.split(/\s+/).length, step.title).toBeLessThanOrEqual(8)
    expect(sentences(step.body).length, step.body).toBeLessThanOrEqual(7)
  })

  it('every stop says what to do, with a verb the page carries', () => {
    const verbs = /\b(Tap|Type|Drag|tap|type)\b/
    for (const step of WORKBENCH_TOUR_STEPS) expect(step.body, step.title).toMatch(verbs)
  })

  it('every stop names a control by its exact name', () => {
    const controls = [/＋ Add GC/, /☆ make base/, /Apply/, /Solver ›/, /📌/]
    WORKBENCH_TOUR_STEPS.forEach((step, i) => expect(step.body, step.title).toMatch(controls[i]!))
  })

  it('a trade word gets its plain word beside it the first time', () => {
    const TRADE: Array<[RegExp, RegExp]> = [
      [/\bpacket\b/i, /what one GC gets/],
      [/price option/i, /prices for the same GC/],
      [/\bbase\b/, /the price the GC sees/],
      [/\bmargin\b/i, /profit as a share of the price/],
      [/\bpreview\b/i, /not saved yet/],
      [/\bsolver\b/i, /suggests a price for every row/],
    ]
    const bodies = WORKBENCH_TOUR_STEPS.map((s) => s.body)
    for (const [word, plain] of TRADE) {
      const first = bodies.find((t) => word.test(t))
      expect(first, `${word} never appears`).toBeDefined()
      expect(first, `${word} first appears without its plain word`).toMatch(plain)
    }
  })
})
