import { useCallback, useEffect, useMemo, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { denverWorkDateToday } from '../../lib/salaryScheduleSync'
import { applyChecklistResolutions, checklistSummary } from '../../lib/people/lifecycleChecklist'
import {
  RETURNER_TRAINING_MODE_DEFAULT,
  awayLine,
  bringBackButtonLabel,
  bringBackDateProblem,
  bringBackFooterWords,
  buildBringBackChecklist,
  longDate,
  planBringBackWrites,
  planUndoEndWrites,
  roadmapBoxDefault,
  roadmapBoxWords,
  type BringBackAction,
  type BringBackItem,
  type BringBackWrite,
  withWageChange,
} from '../../lib/people/bringBack'
import { loadBringBackFacts, type BringBackLoad } from '../../lib/people/bringBackFacts'
import type { PersonDeskViewer } from '../../lib/people/personDeskGates'
import type { PersonKey } from '../../lib/people/personKey'
import { BTN, BTN_BLUE, BTN_QUIET, DESK_EDITOR_Z, deskBtn } from './personDeskShared'
import { formatErrorMessage } from '../../utils/errorHandling'

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
  return formatErrorMessage(e, 'That did not save')
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Bring back (punch list #256 PR 3, v2.6523): a teammate whose employment ended comes back on the
 * same account, in one window. The day back first, then the rows time away made stale (the
 * kernel's `buildBringBackChecklist`), the old-roadmap-tasks box (ticked by default within 90 days,
 * the owner's call 2), training mode (off by default, call 4), and one press that restores the login
 * and the roster row together, clears the end date, sets the start to the day back (the stints
 * trigger opens a new stint beside the old one) and appends one HR line. The wage row must be
 * pressed, Keep or Change (call 3). "Ended by mistake? Undo the end instead" reopens the old stint.
 */
export function PersonDeskBringBackModal({
  personKey,
  viewer,
  viewerUserId,
  onClose,
  onChanged,
}: {
  personKey: PersonKey
  viewer: PersonDeskViewer
  viewerUserId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const todayYmd = denverWorkDateToday()
  const [backYmd, setBackYmd] = useState(todayYmd)
  const [load, setLoad] = useState<BringBackLoad | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolutions, setResolutions] = useState<Resolutions>({})
  const [leaveFor, setLeaveFor] = useState<{ id: string; reason: string } | null>(null)
  const [wageDraft, setWageDraft] = useState<string | null>(null)
  const [wageChange, setWageChange] = useState<number | null>(null)
  const [restoreRoadmap, setRestoreRoadmap] = useState<boolean | null>(null)
  const [training, setTraining] = useState(RETURNER_TRAINING_MODE_DEFAULT)
  const [hrNote, setHrNote] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setError(null)
      const l = await loadBringBackFacts(personKey, backYmd)
      setLoad(l)
    } catch (e) {
      setError(formatErrorMessage(e, 'Could not load'))
    }
  }, [personKey, backYmd])

  useEffect(() => {
    void reload()
  }, [reload])

  const leftYmd = load?.leftYmd ?? null
  const dateProblem = leftYmd ? bringBackDateProblem(leftYmd, backYmd) : null
  const roadmapOn = restoreRoadmap ?? (leftYmd ? roadmapBoxDefault(leftYmd, backYmd) : false)

  const items = useMemo<BringBackItem[]>(() => {
    if (!load) return []
    return applyChecklistResolutions(buildBringBackChecklist(withWageChange(load.facts, wageChange, backYmd)), resolutions)
  }, [load, resolutions, wageChange, backYmd])
  const summary = useMemo(() => checklistSummary(items), [items])
  const canFinish = summary.canFinish && load != null && leftYmd != null && dateProblem == null && !viewer.readOnly && busy == null
  const roadmapWords = load && leftYmd ? roadmapBoxWords(load.parkedTasks, leftYmd) : null
  const firstStartYmd = load?.stints.find((s) => s.start_date)?.start_date ?? null

  function markDone(id: string) {
    setResolutions((r) => ({ ...r, [id]: { state: 'done' } }))
  }

  function saveWage(item: BringBackItem) {
    const wage = Number.parseFloat(wageDraft ?? '')
    if (!Number.isFinite(wage) || wage <= 0) {
      showToast('Enter an hourly wage first', 'warning')
      return
    }
    setWageChange(wage)
    setWageDraft(null)
    markDone(item.id)
  }

  async function runWrite(w: BringBackWrite): Promise<void> {
    switch (w.kind) {
      case 'restore_login': {
        const { data, error: e } = await supabase.functions.invoke('restore-user', { body: { user_id: w.userId, restore_roadmap: w.restoreRoadmap } })
        if (e) throw e
        const err = (data as { error?: string } | null)?.error
        if (err) throw new Error(err)
        return
      }
      case 'roster': {
        const { error: e } = await supabase.from('people').update(w.patch).eq('id', w.personId)
        if (e) throw new Error(e.message)
        return
      }
      case 'training_mode': {
        const { data, error: e } = await supabase.from('users').update({ read_only: w.on }).eq('id', w.userId).select('id')
        if (e) throw new Error(e.message)
        if (!data?.[0]) throw new Error('Training mode did not change. You may not have permission to change this account.')
        return
      }
      case 'wage': {
        const { error: e } = await supabase.from('people_pay_config').upsert({ person_name: w.payName, person_id: w.personId, hourly_wage: w.hourlyWage }, { onConflict: 'person_name' })
        if (e) throw new Error(e.message)
        return
      }
      case 'hr_line': {
        const { error: e } = await supabase.from('person_file_entries').insert({ person_id: w.personId, entry_date: w.entryDate, content: w.content, source: 'milestone', created_by: viewerUserId })
        if (e) throw new Error(e.message)
        return
      }
    }
  }

  function stepWords(w: BringBackWrite): string {
    switch (w.kind) {
      case 'restore_login':
        return 'the login'
      case 'roster':
        return 'the roster row'
      case 'training_mode':
        return 'training mode'
      case 'wage':
        return 'the wage'
      case 'hr_line':
        return 'the HR line'
    }
  }

  async function runPlan(plan: BringBackWrite[], doneToast: string) {
    let at: BringBackWrite | null = null
    try {
      for (const w of plan) {
        at = w
        await runWrite(w)
      }
      showToast(doneToast, 'success')
      onChanged()
      onClose()
    } catch (e) {
      const reason = await fnError(e)
      const done = at ? plan.slice(0, plan.indexOf(at)).map(stepWords) : []
      showToast(`${at ? `Stopped at ${stepWords(at)}: ` : ''}${reason}${done.length > 0 ? ` Already done: ${done.join(', ')}.` : ''}`, 'error')
      await reload()
    }
  }

  async function finish() {
    if (!canFinish || !load || !leftYmd) return
    const footer = bringBackFooterWords({ hasLogin: load.facts.hasLogin, accountArchived: load.loginArchived, hasRosterRow: load.facts.hasRosterRow, backYmd, hrNote: hrNote && viewer.isDev })
    const ok = await confirmDialog({ message: `Bring ${personKey.displayName} back on ${longDate(backYmd)}? ${footer}`, confirmLabel: 'Bring back' })
    if (!ok) return
    setBusy('finish')
    try {
      const plan = planBringBackWrites({
        userId: personKey.userId,
        loginArchived: load.loginArchived,
        personId: personKey.personId,
        payName: personKey.payName,
        displayName: personKey.displayName,
        leftYmd,
        backYmd,
        restoreRoadmap: roadmapOn,
        trainingMode: training,
        trainingWas: load.trainingOn,
        wageChange,
        hrNote: hrNote && viewer.isDev,
        items,
      })
      await runPlan(plan, `${personKey.displayName} is back as of ${longDate(backYmd)}`)
    } finally {
      setBusy(null)
    }
  }

  async function undoEnd() {
    if (!load || !leftYmd || viewer.readOnly || busy != null) return
    const ok = await confirmDialog({
      message: `Undo the end of ${longDate(leftYmd)} for ${personKey.displayName}? The old stint reopens as if they never left, and the login and roster row come back.`,
      confirmLabel: 'Undo the end',
    })
    if (!ok) return
    setBusy('undo')
    try {
      const plan = planUndoEndWrites({ userId: personKey.userId, loginArchived: load.loginArchived, personId: personKey.personId, displayName: personKey.displayName, leftYmd, todayYmd, hrNote: hrNote && viewer.isDev })
      await runPlan(plan, `The end of ${longDate(leftYmd)} is undone for ${personKey.displayName}`)
    } finally {
      setBusy(null)
    }
  }

  const title = `Bring back ${personKey.displayName}`
  const subtitle =
    load == null && !error
      ? 'Checking every section…'
      : leftYmd == null
        ? 'No end date on the roster row. Restore on Access & account brings the login back as it was.'
        : `${summary.open} open · ${summary.done} done${summary.leftOpen ? ` · ${summary.leftOpen} left open` : ''} — the button unlocks when every row is green, not applicable, or left open on purpose`

  function actionButtons(it: BringBackItem, action: BringBackAction) {
    switch (action.kind) {
      case 'confirm_sign_in':
        return (
          <button type="button" style={deskBtn(BTN_BLUE, busy != null)} disabled={busy != null} onClick={() => markDone(it.id)} title="Change… and Send sign-in email are on Access & account.">
            Still theirs
          </button>
        )
      case 'confirm_wage':
        if (wageDraft != null) {
          return (
            <>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem' }}>
                $<input type="number" min="0" step="0.01" value={wageDraft} onChange={(e) => setWageDraft(e.target.value)} style={{ fontSize: '0.75rem', width: 70 }} aria-label="New hourly wage" autoFocus />/h
              </label>
              <button type="button" style={deskBtn(BTN_BLUE, busy != null)} disabled={busy != null} onClick={() => saveWage(it)}>
                Save wage
              </button>
              <button type="button" style={BTN_QUIET} onClick={() => setWageDraft(null)}>
                Cancel
              </button>
            </>
          )
        }
        return (
          <>
            {action.hourlyWage != null && action.hourlyWage > 0 ? (
              <button type="button" style={deskBtn(BTN, busy != null)} disabled={busy != null} onClick={() => markDone(it.id)}>
                Keep {money(action.hourlyWage)}
              </button>
            ) : null}
            <button type="button" style={deskBtn(BTN_BLUE, busy != null)} disabled={busy != null} onClick={() => setWageDraft(action.hourlyWage != null && action.hourlyWage > 0 ? String(action.hourlyWage) : '')}>
              Change…
            </button>
          </>
        )
      case 'link':
        return (
          <a href={action.href} target="_blank" rel="noreferrer" style={{ ...BTN_QUIET, textDecoration: 'none' }}>
            {action.label} ↗
          </a>
        )
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: DESK_EDITOR_Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 'var(--app-top-chrome, 0px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(680px, 96vw)', maxHeight: 'min(92vh, 100%)', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
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
          <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--text-strong)' }}>
              Back on <input type="date" value={backYmd} onChange={(e) => setBackYmd(e.target.value)} style={{ fontSize: '0.8125rem', fontWeight: 400 }} aria-label="Back on" disabled={busy != null} />
            </label>
            {leftYmd ? <span style={{ color: 'var(--text-muted)' }}>{awayLine({ leftYmd, backYmd, firstStartYmd })}</span> : null}
            {dateProblem ? (
              <span role="alert" style={{ color: 'var(--text-red-600)' }}>
                {dateProblem}
              </span>
            ) : null}
            {leftYmd ? (
              <span style={{ color: 'var(--text-muted)' }}>
                Ended by mistake?{' '}
                <button type="button" onClick={() => void undoEnd()} disabled={busy != null || viewer.readOnly} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', font: 'inherit' }}>
                  {busy === 'undo' ? 'Undoing…' : 'Undo the end instead'}
                </button>
              </span>
            ) : null}
          </div>

          {items.map((it) => {
            const dotStyle: React.CSSProperties =
              it.state === 'done'
                ? { background: '#22c55e', border: '2px solid #22c55e' }
                : it.state === 'open'
                  ? it.lapsed
                    ? { border: '2px solid #dc2626', background: 'transparent' }
                    : { border: '2px solid #f59e0b', background: 'transparent' }
                  : it.state === 'left_open'
                    ? { border: '2px solid #f59e0b', background: 'var(--bg-amber-100)' }
                    : { border: '2px solid var(--border-strong)', background: 'var(--bg-muted)' }
            return (
              <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) auto', gap: '0.6rem', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', opacity: it.state === 'skipped' ? 0.7 : 1 }}>
                <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', display: 'inline-block', ...dotStyle }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: it.state === 'open' ? 'var(--text-strong)' : 'var(--text-700)' }}>{it.label}</span>
                  <span style={{ color: it.lapsed && it.state === 'open' ? 'var(--text-red-600)' : 'var(--text-muted)' }}> · {it.detail}</span>
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
                </span>
                <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {it.state === 'open' && it.action ? actionButtons(it, it.action) : null}
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

          {load && leftYmd ? (
            <div style={{ padding: '0.6rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8125rem' }}>
              {roadmapWords ? (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                  <input type="checkbox" checked={roadmapOn} onChange={(e) => setRestoreRoadmap(e.target.checked)} disabled={busy != null} style={{ marginTop: 2 }} />
                  <span>
                    <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{roadmapWords}</span>
                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Off by default after 90 days away. Unticked, they stay in the Plan view's Needs a person lane.</span>
                  </span>
                </label>
              ) : null}
              {personKey.userId ? (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                  <input type="checkbox" checked={training} onChange={(e) => setTraining(e.target.checked)} disabled={busy != null} style={{ marginTop: 2 }} />
                  <span>
                    <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>Start in training mode</span>
                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Every write is blocked until you switch it off. A returner knows the app, so it starts off.</span>
                  </span>
                </label>
              ) : null}
              {viewer.isDev && personKey.personId ? (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input type="checkbox" checked={hrNote} onChange={(e) => setHrNote(e.target.checked)} disabled={busy != null} /> Note to HR file
                </label>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'center', padding: '0.7rem 1rem', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)', fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {load && leftYmd ? bringBackFooterWords({ hasLogin: load.facts.hasLogin, accountArchived: load.loginArchived, hasRosterRow: load.facts.hasRosterRow, backYmd, hrNote: hrNote && viewer.isDev }) : ''}
          </span>
          <button type="button" style={deskBtn(BTN_BLUE, !canFinish)} disabled={!canFinish} onClick={() => void finish()}>
            {busy === 'finish' ? 'Saving…' : bringBackButtonLabel(items)}
          </button>
        </div>
      </div>
    </div>
  )
}
