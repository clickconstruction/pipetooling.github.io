import { AUTH_USER_ROLE_SECTION_LABEL, groupRosterUsersByAuthRoleSection, type AuthRoleSectionGroup, type AuthUserRoleSectionKey, type RosterUserRow } from '../usersTabRosterRoleSections'

/**
 * The Day on a phone (punch list #30, PR 4b): the roster as three groups a
 * dispatcher picks between — the crews she dispatches, the office, and
 * everyone with nothing on the day. Pure.
 *
 * Crews are the roles that work a job site, in the order the owner set
 * (2026-09-27): leaders, superintendents, subcontractors, helpers. Everyone
 * else with a block is Office. A person with no block on the day is Free,
 * whatever the role.
 */

export type DayPhoneGroupKey = 'crews' | 'office' | 'free'

export const DAY_PHONE_CREW_ROLES: ReadonlyArray<AuthUserRoleSectionKey> = ['master_technician', 'superintendent', 'subcontractor', 'helpers']

const crewRank = new Map<string, number>(DAY_PHONE_CREW_ROLES.map((r, i) => [r, i]))

export function isDayPhoneCrewRole(role: string | null | undefined): boolean {
  return role != null && crewRank.has(role)
}

export interface DayPhoneGroups {
  /** The groups' sections, each by role, names A–Z inside (the order handed in). */
  sections: Record<DayPhoneGroupKey, AuthRoleSectionGroup[]>
  /** People per group — what each chip says. */
  counts: Record<DayPhoneGroupKey, number>
  /** Crew blocks on the day that carry no note. */
  crewBlocksWithoutNote: number
}

export function buildDayPhoneGroups(
  usersSortedByName: ReadonlyArray<RosterUserRow>,
  roleByUserId: Map<string, string>,
  blocksByUserId: ReadonlyMap<string, ReadonlyArray<{ note?: string | null }>>,
): DayPhoneGroups {
  const crews: RosterUserRow[] = []
  const office: RosterUserRow[] = []
  const free: RosterUserRow[] = []
  let crewBlocksWithoutNote = 0
  for (const u of usersSortedByName) {
    const blocks = blocksByUserId.get(u.id) ?? []
    if (blocks.length === 0) {
      free.push(u)
      continue
    }
    if (isDayPhoneCrewRole(roleByUserId.get(u.id)?.trim())) {
      crews.push(u)
      for (const b of blocks) if (!(b.note ?? '').trim()) crewBlocksWithoutNote += 1
    } else office.push(u)
  }
  const crewSections = groupRosterUsersByAuthRoleSection(crews, roleByUserId)
    .sort((a, b) => (crewRank.get(a.sectionKey) ?? 99) - (crewRank.get(b.sectionKey) ?? 99))
    // One helper is a Helper; a group of them reads better as the plural the chip promises.
    .map((s) => (s.sectionKey === 'helpers' ? { ...s, label: s.rows.length === 1 ? AUTH_USER_ROLE_SECTION_LABEL.helpers : 'Helpers' } : s))
  return {
    sections: {
      crews: crewSections,
      office: groupRosterUsersByAuthRoleSection(office, roleByUserId),
      free: groupRosterUsersByAuthRoleSection(free, roleByUserId),
    },
    counts: { crews: crews.length, office: office.length, free: free.length },
    crewBlocksWithoutNote,
  }
}

/** The group the Day opens on: the crews, unless nobody on a crew has a block — then the first group with anyone in it. */
export function dayPhoneDefaultGroup(counts: Record<DayPhoneGroupKey, number>): DayPhoneGroupKey {
  if (counts.crews > 0) return 'crews'
  if (counts.office > 0) return 'office'
  return 'free'
}

/** What the Day draws: the picked group's sections — or, while a search is typed, every group's matches, crews first. */
export function dayPhoneVisibleSections(groups: DayPhoneGroups, picked: DayPhoneGroupKey, searching: boolean): AuthRoleSectionGroup[] {
  if (!searching) return groups.sections[picked]
  return [...groups.sections.crews, ...groups.sections.office, ...groups.sections.free.map((s) => ({ ...s, sectionKey: `free:${s.sectionKey}`, label: `${s.label} · free` }))]
}
