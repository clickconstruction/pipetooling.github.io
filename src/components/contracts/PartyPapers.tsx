/**
 * The party's own page (punch list #403, step 4): the papers that are with a customer or a supply house, listed where
 * the party lives. A supply house's window draws them as a section (`PartyPapersSection`). The Customer page's
 * Agreements card draws them beside the job contracts (`PartyPapersList` over `usePartyPapers`), and an estimator, who
 * has no job contracts there, gets them as a card of their own (`PartyPapersCard`).
 *
 * Every kind and every state is listed: an agreement, a W-9, a certificate, and a paper that was made and never sent.
 * A signed paper's name opens its signed record, the window Documents → Agreements opens. Nothing here sends, changes
 * or removes a paper. The read is `lib/contracts/partyPapersIo.ts` under each table's own row security, and a read
 * that fails says so with Retry and never reads as an empty list. The rules are `lib/contracts/partyPapers.ts`.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import {
  PARTY_PAPERS_SEND_PAGE,
  PARTY_PAPER_TONE_COLORS,
  canReadPartyPapers,
  canSendPartyPapers,
  partyPaperCountWords,
  partyPaperLines,
  partyPapersEmptyWords,
  type PartyPaperRow,
  type PartyRecord,
} from '../../lib/contracts/partyPapers'
import { readPartyPapers } from '../../lib/contracts/partyPapersIo'
import { emptyWordsWithPress } from '../../lib/emptyWords'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

const PersonContractSignedRecordModal = lazy(() => import('./PersonContractSignedRecordModal').then((m) => ({ default: m.PersonContractSignedRecordModal })))

/** What a party's papers read as: the rows once read, the failure when the read did not land, and the way to read again. */
export type PartyPapersRead = { rows: PartyPaperRow[] | null; failure: OfflineRecoveryLastError | null; reading: boolean; retry: () => void }

/** Read a party's papers. `party` null reads nothing, for a reader the list is not for. */
export function usePartyPapers(party: PartyRecord | null): PartyPapersRead {
  const kind = party?.kind ?? null
  const id = party?.id ?? null
  const [rows, setRows] = useState<PartyPaperRow[] | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (!kind || !id) {
      setRows(null)
      setFailure(null)
      return
    }
    let cancelled = false
    setReading(true)
    void readPartyPapers({ kind, id })
      .then((read) => {
        if (cancelled) return
        setRows(read)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setFailure(recoveryFailureFromError(e, 'The papers did not read.'))
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind, id, tries])

  const retry = useCallback(() => setTries((n) => n + 1), [])
  return { rows, failure, reading, retry }
}

/** True while a read has nothing to show: not read yet, or read and empty, with no failure to say. */
export function partyPapersQuiet(read: PartyPapersRead): boolean {
  return read.failure == null && (read.rows == null || read.rows.length === 0)
}

const line: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.25rem 0.9rem',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: '0.5rem 0',
  borderBottom: '1px solid var(--border)',
}
const lineLeft: CSSProperties = { minWidth: 0, flex: '1 1 14rem' }
const lineRight: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }
const tag: CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'text-bottom',
  marginRight: '0.45rem',
  padding: '0.08rem 0.45rem',
  borderRadius: 999,
  fontSize: '0.7rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  background: 'var(--bg-teal-tint)',
  color: 'var(--text-teal-700)',
}
const nameText: CSSProperties = { fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.875rem', overflowWrap: 'anywhere' }
const subLine: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.1rem', overflowWrap: 'anywhere' }
const stateChip: CSSProperties = { padding: '0.08rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }
const dayText: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }
const quiet: CSSProperties = { margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }

function namePress(narrow: boolean): CSSProperties {
  return {
    ...nameText,
    display: 'inline-flex',
    alignItems: 'center',
    // A phone's press is 44px tall at least; a desk's line stays as tight as the words.
    minHeight: narrow ? 44 : undefined,
    padding: 0,
    border: 'none',
    background: 'none',
    color: 'var(--text-link)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  }
}

/**
 * The lines of a party's papers, from a read. `showEmpty` draws the empty list's words, for a place that always shows
 * the list. A place that hides when there is nothing leaves it off and asks `partyPapersQuiet` first.
 */
export function PartyPapersList({ read, canSend, surface, showEmpty = false }: { read: PartyPapersRead; canSend: boolean; surface: string; showEmpty?: boolean }) {
  const narrow = useNarrowViewport640()
  const [signedDocId, setSignedDocId] = useState<string | null>(null)
  const today = todayYmdInAppTz()
  const lines = useMemo(() => {
    const rows = read.rows ?? []
    return partyPaperLines(
      rows,
      rows.map((r) => r.party_contact_id).filter((id): id is string => id != null),
      today,
    )
  }, [read.rows, today])
  const empty = partyPapersEmptyWords(canSend)

  return (
    <div data-testid="party-papers">
      {read.failure ? <OfflineRetryPanel failure={read.failure} onRetry={read.retry} surface={surface} idempotent busy={read.reading} /> : null}
      {read.rows == null && !read.failure ? (
        <p style={quiet}>Loading…</p>
      ) : read.rows != null && lines.length === 0 ? (
        showEmpty ? (
          <div data-testid="party-papers-empty">
            <EmptyState compact {...(canSend ? emptyWordsWithPress(empty, { to: PARTY_PAPERS_SEND_PAGE.to }) : { main: empty.main, tail: empty.tail })} />
          </div>
        ) : null
      ) : read.rows != null ? (
        <>
          <p style={quiet} data-testid="party-papers-count">
            <ValueSentence text={partyPaperCountWords(lines.length)} />
          </p>
          <div>
            {lines.map((l) => {
              const colors = PARTY_PAPER_TONE_COLORS[l.state.tone]
              return (
                <div key={l.id} style={line} data-testid="party-paper-row">
                  <div style={lineLeft}>
                    <span style={tag}>{l.kind}</span>
                    {l.opens ? (
                      <button type="button" style={namePress(narrow)} onClick={() => setSignedDocId(l.id)}>
                        {l.name}
                      </button>
                    ) : (
                      <span style={nameText}>{l.name}</span>
                    )}
                    {l.signer ? <span style={subLine}>{l.signer}</span> : null}
                  </div>
                  <div style={lineRight}>
                    <span style={{ ...stateChip, background: colors.background, color: colors.color }}>{l.state.words}</span>
                    {l.day ? (
                      <span style={dayText}>
                        <ValueSentence text={l.day} />
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : null}
      {signedDocId != null ? (
        <Suspense fallback={null}>
          <PersonContractSignedRecordModal open onClose={() => setSignedDocId(null)} documentId={signedDocId} />
        </Suspense>
      ) : null}
    </div>
  )
}

/**
 * A supply house's window: its papers, as a section that is always there for the five roles who read one. An empty
 * list says where a paper is sent from. Every other role is drawn nothing, and nothing is read for them.
 */
export function PartyPapersSection({ party, heading = 'Papers' }: { party: PartyRecord; heading?: string }) {
  const { role } = useAuth()
  const reads = canReadPartyPapers(role)
  const read = usePartyPapers(reads ? party : null)
  if (!reads) return null
  return (
    <section aria-label={heading} data-testid="party-papers-section" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.15rem' }}>{heading}</div>
      <p style={{ ...quiet, marginBottom: '0.4rem' }}>The papers that are with this house or one of its contacts.</p>
      <PartyPapersList read={read} canSend={canSendPartyPapers(role)} surface={`party-papers-${party.kind}`} showEmpty />
    </section>
  )
}

/**
 * The Customer page, for a reader who has no Agreements card there: the papers that are with the customer, in a card
 * of the same name. Drawn only when there is a paper or a failed read to show, as the office's card is.
 */
export function PartyPapersCard({ party }: { party: PartyRecord }) {
  const { role } = useAuth()
  const reads = canReadPartyPapers(role)
  const read = usePartyPapers(reads ? party : null)
  if (!reads || partyPapersQuiet(read)) return null
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', marginBottom: 16 }} data-testid="party-papers-card">
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', padding: '9px 13px', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-strong)' }}>
        Agreements
        <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-muted)' }}>the papers that are with this customer</span>
      </div>
      <div style={{ padding: '6px 13px 10px' }}>
        <PartyPapersList read={read} canSend={canSendPartyPapers(role)} surface={`party-papers-${party.kind}`} />
      </div>
    </div>
  )
}
