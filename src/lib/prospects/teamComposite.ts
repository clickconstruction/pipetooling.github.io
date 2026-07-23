/**
 * Team composite kernel (v2.953): folds a person's calibration-adjusted
 * monthly ratings into one weighted, recency-decayed score with an explicit
 * confidence gate — the number the leaderboard ranks by.
 */
import { RATING_DEFS } from '../../components/prospects/ratingDimensions'
import type { RatingKey } from '../../components/prospects/ratingDimensions'
import { adjustedRating } from './reviewerCalibration'
import type { DimensionMeans, ReviewerBaseline } from './reviewerCalibration'
import type { TeamMemberReviewRow } from './teamMemberReviews'

export type CompositeWeights = { ability: number; drive: number; integrity: number }

export const DEFAULT_COMPOSITE_WEIGHTS: CompositeWeights = { ability: 1 / 3, drive: 1 / 3, integrity: 1 / 3 }

/** Exponential recency decay: a month this many months old counts half. */
export const COMPOSITE_DECAY_HALF_LIFE_MONTHS = 3

/** Distinct reviewers required before a composite is rankable. */
export const COMPOSITE_MIN_REVIEWERS = 2

const WEIGHT_BY_DIMENSION: Record<RatingKey, keyof CompositeWeights> = {
  rating_ability: 'ability',
  rating_drive: 'drive',
  rating_integrity: 'integrity',
}

/** Parse the app_settings JSON ({ability,drive,integrity} positive numbers), normalized to sum 1; null when invalid. */
export function parseCompositeWeights(valueText: string | null | undefined): CompositeWeights | null {
  if (!valueText) return null
  try {
    const raw = JSON.parse(valueText) as Record<string, unknown>
    const ability = Number(raw.ability)
    const drive = Number(raw.drive)
    const integrity = Number(raw.integrity)
    if (![ability, drive, integrity].every((v) => Number.isFinite(v) && v >= 0)) return null
    const total = ability + drive + integrity
    if (total <= 0) return null
    return { ability: ability / total, drive: drive / total, integrity: integrity / total }
  } catch {
    return null
  }
}

export function serializeCompositeWeights(weights: CompositeWeights): string {
  return JSON.stringify(weights)
}

/** Whole months between two first-of-month ISO strings (b − a); 0 when equal or malformed. */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  if (!ay || !am || !by || !bm) return 0
  return (by - ay) * 12 + (bm - am)
}

export type MonthlyComposite = { month: string; composite: number; reviewerCount: number }

/**
 * Per-month weighted composite of calibration-adjusted cross-reviewer
 * averages, oldest first. Weights renormalize over the dimensions actually
 * rated that month; months with no ratings are skipped.
 */
export function monthlyCompositeSeries(
  reviews: TeamMemberReviewRow[],
  subjectUserId: string,
  baselines: Map<string, ReviewerBaseline>,
  company: DimensionMeans,
  weights: CompositeWeights = DEFAULT_COMPOSITE_WEIGHTS,
): MonthlyComposite[] {
  const byMonth = new Map<string, TeamMemberReviewRow[]>()
  for (const r of reviews) {
    if (r.subject_user_id !== subjectUserId) continue
    const list = byMonth.get(r.review_month)
    if (list) list.push(r)
    else byMonth.set(r.review_month, [r])
  }
  const result: MonthlyComposite[] = []
  for (const [month, rows] of [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    let weightedSum = 0
    let weightTotal = 0
    for (const def of RATING_DEFS) {
      const adjusted = rows
        .map((r) => adjustedRating(r[def.key], def.key, baselines.get(r.reviewer_user_id), company))
        .filter((v): v is number => v != null)
      if (adjusted.length === 0) continue
      const dimensionMean = adjusted.reduce((sum, v) => sum + v, 0) / adjusted.length
      const w = weights[WEIGHT_BY_DIMENSION[def.key]]
      weightedSum += dimensionMean * w
      weightTotal += w
    }
    if (weightTotal > 0) {
      result.push({ month, composite: Math.round(weightedSum / weightTotal), reviewerCount: rows.length })
    }
  }
  return result
}

export type CompositeResult = {
  /** Recency-decayed weighted score, or null with no data. */
  score: number | null
  /** Distinct reviewers across all of the subject's reviews. */
  reviewerCount: number
  monthsCovered: number
  /** reviewerCount >= COMPOSITE_MIN_REVIEWERS — rankable. */
  confident: boolean
}

/** The leaderboard number: monthly composites blended with exponential recency decay from currentMonth. */
export function compositeScore(
  reviews: TeamMemberReviewRow[],
  subjectUserId: string,
  baselines: Map<string, ReviewerBaseline>,
  company: DimensionMeans,
  weights: CompositeWeights,
  currentMonth: string,
): CompositeResult {
  const series = monthlyCompositeSeries(reviews, subjectUserId, baselines, company, weights)
  const reviewerIds = new Set(reviews.filter((r) => r.subject_user_id === subjectUserId).map((r) => r.reviewer_user_id))
  if (series.length === 0) {
    return { score: null, reviewerCount: reviewerIds.size, monthsCovered: 0, confident: false }
  }
  let weightedSum = 0
  let weightTotal = 0
  for (const point of series) {
    const monthsAgo = Math.max(0, monthsBetween(point.month, currentMonth))
    const decay = Math.pow(0.5, monthsAgo / COMPOSITE_DECAY_HALF_LIFE_MONTHS)
    weightedSum += point.composite * decay
    weightTotal += decay
  }
  return {
    score: Math.round(weightedSum / weightTotal),
    reviewerCount: reviewerIds.size,
    monthsCovered: series.length,
    confident: reviewerIds.size >= COMPOSITE_MIN_REVIEWERS,
  }
}
