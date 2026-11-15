/**
 * GC difficulty rating (punch list #357, PR 4): the reads and writes of `bid_difficulty` and of the Other rows the
 * lines live in. The rows are written first and the pin after; a pin that fails leaves rows a person can see on the
 * Labor tab and take off by hand, never a pin that names rows that are not there. The tables are read by name until
 * the types are regenerated after the push.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { DifficultyLineStored } from './difficultyLines'
import type { BidDifficulty, BidDifficultyRemoved, DifficultyOtherRowInsert } from './bidDifficulty'

const PIN = 'bid_difficulty' as never
const ROWS = 'cost_estimate_other_rows'
const COLS = 'id, bid_id, cost_estimate_id, rating_id, criteria_version_id, price_version_id, picks, lines, row_ids, removed, points, total_usd, field_hours, labor_rate, own_cost_usd, carried_usd, priced_by_name, priced_at'

type RawPin = {
  id: string
  bid_id: string
  cost_estimate_id: string | null
  rating_id: string | null
  criteria_version_id: string | null
  price_version_id: string | null
  picks: unknown
  lines: unknown
  row_ids: unknown
  removed: unknown
  points: number
  total_usd: number | string
  field_hours: number | string
  labor_rate: number | string
  own_cost_usd: number | string
  carried_usd: number | string
  priced_by_name: string | null
  priced_at: string
}
type Result = { data: RawPin[] | null; error: unknown }

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

function linesFrom(raw: unknown): DifficultyLineStored[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((l): l is Record<string, unknown> => l != null && typeof l === 'object').map((l) => ({
    key: String(l.key ?? ''),
    name: String(l.name ?? ''),
    points: num(l.points),
    hours: num(l.hours),
    rate: num(l.rate),
    amount: num(l.amount),
    sentence: String(l.sentence ?? ''),
    words: String(l.words ?? ''),
  }))
}

function removedFrom(raw: unknown): BidDifficultyRemoved[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((r): r is Record<string, unknown> => r != null && typeof r === 'object').map((r) => ({
    key: String(r.key ?? ''),
    name: String(r.name ?? ''),
    amount: num(r.amount),
    reason: String(r.reason ?? ''),
    byName: String(r.byName ?? r.by_name ?? ''),
    at: String(r.at ?? ''),
  }))
}

export function bidDifficultyFromRow(raw: RawPin): BidDifficulty {
  const picks: Record<string, number> = {}
  if (raw.picks != null && typeof raw.picks === 'object' && !Array.isArray(raw.picks)) {
    for (const [k, v] of Object.entries(raw.picks as Record<string, unknown>)) if (typeof v === 'number') picks[k] = v
  }
  return {
    id: raw.id,
    bidId: raw.bid_id,
    costEstimateId: raw.cost_estimate_id,
    ratingId: raw.rating_id,
    criteriaVersionId: raw.criteria_version_id,
    priceVersionId: raw.price_version_id,
    picks,
    lines: linesFrom(raw.lines),
    rowIds: Array.isArray(raw.row_ids) ? raw.row_ids.filter((x): x is string => typeof x === 'string') : [],
    removed: removedFrom(raw.removed),
    points: num(raw.points),
    totalUsd: num(raw.total_usd),
    fieldHours: num(raw.field_hours),
    laborRate: num(raw.labor_rate),
    ownCostUsd: num(raw.own_cost_usd),
    carriedUsd: num(raw.carried_usd),
    pricedByName: raw.priced_by_name ?? '',
    pricedAt: raw.priced_at,
  }
}

export interface BidDifficultyIo {
  load(bidId: string): Promise<BidDifficulty | null>
  /** The pin by the estimate it wrote rows on, for the Labor tab's chips. */
  loadByCostEstimate(costEstimateId: string): Promise<BidDifficulty | null>
  /** Writes the rows, then the pin (an upsert on the bid). Resolves to the pin as stamped. */
  write(pin: Omit<BidDifficulty, 'id' | 'pricedByName' | 'pricedAt' | 'rowIds'>, rows: DifficultyOtherRowInsert[], oldRowIds: readonly string[]): Promise<BidDifficulty>
  /** Deletes one line's row and records it on the pin. */
  takeOff(pin: BidDifficulty, rowId: string | null, next: { lines: DifficultyLineStored[]; removed: BidDifficultyRemoved[]; points: number; totalUsd: number }): Promise<BidDifficulty>
}

export function supabaseBidDifficultyIo(): BidDifficultyIo {
  return {
    async load(bidId) {
      const result = (await supabase.from(PIN).select(COLS).eq('bid_id', bidId).limit(1)) as unknown as Result
      checkSupabaseError(result as never, 'read the bid’s difficulty lines')
      const row = result.data?.[0]
      return row ? bidDifficultyFromRow(row) : null
    },
    async loadByCostEstimate(costEstimateId) {
      const result = (await supabase.from(PIN).select(COLS).eq('cost_estimate_id', costEstimateId).limit(1)) as unknown as Result
      checkSupabaseError(result as never, 'read the bid’s difficulty lines')
      const row = result.data?.[0]
      return row ? bidDifficultyFromRow(row) : null
    },
    async write(pin, rows, oldRowIds) {
      if (oldRowIds.length > 0) {
        const gone = (await supabase.from(ROWS).delete().in('id', [...oldRowIds])) as unknown as { error: unknown }
        checkSupabaseError(gone as never, 'take the old difficulty lines off')
      }
      let rowIds: string[] = []
      if (rows.length > 0) {
        const inserted = (await supabase.from(ROWS).insert(rows as never).select('id')) as unknown as { data: { id: string }[] | null; error: unknown }
        checkSupabaseError(inserted as never, 'write the difficulty lines')
        rowIds = (inserted.data ?? []).map((r) => r.id)
      }
      const body = {
        bid_id: pin.bidId,
        cost_estimate_id: pin.costEstimateId,
        rating_id: pin.ratingId,
        criteria_version_id: pin.criteriaVersionId,
        price_version_id: pin.priceVersionId,
        picks: pin.picks,
        lines: pin.lines,
        row_ids: rowIds,
        removed: pin.removed,
        points: pin.points,
        total_usd: pin.totalUsd,
        field_hours: pin.fieldHours,
        labor_rate: pin.laborRate,
        own_cost_usd: pin.ownCostUsd,
        carried_usd: pin.carriedUsd,
      } as never
      const result = (await supabase.from(PIN).upsert(body, { onConflict: 'bid_id' } as never).select(COLS)) as unknown as Result
      checkSupabaseError(result as never, 'pin the difficulty lines on the bid')
      const row = result.data?.[0]
      if (!row) throw new Error('The lines were written but not pinned. Nothing came back.')
      return bidDifficultyFromRow(row)
    },
    async takeOff(pin, rowId, next) {
      if (rowId) {
        const gone = (await supabase.from(ROWS).delete().eq('id', rowId)) as unknown as { error: unknown }
        checkSupabaseError(gone as never, 'take the line off')
      }
      const patch = { lines: next.lines, removed: next.removed, points: next.points, total_usd: next.totalUsd, row_ids: pin.rowIds.filter((id) => id !== rowId) } as never
      const result = (await supabase.from(PIN).update(patch).eq('id', pin.id).select(COLS)) as unknown as Result
      checkSupabaseError(result as never, 'record the line taken off')
      const row = result.data?.[0]
      if (!row) throw new Error('The line is off, but the bid did not record it. Nothing came back.')
      return bidDifficultyFromRow(row)
    },
  }
}
