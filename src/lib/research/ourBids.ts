/**
 * Our bids with a company, the one rule (punch list #405, the audit of 2026-11-20). Three counts
 * on Prospects → Permits say how often we priced a job for a name: Market's table of companies
 * (`bidCompanies`), the count a tied customer adds to a name (`answeredBids`), and the database's
 * count under a name on the permits (`research_builders`). They read one rule, so one name reads
 * one count wherever it is drawn:
 *
 * - **A bid counts** when it is no practice bid and was made within two years. A practice bid is
 *   a project name that starts with the word ZZ (`isZzBidName`, the ZZ convention), which is how
 *   a digital twin's copy of a bid is named. Two years is `OUR_BID_DAYS` back from today, by the
 *   app's calendar day. A bid with no day counts.
 * - **It counts under a name** on it, keyed as permits are, unless the name is no company: a ZZ
 *   name, or a customer named for a bid platform.
 * - **A win** is an outcome of won or started.
 *
 * The database's copy is `research_bid_counts` and `research_bid_party_key`
 * (`supabase/migrations/20261120150000_research_builders_our_bids.sql`). `ourBids.test.ts` reads
 * that file and fails when its days or its platforms are not the ones here. No React, no Supabase.
 */
import { nameKey } from '../../../supabase/functions/_shared/permitLookup'
import { isZzBidName, isZzTestName } from '../../../supabase/functions/_shared/zzTestJob'
import { ymdPlusDays } from './permitResearch'

/** How far back a bid counts: two years. */
export const OUR_BID_DAYS = 730

/** The first day a bid counts from. */
export function ourBidsSince(todayYmd: string): string {
  return ymdPlusDays(todayYmd, -OUR_BID_DAYS)
}

/**
 * The bid platforms a catch-all customer is named for, as its name key starts. A bid found on a
 * platform with no GC chosen yet sits under a customer of the platform's name. That customer is
 * a bucket and not a company.
 */
export const BID_PLATFORM_KEYS = ['planhub', 'buildingconnected', 'constructconnect', 'isqft', 'smartbid', 'bidnet', 'buildingblok', 'civcast', 'demandstar'] as const

/** A customer named for a bid platform: the bucket its bids sit under until a GC is chosen. */
export function isBidPlatformBucket(name: string | null | undefined): boolean {
  const key = nameKey(name)
  return key != null && BID_PLATFORM_KEYS.some((p) => key.startsWith(p))
}

/** Whether one of our bids counts: no practice bid, and made within two years of today. */
export function bidCounts(bid: { projectName: string | null; bidOn: string | null }, todayYmd: string): boolean {
  if (isZzBidName(bid.projectName)) return false
  return bid.bidOn == null || (bid.bidOn >= ourBidsSince(todayYmd) && bid.bidOn <= todayYmd)
}

/** The key a bid counts under for one name on it, as permits are keyed. Null for a name that is no company. */
export function bidPartyKey(name: string | null | undefined): string | null {
  const said = (name ?? '').trim()
  if (said === '' || isZzTestName(said) || isBidPlatformBucket(said)) return null
  return nameKey(said) ?? null
}

/** The outcomes that count as won. */
const WON = new Set(['won', 'started_or_complete'])

/** Whether a bid's outcome is a win: won, or started. */
export function bidWon(outcome: string | null | undefined): boolean {
  return WON.has(outcome ?? '')
}
