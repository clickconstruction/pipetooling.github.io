import { describe, expect, it } from 'vitest'
import { orderRecentJobs, recentDayWords, recentHeadingSub, recentWhenWords, showMoreLabel, type RecentJobMark } from './recentJobs'

const mark = (jobId: string, at: string, source: RecentJobMark['source'] = 'clock'): RecentJobMark => ({ jobId, ymd: at.slice(0, 10), at, source })

describe('orderRecentJobs', () => {
  it('newest first, each job once at its newest mark', () => {
    expect(
      orderRecentJobs([
        mark('a', '2026-10-27T13:00:00Z'),
        mark('b', '2026-10-29T12:00:00Z'),
        mark('a', '2026-10-28T13:00:00Z'),
        mark('c', '2026-10-29T14:00:00Z'),
      ]).map((m) => `${m.jobId} ${m.at}`),
    ).toEqual(['c 2026-10-29T14:00:00Z', 'b 2026-10-29T12:00:00Z', 'a 2026-10-28T13:00:00Z'])
  })
  it('stops at the ceiling and skips a mark with no job', () => {
    const marks = Array.from({ length: 14 }, (_, i) => mark(`j${i}`, `2026-10-${String(29 - i).padStart(2, '0')}T08:00:00Z`))
    expect(orderRecentJobs([mark('', '2026-10-30T08:00:00Z'), ...marks]).map((m) => m.jobId)).toEqual(['j0', 'j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7', 'j8', 'j9'])
    expect(orderRecentJobs(marks, 3)).toHaveLength(3)
  })
  it('two marks at the same instant keep their given order', () => {
    expect(orderRecentJobs([mark('a', '2026-10-29'), mark('b', '2026-10-29')]).map((m) => m.jobId)).toEqual(['a', 'b'])
  })
})

describe('recentDayWords', () => {
  const today = '2026-10-29'
  it('today, yesterday, then the weekday and date', () => {
    expect(recentDayWords('2026-10-29', today)).toBe('today')
    expect(recentDayWords('2026-10-28', today)).toBe('yesterday')
    expect(recentDayWords('2026-10-27', today)).toBe('Tue Oct 27')
    expect(recentDayWords('2026-10-24', today)).toBe('Sat Oct 24')
  })
  it('another year carries the year', () => {
    expect(recentDayWords('2025-12-30', today)).toBe('Dec 30, 2025')
  })
  it('a day it cannot read is blank', () => {
    expect(recentDayWords('', today)).toBe('')
    expect(recentDayWords('yesterday', today)).toBe('')
  })
})

describe('recentWhenWords', () => {
  it('names the source and the day', () => {
    expect(recentWhenWords({ ymd: '2026-10-29', source: 'clock' }, '2026-10-29')).toBe('Clocked in today')
    expect(recentWhenWords({ ymd: '2026-10-24', source: 'purchase' }, '2026-10-29')).toBe('Purchase sorted Sat Oct 24')
    expect(recentWhenWords({ ymd: '', source: 'clock' }, '2026-10-29')).toBe('Clocked in')
  })
})

describe('recentHeadingSub', () => {
  it('says jobs you were on only for clock-ins', () => {
    expect(recentHeadingSub([{ source: 'clock' }, { source: 'clock' }])).toBe('jobs you were on')
    expect(recentHeadingSub([{ source: 'purchase' }])).toBe('')
    expect(recentHeadingSub([])).toBe('')
  })
})

describe('showMoreLabel', () => {
  it('counts what the fold hides', () => {
    expect(showMoreLabel(10, 3)).toBe('Show 7 more')
    expect(showMoreLabel(4, 3)).toBe('Show 1 more')
    expect(showMoreLabel(3, 3)).toBeNull()
    expect(showMoreLabel(2, 3)).toBeNull()
  })
})
