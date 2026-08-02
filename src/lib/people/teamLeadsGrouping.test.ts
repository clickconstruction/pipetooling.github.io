import { describe, expect, it } from 'vitest'
import {
  groupTeamLeaderAssignments,
  teamLeaderGroupMatchesQuery,
  type TeamLeadsAssignment,
  type TeamLeadsRosterUser,
} from './teamLeadsGrouping'

const USERS: TeamLeadsRosterUser[] = [
  { id: 'u-zed', name: 'Zed Zimmer', email: 'zed@example.com', archived_at: null },
  { id: 'u-ann', name: 'Ann Alvarez', email: 'ann@example.com', archived_at: null },
  { id: 'u-bob', name: null, email: 'bob@example.com', archived_at: null },
  { id: 'u-old', name: 'Olga Old', email: 'olga@example.com', archived_at: '2026-01-15T00:00:00Z' },
]

function assignment(partial: Partial<TeamLeadsAssignment> & { id: string }): TeamLeadsAssignment {
  return {
    leader_user_id: 'u-zed',
    member_user_id: 'u-ann',
    dashboard_hours_visibility: 'full',
    ...partial,
  }
}

describe('groupTeamLeaderAssignments', () => {
  it('groups rows by leader and carries assignment id + visibility onto member rows', () => {
    const groups = groupTeamLeaderAssignments(
      [
        assignment({ id: 'a1', leader_user_id: 'u-zed', member_user_id: 'u-ann' }),
        assignment({ id: 'a2', leader_user_id: 'u-zed', member_user_id: 'u-bob', dashboard_hours_visibility: 'strip_only' }),
        assignment({ id: 'a3', leader_user_id: 'u-ann', member_user_id: 'u-zed' }),
      ],
      USERS,
    )
    expect(groups).toHaveLength(2)
    const zed = groups.find((g) => g.leaderId === 'u-zed')
    expect(zed?.members.map((m) => m.assignmentId)).toEqual(['a1', 'a2'])
    expect(zed?.members.find((m) => m.assignmentId === 'a2')?.visibility).toBe('strip_only')
    expect(groups.find((g) => g.leaderId === 'u-ann')?.members.map((m) => m.memberId)).toEqual(['u-zed'])
  })

  it('sorts groups by leader label and members by member label (name → email fallback)', () => {
    const groups = groupTeamLeaderAssignments(
      [
        assignment({ id: 'a1', leader_user_id: 'u-zed', member_user_id: 'u-bob' }),
        assignment({ id: 'a2', leader_user_id: 'u-bob', member_user_id: 'u-ann' }),
        assignment({ id: 'a3', leader_user_id: 'u-ann', member_user_id: 'u-zed' }),
        assignment({ id: 'a4', leader_user_id: 'u-zed', member_user_id: 'u-ann' }),
      ],
      USERS,
    )
    // Leader order: Ann Alvarez, bob@example.com (email fallback), Zed Zimmer.
    expect(groups.map((g) => g.leaderLabel)).toEqual(['Ann Alvarez', 'bob@example.com', 'Zed Zimmer'])
    // Zed's members sorted: Ann Alvarez before bob@example.com.
    expect(groups[2]!.members.map((m) => m.label)).toEqual(['Ann Alvarez', 'bob@example.com'])
  })

  it('flags archived members/leaders and counts archived members per group', () => {
    const groups = groupTeamLeaderAssignments(
      [
        assignment({ id: 'a1', leader_user_id: 'u-zed', member_user_id: 'u-old' }),
        assignment({ id: 'a2', leader_user_id: 'u-zed', member_user_id: 'u-ann' }),
        assignment({ id: 'a3', leader_user_id: 'u-old', member_user_id: 'u-ann' }),
      ],
      USERS,
    )
    const zed = groups.find((g) => g.leaderId === 'u-zed')
    expect(zed?.isArchivedLeader).toBe(false)
    expect(zed?.archivedCount).toBe(1)
    expect(zed?.members.find((m) => m.memberId === 'u-old')?.isArchived).toBe(true)
    expect(zed?.members.find((m) => m.memberId === 'u-ann')?.isArchived).toBe(false)
    const olga = groups.find((g) => g.leaderId === 'u-old')
    expect(olga?.isArchivedLeader).toBe(true)
    expect(olga?.archivedCount).toBe(0)
  })

  it('falls back to raw ids for users missing from the roster (never crashes)', () => {
    const groups = groupTeamLeaderAssignments(
      [assignment({ id: 'a1', leader_user_id: 'u-ghost', member_user_id: 'u-phantom' })],
      USERS,
    )
    expect(groups[0]!.leaderLabel).toBe('u-ghost')
    expect(groups[0]!.members[0]!.label).toBe('u-phantom')
    expect(groups[0]!.isArchivedLeader).toBe(false)
    expect(groups[0]!.members[0]!.isArchived).toBe(false)
  })
})

describe('teamLeaderGroupMatchesQuery', () => {
  const groups = groupTeamLeaderAssignments(
    [
      assignment({ id: 'a1', leader_user_id: 'u-zed', member_user_id: 'u-ann' }),
      assignment({ id: 'a2', leader_user_id: 'u-bob', member_user_id: 'u-old' }),
    ],
    USERS,
  )
  const zed = groups.find((g) => g.leaderId === 'u-zed')!
  const bob = groups.find((g) => g.leaderId === 'u-bob')!

  it('blank query matches everything', () => {
    expect(teamLeaderGroupMatchesQuery(zed, '')).toBe(true)
    expect(teamLeaderGroupMatchesQuery(bob, '   ')).toBe(true)
  })

  it('matches on the leader label, case-insensitively', () => {
    expect(teamLeaderGroupMatchesQuery(zed, 'zimm')).toBe(true)
    expect(teamLeaderGroupMatchesQuery(bob, 'ZIMM')).toBe(false)
  })

  it('matches on any member label', () => {
    expect(teamLeaderGroupMatchesQuery(zed, 'alvarez')).toBe(true)
    expect(teamLeaderGroupMatchesQuery(bob, 'olga')).toBe(true)
    expect(teamLeaderGroupMatchesQuery(zed, 'olga')).toBe(false)
  })
})
