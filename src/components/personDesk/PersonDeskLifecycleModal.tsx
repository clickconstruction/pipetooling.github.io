import { useCallback, useEffect, useMemo, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { denverWorkDateToday } from '../../lib/salaryScheduleSync'
import { handOffWrites } from '../../lib/vehicleFleet'
import {
  applyChecklistResolutions,
  buildEndEmploymentChecklist,
  buildStartEmploymentChecklist,
  checklistSummary,
  endEmploymentHrLine,
  type LifecycleAction,
  type LifecycleItem,
} from '../../lib/people/lifecycleChecklist'
import { loadEndEmploymentFacts, loadStartEmploymentFacts } from '../../lib/people/personDeskFacts'
import { canArchiveAccount, type PersonDeskViewer } from '../../lib/people/personDeskGates'
import type { PersonKey } from '../../lib/people/personKey'
import { PeopleHoursApprovalsQueueModal } from '../people/PeopleHoursApprovalsQueueModal'
import { BTN, BTN_BLUE, BTN_QUIET, BTN_RED, DESK_EDITOR_Z, deskBtn, fmtDate } from './personDeskShared'

type Resolutions = Record<string, { state: 'done' | 'left_open'; reason?: string }>

async function fnError(e: unknown): Promise<string> {
  if (e instanceof FunctionsHttpError && e.context) {
    try {
      const b = (await e.context.json()) as { error?: string } | null
      if (b?.error) return b.error
    } catch {
      /* fall through */
    }
  }
  return e instanceof Error ? e.message : 'That did not save'
}

/**
 * End / Start employment (PR 2): every open item for one person as a
 * checklist; the finish button stays disabled until each row is resolved,
 * not applicable, or deliberately left open with a reason. Every action is
 * the section's own write; the only new write is one append-only HR line.
 */
export function PersonDeskLifecycleModal({
  mode,
  personKey,
  viewer,
  viewerUserId,
  userEmail,
  onClose,
  onChanged,
}: {
  mode: 'end' | 'start'
  personKey: PersonKey
  viewer: PersonDeskViewer
  viewerUserId: string | null
  userEmail: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const todayYmd = denverWorkDateToday()
  const [endDate, setEndDate] = useState(todayYmd)
  const [startDate, setStartDate] = useState('')
  const [items, setItems] = useState<LifecycleItem[] | null>(null)
  const [resolutions, setResolutions] = useState<Resolutions>({})
  const [leaveFor, setLeaveFor] = useState<{ id: string; reason: string } | null>(null)
  const [archiveAfter, setArchiveAfter] = useState(true)
  const [hrNote, setHrNote] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueReload, setQueueReload] = useState(0)
  const [wageInput, setWageInput] = useState('')
  const [leaderPick, setLeaderPick] = useState('')
  const [leaderOptions, setLeaderOptions] = useState<Array<{ id: string; name: string }>>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      if (mode === 'end') {
        const facts = await loadEndEmploymentFacts(personKey, endDate, todayYmd)
        setItems(buildEndEmploymentChecklist(facts))
      } else {
        const facts = await loadStartEmploymentFacts(personKey, todayYmd)
        setItems(buildStartEmploymentChecklist(facts))
        if (facts.startDate) setStartDate(facts.startDate)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load')
      setItems((prev) => prev ?? [])
    }
  }, [mode, personKey, endDate, todayYmd])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (mode !== 'start' || !personKey.userId) return
    void (async () => {
      const { data } = await supabase.from('users').select('id, name').is('archived_at', null).order('name')
      setLeaderOptions(((data ?? []) as Array<{ id: string; name: string | null }>).filter((u) => u.id !== personKey.userId).map((u) => ({ id: u.id, name: u.name ?? u.id })))
    })()
  }, [mode, personKey.userId])

  const resolved = useMemo(() => applyChecklistResolutions(items ?? [], resolutions), [items, resolutions])
  const summary = useMemo(() => checklistSummary(resolved), [resolved])

  async function run(item: LifecycleItem, action: LifecycleAction) {
    if (viewer.readOnly) return
    setBusy(item.id)
    try {
      switch (action.kind) {
        case 'open_approvals':
          setQueueOpen(true)
          return
        case 'force_clock_out': {
          if (!personKey.userId) return
          const ok = await confirmDialog({ message: `Force clock out ${personKey.displayName} now?`, confirmLabel: 'Force clock out' })
          if (!ok) return
          const { error: e } = await supabase.from('clock_sessions').update({ clocked_out_at: new Date().toISOString() }).eq('user_id', personKey.userId).is('clocked_out_at', null)
          if (e) throw e
          showToast('Session clocked out — it now waits for approval', 'success')
          break
        }
        case 'revoke_portal': {
          if (!personKey.personId) return
          const ok = await confirmDialog({ message: `Turn off ${personKey.displayName}'s portal? Their link stops working immediately.`, confirmLabel: 'Turn off portal', danger: true })
          if (!ok) return
          const { error: e } = await supabase.rpc('revoke_sub_portal_link' as never, { p_person_id: personKey.personId } as never)
          if (e) throw e
          showToast('Portal turned off', 'success')
          break
        }
        case 'park_vehicle': {
          const w = handOffWrites({
            vehicleId: action.vehicleId,
            openPossession: { id: action.possessionId, vehicle_id: action.vehicleId, user_id: personKey.userId, start_date: endDate, end_date: null, created_at: null },
            toUserId: null,
            dateYmd: endDate,
            odometer: null,
            byUserId: viewerUserId,
          })
          if (w.endPossession) {
            const { error: e1 } = await supabase.from('vehicle_possessions').update({ end_date: w.endPossession.end_date }).eq('id', w.endPossession.id)
            if (e1) throw e1
          }
          const { error: e2 } = await supabase.from('vehicle_possessions').insert(w.newPossession)
          if (e2) throw e2
          showToast('Parked in the motor pool', 'success')
          break
        }
        case 'end_housing': {
          const { error: e } = await supabase.from('housing_possessions').update({ end_date: endDate }).eq('id', action.possessionId)
          if (e) throw e
          showToast('Occupancy ended', 'success')
          break
        }
        case 'remove_leader': {
          const { error: e } = await supabase.from('team_leader_assignments').delete().eq('id', action.assignmentId)
          if (e) throw e
          showToast('Removed from the leader’s team', 'success')
          break
        }
        case 'set_start_date': {
          if (!personKey.personId || !startDate) {
            showToast('Pick a start date first', 'warning')
            return
          }
          const { error: e } = await supabase.from('people').update({ start_date: startDate }).eq('id', personKey.personId)
          if (e) throw e
          showToast('Start date saved', 'success')
          break
        }
        case 'set_wage': {
          const wage = Number.parseFloat(wageInput)
          if (!personKey.payName || !Number.isFinite(wage) || wage <= 0) {
            showToast('Enter an hourly wage first', 'warning')
            return
          }
          const { error: e } = await supabase.from('people_pay_config').upsert({ person_name: personKey.payName, person_id: personKey.personId, hourly_wage: wage, is_salary: false, record_hours_but_salary: false }, { onConflict: 'person_name' })
          if (e) throw e
          showToast('Wage saved', 'success')
          break
        }
        case 'assign_leader': {
          if (!personKey.userId || !leaderPick) {
            showToast('Pick a leader first', 'warning')
            return
          }
          const { error: e } = await supabase.from('team_leader_assignments').insert({ leader_user_id: leaderPick, member_user_id: personKey.userId, dashboard_hours_visibility: 'full' })
          if (e) throw e
          showToast('Leader assigned', 'success')
          break
        }
        case 'link':
          return
      }
      setResolutions((r) => ({ ...r, [item.id]: { state: 'done' } }))
      onChanged()
      await load()
    } catch (e) {
      showToast(await fnError(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function finish() {
    if (!summary.canFinish || viewer.readOnly) return
    setBusy('finish')
    try {
      if (mode === 'end') {
        if (!personKey.personId) {
          showToast('Create the roster row from the header first — the end date lives on it.', 'warning')
          return
        }
        const ok = await confirmDialog({
          message: `End ${personKey.displayName}'s employment on ${fmtDate(endDate)}?${archiveAfter && personKey.userId && canArchiveAccount(viewer) ? ' Their account is archived after.' : ''}`,
          confirmLabel: 'End employment',
          danger: true,
        })
        if (!ok) return
        const { error: e } = await supabase.from('people').update({ end_date: endDate }).eq('id', personKey.personId)
        if (e) throw e
        if (hrNote && viewer.isDev) {
          const { error: he } = await supabase.from('person_file_entries').insert({
            person_id: personKey.personId,
            entry_date: endDate,
            content: endEmploymentHrLine(personKey.displayName, endDate, resolved),
            source: 'milestone',
            created_by: viewerUserId,
          })
          if (he) showToast(`End date saved, but the HR line did not: ${he.message}`, 'warning')
        }
        if (archiveAfter && personKey.userId && canArchiveAccount(viewer) && userEmail) {
          const { data, error: ae } = await supabase.functions.invoke('archive-user', { body: { email: userEmail.trim(), name: personKey.displayName } })
          if (ae) throw ae
          const err = (data as { error?: string } | null)?.error
          if (err) throw new Error(err)
        }
        showToast(`${personKey.displayName}'s employment ended ${fmtDate(endDate)}`, 'success')
      } else {
        if (personKey.personId && startDate) {
          const { error: e } = await supabase.from('people').update({ start_date: startDate }).eq('id', personKey.personId)
          if (e) throw e
        }
        showToast(`${personKey.displayName} is set up`, 'success')
      }
      onChanged()
      onClose()
    } catch (e) {
      showToast(await fnError(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  const title = mode === 'end' ? `End ${personKey.displayName}'s employment` : `Start ${personKey.displayName}'s employment`
  const subtitle =
    items == null
      ? 'Checking every section…'
      : `${summary.open} open · ${summary.done} done${summary.leftOpen ? ` · ${summary.leftOpen} left open` : ''} — the button unlocks when every row is green, not applicable, or left open on purpose`

  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: DESK_EDITOR_Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(680px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1rem 0.55rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>{title}</h2>
            <button type="button" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}>
              ×
            </button>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</span>
          {error ? (
            <span role="alert" style={{ fontSize: '0.75rem', color: 'var(--text-red-600)' }}>
              {error}
            </span>
          ) : null}
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {resolved.map((it) => {
            const dotStyle: React.CSSProperties =
              it.state === 'done'
                ? { background: '#22c55e', border: '2px solid #22c55e' }
                : it.state === 'open'
                  ? { border: '2px solid #f59e0b', background: 'transparent' }
                  : it.state === 'left_open'
                    ? { border: '2px solid #f59e0b', background: 'var(--bg-amber-100)' }
                    : { border: '2px solid var(--border-strong)', background: 'var(--bg-muted)' }
            return (
              <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) auto', gap: '0.6rem', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', opacity: it.state === 'skipped' ? 0.7 : 1 }}>
                <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', display: 'inline-block', ...dotStyle }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: it.state === 'open' ? 'var(--text-strong)' : 'var(--text-700)' }}>{it.label}</span>
                  <span style={{ color: 'var(--text-muted)' }}> · {it.detail}</span>
                  {it.state === 'left_open' ? <span style={{ color: 'var(--text-amber-800)' }}> · left open{it.leaveReason ? `: ${it.leaveReason}` : ''}</span> : null}
                  {leaveFor?.id === it.id ? (
                    <span style={{ display: 'inline-flex', gap: '0.3rem', marginLeft: '0.5rem', alignItems: 'center' }}>
                      <input type="text" value={leaveFor.reason} onChange={(e) => setLeaveFor({ id: it.id, reason: e.target.value })} placeholder="why it stays open" style={{ fontSize: '0.75rem', width: 160 }} aria-label="Reason to leave open" />
                      <button type="button" style={deskBtn(BTN, leaveFor.reason.trim() === '')} disabled={leaveFor.reason.trim() === ''} onClick={() => { setResolutions((r) => ({ ...r, [it.id]: { state: 'left_open', reason: leaveFor.reason.trim() } })); setLeaveFor(null) }}>
                        Leave open
                      </button>
                      <button type="button" style={BTN_QUIET} onClick={() => setLeaveFor(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : null}
                  {mode === 'start' && it.kind === 'employment_start' && it.state === 'open' ? (
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }} aria-label="Start date" />
                  ) : null}
                  {mode === 'start' && it.kind === 'pay_setup' && it.state === 'open' ? (
                    <label style={{ marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      $<input type="number" min="0" step="0.01" value={wageInput} onChange={(e) => setWageInput(e.target.value)} style={{ fontSize: '0.75rem', width: 70 }} aria-label="Hourly wage" />/h
                    </label>
                  ) : null}
                  {mode === 'start' && it.kind === 'assign_leader' && it.state === 'open' ? (
                    <select value={leaderPick} onChange={(e) => setLeaderPick(e.target.value)} style={{ fontSize: '0.75rem', marginLeft: '0.5rem', maxWidth: 160 }} aria-label="Leader">
                      <option value="">Leader…</option>
                      {leaderOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </span>
                <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {it.state === 'open' && it.action ? (
                    it.action.kind === 'link' ? (
                      <a href={it.action.href} target="_blank" rel="noreferrer" style={{ ...BTN_QUIET, textDecoration: 'none' }}>
                        {it.action.label} ↗
                      </a>
                    ) : (
                      <button type="button" style={deskBtn(it.action.kind === 'open_approvals' ? BTN : BTN_BLUE, busy != null || viewer.readOnly)} disabled={busy != null || viewer.readOnly} onClick={() => void run(it, it.action!)}>
                        {busy === it.id ? 'Working…' : actionLabel(it.action)}
                      </button>
                    )
                  ) : null}
                  {it.state === 'open' && it.canLeaveOpen && leaveFor?.id !== it.id ? (
                    <button type="button" style={BTN_QUIET} onClick={() => setLeaveFor({ id: it.id, reason: '' })}>
                      Leave open…
                    </button>
                  ) : null}
                  {it.state === 'left_open' ? (
                    <button type="button" style={BTN_QUIET} onClick={() => setResolutions((r) => { const n = { ...r }; delete n[it.id]; return n })}>
                      Undo
                    </button>
                  ) : null}
                </span>
              </div>
            )
          })}
          {items != null && resolved.length === 0 ? <div style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nothing to check.</div> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'center', padding: '0.7rem 1rem', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {mode === 'end' ? (
              <>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  End date <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ fontSize: '0.8125rem' }} />
                </label>
                {personKey.userId ? (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: canArchiveAccount(viewer) ? 'inherit' : 'var(--text-muted)' }} title={canArchiveAccount(viewer) ? undefined : 'Archiving the account is dev-only today'}>
                    <input type="checkbox" checked={archiveAfter && canArchiveAccount(viewer)} disabled={!canArchiveAccount(viewer)} onChange={(e) => setArchiveAfter(e.target.checked)} /> Archive account after
                  </label>
                ) : null}
                {viewer.isDev && personKey.personId ? (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input type="checkbox" checked={hrNote} onChange={(e) => setHrNote(e.target.checked)} /> Note to HR file
                  </label>
                ) : null}
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                {personKey.personId ? 'Rows a dev must do stay locked; the rest you can finish here.' : 'Create the roster row from the header first so a start date has somewhere to live.'}
              </span>
            )}
          </div>
          <button type="button" style={deskBtn(mode === 'end' ? { ...BTN_RED, background: '#b91c1c', color: '#fff', border: '1px solid #b91c1c' } : BTN_BLUE, !summary.canFinish || busy != null || viewer.readOnly)} disabled={!summary.canFinish || busy != null || viewer.readOnly} onClick={() => void finish()}>
            {busy === 'finish' ? 'Saving…' : mode === 'end' ? (summary.canFinish ? 'End employment' : `End employment · ${summary.open} open`) : summary.canFinish ? 'Done' : `Done · ${summary.open} open`}
          </button>
        </div>
      </div>
      {queueOpen && personKey.userId ? (
        <PeopleHoursApprovalsQueueModal
          pinUserId={personKey.userId}
          pinDisplayName={personKey.displayName}
          zIndex={DESK_EDITOR_Z + 20}
          reloadKey={queueReload}
          authUserId={viewerUserId ?? undefined}
          onClose={() => {
            setQueueOpen(false)
            void load()
          }}
          onChanged={() => {
            setQueueReload((k) => k + 1)
            onChanged()
          }}
          onEditSession={() => showToast('Edit times from the Hours section — this queue approves and rejects.', 'info')}
        />
      ) : null}
    </div>
  )
}

function actionLabel(a: LifecycleAction): string {
  switch (a.kind) {
    case 'open_approvals':
      return 'Open approvals'
    case 'force_clock_out':
      return 'Force clock out'
    case 'revoke_portal':
      return 'Turn off portal'
    case 'park_vehicle':
      return 'To motor pool'
    case 'end_housing':
      return 'End occupancy'
    case 'remove_leader':
      return 'Remove'
    case 'set_start_date':
      return 'Save date'
    case 'set_wage':
      return 'Save wage'
    case 'assign_leader':
      return 'Assign'
    case 'link':
      return a.label
  }
}
