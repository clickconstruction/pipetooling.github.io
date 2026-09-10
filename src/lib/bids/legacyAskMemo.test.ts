import { describe, expect, it } from 'vitest'
import { alreadySplitRows, buildSplitInserts, defaultChoices, draftProblems, splitLegacyAsk, splitMissionTag, splitRetirementAnswer, topicSlug } from './legacyAskMemo'

const SLATE =
  'Slate doctrine asks from the 2026-08-31/09-01 backtest slate (b424 ours b237/b425 ours b166 — full detail in each bid\'s STG-6 stamp). Three decisions for Wendi/Stephen: (1) SMALL-TI RESIDUAL — all four fresh small/small-mid runs came in LIGHT by a consistent margin (Take 5 pair −21%/−29%, Church cafe −17%). Approve either a footage residual (~$6-8k on sub-$50k jobs) or ~30% higher per-fixture all-ins? (2) TAKE 5 PROTO PACKAGE — b237/b166 pair-implies building base ≈ $37.4k + ~$51/mi travel; approve minting a \'Take 5 proto package\' book entry so the next proto scores inside ±5%? Also confirm: CA piping IS plumber scope on Take 5s (you counted ~70 ft galv both protos despite the by-others note)? (3) HUNTER RD BAND — all three campus buildings lost to a winner under HALF your number. Confirm we bank this as a market-band flag (spec-campus builds ≈ 0.35-0.5× book) rather than recalibrating the book down.'

describe('splitLegacyAsk', () => {
  it('splits numbered parts into decisions, keeps the preamble, and makes an "Also confirm" its own decision', () => {
    const split = splitLegacyAsk(SLATE)
    expect(split.preamble).toMatch(/^Slate doctrine asks/)
    expect(split.decisions.map((d) => d.heading)).toEqual(['Small-ti residual', 'Take 5 proto package', 'Take 5 proto package · also', 'Hunter rd band'])
    expect(split.decisions[0]?.question).toMatch(/^all four fresh/)
    expect(split.decisions[2]?.question).toMatch(/^CA piping IS plumber scope/)
    expect(split.decisions.map((d) => d.topic)).toEqual(['small-ti-residual', 'take-5-proto-package', 'take-5-proto-package-also', 'hunter-rd-band'])
  })

  it('an "either A or B?" question becomes two taps; anything else defaults to Yes / No', () => {
    const split = splitLegacyAsk(SLATE)
    expect(split.decisions[0]?.choices).toEqual(['footage residual', '~30% higher per-fixture all-ins'])
    expect(split.decisions[1]?.choices).toEqual(['Yes', 'No'])
    expect(defaultChoices('Carry travel past 200 miles?')).toEqual(['Yes', 'No'])
  })

  it('a part longer than the limit keeps its asking sentence so the draft starts inside the rule', () => {
    const long = `(1) BIG ONE — ${'context sentence about the plans and the count. '.repeat(8)}Do we carry the vent riser at 1.6× developed length?`
    const d = splitLegacyAsk(long).decisions[0]!
    expect(d.question).toBe('Do we carry the vent riser at 1.6× developed length?')
    expect(draftProblems(d)).toEqual([])
  })

  it('no markers: one decision from the whole text, no preamble', () => {
    const split = splitLegacyAsk('Do we band travel by distance?')
    expect(split.preamble).toBeNull()
    expect(split.decisions).toHaveLength(1)
    expect(split.decisions[0]).toMatchObject({ heading: null, choices: ['Yes', 'No'], topic: 'do-we-band-travel-by-distance' })
  })
})

describe('draftProblems · buildSplitInserts', () => {
  it('the shape rule decides what may post', () => {
    expect(draftProblems({ question: 'Carry travel past 200 miles?', choices: ['Yes', 'No'], recommended: 'Yes' })).toEqual([])
    expect(draftProblems({ question: 'Carry travel? And band it?', choices: ['Yes'], recommended: null }).length).toBeGreaterThan(0)
  })

  it('builds open estimator one-decision rows as the robot, stamped with where they came from', () => {
    const rows = buildSplitInserts(
      { id: '836b6c22-b8e0-4fb5-856d-b4e9d071099c', twin_user_id: 'twin-1', about_bid_id: 'shell-425', mission: 'backtest-slate-2026-08-31' },
      [{ heading: 'Hunter rd band', question: 'Bank Hunter Road as a market-band flag rather than lowering the book?', choices: ['Market flag', 'Lower the book'], recommended: 'Market flag', topic: 'hunter-rd-band' }],
    )
    expect(rows).toEqual([
      {
        twin_user_id: 'twin-1',
        about_bid_id: 'shell-425',
        mission: 'backtest-slate-2026-08-31 · split from 836b6c22',
        status: 'open',
        audience: 'estimator',
        kind: 'decision',
        topic: 'hunter-rd-band',
        question: 'Bank Hunter Road as a market-band flag rather than lowering the book?',
        choices: ['Market flag', 'Lower the book'],
        recommended: 'Market flag',
      },
    ])
    expect(splitRetirementAnswer(4)).toBe('Re-asked as 4 one-decision questions from the Console.')
    expect(topicSlug('Small-TI residual!')).toBe('small-ti-residual')
  })
})

describe('alreadySplitRows', () => {
  it('finds the rows an earlier Post stamped for this source, and nothing else', () => {
    const rows = [
      { id: 'a', mission: 'backtest-slate-2026-08-31 · split from 836b6c22' },
      { id: 'b', mission: 'backtest-slate-2026-08-31 · split from 836b6c22' },
      { id: 'c', mission: 'legacy ask · split from deadbeef' },
      { id: 'd', mission: null },
    ]
    expect(alreadySplitRows(rows, '836b6c22-b8e0-4fb5-856d-b4e9d071099c').map((r) => r.id)).toEqual(['a', 'b'])
    expect(splitMissionTag('836b6c22-b8e0-4fb5-856d-b4e9d071099c')).toBe('split from 836b6c22')
  })
})
