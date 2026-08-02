import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type GoalPickerUser = { id: string; name: string | null; email: string | null }

export type TeamLeaderAssignmentRow = {
  id: string
  leader_user_id: string
  member_user_id: string
  dashboard_hours_visibility: 'full' | 'strip_only'
}

/**
 * Team leads manager engine: the team_leader_assignments rows + add-flow
 * picker derivations. Extracted verbatim from Settings.tsx (v2.858) as
 * useSettingsTeamLeaderAssignments, renamed/rehomed when the manager moved off
 * Settings → Dashboard & alerts, then slimmed when both People surfaces
 * (Users → Team leads modal and the Teams tab) converged on the shared
 * TeamLeadsManager — grouping/sort/search now live in the pure kernel
 * `src/lib/people/teamLeadsGrouping.ts`. Loads on mount when `enabled`
 * (dev|master|assistant-like|controller). Row insert/update/delete writes stay
 * in the caller (TeamLeadsManager) via the returned setter. `setError` is the
 * caller's shared error state.
 */
export function useTeamLeaderAssignments({
  enabled,
  goalPickerUsers,
  setError,
}: {
  enabled: boolean
  /** Non-archived roster — what the leader/member pickers offer. */
  goalPickerUsers: GoalPickerUser[]
  setError: (message: string | null) => void
}) {
  const [teamLeaderAssignments, setTeamLeaderAssignments] = useState<TeamLeaderAssignmentRow[]>([])
  const [teamLeaderVisibilitySavingId, setTeamLeaderVisibilitySavingId] = useState<string | null>(null)
  const [teamAssignLeaderId, setTeamAssignLeaderId] = useState('')
  const [teamAssignMemberId, setTeamAssignMemberId] = useState('')
  const [teamAssignSaving, setTeamAssignSaving] = useState(false)

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
    teamHoursMemberPickerUsers,
    teamHoursNoMembersAvailable,
    teamHoursMemberPickerDisabled,
    teamHoursMemberPlaceholder,
  }
}
