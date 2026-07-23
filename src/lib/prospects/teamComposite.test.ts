import { describe, expect, it } from 'vitest'
import {
  COMPOSITE_MIN_REVIEWERS,
  DEFAULT_COMPOSITE_WEIGHTS,
  compositeScore,
  monthlyCompositeSeries,
  monthsBetween,
  parseCompositeWeights,
  serializeCompositeWeights,
} from './teamComposite'
import { companyDimensionMeans, reviewerBaselines } from './reviewerCalibration'
import type { TeamMemberReviewRow } from './teamMemberReviews'

const review = (overrides: Partial<TeamMemberReviewRow>): TeamMemberReviewRow => ({
  id: Math.random().toString(36).slice(2),
  subject_user_id: 'subject',
  reviewer_user_id: 'reviewer',
  review_month: '2026-07-01',
  rating_ability: 70,
  rating_drive: 70,
  rating_integrity: 70,
  comment_ability: null,
  comment_drive: null,
  comment_integrity: null,
  ...overrides,
})

const NO_BASELINES = new Map<string, never>()
const FLAT_COMPANY = { rating_ability: 70, rating_drive: 70, rating_integrity: 70 }

describe('parseCompositeWeights / serializeCompositeWeights', () => {
  it('parses and normalizes to sum 1', () => {
    const w = parseCompositeWeights('{"ability":40,"drive":30,"integrity":30}')
    expect(w).not.toBeNull()
    expect(w?.ability).toBeCloseTo(0.4)
    expect(w?.drive).toBeCloseTo(0.3)
    expect(parseCompositeWeights(serializeCompositeWeights(w ?? DEFAULT_COMPOSITE_WEIGHTS))?.ability).toBeCloseTo(0.4)
  })
  it('rejects garbage, negatives, and zero totals', () => {
    expect(parseCompositeWeights(null)).toBeNull()
    expect(parseCompositeWeights('not json')).toBeNull()
    expect(parseCompositeWeights('{"ability":-1,"drive":1,"integrity":1}')).toBeNull()
    expect(parseCompositeWeights('{"ability":0,"drive":0,"integrity":0}')).toBeNull()
  })
})

describe('monthsBetween', () => {
  it('counts whole months between first-of-month strings', () => {
    expect(monthsBetween('2026-05-01', '2026-07-01')).toBe(2)
    expect(monthsBetween('2025-12-01', '2026-01-01')).toBe(1)
    expect(monthsBetween('2026-07-01', '2026-07-01')).toBe(0)
  })
})

describe('monthlyCompositeSeries', () => {
  it('weights dimensions and renormalizes over rated ones', () => {
    const rows = [review({ rating_ability: 90, rating_drive: 60, rating_integrity: null })]
    // Equal weights over the two rated dims: (90+60)/2 = 75.
    expect(monthlyCompositeSeries(rows, 'subject', NO_BASELINES, FLAT_COMPANY)).toEqual([
      { month: '2026-07-01', composite: 75, reviewerCount: 1 },
    ])
  })
  it('applies custom weights', () => {
    const rows = [review({ rating_ability: 100, rating_drive: 0, rating_integrity: 0 })]
    const heavyAbility = parseCompositeWeights('{"ability":80,"drive":10,"integrity":10}')
    expect(monthlyCompositeSeries(rows, 'subject', NO_BASELINES, FLAT_COMPANY, heavyAbility ?? undefined)?.[0]?.composite).toBe(80)
  })
  it('applies reviewer calibration: a harsh grader\'s 60 rises once a lenient grader lifts the company mean', () => {
    const flat = (reviewer: string, subject: string, level: number) =>
      review({ reviewer_user_id: reviewer, subject_user_id: subject, rating_ability: level, rating_drive: level, rating_integrity: level })
    const subjectRow = flat('harsh', 'subject', 60)
    // harsh's norm ≈ 55.5 over 4 people; lenient (82 × 3) pulls the company mean to ≈ 66.9.
    const all = [flat('harsh', 'a', 54), flat('harsh', 'b', 54), flat('harsh', 'c', 54), subjectRow,
      flat('lenient', 'a', 82), flat('lenient', 'b', 82), flat('lenient', 'c', 82)]
    const series = monthlyCompositeSeries([subjectRow], 'subject', reviewerBaselines(all), companyDimensionMeans(all))
    expect(series[0]?.composite).toBe(71) // 66.86 + (60 − 55.5)
  })
})

describe('compositeScore', () => {
  it('decays older months (recent month dominates)', () => {
    const rows = [
      review({ review_month: '2026-01-01', rating_ability: 20, rating_drive: 20, rating_integrity: 20 }),
      review({ review_month: '2026-07-01', rating_ability: 80, rating_drive: 80, rating_integrity: 80 }),
    ]
    const result = compositeScore(rows, 'subject', NO_BASELINES, FLAT_COMPANY, DEFAULT_COMPOSITE_WEIGHTS, '2026-07-01')
    expect(result.score).not.toBeNull()
    expect(result.score ?? 0).toBeGreaterThan(65) // Jan (6 mo old, quarter weight) drags 80 down only slightly
    expect(result.monthsCovered).toBe(2)
  })

  it(`is confident only with >= ${COMPOSITE_MIN_REVIEWERS} distinct reviewers`, () => {
    const solo = [review({ reviewer_user_id: 'only' })]
    expect(compositeScore(solo, 'subject', NO_BASELINES, FLAT_COMPANY, DEFAULT_COMPOSITE_WEIGHTS, '2026-07-01').confident).toBe(false)
    const duo = [review({ reviewer_user_id: 'a' }), review({ reviewer_user_id: 'b' })]
    expect(compositeScore(duo, 'subject', NO_BASELINES, FLAT_COMPANY, DEFAULT_COMPOSITE_WEIGHTS, '2026-07-01').confident).toBe(true)
  })

  it('returns null score with no data', () => {
    expect(compositeScore([], 'subject', NO_BASELINES, FLAT_COMPANY, DEFAULT_COMPOSITE_WEIGHTS, '2026-07-01')).toEqual({
      score: null,
      reviewerCount: 0,
      monthsCovered: 0,
      confident: false,
    })
  })
})
