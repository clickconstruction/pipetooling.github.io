import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { localCalendarDayKey, todayYmdInAppTz } from '../utils/dateUtils'
import type { PayConfigRow } from '../types/peoplePayConfig'
import type { ArchivedRoster } from '../lib/people/rosterPeople'
import type { PeopleHoursTeam } from '../components/people/PeopleHoursTeams'
import { buildPeopleHoursTeams, teamDayCost, teamsWithoutArchivedMembers, type PeopleTeamMemberRow, type PeopleTeamRow } from '../lib/people/hoursTeams'

export type UsePeopleHoursTeamsInput = {
  canAccessPay: boolean
  setError: (value: string | null) => void
  /** Who is archived, by id then by name (`buildArchivedRoster`). */
  archived: ArchivedRoster
  payConfig: Record<string, PayConfigRow>
  /** The Hours grid's cost for a person's day — what a team day costs unless "max hours" is on. */
  getCostForPersonDate: (personName: string, workDate: string) => number
}

export type PeopleHoursTeamsApi = {
  setTeams: Dispatch<SetStateAction<PeopleHoursTeam[]>>
  teamsFiltered: PeopleHoursTeam[]
  teamPeriodStart: string
  setTeamPeriodStart: Dispatch<SetStateAction<string>>
  teamPeriodEnd: string
  setTeamPeriodEnd: Dispatch<SetStateAction<string>>
  showMaxHoursTeams: boolean
  setShowMaxHoursTeams: Dispatch<SetStateAction<boolean>>
  teamToDelete: { id: string; name: string } | null
  setTeamToDelete: Dispatch<SetStateAction<{ id: string; name: string } | null>>
  teamDeletingId: string | null
  loadTeams: () => Promise<void>
  addTeam: () => Promise<void>
  updateTeamName: (teamId: string, name: string) => Promise<void>
  addTeamMember: (teamId: string, personName: string) => Promise<void>
  removeTeamMember: (teamId: string, personName: string) => Promise<void>
  deleteTeam: (teamId: string) => Promise<void>
  getCostForPersonDateTeams: (personName: string, workDate: string) => number
}

/** People → Hours → Teams and Due summaries: the teams, their period, and the five writes. Every write needs pay access. */
export function usePeopleHoursTeams({ canAccessPay, setError, archived, payConfig, getCostForPersonDate }: UsePeopleHoursTeamsInput): PeopleHoursTeamsApi {
  const [teams, setTeams] = useState<PeopleHoursTeam[]>([])
  const [teamPeriodStart, setTeamPeriodStart] = useState(() => {
    const d = new Date()
    const start = new Date(d)
    start.setDate(d.getDate() - 6)
    return localCalendarDayKey(start)
  })
  const [teamPeriodEnd, setTeamPeriodEnd] = useState(() => todayYmdInAppTz())
  const [showMaxHoursTeams, setShowMaxHoursTeams] = useState(false)
  const [teamToDelete, setTeamToDelete] = useState<{ id: string; name: string } | null>(null)
  const [teamDeletingId, setTeamDeletingId] = useState<string | null>(null)

  async function loadTeams() {
    if (!canAccessPay) return
    const [teamsRes, membersRes] = await Promise.all([
      supabase.from('people_teams').select('id, name, sequence_order').order('sequence_order', { ascending: true }),
      supabase.from('people_team_members').select('team_id, person_name, person_id'),
    ])
    if (teamsRes.error) return
    setTeams(buildPeopleHoursTeams((teamsRes.data ?? []) as PeopleTeamRow[], (membersRes.data ?? []) as PeopleTeamMemberRow[]))
  }

  async function addTeam() {
    if (!canAccessPay) return
    const { data, error } = await supabase.from('people_teams').insert({ name: 'New Team', sequence_order: teams.length }).select('id').single()
    if (error) setError(error.message)
    else if (data) setTeams((prev) => [...prev, { id: (data as { id: string }).id, name: 'New Team', members: [] }])
  }

  async function updateTeamName(teamId: string, name: string) {
    if (!canAccessPay) return
    const { error } = await supabase.from('people_teams').update({ name }).eq('id', teamId)
    if (error) setError(error.message)
    else setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name } : t)))
  }

  async function addTeamMember(teamId: string, personName: string) {
    if (!canAccessPay) return
    const { error } = await supabase.from('people_team_members').insert({ team_id: teamId, person_name: personName })
    if (error) setError(error.message)
    else setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, members: [...t.members, personName] } : t)))
  }

  async function removeTeamMember(teamId: string, personName: string) {
    if (!canAccessPay) return
    const { error } = await supabase.from('people_team_members').delete().eq('team_id', teamId).eq('person_name', personName)
    if (error) setError(error.message)
    else setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, members: t.members.filter((m) => m !== personName) } : t)))
  }

  async function deleteTeam(teamId: string) {
    if (!canAccessPay) return
    setTeamDeletingId(teamId)
    setError(null)
    const { error } = await supabase.from('people_teams').delete().eq('id', teamId)
    if (error) {
      setError(error.message)
      setTeamDeletingId(null)
      return
    }
    setTeams((prev) => prev.filter((t) => t.id !== teamId))
    setTeamToDelete(null)
    setTeamDeletingId(null)
  }

  function getCostForPersonDateTeams(personName: string, workDate: string): number {
    return teamDayCost({
      showMaxHours: showMaxHoursTeams,
      hourlyWage: payConfig[personName]?.hourly_wage,
      workDate,
      actualCost: () => getCostForPersonDate(personName, workDate),
    })
  }

  const teamsFiltered = useMemo(() => teamsWithoutArchivedMembers(teams, archived), [teams, archived])

  return {
    setTeams,
    teamsFiltered,
    teamPeriodStart,
    setTeamPeriodStart,
    teamPeriodEnd,
    setTeamPeriodEnd,
    showMaxHoursTeams,
    setShowMaxHoursTeams,
    teamToDelete,
    setTeamToDelete,
    teamDeletingId,
    loadTeams,
    addTeam,
    updateTeamName,
    addTeamMember,
    removeTeamMember,
    deleteTeam,
    getCostForPersonDateTeams,
  }
}
