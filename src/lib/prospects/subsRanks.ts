/**
 * The board's pins (v2.5809, punch list #153, PR 3): a card dragged by hand holds its place at the
 * top of one trade's column, in the order the office drops them, over the flow the record sets.
 * `prospect_trade_ranks` keeps one row a company a trade (a pin at `rank_order`, dense 1..n among
 * the column's pins); no row means the card flows. This file turns the rows into the board's pins
 * and a drop into the rows to write. Pure.
 */
import { tradeKey } from './subsLane'

export interface RankRow {
  prospect_id: string
  trade: string
  rank_order: number
}

/** The pins by trade key, each a map of prospect id → rank. */
export function pinsByTrade(rows: readonly RankRow[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const key = tradeKey(r.trade)
    if (!key) continue
    let m = out.get(key)
    if (!m) {
      m = new Map()
      out.set(key, m)
    }
    m.set(r.prospect_id, r.rank_order)
  }
  return out
}

/** The column's pinned ids in rank order. */
export function pinnedIds(pins: ReadonlyMap<string, number> | undefined): string[] {
  if (!pins) return []
  return [...pins.entries()].sort((a, b) => a[1] - b[1]).map((e) => e[0])
}

/**
 * A drop: the dragged card becomes a pin at the place it was dropped among the pins, and a drop
 * below the pins puts it last among them, since pins sit first and the flow keeps its own order.
 * Returns the column's pins after the drop, top first.
 */
export function pinAfterDrop(pinned: readonly string[], draggedId: string, toIndex: number): string[] {
  const rest = pinned.filter((id) => id !== draggedId)
  const at = Math.max(0, Math.min(toIndex, rest.length))
  return [...rest.slice(0, at), draggedId, ...rest.slice(at)]
}

/** Let a card flow again. */
export function unpin(pinned: readonly string[], id: string): string[] {
  return pinned.filter((x) => x !== id)
}

/** The rows that make the column's pins read `next`: every pin upserted dense 1..n, every pin that left deleted. */
export function rankWrites(trade: string, next: readonly string[], was: ReadonlyMap<string, number> | undefined): { upserts: RankRow[]; deletes: string[] } {
  const upserts: RankRow[] = next.map((prospect_id, i) => ({ prospect_id, trade, rank_order: i + 1 }))
  const keep = new Set(next)
  const deletes = [...(was?.keys() ?? [])].filter((id) => !keep.has(id))
  return { upserts, deletes }
}

export const PIN_CHIP = 'pinned'
export const PIN_CHIP_TITLE = 'Dragged here by hand. Press to let it flow by its record again.'
export const DRAG_TITLE = 'Drag to pin this card at the top of the column'
