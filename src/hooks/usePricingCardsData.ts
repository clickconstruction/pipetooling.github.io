/**
 * Bids → Pricing: the three reads behind the price cards row (region P2, the Pricing / Labor
 * map's step 9, part 1), moved out of `BidsPricingTab` as they were. The tab calls each where
 * its effect stood, so the tab's effects keep their order.
 *
 * - `useGcNamesById` — G1 (v2.2154): the names of the GCs the bid's versions go to.
 * - `useScenarioCardRevenues` — iteration 2: each price scenario's revenue for its card,
 *   priced on its own bid version's count rows (v2.3841).
 * - `useAlternateVersionData` — own-takeoff alternates (v2.2404): each same-GC alternate
 *   version's ★ revenue on its own counts, and its own pre-tax takeoff materials.
 */
import { useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'
import { sameGcAlternateVersions } from '../lib/bids/ownTakeoffAlternates'
import { countRowsByOtherBidVersion, gcIdsToLoad, needsOtherBidVersionRows } from '../lib/bids/pricingCardsData'
import { scenarioCardRevenues } from '../lib/bids/scenarioCardRevenues'
import { scenarioRevenue } from '../lib/bids/scenarioPricingRows'
import { roughMaterialsTotalWithRounding, type RoughLineDbRow } from '../lib/bids/takeoffOrderRounding'
import type { ScenarioInputs } from '../lib/bids/loadScenarioInputs'
import type {
  BidCountRowCustomPrice,
  BidCountRowSubmissionHide,
  BidPricingAssignment,
  BidVersion,
  PriceBookEntryWithFixture,
  PriceBookVersion,
} from '../lib/bids/bidPricingEngineTypes'
import type { BidCountRow } from '../types/bids'

type CountRowSlice = Pick<BidCountRow, 'id' | 'fixture' | 'count' | 'bid_version_id'>

/** G1: GC names for the structure bar, the "Another price" window and the offered-as-alternate toggle. */
export function useGcNamesById(bidVersions: ReadonlyArray<BidVersion>): Record<string, string> {
  const [gcNamesById, setGcNamesById] = useState<Record<string, string>>({})
  useEffect(() => {
    const ids = gcIdsToLoad(bidVersions, gcNamesById)
    if (ids.length === 0) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('customers').select('id, name').in('id', ids)
      if (cancelled || !data) return
      setGcNamesById((prev) => { const next = { ...prev }; for (const c of data) next[c.id] = c.name ?? '—'; return next })
    })()
    return () => { cancelled = true }
  }, [bidVersions, gcNamesById])
  return gcNamesById
}

/**
 * Iteration 2 — per-scenario revenue. Mirrors the cover-letter bundle computation: for each
 * bid-owned Pricing, fetch its entries + overlays and run the shared calc kernel; cost is
 * scenario-independent. A scenario of another bid version prices that version's own count rows
 * (v2.3841 — it read $0 against the on-screen rows). Fewer than two scenarios, or no rows on
 * screen, reads nothing and returns `{}`.
 */
export function useScenarioCardRevenues(args: {
  bidId: string | null | undefined
  selectedBidVersionId: string | null
  priceBookVersions: PriceBookVersion[]
  pricingCountRows: BidCountRow[]
  /** Read again when the bid's prices change — these two are triggers, not inputs. */
  bidPricingAssignments: BidPricingAssignment[]
  bidCountRowCustomPrices: BidCountRowCustomPrice[]
}): Record<string, number> {
  const { bidId, selectedBidVersionId, priceBookVersions, pricingCountRows, bidPricingAssignments, bidCountRowCustomPrices } = args
  const [wbScenarioRevenue, setWbScenarioRevenue] = useState<Record<string, number>>({})
  useEffect(() => {
    const versionIds = priceBookVersions.map((v) => v.id)
    if (!bidId || versionIds.length < 2 || pricingCountRows.length === 0) {
      setWbScenarioRevenue({})
      return
    }
    const needsOtherRows = needsOtherBidVersionRows(priceBookVersions, selectedBidVersionId)
    let cancelled = false
    void (async () => {
      const [entriesRes, assignRes, customRes, hidesRes, rowsRes] = await Promise.all([
        supabase.from('price_book_entries').select('*, fixture_types(name)').in('version_id', versionIds),
        supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bidId).in('price_book_version_id', versionIds),
        supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bidId).in('price_book_version_id', versionIds),
        supabase.from('bid_count_row_submission_hides').select('*').eq('bid_id', bidId).in('price_book_version_id', versionIds),
        needsOtherRows
          ? supabase.from('bids_count_rows').select('id, fixture, count, bid_version_id').eq('bid_id', bidId)
          : Promise.resolve({ data: [] as CountRowSlice[], error: null }),
      ])
      if (cancelled) return
      const countRowsByBidVersion = rowsRes.error ? new Map<string, CountRowSlice[]>() : countRowsByOtherBidVersion((rowsRes.data as CountRowSlice[] | null) ?? [], selectedBidVersionId)
      setWbScenarioRevenue(
        scenarioCardRevenues({
          scenarios: priceBookVersions,
          activeBidVersionId: selectedBidVersionId,
          activeCountRows: pricingCountRows,
          countRowsByBidVersion,
          entries: (entriesRes.data as PriceBookEntryWithFixture[]) ?? [],
          assignments: (assignRes.data as BidPricingAssignment[]) ?? [],
          customPrices: (customRes.data as BidCountRowCustomPrice[]) ?? [],
          hides: (hidesRes.data as BidCountRowSubmissionHide[]) ?? [],
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, selectedBidVersionId, priceBookVersions, pricingCountRows, bidPricingAssignments, bidCountRowCustomPrices])
  return wbScenarioRevenue
}

export type AlternateVersionCardData = { revenue: number | null; materials: number | null }

/**
 * Own-takeoff alternates (v2.2404, Wendi): per alternate-version card, its ★'s revenue on ITS
 * counts, and its own pre-tax takeoff materials. Read again when the bid, the version on screen or the versions change.
 */
export function useAlternateVersionData(args: {
  bidId: string | null | undefined
  selectedBidVersionId: string | null
  bidVersions: BidVersion[]
  /** A scenario's four overlay tables (the tab's `loadScenarioInputsFor`). */
  loadInputs: (bidId: string, pricingId: string) => Promise<ScenarioInputs>
}): Record<string, AlternateVersionCardData> {
  const { bidId, selectedBidVersionId, bidVersions, loadInputs } = args
  const [altVersionData, setAltVersionData] = useState<Record<string, AlternateVersionCardData>>({})
  useEffect(() => {
    if (!bidId) return
    const alts = sameGcAlternateVersions(bidVersions, selectedBidVersionId)
    if (alts.length === 0) {
      setAltVersionData({})
      return
    }
    let cancelled = false
    void (async () => {
      const out: Record<string, AlternateVersionCardData> = {}
      await Promise.all(
        alts.map(async (v) => {
          const [countsRes, roughRes] = await Promise.all([
            supabase.from('bids_count_rows').select('*').eq('bid_id', bidId).eq('bid_version_id', v.id).order('sequence_order', { ascending: true }),
            supabase.from('bids_takeoff_rough_part_lines').select('count_row_id, part_id, quantity, unit_price, order_increment, order_increment_unit').eq('bid_id', bidId).eq('bid_version_id', v.id),
          ])
          const counts = (countsRes.data as BidCountRow[] | null) ?? []
          let materials: number | null = null
          if (roughRes.data) {
            const lines = roughRes.data as RoughLineDbRow[]
            // v2.3407: with the sticks, the same number the engine and the strip show.
            materials = roughMaterialsTotalWithRounding(lines, new Map(counts.map((c) => [c.id, c.count]))).total
          }
          let revenue: number | null = null
          const starId = v.starred_price_book_version_id ?? null
          if (starId && counts.length > 0) {
            // The Map modal's per-version revenue: the pricing kernel on the version's
            // own counts, prices only (no labor/materials → revenue).
            const inputs = await loadInputs(bidId, starId)
            revenue = scenarioRevenue({ scenarioId: starId, countRows: counts, entries: inputs.entries, assignments: inputs.assignments, customPrices: inputs.customPrices, hides: inputs.hides })
          }
          out[v.id] = { revenue, materials }
        }),
      )
      if (!cancelled) setAltVersionData(out)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId, selectedBidVersionId, bidVersions])
  return altVersionData
}
