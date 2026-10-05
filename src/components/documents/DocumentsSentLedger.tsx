import { useEffect, useMemo, useState } from 'react'
import { type SentCopy, type SentKindGroup, SENT_KIND_GROUPS, sentCopyLines } from '../../lib/sent/sentCopies'
import { loadSentCopies } from '../../lib/sent/sentCopiesIo'
import { documentsQuietButton } from '../jobs/jobDocumentsStyles'
import { SentCopyRows } from './SentCopyRows'

/**
 * Documents → Sent (v2.4561): everything the company sent, newest first, each with the copy as
 * it went. A job's own sends are also on its Documents tab; this is where a paper that names no
 * job is found — a statement to a GC, a price request to a supply house, a bid letter. Pick a
 * kind, or type a name, an address or a subject.
 */

/** Rows read per step; "Show more" reads the next step. */
const STEP = 100

export function DocumentsSentLedger() {
  const [group, setGroup] = useState<SentKindGroup | 'all'>('all')
  const [typed, setTyped] = useState('')
  const [asked, setAsked] = useState('')
  const [limit, setLimit] = useState(STEP)
  const [rows, setRows] = useState<SentCopy[] | null>(null)

  // What was typed is asked for once the typing rests, so each key is not a read.
  useEffect(() => {
    const t = window.setTimeout(() => setAsked(typed), 300)
    return () => window.clearTimeout(t)
  }, [typed])

  useEffect(() => {
    let cancelled = false
    void loadSentCopies({ group, typed: asked, limit }).then((list) => {
      if (!cancelled) setRows(list)
    })
    return () => {
      cancelled = true
    }
  }, [group, asked, limit])

  const lines = useMemo(() => sentCopyLines(rows ?? []), [rows])
  const narrowed = group !== 'all' || asked.trim().length >= 2

  return (
    <section aria-label="Sent" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <input
        type="search"
        value={typed}
        onChange={(ev) => {
          setTyped(ev.target.value)
          setLimit(STEP)
        }}
        placeholder="Find a copy: a name, an address, a subject"
        aria-label="Find a copy"
        style={{ width: '100%', padding: '0.5rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', boxSizing: 'border-box' }}
      />
      <div role="group" aria-label="Kind of paper" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        {SENT_KIND_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            aria-pressed={group === g.key}
            onClick={() => {
              setGroup(g.key)
              setLimit(STEP)
            }}
            style={{ ...documentsQuietButton, borderRadius: 999, ...(group === g.key ? { background: 'var(--bg-blue-tint)', border: '1px solid #3b82f6', color: 'var(--text-blue-700)', fontWeight: 600 } : {}) }}
          >
            {g.label}
          </button>
        ))}
      </div>
      {rows == null ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : lines.length === 0 ? (
        <p data-testid="documents-sent-empty" style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {narrowed ? 'No copy matches. Try another kind or fewer words.' : 'No copy is on file yet. A copy is kept each time something is printed or sent to someone.'}
        </p>
      ) : (
        <>
          <SentCopyRows lines={lines} rowTestId="documents-sent-row" />
          {rows.length >= limit ? (
            <div>
              <button type="button" style={documentsQuietButton} onClick={() => setLimit((n) => n + STEP)}>
                Show more
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

export default DocumentsSentLedger
