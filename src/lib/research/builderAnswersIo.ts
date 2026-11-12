/**
 * Bids and permits (punch list #307): the reads behind the answers on names as Builders shows
 * them. Once for the list, never once a row: every answer (a page at a time), our customers by
 * name, the people who answered, and the bids of the customers some name is tied to. The kernel
 * is `builderAnswers.ts`; no logic here.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { chunkIds, fetchAllRows } from '../supabasePaging'
import { loadAllNameAnswers, loadCustomerNames } from './bidSiteIo'
import { loadResearchers } from './permitResearchIo'
import { answerBook, tiedCustomerIds, type AnswerBook, type CountedBid, type CustomerName } from './builderAnswers'

/** What Builders knows about the answers: the book, the tied customers' bids, who is looking, and the people by id. */
export type BuilderAnswersGround = { book: AnswerBook; bids: CountedBid[]; me: string | null; people: Map<string, string> }

/** Customers by id, archived ones too: an answer can name a customer the list of live ones leaves out. */
export async function loadCustomersById(ids: readonly string[]): Promise<CustomerName[]> {
  const out: CustomerName[] = []
  for (const chunk of chunkIds([...new Set(ids)])) {
    const rows = await withSupabaseRetry(async () => await supabase.from('customers').select('id, name').in('id', chunk), 'read the customers')
    for (const c of rows ?? []) if ((c.name ?? '').trim() !== '') out.push({ id: c.id, name: c.name as string })
  }
  return out
}

type BidToCount = { id: string; customer_id: string | null; outcome: string | null; created_at: string | null; project_name: string | null; gc: { name: string | null } | null }

/** The select behind the count. Typed as a string: the old builders list rides along by its foreign key. */
const BID_TO_COUNT_COLUMNS: string = 'id, customer_id, outcome, created_at, project_name, gc:bids_gc_builders(name)'

/**
 * Every bid whose customer is one of these rows, for the Our bids column: its outcome, its day,
 * its name (a robot's copy is left out by the kernel) and the old builders list's name on it
 * (a bid the same-name hint already counts). A page at a time, cut by id, a chunk of customers
 * a read: a customer with a long history passes the API's 1,000 rows.
 */
export async function loadBidsToCount(customerIds: readonly string[]): Promise<CountedBid[]> {
  const out: CountedBid[] = []
  for (const chunk of chunkIds([...new Set(customerIds)])) {
    const rows = await fetchAllRows<BidToCount>(
      (from, to) => supabase.from('bids').select(BID_TO_COUNT_COLUMNS).in('customer_id', chunk).order('id').range(from, to) as unknown as PromiseLike<SupabaseClientResult<BidToCount[]>>,
      'read the bids with the customers tied to a name',
    )
    for (const b of rows) {
      if (!b.customer_id) continue
      out.push({ id: b.id, customerId: b.customer_id, outcome: b.outcome, bidOn: b.created_at ? calendarYmdInAppTzFromIso(b.created_at) : null, projectName: b.project_name, legacyGcName: b.gc?.name ?? null })
    }
  }
  return out
}

/**
 * The answers on names for Builders, in one sitting. Null before the answers table is on the
 * database. With no answer on record this is the two reads the worklist already makes; the
 * people are read once an answer exists, and bids only for customers some name is tied to.
 */
export async function loadBuilderAnswersGround(): Promise<BuilderAnswersGround | null> {
  const answers = await loadAllNameAnswers()
  if (answers == null) return null
  const customers = await loadCustomerNames()
  const have = new Set(customers.map((c) => c.id))
  const missing = [...new Set(answers.rows.map((r) => r.customer_id))].filter((id) => !have.has(id))
  const [more, researchers] = await Promise.all([missing.length > 0 ? loadCustomersById(missing) : Promise.resolve([]), answers.rows.length > 0 ? loadResearchers() : Promise.resolve([])])
  const book = answerBook(answers.rows, [...customers, ...more])
  const ids = tiedCustomerIds(book)
  const bids = ids.length > 0 ? await loadBidsToCount(ids) : []
  return { book, bids, me: answers.me, people: new Map(researchers.map((r) => [r.id, r.name])) }
}
