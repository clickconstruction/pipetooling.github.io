/**
 * No dollar figures on a sealed shadow (v2.5020; the owner's call of 2026-10-09): b499's travel-bands
 * ask about the unsent b494 carried "an $800k restroom fit-out" to the estimator. The harness scrubs
 * the money out of a question raised on a sealed shadow before it is filed.
 */
import { describe, expect, it } from 'vitest'
import { questionTouchesSealedShadow, scrubMoney, TWIN_MONEY_WITHHELD, type SealedShadow } from '../../../supabase/functions/_shared/twinQuestionShape'

describe('scrubMoney', () => {
  it("b499's question as filed on 2026-09-29: the robot's size guess goes, the article follows the next word", () => {
    const q = 'SpaceX BA02 restrooms, Bastrop: an $800k restroom fit-out about 50 miles from the office, months of work. What do you carry for travel on a job like this?'
    expect(scrubMoney(q)).toEqual({
      text: 'SpaceX BA02 restrooms, Bastrop: a restroom fit-out about 50 miles from the office, months of work. What do you carry for travel on a job like this?',
      removed: 1,
    })
  })

  it("b496's, filed the same day on its sealed shell: the figure reads as withheld, the street number stays", () => {
    const q = 'Shipley Do-Nuts, 2810 SE Military Dr: a kitchen TI around $80k about 55 miles from the office. What do you carry for travel on a job like this?'
    expect(scrubMoney(q)).toEqual({
      text: `Shipley Do-Nuts, 2810 SE Military Dr: a kitchen TI around ${TWIN_MONEY_WITHHELD} about 55 miles from the office. What do you carry for travel on a job like this?`,
      removed: 1,
    })
  })

  it('every way a figure is written', () => {
    const cases: Array<[string, string]> = [
      ['Is a $1.2M job over the line?', 'Is a job over the line?'],
      ['Carry $12,500.00 per floor?', `Carry ${TWIN_MONEY_WITHHELD} per floor?`],
      ['Over $ 800 thousand?', `Over ${TWIN_MONEY_WITHHELD}?`],
      ['About 800 thousand dollars in fixtures?', `About ${TWIN_MONEY_WITHHELD} in fixtures?`],
      ['A eight hundred thousand job?', 'A job?'],
      ['Roughly two million dollars all in?', `Roughly ${TWIN_MONEY_WITHHELD} all in?`],
      ['Under fifty grand?', `Under ${TWIN_MONEY_WITHHELD}?`],
      ['Under 12 grand?', `Under ${TWIN_MONEY_WITHHELD}?`],
      ['An 800k remodel?', 'A remodel?'],
    ]
    for (const [q, out] of cases) expect(scrubMoney(q).text).toBe(out)
  })

  it('leaves sizes, counts, dates and bid numbers alone', () => {
    const q = 'For b494 at 45 mi, 2 restrooms on Level 2, 3/4 inch PEX, 1.5 gpm, a 12k sf space, Division 22, bid due 2026-10-09: one trip or two?'
    expect(scrubMoney(q)).toEqual({ text: q, removed: 0 })
  })

  it('counts each figure', () => {
    expect(scrubMoney('Between $500k and $800k?').removed).toBe(2)
  })
})

describe('questionTouchesSealedShadow', () => {
  const sealed: SealedShadow[] = [{ shadowBidId: 'shell-499', referenceBidId: 'live-494', shadowNumber: '499', referenceNumber: '494' }]

  it('the question is about the shadow or the bid it shadows', () => {
    expect(questionTouchesSealedShadow({ aboutBidId: 'shell-499', texts: [] }, sealed)).toBe(true)
    expect(questionTouchesSealedShadow({ aboutBidId: 'live-494', texts: [] }, sealed)).toBe(true)
  })

  it('the question names one of their bid numbers', () => {
    expect(questionTouchesSealedShadow({ aboutBidId: null, texts: ['Travel bands for b494?'] }, sealed)).toBe(true)
    expect(questionTouchesSealedShadow({ aboutBidId: null, texts: ['shadow:#499'] }, sealed)).toBe(true)
    expect(questionTouchesSealedShadow({ aboutBidId: null, texts: ['Travel bands for bp494?'] }, sealed)).toBe(true)
    expect(questionTouchesSealedShadow({ aboutBidId: null, texts: ['Travel bands for Bid #494?'] }, sealed)).toBe(true)
  })

  it('another bid, another number, or no sealed run: not sealed', () => {
    expect(questionTouchesSealedShadow({ aboutBidId: 'other', texts: ['b376 · 494 fixtures'] }, sealed)).toBe(false)
    expect(questionTouchesSealedShadow({ aboutBidId: 'shell-499', texts: ['b494'] }, [])).toBe(false)
  })
})
