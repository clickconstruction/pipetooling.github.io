import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { displayLabelForGoalPickerUser } from '../lib/goalPickerUserLabel'

type GoalPickerUser = { id: string; name: string | null; email: string | null }

export type TeamLeaderAssignmentRow = {
  id: string
  leader_user_id: string
  member_user_id: string
  dashboard_hours_visibility: 'full' | 'strip_only'
}

/**
 * Team leads manager engine (People → Users → Team leads modal): the
 * team_leader_assignments rows + sort/filter/picker derivations. Extracted
 * verbatim from Settings.tsx (v2.858) as useSettingsTeamLeaderAssignments,
 * renamed/rehomed when the manager moved off Settings → Dashboard & alerts.
 * Loads on mount when `enabled` (dev|master|assistant-like). Row
 * insert/update/delete writes stay in the caller (TeamLeadsModal) via the
 * returned setter. `setError` is the caller's shared error state.
 */
export function useTeamLeaderAssignments({
  enabled,
  goalPickerUsers,
  labelUsers,
  setError,
}: {
  enabled: boolean
  goalPickerUsers: GoalPickerUser[]
  /** Roster for DISPLAY labels (sort/search). Defaults to goalPickerUsers; pass a
   * superset including archived users so existing links never render raw UUIDs
   * (the pickers stay non-archived via goalPickerUsers). */
  labelUsers?: GoalPickerUser[]
  setError: (message: string | null) => void
}) {
  const labelRoster = labelUsers ?? goalPickerUsers
  const [teamLeaderAssignments, setTeamLeaderAssignments] = useState<TeamLeaderAssignmentRow[]>([])
  const [teamLeaderVisibilitySavingId, setTeamLeaderVisibilitySavingId] = useState<string | null>(null)
  const [teamAssignLeaderId, setTeamAssignLeaderId] = useState('')
  const [teamAssignMemberId, setTeamAssignMemberId] = useState('')
  const [teamAssignSaving, setTeamAssignSaving] = useState(false)
  const [teamLeaderSortColumn, setTeamLeaderSortColumn] = useState<'leader' | 'member'>('leader')
  const [teamLeaderSortDir, setTeamLeaderSortDir] = useState<'asc' | 'desc'>('asc')
  const [teamLeaderAssignmentsSearchQuery, setTeamLeaderAssignmentsSearchQuery] = useState('')

  // Initial load (was part of Settings.tsx loadData's dev|master|assistant branch)
  useEffect(() => {
    if (!enabled) return
    void (async () => {
      const { data: tlaRows, error: tlaErr } = await supabase
        .from('team_leader_assignments')
        .select('id, leader_user_id, member_user_id, dashboard_hours_visibility')
        .order('created_at', { ascending: false })
      if (tlaErr) setError(tlaErr.message)
      else
        setTeamLeaderAssignments(
          ((tlaRows ?? []) as Array<{
            id: string
            leader_user_id: string
            member_user_id: string
            dashboard_hours_visibility: string | null
          }>).map((r) => ({
            id: r.id,
            leader_user_id: r.leader_user_id,
            member_user_id: r.member_user_id,
            dashboard_hours_visibility:
              r.dashboard_hours_visibility === 'strip_only' ? 'strip_only' : 'full',
          })),
        )
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  const sortedTeamLeaderAssignments = useMemo(() => {
    const rows = [...teamLeaderAssignments]
    rows.sort((a, b) => {
      const aKey =
        teamLeaderSortColumn === 'leader'
          ? displayLabelForGoalPickerUser(a.leader_user_id, labelRoster)
          : displayLabelForGoalPickerUser(a.member_user_id, labelRoster)
      const bKey =
        teamLeaderSortColumn === 'leader'
          ? displayLabelForGoalPickerUser(b.leader_user_id, labelRoster)
          : displayLabelForGoalPickerUser(b.member_user_id, labelRoster)
      const base = aKey.localeCompare(bKey, undefined, { sensitivity: 'base' })
      return teamLeaderSortDir === 'asc' ? base : -base
    })
    return rows
  }, [teamLeaderAssignments, labelRoster, teamLeaderSortColumn, teamLeaderSortDir])

  const filteredTeamLeaderAssignments = useMemo(() => {
    const q = teamLeaderAssignmentsSearchQuery.trim().toLowerCase()
    if (!q) return sortedTeamLeaderAssignments
    return sortedTeamLeaderAssignments.filter((row) => {
      const leaderLabel = displayLabelForGoalPickerUser(row.leader_user_id, labelRoster).toLowerCase()
      const memberLabel = displayLabelForGoalPickerUser(row.member_user_id, labelRoster).toLowerCase()
      return leaderLabel.includes(q) || memberLabel.includes(q)
    })
  }, [sortedTeamLeaderAssignments, labelRoster, teamLeaderAssignmentsSearchQuery])

  const teamHoursMemberPickerUsers = useMemo(() => {
    if (!teamAssignLeaderId) return []
    const assignedIds = new Set(
      teamLeaderAssignments
        .filter((r) => r.leader_user_id === teamAssignLeaderId)
        .map((r) => r.member_user_id),
    )
    return goalPickerUsers.filter((u) => u.id !== teamAssignLeaderId && !assignedIds.has(u.id))
  }, [teamAssignLeaderId, teamLeaderAssignments, goalPickerUsers])

  useEffect(() => {
    if (!teamAssignMemberId || !teamAssignLeaderId) return
    if (!teamHoursMemberPickerUsers.some((u) => u.id === teamAssignMemberId)) {
      setTeamAssignMemberId('')
    }
  }, [teamAssignLeaderId, teamAssignMemberId, teamHoursMemberPickerUsers])

  const teamHoursNoMembersAvailable = Boolean(teamAssignLeaderId && teamHoursMemberPickerUsers.length === 0)
  const teamHoursMemberPickerDisabled =
    !teamAssignLeaderId || teamAssignSaving || teamHoursNoMembersAvailable
  const teamHoursMemberPlaceholder = !teamAssignLeaderId
    ? 'Choose a leader first…'
    : teamHoursNoMembersAvailable
      ? 'No users left to assign'
      : 'Select user…'

  return {
    teamLeaderAssignments,
    setTeamLeaderAssignments,
    teamLeaderVisibilitySavingId,
    setTeamLeaderVisibilitySavingId,
    teamAssignLeaderId,
    setTeamAssignLeaderId,
    teamAssignMemberId,
    setTeamAssignMemberId,
    teamAssignSaving,
    setTeamAssignSaving,
    teamLeaderSortColumn,
    setTeamLeaderSortColumn,
    teamLeaderSortDir,
    setTeamLeaderSortDir,
    teamLeaderAssignmentsSearchQuery,
    setTeamLeaderAssignmentsSearchQuery,
    sortedTeamLeaderAssignments,
    filteredTeamLeaderAssignments,
    teamHoursMemberPickerUsers,
    teamHoursNoMembersAvailable,
    teamHoursMemberPickerDisabled,
    teamHoursMemberPlaceholder,
  }
}
