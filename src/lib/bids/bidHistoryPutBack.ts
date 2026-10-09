/**
 * Bid history, Put back (punch list #73, PR 4). In the History window, every changed value on the
 * open bid has **Put back**: one press writes the value it had before that change, through
 * `put_back_bid_change`, which runs under the presser's own policies (the owner, 2026-10-08: anyone
 * who can edit the bid may Put back). The ledger records the put back as their change, tagged
 * `put-back`, so it can itself be put back. A removed row comes back another way (PR 5, below):
 * the owner, 2026-10-09, lets a bid's editors see the bid's own removed rows and put them back.
 *
 * Pure: which line offers Put back, and the words around it.
 */
import { bidHistoryColumnName, bidHistoryValueWords, type BidHistoryRow } from './bidHistory'

/** Tells the open bid's tabs that a value was put back, so they read the bid again. */
export const BID_HISTORY_PUT_BACK_EVENT = 'bid-history-put-back'
export type BidHistoryPutBackDetail = { bidId: string; table: string }

export type BidPutBackTarget = {
  changeId: number
  column: string
  /** What goes back, in words: "Lav-1 price", "Bid due". */
  what: string
  /** The value it goes back to, in words: "$9,800". */
  value: string
}

/**
 * What a line's Put back writes, or null when the line offers none: a removal or an addition, a
 * row from the delete archive, or a row of a bid adopted into this one (put that back on its bid).
 */
export function bidPutBackTarget(row: BidHistoryRow, column: string | null | undefined, openBidId: string): BidPutBackTarget | null {
  if (!column || row.source !== 'ledger' || row.op !== 'update' || row.id == null) return null
  if (row.bidId !== openBidId || !row.changed.includes(column)) return null
  const subject = row.table === 'bids' ? 'Bid' : row.label?.trim() || 'The row'
  return { changeId: row.id, column, what: `${subject} ${bidHistoryColumnName(column)}`, value: bidHistoryValueWords(column, row.oldValues?.[column]) }
}

/** The button's name for a screen reader: "Put back Lav-1 price to $9,800". */
export function bidPutBackLabel(target: BidPutBackTarget): string {
  return `Put back ${target.what} to ${target.value}`
}

/** `put_back_bid_change`'s answer. */
export type BidPutBackResult = {
  table: string
  record_id: string
  label: string | null
  columns: string[]
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

/** The line after a put back: "Lav-1 price is $9,800 again.", or "… was already $9,800." when nothing moved. */
export function bidPutBackDoneWords(target: BidPutBackTarget, result: BidPutBackResult): string {
  const same = JSON.stringify(result.before?.[target.column] ?? null) === JSON.stringify(result.after?.[target.column] ?? null)
  return same ? `${target.what} was already ${target.value}.` : `${target.what} is ${target.value} again.`
}

/**
 * The line when a put back fails. The function's own refusals are already sentences ("That row
 * was removed since. Put the row back first."); a missing function means the update has not
 * reached the database yet.
 */
export function bidPutBackFailWords(message: string): string {
  const m = message.trim()
  if (/could not find the function|(put_back_bid_change|restore_bid_removed_row).*does not exist/i.test(m)) return 'Put back is not ready yet. Try again after the next update.'
  if (/^(That|Only|Another|What|You|Its) .*\.$/.test(m)) return m
  return `It was not put back: ${m}`
}

// ---------------------------------------------------------------------------
// A removed row (PR 5). `list_bid_removed_rows` reads the bid's own removed rows from the delete
// archive for whoever can edit the bid; `restore_bid_removed_row` puts one back with what was
// removed with it (a count row's prices, part lines and ticks), as the presser's put back.
// ---------------------------------------------------------------------------

/** One of the bid's removed rows still out, as the window uses it. */
export type BidRemovedRow = {
  archiveId: string
  table: string
  recordId: string
  countRowId: string | null
  label: string | null
  oldValues: Record<string, unknown> | null
  changed: string[]
  changedBy: string | null
  changedByName: string | null
  changedAt: string
  /** The ledger holds this removal too, so its line is the ledger's. */
  inLedger: boolean
}

/** `list_bid_removed_rows`' row as PostgREST returns it. */
export type BidRemovedRpcRow = {
  archive_id: string
  table_name: string
  record_id: string
  count_row_id: string | null
  label: string | null
  old_values: unknown
  changed: string[] | null
  changed_by: string | null
  changed_by_name: string | null
  changed_at: string
  in_ledger: boolean | null
}

export function bidRemovedRowFromRpc(r: BidRemovedRpcRow): BidRemovedRow {
  const old = r.old_values && typeof r.old_values === 'object' && !Array.isArray(r.old_values) ? (r.old_values as Record<string, unknown>) : null
  return {
    archiveId: r.archive_id,
    table: r.table_name,
    recordId: r.record_id,
    countRowId: r.count_row_id,
    label: r.label,
    oldValues: old,
    changed: r.changed ?? [],
    changedBy: r.changed_by,
    changedByName: r.changed_by_name,
    changedAt: r.changed_at,
    inLedger: r.in_ledger === true,
  }
}

/** A removal's key: the ledger's delete and the archive's row of one delete share the table, the row and the transaction's time. */
export function bidRemovalKey(table: string, recordId: string, at: string): string {
  return `${table}:${recordId}:${Date.parse(at)}`
}

/**
 * The bid's removed rows laid over its history. A removal the ledger holds keeps its ledger line
 * and gains the archive row to put back (`restorable`). One from before the ledger joins as an
 * archive line, as a dev already reads it. While older pages remain unread, an archive line older
 * than the oldest row read waits for them, so it never lands out of order.
 */
export function mergeBidRemovedRows(
  rows: ReadonlyArray<BidHistoryRow>,
  removed: ReadonlyArray<BidRemovedRow>,
  bid: { id: string; bidNumber: string | null },
  more: boolean,
): { rows: BidHistoryRow[]; restorable: ReadonlyMap<string, string> } {
  const restorable = new Map<string, string>()
  const have = new Set(rows.flatMap((r) => (r.source === 'archive' && r.archiveId ? [r.archiveId] : [])))
  const oldest = rows.length > 0 ? Math.min(...rows.map((r) => Date.parse(r.changedAt))) : Number.POSITIVE_INFINITY
  const added: BidHistoryRow[] = []
  for (const x of removed) {
    restorable.set(bidRemovalKey(x.table, x.recordId, x.changedAt), x.archiveId)
    if (x.inLedger || have.has(x.archiveId)) continue
    if (more && Date.parse(x.changedAt) < oldest) continue
    added.push({
      source: 'archive',
      id: null,
      archiveId: x.archiveId,
      bidId: bid.id,
      bidNumber: bid.bidNumber,
      table: x.table,
      recordId: x.recordId,
      countRowId: x.countRowId,
      op: 'delete',
      changed: x.changed,
      oldValues: x.oldValues,
      newValues: null,
      label: x.label,
      changedBy: x.changedBy,
      changedByName: x.changedByName,
      changedAt: x.changedAt,
      action: null,
      byApp: null,
    })
  }
  if (added.length === 0) return { rows: [...rows], restorable }
  // Newest first, as the read orders them; a stable sort keeps rows of one moment in their order.
  return { rows: [...rows, ...added].sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt)), restorable }
}

export type BidRemovedPutBackTarget = {
  archiveId: string
  /** What comes back, in words: "SUMP", "The removed row". */
  what: string
}

/**
 * What a removal's Put back brings back, or null when it offers none: not a removal, another bid's
 * row, the bid itself (a dev's Recently deleted), a removal with no archive row still out, or a
 * row whose count row was removed in the same action (that count row's Put back brings it back).
 */
export function bidRemovedPutBackTarget(
  row: BidHistoryRow,
  openBidId: string,
  restorable: ReadonlyMap<string, string>,
  countRowsRemovedWith: ReadonlySet<string> = new Set(),
): BidRemovedPutBackTarget | null {
  if (row.op !== 'delete' || row.bidId !== openBidId || row.table === 'bids') return null
  if (row.table !== 'bids_count_rows' && row.countRowId && countRowsRemovedWith.has(row.countRowId)) return null
  const archiveId = row.source === 'archive' ? row.archiveId : (restorable.get(bidRemovalKey(row.table, row.recordId, row.changedAt)) ?? null)
  if (!archiveId) return null
  return { archiveId, what: row.label?.trim() || 'The removed row' }
}

/** The button's name for a screen reader: "Put back SUMP". */
export function bidRemovedPutBackLabel(target: BidRemovedPutBackTarget): string {
  return `Put back ${target.what}`
}

/** `restore_bid_removed_row`'s answer. */
export type BidRestoreResult = {
  ok: boolean
  bid_id: string
  restored: number
  tables: Record<string, number>
  /** A reference to a row that is gone, cleared on the way back. */
  warnings: string[]
}

/** The line after a removed row is put back: "SUMP is back, with 3 rows that hung on it." */
export function bidRestoreDoneWords(target: BidRemovedPutBackTarget, result: BidRestoreResult): string {
  const withIt = Math.max(0, (result.restored ?? 1) - 1)
  const back = withIt > 0 ? `${target.what} is back, with ${withIt} ${withIt === 1 ? 'row' : 'rows'} that hung on it.` : `${target.what} is back.`
  const cleared = result.warnings?.length ?? 0
  if (cleared === 0) return back
  return cleared === 1 ? `${back} One field pointed at a row that is gone, so it is empty now.` : `${back} ${cleared} fields pointed at rows that are gone, so they are empty now.`
}
