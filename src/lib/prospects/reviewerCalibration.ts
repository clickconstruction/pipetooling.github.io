/**
 * Reviewer calibration kernel (v2.952): corrects rater leniency/severity bias
 * in team-member reviews. Because the Rate deck pushes every reviewer to rate
 * everyone, differences in reviewer means are ~pure calibration bias, so
 * mean-centering is statistically legitimate: adjusted = company mean +
 * (rating − reviewer's personal mean). Reviewers below the subject floor pass
 * through raw ("uncalibrated").
 */
import { RATING_DEFS } from '../../components/prospects/ratingDimensions'
import type { RatingKey } from '../../components/prospects/ratingDimensions'
import type { TeamMemberReviewRow } from './teamMemberReviews'

/** A reviewer's personal mean only counts once they've rated this many people. */
export const CALIBRATION_MIN_SUBJECTS = 3

export type DimensionMeans = Record<RatingKey, number | null>

export type ReviewerBaseline = {
  reviewer_user_id: string
  /** People this reviewer has rated (latest review per subject). */
  subjectCount: number
  /** Per-dimension personal means over their latest review of each subject (unrounded). */
  means: DimensionMeans
  /** Mean of all their non-null ratings across dimensions, rounded — the tendencies panel number. */
  overallMean: number | null
  overallMin: number | null
  overallMax: number | null
  /** subjectCount >= CALIBRATION_MIN_SUBJECTS — their personal mean is trustworthy. */
  calibrated: boolean
}

/** Each reviewer's newest review of each subject (the calibration corpus). */
export function latestReviewPerPair(reviews: TeamMemberReviewRow[]): TeamMemberReviewRow[] {
  const latest = new Map<string, TeamMemberReviewRow>()
  for (const r of reviews) {
    const key = `${r.reviewer_user_id}:${r.subject_user_id}`
    const prev = latest.get(key)
    if (!prev || r.review_month > prev.review_month) latest.set(key, r)
  }
  return [...latest.values()]
}

function meanOf(values: Array<number | null>): number | null {
  const rated = values.filter((v): v is number => v != null)
  if (rated.length === 0) return null
  return rated.reduce((sum, v) => sum + v, 0) / rated.length
}

/** Per-reviewer baselines over the latest review of each subject. */
export function reviewerBaselines(reviews: TeamMemberReviewRow[]): Map<string, ReviewerBaseline> {
  const byReviewer = new Map<string, TeamMemberReviewRow[]>()
  for (const r of latestReviewPerPair(reviews)) {
    const list = byReviewer.get(r.reviewer_user_id)
    if (list) list.push(r)
    else byReviewer.set(r.reviewer_user_id, [r])
  }
  const result = new Map<string, ReviewerBaseline>()
  for (const [reviewerId, rows] of byReviewer) {
    const means: DimensionMeans = {
      rating_ability: meanOf(rows.map((r) => r.rating_ability)),
      rating_drive: meanOf(rows.map((r) => r.rating_drive)),
      rating_integrity: meanOf(rows.map((r) => r.rating_integrity)),
    }
    const allRatings = rows.flatMap((r) => [r.rating_ability, r.rating_drive, r.rating_integrity]).filter((v): v is number => v != null)
    const overall = meanOf(allRatings)
    result.set(reviewerId, {
      reviewer_user_id: reviewerId,
      subjectCount: rows.length,
      means,
      overallMean: overall == null ? null : Math.round(overall),
      overallMin: allRatings.length === 0 ? null : Math.min(...allRatings),
      overallMax: allRatings.length === 0 ? null : Math.max(...allRatings),
      calibrated: rows.length >= CALIBRATION_MIN_SUBJECTS,
    })
  }
  return result
}

/** Company-wide per-dimension means over the calibration corpus (unrounded). */
export function companyDimensionMeans(reviews: TeamMemberReviewRow[]): DimensionMeans {
  const corpus = latestReviewPerPair(reviews)
  return {
    rating_ability: meanOf(corpus.map((r) => r.rating_ability)),
    rating_drive: meanOf(corpus.map((r) => r.rating_drive)),
    rating_integrity: meanOf(corpus.map((r) => r.rating_integrity)),
  }
}

/**
 * One rating corrected for its reviewer's calibration, clamped to 0–100 and
 * rounded. Falls back to the raw value when the reviewer is uncalibrated or a
 * mean is missing.
 */
export function adjustedRating(
  raw: number | null,
  dimension: RatingKey,
  baseline: ReviewerBaseline | undefined,
  company: DimensionMeans,
): number | null {
  if (raw == null) return null
  const reviewerMean = baseline?.calibrated ? baseline.means[dimension] : null
  const companyMean = company[dimension]
  if (reviewerMean == null || companyMean == null) return raw
  return Math.round(Math.min(100, Math.max(0, companyMean + (raw - reviewerMean))))
}

export type AdjustedAverages = {
  ability: number | null
  drive: number | null
  integrity: number | null
  /** Reviewers whose ratings were actually corrected. */
  calibratedCount: number
  /** Reviewers passed through raw (below the subject floor). */
  uncalibratedCount: number
}

/** Cross-reviewer averages of calibration-adjusted ratings (input: one row per reviewer, e.g. latest-per-reviewer). */
export function adjustedAverages(
  rows: TeamMemberReviewRow[],
  baselines: Map<string, ReviewerBaseline>,
  company: DimensionMeans,
): AdjustedAverages {
  const avgDim = (dimension: RatingKey): number | null => {
    const values = rows
      .map((r) => adjustedRating(r[dimension], dimension, baselines.get(r.reviewer_user_id), company))
      .filter((v): v is number => v != null)
    if (values.length === 0) return null
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
  }
  let calibratedCount = 0
  let uncalibratedCount = 0
  for (const r of rows) {
    if (baselines.get(r.reviewer_user_id)?.calibrated) calibratedCount++
    else uncalibratedCount++
  }
  return {
    ability: avgDim('rating_ability'),
    drive: avgDim('rating_drive'),
    integrity: avgDim('rating_integrity'),
    calibratedCount,
    uncalibratedCount,
  }
}

/**
 * Per-dimension deviation of one review from its reviewer's personal norm
 * ("+6" = above their norm), rounded; null per dimension when unrated, and
 * null overall when the reviewer is uncalibrated.
 */
export function deviationsFromNorm(
  row: TeamMemberReviewRow,
  baseline: ReviewerBaseline | undefined,
): Record<RatingKey, number | null> | null {
  if (!baseline?.calibrated) return null
  const result = {} as Record<RatingKey, number | null>
  for (const def of RATING_DEFS) {
    const raw = row[def.key]
    const mean = baseline.means[def.key]
    result[def.key] = raw == null || mean == null ? null : Math.round(raw - mean)
  }
  return result
}

/** "+6 · +1 · −4 vs their norm" (— for unrated dims); null when uncalibrated. */
export function formatDeviations(deviations: Record<RatingKey, number | null> | null): string | null {
  if (!deviations) return null
  const parts = RATING_DEFS.map((def) => {
    const d = deviations[def.key]
    if (d == null) return '—'
    return d > 0 ? `+${d}` : `${d}`
  })
  return `${parts.join(' · ')} vs their norm`
}
