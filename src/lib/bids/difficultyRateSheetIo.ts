/**
 * GC difficulty rating (punch list #357, PR 5): the reads behind the master's sheet that the GC's card does not make,
 * the bid's numbers for the consequence box. Each fails on its own: a pin, an estimate or a history that cannot be
 * read leaves that part out, and the sheet still rates. The rating's own reads and its one write are the card's
 * (`gcDifficultyRatingIo.ts`).
 */
import { supabase } from '../supabase'
import type { BidPricingHistoryRow } from '../../types/database-functions'
import { supabaseBidDifficultyIo } from './bidDifficultyIo'
import { supabaseBidDifficultyPicksIo } from './bidDifficultyPicksIo'
import type { DifficultyPicks } from './difficultyCriteria'
import { supabaseGcDifficultyIo, type GcDifficultyIo } from './gcDifficultyRatingIo'
import { laborRowHours } from './laborRowHours'

/** The bid the sheet was opened from, as the Bid Board's row holds it. */
export type RateSheetBid = {
  id: string
  /** "b512", as the board says it. */
  label: string | null
  project: string | null
  serviceTypeId: string | null
  bidValue: number | null
  pricedRevenueUsd: number | null
  pricedCostUsd: number | null
  pricedDifficultyUsd: number | null
}

export type RateSheetBidRead = {
  pin: { fieldHours: number; laborRate: number; ownCostUsd: number; carriedUsd: number } | null
  estimate: { fieldHours: number; laborRate: number | null } | null
  /** Decided bids of this kind of work; null when the read failed or the bid has no kind. */
  history: BidPricingHistoryRow[] | null
}

export interface RateSheetIo extends GcDifficultyIo {
  loadBid(bid: RateSheetBid): Promise<RateSheetBidRead>
  /** The bid's own picks as stored (PR 6, the site); absent reads as none. */
  loadBidPicks?(bidId: string): Promise<DifficultyPicks>
  saveBidPicks?(bidId: string, criteriaVersionId: string, picks: DifficultyPicks): Promise<DifficultyPicks>
}

type LaborRow = Parameters<typeof laborRowHours>[0]

async function loadEstimate(bidId: string): Promise<RateSheetBidRead['estimate']> {
  const { data: ce, error } = await supabase.from('cost_estimates').select('id, labor_rate').eq('bid_id', bidId).maybeSingle()
  if (error || !ce) return null
  const { data: rows, error: rowsError } = await supabase
    .from('cost_estimate_labor_rows')
    .select('count, is_fixed, kind, unit, rough_in_hrs_per_unit, top_out_hrs_per_unit, trim_set_hrs_per_unit')
    .eq('cost_estimate_id', ce.id)
  if (rowsError) return null
  const fieldHours = ((rows ?? []) as LaborRow[]).reduce((s, r) => s + laborRowHours(r), 0)
  return { fieldHours, laborRate: ce.labor_rate == null ? null : Number(ce.labor_rate) }
}

async function loadHistory(serviceTypeId: string | null): Promise<BidPricingHistoryRow[] | null> {
  if (!serviceTypeId) return null
  const { data, error } = await supabase.rpc('bid_pricing_history', { p_service_type_id: serviceTypeId })
  if (error || !Array.isArray(data)) return null
  return data as unknown as BidPricingHistoryRow[]
}

export function supabaseRateSheetIo(): RateSheetIo {
  const pins = supabaseBidDifficultyIo()
  const own = supabaseBidDifficultyPicksIo()
  return {
    ...supabaseGcDifficultyIo(),
    loadBidPicks: async (bidId) => (await own.load(bidId))?.picks ?? {},
    saveBidPicks: async (bidId, criteriaVersionId, picks) => (await own.save(bidId, criteriaVersionId, picks)).picks,
    async loadBid(bid) {
      const [pin, estimate, history] = await Promise.all([pins.load(bid.id).catch(() => null), loadEstimate(bid.id).catch(() => null), loadHistory(bid.serviceTypeId).catch(() => null)])
      return { pin: pin ? { fieldHours: pin.fieldHours, laborRate: pin.laborRate, ownCostUsd: pin.ownCostUsd, carriedUsd: pin.carriedUsd } : null, estimate, history }
    },
  }
}
