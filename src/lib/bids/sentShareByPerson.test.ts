import { describe, expect, it } from 'vitest'
import { buildSentShareByPerson, SENT_SHARE_OTHER_KEY, SENT_SHARE_UNASSIGNED_KEY, type SentShareInputBid } from './sentShareByPerson'

const now = new Date(2026, 7, 23) // Aug 23, 2026
const bid = (sent: string, value: number, who: string | null, name?: string): SentShareInputBid => ({
  bid_date_sent: sent,
  bid_value: value,
  estimator_id: who,
  estimator: who ? { name: name ?? who, email: null } : null,
})

describe('buildSentShareByPerson', () => {
  it('windows to six calendar months, splits shares by count and $, empties included', () => {
    const data = buildSentShareByPerson(
      [
        bid('2026-08-20', 300, 'r', 'Robert'),
        bid('2026-08-18', 100, 't', 'Trace'),
        bid('2026-03-02', 600, 'r', 'Robert'),
        bid('2026-02-28', 999999, 'r', 'Robert'), // before Mar 1 window → excluded
      ],
      now,
    )
    expect(data.monthly).toHaveLength(6)
    expect(data.monthly.map((m) => m.label)).toEqual(['Aug', 'Jul', 'Jun', 'May', 'Apr', 'Mar'])
    const aug = data.monthly[0]!
    expect(aug.totalCount).toBe(2)
    expect(aug.totalDollars).toBe(400)
    expect(aug.segments.map((s) => [s.name, s.pctCount, s.pctDollars])).toEqual([
      ['Robert', 50, 75],
      ['Trace', 50, 25],
    ])
    expect(data.monthly[1]!.totalCount).toBe(0) // Jul empty but present
    // window totals
    expect(data.people.map((p) => [p.name, p.count, p.dollars])).toEqual([
      ['Robert', 2, 900],
      ['Trace', 1, 100],
    ])
  })

  it('orders people by window $ (color stability), folds past maxNamed into Other, Unassigned last', () => {
    const data = buildSentShareByPerson(
      [
        bid('2026-08-01', 50, 'a', 'Ann'),
        bid('2026-08-02', 500, 'b', 'Bob'),
        bid('2026-08-03', 5, 'c', 'Cy'),
        bid('2026-08-04', 40, null),
      ],
      now,
      { maxNamed: 2 },
    )
    expect(data.people.map((p) => p.key)).toEqual(['b', 'a', SENT_SHARE_OTHER_KEY, SENT_SHARE_UNASSIGNED_KEY])
    const aug = data.monthly[0]!
    expect(aug.segments.map((s) => s.name)).toEqual(['Bob', 'Ann', 'Other', 'Unassigned'])
  })

  it('weekly rows cover the window newest-first with W-labels and month ticks, empties kept', () => {
    const data = buildSentShareByPerson([bid('2026-08-20', 100, 'r', 'Robert')], now)
    expect(data.weekly.length).toBeGreaterThan(20)
    expect(data.weekly[0]!.label).toMatch(/^W\d+$/)
    // first row (this week) carries the month tick
    expect(data.weekly[0]!.monthTick).toBe('Aug')
    // exactly one tick per month present
    const ticks = data.weekly.filter((w) => w.monthTick != null).map((w) => w.monthTick)
    expect(new Set(ticks).size).toBe(ticks.length)
    // the week containing Aug 20 has the bid
    const hot = data.weekly.find((w) => w.totalCount > 0)!
    expect(hot.totalDollars).toBe(100)
  })
})
