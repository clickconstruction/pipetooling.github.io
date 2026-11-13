/**
 * The Development page's reads (punch list #208, design spike): everything the page draws, under
 * the reader's own policies for the office set, which reads all of it; a reader with no
 * `jobs_ledger` policy, the estimator, takes the pieces through `list_development_overview` (PR 6,
 * `readDoor.ts`), a definer read with no money column, and the bills, payments and job notes are
 * not read at all. Members come by `development_id`; the records at the members' address that are
 * not in it come by an address search narrowed to exact normalized-key matches in `splitMembers`, so
 * the real site (13 bids and 29 jobs at one address, 9 jobs tagged) fills the page without a write.
 */
import { HISTORY_HEAD_COLUMNS, headRowToEntry, rowToEntry, type HistoryEntry, type HistoryHeadRow, type HistoryRow } from './history'
import { supabase } from '../supabase'
import { parsePaySpeedsRpc, type PaySpeedData } from '../jobs/billedExpectedPay'
import { paySpeedPayerIds } from './siteMoney'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { addressSearchPattern, memberAddressKeys, splitMembers, type MemberBid, type MemberJob, type MemberRequest, type Members } from './overview'
import { parseDevelopmentOverview, stripBidMoney, type DevelopmentDoor, type DevelopmentOverview } from './readDoor'

const BID_COLUMNS =
  'id, bid_number, project_name, address, customer_id, estimator_id, account_manager_id, development_id, outcome, outcome_at, bid_value, agreed_value, priced_revenue_usd, bid_date_sent, bid_due_date, estimated_job_start_date, plans_link, design_drawing_plan_date, gc_contact_name, gc_contact_phone, gc_contact_email, created_at, updated_at, working_board_archived_at, working_board_archived_by, service_type_id, last_contact, notes'
/** The same bid without its three money columns: what the overview door reads at the address. */
const BID_COLUMNS_NO_MONEY = BID_COLUMNS.split(', ')
  .filter((c) => c !== 'bid_value' && c !== 'agreed_value' && c !== 'priced_revenue_usd')
  .join(', ')
const JOB_COLUMNS =
  'id, hcp_number, click_number, job_name, job_address, customer_id, customer_name, gc_customer_id, development_id, bid_id, status, revenue, payments_made, last_work_date, last_bill_date, job_plans_link, plan_part_id, billing_only, kind, created_at, updated_at, service_type_id, account_manager_user_id, pct_complete, collections_note'
const REQUEST_COLUMNS = 'id, title, status, priority, created_at, closed_at, closed_note, from_user_id, bid_id, job_ledger_id, development_id, reference_summary'
// Only the Dispatch table carries a flavour (`stage_check`, #245 PR 3); the estimators' has no such column, and naming it there refuses the read.
const DISPATCH_REQUEST_COLUMNS = `${REQUEST_COLUMNS}, pending_action`

export type DevelopmentRow = {
  id: string
  name: string
  gc_customer_id: string | null
  city: string | null
  notes: string | null
  archived_at: string | null
  created_at: string
}

export type DevelopmentPageData = {
  development: DevelopmentRow
  gcCustomer: { id: string; name: string } | null
  /** The customer most of the members name, for the head. */
  customer: { id: string; name: string; contact_info: unknown } | null
  /** The site's customer and the GC, with the two notes kept on a customer (payment terms, lien notices). */
  customers: Array<{ id: string; name: string; payment_terms_note: string | null; lien_notice_policy_note: string | null }>
  /** The entries people and robots kept (`development_history_entries`), newest first, the author's name resolved. */
  historyEntries: HistoryEntry[]
  /** The customers' contact log (`customer_contacts`): the dated comments the Customers page keeps. */
  customerContacts: Array<{ id: string; customer_id: string; contact_date: string; contact_method: string | null; details: string | null; created_by: string | null }>
  inIt: Members
  atAddress: Members
  requests: MemberRequest[]
  submissionEntries: Array<{ id: string; bid_id: string; occurred_at: string; contact_method: string | null; notes: string | null; created_by: string | null }>
  bidChanges: Array<{ id: number; bid_id: string; changed_at: string; changed: string[]; changed_by: string | null }>
  statusEvents: Array<{ id: string; job_id: string; changed_at: string; from_status: string | null; to_status: string; changed_by_user_id: string | null }>
  /** `sent_by_user_id` (v2.6457): who sent the bill, for the Scoreboard's office line; absent on an older read. */
  invoices: Array<{ id: string; job_id: string; amount: number; status: string; billed_at: string | null; sent_to_customer_at: string | null; created_at: string | null; sent_by_user_id?: string | null }>
  /** `created_by` (v2.6457): who booked the payment, for the Scoreboard's office line; `payment_type` and `note` (v2.6493): the Timeline's payment line; absent on an older read. */
  payments: Array<{ id: string; job_id: string; amount: number; paid_on: string | null; created_at: string | null; created_by?: string | null; payment_type?: string | null; note?: string | null }>
  threadNotes: Array<{ id: string; job_id: string; created_at: string; author_user_id: string; body: string }>
  /** A bid's thread notes, keyed by the bid's id (`estimate_id`). */
  bidNotes: Array<{ id: string; estimate_id: string; created_at: string; author_user_id: string; body: string }>
  teamMembers: Array<{ job_id: string; user_id: string }>
  names: Map<string, string>
  /** The robot estimators among the people named (`users.is_digital_twin`): their bids are shadows, shown and not counted. */
  twinUserIds: ReadonlySet<string>
  /** The site's payers' pace (`get_customer_pay_speeds`, v2.6739; the Pipeline's whole-list read until its migration is pushed), for the Money look's expected day; null when the read fails or the site bills no one. */
  paySpeed: PaySpeedData | null
}

function fail(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`${label}: ${error.message}`)
}

/**
 * Members and the address matches. The office door: two reads by `development_id`, then one address
 * search per shared address. The overview door: the members, their stage moves and crews from the
 * definer read, then the same address search over bids alone (with no money column), since this
 * reader has no `jobs_ledger` policy and the *not in it* line counts what the reader can see.
 */
async function readMembers(developmentId: string, door: DevelopmentDoor): Promise<{ inIt: Members; atAddress: Members; overview: DevelopmentOverview | null }> {
  let memberBids: MemberBid[]
  let memberJobs: MemberJob[]
  let overview: DevelopmentOverview | null = null
  if (door === 'office') {
    // `withSupabaseRetry` hands back the rows and throws on an error; `bids.development_id` is not in the
    // generated types until the post-push types PR lands, so the rows are read through an unknown cast.
    const [bidsRaw, jobsRaw] = await Promise.all([
      withSupabaseRetry(() => supabase.from('bids').select(BID_COLUMNS).eq('development_id', developmentId).limit(500), 'development: bids'),
      withSupabaseRetry(() => supabase.from('jobs_ledger').select(JOB_COLUMNS).eq('development_id', developmentId).limit(500), 'development: jobs'),
    ])
    memberBids = ((bidsRaw ?? []) as unknown as MemberBid[]) ?? []
    memberJobs = ((jobsRaw ?? []) as unknown as MemberJob[]) ?? []
  } else {
    // The RPC is not in the generated types until the post-push types PR lands.
    const raw = await withSupabaseRetry(() => supabase.rpc('list_development_overview' as never, { p_development_id: developmentId } as never), 'read the development')
    overview = parseDevelopmentOverview(raw)
    memberBids = overview.bids
    memberJobs = overview.jobs
  }
  const keys = memberAddressKeys({ bids: memberBids, jobs: memberJobs })
  const patterns = [...keys].map(addressSearchPattern).filter(Boolean)
  const moreBids: MemberBid[] = []
  const moreJobs: MemberJob[] = []
  for (const pattern of patterns) {
    if (door === 'office') {
      const [b, j] = await Promise.all([
        supabase.from('bids').select(BID_COLUMNS).ilike('address', pattern).limit(500),
        supabase.from('jobs_ledger').select(JOB_COLUMNS).ilike('job_address', pattern).limit(500),
      ])
      fail('bids at the address', b.error)
      fail('jobs at the address', j.error)
      moreBids.push(...((b.data ?? []) as unknown as MemberBid[]))
      moreJobs.push(...((j.data ?? []) as unknown as MemberJob[]))
    } else {
      const b = await supabase.from('bids').select(BID_COLUMNS_NO_MONEY).ilike('address', pattern).limit(500)
      fail('bids at the address', b.error)
      moreBids.push(...((b.data ?? []) as unknown as MemberBid[]).map(stripBidMoney))
    }
  }
  const seenB = new Set(memberBids.map((b) => b.id))
  const seenJ = new Set(memberJobs.map((j) => j.id))
  const allBids = [...memberBids, ...moreBids.filter((b) => !seenB.has(b.id) && seenB.add(b.id))]
  const allJobs = [...memberJobs, ...moreJobs.filter((j) => !seenJ.has(j.id) && seenJ.add(j.id))]
  return { ...splitMembers({ developmentId, bids: allBids, jobs: allJobs }), overview }
}

function orRef(bidIds: string[], jobIds: string[], developmentId: string): string {
  const parts: string[] = [`development_id.eq.${developmentId}`]
  if (bidIds.length) parts.push(`bid_id.in.(${bidIds.join(',')})`)
  if (jobIds.length) parts.push(`job_ledger_id.in.(${jobIds.join(',')})`)
  return parts.join(',')
}

type RawRequest = { id: string; title: string; status: string; priority: string | null; created_at: string; closed_at: string | null; closed_note: string | null; from_user_id: string; bid_id: string | null; job_ledger_id: string | null; development_id: string | null; reference_summary: string | null }
type RawNote = { id: string; request_id: string; author_user_id: string; body: string; created_at: string }

async function readRequests(lane: 'estimators' | 'dispatch', bidIds: string[], jobIds: string[], developmentId: string): Promise<MemberRequest[]> {
  return readRequestsWhere(lane, orRef(bidIds, jobIds, developmentId))
}

/** One lane's requests matching an `or` filter over the reference columns, each with its notes oldest first; a record's own log (PR 4b) reads through here too. */
export async function readRequestsWhere(lane: 'estimators' | 'dispatch', filter: string): Promise<MemberRequest[]> {
  const table = lane === 'dispatch' ? 'dispatch_requests' : 'estimator_requests'
  const notesTable = lane === 'dispatch' ? 'dispatch_request_notes' : 'estimator_request_notes'
  const res = await supabase.from(table).select(lane === 'dispatch' ? DISPATCH_REQUEST_COLUMNS : REQUEST_COLUMNS).or(filter).order('created_at', { ascending: false }).limit(200)
  fail(table, res.error)
  const rows = (res.data ?? []) as unknown as RawRequest[]
  if (rows.length === 0) return []
  const notesRes = await supabase
    .from(notesTable)
    .select('id, request_id, author_user_id, body, created_at')
    .in(
      'request_id',
      rows.map((r) => r.id),
    )
    .order('created_at', { ascending: true })
    .limit(500)
  fail(notesTable, notesRes.error)
  const notes = (notesRes.data ?? []) as unknown as RawNote[]
  return rows.map((r) => ({ ...r, lane, notes: notes.filter((n) => n.request_id === r.id).map(({ id, author_user_id, body, created_at }) => ({ id, author_user_id, body, created_at })) }))
}

/** PostgREST's answer for a relation the schema does not have (the view before its migration is pushed), or Postgres's. */
const isMissingRelation = (code: string | null | undefined): boolean => code === 'PGRST205' || code === '42P01'
/** PostgREST's answer for a function the schema does not have (the RPC before its migration is pushed), or Postgres's. */
const isMissingFunction = (code: string | null | undefined): boolean => code === 'PGRST202' || code === '42883'

/**
 * The payers' pace for the Money look's expected day (punch list #280 PR 2, v2.6739): `get_customer_pay_speeds`
 * cut to the site's payers — on the real site the whole list was 87,600 bytes on every open for one or two
 * payers' entries. Until its migration is pushed the read falls back to the whole list, so the page stands
 * either side; any other failure leaves the day out, never the page. No payer, no read.
 */
async function readPaySpeeds(payerIds: readonly string[]): Promise<PaySpeedData | null> {
  if (payerIds.length === 0) return null
  try {
    const cut = await supabase.rpc('get_customer_pay_speeds' as never, { p_customer_ids: payerIds } as never)
    if (!cut.error) return parsePaySpeedsRpc(cut.data as unknown)
    if (!isMissingFunction((cut.error as { code?: string }).code)) return null
    const whole = await supabase.rpc('get_billed_customer_pay_speeds' as never)
    return whole.error ? null : parsePaySpeedsRpc(whole.data as unknown)
  } catch {
    return null
  }
}

type HistoryHeadsRead = { data: Array<HistoryHeadRow | HistoryRow> | null; error: { message: string } | null }

/**
 * The site's history entries for the list (punch list #280, v2.6735): the heads view, every column but
 * the body with its first `HISTORY_HEAD_CHARS` characters and its whole length — on the real site 298 KB
 * came down on every open and two thirds of it was folded mail bodies. Until the view's migration is
 * pushed the read falls back to the table whole, so the page stands either side of the push.
 */
async function readHistoryHeads(developmentId: string): Promise<HistoryHeadsRead> {
  const heads = await supabase.from('development_history_heads' as never).select(HISTORY_HEAD_COLUMNS).eq('development_id', developmentId).order('happened_at', { ascending: false }).limit(500)
  if (!heads.error) return { data: (heads.data ?? []) as unknown as HistoryHeadRow[], error: null }
  if (!isMissingRelation((heads.error as { code?: string }).code)) return { data: null, error: heads.error }
  const whole = await supabase.from('development_history_entries' as never).select('*').eq('development_id', developmentId).order('happened_at', { ascending: false }).limit(500)
  return { data: whole.error ? null : ((whole.data ?? []) as unknown as HistoryRow[]), error: whole.error }
}

/** One entry's whole body, for the window a line's *more ›* opens (punch list #280); throws with the reason. */
export async function readHistoryBody(entryId: string): Promise<string> {
  const row = (await withSupabaseRetry(() => supabase.from('development_history_entries' as never).select('id, body').eq('id', entryId).maybeSingle(), 'read history line')) as unknown as { body: string } | null
  if (!row) throw new Error('This line is no longer here.')
  return row.body
}

/** Every entry's whole body for a site, keyed by id: read once when a search is typed, since a search reads every word (punch list #280). */
export async function readHistoryBodies(developmentId: string): Promise<Map<string, string>> {
  const rows = (await withSupabaseRetry(() => supabase.from('development_history_entries' as never).select('id, body').eq('development_id', developmentId).limit(500), 'read history lines')) as unknown as Array<{ id: string; body: string }> | null
  return new Map((rows ?? []).map((r) => [r.id, r.body]))
}

/** The people's names by id, for the lines that say who; a name that is blank reads as a dash. */
export async function readUserNames(userIds: readonly string[]): Promise<Map<string, string>> {
  return (await readUserNamesAndTwins(userIds)).names
}

/** The names, and which of the people are digital twins (the robot estimators), in one read. */
export async function readUserNamesAndTwins(userIds: readonly string[]): Promise<{ names: Map<string, string>; twinUserIds: Set<string> }> {
  const names = new Map<string, string>()
  const twinUserIds = new Set<string>()
  if (userIds.length === 0) return { names, twinUserIds }
  const usersRes = await supabase.from('users').select('id, name, is_digital_twin').in('id', [...userIds]).limit(500)
  fail('people', usersRes.error)
  for (const u of (usersRes.data ?? []) as Array<{ id: string; name: string | null; is_digital_twin: boolean | null }>) {
    names.set(u.id, (u.name ?? '').trim() || '—')
    if (u.is_digital_twin) twinUserIds.add(u.id)
  }
  return { names, twinUserIds }
}

/**
 * The whole page. `includeAddress` widens every list to the records at the members' address that
 * are not in the development (the spike's toggle; PR 3's *Put the N in* is the write that makes
 * the toggle unnecessary). `door` is the reader's (`developmentDoorFor`): the office reads every
 * table; the overview door reads the pieces through the definer read and no money at all.
 */
export async function fetchDevelopmentPage(developmentId: string, includeAddress: boolean, door: DevelopmentDoor = 'office'): Promise<DevelopmentPageData> {
  const office = door === 'office'
  // The read is four round trips deep, not seven (the Gray Fox spike, 2026-11-02): the row and the members go
  // out together, the pay-speed read rides in the fan-out once the members name the payers (punch list #280 PR 2;
  // it left at once for every billed customer before), the prior numbers ride there too, and only the names
  // wait on everything.
  const [devRow, members] = await Promise.all([
    withSupabaseRetry(
      () => supabase.from('developments').select('id, name, gc_customer_id, city, notes, archived_at, created_at').eq('id', developmentId).maybeSingle(),
      'development: row',
    ) as unknown as Promise<DevelopmentRow | null>,
    readMembers(developmentId, door),
  ])
  if (!devRow) throw new Error('This development is not here. It may have been deleted, or it belongs to another company.')
  const development = devRow

  const { inIt, atAddress, overview } = members
  const shown: Members = includeAddress ? { bids: [...inIt.bids, ...atAddress.bids], jobs: [...inIt.jobs, ...atAddress.jobs] } : inIt
  const bidIds = shown.bids.map((b) => b.id)
  const jobIds = shown.jobs.map((j) => j.id)
  // The numbers a job answered to before a combine (v2.6226): a read that fails soft, so the page stands before
  // the column's migration is pushed and the figure is a courtesy after. It rides with the fan-out below.
  const priorNumbersP: Promise<void> = jobIds.length
    ? (async () => {
        try {
          const { data } = await supabase.from('jobs_ledger').select('id, prior_numbers').in('id', jobIds).limit(500)
          const byId = new Map((data ?? []).map((r) => [r.id as string, (r.prior_numbers ?? []) as string[]]))
          for (const j of shown.jobs) j.prior_numbers = byId.get(j.id) ?? []
        } catch {
          /* the column is not there yet, or the read failed: the job lines carry no prior numbers */
        }
      })()
    : Promise.resolve()

  const customerTally = new Map<string, number>()
  for (const b of shown.bids) if (b.customer_id) customerTally.set(b.customer_id, (customerTally.get(b.customer_id) ?? 0) + 1)
  for (const j of shown.jobs) if (j.customer_id) customerTally.set(j.customer_id, (customerTally.get(j.customer_id) ?? 0) + 1)
  let customerId: string | null = null
  let best = 0
  for (const [id, n] of customerTally) {
    if (n > best) {
      best = n
      customerId = id
    }
  }

  const customerIds = [customerId, development.gc_customer_id].filter((x): x is string => !!x)
  // The Money look's expected day reads the site's payers' pace (every job the page holds, the ones at the address too, so the toggle asks nothing more); a failed read leaves the day out, never the page. The overview door has no Money look, so it does not ask.
  const paySpeedP: Promise<PaySpeedData | null> = office ? readPaySpeeds(paySpeedPayerIds([...inIt.jobs, ...atAddress.jobs])) : Promise.resolve(null)

  const [estReq, dispReq, entriesRes, changesRes, eventsRes, invoicesRes, paymentsRes, notesRes, teamRes, customersRes, bidNotesRes, contactsRes, historyRes] = await Promise.all([
    readRequests('estimators', bidIds, jobIds, developmentId),
    readRequests('dispatch', bidIds, jobIds, developmentId),
    bidIds.length
      ? supabase.from('bids_submission_entries').select('id, bid_id, occurred_at, contact_method, notes, created_by').in('bid_id', bidIds).order('occurred_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    bidIds.length
      ? supabase.from('bid_changes').select('id, bid_id, changed_at, changed, changed_by').in('bid_id', bidIds).overlaps('changed', ['plans_link', 'design_drawing_plan_date']).order('changed_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    // The jobs' children: the office reads them under its own policies; the overview door has the moves and crews from the definer read and never reads a bill, a payment or a job note.
    office && jobIds.length
      ? supabase.from('job_status_events').select('id, job_id, changed_at, from_status, to_status, changed_by_user_id').in('job_id', jobIds).order('changed_at', { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
    office && jobIds.length
      ? supabase.from('jobs_ledger_invoices').select('id, job_id, amount, status, billed_at, sent_to_customer_at, created_at, sent_by_user_id').in('job_id', jobIds).limit(500)
      : Promise.resolve({ data: [], error: null }),
    office && jobIds.length ? supabase.from('jobs_ledger_payments').select('id, job_id, amount, paid_on, created_at, created_by, payment_type, note').in('job_id', jobIds).limit(500) : Promise.resolve({ data: [], error: null }),
    office && jobIds.length
      ? supabase.from('jobs_ledger_thread_notes').select('id, job_id, created_at, author_user_id, body').in('job_id', jobIds).order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    office && jobIds.length ? supabase.from('jobs_ledger_team_members').select('job_id, user_id').in('job_id', jobIds).limit(500) : Promise.resolve({ data: [], error: null }),
    customerIds.length ? supabase.from('customers').select('id, name, contact_info, payment_terms_note, lien_notice_policy_note').in('id', customerIds) : Promise.resolve({ data: [], error: null }),
    bidIds.length
      ? supabase.from('estimates_thread_notes').select('id, estimate_id, created_at, author_user_id, body').in('estimate_id', bidIds).order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? supabase.from('customer_contacts').select('id, customer_id, contact_date, contact_method, details, created_by').in('customer_id', customerIds).order('contact_date', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    readHistoryHeads(developmentId),
    priorNumbersP,
  ])
  fail('submission entries', entriesRes.error)
  fail('bid changes', changesRes.error)
  fail('status events', eventsRes.error)
  fail('invoices', invoicesRes.error)
  fail('payments', paymentsRes.error)
  fail('notes', notesRes.error)
  fail('bid notes', bidNotesRes.error)
  fail('customer contacts', contactsRes.error)
  // The entries' table lands with its migration after the client deploys (v2.6042): until then the read fails and the stream goes without them, and the composer's keep names the reason.
  if (historyRes.error) console.warn('development: history entries not read', historyRes.error.message)
  fail('team', teamRes.error)
  fail('customers', customersRes.error)
  const statusEvents = office ? ((eventsRes.data ?? []) as DevelopmentPageData['statusEvents']) : overview?.statusEvents ?? []
  const teamMembers = office ? ((teamRes.data ?? []) as DevelopmentPageData['teamMembers']) : overview?.teamMembers ?? []

  const requests = [...estReq, ...dispReq]
  const userIds = new Set<string>()
  for (const b of shown.bids) {
    if (b.estimator_id) userIds.add(b.estimator_id)
    if (b.account_manager_id) userIds.add(b.account_manager_id)
  }
  for (const j of shown.jobs) if (j.account_manager_user_id) userIds.add(j.account_manager_user_id)
  for (const r of requests) {
    userIds.add(r.from_user_id)
    for (const n of r.notes) userIds.add(n.author_user_id)
  }
  for (const e of (entriesRes.data ?? []) as Array<{ created_by: string | null }>) if (e.created_by) userIds.add(e.created_by)
  for (const c of (changesRes.data ?? []) as Array<{ changed_by: string | null }>) if (c.changed_by) userIds.add(c.changed_by)
  for (const ev of statusEvents) if (ev.changed_by_user_id) userIds.add(ev.changed_by_user_id)
  for (const n of (notesRes.data ?? []) as Array<{ author_user_id: string }>) userIds.add(n.author_user_id)
  for (const n of (bidNotesRes.data ?? []) as Array<{ author_user_id: string }>) userIds.add(n.author_user_id)
  for (const c of (contactsRes.data ?? []) as Array<{ created_by: string | null }>) if (c.created_by) userIds.add(c.created_by)
  for (const h of historyRes.data ?? []) if (h.author_user_id) userIds.add(h.author_user_id)
  for (const t of teamMembers) userIds.add(t.user_id)
  // Who sent the bills and booked the payments, named on the Scoreboard's office line (v2.6457).
  for (const i of (invoicesRes.data ?? []) as Array<{ sent_by_user_id?: string | null }>) if (i.sent_by_user_id) userIds.add(i.sent_by_user_id)
  for (const p of (paymentsRes.data ?? []) as Array<{ created_by?: string | null }>) if (p.created_by) userIds.add(p.created_by)
  const { names, twinUserIds } = await readUserNamesAndTwins([...userIds])
  const customers = (customersRes.data ?? []) as Array<{ id: string; name: string; contact_info: unknown; payment_terms_note: string | null; lien_notice_policy_note: string | null }>
  const customer = customerId ? customers.find((c) => c.id === customerId) ?? null : null
  const gc = development.gc_customer_id ? customers.find((c) => c.id === development.gc_customer_id) ?? null : null

  const paySpeed = await paySpeedP

  return {
    development,
    gcCustomer: gc ? { id: gc.id, name: gc.name } : null,
    customer,
    inIt,
    atAddress,
    requests,
    submissionEntries: (entriesRes.data ?? []) as DevelopmentPageData['submissionEntries'],
    bidChanges: (changesRes.data ?? []) as DevelopmentPageData['bidChanges'],
    statusEvents,
    invoices: (invoicesRes.data ?? []) as DevelopmentPageData['invoices'],
    payments: (paymentsRes.data ?? []) as DevelopmentPageData['payments'],
    threadNotes: (notesRes.data ?? []) as DevelopmentPageData['threadNotes'],
    bidNotes: (bidNotesRes.data ?? []) as DevelopmentPageData['bidNotes'],
    customers: customers.map(({ id, name, payment_terms_note, lien_notice_policy_note }) => ({ id, name, payment_terms_note: payment_terms_note ?? null, lien_notice_policy_note: lien_notice_policy_note ?? null })),
    customerContacts: (contactsRes.data ?? []) as DevelopmentPageData['customerContacts'],
    historyEntries: historyRes.error ? [] : (historyRes.data ?? []).map((h) => ('body_head' in h ? headRowToEntry(h, names) : rowToEntry(h, names))),
    teamMembers,
    names,
    twinUserIds,
    paySpeed,
  }
}
