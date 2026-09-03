import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { canEditGroups, canEditLeaderVisibility, canEditTeamLeads, type PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { BTN, BTN_QUIET, Chip, DeskEmpty, DeskRow, DeskSection, LockTag, deskBtn } from '../personDeskShared'

type Assignment = { id: string; leader_user_id: string; member_user_id: string; dashboard_hours_visibility: string | null }
type Named = { id: string; name: string | null; role: string | null }

const LEADER_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'estimator', 'helpers', 'subcontractor'])

export function PersonDeskTeamSection({
  userId,
  displayName,
  viewer,
  viewerUserId,
  changeKey,
  onChanged,
}: {
  userId: string | null
  displayName: string
  viewer: PersonDeskViewer
  viewerUserId: string | null
  changeKey: number
  onChanged: () => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [names, setNames] = useState<Map<string, Named>>(new Map())
  const [notify, setNotify] = useState<Record<string, boolean>>({})
  const [groups, setGroups] = useState<{ dispatch: boolean; estimator: boolean } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      try {
        const [{ data: rows, error: e1 }, { data: users, error: e2 }] = await Promise.all([
          supabase.from('team_leader_assignments').select('id, leader_user_id, member_user_id, dashboard_hours_visibility').eq('member_user_id', userId),
          supabase.from('users').select('id, name, role').is('archived_at', null),
        ])
        if (e1) throw e1
        if (e2) throw e2
        const list = (rows ?? []) as Assignment[]
        const map = new Map<string, Named>()
        for (const u of (users ?? []) as Named[]) map.set(u.id, u)
        let prefs: Record<string, boolean> = {}
        if (list.length > 0) {
          const { data: prefRows } = await supabase.from('team_leader_clock_notify_prefs').select('team_leader_assignment_id, notify_enabled').in('team_leader_assignment_id', list.map((a) => a.id))
          for (const p of (prefRows ?? []) as Array<{ team_leader_assignment_id: string; notify_enabled: boolean }>) prefs = { ...prefs, [p.team_leader_assignment_id]: p.notify_enabled }
        }
        let g: { dispatch: boolean; estimator: boolean } | null = null
        if (viewer.isDev) {
          const [{ data: d }, { data: es }] = await Promise.all([
            supabase.from('dispatch_group_members').select('user_id').eq('user_id', userId),
            supabase.from('estimator_group_members').select('user_id').eq('user_id', userId),
          ])
          g = { dispatch: (d ?? []).length > 0, estimator: (es ?? []).length > 0 }
        }
        if (cancelled) return
        setAssignments(list)
        setNames(map)
        setNotify(prefs)
        setGroups(g)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load team')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, changeKey, viewer.isDev])

  if (!userId) {
    return (
      <DeskSection title="Team & alerts">
        <DeskEmpty>Team leads and clock alerts need a login account.</DeskEmpty>
      </DeskSection>
    )
  }

  const canEdit = canEditTeamLeads(viewer)

  async function addLeader() {
    if (!pick || !userId) return
    setBusy('add')
    const { error: e } = await supabase.from('team_leader_assignments').insert({ leader_user_id: pick, member_user_id: userId, dashboard_hours_visibility: 'full' })
    setBusy(null)
    if (e) showToast(e.message, 'error')
    else {
      showToast(`${names.get(pick)?.name ?? 'Leader'} now approves ${displayName}'s hours`, 'success')
      setAddOpen(false)
      setPick('')
      onChanged()
    }
  }

  async function removeLeader(a: Assignment) {
    const leader = names.get(a.leader_user_id)?.name ?? 'this leader'
    const ok = await confirmDialog({ message: `Remove ${displayName} from ${leader}'s team? Their pending sessions stop showing on ${leader}'s Dashboard.`, confirmLabel: 'Remove' })
    if (!ok) return
    setBusy(a.id)
    const { error: e } = await supabase.from('team_leader_assignments').delete().eq('id', a.id)
    setBusy(null)
    if (e) showToast(e.message, 'error')
    else {
      showToast('Removed from team', 'success')
      onChanged()
    }
  }

  async function setVisibility(a: Assignment, v: string) {
    setBusy(a.id)
    const { error: e } = await supabase.from('team_leader_assignments').update({ dashboard_hours_visibility: v }).eq('id', a.id)
    setBusy(null)
    if (e) showToast(e.message, 'error')
    else onChanged()
  }

  async function setNotifyPref(a: Assignment, on: boolean) {
    setBusy(`n-${a.id}`)
    const { error: e } = await supabase
      .from('team_leader_clock_notify_prefs')
      .upsert({ team_leader_assignment_id: a.id, notify_enabled: on, updated_at: new Date().toISOString() }, { onConflict: 'team_leader_assignment_id' })
    setBusy(null)
    if (e) showToast(e.message, 'error')
    else setNotify((prev) => ({ ...prev, [a.id]: on }))
  }

  async function setGroup(kind: 'dispatch' | 'estimator', on: boolean) {
    if (!userId) return
    const table = kind === 'dispatch' ? 'dispatch_group_members' : 'estimator_group_members'
    setBusy(kind)
    const { error: e } = on ? await supabase.from(table).insert({ user_id: userId }) : await supabase.from(table).delete().eq('user_id', userId)
    setBusy(null)
    if (e) showToast(e.message, 'error')
    else {
      setGroups((g) => (g ? { ...g, [kind]: on } : g))
      showToast(on ? `Added to the ${kind === 'dispatch' ? 'Dispatch' : 'Estimator'} group` : `Removed from the ${kind === 'dispatch' ? 'Dispatch' : 'Estimator'} group`, 'success')
    }
  }

  const leaderOptions = Array.from(names.values())
    .filter((u) => u.id !== userId && u.role && LEADER_ROLES.has(u.role) && !assignments.some((a) => a.leader_user_id === u.id))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

  return (
    <DeskSection title="Team & alerts">
      {error ? <DeskEmpty>{error}</DeskEmpty> : null}
      {assignments.length === 0 ? (
        <DeskRow
          label="Team lead"
          actions={
            canEdit ? (
              <button type="button" style={BTN} onClick={() => setAddOpen((v) => !v)}>
                Assign a leader
              </button>
            ) : null
          }
        >
          <span style={{ color: 'var(--text-muted)' }}>None — nobody's Dashboard shows their sessions to approve</span>
        </DeskRow>
      ) : (
        assignments.map((a) => {
          const leader = names.get(a.leader_user_id)
          const mine = a.leader_user_id === viewerUserId
          return (
            <DeskRow
              key={a.id}
              label={assignments.length > 1 ? 'Team lead' : 'Team lead'}
              actions={
                canEdit ? (
                  <button type="button" style={deskBtn(BTN_QUIET, busy === a.id)} disabled={busy === a.id} onClick={() => void removeLeader(a)}>
                    Remove
                  </button>
                ) : null
              }
            >
              <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{leader?.name ?? 'Unknown'}</span>
              {canEditLeaderVisibility(viewer) ? (
                <select value={a.dashboard_hours_visibility ?? 'full'} disabled={busy === a.id} onChange={(e) => void setVisibility(a, e.target.value)} style={{ fontSize: '0.75rem', padding: '0.05rem 0.25rem' }} aria-label="Leader dashboard visibility" title="What the leader's Dashboard shows for this member">
                  <option value="full">Full My Team</option>
                  <option value="strip">Clock strip only</option>
                </select>
              ) : (
                <Chip tone="gray">{a.dashboard_hours_visibility === 'strip' ? 'strip' : 'full'}</Chip>
              )}
              {mine ? (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', cursor: 'pointer' }} title="Tell me when they clock in or out">
                  <input type="checkbox" checked={Boolean(notify[a.id])} disabled={busy === `n-${a.id}`} onChange={(e) => void setNotifyPref(a, e.target.checked)} />
                  Alert me on in/out
                </label>
              ) : notify[a.id] ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{leader?.name ?? 'Leader'} is told on in/out</span>
              ) : null}
            </DeskRow>
          )
        })
      )}
      {addOpen || (assignments.length > 0 && canEdit) ? (
        <DeskRow
          label={assignments.length > 0 ? 'Add leader' : 'Pick leader'}
          actions={
            addOpen ? (
              <>
                <button type="button" style={deskBtn(BTN, !pick || busy === 'add')} disabled={!pick || busy === 'add'} onClick={() => void addLeader()}>
                  {busy === 'add' ? 'Saving…' : 'Add'}
                </button>
                <button type="button" style={BTN_QUIET} onClick={() => setAddOpen(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" style={BTN_QUIET} onClick={() => setAddOpen(true)}>
                + Add
              </button>
            )
          }
        >
          {addOpen ? (
            <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ fontSize: '0.8125rem', padding: '0.1rem 0.3rem', maxWidth: '100%' }} aria-label="Leader">
              <option value="">Choose a leader…</option>
              {leaderOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.id}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>A second leader also sees their sessions</span>
          )}
        </DeskRow>
      ) : null}
      <DeskRow label="Groups" actions={canEditGroups(viewer) ? null : <LockTag />}>
        {groups ? (
          <>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={groups.dispatch} disabled={!canEditGroups(viewer) || busy === 'dispatch'} onChange={(e) => void setGroup('dispatch', e.target.checked)} /> Dispatch inbox
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={groups.estimator} disabled={!canEditGroups(viewer) || busy === 'estimator'} onChange={(e) => void setGroup('estimator', e.target.checked)} /> Estimator inbox
            </label>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Dispatch and Estimator inbox membership is set on Settings by a dev</span>
        )}
      </DeskRow>
    </DeskSection>
  )
}
