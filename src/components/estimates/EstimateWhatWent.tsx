/**
 * What went (v2.5683, punch list #133 PR 2): the card on a sent estimate that keeps the receipt's facts — the email
 * with its time, each estimate-link text in the customer's thread with **Open the thread**, or why no text went. The
 * receipt closes; this card does not. Words in `lib/estimates/whatWent.ts`; reads in `whatWentIo.ts`.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { whatWentRows, WHAT_WENT_WORDS, type WhatWentFacts, type WhatWentRow } from '../../lib/estimates/whatWent'
import { loadWhatWent, type WhatWentRead } from '../../lib/estimates/whatWentIo'

const card: CSSProperties = { marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', fontSize: '0.875rem' }
const head: CSSProperties = { padding: '0.45rem 0.75rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontWeight: 600 }
const rowStyle: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'baseline', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }
const when: CSSProperties = { marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }

export interface EstimateWhatWentProps {
  customerId: string
  customerName: string | null
  /** `estimates.customer_email` as sent. */
  email: string | null
  /** `estimates.sent_at`. */
  sentAt: string | null
  /** `estimates.public_token_hash` (v2.5697): names the texts that carry this estimate's live link; none without it. */
  tokenHash: string | null
  /** The row (v2.5997): its letters sent again are read from the sent copies filed from it. */
  estimateId?: string | null
  /** Bumped after a send from this page, so the card reads again. */
  revision?: number
  io?: (customerId: string, sentAt: string | null, tokenHash: string | null, client?: unknown, estimateId?: string | null) => Promise<WhatWentRead>
}

export function EstimateWhatWent({ customerId, customerName, email, sentAt, tokenHash, estimateId = null, revision = 0, io = loadWhatWent }: EstimateWhatWentProps) {
  const [read, setRead] = useState<WhatWentRead | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    io(customerId, sentAt, tokenHash, undefined, estimateId)
      .then((r) => live && setRead(r))
      .catch(() => live && setRead(null))
    return () => {
      live = false
    }
  }, [io, customerId, sentAt, tokenHash, estimateId, revision])

  const sentAtMs = sentAt ? Date.parse(sentAt) : NaN
  // A thread read that failed still shows the email: the card never blocks on it.
  const facts: WhatWentFacts = {
    email,
    sentAtMs: Number.isNaN(sentAtMs) ? null : sentAtMs,
    texts: read?.texts ?? [],
    contact: read?.contact ?? null,
    emailsAgain: read?.emailsAgain ?? [],
  }
  const rows = whatWentRows(facts, customerName)
  return (
    <div style={card} data-testid="estimate-what-went">
      <div style={head}>{WHAT_WENT_WORDS.title}</div>
      {read === undefined ? (
        <p style={{ margin: 0, padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>{WHAT_WENT_WORDS.reading}</p>
      ) : (
        rows.map((r: WhatWentRow, i) => (
          <div key={`${r.words}-${i}`} style={i === rows.length - 1 ? { ...rowStyle, borderBottom: 'none' } : rowStyle} data-testid={r.hold ? 'what-went-hold' : 'what-went-row'}>
            <span aria-hidden>{r.icon}</span>
            <span style={r.hold ? { color: 'var(--text-amber-800)' } : undefined}>
              {r.words}
              {r.thread && read?.contact ? (
                <>
                  {' · '}
                  <Link to={`/messages?thread=${read.contact.contactId}`} data-testid="what-went-thread">
                    {WHAT_WENT_WORDS.thread}
                  </Link>
                </>
              ) : null}
            </span>
            {r.when ? <span style={when}>{r.when}</span> : null}
          </div>
        ))
      )}
    </div>
  )
}
