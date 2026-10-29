/**
 * The Development page's reads (punch list #208, design spike): everything the page draws, under
 * the reader's own policies (the office set reads all of it; the estimator's definer read is PR 6).
 * Members come by `development_id`; the records at the members' address that are not in it come by
 * an address search narrowed to exact normalized-key matches in `splitMembers`, so the real site
 * (13 bids and 29 jobs at one address, 9 jobs tagged) fills the page without a write.
 */
import { rowToEntry, type HistoryEntry, type HistoryRow } from './history'
import { supabase } from '../supabase'
import { parsePaySpeedsRpc, type PaySpeedData } from '../jobs/billedExpectedPay'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { addressSearchPattern, memberAddressKeys, splitMembers, type MemberBid, type MemberJob, type MemberRequest, type Members } from './overview'

const BID_COLUMNS =
  'id, bid_number, project_name, address, customer_id, estimator_id, account_manager_id, development_id, outcome, outcome_at, bid_value, agreed_value, priced_revenue_usd, bid_date_sent, bid_due_date, estimated_job_start_date, plans_link, design_drawing_plan_date, gc_contact_name, gc_contact_phone, gc_contact_email, created_at, updated_at, working_board_archived_at, working_board_archived_by, service_type_id, last_contact, notes'
const JOB_COLUMNS =
  'id, hcp_number, click_number, job_name, job_address, customer_id, customer_name, gc_customer_id, development_id, bid_id, status, revenue, payments_made, last_work_date, last_bill_date, job_plans_link, created_at, updated_at, service_type_id, account_manager_user_id, pct_complete, collections_note'
const REQUEST_COLUMNS = 'id, title, status, priority, created_at, closed_at, closed_note, from_user_id, bid_id, job_ledger_id, development_id, reference_summary'

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
  invoices: Array<{ id: string; job_id: string; amount: number; status: string; billed_at: string | null; sent_to_customer_at: string | null; created_at: string | null }>
  payments: Array<{ id: string; job_id: string; amount: number; paid_on: string | null; created_at: string | null }>
  threadNotes: Array<{ id: string; job_id: string; created_at: string; author_user_id: string; body: string }>
  /** A bid's thread notes, keyed by the bid's id (`estimate_id`). */
  bidNotes: Array<{ id: string; estimate_id: string; created_at: string; author_user_id: string; body: string }>
  teamMembers: Array<{ job_id: string; user_id: string }>
  names: Map<string, string>
  /** The pay-speed read the Pipeline's billed rows make (`get_billed_customer_pay_speeds`), for the Money look's expected day; null when the read fails. */
  paySpeed: PaySpeedData | null
}

function fail(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`${label}: ${error.message}`)
}

/** Members and the address matches: two reads by `development_id`, then one address search per shared address. */
async function readMembers(developmentId: string): Promise<{ inIt: Members; atAddress: Members }> {
  // `withSupabaseRetry` hands back the rows and throws on an error; `bids.development_id` is not in the
  // generated types until the post-push types PR lands, so the rows are read through an unknown cast.
  const [bidsRaw, jobsRaw] = await Promise.all([
    withSupabaseRetry(() => supabase.from('bids').select(BID_COLUMNS).eq('development_id', developmentId).limit(500), 'development: bids'),
    withSupabaseRetry(() => supabase.from('jobs_ledger').select(JOB_COLUMNS).eq('development_id', developmentId).limit(500), 'development: jobs'),
  ])
  const memberBids = ((bidsRaw ?? []) as unknown as MemberBid[]) ?? []
  const memberJobs = ((jobsRaw ?? []) as unknown as MemberJob[]) ?? []
  const keys = memberAddressKeys({ bids: memberBids, jobs: memberJobs })
  const patterns = [...keys].map(addressSearchPattern).filter(Boolean)
  const moreBids: MemberBid[] = []
  const moreJobs: MemberJob[] = []
  for (const pattern of patterns) {
    const [b, j] = await Promise.all([
      supabase.from('bids').select(BID_COLUMNS).ilike('address', pattern).limit(500),
      supabase.from('jobs_ledger').select(JOB_COLUMNS).ilike('job_address', pattern).limit(500),
    ])
    fail('bids at the address', b.error)
    fail('jobs at the address', j.error)
    moreBids.push(...((b.data ?? []) as unknown as MemberBid[]))
    moreJobs.push(...((j.data ?? []) as unknown as MemberJob[]))
  }
  const seenB = new Set(memberBids.map((b) => b.id))
  const seenJ = new Set(memberJobs.map((j) => j.id))
  const allBids = [...memberBids, ...moreBids.filter((b) => !seenB.has(b.id) && seenB.add(b.id))]
  const allJobs = [...memberJobs, ...moreJobs.filter((j) => !seenJ.has(j.id) && seenJ.add(j.id))]
  return splitMembers({ developmentId, bids: allBids, jobs: allJobs })
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
  const filter = orRef(bidIds, jobIds, developmentId)
  const table = lane === 'dispatch' ? 'dispatch_requests' : 'estimator_requests'
  const notesTable = lane === 'dispatch' ? 'dispatch_request_notes' : 'estimator_request_notes'
  const res = await supabase.from(table).select(REQUEST_COLUMNS).or(filter).order('created_at', { ascending: false }).limit(200)
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

/**
 * The whole page. `includeAddress` widens every list to the records at the members' address that
 * are not in the development (the spike's toggle; PR 3's *Put the N in* is the write that makes
 * the toggle unnecessary).
 */
export async function fetchDevelopmentPage(developmentId: string, includeAddress: boolean): Promise<DevelopmentPageData> {
  const devRow = (await withSupabaseRetry(
    () => supabase.from('developments').select('id, name, gc_customer_id, city, notes, archived_at, created_at').eq('id', developmentId).maybeSingle(),
    'development: row',
  )) as unknown as DevelopmentRow | null
  if (!devRow) throw new Error('This development is not here. It may have been deleted, or it belongs to another company.')
  const development = devRow

  const { inIt, atAddress } = await readMembers(developmentId)
  const shown: Members = includeAddress ? { bids: [...inIt.bids, ...atAddress.bids], jobs: [...inIt.jobs, ...atAddress.jobs] } : inIt
  const bidIds = shown.bids.map((b) => b.id)
  const jobIds = shown.jobs.map((j) => j.id)

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

  const [estReq, dispReq, entriesRes, changesRes, eventsRes, invoicesRes, paymentsRes, notesRes, teamRes, customersRes, bidNotesRes, contactsRes, historyRes] = await Promise.all([
    readRequests('estimators', bidIds, jobIds, developmentId),
    readRequests('dispatch', bidIds, jobIds, developmentId),
    bidIds.length
      ? supabase.from('bids_submission_entries').select('id, bid_id, occurred_at, contact_method, notes, created_by').in('bid_id', bidIds).order('occurred_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    bidIds.length
      ? supabase.from('bid_changes').select('id, bid_id, changed_at, changed, changed_by').in('bid_id', bidIds).overlaps('changed', ['plans_link', 'design_drawing_plan_date']).order('changed_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? supabase.from('job_status_events').select('id, job_id, changed_at, from_status, to_status, changed_by_user_id').in('job_id', jobIds).order('changed_at', { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? supabase.from('jobs_ledger_invoices').select('id, job_id, amount, status, billed_at, sent_to_customer_at, created_at').in('job_id', jobIds).limit(500)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length ? supabase.from('jobs_ledger_payments').select('id, job_id, amount, paid_on, created_at').in('job_id', jobIds).limit(500) : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? supabase.from('jobs_ledger_thread_notes').select('id, job_id, created_at, author_user_id, body').in('job_id', jobIds).order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length ? supabase.from('jobs_ledger_team_members').select('job_id, user_id').in('job_id', jobIds).limit(500) : Promise.resolve({ data: [], error: null }),
    customerIds.length ? supabase.from('customers').select('id, name, contact_info, payment_terms_note, lien_notice_policy_note').in('id', customerIds) : Promise.resolve({ data: [], error: null }),
    bidIds.length
      ? supabase.from('estimates_thread_notes').select('id, estimate_id, created_at, author_user_id, body').in('estimate_id', bidIds).order('created_at', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? supabase.from('customer_contacts').select('id, customer_id, contact_date, contact_method, details, created_by').in('customer_id', customerIds).order('contact_date', { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('development_history_entries' as never).select('*').eq('development_id', developmentId).order('happened_at', { ascending: false }).limit(500),
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
  for (const ev of (eventsRes.data ?? []) as Array<{ changed_by_user_id: string | null }>) if (ev.changed_by_user_id) userIds.add(ev.changed_by_user_id)
  for (const n of (notesRes.data ?? []) as Array<{ author_user_id: string }>) userIds.add(n.author_user_id)
  for (const n of (bidNotesRes.data ?? []) as Array<{ author_user_id: string }>) userIds.add(n.author_user_id)
  for (const c of (contactsRes.data ?? []) as Array<{ created_by: string | null }>) if (c.created_by) userIds.add(c.created_by)
  for (const h of (historyRes.data ?? []) as unknown as HistoryRow[]) if (h.author_user_id) userIds.add(h.author_user_id)
  for (const t of (teamRes.data ?? []) as Array<{ user_id: string }>) userIds.add(t.user_id)
  const names = new Map<string, string>()
  if (userIds.size) {
    const usersRes = await supabase.from('users').select('id, name').in('id', [...userIds]).limit(500)
    fail('people', usersRes.error)
    for (const u of (usersRes.data ?? []) as Array<{ id: string; name: string | null }>) names.set(u.id, (u.name ?? '').trim() || '—')
  }
  const customers = (customersRes.data ?? []) as Array<{ id: string; name: string; contact_info: unknown; payment_terms_note: string | null; lien_notice_policy_note: string | null }>
  const customer = customerId ? customers.find((c) => c.id === customerId) ?? null : null
  const gc = development.gc_customer_id ? customers.find((c) => c.id === development.gc_customer_id) ?? null : null

  // The Money look's expected day reads the payer's pace the way the Pipeline does; a failed read leaves the day out, never the page.
  let paySpeed: PaySpeedData | null = null
  try {
    const speeds = await supabase.rpc('get_billed_customer_pay_speeds' as never)
    paySpeed = speeds.error ? null : parsePaySpeedsRpc(speeds.data as unknown)
  } catch {
    paySpeed = null
  }

  return {
    development,
    gcCustomer: gc ? { id: gc.id, name: gc.name } : null,
    customer,
    inIt,
    atAddress,
    requests,
    submissionEntries: (entriesRes.data ?? []) as DevelopmentPageData['submissionEntries'],
    bidChanges: (changesRes.data ?? []) as DevelopmentPageData['bidChanges'],
    statusEvents: (eventsRes.data ?? []) as DevelopmentPageData['statusEvents'],
    invoices: (invoicesRes.data ?? []) as DevelopmentPageData['invoices'],
    payments: (paymentsRes.data ?? []) as DevelopmentPageData['payments'],
    threadNotes: (notesRes.data ?? []) as DevelopmentPageData['threadNotes'],
    bidNotes: (bidNotesRes.data ?? []) as DevelopmentPageData['bidNotes'],
    customers: customers.map(({ id, name, payment_terms_note, lien_notice_policy_note }) => ({ id, name, payment_terms_note: payment_terms_note ?? null, lien_notice_policy_note: lien_notice_policy_note ?? null })),
    customerContacts: (contactsRes.data ?? []) as DevelopmentPageData['customerContacts'],
    historyEntries: historyRes.error ? [] : ((historyRes.data ?? []) as unknown as HistoryRow[]).map((h) => rowToEntry(h, names)),
    teamMembers: (teamRes.data ?? []) as DevelopmentPageData['teamMembers'],
    names,
    paySpeed,
  }
}
