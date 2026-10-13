/**
 * Messages, cut 1's screens: the reads and the presses, for the Messages view and the thread window on GC projects.
 * The spine's tables (migration 20261012010000_messages_spine.sql) are read as the signed-in user, so only the office
 * team gets rows; the presses are the spine's functions and the two `contact_jobs` writes its grants allow. The tables
 * are not in the generated types until the migration is pushed, so their names go through `as never` here, as
 * `sentCopiesIo` does, and the rows are typed by the loaders (`contacts/load.ts`, `messages/load.ts`).
 *
 * The thread also shows every email the app already sent (`sent_documents`, through `loadSentEmailsTo`): a read-side
 * overlay, never rows written into `messages` (cut 6 backfills those).
 */
import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { jobActivityMessagesFromRows, jobTakesUntiedLines, type JobActivityMessage, type JobMessageContact, type JobMessageRow } from '../jobs/jobActivityMessages'
import type { Contact, ContactKind, ContactRecord } from '../contacts/kernel'
import { contactsFromRows, type ContactChannelRow, type ContactJobRow, type ContactRecordRows, type ContactRow } from '../contacts/load'
import { loadSentEmailsTo } from '../sent/sentCopiesIo'
import { factJobKeys, railJobKeys, type InviteJobRow, type ProjectRolesRow } from './factJobs'
import { jobTilesByKey, type BidTileRow, type GcProjectTileRow, type JobTile, type PipelineTileRow } from './jobTiles'
import { jobRefOf, threadMessagesFromRows, type MessageRow } from './load'
import { sentLines } from './sentLines'
import type { ThreadMessage } from './thread'

/** Everything the Messages view and a thread window draw. */
export interface MessagesView {
  contacts: Contact[]
  /** The thread's own lines and the sent copies' overlay, oldest first. */
  messages: ThreadMessage[]
  /** Each person's rail: the office's ties, then the jobs the facts give. */
  rails: Record<string, string[]>
  /** Every job on a rail or a line, by key. */
  tiles: Record<string, JobTile>
  userNames: Record<string, string>
}

type Result<T> = { data: T | null; error: SupabaseResultError | null; status?: number }

function taken<T>(result: Result<T>, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data
}

/** The spine's tables and functions are not in the generated types until the migration is pushed. */
const from = (table: string) => supabase.from(table as never)
const rpc = (fn: string, args: Record<string, unknown>) => supabase.rpc(fn as never, args as never)

const CONTACT_COLS = 'id, kind, customer_id, customer_contact_person_id, gc_company_id, gc_company_person_id, person_id, name, goes_by, off_since, off_why, off_by'
const CHANNEL_COLS = 'id, contact_id, kind, value, opted_out_at, created_at'
const JOB_COLS = 'contact_id, bid_id, project_id, jobs_ledger_id, is_default, created_at'
const MESSAGE_COLS =
  'id, contact_id, channel_id, bid_id, project_id, jobs_ledger_id, channel, direction, who_user_id, who_text, at, subject, body, optout_line, back_on, back_by'
/** A job's lines also read cut 5's call columns (20261012170000_quo_messages.sql): a call's length, summary and words. */
const JOB_MESSAGE_COLS = `${MESSAGE_COLS}, duration_seconds, summary, transcript`
/** The most lines one job's read brings, each way: the newest, so a long job drops its oldest lines first. */
const JOB_MESSAGES_MAX = 1000

const unique = (ids: readonly (string | null | undefined)[]) => [...new Set(ids.filter((id): id is string => Boolean(id)))]

/** `.in()` in slices, so a long list never makes a URL too long. */
async function inSlices<T>(ids: readonly string[], read: (slice: string[]) => PromiseLike<Result<T[]>>, operation: string): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 150) out.push(...taken(await read(ids.slice(i, i + 150)), operation))
  return out
}

/** The spine's rows, as the loaders read them. */
export async function loadSpineRows(): Promise<{ contacts: ContactRow[]; channels: ContactChannelRow[]; jobs: ContactJobRow[]; messages: MessageRow[] }> {
  const [contacts, channels, jobs, messages] = await Promise.all([
    fetchAllRows<ContactRow>((a, b) => from('contacts').select(CONTACT_COLS).order('id').range(a, b) as never, 'load the contacts'),
    fetchAllRows<ContactChannelRow>((a, b) => from('contact_channels').select(CHANNEL_COLS).order('id').range(a, b) as never, 'load their numbers and addresses'),
    fetchAllRows<ContactJobRow>((a, b) => from('contact_jobs').select(JOB_COLS).order('created_at').range(a, b) as never, 'load their jobs'),
    fetchAllRows<MessageRow>((a, b) => from('messages').select(MESSAGE_COLS).order('at').order('id').range(a, b) as never, 'load the messages'),
  ])
  return { contacts, channels, jobs, messages }
}

/** The records the contacts point at, as much of each as a name, a company and a trade need. */
async function loadRecords(rows: readonly ContactRow[]): Promise<ContactRecordRows> {
  const persons = await inSlices<{ id: string; customer_id: string; name: string }>(
    unique(rows.map((r) => r.customer_contact_person_id)),
    (ids) => supabase.from('customer_contact_persons').select('id, customer_id, name').in('id', ids),
    'load the people at the customers',
  )
  const gcPeople = await inSlices<{ id: string; company_id: string; name: string }>(
    unique(rows.map((r) => r.gc_company_person_id)),
    (ids) => supabase.from('gc_company_people').select('id, company_id, name').in('id', ids),
    'load the people the trade partners named',
  )
  const [customers, gcCompanies, people] = await Promise.all([
    inSlices<{ id: string; name: string }>(
      unique([...rows.map((r) => r.customer_id), ...persons.map((p) => p.customer_id)]),
      (ids) => supabase.from('customers').select('id, name').in('id', ids),
      'load the customers',
    ),
    inSlices<{ id: string; name: string; contact_name: string; trades: string[] }>(
      unique([...rows.map((r) => r.gc_company_id), ...gcPeople.map((p) => p.company_id)]),
      (ids) => supabase.from('gc_companies').select('id, name, contact_name, trades').in('id', ids),
      'load the trade partners',
    ),
    inSlices<{ id: string; name: string }>(unique(rows.map((r) => r.person_id)), (ids) => supabase.from('people').select('id, name').in('id', ids), 'load the roster'),
  ])
  return { customers, customerContactPersons: persons, gcCompanies, gcCompanyPeople: gcPeople, people }
}

/** The jobs the facts give: a customer's GC projects in its three roles, a trade partner's asks. */
async function loadFactRows(contacts: readonly Contact[]): Promise<{ projects: ProjectRolesRow[]; invites: InviteJobRow[] }> {
  const customerIds = unique(contacts.map((c) => c.customerId))
  const companyIds = unique(contacts.map((c) => c.gcCompanyId))
  type Roles = { project_id: string; architect_customer_id: string | null; property_owner_customer_id: string | null }
  const rolesBy = (column: 'architect_customer_id' | 'property_owner_customer_id') =>
    inSlices<Roles>(
      customerIds,
      (ids) => supabase.from('gc_projects').select('project_id, architect_customer_id, property_owner_customer_id').in(column, ids),
      'load the projects they draw or own',
    )
  const [owned, drawn, ownedProperty, asks] = await Promise.all([
    inSlices<{ id: string; customer_id: string | null }>(customerIds, (ids) => supabase.from('projects').select('id, customer_id').in('customer_id', ids), 'load the customers’ projects'),
    rolesBy('architect_customer_id'),
    rolesBy('property_owner_customer_id'),
    inSlices<{ company_id: string; package_id: string }>(companyIds, (ids) => supabase.from('gc_invites').select('company_id, package_id').in('company_id', ids), 'load the trade partners’ asks'),
  ])
  const roles = [...drawn, ...ownedProperty]
  const gcIds = new Set(
    (await inSlices<{ project_id: string }>(unique(owned.map((p) => p.id)), (ids) => supabase.from('gc_projects').select('project_id').in('project_id', ids), 'load the GC projects')).map(
      (p) => p.project_id,
    ),
  )
  const packages = await inSlices<{ id: string; project_id: string }>(
    unique(asks.map((a) => a.package_id)),
    (ids) => supabase.from('gc_trade_packages').select('id, project_id').in('id', ids),
    'load the asks’ jobs',
  )
  const projectOf = new Map(packages.map((p) => [p.id, p.project_id]))
  return {
    projects: [
      ...owned.filter((p) => gcIds.has(p.id)).map((p) => ({ project_id: p.id, customer_id: p.customer_id, property_owner_customer_id: null, architect_customer_id: null })),
      ...roles.map((r) => ({ project_id: r.project_id, customer_id: null, property_owner_customer_id: r.property_owner_customer_id, architect_customer_id: r.architect_customer_id })),
    ],
    invites: asks.flatMap((a) => {
      const project = projectOf.get(a.package_id)
      return project ? [{ company_id: a.company_id, project_id: project }] : []
    }),
  }
}

/** Every job's tile, by key. */
async function loadTiles(keys: readonly string[], todayYmd: string): Promise<Record<string, JobTile>> {
  const refs = keys.map(jobRefOf).filter((r): r is NonNullable<ReturnType<typeof jobRefOf>> => r !== null)
  const ids = (kind: string) => unique(refs.filter((r) => r.kind === kind).map((r) => r.id))
  const [bids, gc, names, pipeline] = await Promise.all([
    inSlices<BidTileRow>(ids('bid'), (s) => supabase.from('bids').select('id, bid_number, project_name, bid_due_date, bid_date_sent, outcome').in('id', s), 'load the bids'),
    inSlices<Omit<GcProjectTileRow, 'name' | 'project_number'>>(
      ids('project'),
      (s) => supabase.from('gc_projects').select('project_id, stage, bid_due, our_bid_sent_on, lost_on, started_on').in('project_id', s),
      'load the GC projects',
    ),
    inSlices<{ id: string; name: string; project_number: string | null }>(ids('project'), (s) => supabase.from('projects').select('id, name, project_number').in('id', s), 'load the projects’ names'),
    inSlices<PipelineTileRow>(ids('pipeline'), (s) => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, status').in('id', s), 'load the Pipeline jobs'),
  ])
  const named = new Map(names.map((n) => [n.id, n]))
  return jobTilesByKey(
    { bids, projects: gc.map((g) => ({ ...g, name: named.get(g.project_id)?.name ?? '', project_number: named.get(g.project_id)?.project_number ?? null })), pipeline },
    todayYmd,
  )
}

/** Everything the view and the window draw, at `nowIso`. */
export async function loadMessagesView(nowIso: string): Promise<MessagesView> {
  const spine = await loadSpineRows()
  const records = await loadRecords(spine.contacts)
  const contacts = contactsFromRows(spine.contacts, spine.channels, spine.jobs, records)
  const userIds = unique([...spine.messages.flatMap((m) => [m.who_user_id, m.back_by]), ...spine.contacts.map((c) => c.off_by)])
  const [users, facts, copies] = await Promise.all([
    inSlices<{ id: string; name: string | null }>(userIds, (ids) => supabase.from('users').select('id, name').in('id', ids), 'load the names of the team'),
    loadFactRows(contacts),
    loadSentEmailsTo(contacts.flatMap((c) => c.channels.filter((ch) => ch.kind === 'email').map((ch) => ch.value))),
  ])
  const userNames = Object.fromEntries(users.map((u) => [u.id, u.name ?? '']))
  const messages = [...threadMessagesFromRows(spine.messages, { userNames, contacts }), ...sentLines(copies, contacts)].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  )
  const factKeys = factJobKeys(contacts, facts)
  const rails = Object.fromEntries(contacts.map((c) => [c.id, railJobKeys(c, factKeys[c.id] ?? [])]))
  const keys = unique([...Object.values(rails).flat(), ...messages.map((m) => m.jobId)])
  const tiles = await loadTiles(keys, calendarYmdInAppTzFromIso(nowIso))
  return { contacts, messages, rails, tiles, userNames }
}

/**
 * One Pipeline job's calls, texts and emails for its Job activity (cut 10, J2): the lines tied to the job, and while
 * the job is open the lines of the customer's people put on it that are tied to no job yet, since the job began
 * (`jobActivityMessagesFromRows` keeps the rule). Read as the signed-in user, so only the office team gets rows. It
 * leans on v2.5353's indexes: `messages_pipeline_job` and `contact_jobs_pipeline_job`.
 */
export async function loadJobMessages(job: { id: string; status: string | null; createdAt: string | null }): Promise<JobActivityMessage[]> {
  const [tied, on] = await Promise.all([
    from('messages').select(JOB_MESSAGE_COLS).eq('jobs_ledger_id', job.id).order('at', { ascending: false }).limit(JOB_MESSAGES_MAX) as unknown as PromiseLike<Result<JobMessageRow[]>>,
    jobTakesUntiedLines(job.status)
      ? (from('contact_jobs').select('contact_id').eq('jobs_ledger_id', job.id) as unknown as PromiseLike<Result<{ contact_id: string }[]>>)
      : Promise.resolve({ data: [] as { contact_id: string }[], error: null }),
  ])
  const tiedRows = taken(tied, 'load the job’s messages') ?? []
  const onIds = unique((taken(on, 'load the people on the job') ?? []).map((r) => r.contact_id))
  const contactRows = await inSlices<{ id: string; kind: string; name: string | null; goes_by: string | null }>(
    unique([...tiedRows.map((r) => r.contact_id), ...onIds]),
    (ids) => from('contacts').select('id, kind, name, goes_by').in('id', ids) as never,
    'load the people on the job’s messages',
  )
  const contacts: JobMessageContact[] = contactRows.map((c) => ({ id: c.id, name: c.name ?? '', goesBy: c.goes_by, kind: c.kind as ContactKind }))
  const customersOn = contacts.filter((c) => c.kind === 'customer' && onIds.includes(c.id)).map((c) => c.id)
  const untiedRows = customersOn.length
    ? await inSlices<JobMessageRow>(
        customersOn,
        (ids) =>
          from('messages')
            .select(JOB_MESSAGE_COLS)
            .in('contact_id', ids)
            .is('bid_id', null)
            .is('project_id', null)
            .is('jobs_ledger_id', null)
            .neq('direction', 'team')
            .gte('at', job.createdAt ?? '1970-01-01T00:00:00Z')
            .order('at', { ascending: false })
            .limit(JOB_MESSAGES_MAX) as never,
        'load the customer’s lines not tied to a job',
      )
    : []
  const rows = [...tiedRows, ...untiedRows]
  const userIds = unique(rows.map((r) => r.who_user_id))
  const users = await inSlices<{ id: string; name: string | null }>(userIds, (ids) => supabase.from('users').select('id, name').in('id', ids), 'load the names of the team')
  const userNames = Object.fromEntries(users.map((u) => [u.id, u.name ?? '']))
  return jobActivityMessagesFromRows(rows, contacts, userNames, { id: job.id, since: job.createdAt })
}

// ---------- the presses ----------

const jobArgs = (key: string | null) => {
  const ref = jobRefOf(key)
  return { p_job_kind: ref?.kind ?? null, p_job_id: ref?.id ?? null }
}

/** Who is this?: the contact points at a record, or folds into the one already there. Answers who holds the thread now. */
export async function nameContact(
  contactId: string,
  target: { record: NonNullable<ContactRecord>; kind: Exclude<ContactKind, 'unknown'>; name?: string | null; jobKey?: string | null },
): Promise<string> {
  return taken(
    await rpc('name_contact', {
      p_contact_id: contactId,
      p_record_table: target.record.table,
      p_record_id: target.record.id,
      p_kind: target.kind,
      p_name: target.name?.trim() || null,
      ...jobArgs(target.jobKey ?? null),
    }),
    'name the number',
  ) as unknown as string
}

/**
 * A customer's own thread, for a press on their name (residential R2): the contact on their row with no name, made by
 * `contact_for_customer` when there is none, with the number and address their row keeps. Answers its id. The office
 * team only, said in the function's words; a training account and a twin find one and never make one.
 */
export async function contactForCustomer(customerId: string): Promise<string> {
  return taken(await rpc('contact_for_customer', { p_customer_id: customerId }), 'open their messages') as unknown as string
}

/** Ties a line to a job, or unties it (null): it then sits on the person. */
export async function tieMessage(messageId: string, jobKey: string | null): Promise<void> {
  taken(await rpc('tie_message', { p_message_id: messageId, ...jobArgs(jobKey) }), 'tie the message')
}

/** Moves the star to a job, tying the job to the person first, or takes it away (null). */
export async function setDefaultJob(contactId: string, jobKey: string | null): Promise<void> {
  taken(await rpc('set_default_job', { p_contact_id: contactId, ...jobArgs(jobKey) }), 'move the star')
}

const jobColumns = (key: string) => {
  const ref = jobRefOf(key)
  if (!ref) throw new Error('That is not a job.')
  return { bid_id: ref.kind === 'bid' ? ref.id : null, project_id: ref.kind === 'project' ? ref.id : null, jobs_ledger_id: ref.kind === 'pipeline' ? ref.id : null }
}

/** Puts a job on the person's rail. A job already there is left as it is. */
export async function addContactJob(contactId: string, jobKey: string): Promise<void> {
  const result = await from('contact_jobs').insert({ contact_id: contactId, ...jobColumns(jobKey) } as never)
  if (result.error && result.error.code === '23505') return
  taken(result, 'put the job on them')
}

/** Takes a job the office tied off the person's rail. Their lines tied to it keep their tie. */
export async function removeContactJob(contactId: string, jobKey: string): Promise<void> {
  const cols = jobColumns(jobKey)
  const [column, id] = Object.entries(cols).find(([, v]) => v !== null) as [string, string]
  taken(await from('contact_jobs').delete().eq('contact_id', contactId).eq(column, id), 'take the job off them')
}

/** A record *Who is this?* can point at, as the picker lists it. */
export interface RecordHit {
  record: NonNullable<ContactRecord>
  /** The name to show: a person, or a company. */
  label: string
  /** What it is: "Person at Cibolo Creek Partners", "Trade partner", "On the roster". */
  sub: string
  /** What they would be to us, the picker's first answer. */
  kind: Exclude<ContactKind, 'unknown'>
}

/** The records whose name holds the words, a few of each kind, for *Who is this?*. Three letters at least. */
export async function searchContactRecords(words: string): Promise<RecordHit[]> {
  const q = words.trim()
  if (q.length < 3) return []
  const like = `%${q.replace(/[%_,()]/g, ' ')}%`
  const [customers, persons, companies, gcPeople, people] = await Promise.all([
    supabase.from('customers').select('id, name').ilike('name', like).is('archived_at', null).limit(8),
    supabase.from('customer_contact_persons').select('id, name, customer_id, customers(name)').ilike('name', like).limit(8),
    supabase.from('gc_companies').select('id, name, contact_name').or(`name.ilike.${like},contact_name.ilike.${like}`).limit(8),
    supabase.from('gc_company_people').select('id, name, gc_companies(name)').ilike('name', like).is('removed_at', null).limit(8),
    supabase.from('people').select('id, name').ilike('name', like).is('archived_at', null).limit(8),
  ])
  const embedded = (v: unknown) => (Array.isArray(v) ? (v[0] as { name?: string } | undefined)?.name : (v as { name?: string } | null)?.name) ?? ''
  return [
    ...taken(companies as Result<{ id: string; name: string; contact_name: string }[]>, 'find the trade partners').map(
      (c): RecordHit => ({ record: { table: 'gc_companies', id: c.id }, label: c.contact_name?.trim() || c.name, sub: c.contact_name?.trim() ? `Trade partner · ${c.name}` : 'Trade partner', kind: 'trade' }),
    ),
    ...taken(gcPeople as Result<{ id: string; name: string; gc_companies: unknown }[]>, 'find the people the trade partners named').map(
      (p): RecordHit => ({ record: { table: 'gc_company_people', id: p.id }, label: p.name, sub: `At ${embedded(p.gc_companies) || 'a trade partner'}`, kind: 'trade' }),
    ),
    ...taken(persons as Result<{ id: string; name: string; customers: unknown }[]>, 'find the people at the customers').map(
      (p): RecordHit => ({ record: { table: 'customer_contact_persons', id: p.id }, label: p.name, sub: `At ${embedded(p.customers) || 'a customer'}`, kind: 'customer' }),
    ),
    ...taken(customers as Result<{ id: string; name: string }[]>, 'find the customers').map(
      (c): RecordHit => ({ record: { table: 'customers', id: c.id }, label: c.name, sub: 'Customer', kind: 'customer' }),
    ),
    ...taken(people as Result<{ id: string; name: string }[]>, 'find the roster').map(
      (p): RecordHit => ({ record: { table: 'people', id: p.id }, label: p.name, sub: 'On the roster', kind: 'trade' }),
    ),
  ]
}

/** The jobs whose name or number holds the words, for *+ add a job*: bids, GC projects and Pipeline jobs. Two letters at least. */
export async function searchJobs(words: string, nowIso: string): Promise<JobTile[]> {
  const q = words.trim()
  if (q.length < 2) return []
  const like = `%${q.replace(/[%_,()]/g, ' ')}%`
  const [bids, projects, pipeline] = await Promise.all([
    supabase.from('bids').select('id, bid_number, project_name, bid_due_date, bid_date_sent, outcome').or(`project_name.ilike.${like},bid_number.ilike.${like}`).limit(8),
    supabase.from('projects').select('id, name, project_number').or(`name.ilike.${like},project_number.ilike.${like}`).limit(20),
    supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, status').or(`job_name.ilike.${like},hcp_number.ilike.${like},click_number.ilike.${like}`).limit(8),
  ])
  const named = taken(projects as Result<{ id: string; name: string; project_number: string | null }[]>, 'find the projects')
  const gc = named.length
    ? taken(
        (await supabase.from('gc_projects').select('project_id, stage, bid_due, our_bid_sent_on, lost_on, started_on').in('project_id', named.map((p) => p.id))) as Result<
          Omit<GcProjectTileRow, 'name' | 'project_number'>[]
        >,
        'find the GC projects',
      )
    : []
  const byId = new Map(named.map((p) => [p.id, p]))
  const tiles = jobTilesByKey(
    {
      bids: taken(bids as Result<BidTileRow[]>, 'find the bids'),
      projects: gc.map((g) => ({ ...g, name: byId.get(g.project_id)?.name ?? '', project_number: byId.get(g.project_id)?.project_number ?? null })),
      pipeline: taken(pipeline as Result<PipelineTileRow[]>, 'find the Pipeline jobs'),
    },
    calendarYmdInAppTzFromIso(nowIso),
  )
  return Object.values(tiles)
}
