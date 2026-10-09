/**
 * The Division 22 window's Sections tab (v2.5058, the rules manager's read side — PR 3 of the train,
 * v2.5054–v2.5063). Every spec section with the rules filed under it and the names and
 * bids those rules decide (`sectionTallies`), the deliberate no-code rules last.
 *
 * Since v2.5061 (PR 4) it writes too: **Add a section**, **Rename** a title, and **Delete** a section that no rule
 * files names under. A section that still holds rules is refused, with the count in the words
 * (`sectionDeleteRefusal`): its rules would go with it, and a section restored together with its rules brings them
 * back with no code.
 */
import { useState, type CSSProperties } from 'react'

import {
  sectionDeleteRefusal,
  validateSectionDraft,
  type LedgerRule,
  type SectionDraft,
  type SectionTally,
} from '../../lib/specSectionRules'

type Props = {
  tallies: ReadonlyArray<SectionTally>
  /** The write side (v2.5061). */
  rules: ReadonlyArray<LedgerRule>
  /** Saves a new section. Resolves to an error message, or null when saved. */
  onAddSection: (draft: SectionDraft) => Promise<string | null>
  /** Saves a section's new title. Resolves to an error message, or null when saved. */
  onRenameSection: (code: string, title: string) => Promise<string | null>
  /** Deletes a section that holds no rules. Resolves to an error message, or null when deleted. */
  onDeleteSection: (code: string) => Promise<string | null>
}

const cell: CSSProperties = { padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', textAlign: 'left' }
const num: CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const head: CSSProperties = { ...cell, fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-subtle)' }
const field: CSSProperties = {
  padding: '0.3rem 0.45rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  font: 'inherit',
  fontSize: '0.8125rem',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
}
const smallButton: CSSProperties = {
  padding: '0.2rem 0.55rem',
  background: 'var(--bg-muted)',
  color: 'var(--text-strong)',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.75rem',
}
const saveButton: CSSProperties = { ...smallButton, background: '#16a34a', color: 'white', border: 'none', fontWeight: 600 }

export function SpecSectionSectionsTab({ tallies, rules, onAddSection, onRenameSection, onDeleteSection }: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<SectionDraft>({ code: '', title: '' })
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listed = tallies.filter((t): t is SectionTally & { code: string } => t.code != null).map((t) => ({ code: t.code }))
  const addProblems = validateSectionDraft(draft, listed)
  const renameProblems = renaming ? validateSectionDraft({ code: renaming, title: renameTitle }, listed, renaming) : []

  async function run(action: () => Promise<string | null>, done: () => void) {
    setBusy(true)
    const err = await action()
    setBusy(false)
    setError(err)
    if (!err) done()
  }

  function reset() {
    setAdding(false)
    setRenaming(null)
    setDeleting(null)
    setError(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {adding ? (
        <form
          aria-label="Add a section"
          onSubmit={(e) => {
            e.preventDefault()
            if (addProblems.length === 0 && !busy) {
              void run(
                () => onAddSection({ code: draft.code.trim(), title: draft.title.trim() }),
                () => {
                  setAdding(false)
                  setDraft({ code: '', title: '' })
                },
              )
            }
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', padding: '0.65rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)' }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input aria-label="Section number" placeholder="22 45 00" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} style={{ ...field, width: '8rem', fontFamily: 'ui-monospace, Menlo, monospace' }} />
            <input aria-label="Section title" placeholder="Emergency Plumbing Fixtures" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} style={{ ...field, flex: 1, minWidth: '12rem' }} />
            <button type="submit" disabled={addProblems.length > 0 || busy} style={{ ...saveButton, opacity: addProblems.length > 0 ? 0.5 : 1 }}>
              {busy ? 'Saving…' : 'Save section'}
            </button>
            <button type="button" onClick={reset} style={smallButton}>
              Cancel
            </button>
          </div>
          {(draft.code || draft.title ? addProblems : []).map((p) => (
            <span key={p.message} style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
              {p.message}
            </span>
          ))}
          {error ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</span> : null}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            reset()
            setAdding(true)
          }}
          style={{ ...smallButton, alignSelf: 'flex-start', fontSize: '0.8125rem', padding: '0.35rem 0.8rem' }}
        >
          Add a section
        </button>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', maxHeight: '56vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-strong)' }}>
          <thead>
            <tr>
              <th scope="col" style={head}>Section</th>
              <th scope="col" style={head}>Title</th>
              <th scope="col" style={{ ...head, textAlign: 'right' }}>Rules</th>
              <th scope="col" style={{ ...head, textAlign: 'right' }}>Names</th>
              <th scope="col" style={{ ...head, textAlign: 'right' }}>Bids</th>
              <th scope="col" style={head}>
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tallies.map((t) => {
              const quiet = t.rules === 0
              const color = quiet ? 'var(--text-muted)' : 'var(--text-strong)'
              const code = t.code
              const refusal = code != null && deleting === code ? sectionDeleteRefusal(code, rules) : null
              return [
                <tr key={code ?? 'no-code'}>
                  <td style={{ ...cell, color, fontFamily: 'ui-monospace, Menlo, monospace', whiteSpace: 'nowrap' }}>{code ?? '—'}</td>
                  <td style={{ ...cell, color }}>
                    {code != null && renaming === code ? (
                      <span style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <input aria-label={`New title for ${code}`} value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} style={{ ...field, flex: 1 }} />
                        <button
                          type="button"
                          disabled={renameProblems.length > 0 || busy}
                          onClick={() => void run(() => onRenameSection(code, renameTitle.trim()), () => setRenaming(null))}
                          style={{ ...saveButton, opacity: renameProblems.length > 0 ? 0.5 : 1 }}
                        >
                          Save
                        </button>
                        <button type="button" onClick={() => setRenaming(null)} style={smallButton}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      t.title
                    )}
                  </td>
                  <td style={{ ...num, color }}>{t.rules}</td>
                  <td style={{ ...num, color }}>{t.names}</td>
                  <td style={{ ...num, color }}>{t.bids}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    {code != null && renaming !== code ? (
                      <span style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          type="button"
                          aria-label={`Rename ${code}`}
                          onClick={() => {
                            reset()
                            setRenaming(code)
                            setRenameTitle(t.title)
                          }}
                          style={smallButton}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${code}`}
                          onClick={() => {
                            reset()
                            setDeleting(code)
                          }}
                          style={smallButton}
                        >
                          Delete
                        </button>
                      </span>
                    ) : null}
                  </td>
                </tr>,
                code != null && deleting === code ? (
                  <tr key={`${code}-delete`}>
                    <td colSpan={6} style={{ ...cell, background: 'var(--bg-yellow-tint)' }}>
                      {refusal ? (
                        <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span role="alert" style={{ color: 'var(--text-amber-700)' }}>
                            {refusal}
                          </span>
                          <button type="button" onClick={() => setDeleting(null)} style={smallButton}>
                            OK
                          </button>
                        </span>
                      ) : (
                        <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span>
                            Delete section {code} {t.title}? You can put it back for 90 days from Recently deleted.
                          </span>
                          <button type="button" disabled={busy} onClick={() => void run(() => onDeleteSection(code), () => setDeleting(null))} style={{ ...smallButton, background: '#dc2626', color: 'white', border: 'none', fontWeight: 600 }}>
                            {busy ? 'Deleting…' : 'Delete section'}
                          </button>
                          <button type="button" onClick={() => setDeleting(null)} style={smallButton}>
                            Keep it
                          </button>
                          {error ? <span style={{ color: 'var(--text-red-600)' }}>{error}</span> : null}
                        </span>
                      )}
                    </td>
                  </tr>
                ) : null,
              ]
            })}
          </tbody>
        </table>
      </div>
      {error && !adding && deleting == null ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</p> : null}
    </div>
  )
}
