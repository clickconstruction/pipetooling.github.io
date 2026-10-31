/**
 * Punch list #207 PR 1: **Your signature on an email**, a card on Settings → Your account for the office team, who send
 * from Messages. The name and the cell are read from the account (My Profile changes them); the title and the two free
 * lines are typed here and saved to `users.title` and `users.signature_lines` (`signatureIo.ts`); *As it goes* draws the
 * lines as the email carries them (`signatureLines`, with Click Construction on the company line; a Pipeline job's email
 * names the plumbing company instead). Before the lines' column lands the card still draws: the two boxes wait, the
 * title saves. The words and the rules are `lib/messages/signature.ts`.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { GC_OFFICE_TEAM } from '../../lib/gc/access'
import { signatureLines } from '../../lib/messages/compose'
import {
  SIGNATURE_LINE_MAX,
  SIGNATURE_WORDS,
  sameSignature,
  signatureDraftFrom,
  signatureDraftProblem,
  signatureKeptOf,
  type SignatureDraft,
} from '../../lib/messages/signature'
import { supabaseSignatureIo, type SignatureIo, type SignatureLoad } from '../../lib/messages/signatureIo'
import { GC_CUSTOMER_EMAIL_FROM_NAME } from '../../../supabase/functions/_shared/gcCustomerEmails'
import { formatErrorMessage } from '../../utils/errorHandling'

const W = SIGNATURE_WORDS

const card: CSSProperties = { marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }
const label: CSSProperties = { display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }
const box: CSSProperties = {
  width: '100%',
  maxWidth: 320,
  padding: '0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  boxSizing: 'border-box',
  background: 'var(--surface)',
  color: 'var(--text-base)',
  font: 'inherit',
}

export function SignatureCard({ role, userId: userIdProp, io: ioProp }: { role: UserRole | null | undefined; userId?: string; io?: SignatureIo }) {
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const userId = userIdProp ?? user?.id ?? null
  const office = Boolean(role) && GC_OFFICE_TEAM.includes(role!)
  const io = useMemo(() => ioProp ?? supabaseSignatureIo(), [ioProp])
  /** The row as read; undefined while it is read, null when the read failed. */
  const [loaded, setLoaded] = useState<SignatureLoad | null | undefined>(undefined)
  const [draft, setDraft] = useState<SignatureDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!office || !userId) return
    let live = true
    io.load(userId).then(
      (read) => {
        if (!live) return
        setLoaded(read)
        setDraft(signatureDraftFrom(read.kept))
      },
      (e: unknown) => {
        if (!live) return
        setLoaded(null)
        setProblem(formatErrorMessage(e, 'Your signature could not be read.'))
      },
    )
    return () => {
      live = false
    }
  }, [io, office, userId])

  if (!office || !userId) return null

  const bad = draft ? signatureDraftProblem(draft) : null
  const changed = Boolean(loaded && draft) && !sameSignature(signatureKeptOf(draft!), loaded!.kept)
  const preview = loaded && draft ? signatureLines({ ...loaded.sender, title: draft.title, lines: draft.lines }, { name: GC_CUSTOMER_EMAIL_FROM_NAME }) : []

  const save = async () => {
    if (!loaded || !draft || bad || !changed) return
    setBusy(true)
    setProblem(null)
    try {
      const kept = signatureKeptOf(draft)
      await io.save(userId, kept, loaded.linesOn)
      setLoaded({ ...loaded, kept, sender: { ...loaded.sender, title: kept.title, lines: kept.lines } })
      setDraft(signatureDraftFrom(kept))
      showToast(W.saved, 'success')
    } catch (e) {
      setProblem(formatErrorMessage(e, W.notSaved))
    } finally {
      setBusy(false)
    }
  }

  const setLine = (i: number, value: string) => {
    if (!draft) return
    setDraft({ ...draft, lines: draft.lines.map((l, j) => (j === i ? value : l)) })
  }

  return (
    <div id="settings-signature" data-signature-card style={card}>
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 600 }}>{W.title}</h2>
      <p style={{ ...muted, fontSize: '0.875rem', marginBottom: '0.75rem' }}>{W.lead}</p>
      {loaded === undefined && !problem && <p style={muted}>{W.loading}</p>}
      {loaded && draft && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <span style={label}>{W.name}</span>
            <span data-signature-name style={{ fontSize: '0.875rem' }}>{loaded.sender.name || '—'}</span> <span style={muted}>{W.fromAccount}</span>
          </div>
          <div>
            <span style={label}>{W.cell}</span>
            {loaded.sender.cell?.trim() ? (
              <>
                <span data-signature-cell style={{ fontSize: '0.875rem' }}>{loaded.sender.cell.trim()}</span> <span style={muted}>{W.fromAccount}</span>
              </>
            ) : (
              <span style={muted}>{W.noCell}</span>
            )}
          </div>
          <div>
            <label htmlFor="signature-title" style={label}>
              {W.jobTitle}
            </label>
            <input
              id="signature-title"
              type="text"
              value={draft.title}
              placeholder={W.titleHint}
              maxLength={SIGNATURE_LINE_MAX}
              disabled={busy}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              style={box}
            />
          </div>
          <div>
            <span id="signature-lines-label" style={label}>
              {W.lines}
            </span>
            <div role="group" aria-labelledby="signature-lines-label" style={{ display: 'grid', gap: '0.4rem' }}>
              {draft.lines.map((line, i) => (
                <input
                  key={i}
                  type="text"
                  aria-label={i === 0 ? W.line1 : W.line2}
                  value={line}
                  placeholder={W.lineHint}
                  maxLength={SIGNATURE_LINE_MAX}
                  disabled={busy || !loaded.linesOn}
                  onChange={(e) => setLine(i, e.target.value)}
                  style={{ ...box, ...(loaded.linesOn ? null : { background: 'var(--bg-muted)', cursor: 'not-allowed' }) }}
                />
              ))}
            </div>
            {!loaded.linesOn && (
              <p data-signature-lines-wait style={{ ...muted, marginTop: '0.35rem' }}>
                {W.linesWait}
              </p>
            )}
          </div>
          <div>
            <span style={label}>{W.preview}</span>
            <pre
              data-signature-preview
              style={{ margin: 0, maxWidth: 320, fontFamily: 'inherit', fontSize: '0.875rem', lineHeight: 1.4, whiteSpace: 'pre-wrap', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.7rem', background: 'var(--bg-subtle)', color: 'var(--text-base)' }}
            >
              {preview.join('\n')}
            </pre>
            <p style={{ ...muted, marginTop: '0.35rem' }}>{W.previewNote}</p>
          </div>
          {(bad || problem) && (
            <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
              {bad ?? problem}
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!changed || !!bad || busy}
              style={{
                padding: '0.5rem 1rem',
                background: changed && !bad ? '#2563eb' : 'var(--surface)',
                color: changed && !bad ? 'white' : 'var(--text-muted)',
                border: changed && !bad ? 'none' : '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: changed && !bad && !busy ? 'pointer' : 'default',
                fontWeight: 500,
              }}
            >
              {busy ? 'Saving…' : W.save}
            </button>
          </div>
        </div>
      )}
      {loaded === null && problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
          {problem}
        </div>
      )}
    </div>
  )
}
