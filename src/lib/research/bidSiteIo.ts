/**
 * Bids and permits (punch list #307): the reads behind the two panels in a bid's window. The
 * permits come from `bid_site_permits` (migration 20261110220345), asked by house number; which
 * sit on a bid's site is decided by `bidSite.ts`. No kernel logic here.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'
import { fetchAllRows, warnIfRowCapHit } from '../supabasePaging'
import { sitePermitOrder, type GcBid, type SitePermitRow } from './bidSitePanel'
import type { AnswerScope, NameAnswer, NameAnswerRow } from './nameAnswers'
import { forgetLookAlikeCounts } from './lookAlikeCountMemory'

/** PostgREST's "function not found": the window after the client deploys and before the migration is pushed. */
function missingFunction(error: unknown): boolean {
  const e = error as { message?: string; code?: string } | null
  return e != null && (e.code === 'PGRST202' || /could not find the function/i.test(e.message ?? ''))
}

const SITE_PERMIT_COLUMNS = 'id, permit_number, permit_type, kind, stage, work_type, project_name, address, submitted_on, issued_on, declared_value, area_sf, contact, builder_key'

type Page<T> = PromiseLike<SupabaseClientResult<T[]>>

const SITE_PERMITS_DOING = 'read the permits on the address'

/** `bid_site_permits` stops here by its own SQL LIMIT. A read that reaches it is cut, and the console says so. */
export const SITE_PERMITS_RPC_LIMIT = 5000

/**
 * Every permit in a city whose street starts with one of these house numbers, newest first. Null
 * while the read is not on the database yet and the numbers are too many to ask one at a time.
 *
 * Read a page at a time: the API returns at most 1,000 rows with no error, and the board's one
 * read for San Antonio holds over 700. The pages are cut by `id`, since the read's own order (day,
 * number, type) ties when one permit sits in both feeds on one day, and a tie can shuffle between
 * pages. `sitePermitOrder` puts the whole answer back newest first.
 */
export async function loadPermitsByHouseNumber(city: string, numbers: readonly string[]): Promise<SitePermitRow[] | null> {
  if (numbers.length === 0) return []
  const ask = (from: number, to: number) => supabase.rpc('bid_site_permits' as never, { p_city: city, p_numbers: numbers } as never).order('id').range(from, to) as unknown as Page<SitePermitRow>
  try {
    const rows = await fetchAllRows<SitePermitRow>(async (from, to) => {
      // Asked bare first: a missing function is the push not made yet, and retrying it only waits.
      const first = await ask(from, to)
      if (!first.error || missingFunction(first.error)) return first
      return { data: await withSupabaseRetry(() => ask(from, to), SITE_PERMITS_DOING), error: null }
    }, SITE_PERMITS_DOING)
    warnIfRowCapHit('bid_site_permits', rows.length, SITE_PERMITS_RPC_LIMIT)
    return rows.sort(sitePermitOrder)
  } catch (e) {
    if (!missingFunction(e)) throw e
  }
  // Before the push: the table itself, one house number at a time, for a single bid's worth.
  if (numbers.length > 3) return null
  const out: SitePermitRow[] = []
  for (const n of numbers) {
    const rows = await withSupabaseRetry(
      async () =>
        await supabase
          .from('permits' as never)
          .select(SITE_PERMIT_COLUMNS)
          .eq('city', city)
          .like('address_key', `${n.toLowerCase()} %`)
          .limit(400),
      'read the permits on the address',
    )
    out.push(...((rows ?? []) as unknown as SitePermitRow[]))
  }
  return out
}

const GC_BID_COLUMNS = 'id, bid_number, project_name, address, outcome, bid_date_sent'

/** The bids priced for a customer: the ones it is the GC of, and the ones it is another GC on. */
export async function loadBidsOfCustomers(customerIds: readonly string[]): Promise<GcBid[]> {
  if (customerIds.length === 0) return []
  const [own, others] = await Promise.all([
    withSupabaseRetry(async () => await supabase.from('bids').select(GC_BID_COLUMNS).in('customer_id', [...customerIds]).order('created_at', { ascending: false }).limit(500), 'read the bids with this GC'),
    withSupabaseRetry(async () => await supabase.from('bid_gcs').select('bid_id').in('customer_id', [...customerIds]).limit(500), 'read the bids with this GC'),
  ])
  const byId = new Map<string, GcBid>(((own ?? []) as GcBid[]).map((b) => [b.id, b]))
  const extra = [...new Set(((others ?? []) as Array<{ bid_id: string }>).map((r) => r.bid_id))].filter((id) => !byId.has(id))
  if (extra.length > 0) {
    const more = await withSupabaseRetry(async () => await supabase.from('bids').select(GC_BID_COLUMNS).in('id', extra).limit(500), 'read the bids with this GC')
    for (const b of (more ?? []) as GcBid[]) byId.set(b.id, b)
  }
  return [...byId.values()]
}

// --- The answer on a name (punch list #307, PR 6 and 7) --------------------------------------


/** PostgREST's "table not found": the window before migration *_builder_customer_answers is pushed. */
function missingTable(error: unknown): boolean {
  const e = error as { message?: string; code?: string } | null
  return e != null && (e.code === '42P01' || e.code === 'PGRST205' || /could not find the table|relation .* does not exist/i.test(e.message ?? ''))
}

const ANSWER_COLUMNS = 'id, builder_key, customer_id, answer, scope, permit_id, name, answered_by, answered_at'

/**
 * Every answer on a name, oldest first, for these customer rows or for all of them (`null`). A
 * page at a time, the answer's own id settling two saved in one instant, so none past the API's
 * 1,000 is lost: the newest decisive answer is the one that stands, and it is read last. Null
 * before the table is on the database.
 */
async function readEveryAnswer(customerIds: readonly string[] | null): Promise<NameAnswerRow[] | null> {
  try {
    return await fetchAllRows<NameAnswerRow>((from, to) => {
      const all = supabase.from('builder_customer_answers' as never).select(ANSWER_COLUMNS)
      const asked = customerIds ? all.in('customer_id', [...customerIds]) : all
      return asked.order('answered_at', { ascending: true }).order('id').range(from, to) as unknown as Page<NameAnswerRow>
    }, 'read the answers on names')
  } catch (e) {
    if (missingTable(e)) return null
    throw e
  }
}

/** The answers on names for one GC's customer rows, and who is asking. Null before the table is on the database. */
export async function loadNameAnswers(customerIds: readonly string[]): Promise<{ rows: NameAnswerRow[]; me: string | null } | null> {
  const { data: session } = await supabase.auth.getSession()
  const me = session.session?.user.id ?? null
  if (customerIds.length === 0) return { rows: [], me }
  const rows = await readEveryAnswer(customerIds)
  return rows ? { rows, me } : null
}

/** One answer, appended. The newest decisive row per name and customer stands. */
export async function recordNameAnswer(input: { builderKey: string; customerId: string; answer: NameAnswer; scope: AnswerScope | null; permitId: string | null; name: string }): Promise<void> {
  const { data: session } = await supabase.auth.getSession()
  const me = session.session?.user.id
  if (!me) throw new Error('Sign in again to answer.')
  await withSupabaseRetry(
    async () =>
      await supabase.from('builder_customer_answers' as never).insert({
        builder_key: input.builderKey,
        customer_id: input.customerId,
        answer: input.answer,
        scope: input.answer === 'works_for' ? (input.scope ?? 'all') : null,
        permit_id: input.permitId,
        name: input.name,
        answered_by: me,
      } as never),
    'save the answer',
  )
  // A read that began before this answer landed must not be handed to whoever asks next.
  everyAnswerFlight.flying = null
  // The Dashboard's Needs you line counts the names still to answer, and this answer moved the count.
  forgetLookAlikeCounts()
  for (const fn of answerListeners) fn()
}

/** What the office said each name is, off `builders`: the key to its kind. A name with no row is not in the map. */
export async function loadBuilderKinds(keys: readonly string[]): Promise<Map<string, string | null>> {
  if (keys.length === 0) return new Map()
  const res = await supabase.from('builders' as never).select('key, kind').in('key', [...keys])
  if (res.error) return new Map()
  return new Map((((res.data ?? []) as unknown) as Array<{ key: string; kind: string | null }>).map((r) => [r.key, r.kind]))
}

const answerListeners = new Set<() => void>()

/** Run `fn` whenever an answer on a name is saved, so both panels in a bid's window agree. Returns the unsubscribe. */
export function onNameAnswered(fn: () => void): () => void {
  answerListeners.add(fn)
  return () => {
    answerListeners.delete(fn)
  }
}

// --- Linking a customer to its names on permits (punch list #307, PR 9 and 10) ---------------

/** A permit as the name's own list and Compare read it. */
export type NamePermit = { id: string; city: string; address: string | null; zip: string | null; contact: string | null; work_type: string | null; permit_type: string; kind: string; stage: string; issued_on: string | null; submitted_on: string | null }

/**
 * Every permit on hand under one name key, in every city, newest first. Paged: a busy name is on
 * thousands once the records reach back a year, and Compare counts where all of them are.
 */
export async function loadPermitsOfName(builderKey: string): Promise<NamePermit[]> {
  return await fetchAllRows<NamePermit>(
    (from, to) =>
      supabase
        .from('permits' as never)
        .select('id, city, address, zip, contact, work_type, permit_type, kind, stage, issued_on, submitted_on')
        .eq('builder_key', builderKey)
        .order('issued_on', { ascending: false, nullsFirst: false })
        .order('id')
        .range(from, to) as unknown as PromiseLike<SupabaseClientResult<NamePermit[]>>,
    'read the permits under this name',
  )
}

/**
 * One read handed to everyone who asks while it is in flight. Builders has two readers of the
 * answers and of the customers, the worklist and the Our bids column, and they ask together.
 */
type Flight<T> = { flying: Promise<T> | null }

function whileInFlight<T>(flight: Flight<T>, read: () => Promise<T>): Promise<T> {
  if (flight.flying) return flight.flying
  const flying: Promise<T> = read().finally(() => {
    if (flight.flying === flying) flight.flying = null
  })
  flight.flying = flying
  return flying
}

const everyAnswerFlight: Flight<NameAnswerRow[] | null> = { flying: null }
const customerNamesFlight: Flight<Array<{ id: string; name: string }>> = { flying: null }

/** Every answer on a name, for the worklist over all customers. Null before the table is on the database. */
export async function loadAllNameAnswers(): Promise<{ rows: NameAnswerRow[]; me: string | null } | null> {
  const { data: session } = await supabase.auth.getSession()
  const me = session.session?.user.id ?? null
  const rows = await whileInFlight(everyAnswerFlight, () => readEveryAnswer(null))
  return rows ? { rows, me } : null
}

/** Our customers by name, for the worklist, a page at a time. Archived ones are left out. */
export function loadCustomerNames(): Promise<Array<{ id: string; name: string }>> {
  return whileInFlight(customerNamesFlight, readCustomerNames)
}

async function readCustomerNames(): Promise<Array<{ id: string; name: string }>> {
  const rows = await fetchAllRows<{ id: string; name: string | null }>(
    async (from, to) => ({ data: await withSupabaseRetry(async () => await supabase.from('customers').select('id, name').is('archived_at', null).order('name').order('id').range(from, to), 'read the customers'), error: null }),
    'read the customers',
  )
  return rows.filter((c) => (c.name ?? '').trim() !== '').map((c) => ({ id: c.id, name: c.name as string }))
}

/** The newest bids with a customer on them, for the worklist's site evidence. */
export async function loadRecentBidsWithCustomer(limit = 1000): Promise<Array<GcBid & { customer_id: string }>> {
  const rows = await withSupabaseRetry(async () => await supabase.from('bids').select(`${GC_BID_COLUMNS}, customer_id`).not('customer_id', 'is', null).order('created_at', { ascending: false }).limit(limit), 'read the bids')
  return ((rows ?? []) as unknown) as Array<GcBid & { customer_id: string }>
}
