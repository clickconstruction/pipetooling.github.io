import { describe, expect, it } from 'vitest'
import type { ShadowRunRow } from './shadowStory'
import { bestEffortGap, bestEffortGapNote } from './bestEffort'
import {
  BEST_EFFORT_GAP_NOTE_PREFIX,
  envelopeParamBidNumber,
  estimatorLaneQuestions,
  latestShadowRunByBidNumber,
  openRobotQuestionsByBidId,
  robotQuestionsWaitingCount,
  scoredShadowRunFor,
  sourceIdByTwinId,
  twinBidBySourceId,
  type OpenRobotQuestionRow,
} from './robotLayer'

function run(over: Partial<ShadowRunRow>): ShadowRunRow {
  return {
    id: 'run-1',
    status: 'locked',
    axis: null,
    created_at: '2026-09-01T12:00:00Z',
    locked_at: null,
    scored_at: null,
    shadow_bid_number: null,
    reference_bid_number: '482',
    project_name: null,
    requested_by_name: null,
    reference_sent_at: null,
    locked_total: null,
    reference_value: null,
    delta_pct: null,
    ...over,
  }
}

function question(over: Partial<OpenRobotQuestionRow>): OpenRobotQuestionRow {
  return { id: 'q-1', question: 'Which fixture schedule applies?', created_at: '2026-09-01T12:00:00Z', about_bid_id: 'bid-human', kind: 'decision', ...over }
}

describe('twin pairing', () => {
  const twins = [
    { id: 'twin-1', twin_source_bid_id: 'bid-1' },
    { id: 'twin-2', twin_source_bid_id: null },
    { id: 'twin-3' },
    { id: 'twin-4', twin_source_bid_id: 'bid-4' },
  ]

  it('source → twin, leaving out twins with no source', () => {
    const m = twinBidBySourceId(twins)
    expect([...m.keys()]).toEqual(['bid-1', 'bid-4'])
    expect(m.get('bid-1')).toBe(twins[0])
  })

  it('twin → source', () => {
    expect([...sourceIdByTwinId(twins)]).toEqual([['twin-1', 'bid-1'], ['twin-4', 'bid-4']])
  })

  it('two twins of one bid: the last listed is the one the board shows', () => {
    const m = twinBidBySourceId([{ id: 'twin-a', twin_source_bid_id: 'bid-1' }, { id: 'twin-b', twin_source_bid_id: 'bid-1' }])
    expect(m.get('bid-1')?.id).toBe('twin-b')
  })
})

describe('latestShadowRunByBidNumber', () => {
  it('keeps the latest run per reference, whatever the order listed', () => {
    const older = run({ id: 'older', created_at: '2026-09-01T12:00:00Z' })
    const newer = run({ id: 'newer', created_at: '2026-09-20T12:00:00Z' })
    expect(latestShadowRunByBidNumber([older, newer]).get('482')?.id).toBe('newer')
    expect(latestShadowRunByBidNumber([newer, older]).get('482')?.id).toBe('newer')
  })

  it('keys by the trimmed reference number and leaves out runs with none', () => {
    const m = latestShadowRunByBidNumber([run({ id: 'a', reference_bid_number: ' 482 ' }), run({ id: 'b', reference_bid_number: null }), run({ id: 'c', reference_bid_number: '   ' }), run({ id: 'd', reference_bid_number: '376' })])
    expect([...m.keys()]).toEqual(['482', '376'])
  })

  it('a run whose date cannot be read never replaces one already held', () => {
    const dated = run({ id: 'dated', created_at: '2026-09-01T12:00:00Z' })
    const undated = run({ id: 'undated', created_at: null })
    expect(latestShadowRunByBidNumber([dated, undated]).get('482')?.id).toBe('dated')
  })

  it('an undated run held first stays: nothing compares later than it', () => {
    const dated = run({ id: 'dated', created_at: '2026-09-01T12:00:00Z' })
    const undated = run({ id: 'undated', created_at: null })
    expect(latestShadowRunByBidNumber([undated, dated]).get('482')?.id).toBe('undated')
  })

  it('a tie keeps the first listed', () => {
    const m = latestShadowRunByBidNumber([run({ id: 'first' }), run({ id: 'second' })])
    expect(m.get('482')?.id).toBe('first')
  })

  it('no runs, an empty map', () => {
    expect(latestShadowRunByBidNumber([]).size).toBe(0)
  })
})

describe('scoredShadowRunFor', () => {
  const rows = [run({ id: 'locked', status: 'locked' }), run({ id: 'scored-a', status: 'scored' }), run({ id: 'scored-b', status: 'scored' }), run({ id: 'other', status: 'scored', reference_bid_number: '376' })]

  it('the first scored run listed for the number', () => {
    expect(scoredShadowRunFor(rows, '482')?.id).toBe('scored-a')
    expect(scoredShadowRunFor(rows, ' 376 ')?.id).toBe('other')
  })

  it('nothing when no run for the number is scored', () => {
    expect(scoredShadowRunFor([run({ status: 'locked' })], '482')).toBeNull()
    expect(scoredShadowRunFor(rows, '999')).toBeNull()
    expect(scoredShadowRunFor([], '482')).toBeNull()
  })

  it('a bid with no number matches only a scored run with no reference', () => {
    expect(scoredShadowRunFor(rows, null)).toBeNull()
    expect(scoredShadowRunFor([run({ id: 'loose', status: 'scored', reference_bid_number: null })], '')?.id).toBe('loose')
  })
})

describe('open robot questions', () => {
  const sourceByTwin = new Map([['bid-twin', 'bid-human']])

  it('the estimator lane leaves out operator questions', () => {
    const rows = [question({ id: 'a', audience: 'operator' }), question({ id: 'b', audience: 'estimator' }), question({ id: 'c', audience: null }), question({ id: 'd' })]
    expect(estimatorLaneQuestions(rows).map((r) => r.id)).toEqual(['b', 'c', 'd'])
  })

  it('a plans ask filed on the robot’s shell sits on the human bid', () => {
    const m = openRobotQuestionsByBidId([question({ id: 'plans', kind: 'plans', about_bid_id: 'bid-twin' })], sourceByTwin)
    expect([...m.keys()]).toEqual(['bid-human'])
    expect(m.get('bid-human')![0]!.kind).toBe('plans')
  })

  it('a decision asked on the shell stays on the shell', () => {
    const m = openRobotQuestionsByBidId([question({ id: 'dec', kind: 'decision', about_bid_id: 'bid-twin' })], sourceByTwin)
    expect([...m.keys()]).toEqual(['bid-twin'])
  })

  it('a plans ask on a bid with no pairing stays where it was asked', () => {
    const m = openRobotQuestionsByBidId([question({ id: 'plans', kind: 'plans', about_bid_id: 'bid-lone' })], sourceByTwin)
    expect([...m.keys()]).toEqual(['bid-lone'])
  })

  it('with no stored kind, the text decides', () => {
    const m = openRobotQuestionsByBidId([question({ id: 'text', kind: null, question: 'Please attach the plumbing plans to this bid.', about_bid_id: 'bid-twin' })], sourceByTwin)
    expect([...m.keys()]).toEqual(['bid-human'])
    expect(m.get('bid-human')![0]!.kind).toBe('plans')
  })

  it('groups a bid’s questions in the order loaded and fills the absent fields', () => {
    const m = openRobotQuestionsByBidId(
      [question({ id: 'one' }), question({ id: 'two', topic: 'fixtures', choices: ['A', 'B'], recommended: 'A' }), question({ id: 'plans', kind: 'plans', about_bid_id: 'bid-twin' })],
      sourceByTwin,
    )
    const list = m.get('bid-human')!
    expect(list.map((q) => q.id)).toEqual(['one', 'two', 'plans'])
    expect(list[0]).toEqual({ id: 'one', question: 'Which fixture schedule applies?', topic: null, created_at: '2026-09-01T12:00:00Z', choices: undefined, recommended: null, kind: 'decision' })
    expect(list[1]).toMatchObject({ topic: 'fixtures', choices: ['A', 'B'], recommended: 'A' })
  })

  it('carries neither the bid nor the audience into the entry', () => {
    const entry = openRobotQuestionsByBidId([question({ audience: 'estimator' })], sourceByTwin).get('bid-human')![0]!
    expect(Object.keys(entry).sort()).toEqual(['choices', 'created_at', 'id', 'kind', 'question', 'recommended', 'topic'])
  })

  it('questions waiting on anyone are the ones that are not plans asks', () => {
    expect(robotQuestionsWaitingCount([question({ id: 'a' }), question({ id: 'b', kind: 'plans' }), question({ id: 'c', kind: null, question: 'Please attach the plumbing plans to this bid.' }), question({ id: 'd', kind: null })])).toBe(2)
    expect(robotQuestionsWaitingCount([])).toBe(0)
  })
})

describe('the best-effort gap note', () => {
  it('starts with the prefix the dedupe looks for', () => {
    const gap = bestEffortGap(100000, 90000)
    expect(gap).not.toBeNull()
    expect(bestEffortGapNote(gap!, null).startsWith(BEST_EFFORT_GAP_NOTE_PREFIX)).toBe(true)
    expect(bestEffortGapNote(gap!, 95000).startsWith(BEST_EFFORT_GAP_NOTE_PREFIX)).toBe(true)
  })
})

describe('envelopeParamBidNumber', () => {
  it('b482, B482 and 482 all name bid 482', () => {
    expect(envelopeParamBidNumber('b482')).toBe('482')
    expect(envelopeParamBidNumber('B482')).toBe('482')
    expect(envelopeParamBidNumber('482')).toBe('482')
    expect(envelopeParamBidNumber('b482 ')).toBe('482')
  })

  it('drops one leading b only', () => {
    expect(envelopeParamBidNumber('bb482')).toBe('b482')
    expect(envelopeParamBidNumber(' b482')).toBe('b482')
  })
})
