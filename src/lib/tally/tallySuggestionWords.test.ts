import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { TALLY_RULE_CONFIDENCE, type TallyFacts, type TallyRuleId, type TallySuggestion } from './tallySortSuggestion'
import { tallySuggestionWhy } from './tallySuggestionWords'

const s = (rule: TallyRuleId, facts: TallyFacts = {}): TallySuggestion => ({
  choice: { kind: 'job', jobId: 'job-a' },
  rule,
  confidence: TALLY_RULE_CONFIDENCE[rule],
  facts,
})

// Made-up stores; Chicago daylight time.
const SAMPLES: Record<TallyRuleId, TallySuggestion> = {
  'office-category': s('office-category', { category: 'InternetAndTelephone' }),
  'store-streak': s('store-streak', { store: 'Ridge Supply', count: 4 }),
  'store-last': s('store-last', { store: 'Ridge Supply', count: 1 }),
  'clock-one-job': s('clock-one-job', { hours: [9.5] }),
  'clock-one-job-mixed': s('clock-one-job-mixed', { hours: [6] }),
  'clock-office': s('clock-office', { hours: [8] }),
  'clock-job': s('clock-job', { hours: [4.4667] }),
  'split-even': s('split-even'),
  'split-by-hours': s('split-by-hours', { hours: [4.4667, 3.5833] }),
  'schedule-one-job': s('schedule-one-job'),
  'schedule-job': s('schedule-job'),
  'same-day-sorted': s('same-day-sorted', { postedAt: ['2026-09-26T09:26:00-05:00'] }),
  'neighbour-day': s('neighbour-day', { days: ['2026-09-25', '2026-09-28'] }),
  office: s('office'),
}

const words = (x: TallySuggestion) => tallySuggestionWhy(x).replace(/\s/g, ' ')

describe('tallySuggestionWhy', () => {
  it('says each rule in a few words', () => {
    expect(Object.fromEntries(Object.entries(SAMPLES).map(([rule, x]) => [rule, words(x)]))).toEqual({
      'office-category': 'Internet and telephone is an office cost',
      'store-streak': 'Ridge Supply, last 4 times',
      'store-last': 'Ridge Supply, last time',
      'clock-one-job': 'only job clocked that day',
      'clock-one-job-mixed': 'only job clocked that day, plus other time',
      'clock-office': 'only Office clocked that day',
      'clock-job': '4.5 h clocked',
      'split-even': 'even split',
      'split-by-hours': '4.5 h / 3.6 h',
      'schedule-one-job': 'only job scheduled that day',
      'schedule-job': 'scheduled that day',
      'same-day-sorted': 'where the 9:26 AM charge went',
      'neighbour-day': 'worked Fri and Mon',
      office: '',
    })
  })

  it('covers every rule id', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(TALLY_RULE_CONFIDENCE).sort())
  })

  it('keeps to the plain-words rules', () => {
    for (const x of Object.values(SAMPLES)) expect(plainWordsFailures(tallySuggestionWhy(x))).toEqual([])
  })

  it('reads a clocked job with no hours yet, and several sorted charges', () => {
    expect(words(s('clock-job', { hours: [null] }))).toBe('clocked that day')
    expect(
      words(s('same-day-sorted', { postedAt: ['2026-09-26T11:00:00-05:00', '2026-09-26T09:26:00-05:00'] })),
    ).toBe('where 2 other charges that day went')
  })
})
