import { describe, expect, it } from 'vitest'
import {
  CALIBRATION_MIN_SUBJECTS,
  adjustedAverages,
  adjustedRating,
  companyDimensionMeans,
  deviationsFromNorm,
  formatDeviations,
  latestReviewPerPair,
  reviewerBaselines,
} from './reviewerCalibration'
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

/** A calibrated reviewer: rates `subjects` people at the given flat level. */
function flatReviews(reviewerId: string, level: number, subjects: string[]): TeamMemberReviewRow[] {
  return subjects.map((s) =>
    review({ reviewer_user_id: reviewerId, subject_user_id: s, rating_ability: level, rating_drive: level, rating_integrity: level }),
  )
}

describe('latestReviewPerPair', () => {
  it('keeps only the newest month per (reviewer, subject)', () => {
    const rows = [
      review({ id: 'old', review_month: '2026-05-01' }),
      review({ id: 'new', review_month: '2026-07-01' }),
      review({ id: 'other-pair', subject_user_id: 's2' }),
    ]
    expect(latestReviewPerPair(rows).map((r) => r.id).sort()).toEqual(['new', 'other-pair'])
  })
})

describe('reviewerBaselines', () => {
  it('computes per-dimension means, overall stats, and the calibration flag', () => {
    const rows = [
      ...flatReviews('bob', 50, ['s1', 's2']),
      review({ reviewer_user_id: 'bob', subject_user_id: 's3', rating_ability: 80, rating_drive: null, rating_integrity: 20 }),
    ]
    const bob = reviewerBaselines(rows).get('bob')
    expect(bob?.subjectCount).toBe(3)
    expect(bob?.calibrated).toBe(true)
    expect(bob?.means.rating_ability).toBeCloseTo(60) // (50+50+80)/3
    expect(bob?.means.rating_drive).toBeCloseTo(50) // null excluded
    expect(bob?.overallMin).toBe(20)
    expect(bob?.overallMax).toBe(80)
    expect(bob?.overallMean).toBe(50) // (50*6 + 80 + 20)/8
  })

  it(`marks reviewers under ${CALIBRATION_MIN_SUBJECTS} subjects uncalibrated`, () => {
    const baselines = reviewerBaselines(flatReviews('newbie', 90, ['s1', 's2']))
    expect(baselines.get('newbie')?.calibrated).toBe(false)
  })

  it('uses only the latest review per subject (re-reviews do not double count)', () => {
    const rows = [
      review({ reviewer_user_id: 'a', subject_user_id: 's1', review_month: '2026-06-01', rating_ability: 0 }),
      review({ reviewer_user_id: 'a', subject_user_id: 's1', review_month: '2026-07-01', rating_ability: 100 }),
    ]
    expect(reviewerBaselines(rows).get('a')?.means.rating_ability).toBe(100)
  })
})

describe('adjustedRating', () => {
  const company = { rating_ability: 70, rating_drive: 70, rating_integrity: 70 }
  const harsh = reviewerBaselines(flatReviews('harsh', 54, ['s1', 's2', 's3'])).get('harsh')
  const lenient = reviewerBaselines(flatReviews('lenient', 82, ['s1', 's2', 's3'])).get('lenient')

  it("re-anchors a rating around the reviewer's norm (the worked example)", () => {
    // Harsh rater's 60 is above his norm of 54 → adjusted 76; lenient's 78 is below her 82 → 66.
    expect(adjustedRating(60, 'rating_ability', harsh, company)).toBe(76)
    expect(adjustedRating(78, 'rating_ability', lenient, company)).toBe(66)
  })

  it('passes raw through for uncalibrated reviewers and clamps to 0–100', () => {
    const newbie = reviewerBaselines(flatReviews('n', 10, ['s1'])).get('n')
    expect(adjustedRating(60, 'rating_ability', newbie, company)).toBe(60)
    expect(adjustedRating(100, 'rating_ability', harsh, company)).toBe(100) // 70+46 clamps
    expect(adjustedRating(null, 'rating_ability', harsh, company)).toBeNull()
  })
})

describe('adjustedAverages', () => {
  it('mixes calibrated (corrected) and uncalibrated (raw) reviewers and counts each', () => {
    const corpus = [...flatReviews('harsh', 54, ['a', 'b', 'c']), ...flatReviews('newbie', 90, ['x'])]
    const baselines = reviewerBaselines(corpus)
    const company = { rating_ability: 70, rating_drive: 70, rating_integrity: 70 }
    const latestForSubject = [
      review({ reviewer_user_id: 'harsh', rating_ability: 60 }), // adjusted → 76
      review({ reviewer_user_id: 'newbie', rating_ability: 90 }), // raw pass-through
    ]
    const result = adjustedAverages(latestForSubject, baselines, company)
    expect(result.ability).toBe(83) // (76+90)/2
    expect(result.calibratedCount).toBe(1)
    expect(result.uncalibratedCount).toBe(1)
  })
})

describe('companyDimensionMeans', () => {
  it('averages the latest-per-pair corpus per dimension', () => {
    const rows = [...flatReviews('a', 60, ['s1']), ...flatReviews('b', 80, ['s1'])]
    expect(companyDimensionMeans(rows).rating_ability).toBeCloseTo(70)
  })
})

describe('deviationsFromNorm / formatDeviations', () => {
  it('shows signed deviations for calibrated reviewers, null when uncalibrated', () => {
    const baselines = reviewerBaselines(flatReviews('bob', 54, ['s1', 's2', 's3']))
    const row = review({ reviewer_user_id: 'bob', rating_ability: 60, rating_drive: 54, rating_integrity: null })
    const dev = deviationsFromNorm(row, baselines.get('bob'))
    expect(dev).toEqual({ rating_ability: 6, rating_drive: 0, rating_integrity: null })
    expect(formatDeviations(dev)).toBe('+6 · 0 · — vs their norm')
    expect(deviationsFromNorm(row, undefined)).toBeNull()
    expect(formatDeviations(null)).toBeNull()
  })
})
