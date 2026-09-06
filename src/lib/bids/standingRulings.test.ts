import { describe, expect, it } from 'vitest'

import { groupStandingRulings, rulingAskedLine, topicLabel, type TwinQuestionRow } from './standingRulings'

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

describe('groupStandingRulings', () => {
  it('collapses same-topic questions into one ruling with the newest text on top', () => {
    const view = groupStandingRulings([
      q({ id: 'q1', topic: 'travel-bands', about_bid_id: 'b1', created_at: '2026-09-01T10:00:00Z', question: 'travel past 200 miles?' }),
      q({ id: 'q2', topic: 'travel-bands', about_bid_id: 'b2', created_at: '2026-09-03T10:00:00Z', question: 'do we band travel by distance?' }),
      q({ id: 'q3', topic: 'small-ti-absorption', about_bid_id: 'b1', created_at: '2026-09-02T10:00:00Z' }),
    ])
    expect(view.openCount).toBe(3)
    expect(view.singles).toEqual([])
    expect(view.rulings).toHaveLength(2)
    const travel = view.rulings[0]
    expect(travel?.topic).toBe('travel-bands')
    expect(travel?.label).toBe('Travel bands')
    expect(travel?.newest.id).toBe('q2') // newest phrasing is the canonical one
    expect(travel?.questionIds).toEqual(['q2', 'q1']) // every open duplicate, newest first
    expect(travel?.askCount).toBe(2)
    expect(travel?.bidCount).toBe(2)
  })

  it('most-asked first, then newest; ignores non-open rows entirely', () => {
    const view = groupStandingRulings([
      q({ id: 'a1', topic: 'alpha', created_at: '2026-09-05T10:00:00Z' }),
      q({ id: 'b1', topic: 'beta', created_at: '2026-09-01T10:00:00Z' }),
      q({ id: 'b2', topic: 'beta', created_at: '2026-09-02T10:00:00Z' }),
      q({ id: 'x1', topic: 'beta', status: 'answered' }),
      q({ id: 'x2', topic: 'gamma', status: 'dismissed' }),
    ])
    expect(view.rulings.map((r) => r.topic)).toEqual(['beta', 'alpha'])
    expect(view.rulings[0]?.askCount).toBe(2) // the answered row didn't count
    expect(view.openCount).toBe(3)
  })

  it('topicless (and blank-topic) questions list individually, newest first', () => {
    const view = groupStandingRulings([
      q({ id: 's1', created_at: '2026-09-01T10:00:00Z' }), // topic undefined — pre-migration select('*')
      q({ id: 's2', topic: '  ', created_at: '2026-09-02T10:00:00Z' }),
      q({ id: 't1', topic: 'travel-bands' }),
    ])
    expect(view.singles.map((s) => s.id)).toEqual(['s2', 's1'])
    expect(view.rulings).toHaveLength(1)
    expect(view.openCount).toBe(3)
  })

  it('dedupes bid count and survives an empty queue', () => {
    const view = groupStandingRulings([
      q({ id: 'q1', topic: 'poc-length', about_bid_id: 'b1' }),
      q({ id: 'q2', topic: 'poc-length', about_bid_id: 'b1', created_at: '2026-09-02T10:00:00Z' }),
      q({ id: 'q3', topic: 'poc-length', about_bid_id: null, created_at: '2026-09-03T10:00:00Z' }),
    ])
    expect(view.rulings[0]?.askCount).toBe(3)
    expect(view.rulings[0]?.bidCount).toBe(1) // same bid twice + one bid-less ask
    expect(groupStandingRulings([])).toEqual({ rulings: [], singles: [], openCount: 0 })
  })
})

describe('rulingAskedLine / topicLabel', () => {
  it('phrases counts naturally', () => {
    expect(rulingAskedLine({ askCount: 3, bidCount: 2 })).toBe('asked 3 times across 2 bids')
    expect(rulingAskedLine({ askCount: 1, bidCount: 1 })).toBe('asked once across 1 bid')
    expect(rulingAskedLine({ askCount: 2, bidCount: 0 })).toBe('asked 2 times')
  })

  it('humanizes kebab slugs', () => {
    expect(topicLabel('travel-bands')).toBe('Travel bands')
    expect(topicLabel('small-ti-absorption')).toBe('Small ti absorption')
    expect(topicLabel('package_boundary')).toBe('Package boundary')
  })
})
