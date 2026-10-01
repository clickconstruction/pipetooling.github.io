import { describe, expect, it } from 'vitest'

import { askedToday, buildRunThrough, minutesWords, questionLine, questionsHeaderLine, runThroughProgress, sizeTodaySentence } from './rulingRunThrough'
import { groupStandingRulings, type TwinQuestionRow } from './standingRulings'

const q = (over: Partial<TwinQuestionRow> & { id: string }): TwinQuestionRow => ({
  twin_user_id: 'twin-1',
  about_bid_id: null,
  mission: null,
  question: `question ${over.id}`,
  status: 'open',
  answer: null,
  answered_by: null,
  answered_at: null,
  created_at: '2026-09-01T10:00:00Z',
  ...over,
})

// Company day 2026-09-30 (Chicago); a Z stamp at 04:00 is still the 29th there.
const TODAY = '2026-09-30'
const rows = [
  q({ id: 't1', topic: 'travel-bands', about_bid_id: 'b496', created_at: '2026-09-30T15:00:00Z', choices: ['About $4,000', 'Nothing', 'Per mile'], recommended: 'About $4,000' }),
  q({ id: 't2', topic: 'travel-bands', about_bid_id: 'b495', created_at: '2026-09-30T14:00:00Z' }),
  q({ id: 'v1', topic: 'vent-model', about_bid_id: 'b492', created_at: '2026-09-30T13:00:00Z' }),
  q({ id: 'v2', topic: 'vent-model', about_bid_id: 'b492', created_at: '2026-09-30T12:00:00Z' }),
  q({ id: 'v3', topic: 'vent-model', about_bid_id: 'b498', created_at: '2026-09-30T11:00:00Z' }),
  q({ id: 'today1', about_bid_id: 'b499', created_at: '2026-09-30T16:00:00Z' }),
  q({ id: 'today2', about_bid_id: 'b499', created_at: '2026-09-30T15:30:00Z' }),
  q({ id: 'old1', topic: 'small-ti', about_bid_id: null, created_at: '2026-09-08T10:00:00Z' }),
  q({ id: 'old2', about_bid_id: 'b398', created_at: '2026-09-20T10:00:00Z' }),
  // 04:00Z on the 30th is the evening of the 29th in Chicago — not today.
  q({ id: 'edge', about_bid_id: 'b400', created_at: '2026-09-30T04:00:00Z' }),
]

describe('buildRunThrough (v2.4232) — shared first, then today, then the rest', () => {
  const items = buildRunThrough(groupStandingRulings(rows, { audience: 'estimator' }), rows, TODAY)
  it('orders shared by how often asked, today newest first, then the older asks newest first', () => {
    expect(items.map((i) => [i.key, i.group])).toEqual([
      ['topic:vent-model', 'shared'],
      ['topic:travel-bands', 'shared'],
      ['q:today1', 'today'],
      ['q:today2', 'today'],
      ['q:edge', 'older'],
      ['q:old2', 'older'],
      ['topic:small-ti', 'older'],
    ])
  })
  it('a shared item carries every copy, the bids they were asked on, the label and the taps', () => {
    const travel = items.find((i) => i.key === 'topic:travel-bands')!
    expect(travel.questionIds).toEqual(['t1', 't2'])
    expect(travel.aboutBidIds).toEqual(['b496', 'b495'])
    expect(travel.label).toBe('Travel bands')
    expect(travel.askCount).toBe(2)
    expect(travel.choices?.[0]).toEqual({ label: 'About $4,000', recommended: true })
    const vent = items.find((i) => i.key === 'topic:vent-model')!
    expect(vent.aboutBidIds).toEqual(['b492', 'b498'])
  })
  it('a lone question has no label and one id; a bid-less ask has no bids', () => {
    const lone = items.find((i) => i.key === 'q:today1')!
    expect(lone.label).toBeNull()
    expect(lone.questionIds).toEqual(['today1'])
    expect(items.find((i) => i.key === 'topic:small-ti')!.aboutBidIds).toEqual([])
  })
  it('a topic asked once is not shared', () => {
    expect(items.find((i) => i.key === 'topic:small-ti')!.group).toBe('older')
  })
  it('the header line counts today and the shared', () => {
    expect(questionsHeaderLine(items)).toBe('2 asked today · 2 asked more than once')
    expect(questionsHeaderLine(items.filter((i) => i.key !== 'topic:vent-model'))).toBe('2 asked today · 1 asked twice')
    expect(questionsHeaderLine([])).toBe('')
  })
})

describe('askedToday', () => {
  it('reads the company calendar day', () => {
    expect(askedToday({ created_at: '2026-09-30T15:00:00Z' }, TODAY)).toBe(true)
    expect(askedToday({ created_at: '2026-09-30T04:00:00Z' }, TODAY)).toBe(false)
    expect(askedToday({ created_at: '2026-10-01T03:00:00Z' }, TODAY)).toBe(true)
  })
})

describe('runThroughProgress', () => {
  it('says where you are and what is left', () => {
    expect(runThroughProgress(2, 19, 2)).toEqual({ position: 'Question 3 of 19', progress: '2 answered · ~15 min left' })
    expect(runThroughProgress(18, 19, 18)).toEqual({ position: 'Question 19 of 19', progress: '18 answered · ~1 min left' })
    expect(runThroughProgress(19, 19, 19).position).toBe('Question 19 of 19')
  })
  it('says both counts when shared questions make fewer steps than questions (v2.4295)', () => {
    expect(runThroughProgress(0, 16, 0, 19).position).toBe('Question 1 of 16 · 19 questions')
    expect(runThroughProgress(0, 16, 0, 16).position).toBe('Question 1 of 16')
  })
})

describe('sizeTodaySentence', () => {
  it('sizes today in the mock-up’s words, each clause only when it has a number', () => {
    expect(sizeTodaySentence({ questions: 19, audits: 31, sealed: 8 })).toBe('Today: 19 questions, about fifteen minutes. Then 31 audits. 8 more open when you send.')
    expect(sizeTodaySentence({ questions: 0, audits: 31, sealed: 1 })).toBe('Today: 31 audits. 1 more opens when you send.')
    expect(sizeTodaySentence({ questions: 1, audits: 0, sealed: 0 })).toBe('Today: 1 question, about one minute.')
    expect(sizeTodaySentence({ questions: 0, audits: 0, sealed: 0 })).toBe('Nothing is waiting on you — every robot has its answer.')
  })
  it('minutes in words to twenty, digits past', () => {
    expect(minutesWords(15)).toBe('fifteen minutes')
    expect(minutesWords(1)).toBe('one minute')
    expect(minutesWords(25)).toBe('25 minutes')
  })
})

describe('questionLine', () => {
  it('cuts to a line on a word, and leaves a short one alone', () => {
    expect(questionLine('Do we carry travel past 200 miles?')).toBe('Do we carry travel past 200 miles?')
    const long = 'Shipley Do-Nuts SE Military, P1.4: the Schier GB-75 grease interceptor, sample port and grade cleanout sit outside the building on the site sewer, but are on the plumbing set.'
    const line = questionLine(long, 80)
    expect(line.length).toBeLessThanOrEqual(81)
    expect(line.endsWith('…')).toBe(true)
    expect(line).toBe('Shipley Do-Nuts SE Military, P1.4: the Schier GB-75 grease interceptor, sample…')
  })
})
