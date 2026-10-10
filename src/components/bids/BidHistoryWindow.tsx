import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import {
  BID_HISTORY_PAGE,
  BID_HISTORY_TABS,
  bidHistoryAuthors,
  bidHistoryByDay,
  bidHistoryLines,
  bidHistoryTabOf,
  bidHistoryTime,
  bidHistoryWholeActions,
  filterBidHistory,
  groupBidHistory,
  type BidHistoryAction,
  type BidHistoryRow,
  type BidHistoryTab,
} from '../../lib/bids/bidHistory'
import { loadBidHistory, loadBidRemovedRows, loadBidUndoUnseen, loadCanEditBid, putBackBidChange, removeBidAddedRows, restoreBidRemovedRow } from '../../lib/bids/loadBidHistory'
import {
  BID_HISTORY_PUT_BACK_EVENT,
  bidPutBackDoneWords,
  bidPutBackFailWords,
  bidPutBackLabel,
  bidPutBackTarget,
  bidRemovedPutBackLabel,
  bidRemovedPutBackTarget,
  bidRestoreDoneWords,
  mergeBidRemovedRows,
  type BidHistoryPutBackDetail,
  type BidPutBackResult,
  type BidPutBackTarget,
  type BidRemovedPutBackTarget,
  type BidRemovedRow,
  type BidRestoreResult,
} from '../../lib/bids/bidHistoryPutBack'
import {
  BID_UNDO_UNSEEN_UNREAD,
  bidUndoDoneWords,
  bidUndoGateUnseen,
  bidUndoLabel,
  bidUndoPlan,
  bidUndoRemovedCountRows,
  bidUndoTitle,
  runBidUndo,
  type BidUndoPlan,
  type BidUndoUnseen,
} from '../../lib/bids/bidHistoryUndo'

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

/** One row once, though a page read after a new change may repeat the row at its edge. */
const dedupeRows = (rows: ReadonlyArray<BidHistoryRow>): BidHistoryRow[] => {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const k = `${r.source}-${r.id ?? r.archiveId}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Bid history, the window (punch list #73, PR 2): everything that happened on the bid, newest
 * first, one line per action (an import of 23 rows is one line), each opening to its rows.
 * Filters by tab and by person, and a search over names and values. A bid adopted into this one
 * shows its history too, each action marked with its bid number. Every changed value on this bid
 * has **Put back** (PR 4): the value goes back, the history reads again, and the open bid's tabs
 * hear `BID_HISTORY_PUT_BACK_EVENT` and read the bid again. For someone who can edit the bid, each
 * of its own removed rows has **Put back** too (PR 5): the row comes back with what was removed
 * with it, and its removals from before the ledger show beside the rest. And each action of
 * several changes has **Undo** (PR 6): the whole action taken back in one press, newest change
 * first, or a line that says why it cannot be.
 */
export function BidHistoryWindow({
  bid,
  onClose,
  initialSearch = '',
  load = loadBidHistory,
  putBack = putBackBidChange,
  loadRemoved = loadBidRemovedRows,
  restoreRemoved = restoreBidRemovedRow,
  loadCanEdit = loadCanEditBid,
  removeAdded = removeBidAddedRows,
  loadUnseen = loadBidUndoUnseen,
  now = currentTime,
}: {
  bid: { id: string; label: string; bidNumber: string | null }
  onClose: () => void
  /** Opens searched on a row's name ("+N more" under a cell). */
  initialSearch?: string
  /** One page of the read, from row `from`; a test stands one in. */
  load?: (bidId: string, from: number) => Promise<BidHistoryRow[]>
  /** The put back (one column, or with null every column the change touched); a test stands one in. */
  putBack?: (changeId: number, column: string | null) => Promise<BidPutBackResult>
  /** The bid's own removed rows, for someone who can edit it (none otherwise); a test stands one in. */
  loadRemoved?: (bidId: string) => Promise<BidRemovedRow[]>
  /** A removed row's put back; a test stands one in. */
  restoreRemoved?: (archiveId: string) => Promise<BidRestoreResult>
  /** Whether the person can edit the bid: Undo is offered only then. A test stands one in. */
  loadCanEdit?: (bidId: string) => Promise<boolean>
  /** Undo's removal of rows an action added; resolves how many went. A test stands one in. */
  removeAdded?: (table: string, ids: ReadonlyArray<string>) => Promise<number>
  /** What hangs on count rows outside the ledger, read before Undo removes any. A test stands one in. */
  loadUnseen?: (countRowIds: ReadonlyArray<string>) => Promise<Map<string, BidUndoUnseen>>
  now?: () => Date
}) {
  const [rows, setRows] = useState<BidHistoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<BidHistoryTab | null>(null)
  const [whoId, setWhoId] = useState<string | null | 'app'>(null)
  const [search, setSearch] = useState(initialSearch)
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  // Put back: the line being written, and the word under the line last pressed.
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<{ lineKey: string; text: string; ok: boolean } | null>(null)
  // A removed row's put back or an Undo: what happened, said at the top, since its line can leave the list.
  const [topNote, setTopNote] = useState<{ text: string; ok: boolean } | null>(null)
  const [removed, setRemoved] = useState<BidRemovedRow[]>([])
  const [canEdit, setCanEdit] = useState(false)
  // What hangs outside the ledger on the count rows the Undo plans would remove, keyed by those ids.
  const [unseen, setUnseen] = useState<{ key: string; read: Map<string, BidUndoUnseen> | 'failed' } | null>(null)
  // Read again after a put back, keeping the list on screen (and where it was scrolled) meanwhile.
  const [readNo, setReadNo] = useState(0)
  // The read comes a page at a time (PostgREST's 1,000-row cap): how many rows were read, and
  // whether a full last page says there are older ones.
  const [readCount, setReadCount] = useState(0)
  const [more, setMore] = useState(false)
  const [olderBusy, setOlderBusy] = useState(false)
  const readCountRef = useRef(0)
  readCountRef.current = readCount

  useEffect(() => {
    let cancelled = false
    loadCanEdit(bid.id).then((yes) => { if (!cancelled) setCanEdit(yes) }, () => { if (!cancelled) setCanEdit(false) })
    return () => { cancelled = true }
  }, [bid.id, loadCanEdit])

  useEffect(() => {
    let cancelled = false
    if (readNo === 0) {
      setRows(null)
      setError(null)
    }
    const apply = (got: BidHistoryRow[], full: boolean) => {
      if (cancelled) return
      setRows(dedupeRows(got))
      setReadCount(got.length)
      setMore(full)
    }
    const fail = (e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) }
    // The bid's own removed rows, read beside the history every time; a failed read leaves them out.
    loadRemoved(bid.id).then((got) => { if (!cancelled) setRemoved(got) }, () => { if (!cancelled) setRemoved([]) })
    if (readNo === 0) {
      // The first page.
      load(bid.id, 0).then((page) => apply(page, page.length >= BID_HISTORY_PAGE), fail)
    } else {
      // After a put back: as many pages as were already shown.
      const want = Math.max(1, readCountRef.current)
      void (async () => {
        const got: BidHistoryRow[] = []
        for (let from = 0; ; from += BID_HISTORY_PAGE) {
          const page = await load(bid.id, from)
          got.push(...page)
          if (page.length < BID_HISTORY_PAGE) return apply(got, false)
          if (got.length >= want) return apply(got, true)
        }
      })().catch(fail)
    }
    return () => { cancelled = true }
  }, [bid.id, load, loadRemoved, readNo])

  async function showOlder() {
    setOlderBusy(true)
    try {
      const page = await load(bid.id, readCount)
      setRows((cur) => dedupeRows([...(cur ?? []), ...page]))
      setReadCount((n) => n + page.length)
      setMore(page.length >= BID_HISTORY_PAGE)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOlderBusy(false)
    }
  }

  async function pressPutBack(lineKey: string, target: BidPutBackTarget) {
    setBusy(lineKey)
    setNote(null)
    try {
      const result = await putBack(target.changeId, target.column)
      setNote({ lineKey, text: bidPutBackDoneWords(target, result), ok: true })
      window.dispatchEvent(new CustomEvent<BidHistoryPutBackDetail>(BID_HISTORY_PUT_BACK_EVENT, { detail: { bidId: bid.id, table: result.table } }))
      setReadNo((n) => n + 1)
    } catch (e) {
      setNote({ lineKey, text: bidPutBackFailWords(e instanceof Error ? e.message : String(e)), ok: false })
    } finally {
      setBusy(null)
    }
  }

  async function pressRestore(lineKey: string, target: BidRemovedPutBackTarget, table: string) {
    setBusy(lineKey)
    setNote(null)
    setTopNote(null)
    try {
      const result = await restoreRemoved(target.archiveId)
      setTopNote({ text: bidRestoreDoneWords(target, result), ok: true })
      window.dispatchEvent(new CustomEvent<BidHistoryPutBackDetail>(BID_HISTORY_PUT_BACK_EVENT, { detail: { bidId: bid.id, table } }))
      setReadNo((n) => n + 1)
    } catch (e) {
      setTopNote({ text: bidPutBackFailWords(e instanceof Error ? e.message : String(e)), ok: false })
    } finally {
      setBusy(null)
    }
  }

  async function pressUndo(a: BidHistoryAction, plan: Extract<BidUndoPlan, { ready: true }>) {
    const busyKey = `undo-${a.key}`
    setBusy(busyKey)
    setNote(null)
    setTopNote(null)
    try {
      // What hangs on its count rows outside the ledger, read again: a tick made since the window opened stops it.
      const ids = bidUndoRemovedCountRows(plan)
      if (ids.length > 0) {
        let gate: BidUndoPlan | null
        try {
          gate = bidUndoGateUnseen(plan, await loadUnseen(ids))
        } catch {
          gate = { ready: false, reason: BID_UNDO_UNSEEN_UNREAD }
        }
        if (!gate?.ready) {
          setTopNote({ text: gate?.reason ?? BID_UNDO_UNSEEN_UNREAD, ok: false })
          setUnseen(null)
          return
        }
      }
      const outcome = await runBidUndo(plan, { putBack, restore: restoreRemoved, remove: removeAdded })
      setTopNote(bidUndoDoneWords(a, outcome))
      if (outcome.done > 0) {
        // One word to the open bid's tabs: the bid itself when Undo touched it, else a version (its ★
        // moves the book the tab shows), else what it touched first.
        const table = outcome.tables.includes('bids') ? 'bids' : outcome.tables.includes('bid_versions') ? 'bid_versions' : outcome.tables[0]!
        window.dispatchEvent(new CustomEvent<BidHistoryPutBackDetail>(BID_HISTORY_PUT_BACK_EVENT, { detail: { bidId: bid.id, table } }))
        setReadNo((n) => n + 1)
      }
    } finally {
      setBusy(null)
    }
  }

  // The removed rows laid over the history (PR 5), then the actions. While older rows remain, the
  // action cut at the page's edge waits for them (bidHistoryWholeActions).
  const merged = useMemo(() => mergeBidRemovedRows(rows ?? [], removed, { id: bid.id, bidNumber: bid.bidNumber }, more), [rows, removed, bid.id, bid.bidNumber, more])
  const actions = useMemo(() => bidHistoryWholeActions(groupBidHistory(merged.rows), more), [merged, more])
  const shown = useMemo(() => filterBidHistory(actions, { tab, whoId, search }), [actions, tab, whoId, search])
  const days = useMemo(() => bidHistoryByDay(shown, now()), [shown, now])
  const authors = useMemo(() => bidHistoryAuthors(actions), [actions])
  const tabsPresent = useMemo(() => BID_HISTORY_TABS.filter((t) => actions.some((a) => a.rows.some((r) => bidHistoryTabOf(r) === t.key))), [actions])
  const otherBids = useMemo(() => new Set((rows ?? []).filter((r) => r.bidId !== bid.id).map((r) => r.bidNumber ?? 'an adopted bid')), [rows, bid.id])
  const firstLedger = useMemo(() => (rows ?? []).filter((r) => r.source === 'ledger').map((r) => r.changedAt).sort()[0] ?? null, [rows])
  const hasArchive = merged.rows.some((r) => r.source === 'archive')
  // Undo for each action, for someone who can edit the bid (PR 6).
  const rawUndoPlans = useMemo(() => {
    const out = new Map<string, BidUndoPlan>()
    if (!canEdit) return out
    for (const a of actions) {
      const plan = bidUndoPlan(a, { openBidId: bid.id, restorable: merged.restorable, history: merged.rows })
      if (plan) out.set(a.key, plan)
    }
    return out
  }, [canEdit, actions, bid.id, merged])
  // The count rows those plans would remove, whose hangers outside the ledger are read before Undo is offered.
  const unseenKey = useMemo(() => [...new Set([...rawUndoPlans.values()].flatMap(bidUndoRemovedCountRows))].sort().join(','), [rawUndoPlans])
  useEffect(() => {
    if (!unseenKey || unseen?.key === unseenKey) return
    let cancelled = false
    loadUnseen(unseenKey.split(',')).then(
      (read) => { if (!cancelled) setUnseen({ key: unseenKey, read }) },
      () => { if (!cancelled) setUnseen({ key: unseenKey, read: 'failed' }) },
    )
    return () => { cancelled = true }
  }, [unseenKey, unseen?.key, loadUnseen])
  const undoPlans = useMemo(() => {
    const read = unseen?.key === unseenKey ? unseen.read : null
    const out = new Map<string, BidUndoPlan>()
    for (const [k, plan] of rawUndoPlans) {
      const gated = bidUndoGateUnseen(plan, read)
      if (gated) out.set(k, gated)
    }
    return out
  }, [rawUndoPlans, unseen, unseenKey])

  const toggle = (key: string) => setOpen((cur) => {
    const next = new Set(cur)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const tabLabel = (key: BidHistoryTab) => BID_HISTORY_TABS.find((t) => t.key === key)?.label ?? key

  const actionView = (a: BidHistoryAction) => {
    // A count row removed in this action brings back what hung on it, so those rows offer no Put back of their own.
    const countRowsRemoved = new Set(a.rows.filter((r) => r.op === 'delete' && r.table === 'bids_count_rows').map((r) => r.recordId))
    const lines = a.rows.flatMap((r) =>
      bidHistoryLines(r).map((l, i) => ({
        ...l,
        target: bidPutBackTarget(r, l.column, bid.id),
        restore: i === 0 ? bidRemovedPutBackTarget(r, bid.id, merged.restorable, countRowsRemoved) : null,
        table: r.table,
      })),
    )
    const isOpen = open.has(a.key) || lines.length === 1
    // A single line's own Put back is its undo; a line with none (a pick Edit Bid does not show) gets Undo.
    const undo = lines.length > 1 || !(lines[0]?.target || lines[0]?.restore) ? (undoPlans.get(a.key) ?? null) : null
    return (
      <li key={a.key} style={{ padding: '0.55rem 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '0.875rem', flex: '1 1 14rem', minWidth: 0, overflowWrap: 'anywhere' }}>{a.caption}</strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{bidHistoryTime(a.endedAt)}</span>
          {undo?.ready ? (
            <button
              type="button"
              onClick={() => void pressUndo(a, undo)}
              disabled={busy !== null}
              aria-label={bidUndoLabel(a)}
              title={bidUndoTitle(undo)}
              style={{ alignSelf: 'center', padding: '0 0.6rem', minHeight: 28, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.75rem', cursor: busy !== null ? 'default' : 'pointer' }}
            >
              {busy === `undo-${a.key}` ? 'Undoing…' : 'Undo'}
            </button>
          ) : null}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {a.who} · {tabLabel(a.tab)}
          {otherBids.size > 0 ? ` · ${a.bidNumber ?? 'this bid'}` : ''}
          {a.fromArchive ? ' · from the delete archive' : ''}
          {a.continues ? ' · continues in older changes' : ''}
        </div>
        {undo && !undo.ready ? <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', overflowWrap: 'anywhere' }}>{undo.reason}</div> : null}
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
                {l.target ? (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => void pressPutBack(l.key, l.target!)}
                      disabled={busy !== null}
                      aria-label={bidPutBackLabel(l.target)}
                      title={bidPutBackLabel(l.target)}
                      style={{ padding: '0 0.45rem', minHeight: 28, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.75rem', cursor: busy !== null ? 'default' : 'pointer', verticalAlign: 'middle' }}
                    >
                      {busy === l.key ? 'Putting back…' : 'Put back'}
                    </button>
                  </>
                ) : l.restore ? (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => void pressRestore(l.key, l.restore!, l.table)}
                      disabled={busy !== null}
                      aria-label={bidRemovedPutBackLabel(l.restore)}
                      title={bidRemovedPutBackLabel(l.restore)}
                      style={{ padding: '0 0.45rem', minHeight: 28, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.75rem', cursor: busy !== null ? 'default' : 'pointer', verticalAlign: 'middle' }}
                    >
                      {busy === l.key ? 'Putting back…' : 'Put back'}
                    </button>
                  </>
                ) : null}
                {note?.lineKey === l.key ? (
                  <div role={note.ok ? 'status' : 'alert'} style={{ fontSize: '0.75rem', color: note.ok ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{note.text}</div>
                ) : null}
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
          {topNote ? (
            <p role={topNote.ok ? 'status' : 'alert'} style={{ margin: 0, fontSize: '0.8125rem', color: topNote.ok ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{topNote.text}</p>
          ) : null}
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {actions.length === 0
              ? 'Nothing has changed on this bid since its history began.'
              : `${actions.length.toLocaleString('en-US')} ${actions.length === 1 ? 'change' : 'changes'}${more ? ' so far' : ''} by ${authors.length} ${authors.length === 1 ? 'author' : 'authors'}.`}
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
          {more ? (
            <button
              type="button"
              onClick={() => void showOlder()}
              disabled={olderBusy}
              style={{ justifySelf: 'start', padding: '0.35rem 0.8rem', minHeight: 40, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', cursor: olderBusy ? 'default' : 'pointer' }}
            >
              {olderBusy ? 'Reading older changes…' : 'Show older changes'}
            </button>
          ) : null}
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            {more ? 'Older changes are not shown yet. ' : firstLedger ? `History starts ${new Date(firstLedger).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} for this bid. ` : 'History starts the day the ledger was switched on. '}
            {hasArchive && !more ? 'Rows marked from the delete archive were removed before that and are kept for 90 days.' : ''}
          </p>
        </div>
      )}
    </ResponsiveModalShell>
  )
}
