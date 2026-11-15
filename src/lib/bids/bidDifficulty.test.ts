import { describe, expect, it } from 'vitest'
import { DIFFICULTY_CRITERIA_V1 } from './difficultyCriteria'
import { difficultyLines } from './difficultyLines'
import { DIFFICULTY_PRICE_V1 } from './difficultyPrice'
import { gcDifficultyStanding, type GcDifficultyRating } from './gcDifficultyRating'
import {
  bidDifficultyAfterTakeOff,
  bidDifficultyAmountOnRows,
  bidDifficultyPinFor,
  bidDifficultyRemovedWords,
  bidDifficultyRowsFor,
  bidDifficultyStageShares,
  bidDifficultyStale,
  type BidDifficulty,
} from './bidDifficulty'

const V1 = { id: 'v1', version: 1, body: DIFFICULTY_CRITERIA_V1 }
const rating = (over: Partial<GcDifficultyRating> = {}): GcDifficultyRating => ({ id: 'r1', customerId: 'c1', criteriaVersionId: 'v1', picks: { field: 2, office: 1 }, pickReasons: {}, note: 'Moved us from C to A.', ratedByName: 'Robert', ratedAt: '2026-11-14T20:00:00Z', ...over })
const standing = (r = rating()) => gcDifficultyStanding(r, [V1], V1)

const lines = () => difficultyLines({ scales: standing().sentences, price: DIFFICULTY_PRICE_V1, fieldHours: 480, laborRate: 80, ownCost: 114266, carried: 172400, payingMedianDays: null, payingReason: null })

const row = (id: string, rough: number, top = 0, trim = 0) => ({ id, rough_in: rough, top_out: top, trim_set: trim, sequence_order: 1 })

function pin(over: Partial<BidDifficulty> = {}): BidDifficulty {
  const base = bidDifficultyPinFor({ bidId: 'b1', costEstimateId: 'ce1', standing: standing(), priceVersionId: 'p1', lines: lines(), fieldHours: 480, laborRate: 80, ownCost: 114266, carried: 172400, rowIds: ['o1', 'o2'] })
  return { ...base, id: 'pin1', pricedByName: 'Micah', pricedAt: '2026-11-15T10:00:00Z', ...over }
}

describe('bidDifficulty (punch list #357, PR 4)', () => {
  it('splits a line’s dollars by the stage shares of the bid’s field hours, the last stage taking the rounding', () => {
    const labor = [
      { count: 10, is_fixed: false, rough_in_hrs_per_unit: 2, top_out_hrs_per_unit: 1, trim_set_hrs_per_unit: 1 }, // 20 / 10 / 10
      { count: 1, is_fixed: true, kind: 'task', rough_in_hrs_per_unit: 5, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0 }, // 5 fixed
      { count: 3, is_fixed: false, kind: 'sub', rough_in_hrs_per_unit: 9, top_out_hrs_per_unit: 9, trim_set_hrs_per_unit: 9 }, // a sub counts none
    ]
    const shares = bidDifficultyStageShares(labor)
    expect(shares.rough_in).toBeCloseTo(25 / 45)
    expect(shares.top_out).toBeCloseTo(10 / 45)
    expect(bidDifficultyStageShares([])).toEqual({ rough_in: 1, top_out: 0, trim_set: 0 })
    const rows = bidDifficultyRowsFor(lines().lines, 'ce1', shares, 4)
    expect(rows.map((r) => r.sequence_order)).toEqual([4, 5])
    expect(rows[0]).toEqual({ cost_estimate_id: 'ce1', note: 'Difficulty · Field and superintendent 2 · 10% of 480 field hours at $80', rough_in: 2133.33, top_out: 853.33, trim_set: 853.34, sequence_order: 4 })
    expect(rows[0]!.rough_in + rows[0]!.top_out + rows[0]!.trim_set).toBeCloseTo(3840)
  })

  it('the pin names the rating, the versions, the picks and the lines as written', () => {
    const p = pin()
    expect(p).toMatchObject({ bidId: 'b1', ratingId: 'r1', criteriaVersionId: 'v1', priceVersionId: 'p1', picks: { field: 2, office: 1 }, points: 3, totalUsd: 4800, rowIds: ['o1', 'o2'], removed: [] })
    expect(p.lines.map((l) => l.key)).toEqual(['field', 'office'])
  })

  it('the difficulty rows’ dollars on the estimate now, by the pin’s row ids', () => {
    expect(bidDifficultyAmountOnRows([row('o1', 3000, 840), row('o2', 960), row('x', 500)], ['o1', 'o2'])).toBe(4800)
    expect(bidDifficultyAmountOnRows([row('o2', 960)], ['o1', 'o2'])).toBe(960)
  })

  it('stale: a different rating than the pin’s, higher, lower or reworded; never the same rating', () => {
    expect(bidDifficultyStale(pin(), standing())).toBeNull()
    expect(bidDifficultyStale(null, standing())).toBeNull()
    const higher = standing(rating({ id: 'r2', picks: { field: 3, office: 2 }, ratedByName: 'Taunya', ratedAt: '2026-11-20T09:00:00Z' }))
    expect(bidDifficultyStale(pin(), higher)).toEqual({ kind: 'higher', words: 'Rated higher since this was priced: 5 points now, 3 when priced, by Taunya on 2026-11-20.' })
    const lower = standing(rating({ id: 'r3', picks: { field: 1 } }))
    expect(bidDifficultyStale(pin(), lower)!.kind).toBe('lower')
    const same = standing(rating({ id: 'r4', picks: { field: 1, office: 2 } }))
    expect(bidDifficultyStale(pin(), same)).toEqual({ kind: 'reworded', words: 'Rated again since this was priced, 3 points both times, by Robert on 2026-11-14.' })
  })

  it('PR 6: the bid’s own picks moving is stale too, and the GC’s points are compared without them', () => {
    const words = 'The site was picked since this was priced: 1 point now, unrated when priced.'
    expect(bidDifficultyStale(pin(), standing(), words, ['site'])).toEqual({ kind: 'bid', words })
    // A pin priced with the GC's 3 points and a site point reads 4; the GC rated again at 3 is the same, not lower.
    const withSite = pin({ picks: { field: 2, office: 1, site: 1 }, points: 4 })
    const again = standing(rating({ id: 'r3' }))
    expect(bidDifficultyStale(withSite, again, null, ['site'])).toEqual({ kind: 'reworded', words: 'Rated again since this was priced, 3 points both times, by Robert on 2026-11-14.' })
    // The GC's own change wins over the site's.
    expect(bidDifficultyStale(withSite, again, words, ['site'])!.kind).toBe('reworded')
  })

  it('PR 6: a bid to a GC nobody rated is pinned on its own picks, and a rating since says so', () => {
    const own = difficultyLines({ scales: [{ key: 'site', name: 'The site', points: 1, sentence: 'An occupied building, or no room to stage.' }], price: DIFFICULTY_PRICE_V1, fieldHours: 480, laborRate: 80, ownCost: 114266, carried: 172400, payingMedianDays: null, payingReason: null })
    const p = bidDifficultyPinFor({ bidId: 'b1', costEstimateId: 'ce1', standing: null, bidPicks: { site: 1 }, publishedVersionId: 'v2', priceVersionId: 'p1', lines: own, fieldHours: 480, laborRate: 80, ownCost: 114266, carried: 172400, rowIds: ['o1'] })
    expect(p).toMatchObject({ ratingId: null, criteriaVersionId: 'v2', picks: { site: 1 }, points: 1, totalUsd: 1536 })
    const pinned: BidDifficulty = { ...p, id: 'pin2', pricedByName: 'Micah', pricedAt: '2026-11-15T10:00:00Z' }
    expect(bidDifficultyStale(pinned, null, null, ['site'])).toBeNull()
    expect(bidDifficultyStale(pinned, standing(), null, ['site'])).toEqual({ kind: 'higher', words: 'Rated since this was priced: 3 points, by Robert on 2026-11-14.' })
    // With a rating, the pin carries the GC's picks and the bid's together.
    expect(bidDifficultyPinFor({ bidId: 'b1', costEstimateId: 'ce1', standing: standing(), bidPicks: { site: 2 }, publishedVersionId: 'v2', priceVersionId: 'p1', lines: lines(), fieldHours: 480, laborRate: 80, ownCost: 1, carried: 1, rowIds: [] })).toMatchObject({ ratingId: 'r1', criteriaVersionId: 'v1', picks: { field: 2, office: 1, site: 2 } })
  })

  it('a reason keeps the letter it was typed with', () => {
    expect(bidDifficultyRemovedWords({ key: 'office', name: 'Their office', amount: 960, reason: 'ZZ walk: taken off to see the row go.', byName: 'Robert', at: '2026-11-20T10:00:00Z' })).toBe('Their office · $960 taken off by Robert on 2026-11-20: ZZ walk: taken off to see the row go.')
  })

  it('taking a line off: the line out, the rest kept, the removal recorded with who and why', () => {
    const next = bidDifficultyAfterTakeOff(pin(), 'office', 'their office on this one is the good one', 'Robert', '2026-11-20T10:00:00Z')!
    expect(next.rowIndex).toBe(1)
    expect(next.lines.map((l) => l.key)).toEqual(['field'])
    expect(next.points).toBe(2)
    expect(next.totalUsd).toBe(3840)
    expect(next.removed).toEqual([{ key: 'office', name: 'Their office', amount: 960, reason: 'their office on this one is the good one', byName: 'Robert', at: '2026-11-20T10:00:00Z' }])
    expect(bidDifficultyRemovedWords(next.removed[0]!)).toBe('Their office · $960 taken off by Robert on 2026-11-20: their office on this one is the good one')
    expect(bidDifficultyAfterTakeOff(pin(), 'weather', 'x', 'R', '2026-11-20')).toBeNull()
  })
})
