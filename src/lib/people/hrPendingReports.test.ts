import { describe, expect, it } from 'vitest'
import { formatHrReportWhen, isFieldWriteUp, pendingReportFactLines, reportCountsLine, reportEntryBody, reportSeenWords, reportWhenWords, sortPendingReportsOldestFirst, summarizePendingReportAging, writtenAfterWords, type PendingReportFacts } from './hrPendingReports'

describe('formatHrReportWhen', () => {
  it('separates when it happened from when it was written', () => {
    expect(formatHrReportWhen({ occurred_date: '2026-08-24', created_at: '2026-08-25T12:00:00Z', author_name: 'Malachi Whites' }))
      .toBe('happened Aug 24 · written by Malachi Whites, Aug 25')
  })
  it('omits the author when unknown', () => {
    expect(formatHrReportWhen({ occurred_date: '2026-08-01', created_at: '2026-08-01T09:00:00Z', author_name: '  ' }))
      .toBe('happened Aug 1 · written Aug 1')
  })
  it('passes odd dates through rather than inventing one', () => {
    expect(formatHrReportWhen({ occurred_date: 'unknown', created_at: '2026-12-31T12:00:00Z', author_name: 'R' }))
      .toBe('happened unknown · written by R, Dec 31')
  })
})

const NOW = Date.parse('2026-09-05T15:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

describe('sortPendingReportsOldestFirst (journey-map #40)', () => {
  it('the report that has waited longest leads; input untouched', () => {
    const rows = [
      { id: 'b', created_at: daysAgo(2) },
      { id: 'c', created_at: daysAgo(11) },
      { id: 'a', created_at: daysAgo(0) },
    ]
    expect(sortPendingReportsOldestFirst(rows).map((r) => r.id)).toEqual(['c', 'b', 'a'])
    expect(rows.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('summarizePendingReportAging', () => {
  it('counts reports at or past the min age with the oldest named; null while the queue is young', () => {
    const rows = [{ created_at: daysAgo(11) }, { created_at: daysAgo(3) }, { created_at: daysAgo(1) }]
    expect(summarizePendingReportAging(rows, 3, NOW)).toEqual({ count: 2, total: 3, oldestAgeDays: 11 })
    expect(summarizePendingReportAging(rows, 12, NOW)).toBeNull()
    expect(summarizePendingReportAging([{ created_at: daysAgo(0) }], 3, NOW)).toBeNull()
    expect(summarizePendingReportAging([], 3, NOW)).toBeNull()
  })
  it('min age 0 is the plain "how old is the oldest" read used by the section header', () => {
    expect(summarizePendingReportAging([{ created_at: daysAgo(5) }, { created_at: null }], 0, NOW)).toEqual({ count: 1, total: 2, oldestAgeDays: 5 })
  })
})

describe('formatHrReportWhen · a report written in the evening keeps its day (v2.4473)', () => {
  it('reads the Central day it was written', () => {
    // 00:30 UTC on Aug 25 is 7:30 pm CDT on Aug 24; 00:30 UTC on Dec 2 is 6:30 pm CST on Dec 1.
    expect(formatHrReportWhen({ occurred_date: '2026-08-24', created_at: '2026-08-25T00:30:00Z', author_name: 'Malachi' })).toBe('happened Aug 24 · written by Malachi, Aug 24')
    expect(formatHrReportWhen({ occurred_date: '2026-12-01', created_at: '2026-12-02T00:30:00+00:00', author_name: '' })).toBe('happened Dec 1 · written Dec 1')
  })
})

// Made-up people and a made-up job (punch list #410).
const WRITE_UP: PendingReportFacts = {
  occurred_date: '2026-11-20',
  occurred_time: '12:20:00',
  created_at: '2026-11-20T18:42:00Z',
  pressed_at: '2026-11-20T18:41:00Z',
  author_name: 'Marcus Hale',
  author_role: 'master_technician',
  content: '  The trench by the east wall was open at lunch with no cones.  ',
  kind: 'safety',
  job_label: 'Cedar Hollow Lot 14',
  author_saw_it: true,
  author_on_job: true,
  seen_by: [{ person_id: 'p-luis', name: 'Luis Ortega' }, { name: '  ' }],
  talked_to_person: true,
  adds_to: null,
}
const OLD: PendingReportFacts = { occurred_date: '2026-08-24', created_at: '2026-08-25T12:00:00Z', author_name: 'Marcus Hale', content: 'No-show this morning.' }

describe('a write-up’s facts on the card (punch list #410)', () => {
  it('a report from before the sheet has no facts and no filing words of its own', () => {
    expect(isFieldWriteUp(OLD)).toBe(false)
    expect(pendingReportFactLines(OLD, 'Dana Pruitt')).toEqual([])
    expect(reportEntryBody(OLD, 'Dana Pruitt')).toBeNull()
  })
  it('draws the facts one a line', () => {
    expect(pendingReportFactLines(WRITE_UP, 'Dana Pruitt')).toEqual([
      { label: 'When', value: 'Fri, Nov 20 · 12:20 pm' },
      { label: 'Job', value: 'Cedar Hollow Lot 14' },
      { label: 'Written by', value: 'Marcus Hale, leader · the same day' },
      { label: 'From', value: 'On the clock at that job that day' },
      { label: 'Seen by', value: 'Marcus Hale, Luis Ortega' },
      { label: 'Talked to Dana', value: 'Yes' },
    ])
  })
  it('leaves out what was not said, and says so when the writer was told', () => {
    const told: PendingReportFacts = { ...WRITE_UP, occurred_time: null, job_label: null, author_on_job: false, author_saw_it: false, seen_by: [], talked_to_person: null, adds_to: 'r-1', author_role: 'superintendent' }
    expect(pendingReportFactLines(told, 'Dana Pruitt')).toEqual([
      { label: 'When', value: 'Fri, Nov 20' },
      { label: 'Written by', value: 'Marcus Hale, superintendent · the same day' },
      { label: 'Seen by', value: 'Nobody named. Marcus Hale was told about it.' },
      { label: 'Adds to', value: 'An earlier write-up by the same writer' },
    ])
    expect(reportSeenWords({ author_saw_it: false, seen_by: [{ name: 'The framer' }], author_name: 'Marcus Hale' })).toBe('The framer. Marcus Hale was told about it.')
  })
  it('says how long after it happened it was written, by the press when the phone waited for signal', () => {
    expect(writtenAfterWords(WRITE_UP)).toBe('the same day')
    expect(writtenAfterWords({ occurred_date: '2026-11-19', created_at: '2026-11-20T18:42:00Z' })).toBe('the next day')
    expect(writtenAfterWords({ occurred_date: '2026-11-17', created_at: '2026-11-20T18:42:00Z' })).toBe('3 days after')
    expect(writtenAfterWords({ occurred_date: '2026-11-20', created_at: '2026-11-22T18:42:00Z', pressed_at: '2026-11-20T23:00:00Z' })).toBe('the same day')
    expect(reportWhenWords({ occurred_date: '2026-11-20', occurred_time: null })).toBe('Fri, Nov 20')
  })
  it('files the facts ahead of the writer’s words, as written', () => {
    expect(reportEntryBody(WRITE_UP, 'Dana Pruitt')).toBe(
      'Field write-up, safety. When: Fri, Nov 20 · 12:20 pm. Job: Cedar Hollow Lot 14. Written by: Marcus Hale, leader · the same day. From: On the clock at that job that day. Seen by: Marcus Hale, Luis Ortega. Talked to Dana: Yes.\n\nThe trench by the east wall was open at lunch with no cones.',
    )
    expect(reportEntryBody({ ...WRITE_UP, adds_to: 'r-1', author_saw_it: false, seen_by: [] }, 'Dana Pruitt')).toContain('Field write-up, safety, added to an earlier one. When:')
    expect(reportEntryBody({ ...WRITE_UP, author_saw_it: false, seen_by: [] }, 'Dana Pruitt')).toContain('Seen by: Nobody named. Marcus Hale was told about it. Talked')
  })
  it('counts the writer’s reports and the person’s others this year, leaving out the dismissed', () => {
    const all = [
      { id: 'r-1', author_user_id: 'u-m', subject_person_id: 'p-d', status: 'pending' },
      { id: 'r-2', author_user_id: 'u-m', subject_person_id: 'p-n', status: 'filed' },
      { id: 'r-3', author_user_id: 'u-m', subject_person_id: 'p-d', status: 'dismissed' },
      { id: 'r-4', author_user_id: 'u-s', subject_person_id: 'p-d', status: 'filed' },
    ]
    expect(reportCountsLine({ id: 'r-1', author_user_id: 'u-m', subject_person_id: 'p-d', author_name: 'Marcus Hale' }, all, 'Dana Pruitt')).toBe('Marcus Hale has written 2 this year. Dana Pruitt has 1 other this year.')
    expect(reportCountsLine({ id: 'r-2', author_user_id: 'u-m', subject_person_id: 'p-n', author_name: 'Marcus Hale' }, all, 'Nate Coyle')).toBe('Marcus Hale has written 2 this year. No other report about Nate Coyle this year.')
  })
})
