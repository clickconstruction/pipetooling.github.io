/** People → Hours → Teams: the team list as loaded, as shown, and what a day costs on the "max hours" view. */

import type { PeopleHoursTeam } from '../../components/people/PeopleHoursTeams'
import { isArchivedRosterRef, type ArchivedRoster } from './rosterPeople'

export type PeopleTeamRow = { id: string; name: string; sequence_order?: number | null }
export type PeopleTeamMemberRow = { team_id: string; person_name: string; person_id?: string | null }

/**
 * Teams in the order they were read, each with its members in the order they were read, and the
 * `person_id` each member row carries (`memberPersonIds`, keyed by the member's name as read).
 */
export function buildPeopleHoursTeams(teamRows: PeopleTeamRow[], memberRows: PeopleTeamMemberRow[]): PeopleHoursTeam[] {
  const membersByTeam = new Map<string, string[]>()
  const idsByTeam = new Map<string, Record<string, string | null>>()
  for (const m of memberRows) {
    if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, [])
    membersByTeam.get(m.team_id)!.push(m.person_name)
    const ids = idsByTeam.get(m.team_id) ?? {}
    ids[m.person_name] = m.person_id ?? null
    idsByTeam.set(m.team_id, ids)
  }
  return teamRows.map((t) => ({ id: t.id, name: t.name, members: membersByTeam.get(t.id) ?? [], memberPersonIds: idsByTeam.get(t.id) ?? {} }))
}

/**
 * The teams without their archived members, id first (#29 item 3, v2.4862): a member whose
 * `person_id` the roster knows takes that row's verdict; one added since the load, or with no id,
 * is matched by its name, trimmed and without case.
 */
export function teamsWithoutArchivedMembers(teams: PeopleHoursTeam[], archived: ArchivedRoster): PeopleHoursTeam[] {
  return teams.map((t) => ({
    ...t,
    members: t.members.filter((m) => !isArchivedRosterRef(archived, { name: m, person_id: t.memberPersonIds?.[m] })),
  }))
}

/**
 * A person's cost for a day on the Teams section. With "max hours" on, a weekday (Mon–Fri) is
 * a flat 8 hours at the hourly wage whatever was worked; a weekend day, and every day with it
 * off, is the day's actual cost.
 */
export function teamDayCost(input: { showMaxHours: boolean; hourlyWage: number | null | undefined; workDate: string; actualCost: () => number }): number {
  if (!input.showMaxHours) return input.actualCost()
  const wage = input.hourlyWage ?? 0
  const day = new Date(input.workDate + 'T12:00:00').getDay()
  if (day >= 1 && day <= 5) return wage * 8
  return input.actualCost()
}
