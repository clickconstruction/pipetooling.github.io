/**
 * Pure grouping + search kernel for the shared Team leads manager
 * (`TeamLeadsManager`, rendered by both the People → Users "Team leads" modal
 * and the People → Teams tab). Turns flat `team_leader_assignments` rows into
 * leader-centric groups — sorted by leader label, members sorted within each
 * group, archived accounts flagged and counted — and provides the
 * leader-or-member search predicate the manager's single search box uses.
 */

export type TeamLeadsRosterUser = {
  id: string
  name: string | null
  email: string | null
  archived_at?: string | null
}

export type TeamLeadsAssignment = {
  id: string
  leader_user_id: string
  member_user_id: string
  dashboard_hours_visibility: 'full' | 'strip_only'
}

export type TeamLeadMemberRow = {
  assignmentId: string
  memberId: string
  /** Base display label (name → email → raw id). No "(archived)" suffix — the UI renders that from `isArchived`. */
  label: string
  isArchived: boolean
  visibility: 'full' | 'strip_only'
}

export type TeamLeaderGroup = {
  leaderId: string
  /** Base display label (name → email → raw id). */
  leaderLabel: string
  isArchivedLeader: boolean
  /** Sorted by member label (case-insensitive). */
  members: TeamLeadMemberRow[]
  /** How many of `members` are archived accounts. */
  archivedCount: number
}

function labelFor(userId: string, users: TeamLeadsRosterUser[]): string {
  const u = users.find((x) => x.id === userId)
  return u?.name?.trim() || u?.email || userId
}

function archivedFor(userId: string, users: TeamLeadsRosterUser[]): boolean {
  return (users.find((x) => x.id === userId)?.archived_at ?? null) != null
}

function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

/**
 * Group assignments by leader. Groups sort by leader label; members within a
 * group sort by member label. Users missing from `allUsers` fall back to raw
 * ids and count as non-archived.
 */
export function groupTeamLeaderAssignments(
  assignments: TeamLeadsAssignment[],
  allUsers: TeamLeadsRosterUser[],
): TeamLeaderGroup[] {
  const byLeader = new Map<string, TeamLeadsAssignment[]>()
  for (const row of assignments) {
    const list = byLeader.get(row.leader_user_id) ?? []
    list.push(row)
    byLeader.set(row.leader_user_id, list)
  }
  const groups: TeamLeaderGroup[] = []
  for (const [leaderId, rows] of byLeader) {
    const members: TeamLeadMemberRow[] = rows.map((r) => ({
      assignmentId: r.id,
      memberId: r.member_user_id,
      label: labelFor(r.member_user_id, allUsers),
      isArchived: archivedFor(r.member_user_id, allUsers),
      visibility: r.dashboard_hours_visibility,
    }))
    members.sort((a, b) => compareLabels(a.label, b.label))
    groups.push({
      leaderId,
      leaderLabel: labelFor(leaderId, allUsers),
      isArchivedLeader: archivedFor(leaderId, allUsers),
      members,
      archivedCount: members.filter((m) => m.isArchived).length,
    })
  }
  groups.sort((a, b) => compareLabels(a.leaderLabel, b.leaderLabel))
  return groups
}

/**
 * Search predicate for the manager's single search box: a leader card shows
 * when its leader label OR any member label contains the query
 * (case-insensitive). Blank query matches everything.
 */
export function teamLeaderGroupMatchesQuery(group: TeamLeaderGroup, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (group.leaderLabel.toLowerCase().includes(q)) return true
  return group.members.some((m) => m.label.toLowerCase().includes(q))
}
