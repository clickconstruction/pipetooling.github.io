import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

type GoalPickerUserRow = { id: string; name: string | null; email: string | null }

type TeamAssignmentRow = {
  id: string
  leader_user_id: string
  member_user_id: string
  dashboard_hours_visibility: 'full' | 'strip_only'
}

type TeamLeaderAssignmentRowRaw = {
  id: string
  leader_user_id: string
  member_user_id: string
  dashboard_hours_visibility: string | null
}

function displayLabelForUser(userId: string, users: GoalPickerUserRow[]): string {
  const u = users.find((x) => x.id === userId)
  return u?.name?.trim() || u?.email || userId
}

function normalizeAssignmentRow(r: TeamLeaderAssignmentRowRaw): TeamAssignmentRow {
  return {
    id: r.id,
    leader_user_id: r.leader_user_id,
    member_user_id: r.member_user_id,
    dashboard_hours_visibility: r.dashboard_hours_visibility === 'strip_only' ? 'strip_only' : 'full',
  }
}

export type PeopleTeamsTabProps = {
  authUserId: string
  authUserRole: string | null
}

export default function PeopleTeamsTab({ authUserId, authUserRole }: PeopleTeamsTabProps) {
  const { showToast } = useToastContext()
  const isDev = authUserRole === 'dev'

  const [pickerUsers, setPickerUsers] = useState<GoalPickerUserRow[]>([])
  const [assignments, setAssignments] = useState<TeamAssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const [globalLeaderId, setGlobalLeaderId] = useState('')
  const [globalMemberId, setGlobalMemberId] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)
  const [visibilitySavingId, setVisibilitySavingId] = useState<string | null>(null)
  const [perLeaderMemberId, setPerLeaderMemberId] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [goalUsers, tlaRows] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase.from('users').select('id, name, email').is('archived_at', null).order('name'),
          'people teams load users',
        ),
        withSupabaseRetry(
          async () =>
            supabase
              .from('team_leader_assignments')
              .select('id, leader_user_id, member_user_id, dashboard_hours_visibility')
              .order('created_at', { ascending: false }),
          'people teams load assignments',
        ),
      ])
      setPickerUsers((goalUsers ?? []) as GoalPickerUserRow[])
      setAssignments(((tlaRows ?? []) as TeamLeaderAssignmentRowRaw[]).map(normalizeAssignmentRow))
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  const globalMemberOptions = useMemo(() => {
    if (!globalLeaderId) return []
    const assigned = new Set(assignments.filter((r) => r.leader_user_id === globalLeaderId).map((r) => r.member_user_id))
    return pickerUsers.filter((u) => u.id !== globalLeaderId && !assigned.has(u.id))
  }, [globalLeaderId, assignments, pickerUsers])

  const globalMemberPickerDisabled = !globalLeaderId || assignSaving || globalMemberOptions.length === 0
  const globalMemberPlaceholder = !globalLeaderId
    ? 'Choose a leader first…'
    : globalMemberOptions.length === 0
      ? 'All users are already on this leader’s team'
      : 'Select member…'

  useEffect(() => {
    if (!globalMemberId || !globalLeaderId) return
    if (!globalMemberOptions.some((u) => u.id === globalMemberId)) setGlobalMemberId('')
  }, [globalLeaderId, globalMemberId, globalMemberOptions])

  const leadersGrouped = useMemo(() => {
    const byLeader = new Map<string, TeamAssignmentRow[]>()
    for (const row of assignments) {
      const list = byLeader.get(row.leader_user_id) ?? []
      list.push(row)
      byLeader.set(row.leader_user_id, list)
    }
    for (const [, list] of byLeader) {
      list.sort((a, b) =>
        displayLabelForUser(a.member_user_id, pickerUsers).localeCompare(
          displayLabelForUser(b.member_user_id, pickerUsers),
          undefined,
          { sensitivity: 'base' },
        ),
      )
    }
    return byLeader
  }, [assignments, pickerUsers])

  const sortedLeaderIds = useMemo(() => {
    const ids = [...leadersGrouped.keys()]
    ids.sort((a, b) =>
      displayLabelForUser(a, pickerUsers).localeCompare(displayLabelForUser(b, pickerUsers), undefined, {
        sensitivity: 'base',
      }),
    )
    return ids
  }, [leadersGrouped, pickerUsers])

  const filteredLeaderIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sortedLeaderIds
    return sortedLeaderIds.filter((leaderId) => {
      const leaderLabel = displayLabelForUser(leaderId, pickerUsers).toLowerCase()
      if (leaderLabel.includes(q)) return true
      const rows = leadersGrouped.get(leaderId) ?? []
      return rows.some((r) =>
        displayLabelForUser(r.member_user_id, pickerUsers).toLowerCase().includes(q),
      )
    })
  }, [sortedLeaderIds, searchQuery, pickerUsers, leadersGrouped])

  const memberOptionsForLeader = useCallback(
    (leaderId: string) => {
      const assigned = new Set(
        assignments.filter((r) => r.leader_user_id === leaderId).map((r) => r.member_user_id),
      )
      return pickerUsers.filter((u) => u.id !== leaderId && !assigned.has(u.id))
    },
    [assignments, pickerUsers],
  )

  const addPair = async (leaderId: string, memberId: string) => {
    if (!leaderId || !memberId || leaderId === memberId) {
      showToast('Leader and member must be different users.', 'error')
      return
    }
    setAssignSaving(true)
    try {
      const raw = await withSupabaseRetry(
        async () =>
          supabase
            .from('team_leader_assignments')
            .insert({
              leader_user_id: leaderId,
              member_user_id: memberId,
              created_by_user_id: authUserId,
            })
            .select('id, leader_user_id, member_user_id, dashboard_hours_visibility')
            .single(),
        'people teams add assignment',
      )
      if (!raw || typeof raw !== 'object' || !('id' in raw)) {
        showToast('Could not add assignment.', 'error')
        return
      }
      const row = normalizeAssignmentRow(raw as TeamLeaderAssignmentRowRaw)
      setAssignments((prev) => [row, ...prev])
      setGlobalLeaderId('')
      setGlobalMemberId('')
      setPerLeaderMemberId((prev) => {
        const next = { ...prev }
        delete next[leaderId]
        return next
      })
      showToast('Team assignment added.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setAssignSaving(false)
    }
  }

  const removeRow = async (id: string) => {
    if (!confirm('Remove this team lead assignment?')) return
    setAssignSaving(true)
    try {
      await withSupabaseRetry(
        async () => supabase.from('team_leader_assignments').delete().eq('id', id),
        'people teams remove assignment',
      )
      setAssignments((prev) => prev.filter((r) => r.id !== id))
      showToast('Assignment removed.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setAssignSaving(false)
    }
  }

  const updateVisibility = async (rowId: string, next: 'full' | 'strip_only') => {
    setVisibilitySavingId(rowId)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('team_leader_assignments').update({ dashboard_hours_visibility: next }).eq('id', rowId),
        'people teams update visibility',
      )
      setAssignments((prev) => prev.map((r) => (r.id === rowId ? { ...r, dashboard_hours_visibility: next } : r)))
    } catch (e) {
      showToast(formatErrorMessage(e), 'error')
    } finally {
      setVisibilitySavingId(null)
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
  }

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>
        Link a leader to a member for team hours sharing—the leader can approve that member&apos;s hours from Dashboard →
        My Team. Any account role can be leader or member. A member can have more than one leader. The member list skips
        people already linked to the leader you pick.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>Leader</label>
          <select
            value={globalLeaderId}
            onChange={(e) => {
              setGlobalLeaderId(e.target.value)
              setGlobalMemberId('')
            }}
            style={{ padding: '0.35rem 0.5rem', maxWidth: 320, width: '100%', minWidth: 200, border: '1px solid var(--border-strong)' }}
          >
            <option value="">Select user…</option>
            {pickerUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name?.trim() || u.email || u.id).slice(0, 80)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>Member</label>
          <select
            value={globalMemberId}
            disabled={globalMemberPickerDisabled}
            onChange={(e) => setGlobalMemberId(e.target.value)}
            style={{
              padding: '0.35rem 0.5rem',
              maxWidth: 320,
              width: '100%',
              minWidth: 200,
              ...(globalMemberPickerDisabled
                ? {
                    background: 'var(--bg-muted)',
                    color: 'var(--text-faint)',
                    cursor: 'not-allowed',
                    border: '1px solid var(--border)',
                  }
                : {
                    background: 'var(--surface)',
                    color: 'inherit',
                    cursor: 'pointer',
                    border: '1px solid var(--border-strong)',
                  }),
            }}
          >
            <option value="">{globalMemberPlaceholder}</option>
            {globalMemberOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name?.trim() || u.email || u.id).slice(0, 80)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={assignSaving || !globalLeaderId || !globalMemberId || globalLeaderId === globalMemberId}
          onClick={() => void addPair(globalLeaderId, globalMemberId)}
          style={{
            padding: '0.4rem 0.85rem',
            fontSize: '0.875rem',
            borderRadius: 4,
            border: '1px solid #2563eb',
            background: '#2563eb',
            color: 'white',
            cursor: assignSaving ? 'wait' : 'pointer',
            opacity: assignSaving ? 0.7 : 1,
          }}
        >
          Add
        </button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by leader or member…"
          aria-label="Search team assignments by leader or member"
          style={{
            width: '100%',
            maxWidth: 420,
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {assignments.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>No assignments yet.</p>
      ) : filteredLeaderIds.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>No assignments match your search.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredLeaderIds.map((leaderId) => {
            const leaderLabel = displayLabelForUser(leaderId, pickerUsers)
            const rows = leadersGrouped.get(leaderId) ?? []
            const perOpts = memberOptionsForLeader(leaderId)
            const perPick = perLeaderMemberId[leaderId] ?? ''
            const perDisabled = assignSaving || perOpts.length === 0
            return (
              <div
                key={leaderId}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg-page)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '0.65rem 1rem',
                    background: 'var(--bg-muted)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem 0.75rem',
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: '0.9375rem',
                      color: 'var(--text-strong)',
                      flex: '1 1 auto',
                      minWidth: 0,
                    }}
                  >
                    {leaderLabel}
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.4rem',
                      flex: '0 1 auto',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-700)' }}>Add member</span>
                    <select
                      value={perPick}
                      disabled={perDisabled}
                      aria-label={`Add member to team led by ${leaderLabel}`}
                      onChange={(e) =>
                        setPerLeaderMemberId((prev) => ({ ...prev, [leaderId]: e.target.value }))
                      }
                      style={{
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.8125rem',
                        maxWidth: 220,
                        minWidth: 140,
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background: perDisabled ? 'var(--bg-muted)' : 'var(--surface)',
                      }}
                    >
                      <option value="">
                        {!perOpts.length ? 'No more users to add' : 'Select member…'}
                      </option>
                      {perOpts.map((u) => (
                        <option key={u.id} value={u.id}>
                          {(u.name?.trim() || u.email || u.id).slice(0, 80)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={assignSaving || !perPick || perPick === leaderId}
                      onClick={() => void addPair(leaderId, perPick)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8125rem',
                        borderRadius: 4,
                        border: '1px solid #2563eb',
                        background: '#2563eb',
                        color: 'white',
                        cursor: assignSaving ? 'wait' : 'pointer',
                        opacity: assignSaving ? 0.7 : 1,
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ textAlign: 'left' }}>
                          <th style={{ padding: '0.35rem 0.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                            Member
                          </th>
                          <th style={{ padding: '0.35rem 0.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                            Leader dashboard
                          </th>
                          <th
                            style={{
                              padding: '0.35rem 0.5rem',
                              fontWeight: 600,
                              borderBottom: '1px solid var(--border)',
                              width: 88,
                            }}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.5rem 0.5rem', paddingLeft: '1.25rem' }}>
                              {displayLabelForUser(row.member_user_id, pickerUsers)}
                            </td>
                            <td style={{ padding: '0.5rem 0.5rem', maxWidth: 220 }}>
                              <select
                                value={row.dashboard_hours_visibility}
                                disabled={!isDev || visibilitySavingId === row.id}
                                title={
                                  !isDev
                                    ? 'Only a developer can change this setting.'
                                    : 'What this leader sees on their Dashboard for this member'
                                }
                                onChange={(e) => {
                                  const next = e.target.value === 'strip_only' ? 'strip_only' : 'full'
                                  if (next === row.dashboard_hours_visibility) return
                                  void updateVisibility(row.id, next)
                                }}
                                style={{
                                  width: '100%',
                                  maxWidth: 200,
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '0.8125rem',
                                  border: '1px solid var(--border-strong)',
                                  borderRadius: 4,
                                  background: !isDev ? 'var(--bg-muted)' : 'var(--surface)',
                                  cursor: !isDev ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <option value="full">Full My Team</option>
                                <option value="strip_only">Clock strip only</option>
                              </select>
                              {!isDev ? (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 4 }}>Dev only</div>
                              ) : null}
                            </td>
                            <td style={{ padding: '0.5rem 0.5rem' }}>
                              <button
                                type="button"
                                disabled={assignSaving}
                                onClick={() => void removeRow(row.id)}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-red-700)',
                                  background: 'none',
                                  border: '1px solid #fecaca',
                                  borderRadius: 4,
                                  cursor: assignSaving ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
