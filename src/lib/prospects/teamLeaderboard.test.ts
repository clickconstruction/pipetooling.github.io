import { describe, expect, it } from 'vitest'
import { buildRoleLeaderboards, replaceFocusEntries } from './teamLeaderboard'
import { DEFAULT_COMPOSITE_WEIGHTS } from './teamComposite'
import type { RatableUser, TeamMemberReviewRow } from './teamMemberReviews'

const MONTH = '2026-07-01'
const NO_BASELINES = new Map<string, never>()
const FLAT_COMPANY = { rating_ability: 70, rating_drive: 70, rating_integrity: 70 }

/** Two reviewers rate the subject at the given level → confident composite ≈ level. */
function ratedBy2(subject: string, level: number): TeamMemberReviewRow[] {
  return ['rev-a', 'rev-b'].map((reviewer) => ({
    id: `${subject}-${reviewer}`,
    subject_user_id: subject,
    reviewer_user_id: reviewer,
    review_month: MONTH,
    rating_ability: level,
    rating_drive: level,
    rating_integrity: level,
    comment_ability: null,
    comment_drive: null,
    comment_integrity: null,
  }))
}

const roster: RatableUser[] = [
  { id: 'm1', name: 'Mia', role: 'master_technician' },
  { id: 'h1', name: 'Hank', role: 'helpers' },
  { id: 'h2', name: 'Al', role: 'helpers' },
  { id: 'h3', name: 'Newbie', role: 'helpers' },
  { id: 'x1', name: 'Odd', role: 'mystery_role' },
]

const reviews = [
  ...ratedBy2('m1', 90),
  ...ratedBy2('h1', 40),
  ...ratedBy2('h2', 75),
  // h3 has only ONE reviewer → insufficient data.
  ...ratedBy2('h3', 99).slice(0, 1),
]

function build() {
  return buildRoleLeaderboards(roster, reviews, NO_BASELINES, FLAT_COMPANY, DEFAULT_COMPOSITE_WEIGHTS, MONTH)
}

describe('buildRoleLeaderboards', () => {
  it('groups by role-section order, ranks confident best-first, appends insufficient, computes role average and weakest', () => {
    const boards = build()
    expect(boards.map((b) => b.label)).toEqual(['Master Technicians', 'Helper', 'Other'])
    const helpers = boards[1]
    expect(helpers?.entries.map((e) => e.user.id)).toEqual(['h2', 'h1', 'h3']) // 75, 40, then insufficient
    expect(helpers?.roleAverage).toBe(58) // (75+40)/2
    expect(helpers?.weakestUserId).toBe('h1')
    expect(helpers?.entries[2]?.composite.confident).toBe(false)
  })

  it('needs >= 2 confident members before naming a weakest link', () => {
    const boards = build()
    expect(boards[0]?.weakestUserId).toBeNull() // Mia alone in her role
  })
})

describe('replaceFocusEntries', () => {
  it('returns the bottom-N confident composites company-wide, worst first, with role labels', () => {
    const focus = replaceFocusEntries(build(), 2)
    expect(focus.map((e) => `${e.user.id}:${e.roleLabel}`)).toEqual(['h1:Helper', 'h2:Helper'])
  })

  it('never includes insufficient-data people', () => {
    const focus = replaceFocusEntries(build(), 10)
    expect(focus.some((e) => e.user.id === 'h3')).toBe(false)
  })
})
