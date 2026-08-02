import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useTeamLeaderAssignments } from '../../hooks/useTeamLeaderAssignments'
import { supabase } from '../../lib/supabase'
import {
  groupTeamLeaderAssignments,
  teamLeaderGroupMatchesQuery,
  type TeamLeadMemberRow,
  type TeamLeaderGroup,
} from '../../lib/people/teamLeadsGrouping'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

type RosterUser = { id: string; name: string | null; email: string | null; archived_at: string | null }

const REMOVE_CONFIRM = 'Remove this team lead assignment?'

/**
 * Shared leader-centric team_leader_assignments manager, rendered by BOTH the
 * People → Users "Team leads" modal (TeamLeadsModal, which is now just modal
 * chrome around this) and the People → Teams tab (PeopleTeamsTab). One
 * collapsible card per leader (grouping/search via the pure kernel
 * src/lib/people/teamLeadsGrouping.ts), per-member Full/Strip segmented
 * toggle for dashboard_hours_visibility (dev-only editable, unchanged
 * permission), remove with confirm ("Remove stale link" for archived
 * members), per-card "+ Add member" picker, and a "+ New leader" flow.
 * Self-contained: gets user/role from useAuth (gate: dev / master_technician /
 * assistant-like / controller — same as canAccessTeamsTab), loads its own
 * roster, drives rows through useTeamLeaderAssignments. Assignments drive the
 * Dashboard "My Team" section, team-lead clock notifications, and lead
 * read-scope RLS.
 */
export default function TeamLeadsManager() {
  const { user: authUser, role: myRole } = useAuth()
  const canManage = myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)
  const isDev = myRole === 'dev'
  const [error, setError] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<RosterUser[]>([])

  // One unfiltered fetch: pickers use the non-archived subset, but display
  // labels use everyone — existing links to archived accounts must render
  // their name, not a raw UUID (v2.1289 labeling).
  useEffect(() => {
    if (!canManage) return
    void (async () => {
      const { data: userRows, error: usersErr } = await supabase
        .from('users')
        .select('id, name, email, archived_at')
        .order('name')
      if (usersErr) setError(usersErr.message)
      else setAllUsers((userRows ?? []) as RosterUser[])
    })()
  }, [canManage])

  const goalPickerUsers = useMemo(() => allUsers.filter((u) => u.archived_at == null), [allUsers])

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
    teamHoursMemberPickerUsers,
    teamHoursMemberPickerDisabled,
    teamHoursMemberPlaceholder,
  } = useTeamLeaderAssignments({ enabled: canManage, goalPickerUsers, setError })

  const groups = useMemo(
    () => groupTeamLeaderAssignments(teamLeaderAssignments, allUsers),
    [teamLeaderAssignments, allUsers],
  )
  const [searchQuery, setSearchQuery] = useState('')
  const searching = searchQuery.trim() !== ''
  const visibleGroups = useMemo(
    () => groups.filter((g) => teamLeaderGroupMatchesQuery(g, searchQuery)),
    [groups, searchQuery],
  )

  // Collapse state is per-session in-memory: default expanded when few
  // leaders, collapsed when many; a live search expands the matching cards.
  const [expandOverrides, setExpandOverrides] = useState<Record<string, boolean>>({})
  const defaultExpanded = groups.length <= 3
  const isExpanded = (leaderId: string): boolean =>
    searching ? true : (expandOverrides[leaderId] ?? defaultExpanded)

  // "+ New leader" inline flow (leader picker limited to not-yet-leaders; the
  // member picker derivations come from the hook, keyed on teamAssignLeaderId).
  const [newLeaderOpen, setNewLeaderOpen] = useState(false)
  const leaderIds = useMemo(() => new Set(groups.map((g) => g.leaderId)), [groups])
  const newLeaderOptions = useMemo(
    () => goalPickerUsers.filter((u) => !leaderIds.has(u.id)),
    [goalPickerUsers, leaderIds],
  )

  // Per-card "+ Add member" inline picker (one open at a time).
  const [addMemberLeaderId, setAddMemberLeaderId] = useState<string | null>(null)
  const [addMemberPickId, setAddMemberPickId] = useState('')

  const memberOptionsForLeader = (group: TeamLeaderGroup) => {
    const memberIds = new Set(group.members.map((m) => m.memberId))
    return goalPickerUsers.filter((u) => u.id !== group.leaderId && !memberIds.has(u.id))
  }

  /** Insert one leader→member link (the modal's original add logic, verbatim semantics). */
  const addAssignment = async (leaderId: string, memberId: string): Promise<boolean> => {
    if (!authUser?.id || !leaderId || !memberId) return false
    if (leaderId === memberId) {
      setError('Leader and member must be different users.')
      return false
    }
    setTeamAssignSaving(true)
    try {
      const inserted = await withSupabaseRetry(
        async () =>
          supabase
            .from('team_leader_assignments')
            .insert({
              leader_user_id: leaderId,
              member_user_id: memberId,
              created_by_user_id: authUser.id,
            })
            .select('id, leader_user_id, member_user_id, dashboard_hours_visibility')
            .single(),
        'add team lead assignment',
      )
      if (!inserted) {
        setError('Could not add assignment.')
        return false
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
          dashboard_hours_visibility: row.dashboard_hours_visibility === 'strip_only' ? 'strip_only' : 'full',
        },
        ...prev,
      ])
      return true
    } catch (e) {
      setError(formatErrorMessage(e))
      return false
    } finally {
      setTeamAssignSaving(false)
    }
  }

  const removeAssignment = async (assignmentId: string) => {
    if (!confirm(REMOVE_CONFIRM)) return
    setTeamAssignSaving(true)
    try {
      await withSupabaseRetry(
        async () => supabase.from('team_leader_assignments').delete().eq('id', assignmentId),
        'remove team lead assignment',
      )
      setTeamLeaderAssignments((prev) => prev.filter((r) => r.id !== assignmentId))
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setTeamAssignSaving(false)
    }
  }

  /** Persist dashboard_hours_visibility — same update call + saving-spinner semantics as before. */
  const saveVisibility = (assignmentId: string, next: 'full' | 'strip_only') => {
    setTeamLeaderVisibilitySavingId(assignmentId)
    void (async () => {
      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('team_leader_assignments')
              .update({ dashboard_hours_visibility: next })
              .eq('id', assignmentId),
          'update team leader dashboard visibility',
        )
        setTeamLeaderAssignments((prev) =>
          prev.map((r) => (r.id === assignmentId ? { ...r, dashboard_hours_visibility: next } : r)),
        )
      } catch (err) {
        setError(formatErrorMessage(err))
      } finally {
        setTeamLeaderVisibilitySavingId(null)
      }
    })()
  }

  if (!canManage) return null

  const renderVisibilityToggle = (member: TeamLeadMemberRow) => {
    const saving = teamLeaderVisibilitySavingId === member.assignmentId
    const disabled = !isDev || saving
    const title = !isDev
      ? 'Only a developer can change this setting.'
      : 'What this leader sees on their Dashboard for this member: full My Team vs clock strip only'
    const segStyle = (active: boolean): CSSProperties => ({
      padding: '0.25rem 0.6rem',
      fontSize: '0.75rem',
      fontWeight: active ? 600 : 400,
      border: 'none',
      background: active ? '#2563eb' : 'var(--surface)',
      color: active ? 'white' : 'var(--text-muted)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: saving ? 0.6 : 1,
    })
    return (
      <span
        role="group"
        aria-label={`Leader dashboard visibility for ${member.label}`}
        title={title}
        style={{
          display: 'inline-flex',
          border: '1px solid var(--border-strong)',
          borderRadius: 999,
          overflow: 'hidden',
          flex: 'none',
        }}
      >
        <button
          type="button"
          aria-pressed={member.visibility === 'full'}
          disabled={disabled}
          title={title}
          onClick={() => {
            if (member.visibility !== 'full') saveVisibility(member.assignmentId, 'full')
          }}
          style={segStyle(member.visibility === 'full')}
        >
          Full
        </button>
        <button
          type="button"
          aria-pressed={member.visibility === 'strip_only'}
          disabled={disabled}
          title={title}
          onClick={() => {
            if (member.visibility !== 'strip_only') saveVisibility(member.assignmentId, 'strip_only')
          }}
          style={{ ...segStyle(member.visibility === 'strip_only'), borderLeft: '1px solid var(--border-strong)' }}
        >
          Strip
        </button>
      </span>
    )
  }

  const renderLeaderCard = (group: TeamLeaderGroup) => {
    const expanded = isExpanded(group.leaderId)
    const addOpen = addMemberLeaderId === group.leaderId
    const addOptions = addOpen ? memberOptionsForLeader(group) : []
    return (
      <div
        key={group.leaderId}
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg-page)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() =>
            setExpandOverrides((prev) => ({ ...prev, [group.leaderId]: !expanded }))
          }
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.45rem',
            width: '100%',
            padding: '0.65rem 1rem',
            background: 'var(--bg-muted)',
            border: 'none',
            borderBottom: expanded ? '1px solid var(--border)' : 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
            fontSize: '0.9375rem',
          }}
        >
          <span aria-hidden style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 'none' }}>
            {expanded ? '▾' : '▸'}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--text-strong)', minWidth: 0 }}>
            {group.leaderLabel}
            {group.isArchivedLeader ? (
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> (archived)</span>
            ) : null}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', flex: 'none' }}>
            · {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
            {group.archivedCount > 0 ? ` · ${group.archivedCount} archived` : ''}
          </span>
        </button>
        {expanded ? (
          <div style={{ padding: '0.5rem 1rem 0.75rem' }}>
            {group.members.map((member) => (
              <div
                key={member.assignmentId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.45rem 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.875rem',
                }}
              >
                <span
                  style={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    ...(member.isArchived ? { color: 'var(--text-muted)' } : {}),
                  }}
                >
                  {member.label}
                  {member.isArchived ? ' (archived)' : ''}
                </span>
                {renderVisibilityToggle(member)}
                {member.isArchived ? (
                  <button
                    type="button"
                    disabled={teamAssignSaving}
                    onClick={() => void removeAssignment(member.assignmentId)}
                    style={{
                      flex: 'none',
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-red-700)',
                      background: 'none',
                      border: 'none',
                      textDecoration: 'underline',
                      cursor: teamAssignSaving ? 'wait' : 'pointer',
                    }}
                  >
                    Remove stale link
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={teamAssignSaving}
                    aria-label={`Remove ${member.label} from ${group.leaderLabel}'s team`}
                    title="Remove this member"
                    onClick={() => void removeAssignment(member.assignmentId)}
                    style={{
                      flex: 'none',
                      padding: '0.15rem 0.5rem',
                      fontSize: '0.8125rem',
                      lineHeight: 1.4,
                      color: 'var(--text-red-700)',
                      background: 'var(--bg-red-tint)',
                      border: '1px solid #fecaca',
                      borderRadius: 4,
                      cursor: teamAssignSaving ? 'wait' : 'pointer',
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {addOpen ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.65rem' }}>
                <select
                  value={addMemberPickId}
                  disabled={teamAssignSaving || addOptions.length === 0}
                  aria-label={`Add member to team led by ${group.leaderLabel}`}
                  onChange={(e) => setAddMemberPickId(e.target.value)}
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.8125rem',
                    maxWidth: 240,
                    minWidth: 160,
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    background: addOptions.length === 0 ? 'var(--bg-muted)' : 'var(--surface)',
                  }}
                >
                  <option value="">{addOptions.length === 0 ? 'No users left to assign' : 'Select member…'}</option>
                  {addOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.name?.trim() || u.email || u.id).slice(0, 80)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={teamAssignSaving || !addMemberPickId}
                  onClick={() =>
                    void addAssignment(group.leaderId, addMemberPickId).then((ok) => {
                      if (ok) {
                        setAddMemberPickId('')
                        setAddMemberLeaderId(null)
                      }
                    })
                  }
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8125rem',
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
                <button
                  type="button"
                  onClick={() => {
                    setAddMemberLeaderId(null)
                    setAddMemberPickId('')
                  }}
                  style={{
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.8125rem',
                    borderRadius: 4,
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={teamAssignSaving}
                onClick={() => {
                  setAddMemberLeaderId(group.leaderId)
                  setAddMemberPickId('')
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '0.65rem',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: '1px dashed var(--border-strong)',
                  borderRadius: 6,
                  cursor: teamAssignSaving ? 'wait' : 'pointer',
                }}
              >
                + Add member
              </button>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      {error && (
        <p role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
          {error}
        </p>
      )}
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '0.85rem' }}>
        A leader sees and approves their members&apos; hours from Dashboard → My Team.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search leaders or members…"
          aria-label="Search team leads by leader or member"
          style={{
            flex: '1 1 240px',
            maxWidth: 420,
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          disabled={teamAssignSaving}
          onClick={() => {
            setNewLeaderOpen((v) => !v)
            setTeamAssignLeaderId('')
            setTeamAssignMemberId('')
          }}
          style={{
            flex: 'none',
            padding: '0.45rem 0.85rem',
            fontSize: '0.875rem',
            borderRadius: 4,
            border: '1px solid #2563eb',
            background: newLeaderOpen ? 'var(--surface)' : '#2563eb',
            color: newLeaderOpen ? 'var(--text-link)' : 'white',
            cursor: teamAssignSaving ? 'wait' : 'pointer',
          }}
        >
          + New leader
        </button>
      </div>
      {newLeaderOpen ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'flex-end',
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-muted)',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>
              New leader
            </label>
            <select
              value={teamAssignLeaderId}
              onChange={(e) => {
                setTeamAssignLeaderId(e.target.value)
                setTeamAssignMemberId('')
              }}
              style={{ padding: '0.35rem 0.5rem', maxWidth: 280, width: '100%', minWidth: 180, border: '1px solid var(--border-strong)' }}
            >
              <option value="">Select user…</option>
              {newLeaderOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.name?.trim() || u.email || u.id).slice(0, 80)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>
              First member
            </label>
            <select
              value={teamAssignMemberId}
              disabled={teamHoursMemberPickerDisabled}
              onChange={(e) => setTeamAssignMemberId(e.target.value)}
              style={{
                padding: '0.35rem 0.5rem',
                maxWidth: 280,
                width: '100%',
                minWidth: 180,
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
            onClick={() =>
              void addAssignment(teamAssignLeaderId, teamAssignMemberId).then((ok) => {
                if (ok) {
                  setTeamAssignLeaderId('')
                  setTeamAssignMemberId('')
                  setNewLeaderOpen(false)
                }
              })
            }
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
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setNewLeaderOpen(false)
              setTeamAssignLeaderId('')
              setTeamAssignMemberId('')
            }}
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.875rem',
              borderRadius: 4,
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}
      {groups.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          No team leads yet. Use + New leader to create the first one.
        </p>
      ) : visibleGroups.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          No leaders or members match your search.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {visibleGroups.map((group) => renderLeaderCard(group))}
        </div>
      )}
    </div>
  )
}
