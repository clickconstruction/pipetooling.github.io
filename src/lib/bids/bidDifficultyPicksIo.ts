/**
 * GC difficulty rating (punch list #357, PR 6): the read and the one write of `bid_difficulty_picks`, the picks made
 * on a bid itself. The table is read by name until the types are regenerated after the push; a database without
 * it yet reads as no picks.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { DifficultyPicks } from './difficultyCriteria'
import type { BidDifficultyPicksRow } from './bidDifficultyPicks'

export const BID_DIFFICULTY_PICKS_CHANGED_EVENT = 'bid-difficulty-picks-changed'

const TABLE = 'bid_difficulty_picks' as never
const COLS = 'bid_id, criteria_version_id, picks, picked_by_name, picked_at'

type Raw = { bid_id: string; criteria_version_id: string; picks: unknown; picked_by_name: string | null; picked_at: string }
type Result = { data: Raw[] | null; error: unknown }

function rowFrom(raw: Raw): BidDifficultyPicksRow {
  const picks: DifficultyPicks = {}
  if (raw.picks != null && typeof raw.picks === 'object' && !Array.isArray(raw.picks)) {
    for (const [k, v] of Object.entries(raw.picks as Record<string, unknown>)) if (typeof v === 'number' && Number.isInteger(v)) picks[k] = v
  }
  return { bidId: raw.bid_id, criteriaVersionId: raw.criteria_version_id, picks, pickedByName: raw.picked_by_name ?? '', pickedAt: raw.picked_at }
}

export interface BidDifficultyPicksIo {
  load(bidId: string): Promise<BidDifficultyPicksRow | null>
  /** Writes the bid's picks under a published version; the database stamps who and when and holds each pick to a bid scale's rung. */
  save(bidId: string, criteriaVersionId: string, picks: DifficultyPicks): Promise<BidDifficultyPicksRow>
}

export function supabaseBidDifficultyPicksIo(): BidDifficultyPicksIo {
  return {
    async load(bidId) {
      const result = (await supabase.from(TABLE).select(COLS).eq('bid_id', bidId).limit(1)) as unknown as Result
      checkSupabaseError(result as never, 'read the bid’s own picks')
      const row = result.data?.[0]
      return row ? rowFrom(row) : null
    },
    async save(bidId, criteriaVersionId, picks) {
      const body = { bid_id: bidId, criteria_version_id: criteriaVersionId, picks } as never
      const result = (await supabase.from(TABLE).upsert(body, { onConflict: 'bid_id' } as never).select(COLS)) as unknown as Result
      checkSupabaseError(result as never, 'save the pick')
      const row = result.data?.[0]
      if (!row) throw new Error('The pick was not saved. Nothing came back.')
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(BID_DIFFICULTY_PICKS_CHANGED_EVENT, { detail: bidId }))
      return rowFrom(row)
    },
  }
}
