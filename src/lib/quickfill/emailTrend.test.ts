import { describe, expect, it } from 'vitest'
import type { StationThreadRow } from './emailStation'
import { emailTrend, trendDayWords, type EmailTrendInput, type TrendDayRow } from './emailTrend'

// Fri Oct 23, 2026, 9:55 AM in Chicago. Made-up boxes, people and mail.
const NOW = '2026-10-23T14:55:00.000Z'
const day = (ymd: string, over: Partial<TrendDayRow> = {}): TrendDayRow => ({ watch_id: 'w-bids', label_name: 'Inbox', day: ymd, count: 2, oldest_days: 2, new_count: 0, cleared_count: 0, ...over })
const thread = (over: Partial<StationThreadRow> & { gmail_thread_id: string }): StationThreadRow => ({
  watch_id: 'w-bids',
  label_name: 'Inbox',
  arrived_at: null,
  last_at: null,
  from_name: null,
  from_address: null,
  subject: '',
  first_seen_at: '2026-10-10T12:00:00Z',
  gone_at: null,
  ...over,
})

const input = (over: Partial<EmailTrendInput> = {}): EmailTrendInput => ({
  boxes: [
    { watchId: 'w-bids', words: 'bids@', labels: ['Inbox'] },
    { watchId: 'w-mine', words: 'Marisol', labels: ['Follow Up'] },
  ],
  days: [
    day('2026-10-21', { count: 3, oldest_days: 4, new_count: 1 }),
    day('2026-10-22', { count: 2, oldest_days: 5, cleared_count: 1 }),
    day('2026-10-23', { count: 2, oldest_days: 6, new_count: 1, cleared_count: 1 }),
    day('2026-10-23', { watch_id: 'w-mine', label_name: 'Follow Up', count: 1, oldest_days: 9 }),
    day('2026-10-23', { watch_id: 'w-other', label_name: 'Inbox', count: 40, oldest_days: 90 }),
  ],
  threads: [
    thread({ gmail_thread_id: 'ridgeway', arrived_at: '2026-10-17T15:10:00Z', from_name: 'Ridgeway Builders', subject: 'Lot 7 — final waivers', first_seen_at: '2026-10-17T15:15:00Z' }),
    thread({ gmail_thread_id: 'toll', arrived_at: '2026-10-15T12:00:00Z', from_name: 'Toll Co', subject: 'Toll bill', first_seen_at: '2026-10-15T12:05:00Z', gone_at: '2026-10-22T15:00:00Z' }),
    thread({ watch_id: 'w-mine', label_name: 'Follow Up', gmail_thread_id: 'harlan', arrived_at: '2026-10-14T15:00:00Z', from_name: 'Harlan Freight', subject: 'W-9' }),
    thread({ watch_id: 'w-other', gmail_thread_id: 'not-mine', arrived_at: '2026-09-01T15:00:00Z', subject: 'Not for this viewer' }),
  ],
  marks: [
    { marked_at: '2026-10-23T14:55:00Z', name: 'Marisol' },
    { marked_at: '2026-10-21T17:01:00Z', name: 'Dale' },
    { marked_at: '2026-10-21T20:00:00Z', name: 'Marisol' },
  ],
  limitDays: 3,
  nowIso: NOW,
  barDays: 5,
  rowDays: 4,
  ...over,
})

describe('emailTrend: the bars', () => {
  it('draws a bar a day per counted label, red past the limit, marked on a day someone looked', () => {
    const t = emailTrend(input())
    expect(t.series.map((s) => [s.title, s.todayCount, s.todayOldest])).toEqual([
      ['bids@ · Inbox', 2, 6],
      ['Marisol · Follow Up', 1, 9],
    ])
    expect(t.series[0]!.bars.map((b) => [b.ymd, b.count, b.hot, b.looked])).toEqual([
      ['2026-10-19', null, false, false],
      ['2026-10-20', null, false, false],
      ['2026-10-21', 3, true, true],
      ['2026-10-22', 2, true, false],
      ['2026-10-23', 2, true, true],
    ])
  })
})

describe('emailTrend: the day by day', () => {
  const t = emailTrend(input())

  it('lists the days newest first, the days nobody looked included, with who looked first', () => {
    expect(t.rows.map((r) => [r.dayWords, r.looked])).toEqual([
      ['Fri Oct 23', 'Marisol · 9:55 AM'],
      ['Thu Oct 22', null],
      ['Wed Oct 21', 'Dale · 12:01 PM'],
      ['Tue Oct 20', null],
    ])
    expect(t.daysNobodyLooked).toBe(2)
  })

  it('sums the viewer’s labels only, and says what came and cleared', () => {
    expect(t.rows.map((r) => [r.open, r.oldestDays, r.newCount, r.clearedCount])).toEqual([
      [3, 9, 1, 1],
      [2, 5, 0, 1],
      [3, 4, 1, 0],
      [null, null, 0, 0],
    ])
  })

  it('names what sat past the limit at the end of each day, rebuilt from the threads, oldest first', () => {
    expect(t.rows[0]!.sat).toEqual([
      { days: 9, from: 'Harlan Freight', subject: 'W-9' },
      { days: 6, from: 'Ridgeway Builders', subject: 'Lot 7 — final waivers' },
    ])
    // Thursday: the toll bill was gone that morning; Ridgeway was 5 days old by the evening.
    expect(t.rows[1]!.sat.map((s) => [s.from, s.days])).toEqual([
      ['Harlan Freight', 8],
      ['Ridgeway Builders', 5],
    ])
    // Tuesday: the toll bill still sat, 5 days old; Ridgeway was 3 days old, not past 3.
    expect(t.rows[3]!.sat.map((s) => [s.from, s.days])).toEqual([
      ['Harlan Freight', 6],
      ['Toll Co', 5],
    ])
  })
})

describe('trendDayWords', () => {
  it('spells a day the way the window does', () => {
    expect(trendDayWords('2026-10-23')).toBe('Fri Oct 23')
    expect(trendDayWords('2026-11-01')).toBe('Sun Nov 1')
  })
})
