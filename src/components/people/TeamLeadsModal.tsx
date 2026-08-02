import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTeamLeaderAssignments } from '../../hooks/useTeamLeaderAssignments'
import { supabase } from '../../lib/supabase'
import { displayLabelForGoalPickerUser } from '../../lib/goalPickerUserLabel'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

const MODAL_Z = 1030
const TITLE_ID = 'team-leads-modal-title'

/**
 * Team leads manager (People → Users → Team leads): the team_leader_assignments
 * manager that used to live on Settings → Dashboard & alerts ("Team Hours
 * Sharing"). Leader/member pickers + add, search, sortable table, per-row
 * dashboard-visibility select (dev-only editable), remove. Assignments drive
 * the Dashboard "My Team" section, team-lead clock notifications, and lead
 * read-scope RLS. Backed by useTeamLeaderAssignments (renamed from
 * useSettingsTeamLeaderAssignments); the write paths here are moved verbatim
 * from SettingsDashboardTab.
 */
export default function TeamLeadsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user: authUser, role: myRole } = useAuth()
  const canManage = myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)
  const [error, setError] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string | null; email: string | null; archived_at: string | null }>>([])

  // One unfiltered fetch: pickers use the non-archived subset (same roster Settings
  // loaded), but display labels use everyone — existing links to archived accounts
  // must render their name, not a raw UUID.
  useEffect(() => {
    if (!open || !canManage) return
    void (async () => {
      const { data: userRows, error: usersErr } = await supabase
        .from('users')
        .select('id, name, email, archived_at')
        .order('name')
      if (usersErr) setError(usersErr.message)
      else setAllUsers((userRows ?? []) as Array<{ id: string; name: string | null; email: string | null; archived_at: string | null }>)
    })()
  }, [open, canManage])

  const goalPickerUsers = useMemo(() => allUsers.filter((u) => u.archived_at == null), [allUsers])
  const archivedIds = useMemo(() => new Set(allUsers.filter((u) => u.archived_at != null).map((u) => u.id)), [allUsers])
  const labelForUser = (userId: string): string =>
    displayLabelForGoalPickerUser(userId, allUsers) + (archivedIds.has(userId) ? ' (archived)' : '')

  const {
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
    filteredTeamLeaderAssignments,
    teamHoursMemberPickerUsers,
    teamHoursMemberPickerDisabled,
    teamHoursMemberPlaceholder,
  } = useTeamLeaderAssignments({
    enabled: open && canManage,
    goalPickerUsers,
    labelUsers: allUsers,
    setError,
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !canManage) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={() => (teamAssignSaving ? null : onClose())}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MODAL_Z,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1rem 1.25rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h2 id={TITLE_ID} style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
            Team leads
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '1.1rem', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
          >
            ✕
          </button>
        </div>
        {error && (
          <p role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
            {error}
          </p>
        )}
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>
          Link a leader to a member for team hours sharing—the leader can approve that member&apos;s hours from Dashboard → My Team. Any account role can be leader or member. A member can have more than one leader (with a different leader each time). The member list skips people already linked to the leader you pick.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>Leader</label>
            <select
              value={teamAssignLeaderId}
              onChange={(e) => {
                setTeamAssignLeaderId(e.target.value)
                setTeamAssignMemberId('')
              }}
              style={{ padding: '0.35rem 0.5rem', maxWidth: 320, width: '100%', minWidth: 200, border: '1px solid var(--border-strong)' }}
            >
              <option value="">Select user…</option>
              {goalPickerUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.name?.trim() || u.email || u.id).slice(0, 80)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>Member</label>
            <select
              value={teamAssignMemberId}
              disabled={teamHoursMemberPickerDisabled}
              onChange={(e) => setTeamAssignMemberId(e.target.value)}
              style={{
                padding: '0.35rem 0.5rem',
                maxWidth: 320,
                width: '100%',
                minWidth: 200,
                ...(teamHoursMemberPickerDisabled
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
              <option value="">{teamHoursMemberPlaceholder}</option>
              {teamHoursMemberPickerUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.name?.trim() || u.email || u.id).slice(0, 80)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={teamAssignSaving || !teamAssignLeaderId || !teamAssignMemberId || teamAssignLeaderId === teamAssignMemberId}
            onClick={async () => {
              if (!authUser?.id || !teamAssignLeaderId || !teamAssignMemberId) return
              if (teamAssignLeaderId === teamAssignMemberId) {
                setError('Leader and member must be different users.')
                return
              }
              setTeamAssignSaving(true)
              try {
                const inserted = await withSupabaseRetry(
                  async () =>
                    supabase
                      .from('team_leader_assignments')
                      .insert({
                        leader_user_id: teamAssignLeaderId,
                        member_user_id: teamAssignMemberId,
                        created_by_user_id: authUser.id,
                      })
                      .select('id, leader_user_id, member_user_id, dashboard_hours_visibility')
                      .single(),
                  'add team lead assignment',
                )
                if (!inserted) {
                  setError('Could not add assignment.')
                  return
                }
                const row = inserted as {
                  id: string
                  leader_user_id: string
                  member_user_id: string
                  dashboard_hours_visibility: string | null
                }
                setTeamLeaderAssignments((prev) => [
                  {
                    id: row.id,
                    leader_user_id: row.leader_user_id,
                    member_user_id: row.member_user_id,
                    dashboard_hours_visibility:
                      row.dashboard_hours_visibility === 'strip_only' ? 'strip_only' : 'full',
                  },
                  ...prev,
                ])
                setTeamAssignLeaderId('')
                setTeamAssignMemberId('')
              } catch (e) {
                setError(formatErrorMessage(e))
              } finally {
                setTeamAssignSaving(false)
              }
            }}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.875rem',
              borderRadius: 4,
              border: '1px solid #2563eb',
              background: '#2563eb',
              color: 'white',
              cursor: teamAssignSaving ? 'wait' : 'pointer',
              opacity: teamAssignSaving ? 0.7 : 1,
            }}
          >
            Add
          </button>
        </div>
        {teamLeaderAssignments.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>No assignments yet.</p>
        ) : (
          <React.Fragment>
            <div style={{ marginBottom: '0.75rem' }}>
              <input
                type="search"
                value={teamLeaderAssignmentsSearchQuery}
                onChange={(e) => setTeamLeaderAssignmentsSearchQuery(e.target.value)}
                placeholder="Search by leader or member…"
                aria-label="Search team lead assignments by leader or member"
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
            {filteredTeamLeaderAssignments.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>No assignments match your search.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-muted)', textAlign: 'left' }}>
                      <th
                        scope="col"
                        aria-sort={
                          teamLeaderSortColumn === 'leader'
                            ? teamLeaderSortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (teamLeaderSortColumn === 'leader') {
                              setTeamLeaderSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                            } else {
                              setTeamLeaderSortColumn('leader')
                              setTeamLeaderSortDir('asc')
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            width: '100%',
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: 'inherit',
                            fontStyle: 'inherit',
                            lineHeight: 'inherit',
                            fontWeight: 600,
                            textAlign: 'left',
                          }}
                        >
                          Leader
                          {teamLeaderSortColumn === 'leader' && (
                            <span aria-hidden style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {teamLeaderSortDir === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th
                        scope="col"
                        aria-sort={
                          teamLeaderSortColumn === 'member'
                            ? teamLeaderSortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (teamLeaderSortColumn === 'member') {
                              setTeamLeaderSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                            } else {
                              setTeamLeaderSortColumn('member')
                              setTeamLeaderSortDir('asc')
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            width: '100%',
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: 'inherit',
                            fontStyle: 'inherit',
                            lineHeight: 'inherit',
                            fontWeight: 600,
                            textAlign: 'left',
                          }}
                        >
                          Member
                          {teamLeaderSortColumn === 'member' && (
                            <span aria-hidden style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {teamLeaderSortDir === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th scope="col" style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                        Leader dashboard
                      </th>
                      <th scope="col" style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', width: 100 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeamLeaderAssignments.map((row) => {
                      const leaderLabel = labelForUser(row.leader_user_id)
                      const memberLabel = labelForUser(row.member_user_id)
                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{leaderLabel}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{memberLabel}</td>
                          <td style={{ padding: '0.5rem 0.75rem', maxWidth: 220 }}>
                            <select
                              value={row.dashboard_hours_visibility}
                              disabled={myRole !== 'dev' || teamLeaderVisibilitySavingId === row.id}
                              title={
                                myRole !== 'dev'
                                  ? 'Only a developer can change this setting.'
                                  : 'What this leader sees on their Dashboard for this member'
                              }
                              onChange={(e) => {
                                const next = e.target.value === 'strip_only' ? 'strip_only' : 'full'
                                if (next === row.dashboard_hours_visibility) return
                                setTeamLeaderVisibilitySavingId(row.id)
                                void (async () => {
                                  try {
                                    await withSupabaseRetry(
                                      async () =>
                                        supabase
                                          .from('team_leader_assignments')
                                          .update({ dashboard_hours_visibility: next })
                                          .eq('id', row.id),
                                      'update team leader dashboard visibility',
                                    )
                                    setTeamLeaderAssignments((prev) =>
                                      prev.map((r) => (r.id === row.id ? { ...r, dashboard_hours_visibility: next } : r)),
                                    )
                                  } catch (err) {
                                    setError(formatErrorMessage(err))
                                  } finally {
                                    setTeamLeaderVisibilitySavingId(null)
                                  }
                                })()
                              }}
                              style={{
                                width: '100%',
                                maxWidth: 200,
                                padding: '0.35rem 0.5rem',
                                fontSize: '0.8125rem',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 4,
                                background: myRole !== 'dev' ? 'var(--bg-muted)' : 'var(--surface)',
                                cursor: myRole !== 'dev' ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <option value="full">Full My Team</option>
                              <option value="strip_only">Clock strip only</option>
                            </select>
                            {myRole !== 'dev' ? (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 4 }}>Dev only</div>
                            ) : null}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <button
                              type="button"
                              disabled={teamAssignSaving}
                              onClick={async () => {
                                if (!confirm('Remove this team lead assignment?')) return
                                setTeamAssignSaving(true)
                                try {
                                  await withSupabaseRetry(
                                    async () => supabase.from('team_leader_assignments').delete().eq('id', row.id),
                                    'remove team lead assignment',
                                  )
                                  setTeamLeaderAssignments((prev) => prev.filter((r) => r.id !== row.id))
                                } catch (e) {
                                  setError(formatErrorMessage(e))
                                } finally {
                                  setTeamAssignSaving(false)
                                }
                              }}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.8125rem',
                                color: 'var(--text-red-700)',
                                border: '1px solid #fecaca',
                                borderRadius: 4,
                                background: 'var(--bg-red-tint)',
                                cursor: teamAssignSaving ? 'wait' : 'pointer',
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
  )
}
