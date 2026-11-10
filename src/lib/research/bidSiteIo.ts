/**
 * Bids and permits (punch list #307): the reads behind the two panels in a bid's window. The
 * permits come from `bid_site_permits` (migration 20261110220345), asked by house number; which
 * sit on a bid's site is decided by `bidSite.ts`. No kernel logic here.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { GcBid, SitePermitRow } from './bidSitePanel'
import type { AnswerScope, NameAnswer, NameAnswerRow } from './nameAnswers'

/** PostgREST's "function not found": the window after the client deploys and before the migration is pushed. */
function missingFunction(error: unknown): boolean {
  const e = error as { message?: string; code?: string } | null
  return e != null && (e.code === 'PGRST202' || /could not find the function/i.test(e.message ?? ''))
}

const SITE_PERMIT_COLUMNS = 'id, permit_number, permit_type, kind, stage, work_type, project_name, address, submitted_on, issued_on, declared_value, area_sf, contact, builder_key'

/**
 * Every permit in a city whose street starts with one of these house numbers. Null while the
 * read is not on the database yet and the numbers are too many to ask one at a time.
 */
export async function loadPermitsByHouseNumber(city: string, numbers: readonly string[]): Promise<SitePermitRow[] | null> {
  if (numbers.length === 0) return []
  // Asked bare first: a missing function is the push not made yet, and retrying it only waits.
  const first = await supabase.rpc('bid_site_permits' as never, { p_city: city, p_numbers: numbers } as never)
  if (!first.error) return ((first.data ?? []) as unknown) as SitePermitRow[]
  if (!missingFunction(first.error)) {
    const rows = await withSupabaseRetry(async () => await supabase.rpc('bid_site_permits' as never, { p_city: city, p_numbers: numbers } as never), 'read the permits on the address')
    return ((rows ?? []) as unknown) as SitePermitRow[]
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

/** The answers on names for one GC's customer rows, and who is asking. Null before the table is on the database. */
export async function loadNameAnswers(customerIds: readonly string[]): Promise<{ rows: NameAnswerRow[]; me: string | null } | null> {
  const { data: session } = await supabase.auth.getSession()
  const me = session.session?.user.id ?? null
  if (customerIds.length === 0) return { rows: [], me }
  const res = await supabase.from('builder_customer_answers' as never).select(ANSWER_COLUMNS).in('customer_id', [...customerIds]).order('answered_at', { ascending: true }).limit(2000)
  if (res.error) {
    if (missingTable(res.error)) return null
    throw res.error
  }
  return { rows: ((res.data ?? []) as unknown) as NameAnswerRow[], me }
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
