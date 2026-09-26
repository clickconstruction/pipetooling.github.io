import type { SupabaseClient } from '@supabase/supabase-js'
import type { BidCountRow } from '../../types/bids'
import type {
  BidCountRowCustomPrice,
  BidCountRowSubmissionHide,
  BidPricingAssignment,
  PriceBookEntryWithFixture,
} from './bidPricingEngineTypes'

/**
 * The per-scenario inputs the Share / print / CSV paths and the alternates' revenue need for
 * a price scenario that is not the one on screen: its price book entries and its three
 * overlay tables (assignments, custom prices, submission hides — all keyed by
 * `price_book_version_id`), plus, when the scenario lives on another bid version, THAT
 * version's count rows. Lifted out of `BidsPricingTab` (Stage A of the Pricing map, second
 * half — v2.3856); `scenarioPricingRows` (v2.3853) is what prices the result.
 */
export type ScenarioInputs = {
  entries: PriceBookEntryWithFixture[]
  assignments: BidPricingAssignment[]
  customPrices: BidCountRowCustomPrice[]
  hides: BidCountRowSubmissionHide[]
  /**
   * The scenario's own count rows when it lives on another bid version (an alternate with its
   * own takeoff, v2.2404) — its assignments name those rows, not the ones on screen, so pricing
   * it against the viewed rows came out $0 (v2.3685). Null = the rows on screen apply.
   */
  countRows: BidCountRow[] | null
}

/**
 * The own-rows decision: a scenario prices on its own bid version's count rows unless that is
 * the version on screen. Count rows are per version with their own ids (20260823034820), and
 * a legacy unversioned scenario (`null`) on an unversioned bid is the on-screen one.
 */
export function scenarioNeedsOwnRows(scenarioBidVersionId: string | null, selectedBidVersionId: string | null): boolean {
  return scenarioBidVersionId !== selectedBidVersionId
}

/** The bid version a scenario lives on, from the loaded scenarios; null when unknown or unversioned. */
export function scenarioBidVersionIdOf(
  scenarios: ReadonlyArray<{ id: string; bid_version_id: string | null }>,
  pricingId: string,
): string | null {
  return scenarios.find((v) => v.id === pricingId)?.bid_version_id ?? null
}

export type LoadScenarioInputsArgs = {
  bidId: string
  /** The price scenario (`price_book_versions.id`). */
  pricingId: string
  /** The bid version the scenario lives on (`scenarioBidVersionIdOf`). */
  scenarioBidVersionId: string | null
  /** The bid version whose count rows are on screen. */
  selectedBidVersionId: string | null
}

/**
 * The four overlay reads, concurrently, and the scenario's own count rows when
 * `scenarioNeedsOwnRows` says so (ordered by `sequence_order`; a legacy unversioned
 * scenario reads the rows with no version). A read that comes back empty is an empty list;
 * own rows that come back empty are `[]`, never null — null means "the rows on screen".
 */
export async function loadScenarioInputs(
  supabase: SupabaseClient,
  { bidId, pricingId, scenarioBidVersionId, selectedBidVersionId }: LoadScenarioInputsArgs,
): Promise<ScenarioInputs> {
  const ownRows = scenarioNeedsOwnRows(scenarioBidVersionId, selectedBidVersionId)
  const countsQuery = supabase.from('bids_count_rows').select('*').eq('bid_id', bidId)
  const [entriesRes, assignRes, customRes, hidesRes, countsRes] = await Promise.all([
    supabase.from('price_book_entries').select('*, fixture_types(name)').eq('version_id', pricingId),
    supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bidId).eq('price_book_version_id', pricingId),
    supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bidId).eq('price_book_version_id', pricingId),
    supabase.from('bid_count_row_submission_hides').select('*').eq('bid_id', bidId).eq('price_book_version_id', pricingId),
    ownRows
      ? (scenarioBidVersionId ? countsQuery.eq('bid_version_id', scenarioBidVersionId) : countsQuery.is('bid_version_id', null)).order('sequence_order', { ascending: true })
      : Promise.resolve({ data: null as BidCountRow[] | null }),
  ])
  return {
    entries: (entriesRes.data as PriceBookEntryWithFixture[] | null) ?? [],
    assignments: (assignRes.data as BidPricingAssignment[] | null) ?? [],
    customPrices: (customRes.data as BidCountRowCustomPrice[] | null) ?? [],
    hides: (hidesRes.data as BidCountRowSubmissionHide[] | null) ?? [],
    countRows: ownRows ? ((countsRes.data as BidCountRow[] | null) ?? []) : null,
  }
}
