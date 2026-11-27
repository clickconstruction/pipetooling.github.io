/**
 * Permits, the Market view (punch list #405): its reads and its one write. Our bids of two years
 * with the names they were priced for, every city's Builders rows, a city's commercial permits
 * of twelve months, the answers on the call list, and what was looked up about a builder with a
 * person's check of it. The kernels are `permitMarket.ts`, `permitCallList.ts`,
 * `permitMarketShape.ts` and `builderLookups.ts`; no logic here.
 */
import { supabase } from '../supabase'
import { databaseErrorFromResult, withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { SUPABASE_PAGE_SIZE, fetchAllRows } from '../supabasePaging'
import { ymdPlusDays } from './permitResearch'
import { loadBuilders } from './permitResearchIo'
import type { CityBuilders, MarketBid, MarketPermit } from './permitMarket'
import type { CallAnswerRow } from './permitCallList'
import type { LookupCheckRow, LookupRow, LookupVerdict } from './builderLookups'

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

const MARKET_PERMIT_COLUMNS = 'builder_key, stage, work_type, submitted_on, issued_on, declared_value, address_key'
const MARKET_PERMITS_DOING = 'read the year of permits'

/**
 * A city's commercial building permits whose day is on or after a day: issued since then, or
 * applied for since then and not issued. Read off `permits` itself, so the rows read back as
 * history count: the skim's read leaves them out, and most of a city's year is history.
 *
 * The first page asks for the count, and the pages after it are asked together. San Antonio's
 * year is four pages, and one after another they took over two seconds.
 */
export async function loadMarketPermits(city: string, sinceYmd: string): Promise<MarketPermit[]> {
  const page = (lo: number, counted: boolean) =>
    supabase
      .from('permits')
      .select(MARKET_PERMIT_COLUMNS, counted ? { count: 'exact' } : undefined)
      .eq('city', city)
      .eq('kind', 'building')
      .eq('residential', false)
      .or(`issued_on.gte.${sinceYmd},and(issued_on.is.null,submitted_on.gte.${sinceYmd})`)
      .order('id')
      .range(lo, lo + SUPABASE_PAGE_SIZE - 1)
  const first = await page(0, true)
  if (first.error) throw databaseErrorFromResult(first.error, MARKET_PERMITS_DOING, first.status)
  const rows = [...((first.data ?? []) as MarketPermit[])]
  if (first.count == null) {
    // No count came back: read on a page at a time until a short one, so a full first page is never taken for the whole.
    for (let lo = SUPABASE_PAGE_SIZE; rows.length === lo; lo += SUPABASE_PAGE_SIZE) {
      const res = await page(lo, false)
      if (res.error) throw databaseErrorFromResult(res.error, MARKET_PERMITS_DOING, res.status)
      rows.push(...((res.data ?? []) as MarketPermit[]))
    }
    return rows
  }
  const starts: number[] = []
  for (let lo = SUPABASE_PAGE_SIZE; lo < first.count; lo += SUPABASE_PAGE_SIZE) starts.push(lo)
  const rest = await Promise.all(starts.map((lo) => page(lo, false)))
  for (const res of rest) {
    if (res.error) throw databaseErrorFromResult(res.error, MARKET_PERMITS_DOING, res.status)
    rows.push(...((res.data ?? []) as MarketPermit[]))
  }
  return rows
}

/** PostgREST's "table not found": the window before a migration is pushed (*_builder_call_answers, *_builder_lookups). */
function missingTable(error: unknown): boolean {
  const e = error as { message?: string; code?: string } | null
  return e != null && (e.code === '42P01' || e.code === 'PGRST205' || /could not find the table|relation .* does not exist/i.test(e.message ?? ''))
}

const CALL_ANSWER_COLUMNS = 'id, builder_key, answer, reason, look_again_on, city, prospect_id, permit_id, answered_by, answered_at'

/**
 * Every answer on the call list, oldest first, a page at a time: the newest row per name is the
 * one that stands, and it is read last. Null before the table is on the database, and the list
 * then draws with no answer on any name.
 */
export async function loadCallAnswers(): Promise<CallAnswerRow[] | null> {
  try {
    return await fetchAllRows<CallAnswerRow>(
      (lo, hi) =>
        supabase
          .from('builder_call_answers' as never)
          .select(CALL_ANSWER_COLUMNS)
          .order('answered_at', { ascending: true })
          .order('id')
          .range(lo, hi) as unknown as PromiseLike<SupabaseClientResult<CallAnswerRow[]>>,
      'read the answers on the call list',
    )
  } catch (e) {
    if (missingTable(e)) return null
    throw e
  }
}

/** One answer, appended as the person signed in. The newest row per name stands. */
export async function recordCallAnswer(input: { builderKey: string; answer: CallAnswerRow['answer']; reason: string; lookAgainOn: string | null; city: string; prospectId?: string | null; permitId?: string | null }): Promise<void> {
  const { data: session } = await supabase.auth.getSession()
  const me = session.session?.user.id
  if (!me) throw new Error('Sign in again to answer.')
  await withSupabaseRetry(
    async () =>
      await supabase.from('builder_call_answers' as never).insert({
        builder_key: input.builderKey,
        answer: input.answer,
        reason: input.reason.trim(),
        look_again_on: input.lookAgainOn,
        city: input.city,
        prospect_id: input.prospectId ?? null,
        permit_id: input.permitId ?? null,
        answered_by: me,
      } as never),
    'keep the answer',
  )
}

const LOOKUP_COLUMNS = 'id, builder_key, fact, value, detail, source_url, looked_up_on, looked_up_by, looked_up_how, city, created_at'
const LOOKUP_CHECK_COLUMNS = 'id, lookup_id, verdict, said_by, said_at'

/** What was looked up about builders, and the presses on those facts. */
export type BuilderLookupReads = { rows: LookupRow[]; checks: LookupCheckRow[] }

/**
 * Every looked-up fact and every press on one (punch list #405, Ask for), oldest first, a page
 * at a time: the newest row per name and fact is the fact, the newest press its state, and each
 * is read last. Both tables are a few rows a name. Null before the tables are on the database,
 * and every name then reads as not looked up.
 */
export async function loadBuilderLookups(): Promise<BuilderLookupReads | null> {
  try {
    const [rows, checks] = await Promise.all([
      fetchAllRows<LookupRow>(
        (lo, hi) =>
          supabase
            .from('builder_lookups' as never)
            .select(LOOKUP_COLUMNS)
            .order('created_at', { ascending: true })
            .order('id')
            .range(lo, hi) as unknown as PromiseLike<SupabaseClientResult<LookupRow[]>>,
        'read what was looked up about the builders',
      ),
      fetchAllRows<LookupCheckRow>(
        (lo, hi) =>
          supabase
            .from('builder_lookup_checks' as never)
            .select(LOOKUP_CHECK_COLUMNS)
            .order('said_at', { ascending: true })
            .order('id')
            .range(lo, hi) as unknown as PromiseLike<SupabaseClientResult<LookupCheckRow[]>>,
        'read the checks on what was looked up',
      ),
    ])
    return { rows, checks }
  } catch (e) {
    if (missingTable(e)) return null
    throw e
  }
}

/**
 * One name's looked-up facts and the presses on them, for the Ask for block on the builder's
 * sheet (punch list #405, v2.8732): the same rows the call list reads, held to the one name, so
 * the sheet folds them with the same kernel (`foldLookups`). A name holds a few rows. Null before
 * the tables are on the database, and the name then reads as not looked up.
 */
export async function loadBuilderLookupOf(builderKey: string): Promise<BuilderLookupReads | null> {
  try {
    const rows =
      (await withSupabaseRetry(
        async () =>
          (await supabase
            .from('builder_lookups' as never)
            .select(LOOKUP_COLUMNS)
            .eq('builder_key', builderKey)
            .order('created_at', { ascending: true })
            .order('id')) as unknown as SupabaseClientResult<LookupRow[]>,
        'read what was looked up about this builder',
      )) ?? []
    if (rows.length === 0) return { rows: [], checks: [] }
    const checks =
      (await withSupabaseRetry(
        async () =>
          (await supabase
            .from('builder_lookup_checks' as never)
            .select(LOOKUP_CHECK_COLUMNS)
            .in('lookup_id', rows.map((r) => r.id))
            .order('said_at', { ascending: true })
            .order('id')) as unknown as SupabaseClientResult<LookupCheckRow[]>,
        'read the checks on what was looked up',
      )) ?? []
    return { rows, checks }
  } catch (e) {
    if (missingTable(e)) return null
    throw e
  }
}

/** One press on a looked-up fact (checked, wrong, or back), appended as the person signed in. The newest press on a fact stands. */
export async function recordLookupCheck(input: { lookupId: string; verdict: LookupVerdict }): Promise<void> {
  const { data: session } = await supabase.auth.getSession()
  const me = session.session?.user.id
  if (!me) throw new Error('Sign in again to check a fact.')
  await withSupabaseRetry(async () => await supabase.from('builder_lookup_checks' as never).insert({ lookup_id: input.lookupId, verdict: input.verdict, said_by: me } as never), 'keep the check')
}
