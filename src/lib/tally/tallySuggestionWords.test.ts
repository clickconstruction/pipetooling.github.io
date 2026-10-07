import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  TALLY_RULE_CONFIDENCE,
  type TallyDaySuggestion,
  type TallyFacts,
  type TallyRuleId,
  type TallySuggestion,
} from './tallySortSuggestion'
import { tallyChoiceWords, tallyDayEvidenceWords, tallySuggestionWhy } from './tallySuggestionWords'

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
  'schedule-one-job': s('schedule-one-job'),
  'schedule-job': s('schedule-job'),
  'same-day-sorted': s('same-day-sorted', { madeAt: ['2026-09-26T09:26:00-05:00'] }),
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
      'split-even': 'across the jobs clocked that day',
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
      words(s('same-day-sorted', { madeAt: ['2026-09-26T11:00:00-05:00', '2026-09-26T09:26:00-05:00'] })),
    ).toBe('where 2 other charges that day went')
  })
})

const at = (ymd: string, hm: string) => `${ymd}T${hm}:00-05:00`
const LABELS: Record<string, string> = { 'job-a': '101 Hill Street', 'job-b': '202 Oak Lane', 'job-c': '303 Pine Court' }
const label = (id: string) => LABELS[id] ?? id
const evidenceDay = (p: Partial<TallyDaySuggestion>): TallyDaySuggestion => ({
  holderId: 'h',
  ymd: '2026-09-30',
  chips: [],
  best: null,
  lines: [],
  allSure: false,
  clockedJobs: [],
  otherTime: false,
  scheduledJobs: [],
  neighbours: [],
  ...p,
})
const spanJob = (jobId: string, spans: Array<[string, string | null]>, hours: number | null = 1) => ({
  jobId,
  hours,
  spans: spans.map(([a, b]) => ({ clockedInAt: at('2026-09-30', a), clockedOutAt: b ? at('2026-09-30', b) : null })),
})
const evidence = (d: TallyDaySuggestion) => tallyDayEvidenceWords(d, label).replace(/\s/g, ' ')

describe('tallyDayEvidenceWords', () => {
  const CASES: Array<[string, TallyDaySuggestion, string]> = [
    [
      'one job, nothing else',
      evidenceDay({ clockedJobs: [spanJob('job-a', [['07:10', '16:40']])] }),
      'Clocked on 101 Hill Street from 7:10 AM to 4:40 PM. Nothing else that day.',
    ],
    [
      'two jobs',
      evidenceDay({ clockedJobs: [spanJob('job-a', [['07:02', '11:30']]), spanJob('job-b', [['12:40', '16:15']])] }),
      'Clocked on 101 Hill Street from 7:02 AM to 11:30 AM. Then on 202 Oak Lane from 12:40 PM to 4:15 PM.',
    ],
    [
      'one job over two sessions, bid time and a job scheduled but not clocked',
      evidenceDay({
        clockedJobs: [spanJob('job-a', [['07:00', '11:00'], ['11:30', '15:00']])],
        otherTime: true,
        scheduledJobs: ['job-a', 'job-b'],
      }),
      'Clocked on 101 Hill Street from 7:00 AM to 3:00 PM. Also some time on a bid or with no job. Also scheduled on 202 Oak Lane.',
    ],
    [
      'still clocked in today',
      evidenceDay({ clockedJobs: [spanJob('job-a', [['07:00', null]], 3)] }),
      'Clocked on 101 Hill Street from 7:00 AM, still clocked in. Nothing else that day.',
    ],
    [
      'a past day never clocked out',
      evidenceDay({ clockedJobs: [spanJob('job-a', [['07:00', null]], null)] }),
      'Clocked on 101 Hill Street from 7:00 AM with no clock out. Nothing else that day.',
    ],
    ['no clock, scheduled', evidenceDay({ scheduledJobs: ['job-b'] }), 'No clock that day. Scheduled on 202 Oak Lane.'],
    [
      'no clock, three scheduled',
      evidenceDay({ scheduledJobs: ['job-a', 'job-b', 'job-c'] }),
      'No clock that day. Scheduled on 101 Hill Street, 202 Oak Lane and 1 more.',
    ],
    [
      'a Saturday: nothing, and the worked days either side',
      evidenceDay({
        ymd: '2026-09-26',
        neighbours: [
          { jobId: 'job-c', days: ['2026-09-25'] },
          { jobId: 'job-a', days: ['2026-09-28'] },
        ],
      }),
      'No clock that day. Nothing scheduled. Worked on 303 Pine Court Fri. Worked on 101 Hill Street Mon.',
    ],
    ['only bid time', evidenceDay({ otherTime: true }), 'Clocked only on a bid or with no job. Nothing scheduled.'],
  ]

  it.each(CASES)('%s', (_name, d, expected) => {
    expect(evidence(d)).toBe(expected)
  })

  it.each(CASES)('%s keeps to the plain-words rules', (_name, d) => {
    expect(plainWordsFailures(tallyDayEvidenceWords(d, label))).toEqual([])
  })
})

describe('tallyChoiceWords', () => {
  it('names the job, or the split', () => {
    expect(tallyChoiceWords({ kind: 'job', jobId: 'job-a' }, label)).toBe('101 Hill Street')
    expect(tallyChoiceWords({ kind: 'split', how: 'even', jobIds: ['job-a', 'job-b'] }, label)).toBe('Split evenly')
    expect(tallyChoiceWords({ kind: 'split', how: 'hours', jobIds: ['job-a', 'job-b'] }, label)).toBe('Split by hours')
  })
})

describe('tallyDayEvidenceWords with the app\'s job lines', () => {
  it('quotes "JP101 · Hill Street" without the dot, so the sentence stays plain', () => {
    const d = evidenceDay({ clockedJobs: [spanJob('job-a', [['08:00', '16:00']])] })
    const words = tallyDayEvidenceWords(d, () => 'JP101 · Hill Street Remodel').replace(/\s/g, ' ')
    expect(words).toBe('Clocked on JP101 Hill Street Remodel from 8:00 AM to 4:00 PM. Nothing else that day.')
    expect(plainWordsFailures(words)).toEqual([])
  })
})
