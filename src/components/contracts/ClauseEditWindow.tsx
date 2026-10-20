import { useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { canApproveClause } from '../../lib/gc/access'
import { editClause, proposedToast, publishedToast, reachOfTold, type ClauseBook, type ClauseChange } from '../../lib/contracts/approval'
import { clauseLabel, tradeKey, type Clause, type ClauseScope } from '../../lib/contracts/assemble'
import { saveClauseChange, tellClauseApprovers } from '../../lib/contracts/clausesIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { ClauseField, ClauseWindow } from './ClauseWindow'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from './clauseStyles'

export type ClauseEditMode = 'new' | 'edit' | 'retire'

const capitalized = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Messages, cut 4c: a clause's window (the prototype's `editClause`, v1.178), for a new clause, an edit or a retire. Anyone
 * in the office uses it. A controller's or a dev's change publishes at once; anyone else's goes for approval. The kernel
 * checks the change first (`approval.ts` → `editClause`), so a refusal is in its words before anything is written; the
 * RPC checks again.
 */
export function ClauseEditWindow({
  mode,
  book,
  clause,
  trades,
  approvers,
  onClose,
  onSaved,
}: {
  mode: ClauseEditMode
  book: ClauseBook
  /** The clause to change or retire. Null for a new one. */
  clause: Clause | null
  /** The trades *Applies to* offers (`clauseRows.ts` → `tradeChoices`). */
  trades: readonly string[]
  approvers: readonly string[]
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useToastContext()
  const { user, profileName, role } = useAuth()
  const approver = canApproveClause(role)
  const [en, setEn] = useState(clause?.en ?? '')
  const [es, setEs] = useState(clause?.es ?? '')
  const [forEveryone, setForEveryone] = useState(!clause || clause.scope === 'all')
  const [picked, setPicked] = useState<string[]>(clause && clause.scope !== 'all' ? [...clause.scope] : [])
  const [another, setAnother] = useState('')
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const offered = useMemo(() => {
    const seen = new Set(trades.map(tradeKey))
    return [...trades, ...picked.filter((t) => !seen.has(tradeKey(t)))]
  }, [trades, picked])
  const isPicked = (t: string) => picked.some((p) => tradeKey(p) === tradeKey(t))
  const toggle = (t: string) => setPicked((now) => (isPicked(t) ? now.filter((p) => tradeKey(p) !== tradeKey(t)) : [...now, t]))
  const addAnother = () => {
    const t = another.trim().replace(/\s+/g, ' ')
    if (t && !isPicked(t)) setPicked((now) => [...now, t])
    setAnother('')
  }

  const label = clause ? clauseLabel(book.clauses, clause.id) : 'a new clause'
  const title = mode === 'new' ? `A new clause on ${book.paper.title}` : mode === 'retire' ? `Retire ${label} of ${book.paper.title}` : `${capitalized(label)} of ${book.paper.title}`
  const note =
    mode === 'retire'
      ? approver
        ? 'The next paper sent leaves it out. Signed copies keep it.'
        : 'A controller or a dev approves the retire first. Signed copies keep it.'
      : approver
        ? 'Your change goes out on the next paper sent. A paper already signed keeps the words it was signed with.'
        : 'A controller or a dev approves it before it goes out. A paper already signed keeps the words it was signed with.'
  const press = approver ? (mode === 'retire' ? 'Retire it' : 'Publish') : 'Send for approval'

  const change = (): ClauseChange => {
    if (mode === 'retire') return { kind: 'retire', clauseId: clause?.id ?? '' }
    const scope: ClauseScope = forEveryone ? 'all' : picked
    return mode === 'new' ? { kind: 'new', en, es, scope } : { kind: 'edit', clauseId: clause?.id ?? '', en, es, scope }
  }

  const save = async () => {
    const c = change()
    const checked = editClause(book, c, { userId: user?.id ?? '', name: profileName ?? '', role }, { at: new Date().toISOString(), why, approvers, newId: () => 'pending' })
    if (checked.kind === 'refused') {
      setProblem(checked.why)
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      const done = await saveClauseChange(book.paper.id, c, why.trim())
      // A change that waits: the approvers hear of it (messages-notify), and the toast says whom it reached and how.
      const told = done.state === 'proposed' ? await tellClauseApprovers([done.proposal_id]) : null
      showToast(
        done.state === 'published' ? publishedToast({ ...book.paper, revision: done.revision ?? book.paper.revision + 1 }, c.kind) : proposedToast(told?.names.length ? told.names : approvers, reachOfTold(told)),
        'success',
      )
      onSaved()
    } catch (e) {
      setProblem(formatErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ClauseWindow label={title} title={title} lede={book.paper.title} onClose={onClose}>
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
      {mode === 'retire' ? (
        <div data-clause-retiring style={{ fontSize: '0.9rem', borderLeft: '3px solid var(--border-strong)', paddingLeft: '0.6rem' }}>
          {clause?.en}
        </div>
      ) : (
        <>
          <ClauseField label="English">
            <textarea rows={3} value={en} onChange={(e) => setEn(e.target.value)} style={clauseInputStyle} />
          </ClauseField>
          <ClauseField label="Spanish" note="Empty shows the English on the Spanish page until it has one.">
            <textarea rows={3} value={es} onChange={(e) => setEs(e.target.value)} style={clauseInputStyle} />
          </ClauseField>
          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }}>
            <legend style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Applies to</legend>
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input type="radio" name="clause-scope" checked={forEveryone} onChange={() => setForEveryone(true)} /> Everyone
            </label>
            <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input type="radio" name="clause-scope" checked={!forEveryone} onChange={() => setForEveryone(false)} /> These trades only, on their exhibit
            </label>
            {!forEveryone && (
              <div style={{ display: 'grid', gap: '0.4rem', paddingLeft: '1.4rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {offered.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={isPicked(t)}
                      onClick={() => toggle(t)}
                      style={{ ...clauseButtonStyle, padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.8rem', ...(isPicked(t) ? { background: 'var(--bg-blue-tint)', borderColor: '#2563eb' } : {}) }}
                    >
                      {t}
                    </button>
                  ))}
                  {offered.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No trade is on a job yet. Add one below.</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input aria-label="Another trade" value={another} onChange={(e) => setAnother(e.target.value)} placeholder="Another trade" style={{ ...clauseInputStyle, width: 'auto', flex: 1 }} />
                  <button type="button" onClick={addAnother} style={clauseButtonStyle}>
                    Add
                  </button>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Name every trade it covers. A clause for Electrical is not on the Electrical, low voltage exhibit unless you pick both.</span>
              </div>
            )}
          </fieldset>
        </>
      )}
      <ClauseField label="Why">
        <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="For example: the insurer asked for it." style={clauseInputStyle} />
      </ClauseField>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{note}</p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={clauseButtonStyle}>
          Cancel
        </button>
        <button type="button" disabled={busy} onClick={() => void save()} style={clausePrimaryStyle}>
          {busy ? 'Saving…' : press}
        </button>
      </div>
    </ClauseWindow>
  )
}
