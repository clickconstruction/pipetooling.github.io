/**
 * Crew tags for the roadmap Add-task modal: pure mapping between the
 * name-keyed People → Teams tables (`people_teams` + `people_team_members`)
 * and user-id-keyed task assignees.
 *
 * Teams store `person_name` (the app's usual normalized-name join, same
 * convention as pay config); assignee checkboxes are `users.id`. Members whose
 * name matches no user ("no login") are counted but can never be staffed —
 * and are deliberately never removed by a roster edit made through the modal,
 * since the checkbox picker can't represent them.
 */

export type CrewTeamRow = { id: string; name: string; sequence_order: number }
export type CrewMemberRow = { team_id: string; person_name: string }
export type CrewUser = { id: string; name: string | null }

export type CrewView = {
  id: string
  name: string
  /** users.id of members with a matching login, in team order. */
  memberUserIds: string[]
  /** Original person_name rows (verbatim) — needed for name-keyed writes. */
  memberNames: string[]
  /** Members whose name matched no user — shown as "N have no login". */
  unmatchedCount: number
}

export function normalizePersonName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

export function buildCrewViews(
  teams: readonly CrewTeamRow[],
  members: readonly CrewMemberRow[],
  users: readonly CrewUser[],
): CrewView[] {
  const userIdByName = new Map<string, string>()
  for (const u of users) {
    const key = normalizePersonName(u.name)
    if (key) userIdByName.set(key, u.id)
  }
  const membersByTeam = new Map<string, CrewMemberRow[]>()
  for (const m of members) {
    membersByTeam.set(m.team_id, [...(membersByTeam.get(m.team_id) ?? []), m])
  }
  return [...teams]
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .map((t) => {
      const rows = membersByTeam.get(t.id) ?? []
      const memberUserIds: string[] = []
      let unmatchedCount = 0
      for (const r of rows) {
        const id = userIdByName.get(normalizePersonName(r.person_name))
        if (id && !memberUserIds.includes(id)) memberUserIds.push(id)
        else if (!id) unmatchedCount += 1
      }
      return { id: t.id, name: t.name, memberUserIds, memberNames: rows.map((r) => r.person_name), unmatchedCount }
    })
}

export type CrewChipState = 'all' | 'some' | 'none'

/** filled when every mapped member is checked, dashed when only some are. */
export function crewChipState(
  memberUserIds: readonly string[],
  checked: Readonly<Record<string, boolean>>,
): CrewChipState {
  if (memberUserIds.length === 0) return 'none'
  let on = 0
  for (const id of memberUserIds) {
    if (checked[id]) on += 1
  }
  return on === memberUserIds.length ? 'all' : on > 0 ? 'some' : 'none'
}

/**
 * Roster diff for a name-keyed save. `selectedUserIds` is the edit panel's
 * checkbox state; removals are computed only over names that map to a known
 * user — a member with no login is out of the picker's reach and stays put.
 */
export function crewRosterDiff(
  originalNames: readonly string[],
  selectedUserIds: readonly string[],
  users: readonly CrewUser[],
): { namesToAdd: string[]; namesToRemove: string[] } {
  const nameById = new Map(users.map((u) => [u.id, (u.name ?? '').trim()]))
  const selectedNormalized = new Set(
    selectedUserIds.map((id) => normalizePersonName(nameById.get(id))).filter(Boolean),
  )
  const knownUserNames = new Set(users.map((u) => normalizePersonName(u.name)).filter(Boolean))
  const originalNormalized = new Set(originalNames.map((n) => normalizePersonName(n)))

  const namesToRemove = originalNames.filter((n) => {
    const key = normalizePersonName(n)
    return knownUserNames.has(key) && !selectedNormalized.has(key)
  })
  const namesToAdd: string[] = []
  for (const id of selectedUserIds) {
    const display = nameById.get(id)
    if (!display) continue
    if (!originalNormalized.has(normalizePersonName(display))) namesToAdd.push(display)
  }
  return { namesToAdd, namesToRemove }
}
