/** People → Hours → Teams: the team list as loaded, as shown, and what a day costs on the "max hours" view. */

import type { PeopleHoursTeam } from '../../components/people/PeopleHoursTeams'

export type PeopleTeamRow = { id: string; name: string; sequence_order?: number | null }
export type PeopleTeamMemberRow = { team_id: string; person_name: string }

/** Teams in the order they were read, each with its members in the order they were read. */
export function buildPeopleHoursTeams(teamRows: PeopleTeamRow[], memberRows: PeopleTeamMemberRow[]): PeopleHoursTeam[] {
  const membersByTeam = new Map<string, string[]>()
  for (const m of memberRows) {
    if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, [])
    membersByTeam.get(m.team_id)!.push(m.person_name)
  }
  return teamRows.map((t) => ({ id: t.id, name: t.name, members: membersByTeam.get(t.id) ?? [] }))
}

/** The teams without their archived members (names matched trimmed). */
export function teamsWithoutArchivedMembers(teams: PeopleHoursTeam[], archivedUserNames: ReadonlySet<string>): PeopleHoursTeam[] {
  return teams.map((t) => ({
    ...t,
    members: t.members.filter((m) => !archivedUserNames.has(m.trim())),
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
