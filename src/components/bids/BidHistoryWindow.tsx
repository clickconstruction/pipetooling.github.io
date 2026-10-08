import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import {
  BID_HISTORY_TABS,
  bidHistoryAuthors,
  bidHistoryByDay,
  bidHistoryLines,
  bidHistoryTabOf,
  bidHistoryTime,
  filterBidHistory,
  groupBidHistory,
  type BidHistoryAction,
  type BidHistoryRow,
  type BidHistoryTab,
} from '../../lib/bids/bidHistory'
import { loadBidHistory } from '../../lib/bids/loadBidHistory'

const chip = (on: boolean): CSSProperties => ({
  padding: '0.25rem 0.6rem',
  minHeight: 32,
  borderRadius: 999,
  border: on ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  color: 'var(--text-strong)',
  fontSize: '0.78rem',
  fontWeight: on ? 600 : 400,
  cursor: 'pointer',
})

const currentTime = () => new Date()

/**
 * Bid history, the window (punch list #73, PR 2): everything that happened on the bid, newest
 * first, one line per action (an import of 23 rows is one line), each opening to its rows.
 * Filters by tab and by person, and a search over names and values. Read only: Put back is PR 4.
 * A bid adopted into this one shows its history too, each action marked with its bid number.
 */
export function BidHistoryWindow({
  bid,
  onClose,
  initialSearch = '',
  load = loadBidHistory,
  now = currentTime,
}: {
  bid: { id: string; label: string; bidNumber: string | null }
  onClose: () => void
  /** Opens searched on a row's name ("+N more" under a cell). */
  initialSearch?: string
  /** The read; a test stands one in. */
  load?: (bidId: string) => Promise<BidHistoryRow[]>
  now?: () => Date
}) {
  const [rows, setRows] = useState<BidHistoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<BidHistoryTab | null>(null)
  const [whoId, setWhoId] = useState<string | null | 'app'>(null)
  const [search, setSearch] = useState(initialSearch)
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    load(bid.id).then(
      (r) => { if (!cancelled) setRows(r) },
      (e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) },
    )
    return () => { cancelled = true }
  }, [bid.id, load])

  const actions = useMemo(() => groupBidHistory(rows ?? []), [rows])
  const shown = useMemo(() => filterBidHistory(actions, { tab, whoId, search }), [actions, tab, whoId, search])
  const days = useMemo(() => bidHistoryByDay(shown, now()), [shown, now])
  const authors = useMemo(() => bidHistoryAuthors(actions), [actions])
  const tabsPresent = useMemo(() => BID_HISTORY_TABS.filter((t) => actions.some((a) => a.rows.some((r) => bidHistoryTabOf(r) === t.key))), [actions])
  const otherBids = useMemo(() => new Set((rows ?? []).filter((r) => r.bidId !== bid.id).map((r) => r.bidNumber ?? 'an adopted bid')), [rows, bid.id])
  const firstLedger = useMemo(() => (rows ?? []).filter((r) => r.source === 'ledger').map((r) => r.changedAt).sort()[0] ?? null, [rows])
  const hasArchive = (rows ?? []).some((r) => r.source === 'archive')

  const toggle = (key: string) => setOpen((cur) => {
    const next = new Set(cur)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const tabLabel = (key: BidHistoryTab) => BID_HISTORY_TABS.find((t) => t.key === key)?.label ?? key

  const actionView = (a: BidHistoryAction) => {
    const lines = a.rows.flatMap(bidHistoryLines)
    const isOpen = open.has(a.key) || lines.length === 1
    return (
      <li key={a.key} style={{ padding: '0.55rem 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '0.875rem', flex: '1 1 14rem', minWidth: 0, overflowWrap: 'anywhere' }}>{a.caption}</strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{bidHistoryTime(a.endedAt)}</span>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {a.who} · {tabLabel(a.tab)}
          {otherBids.size > 0 ? ` · ${a.bidNumber ?? 'this bid'}` : ''}
          {a.fromArchive ? ' · from the delete archive' : ''}
        </div>
        {lines.length > 1 ? (
          <button
            type="button"
            onClick={() => toggle(a.key)}
            aria-expanded={isOpen}
            style={{ marginTop: '0.25rem', padding: 0, minHeight: 28, border: 'none', background: 'none', color: 'var(--text-link)', fontSize: '0.78rem', cursor: 'pointer' }}
          >
            {isOpen ? 'Hide the rows' : `Show the ${lines.length} rows`}
          </button>
        ) : null}
        {isOpen ? (
          <ul style={{ listStyle: 'none', margin: '0.25rem 0 0', padding: '0 0 0 0.75rem', display: 'grid', gap: '0.15rem' }}>
            {lines.map((l) => (
              <li key={l.key} style={{ fontSize: '0.8125rem', overflowWrap: 'anywhere' }}>
                <span style={{ fontWeight: 600 }}>{l.subject}</span> · {l.detail}
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    )
  }

  return (
    <ResponsiveModalShell title={`History · ${bid.label}`} onRequestClose={onClose} maxWidthDesktop={720} fullScreenKey="bid-history">
      {error ? (
        <p role="alert" style={{ color: 'var(--text-red-700)', margin: 0 }}>The history could not be read: {error}</p>
      ) : rows === null ? (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {actions.length === 0
              ? 'Nothing has changed on this bid since its history began.'
              : `${actions.length} ${actions.length === 1 ? 'change' : 'changes'} by ${authors.length} ${authors.length === 1 ? 'author' : 'authors'}.`}
            {otherBids.size > 0 ? ` Includes ${[...otherBids].join(', ')}, adopted into this bid.` : ''}
          </p>
          {actions.length > 0 ? (
            <>
              <div role="group" aria-label="Show changes on" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <button type="button" style={chip(tab === null)} aria-pressed={tab === null} onClick={() => setTab(null)}>All</button>
                {tabsPresent.map((t) => (
                  <button key={t.key} type="button" style={chip(tab === t.key)} aria-pressed={tab === t.key} onClick={() => setTab(tab === t.key ? null : t.key)}>{t.label}</button>
                ))}
              </div>
              {authors.length > 1 ? (
                <div role="group" aria-label="Show changes by" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button type="button" style={chip(whoId === null)} aria-pressed={whoId === null} onClick={() => setWhoId(null)}>Everyone</button>
                  {authors.map((a) => (
                    <button key={a.whoId} type="button" style={chip(whoId === a.whoId)} aria-pressed={whoId === a.whoId} onClick={() => setWhoId(whoId === a.whoId ? null : a.whoId)}>{a.who}</button>
                  ))}
                </div>
              ) : null}
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a fixture or a value"
                aria-label="Find a fixture or a value"
                style={{ padding: '0.45rem 0.6rem', minHeight: 40, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', fontSize: '0.875rem' }}
              />
              {days.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No change matches.</p>
              ) : (
                days.map((d) => (
                  <section key={d.day} aria-label={d.day}>
                    <h4 style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-700)' }}>{d.day}</h4>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{d.actions.map(actionView)}</ul>
                  </section>
                ))
              )}
            </>
          ) : null}
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            {firstLedger ? `History starts ${new Date(firstLedger).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} for this bid. ` : 'History starts the day the ledger was switched on. '}
            {hasArchive ? 'Rows marked from the delete archive were removed before that and are kept for 90 days.' : ''}
          </p>
        </div>
      )}
    </ResponsiveModalShell>
  )
}
