import { useEffect, useState } from 'react'
import { formatErrorMessage } from '../../../utils/errorHandling'
import type { Contact, ContactKind } from '../../../lib/contacts/kernel'
import type { RecordHit } from '../../../lib/messages/messagesIo'
import { Btn, input } from '../gcUi'
import type { MessagesWrites } from './messagesWrites'

const KINDS: ReadonlyArray<{ kind: Exclude<ContactKind, 'unknown'>; label: string }> = [
  { kind: 'customer', label: 'a customer' },
  { kind: 'trade', label: 'a trade partner' },
  { kind: 'arch', label: 'an architect' },
]

/**
 * Messages, cut 1's screens: *Who is this?*, for a number nobody has named (the prototype's `whoIsThis`). Find who it
 * is among the records the office already has, say what they are to us, and give their own name when the record is a
 * company's. The number then points at that person and keeps its thread; when that person already has a thread, the
 * two become one.
 */
export function WhoIsThisWindow({
  contact,
  writes,
  onNamed,
  onClose,
}: {
  contact: Contact
  writes: Pick<MessagesWrites, 'nameContact' | 'searchRecords'>
  /** The contact that holds the thread now: this one, or the person it joined. */
  onNamed: (contactId: string) => void
  onClose: () => void
}) {
  const [words, setWords] = useState('')
  const [hits, setHits] = useState<RecordHit[] | null>(null)
  const [picked, setPicked] = useState<RecordHit | null>(null)
  const [kind, setKind] = useState<Exclude<ContactKind, 'unknown'>>('trade')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const { searchRecords } = writes

  useEffect(() => {
    if (words.trim().length < 3) {
      setHits(null)
      return
    }
    let live = true
    const t = window.setTimeout(() => {
      searchRecords(words)
        .then((found) => live && setHits(found))
        .catch((e: unknown) => live && setProblem(formatErrorMessage(e, 'The records did not load.')))
    }, 250)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [words, searchRecords])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const isCompanyRow = picked?.record.table === 'customers' || picked?.record.table === 'gc_companies'
  const save = async () => {
    if (!picked) return
    setBusy(true)
    setProblem(null)
    try {
      const id = await writes.nameContact(contact.id, { record: picked.record, kind, name: isCompanyRow ? name : null })
      onNamed(id ?? contact.id)
    } catch (e) {
      setProblem(formatErrorMessage(e, 'The number was not named.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.35)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Who is this? ${contact.name}`}
        data-who-is-this={contact.id}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(520px, 100%)', maxHeight: 'min(90vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Who is this? {contact.name}</h2>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto', display: 'grid', gap: '0.7rem', fontSize: '0.875rem' }}>
          <div style={{ color: 'var(--text-muted)' }}>Find them among the people we already have. Their messages stay with them, and their next text lands on them.</div>
          {problem && (
            <div role="alert" style={{ color: 'var(--text-red-700)' }}>
              {problem}
            </div>
          )}
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Their name or their company</span>
            <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Three letters or more" style={input} autoFocus />
          </label>
          {hits && hits.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Nobody we have goes by that. Add them to the customer or the trade partner first.</div>}
          {hits && hits.length > 0 && (
            <div role="listbox" aria-label="The people we have" style={{ display: 'grid', gap: '0.25rem' }}>
              {hits.map((h) => {
                const on = picked?.record.id === h.record.id && picked.record.table === h.record.table
                return (
                  <button
                    key={`${h.record.table}:${h.record.id}`}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      setPicked(h)
                      setKind(h.kind)
                    }}
                    style={{ textAlign: 'left', border: `1px solid ${on ? 'var(--text-blue-500)' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', borderRadius: 8, padding: '0.4rem 0.6rem', cursor: 'pointer' }}
                  >
                    <strong>{h.label}</strong> <span style={{ color: 'var(--text-muted)' }}>{h.sub}</span>
                  </button>
                )
              })}
            </div>
          )}
          {picked && (
            <>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span>What they are to us</span>
                <select value={kind} onChange={(e) => setKind(e.target.value as Exclude<ContactKind, 'unknown'>)} style={{ ...input, maxWidth: '100%', minWidth: 0 }}>
                  {KINDS.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              {isCompanyRow && (
                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span>Their own name, when they are someone else at {picked.label}</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Leave it empty for the company's own person" style={input} />
                </label>
              )}
            </>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Btn onClick={onClose} kind="quiet">
              Not now
            </Btn>
            <Btn onClick={() => void save()} kind="primary" disabled={!picked || busy}>
              {busy ? 'Saving…' : 'This is who it is'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
