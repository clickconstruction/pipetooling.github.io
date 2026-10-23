import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { clearLienSignCode, lienSignCodeProblem, lienSignCodeStatus, setLienSignCode, type LienSignCodeStatus } from '../../lib/jobs/lienDeskSignIo'
import { lienSignatureWhen } from '../../lib/jobs/lienNoticeSignature'

// Your-account chrome, as the Dev MCP keys card: blue actions, the card's own border.
const CARD: CSSProperties = { marginTop: '1rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 1rem', background: 'var(--surface)' }
const CARD_TITLE: CSSProperties = { margin: '0 0 0.55rem', fontSize: '0.95rem', fontWeight: 700 }
const MUTED: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }
const BTN: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const BTN_PRIMARY: CSSProperties = { ...BTN, background: '#2563eb', color: '#fff', border: 'none' }
const LINK_BTN: CSSProperties = { font: 'inherit', fontSize: '0.8rem', background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer' }
const INPUT: CSSProperties = { font: 'inherit', fontSize: '1.05rem', letterSpacing: '0.25em', width: '7.5em', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)' }
const GUIDE_HREF = '/help?g=send-lien-notices-from-the-lien-desk'

/**
 * Settings → Your account → Your signing code (v2.5788, punch list #150, PR 1). A master or dev
 * sets a code only he knows, four to six digits; on the Lien desk he types it on anyone's screen
 * to put his name on a notice (PR 2). The database keeps a salted hash and checks the code itself
 * (`set_lien_sign_code`, `lien_sign_code_status`, `clear_lien_sign_code`); the card never sees
 * another person's code and never shows his own back. Client ahead of the migration: the card
 * says so instead of showing an error.
 */
export default function LienSignCodeCard() {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const userId = user?.id ?? null
  const [status, setStatus] = useState<LienSignCodeStatus | null | 'loading' | 'not_live'>('loading')
  const [code, setCode] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const s = await lienSignCodeStatus(userId)
      setStatus(s ?? 'not_live')
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
      setStatus(null)
    }
  }, [userId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const problem = lienSignCodeProblem(code, again)
  const ready = problem === null && code.length >= 4 && again === code
  const isSet = typeof status === 'object' && status !== null && status.set

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    try {
      await setLienSignCode(code)
      setCode('')
      setAgain('')
      showToast(isSet ? 'Your signing code is changed.' : 'Your signing code is set.', 'success')
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!(await confirmDialog({ message: 'Remove your signing code? Until you set a new one, you sign a notice from your own sign-in, or by hand on the office’s screen.' }))) return
    setBusy(true)
    try {
      await clearLienSignCode()
      showToast('Your signing code is removed.', 'success')
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  let stateLine: string
  if (status === 'loading') stateLine = 'Reading…'
  else if (status === 'not_live' || status === null) stateLine = ''
  else if (!status.set) stateLine = 'No code yet.'
  else {
    const set = status.setAtIso ? `Set ${lienSignatureWhen(status.setAtIso).day}` : 'Set'
    const used = status.lastUsedAtIso ? ` · last used ${lienSignatureWhen(status.lastUsedAtIso).day}` : ''
    const locked = status.lockedUntilIso ? ` · locked until ${lienSignatureWhen(status.lockedUntilIso).clock} after five wrong tries` : ''
    stateLine = `${set}${used}${locked}`
  }

  return (
    <section id="settings-lien-sign-code" style={CARD} aria-label="Your signing code">
      <h4 style={CARD_TITLE}>Your signing code</h4>
      <p style={{ ...MUTED, margin: '0 0 0.6rem' }}>
        A code only you know, four to six digits. On the Lien desk you type it on anyone’s screen to put your name on a notice. The app keeps a scrambled copy and checks the code itself; nobody can read it back, and five wrong tries lock it for fifteen minutes.{' '}
        <Link to={GUIDE_HREF}>How do I sign a lien notice?</Link>
      </p>
      {status === 'not_live' ? (
        <p style={MUTED}>Not switched on yet — the database side of this ships with the next migration push.</p>
      ) : (
        <>
          <p style={{ ...MUTED, margin: '0 0 0.5rem' }} data-lien-sign-code-state>
            {stateLine}
          </p>
          <form onSubmit={(e) => void save(e)} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {isSet ? 'New code' : 'Your code'}
              <input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4,6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label={isSet ? 'New code' : 'Your code'} style={INPUT} disabled={busy || status === 'loading'} />
            </label>
            <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Type it again
              <input type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4,6}" maxLength={6} value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, ''))} aria-label="Type it again" style={INPUT} disabled={busy || status === 'loading'} />
            </label>
            <button type="submit" disabled={!ready || busy} style={{ ...BTN_PRIMARY, opacity: !ready || busy ? 0.55 : 1, cursor: !ready || busy ? 'default' : 'pointer' }}>
              {isSet ? 'Change the code' : 'Set the code'}
            </button>
            {isSet ? (
              <button type="button" onClick={() => void remove()} disabled={busy} style={LINK_BTN}>
                Remove the code
              </button>
            ) : null}
          </form>
          <p style={{ ...MUTED, margin: '0.35rem 0 0', minHeight: '1.2em' }} data-lien-sign-code-problem>
            {problem ?? (code.length === 0 ? 'Digits only. Pick one you can type without looking.' : '')}
          </p>
        </>
      )}
    </section>
  )
}
