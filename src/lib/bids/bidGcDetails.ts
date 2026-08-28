/**
 * Per-GC bid state (Per-GC Phase 4, docs/PER_GC_BID_PLAN.md): due date/time, submitted-to,
 * and ITB links live per (bid, GC) in `bid_gcs` — customer_id NULL = the bid's own GC.
 * `bids.bid_due_date`/`bid_due_time` derive from these (earliest OPEN due — a packet with a
 * send is no longer open) via the `recompute_bid_due` DB trigger; `deriveBidDue` is the pure
 * mirror of that rule for tests and client previews. Pure — no React, no DB.
 */

export type BidGcDetailsRow = {
  id: string
  bid_id: string
  /** NULL = the bid's own GC (same convention as bid_versions.customer_id). */
  customer_id: string | null
  due_date: string | null // YYYY-MM-DD
  due_time: string | null // HH:MM[:SS]
  submitted_to_name: string | null
  submitted_to_phone: string | null
  submitted_to_email: string | null
  itb_links: string[]
}

/** `itb_links` comes back as jsonb — keep only non-blank strings. */
export function normalizeItbLinks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
}

/**
 * The derived bid-level due (mirror of SQL `recompute_bid_due`): earliest due among GCs whose
 * packet has NO send (still open), else earliest due overall; null when no per-GC dues exist —
 * the caller must then leave the hand-set bid date alone. `sentGcKeys` holds the GC keys with
 * a send ('' = own GC, else the customer id).
 */
export function deriveBidDue(
  rows: ReadonlyArray<Pick<BidGcDetailsRow, 'customer_id' | 'due_date' | 'due_time'>>,
  sentGcKeys: ReadonlySet<string>,
): { dueDate: string; dueTime: string | null } | null {
  const withDue = rows.filter((r) => r.due_date != null)
  if (withDue.length === 0) return null
  const byEarliest = (a: (typeof withDue)[number], b: (typeof withDue)[number]) => {
    if (a.due_date !== b.due_date) return a.due_date! < b.due_date! ? -1 : 1
    if (a.due_time === b.due_time) return 0
    if (a.due_time == null) return 1
    if (b.due_time == null) return -1
    return a.due_time < b.due_time ? -1 : 1
  }
  const open = withDue.filter((r) => !sentGcKeys.has(r.customer_id ?? ''))
  const pool = open.length > 0 ? open : withDue
  const best = [...pool].sort(byEarliest)[0]!
  return { dueDate: best.due_date!, dueTime: best.due_time ?? null }
}

/** Collapsed one-line summary under a GC card; null when the row holds nothing yet. */
export function gcDetailsSummary(
  row: Pick<BidGcDetailsRow, 'due_date' | 'due_time' | 'submitted_to_name' | 'itb_links'> | null,
): string | null {
  if (!row) return null
  const parts: string[] = []
  if (row.due_date) {
    const [y, m, d] = row.due_date.split('-')
    void y
    const date = m && d ? `${Number(m)}/${Number(d)}` : row.due_date
    parts.push(`due ${date}${row.due_time ? ` ${formatDueTime(row.due_time)}` : ''}`)
  }
  if ((row.submitted_to_name ?? '').trim()) parts.push(`submitted to ${row.submitted_to_name!.trim()}`)
  const links = row.itb_links.length
  if (links > 0) parts.push(links === 1 ? '1 ITB link' : `${links} ITB links`)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** 'HH:MM[:SS]' → '2:00 PM'. Returns the input when it doesn't parse. */
export function formatDueTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return t
  let h = Number(m[1])
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 === 0 ? 12 : h % 12
  return `${h}:${m[2]} ${ampm}`
}
