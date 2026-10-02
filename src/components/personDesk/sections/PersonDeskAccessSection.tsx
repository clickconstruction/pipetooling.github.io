import { useState, type FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { canArchiveAccount, canEditAccount, canSetSupervision, canSetTrainingMode, type PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { describeLastSeen } from '../../../lib/people/personKey'
import { hasSupervisionSwitch } from '../../../lib/people/supervision'
import { checkSignInEmail } from '../../../../supabase/functions/_shared/signInEmailChange'
import {
  changeSignInEmail,
  createCountToolingSeat,
  extraAccessForRole,
  passwordProblem,
  renameAccount,
  setAccountExtraAccess,
  setAccountPassword,
  setAccountTrades,
  setCanRunAJob,
  tradesColumnForRole,
  tradesMeaningForRole,
} from '../../../lib/people/accountWrites'
import type { PersonDeskUserRow } from '../../../hooks/usePersonDesk'
import { MergeDuplicateDialog } from './MergeDuplicateDialog'
import { useHiringColumnShares } from '../../../hooks/useHiringColumnShares'
import { sharedColumnsLine } from '../../../lib/hiring/columnShares'
import { BTN, BTN_BLUE, BTN_QUIET, BTN_RED, Chip, DESK_EDITOR_Z, DeskEmpty, DeskRow, DeskSection, LockTag, deskBtn } from '../personDeskShared'
import type { UserRole } from '../../../hooks/useAuth'
import { humanRoleLabel } from '../../../lib/roleLabels'

/** Least-privilege first; labels come from the one shared helper (`roleLabels.ts`), same as the invite dialog and the email. */
const ROLE_ORDER: UserRole[] = ['helpers', 'subcontractor', 'assistant', 'controller', 'estimator', 'master_technician', 'superintendent', 'primary', 'dev']

const HINT: React.CSSProperties = { flexBasis: '100%', fontSize: '0.71875rem', color: 'var(--text-muted)' }
const CHECK: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }

async function fnErrorMessage(e: unknown): Promise<string> {
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
 * Access & account (v2.2701; Account on the desk, PR B): every control for one person's login,
 * row by row, each saving itself. It used to hold role, sign-in, training and status, and send
 * the rest to the Active Accounts window ("Manage account…"), which opened on everyone. Name,
 * trades, supervision, extra access, the password and the CountTooling seat now live here.
 * Rows the viewer cannot change still show their value, with a tag that says who can.
 */
export function PersonDeskAccessSection({
  user,
  viewer,
  viewerUserId,
  serviceTypeNames,
  onChanged,
  onOpenFlow,
}: {
  user: PersonDeskUserRow | null
  viewer: PersonDeskViewer
  viewerUserId: string | null
  serviceTypeNames: Map<string, string>
  onChanged: () => void
  /** Leave (v2.3700): Archive… opens the End employment flow, which finishes everything here — no Settings hop. */
  onOpenFlow?: (mode: 'start' | 'end') => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [busy, setBusy] = useState<string | null>(null)
  /** null = not editing. */
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [tradesDraft, setTradesDraft] = useState<string[] | null>(null)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  // PR D2: the Hiring columns shared with them, the line the Active Accounts window's Edit showed (dev reads).
  const { shares: hiringShares, roles: hiringColumns } = useHiringColumnShares(viewer.isDev)

  if (!user) {
    return (
      <DeskSection id="access" title="Access & account">
        <DeskEmpty>No login account. The header's "Invite as user" note says where to invite them.</DeskEmpty>
      </DeskSection>
    )
  }
  const u = user

  const editable = canEditAccount(viewer)
  const isSelf = viewerUserId === u.id
  const displayName = u.name ?? u.email ?? 'them'
  const tradesColumn = tradesColumnForRole(u.role)
  const serviceIds = tradesColumn ? u[tradesColumn] : null
  const extraAccess = extraAccessForRole(u.role)
  const supervisionApplies = hasSupervisionSwitch(u.role)
  const canFlipSupervision = canSetSupervision(viewer) && (!isSelf || viewer.isDev)
  const canRun = u.needs_supervision === false
  const showCountTooling = viewer.isDev && (Boolean(u.counttooling_user_id) || u.role === 'estimator')

  /** One write: busy while it runs, a toast either way, the desk reloads on success. */
  async function run(key: string, write: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusy(key)
    try {
      await write()
      showToast(success, 'success')
      onChanged()
      return true
    } catch (e) {
      showToast(await fnErrorMessage(e), 'error')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function setRole(role: string) {
    if (!editable) return
    const ok = await confirmDialog({ message: `Change ${displayName}'s role to ${humanRoleLabel(role)}? Their navigation and access change on next load.`, confirmLabel: 'Change role' })
    if (!ok) return
    await run(
      'role',
      async () => {
        const { error } = await supabase.from('users').update({ role: role as Exclude<UserRole, 'controller'> }).eq('id', u.id)
        if (error) throw new Error(error.message)
      },
      'Role changed',
    )
  }

  async function saveName() {
    if (nameDraft == null) return
    setNameError(null)
    setBusy('name')
    try {
      await renameAccount(supabase, { userId: u.id, email: u.email, oldName: u.name, newName: nameDraft })
      showToast('Name saved. Their pay and hours rows moved with it.', 'success')
      setNameDraft(null)
      onChanged()
    } catch (e) {
      setNameError(await fnErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function saveTrades() {
    if (tradesDraft == null) return
    const ok = await run('trades', () => setAccountTrades(supabase, { userId: u.id, role: u.role, ids: tradesDraft }), 'Trades saved')
    if (ok) setTradesDraft(null)
  }

  async function setTraining(on: boolean) {
    await run(
      'training',
      async () => {
        const { data, error } = await supabase.from('users').update({ read_only: on }).eq('id', u.id).select('id, read_only')
        if (error) throw new Error(error.message)
        if (!data?.[0]) throw new Error('That change did not apply. You may not have permission to change this account.')
      },
      on ? 'Training mode on. Every write is blocked for them.' : 'Training mode off',
    )
  }

  async function sendSignIn() {
    if (!u.email) return
    await run(
      'signin',
      async () => {
        const redirectTo = new URL('dashboard', window.location.href).href
        const { data, error } = await supabase.functions.invoke('send-sign-in-email', { body: { email: u.email, redirectTo } })
        if (error) throw error
        const err = (data as { error?: string } | null)?.error
        if (err) throw new Error(err)
      },
      `Sign-in email sent to ${u.email}`,
    )
  }

  async function archiveDirect() {
    if (!u.email) return
    const ok = await confirmDialog({ message: `Archive ${displayName}? They can no longer sign in and disappear from rosters. The account can be restored later. If they own customers, ask a dev to reassign them first.`, confirmLabel: 'Archive', danger: true })
    if (!ok) return
    await run(
      'archive',
      async () => {
        const { data, error } = await supabase.functions.invoke('archive-user', { body: { email: u.email!.trim(), name: (u.name ?? '').trim() } })
        if (error) throw error
        const err = (data as { error?: string } | null)?.error
        if (err) throw new Error(err)
      },
      `${displayName} archived`,
    )
  }

  async function restore() {
    await run(
      'restore',
      async () => {
        const { data, error } = await supabase.functions.invoke('restore-user', { body: { user_id: u.id } })
        if (error) throw error
        const err = (data as { error?: string } | null)?.error
        if (err) throw new Error(err)
      },
      'Account restored',
    )
  }

  const devLock = editable ? null : <LockTag />

  return (
    <DeskSection id="access" title="Access & account" who={editable ? undefined : 'locked rows say why'} whoTone="dev">
      <DeskRow
        label="Name"
        actions={
          !editable ? (
            devLock
          ) : nameDraft != null ? (
            <>
              <button type="button" style={deskBtn(BTN_BLUE, busy != null)} disabled={busy != null} onClick={() => void saveName()}>
                {busy === 'name' ? 'Saving…' : 'Save'}
              </button>
              <button type="button" style={BTN_QUIET} disabled={busy != null} onClick={() => { setNameDraft(null); setNameError(null) }}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" style={deskBtn(BTN, busy != null)} disabled={busy != null} onClick={() => { setNameDraft(u.name ?? ''); setNameError(null) }}>
              Edit
            </button>
          )
        }
      >
        {nameDraft != null ? (
          <>
            <input
              type="text"
              value={nameDraft}
              autoFocus
              aria-label="Name"
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveName()
                if (e.key === 'Escape') {
                  setNameDraft(null)
                  setNameError(null)
                }
              }}
              style={{ flex: '1 1 12rem', minWidth: 0, fontSize: '0.8125rem', padding: '0.2rem 0.4rem', fontFamily: 'inherit' }}
            />
            {nameError ? (
              <span role="alert" style={{ ...HINT, color: 'var(--text-red-600)' }}>
                {nameError}
              </span>
            ) : (
              <span style={HINT}>Their pay and hours rows follow the new name.</span>
            )}
          </>
        ) : (
          <span>{u.name ?? '—'}</span>
        )}
      </DeskRow>

      <DeskRow
        label="Email"
        actions={
          editable ? (
            <button type="button" style={deskBtn(BTN, busy != null)} disabled={busy != null} onClick={() => setEmailOpen(true)}>
              Change…
            </button>
          ) : (
            devLock
          )
        }
      >
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{u.email ?? 'no email'}</span>
        {u.email ? <span style={HINT}>They sign in with this address.</span> : null}
      </DeskRow>

      <DeskRow
        label="Role"
        actions={
          !editable ? (
            devLock
          ) : tradesColumn && tradesDraft == null ? (
            <button type="button" style={deskBtn(BTN, busy != null)} disabled={busy != null} onClick={() => setTradesDraft([...(serviceIds ?? [])])}>
              Trades…
            </button>
          ) : null
        }
      >
        {editable ? (
          <select value={u.role ?? ''} disabled={busy != null || isSelf} onChange={(e) => void setRole(e.target.value)} style={{ fontSize: '0.8125rem', padding: '0.1rem 0.3rem' }} aria-label="Role">
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {humanRoleLabel(r)}
              </option>
            ))}
          </select>
        ) : (
          <span>{humanRoleLabel(u.role ?? '')}</span>
        )}
        {(serviceIds ?? []).map((id) => (
          <Chip key={id} tone="gray">
            {serviceTypeNames.get(id) ?? 'trade'}
          </Chip>
        ))}
        {tradesColumn && (serviceIds ?? []).length === 0 ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>all trades</span> : null}
      </DeskRow>
      {tradesDraft != null ? (
        <fieldset aria-label="Trades" style={{ margin: 0, border: 'none', borderBottom: '1px solid var(--border)', padding: '0.45rem 0.7rem 0.55rem', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{tradesMeaningForRole(u.role)}</span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 1rem' }}>
            {[...serviceTypeNames.entries()].map(([id, name]) => (
              <label key={id} style={CHECK}>
                <input
                  type="checkbox"
                  checked={tradesDraft.includes(id)}
                  disabled={busy != null}
                  onChange={(e) => setTradesDraft((cur) => (cur == null ? cur : e.target.checked ? [...cur, id] : cur.filter((x) => x !== id)))}
                />
                {name}
              </label>
            ))}
          </span>
          <span style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
            <button type="button" style={BTN_QUIET} disabled={busy != null} onClick={() => setTradesDraft(null)}>
              Cancel
            </button>
            <button type="button" style={deskBtn(BTN_BLUE, busy != null)} disabled={busy != null} onClick={() => void saveTrades()}>
              {busy === 'trades' ? 'Saving…' : 'Save trades'}
            </button>
          </span>
        </fieldset>
      ) : null}

      {supervisionApplies ? (
        <DeskRow
          label="Supervision"
          actions={
            canFlipSupervision ? null : (
              <LockTag
                label="office"
                title={isSelf ? 'Nobody changes their own supervision.' : 'A dev, a leader or an assistant changes this. The value is shown so you know where it stands.'}
              />
            )
          }
        >
          <label style={{ ...CHECK, cursor: canFlipSupervision ? 'pointer' : 'default', color: canRun ? 'var(--text-green-800)' : 'var(--text-base)' }}>
            <input
              type="checkbox"
              checked={canRun}
              disabled={!canFlipSupervision || busy != null}
              onChange={(e) => void run('supervision', () => setCanRunAJob(supabase, { userId: u.id, canRun: e.target.checked }), e.target.checked ? 'Marked as able to run a job.' : 'Back under supervision.')}
            />
            Can run a job on their own
          </label>
          {canRun ? null : <span style={HINT}>While this is off, someone who can run a job works beside them.</span>}
        </DeskRow>
      ) : null}

      {extraAccess.length > 0 ? (
        <DeskRow label="Extra access" actions={devLock}>
          {extraAccess.map((x) => (
            <label key={x.field} title={x.title} style={{ ...CHECK, cursor: editable ? 'pointer' : 'default' }}>
              <input
                type="checkbox"
                checked={Boolean(u[x.field])}
                disabled={!editable || busy != null}
                onChange={(e) => void run(x.field, () => setAccountExtraAccess(supabase, { userId: u.id, field: x.field, on: e.target.checked }), e.target.checked ? `${x.label} opened for ${displayName}` : `${x.label} closed for ${displayName}`)}
              />
              {x.label}
            </label>
          ))}
          {(() => {
            const line = extraAccess.some((x) => x.field === 'team_prospects_access') ? sharedColumnsLine(u.id, hiringShares, hiringColumns, () => null) : null
            return line ? (
              <span style={HINT} data-testid="hiring-columns-shared">
                Hiring columns shared with them: <strong style={{ fontWeight: 600, color: 'var(--text-base)' }}>{line}</strong>. Unshare on the column's ⋯ menu.
              </span>
            ) : null
          })()}
        </DeskRow>
      ) : null}

      <DeskRow label="Training mode" actions={canSetTrainingMode(viewer) && !isSelf ? null : <LockTag title={isSelf ? 'You cannot flag your own account.' : undefined} />}>
        <label style={{ ...CHECK, cursor: canSetTrainingMode(viewer) && !isSelf ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={Boolean(u.read_only)} disabled={!canSetTrainingMode(viewer) || isSelf || busy != null} onChange={(e) => void setTraining(e.target.checked)} />
          Read-only{u.read_only ? '. Every write is blocked for them.' : ''}
        </label>
      </DeskRow>

      <DeskRow
        label="Sign-in"
        actions={
          editable ? (
            <>
              <button type="button" style={deskBtn(BTN, busy != null || !u.email)} disabled={busy != null || !u.email} onClick={() => void sendSignIn()}>
                {busy === 'signin' ? 'Sending…' : 'Send sign-in email'}
              </button>
              <button type="button" style={deskBtn(BTN, busy != null)} disabled={busy != null} onClick={() => setPasswordOpen(true)}>
                Set password…
              </button>
            </>
          ) : (
            devLock
          )
        }
      >
        <span>{describeLastSeen(u.last_sign_in_at, Date.now())}</span>
      </DeskRow>

      {showCountTooling ? (
        <DeskRow
          label="CountTooling"
          actions={
            u.counttooling_user_id ? null : (
              <button
                type="button"
                style={deskBtn(BTN, busy != null || !u.email)}
                disabled={busy != null || !u.email}
                title="Make (or find) their CountTooling account and link it."
                onClick={() => void run('ct', () => createCountToolingSeat(supabase, { userId: u.id, email: u.email!, name: u.name }), `CountTooling seat ready for ${displayName}`)}
              >
                {busy === 'ct' ? 'Making…' : 'Make a seat'}
              </button>
            )
          }
        >
          {u.counttooling_user_id ? (
            <Chip tone="green" title={`Linked CountTooling account ${u.counttooling_user_id}. Archiving them also retires the seat.`}>
              seat linked
            </Chip>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>no seat</span>
          )}
        </DeskRow>
      ) : null}

      <DeskRow
        label="Status"
        actions={
          <>
            {editable && !u.archived_at ? (
              <button type="button" style={deskBtn(BTN_QUIET, busy != null)} disabled={busy != null} onClick={() => setMergeOpen(true)} title="Fold another account, or a roster row with no login, into this person.">
                Merge a duplicate…
              </button>
            ) : null}
            {canArchiveAccount(viewer) && !isSelf ? (
              u.archived_at ? (
                <button type="button" style={deskBtn(BTN, busy != null)} disabled={busy != null} onClick={() => void restore()}>
                  {busy === 'restore' ? 'Restoring…' : 'Restore'}
                </button>
              ) : (
                <button
                  type="button"
                  style={deskBtn(BTN_RED, busy != null)}
                  disabled={busy != null}
                  onClick={() => (onOpenFlow ? onOpenFlow('end') : void archiveDirect())}
                  title={onOpenFlow ? 'Opens End employment: the final pay report, the salary template, customers, the roster row and the account, finished here.' : 'Archive the account. They can no longer sign in. A dev can restore it.'}
                >
                  {busy === 'archive' ? 'Archiving…' : 'Archive…'}
                </button>
              )
            ) : (
              <LockTag />
            )}
          </>
        }
      >
        {u.archived_at ? <Chip tone="gray">Archived</Chip> : <Chip tone="green">Active</Chip>}
      </DeskRow>

      {passwordOpen ? <SetPasswordDialog userId={u.id} name={displayName} onClose={() => setPasswordOpen(false)} /> : null}
      {mergeOpen ? (
        <MergeDuplicateDialog
          survivor={{ id: u.id, name: u.name, email: u.email, role: u.role, archived_at: u.archived_at, last_sign_in_at: u.last_sign_in_at ?? null }}
          onClose={() => setMergeOpen(false)}
          onMerged={() => {
            setMergeOpen(false)
            onChanged()
          }}
        />
      ) : null}
      {emailOpen ? (
        <ChangeEmailDialog
          userId={u.id}
          name={displayName}
          current={u.email}
          onClose={() => setEmailOpen(false)}
          onChanged={() => {
            setEmailOpen(false)
            onChanged()
          }}
        />
      ) : null}
    </DeskSection>
  )
}

/** Set password… (dev): the window's own `set-user-password` call, from the person's desk. */
function SetPasswordDialog({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const { showToast } = useToastContext()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const problem = passwordProblem(password, again)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await setAccountPassword(supabase, { userId, password })
      showToast(`Password set for ${name}. Give it to them in person or by phone.`, 'success')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save')
    } finally {
      setSaving(false)
    }
  }

  const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-700)' }
  const input: React.CSSProperties = { fontSize: '0.875rem', padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 5, fontFamily: 'inherit', fontWeight: 400, background: 'var(--surface)', color: 'var(--text-base)' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: DESK_EDITOR_Z, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <form role="dialog" aria-modal="true" aria-label={`Set a password for ${name}`} onSubmit={(e) => void submit(e)} style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(420px, 100%)', padding: '1rem 1.1rem', boxShadow: '0 16px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-strong)' }}>Set a password for {name}</h2>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-700)' }}>They can sign in with it right away. Give it to them in person or by phone.</p>
        <label style={field}>
          New password
          <input type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
        </label>
        <label style={field}>
          Type it again
          <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} style={input} />
        </label>
        {error ? (
          <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <button type="button" style={BTN_QUIET} disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" style={deskBtn(BTN_BLUE, saving)} disabled={saving}>
            {saving ? 'Setting…' : 'Set password'}
          </button>
        </div>
        <p style={{ margin: 0, paddingTop: '0.55rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>A sign-in email is often easier. It signs them in without a password.</p>
      </form>
    </div>
  )
}

/**
 * Change… (dev, PR C): the email they sign in with. `change-user-email` moves the login and the
 * app's copy together; the window checks the address with the same rule first.
 */
function ChangeEmailDialog({ userId, name, current, onClose, onChanged }: { userId: string; name: string; current: string | null; onClose: () => void; onChanged: () => void }) {
  const { showToast } = useToastContext()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const check = checkSignInEmail(current, email)
    if (!check.ok) {
      setError(check.error)
      return
    }
    if (check.unchanged) {
      setError('That is the address they already sign in with.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await changeSignInEmail(supabase, { userId, email: check.email })
      showToast(`${name} signs in with ${res.email} now.`, 'success')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save')
    } finally {
      setSaving(false)
    }
  }

  const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-700)' }
  const input: React.CSSProperties = { fontSize: '0.875rem', padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 5, fontFamily: 'inherit', fontWeight: 400, background: 'var(--surface)', color: 'var(--text-base)' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: DESK_EDITOR_Z, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <form role="dialog" aria-modal="true" aria-label={`Change ${name}'s sign-in email`} noValidate onSubmit={(e) => void submit(e)} style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(420px, 100%)', padding: '1rem 1.1rem', boxShadow: '0 16px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-strong)' }}>Change {name}'s sign-in email</h2>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-700)', overflowWrap: 'anywhere' }}>Now: {current ?? 'no email'}</p>
        <label style={field}>
          New email
          <input type="email" autoComplete="off" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
        </label>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-700)' }}>They sign in with the new address from now on. The old one stops working.</p>
        {error ? (
          <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <button type="button" style={BTN_QUIET} disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" style={deskBtn(BTN_BLUE, saving)} disabled={saving}>
            {saving ? 'Changing…' : 'Change email'}
          </button>
        </div>
        <p style={{ margin: 0, paddingTop: '0.55rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Their hours, pay and jobs stay with them. Only the address changes.</p>
      </form>
    </div>
  )
}
