/**
 * Permits, the Market view (punch list #405): its reads. Our bids of two years with the names
 * they were priced for, every city's Builders rows, and a city's applications that carry an
 * issued day. Each is read once for the view, a page at a time. The kernel is `permitMarket.ts`;
 * no logic here.
 */
import { supabase } from '../supabase'
import { type SupabaseClientResult } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { fetchAllRows } from '../supabasePaging'
import { ymdPlusDays } from './permitResearch'
import { loadBuilders } from './permitResearchIo'
import type { CityBuilders, ClockPermit, MarketBid } from './permitMarket'

type BidRow = { id: string; customer_id: string | null; outcome: string | null; created_at: string | null; project_name: string | null; customer: { name: string | null } | null; gc: { name: string | null } | null }

/** Typed as a string: the customer and the old builders list ride along by their foreign keys. */
const MARKET_BID_COLUMNS: string = 'id, customer_id, outcome, created_at, project_name, customer:customers(name), gc:bids_gc_builders(name)'

/**
 * Every bid made since a day, with its customer's name and the old builders list's name on it.
 * Read from a day earlier: the day a bid was made is the app's calendar day, and the kernel
 * holds each bid to the window by that day.
 */
export async function loadMarketBids(sinceYmd: string): Promise<MarketBid[]> {
  const from = `${ymdPlusDays(sinceYmd, -1)}T00:00:00Z`
  const rows = await fetchAllRows<BidRow>(
    (lo, hi) => supabase.from('bids').select(MARKET_BID_COLUMNS).gte('created_at', from).order('id').range(lo, hi) as unknown as PromiseLike<SupabaseClientResult<BidRow[]>>,
    'read our bids of the last two years',
  )
  return rows.map((b) => ({
    id: b.id,
    customerId: b.customer_id,
    customerName: b.customer?.name ?? null,
    gcName: b.gc?.name ?? null,
    outcome: b.outcome,
    bidOn: b.created_at ? calendarYmdInAppTzFromIso(b.created_at) || null : null,
    projectName: b.project_name,
  }))
}

/** Every city's Builders rows, asked together. A city with no builder named on its permits answers with none. */
export async function loadBuildersOfCities(cities: readonly string[]): Promise<CityBuilders[]> {
  return await Promise.all(cities.map(async (city) => ({ city, rows: (await loadBuilders(city)) ?? [] })))
}

/**
 * A city's commercial applications submitted since a day that carry an issued day, for the
 * clock. Read off `permits` itself: the rows read back as history count here, and the skim's
 * read leaves them out.
 */
export async function loadApplicationClock(city: string, sinceYmd: string): Promise<ClockPermit[]> {
  return await fetchAllRows<ClockPermit>(
    (lo, hi) =>
      supabase
        .from('permits')
        .select('stage, submitted_on, issued_on')
        .eq('city', city)
        .eq('kind', 'building')
        .eq('residential', false)
        .eq('stage', 'applied')
        .gte('submitted_on', sinceYmd)
        .not('issued_on', 'is', null)
        .order('id')
        .range(lo, hi) as unknown as PromiseLike<SupabaseClientResult<ClockPermit[]>>,
    'read the applications for the clock',
  )
}
