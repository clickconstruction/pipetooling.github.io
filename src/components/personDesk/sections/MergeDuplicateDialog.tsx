import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Database } from '../../../types/database'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { eligibleAbsorbCandidates, eligibleExternalAbsorbCandidates, ineligibleAbsorbCandidates, type ExternalPersonCandidate, type MergeCandidateAccount } from '../../../lib/mergeUserAccounts'
import { previewAccountMerge, previewExternalMerge, runAccountMerge, runExternalMerge, type MergePreview } from '../../../lib/people/accountMerge'
import { BTN_QUIET, BTN_RED, DESK_EDITOR_Z, deskBtn } from '../personDeskShared'

type Account = MergeCandidateAccount & { name: string | null; email: string | null }
type Person = ExternalPersonCandidate

const EXTERNAL = 'external:'

/**
 * Merge a duplicate… (Account on the desk, PR D1): fold another account, or a subcontractor's
 * roster row with no login, into the person whose desk this is. The person here is always the
 * one kept. The list offers only what the rules allow and says why the rest is left out; a
 * preview shows what would move before anything does.
 */
export function MergeDuplicateDialog({ survivor, onClose, onMerged }: { survivor: Account; onClose: () => void; onMerged: () => void }) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [pick, setPick] = useState('')
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const name = (survivor.name || survivor.email || 'them').trim()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error: e } = await supabase
        .from('users')
        .select('id, name, email, role, archived_at, last_sign_in_at, is_sample, is_digital_twin')
        .eq('role', (survivor.role ?? '') as Database['public']['Enums']['user_role'])
        .order('name')
      if (cancelled) return
      if (e) {
        setError(e.message)
        setAccounts([])
        return
      }
      setAccounts(((data ?? []) as Array<Account & { is_sample?: boolean | null; is_digital_twin?: boolean | null }>).filter((a) => !a.is_sample && !a.is_digital_twin))
      if (survivor.role === 'subcontractor') {
        const { data: p } = await supabase.from('people').select('id, name, kind, account_user_id, archived_at').eq('kind', 'sub').is('archived_at', null).is('account_user_id', null).order('name')
        if (!cancelled) setPeople((p ?? []) as Person[])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [survivor.role])

  const eligible = useMemo(() => eligibleAbsorbCandidates(survivor, accounts ?? []), [survivor, accounts])
  const leftOut = useMemo(() => ineligibleAbsorbCandidates(survivor, accounts ?? []), [survivor, accounts])
  const externals = useMemo(() => eligibleExternalAbsorbCandidates(survivor, people), [survivor, people])

  const pickedAccount = eligible.find((a) => a.id === pick) ?? null
  const pickedPerson = pick.startsWith(EXTERNAL) ? (externals.find((p) => p.id === pick.slice(EXTERNAL.length)) ?? null) : null
  const pickedName = pickedAccount ? (pickedAccount.name || pickedAccount.email || 'that account') : (pickedPerson?.name ?? '')

  async function doPreview() {
    setError(null)
    setBusy(true)
    try {
      if (pickedAccount) setPreview(await previewAccountMerge(supabase, { survivorId: survivor.id, absorbedId: pickedAccount.id }))
      else if (pickedPerson) setPreview(await previewExternalMerge(supabase, { survivor, person: { id: pickedPerson.id, name: pickedPerson.name } }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  async function doMerge() {
    const ok = await confirmDialog({ message: `Merge ${pickedName} into ${name}? This cannot be undone.`, confirmLabel: 'Merge now', danger: true })
    if (!ok) return
    setError(null)
    setBusy(true)
    try {
      if (pickedAccount) {
        await runAccountMerge(supabase, { survivorId: survivor.id, absorbedId: pickedAccount.id })
        showToast(`${pickedName} merged into ${name}.`, 'success')
      } else if (pickedPerson) {
        showToast(await runExternalMerge(supabase, { survivor, person: { id: pickedPerson.id, name: pickedPerson.name } }), 'success')
      }
      onMerged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed')
    } finally {
      setBusy(false)
    }
  }

  const accountLabel = (a: Account) => `${a.name || a.email}${a.email && a.name ? ` (${a.email})` : ''} · ${a.archived_at ? 'archived' : 'never signed in'}`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: DESK_EDITOR_Z, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Merge a duplicate into ${name}`} style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(480px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: '1rem 1.1rem', boxShadow: '0 16px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.8125rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-strong)' }}>Merge a duplicate into {name}</h2>
        <p style={{ margin: 0, color: 'var(--text-700)' }}>{name} is kept. Everything the duplicate owns moves onto them, and the duplicate stays archived.</p>
        {accounts == null ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Reading the accounts…</p>
        ) : (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontWeight: 600, color: 'var(--text-700)' }}>
            The duplicate
            <select
              value={pick}
              disabled={busy}
              onChange={(e) => {
                setPick(e.target.value)
                setPreview(null)
                setError(null)
              }}
              style={{ fontSize: '0.875rem', padding: '0.35rem 0.4rem', fontFamily: 'inherit', fontWeight: 400 }}
            >
              <option value="">{eligible.length + externals.length === 0 ? 'Nothing can be merged into them' : 'Pick the duplicate…'}</option>
              {eligible.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)}
                </option>
              ))}
              {externals.map((p) => (
                <option key={p.id} value={`${EXTERNAL}${p.id}`}>
                  {p.name} · roster row, no login
                </option>
              ))}
            </select>
          </label>
        )}
        {leftOut.length > 0 ? (
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--text-link)' }}>Why isn't an account listed?</summary>
            <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem', color: 'var(--text-700)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {leftOut.map(({ account, reason }) => (
                <li key={account.id}>
                  <strong style={{ fontWeight: 600 }}>{account.name || account.email}</strong>: {reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {preview ? (
          <div aria-label="What would move" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.65rem', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <strong style={{ fontSize: '0.78125rem' }}>What would move</strong>
            {Object.keys(preview.moved).length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>No rows move.</span>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {Object.entries(preview.moved).map(([table, n]) => (
                  <li key={table}>
                    {table.replace(/_/g, ' ')}: {n}
                  </li>
                ))}
              </ul>
            )}
            {preview.warnings.map((w) => (
              <span key={w} style={{ color: 'var(--text-amber-800)' }}>
                {w}
              </span>
            ))}
          </div>
        ) : null}
        {error ? (
          <p role="alert" style={{ margin: 0, color: 'var(--text-red-600)' }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <button type="button" style={BTN_QUIET} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          {preview ? (
            <button type="button" style={deskBtn(BTN_RED, busy)} disabled={busy} onClick={() => void doMerge()}>
              {busy ? 'Merging…' : `Merge into ${name}`}
            </button>
          ) : (
            <button type="button" style={deskBtn(BTN_QUIET, busy || !pick)} disabled={busy || !pick} onClick={() => void doPreview()}>
              {busy ? 'Reading…' : 'Preview merge'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
