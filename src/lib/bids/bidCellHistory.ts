/**
 * Bid history, under the cells (punch list #73, PR 3). With the past shown, the four values people
 * type on a bid (a price, a count, a takeoff quantity or price, a labor row's hours) show up to
 * two earlier values under the box, newest first, in a soft line: "$9,800 · Ann · Tue". A cell
 * with no past shows nothing, so most rows stay one line tall. "+N more" says there is more in
 * the History window.
 *
 * A row with no past of its own borrows its name's: after Clear all and a re-import, Lav-1 is a
 * new row with a new id, so its cell shows the value the earlier Lav-1 row had when it was
 * removed, marked as such ("an earlier Lav-1 row · $9,800 · removed Wed").
 *
 * Reads `latest_bid_cell_history` (the last two values per cell, and each removed row's last).
 * Pure: no IO; the clock is passed in.
 */
import { APP_CALENDAR_TZ, denverCalendarDayKey } from '../../utils/dateUtils'
import { bidHistoryValueWords } from './bidHistory'

/** The RPC's row as PostgREST returns it. */
export type BidCellHistoryRpcRow = {
  cell_key: string
  name_key: string | null
  kind: string
  /** The column the value is worded by ('unit_price' for both price sources). */
  column_name: string
  label: string | null
  value: unknown
  changed_by_name: string | null
  changed_at: string
  rank: number
  total: number
}

export type BidCellPastValue = { value: unknown; who: string; at: string; column: string }

export type BidCellHistoryIndex = {
  /** cell key → the last two earlier values (newest first) and the count of changes. */
  byCell: Map<string, { values: BidCellPastValue[]; total: number }>
  /** name key → the newest removed row's value under that name. */
  removedByName: Map<string, BidCellPastValue & { label: string }>
}

// The keys, built the way `latest_bid_cell_history` builds them.
const lower = (s: string) => s.trim().toLowerCase()
/** A Workbench price: the count row and the pricing (either source of the typed price). */
export const priceCellKeys = (countRowId: string, pricingId: string | null | undefined, label?: string | null) => ({
  cellKey: `price:${countRowId}:${pricingId ?? ''}`,
  nameKey: label?.trim() ? `price:${pricingId ?? ''}:${lower(label)}` : null,
})
/** A count: the count row, and its version for an earlier row of the same name. */
export const countCellKeys = (countRowId: string, versionId: string | null | undefined, label?: string | null) => ({
  cellKey: `count:${countRowId}`,
  nameKey: label?.trim() ? `count:${versionId ?? ''}:${lower(label)}` : null,
})
/** A takeoff line's quantity or unit price (no name fallback: one part sits on many count rows). */
export const takeoffCellKeys = (lineId: string, column: 'quantity' | 'unit_price') => ({ cellKey: `takeoff:${lineId}:${column}`, nameKey: null })
/** A labor row's stage hours. */
export const laborCellKeys = (laborRowId: string, column: string, label?: string | null) => ({
  cellKey: `labor:${laborRowId}:${column}`,
  nameKey: label?.trim() ? `labor:${lower(label)}:${column}` : null,
})

export function buildBidCellHistoryIndex(rows: ReadonlyArray<BidCellHistoryRpcRow>): BidCellHistoryIndex {
  const byCell: BidCellHistoryIndex['byCell'] = new Map()
  const removedByName: BidCellHistoryIndex['removedByName'] = new Map()
  for (const r of [...rows].sort((a, b) => a.rank - b.rank)) {
    const past = { value: r.value, who: r.changed_by_name?.trim() || 'someone', at: r.changed_at, column: r.column_name }
    if (r.kind === 'changed') {
      const cur = byCell.get(r.cell_key) ?? { values: [], total: r.total }
      cur.values.push(past)
      byCell.set(r.cell_key, cur)
    } else if (r.kind === 'removed' && r.name_key && r.label?.trim()) {
      const cur = removedByName.get(r.name_key)
      if (!cur || cur.at < r.changed_at) removedByName.set(r.name_key, { ...past, label: r.label.trim() })
    }
  }
  return { byCell, removedByName }
}

/** A day in a few letters: the weekday within the week, else "Sep 29". */
export function bidCellDay(iso: string, now: Date): string {
  const days = (Date.parse(`${denverCalendarDayKey(now.getTime())}T12:00:00Z`) - Date.parse(`${denverCalendarDayKey(Date.parse(iso))}T12:00:00Z`)) / 86_400_000
  if (days === 0) return 'today'
  if (days < 7) return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: APP_CALENDAR_TZ })
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })
}

export type BidCellPast = {
  /** At most two lines, newest first. */
  lines: string[]
  /** Changes beyond the lines shown ("+N more"). */
  more: number
  /** True when the lines are an earlier row's under the same name, not this row's own. */
  borrowed: boolean
}

/**
 * What a cell shows under its box: its own last two earlier values, else the value an earlier row
 * of the same name had when it was removed, else nothing.
 */
export function bidCellPast(index: BidCellHistoryIndex, keys: { cellKey: string; nameKey: string | null }, now: Date): BidCellPast | null {
  const own = index.byCell.get(keys.cellKey)
  if (own && own.values.length > 0) {
    const lines = own.values.slice(0, 2).map((p) => `${bidHistoryValueWords(p.column, p.value)} · ${p.who} · ${bidCellDay(p.at, now)}`)
    return { lines, more: Math.max(0, own.total - lines.length), borrowed: false }
  }
  const earlier = keys.nameKey ? index.removedByName.get(keys.nameKey) : undefined
  if (!earlier) return null
  return {
    lines: [`an earlier ${earlier.label} row · ${bidHistoryValueWords(earlier.column, earlier.value)} · removed ${bidCellDay(earlier.at, now)}`],
    more: 0,
    borrowed: true,
  }
}
