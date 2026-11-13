import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { type SentCopy, type SentKindGroup, SENT_GROUP_COLORS, SENT_KIND_GROUPS, sentCopyLines } from '../../lib/sent/sentCopies'
import { sentCopyDayGroups, sentCopyTimeOnly } from '../../lib/sent/sentCopyDays'
import { EMPTY_ABOUT, sentCopyAbout, type SentCopyAboutMaps } from '../../lib/sent/sentCopyAbout'
import { loadSentCopyAbout, readSentCopies } from '../../lib/sent/sentCopiesIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { documentsQuietButton } from '../jobs/jobDocumentsStyles'
import { SentCopyRows } from './SentCopyRows'
import { Link } from 'react-router-dom'
import { BILLS_SENT_PATH } from '../../lib/billing/billsSent'

/**
 * Documents → Sent copies (v2.4573): everything the company sent, newest first, each with the copy as
 * it went. A job's own sends are also on its Documents tab; this is where a paper that names no
 * job is found — a statement to a GC, a price request to a supply house, a bid letter. Pick a
 * kind, or type a name, an address or a subject. Since the Documents spike of 2026-11-01 the lines
 * sit under one heading per day with the time alone on each, each names the job or the bid it is
 * for and its kind of paper, and a read that fails says so with Retry instead of reading as an
 * empty ledger.
 */

/** Rows read per step; "Show more" reads the next step. */
const STEP = 100

/** A day's band: strong words on a tinted bar that stays at the top while its rows scroll, so the days read apart. */
const dayHead: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  margin: '0.5rem 0 0',
  padding: '0.4rem 0.6rem',
  borderRadius: 6,
  background: 'var(--bg-subtle)',
  borderLeft: '3px solid var(--text-blue-700)',
  color: 'var(--text-strong)',
  fontSize: '0.875rem',
  fontWeight: 800,
}
const dayCount: CSSProperties = { marginLeft: '0.5rem', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8125rem' }

/** A kind chip in its group's colours (the owner's ask, 2026-11-01), the same pair the rows' tags wear; All stays plain. */
function kindChipStyle(key: SentKindGroup | 'all', pressed: boolean): CSSProperties {
  const base: CSSProperties = { ...documentsQuietButton, borderRadius: 999, fontWeight: pressed ? 700 : 500 }
  if (key === 'all') return pressed ? { ...base, background: 'var(--bg-blue-tint)', border: '1px solid #3b82f6', color: 'var(--text-blue-700)' } : base
  const c = SENT_GROUP_COLORS[key]
  return { ...base, background: c.background, color: c.color, border: `1px solid ${pressed ? c.color : 'transparent'}` }
}

export function DocumentsSentLedger() {
  const [group, setGroup] = useState<SentKindGroup | 'all'>('all')
  const [typed, setTyped] = useState('')
  const [asked, setAsked] = useState('')
  const [limit, setLimit] = useState(STEP)
  const [rows, setRows] = useState<SentCopy[] | null>(null)
  const [about, setAbout] = useState<SentCopyAboutMaps>(EMPTY_ABOUT)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [tries, setTries] = useState(0)

  // What was typed is asked for once the typing rests, so each key is not a read.
  useEffect(() => {
    const t = window.setTimeout(() => setAsked(typed), 300)
    return () => window.clearTimeout(t)
  }, [typed])

  useEffect(() => {
    let cancelled = false
    setReading(true)
    void readSentCopies({ group, typed: asked, limit })
      .then(async (list) => {
        if (cancelled) return
        setRows(list)
        setFailure(null)
        // The jobs' and bids' words, after the rows: the list draws first and the links fill in.
        const maps = await loadSentCopyAbout(list).catch(() => EMPTY_ABOUT)
        if (!cancelled) setAbout(maps)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setFailure(recoveryFailureFromError(e, 'The sent copies did not read.'))
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [group, asked, limit, tries])
  const retry = useCallback(() => setTries((n) => n + 1), [])

  const lines = useMemo(() => sentCopyLines(rows ?? []), [rows])
  const groups = useMemo(() => sentCopyDayGroups(lines, todayYmdInAppTz()), [lines])
  const aboutOf = useCallback((row: SentCopy) => sentCopyAbout(row, about), [about])
  const typedQuery = asked.trim().length >= 2 ? asked.trim() : ''
  const narrowed = group !== 'all' || typedQuery !== ''
  const clear = () => {
    setTyped('')
    setGroup('all')
    setLimit(STEP)
  }

  return (
    <section aria-label="Sent copies" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
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
            style={kindChipStyle(g.key, group === g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>
      {group === 'bills' ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }} data-testid="documents-sent-bills-door">
          See these with amounts, addresses and a total for each day on{' '}
          <Link to={BILLS_SENT_PATH} style={{ color: 'var(--text-link)', fontWeight: 600 }}>
            Bills sent
          </Link>
          .
        </p>
      ) : null}
      {failure ? <OfflineRetryPanel failure={failure} onRetry={retry} surface="documents-sent-copies" idempotent busy={reading} /> : null}
      {rows == null && !failure ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : rows != null && lines.length === 0 ? (
        <div data-testid="documents-sent-empty">
          {narrowed ? (
            <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'copies', query: typedQuery }), { onPress: clear })} />
          ) : (
            <EmptyState main="No copy is on file yet. A copy is kept each time something is printed or sent to someone." />
          )}
        </div>
      ) : rows != null ? (
        <>
          {groups.map((g) => (
            <Fragment key={g.ymd || 'no-date'}>
              <h3 style={dayHead} data-testid="documents-sent-day">
                {g.label}
                <span style={dayCount}>{g.lines.length === 1 ? '1 copy' : `${g.lines.length} copies`}</span>
              </h3>
              <SentCopyRows lines={g.lines} rowTestId="documents-sent-row" when={sentCopyTimeOnly} about={aboutOf} showKind />
            </Fragment>
          ))}
          {rows.length >= limit ? (
            <div>
              <button type="button" style={documentsQuietButton} onClick={() => setLimit((n) => n + STEP)}>
                Show more
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

export default DocumentsSentLedger
