/**
 * Team leaderboard kernel (v2.954): role-grouped rankings over the
 * calibration-adjusted composite (teamComposite.ts), plus the company-wide
 * replace-priority focus strip. Only confident composites rank; low-data
 * people list unranked at the bottom of their role.
 */
import {
  AUTH_USER_ROLE_SECTION_LABEL,
  AUTH_USER_ROLE_SECTION_ORDER,
  type AuthUserRoleSectionKey,
} from '../usersTabRosterRoleSections'
import { compositeScore } from './teamComposite'
import type { CompositeResult, CompositeWeights } from './teamComposite'
import type { DimensionMeans, ReviewerBaseline } from './reviewerCalibration'
import type { RatableUser, TeamMemberReviewRow } from './teamMemberReviews'

export type LeaderboardEntry = { user: RatableUser; composite: CompositeResult }

export type RoleLeaderboard = {
  sectionKey: string
  label: string
  /** Confident entries ranked best-first, then insufficient-data entries by name. */
  entries: LeaderboardEntry[]
  /** Mean composite over confident entries, rounded; null when none. */
  roleAverage: number | null
  /** The lowest confident composite in the role (needs >= 2 confident entries to be meaningful). */
  weakestUserId: string | null
}

const KNOWN_SECTIONS = new Set<string>(AUTH_USER_ROLE_SECTION_ORDER)

function sectionOf(role: string): { key: string; label: string } {
  if (KNOWN_SECTIONS.has(role)) {
    const key = role as AuthUserRoleSectionKey
    return { key, label: AUTH_USER_ROLE_SECTION_LABEL[key] }
  }
  return { key: '__other__', label: 'Other' }
}

/** Role-grouped leaderboards in People → Users section order; roles with no members are omitted. */
export function buildRoleLeaderboards(
  roster: RatableUser[],
  reviews: TeamMemberReviewRow[],
  baselines: Map<string, ReviewerBaseline>,
  company: DimensionMeans,
  weights: CompositeWeights,
  currentMonth: string,
): RoleLeaderboard[] {
  const bySection = new Map<string, { label: string; entries: LeaderboardEntry[] }>()
  for (const user of roster) {
    const { key, label } = sectionOf(user.role)
    const entry: LeaderboardEntry = {
      user,
      composite: compositeScore(reviews, user.id, baselines, company, weights, currentMonth),
    }
    const section = bySection.get(key)
    if (section) section.entries.push(entry)
    else bySection.set(key, { label, entries: [entry] })
  }
  const orderedKeys = [...AUTH_USER_ROLE_SECTION_ORDER as readonly string[], '__other__']
  const result: RoleLeaderboard[] = []
  for (const key of orderedKeys) {
    const section = bySection.get(key)
    if (!section) continue
    const confident = section.entries
      .filter((e) => e.composite.confident && e.composite.score != null)
      .sort((a, b) => (b.composite.score ?? 0) - (a.composite.score ?? 0) || (a.user.name ?? '').localeCompare(b.user.name ?? ''))
    const insufficient = section.entries
      .filter((e) => !(e.composite.confident && e.composite.score != null))
      .sort((a, b) => (a.user.name ?? '').localeCompare(b.user.name ?? ''))
    const scores = confident.map((e) => e.composite.score ?? 0)
    const last = confident[confident.length - 1]
    result.push({
      sectionKey: key,
      label: section.label,
      entries: [...confident, ...insufficient],
      roleAverage: scores.length === 0 ? null : Math.round(scores.reduce((sum, v) => sum + v, 0) / scores.length),
      weakestUserId: confident.length >= 2 && last ? last.user.id : null,
    })
  }
  return result
}

/** Bottom N confident composites company-wide, worst first — the replace-priority focus strip. */
export function replaceFocusEntries(leaderboards: RoleLeaderboard[], n: number): Array<LeaderboardEntry & { roleLabel: string }> {
  return leaderboards
    .flatMap((board) =>
      board.entries
        .filter((e) => e.composite.confident && e.composite.score != null)
        .map((e) => ({ ...e, roleLabel: board.label })),
    )
    .sort((a, b) => (a.composite.score ?? 0) - (b.composite.score ?? 0) || (a.user.name ?? '').localeCompare(b.user.name ?? ''))
    .slice(0, n)
}
