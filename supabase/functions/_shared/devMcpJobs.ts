// A job from the dev seat (v2.6790 / 0.49.0 — punch list #293, the first step of "MCP does everything a user can").
// The owner, 2026-11-09, after #290's walk had to be driven through the app in Chrome: "I would like to add verbs for
// devs to setup and update jobs and send bills." plan_job → apply_job makes the row New Job makes
// (src/components/jobs/JobFormModal.tsx createJob): one insert into jobs_ledger under RLS as the dev, then the kind as
// a second write (punch list #238's order). No RPC exists for a job's birth and none is owed: the app writes the row
// under RLS, so the seat does too, as the dev — the dry run is this server's own read of the customer, the service
// type, the development, the project, the owner rule's settings and the live jobs already wearing the name, hashed
// with the payload; apply reads again and writes only when the hash still matches. Pure: no env reads, no network;
// the reads come in through one small interface so the tests run over a recording fake
// (src/lib/devMcp/devMcpJobs.test.ts).

import { titleCaseAddress } from './gcKernels/lib/addressTitleCase.ts'

// v2.6793 / 0.50.0 (PR 2): plan_job_update → apply_job_update changes a job as Edit Job and the Pipeline change it — the
// identity slice's columns (src/lib/jobs/jobFormAutosaveSlices.ts buildEditJobIdentityUpdatePayload), the price, the
// percent and the kind as one PATCH under RLS, and the status through the Pipeline's own update_job_status, one step at
// a time in the RPC's order. The plan shows every column before → after and the steps; it commits to the touched
// columns' before values, the status and updated_at, so a change since refuses the apply.

// v2.8555 / 0.134.0 (punch list #293, found on the look of 2026-11-24): the price rides on a line item. The form
// works a job's price out of its lines and the Bill tab's save writes the price as their sum, so a job the seat made
// with a price and no line read $0.00 on the Bill tab and one edit there would have written 0 over it. plan_job now
// plans one line item with the price (the row `fixtureInsertRows` writes for one named work line) and apply_job
// writes it after the job; plan_job_update reads the job's lines whenever `revenue` is in set and moves the line with
// the price, writes the line a price never had, or refuses in words where the lines are not its to change.

// v2.8570 / 0.135.0 (punch list #293, the renumber of 2026-11-25): a job's old number stays findable. The combine
// was the one writer of jobs_ledger.prior_numbers ('HCP 550' / 'C# 543'), so a number changed through this verb was
// gone from every search, and a bill already sent under it led to no job. plan_job_update now keeps the outgoing
// number there when it replaces one (keep_old_number: false leaves it out, for a mistyped number), and takes
// prior_numbers: { add?, remove? } for a job whose number already changed. search_jobs_ledger matches the list, so
// find_job and the Pipeline's search find the job by it, and the screens read "also 550" under the number.

export const JOB_VERBS = ['plan_job', 'apply_job', 'plan_job_update', 'apply_job_update'] as const
export type JobVerb = (typeof JOB_VERBS)[number]

export function isJobVerb(name: string): name is JobVerb {
  return (JOB_VERBS as readonly string[]).includes(name)
}

/** The kinds the form's two presses write (src/lib/jobs/jobKind.ts JOB_KINDS). */
export const JOB_KINDS = ['service', 'project'] as const
/** Who the bill goes to (jobs_ledger.bill_to_party). */
export const BILL_TO_PARTIES = ['customer', 'gc'] as const
/** The owner rule's settings keys (src/lib/companyOwner.ts, src/lib/resolveEffectiveJobMasterUserId.ts). */
export const COMPANY_OWNER_USER_ID_KEY = 'company_owner_user_id'
export const JOB_OWNER_OVERRIDE_DEFAULT_KEY = 'job_owner_override_default'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LINK_RE = /^https?:\/\//i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_MAX = 200
const NUMBER_MAX = 40
const LINK_MAX = 2000

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

export type NewJobPayload = {
  action: 'create'
  job_name: string
  job_address: string
  customer_id: string
  service_type_id: string
  revenue?: number
  line_name?: string
  hcp_number?: string
  click_number?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  development_id?: string
  project_id?: string
  bid_id?: string
  kind?: (typeof JOB_KINDS)[number]
  bill_to_party?: (typeof BILL_TO_PARTIES)[number]
  gc_customer_id?: string
  google_drive_link?: string
  job_pictures_link?: string
  job_plans_link?: string
  allow_duplicate_name?: boolean
}

export type JobInput = { ok: true; p: NewJobPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = `needs job — { job_name (under ${NAME_MAX}), job_address, customer_id (a customers.id — find_customer), service_type_id (a service_types.id — read_rows on service_types), revenue? (dollars, the price; 0 when left out; a price over 0 is written as one line item of 1 at that price), line_name? (that line item's name; the job's name when left out), hcp_number?, click_number? (the office's numbers, blank allowed), customer_name? / customer_email? / customer_phone? (the customer's own when left out), development_id? (a developments.id), project_id? (a projects.id), bid_id? (a bids.id — find_bid), kind? (service | project), bill_to_party? (customer | gc; gc needs gc_customer_id), gc_customer_id?, google_drive_link? / job_pictures_link? / job_plans_link? (https://…), allow_duplicate_name? (a live job already wearing the name on this customer refuses the plan unless true) }.`

/** A line item's name as the form saves it (normalizeFixtureDisplayName): inner whitespace collapsed, trimmed. */
export function lineNameOf(raw: unknown): string | null | false {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'string') return false
  const v = raw.replace(/\s+/g, ' ').trim()
  if (v.length > NAME_MAX) return false
  return v || null
}

/** Dollars as the plan's words say them: $1, $12.50, $1,250. */
export function usd(n: number): string {
  const cents = Math.round(n * 100)
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
}

/**
 * plan_job / apply_job's input, shaped: ids checked, words trimmed, the price a non-negative number. The address is
 * Title-Cased at the row (`newJobRow`), as the form saves it, so the payload keeps what was typed and the plan shows
 * both. apply_ must quote a 64-hex plan_hash.
 */
export function jobInput(verb: JobVerb, input: Json): JobInput {
  const shape = `${verb} ${SHAPE}`
  const src = obj(input.job)
  if (!src) return { ok: false, error: shape }
  const str = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim() : '')
  const id = (k: string): string | null | false => {
    const v = str(k)
    if (!v) return null
    return UUID_RE.test(v) ? v.toLowerCase() : false
  }
  const jobName = str('job_name')
  const jobAddress = str('job_address')
  const customerId = id('customer_id')
  const serviceTypeId = id('service_type_id')
  if (!jobName || jobName.length > NAME_MAX || !jobAddress || jobAddress.length > NAME_MAX || !customerId || !serviceTypeId) return { ok: false, error: shape }
  const p: NewJobPayload = { action: 'create', job_name: jobName, job_address: jobAddress, customer_id: customerId, service_type_id: serviceTypeId }
  const revenue = src.revenue
  if (revenue !== undefined && revenue !== null) {
    const n = typeof revenue === 'number' ? revenue : typeof revenue === 'string' && /^\d+(\.\d{1,2})?$/.test(revenue.trim()) ? Number(revenue.trim()) : NaN
    if (!Number.isFinite(n) || n < 0 || n > 99_999_999) return { ok: false, error: `${verb}: revenue is the job's price in dollars, a number of 0 or more.` }
    p.revenue = Math.round(n * 100) / 100
  }
  const lineName = lineNameOf(src.line_name)
  if (lineName === false) return { ok: false, error: `${verb}: line_name is the line item's name, text under ${NAME_MAX} characters.` }
  if (lineName) {
    if (!((p.revenue ?? 0) > 0)) return { ok: false, error: `${verb}: line_name names the line item the price rides on — give revenue (over 0) with it.` }
    p.line_name = lineName
  }
  for (const k of ['hcp_number', 'click_number'] as const) {
    const v = str(k)
    if (v.length > NUMBER_MAX) return { ok: false, error: shape }
    if (v) p[k] = v
  }
  const customerName = str('customer_name')
  if (customerName.length > NAME_MAX) return { ok: false, error: shape }
  if (customerName) p.customer_name = customerName
  const email = str('customer_email')
  if (email) {
    if (!EMAIL_RE.test(email) || email.length > NAME_MAX) return { ok: false, error: `${verb}: customer_email is not an email address.` }
    p.customer_email = email
  }
  const phone = str('customer_phone')
  if (phone) {
    if (phone.length > NUMBER_MAX) return { ok: false, error: shape }
    p.customer_phone = phone
  }
  for (const k of ['development_id', 'project_id', 'bid_id', 'gc_customer_id'] as const) {
    const v = id(k)
    if (v === false) return { ok: false, error: shape }
    if (v) p[k] = v
  }
  const kind = str('kind').toLowerCase()
  if (kind) {
    if (!(JOB_KINDS as readonly string[]).includes(kind)) return { ok: false, error: `${verb}: kind is service or project (the form's two presses), or left out.` }
    p.kind = kind as NewJobPayload['kind']
  }
  const billTo = str('bill_to_party').toLowerCase()
  if (billTo) {
    if (!(BILL_TO_PARTIES as readonly string[]).includes(billTo)) return { ok: false, error: shape }
    if (billTo === 'gc' && !p.gc_customer_id) return { ok: false, error: `${verb}: bill_to_party gc needs gc_customer_id, the GC's customers.id.` }
    p.bill_to_party = billTo as NewJobPayload['bill_to_party']
  }
  for (const k of ['google_drive_link', 'job_pictures_link', 'job_plans_link'] as const) {
    const v = str(k)
    if (!v) continue
    if (!LINK_RE.test(v) || v.length > LINK_MAX) return { ok: false, error: `${verb}: ${k} starts with https://, or is left out.` }
    p[k] = v
  }
  if (src.allow_duplicate_name === true) p.allow_duplicate_name = true
  let planHash: string | null = null
  if (verb === 'apply_job') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_job replied with.` }
    planHash = h
  }
  return { ok: true, p, target: jobName, planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type JobReads = {
  /** GET /rest/v1/<table>?<query> as the dev; the rows. Throws on a refused read. */
  rows(table: string, query: string): Promise<Json[]>
}

export type CustomerRow = { id: string; name: string | null; customer_type: string | null; contact_info: Json | null }
export type NamedRow = { id: string; name: string | null }
export type ProjectRow = { id: string; name: string | null; master_user_id: string | null }
export type BidRow = { id: string; bid_number: string | null; project_name: string | null }
export type SettingRow = { key: string; value_text: string | null }
export type SameNameJob = { id: string; job_name: string | null; status: string | null; click_number: string | null; hcp_number: string | null }

export type NewJobWorld = {
  me: { userId: string; name: string | null }
  customer: CustomerRow | null
  gcCustomer: CustomerRow | null
  serviceType: NamedRow | null
  development: NamedRow | null
  project: ProjectRow | null
  bid: BidRow | null
  settings: SettingRow[]
  /** Jobs on the customer wearing the same name (case-insensitive), not yet paid. */
  sameName: SameNameJob[]
}

const CUSTOMER_COLS = 'id,name,customer_type,contact_info'
const SAME_NAME_COLS = 'id,job_name,status,click_number,hcp_number'

/** The reads the dry run needs, in one place, so the test pins the queries the door will see. */
export async function readNewJobWorld(reads: JobReads, p: NewJobPayload, me: { userId: string; name: string | null }): Promise<NewJobWorld> {
  const one = async <T>(table: string, query: string): Promise<T | null> => ((await reads.rows(table, query))[0] as T | undefined) ?? null
  const [customer, gcCustomer, serviceType, development, project, bid, settings, sameName] = await Promise.all([
    one<CustomerRow>('customers', `select=${CUSTOMER_COLS}&id=eq.${p.customer_id}`),
    p.gc_customer_id ? one<CustomerRow>('customers', `select=${CUSTOMER_COLS}&id=eq.${p.gc_customer_id}`) : Promise.resolve(null),
    one<NamedRow>('service_types', `select=id,name&id=eq.${p.service_type_id}`),
    p.development_id ? one<NamedRow>('developments', `select=id,name&id=eq.${p.development_id}`) : Promise.resolve(null),
    p.project_id ? one<ProjectRow>('projects', `select=id,name,master_user_id&id=eq.${p.project_id}`) : Promise.resolve(null),
    p.bid_id ? one<BidRow>('bids', `select=id,bid_number,project_name&id=eq.${p.bid_id}`) : Promise.resolve(null),
    reads.rows('app_settings', `select=key,value_text&key=in.(${COMPANY_OWNER_USER_ID_KEY},job_owner_override_${me.userId},${JOB_OWNER_OVERRIDE_DEFAULT_KEY})`) as Promise<SettingRow[]>,
    reads.rows('jobs_ledger', `select=${SAME_NAME_COLS}&customer_id=eq.${p.customer_id}&status=neq.paid&job_name=ilike.${encodeURIComponent(p.job_name.replace(/[%*]/g, ''))}`) as Promise<SameNameJob[]>,
  ])
  return { me, customer, gcCustomer, serviceType, development, project, bid, settings, sameName: sameName.filter((j) => (j.job_name ?? '').trim().toLowerCase() === p.job_name.toLowerCase()) }
}

// ── the owner rule and the row ───────────────────────────────────────────────────────────────────────────────────

/**
 * Who the job belongs to, the New Job form's rule (resolveEffectiveJobMasterUserId): the project's master when the
 * job is project-linked, else the company owner account (`company_owner_user_id`, one company since v2.2972), else the
 * dev's own override, else the org-wide one, else the dev.
 */
export function jobMasterUser(world: Pick<NewJobWorld, 'me' | 'project' | 'settings'>, p: Pick<NewJobPayload, 'project_id'>): { id: string; how: string } {
  if (p.project_id && world.project?.master_user_id) return { id: world.project.master_user_id, how: `the project's master (${world.project.name ?? world.project.id})` }
  const setting = (key: string) => world.settings.find((r) => r.key === key)?.value_text?.trim() || null
  const company = setting(COMPANY_OWNER_USER_ID_KEY)
  if (company) return { id: company, how: 'the company owner account (Settings → company_owner_user_id)' }
  const personal = setting(`job_owner_override_${world.me.userId}`)
  if (personal) return { id: personal, how: 'your own job-owner override' }
  const fallback = setting(JOB_OWNER_OVERRIDE_DEFAULT_KEY)
  if (fallback) return { id: fallback, how: 'the org-wide job-owner override' }
  return { id: world.me.userId, how: 'you (no company owner account is set)' }
}

const infoStr = (info: Json | null, key: string): string | null => {
  const v = info?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** The customer's own email and phone, as the form prefills them from the pick (customers.contact_info). */
export function customerContact(customer: CustomerRow | null): { email: string | null; phone: string | null } {
  return { email: infoStr(customer?.contact_info ?? null, 'email'), phone: infoStr(customer?.contact_info ?? null, 'phone') }
}

/** The jobs_ledger row the insert sends — the New Job form's payload, column for column. */
export function newJobRow(p: NewJobPayload, world: NewJobWorld): Json {
  const master = jobMasterUser(world, p)
  const contact = customerContact(world.customer)
  // The GC pick holds only when the GC row is one the form could list (resolveGcCustomerIdForJobPayload); else none.
  const gcId = p.gc_customer_id && world.gcCustomer?.id === p.gc_customer_id ? world.gcCustomer.id : null
  return {
    master_user_id: master.id,
    hcp_number: p.hcp_number ?? '',
    click_number: p.click_number ?? '',
    job_name: p.job_name,
    job_address: titleCaseAddress(p.job_address),
    customer_id: p.customer_id,
    gc_customer_id: gcId,
    // A GC-pays rule with no GC left to bill falls back to the customer (v2.3345).
    bill_to_party: p.bill_to_party === 'gc' && gcId ? 'gc' : 'customer',
    bill_copy_other_party: false,
    show_bills_to_other_party: false,
    customer_address_id: null,
    development_id: p.development_id ?? null,
    customer_name: p.customer_name ?? world.customer?.name?.trim() ?? null,
    customer_email: p.customer_email ?? contact.email,
    customer_phone: p.customer_phone ?? contact.phone,
    google_drive_link: p.google_drive_link ?? null,
    job_pictures_link: p.job_pictures_link ?? null,
    job_plans_link: p.job_plans_link ?? null,
    revenue: p.revenue ?? 0,
    project_id: p.project_id ?? null,
    bid_id: p.bid_id ?? null,
    service_type_id: p.service_type_id,
    account_manager_user_id: null,
    account_manager_relationship: null,
  }
}

/** The job as a short label: its number, else its name (src/lib/plans/planSets.ts jobShortLabel). */
export function jobShortLabel(job: { click_number?: string | null; hcp_number?: string | null; job_name?: string | null }): string {
  const n = (job.click_number ?? '').trim() || (job.hcp_number ?? '').trim()
  if (n) return /^\d+$/.test(n) ? `JP${n}` : n
  return (job.job_name ?? '').trim() || 'this job'
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/**
 * What the plan says and what the hash commits to: the customer, the service type, the development, the project,
 * the bid, the owner and the row as it will land, the live jobs already wearing the name, and what a bill will still
 * need. Refuses in words before anything is hashed when a named row is not visible to the dev or the pieces do not
 * fit (a GC bill-to with no GC customer; a second job of the name without allow_duplicate_name).
 */
export function newJobDryRun(p: NewJobPayload, world: NewJobWorld): DryRun {
  if (!world.customer) return { ok: false, refused: `No customer ${p.customer_id} is visible to you — find_customer resolves a name.` }
  if (!world.serviceType) return { ok: false, refused: `No service type ${p.service_type_id} — read_rows on service_types lists them.` }
  if (p.development_id && !world.development) return { ok: false, refused: `No development ${p.development_id} is visible to you — read_rows on developments lists them.` }
  if (p.project_id && !world.project) return { ok: false, refused: `No project ${p.project_id} is visible to you — read_rows on projects lists them.` }
  if (p.bid_id && !world.bid) return { ok: false, refused: `No bid ${p.bid_id} is visible to you — find_bid resolves a number.` }
  if (p.gc_customer_id && !world.gcCustomer) return { ok: false, refused: `No GC customer ${p.gc_customer_id} is visible to you — find_customer resolves a name.` }
  if (world.sameName.length && !p.allow_duplicate_name) {
    const names = world.sameName.map((j) => `${jobShortLabel(j)} (${j.status ?? 'no status'})`).join(', ')
    return { ok: false, refused: `A live job on ${world.customer.name ?? 'this customer'} already wears the name "${p.job_name}": ${names}. Plan with allow_duplicate_name: true if you mean a second one, or update that job (plan_job_update).` }
  }
  const row = newJobRow(p, world)
  const master = jobMasterUser(world, p)
  const price = row.revenue as number
  const lineItem = price > 0 ? newPriceLine(p.line_name || lineNameOf(p.job_name) || p.job_name, price) : null
  const email = row.customer_email as string | null
  // A Stripe bill is numbered from the HCP number, else the Click number, and needs digits in it (create-stripe-invoice, v2.6826).
  const jobNumber = String(row.hcp_number ?? '').trim() || String(row.click_number ?? '').trim()
  const readiness: Json = {
    status: 'working — a new job starts there (the table\'s default since 20260722264000); plan_job_update { status: "ready_to_bill" } when the work is done',
    revenue: (row.revenue as number) > 0 ? `${row.revenue} — the amount a bill will carry` : 'none — set revenue (the price) before a bill, or the bill has nothing to carry',
    customer_email: email ? `${email} — a Stripe bill goes here` : 'none — a Stripe bill needs the customer\'s email (customer_email, or on the customer)',
    customer_phone: row.customer_phone ? `${row.customer_phone}` : 'none on the job; a text goes to a number on the customer\'s contact (plan_bill reads it)',
    number: /\d/.test(jobNumber) ? jobNumber : 'none — a Stripe bill is numbered from the HCP or Click number; give the job one (hcp_number or click_number) before plan_bill',
    kind: p.kind ?? 'not set — the signals read it until the office presses one',
  }
  return {
    ok: true,
    reply: {
      action: 'create',
      customer: { id: world.customer.id, name: world.customer.name, type: world.customer.customer_type },
      service_type: { id: world.serviceType.id, name: world.serviceType.name },
      development: world.development ? { id: world.development.id, name: world.development.name } : null,
      project: world.project ? { id: world.project.id, name: world.project.name } : null,
      bid: world.bid ? { id: world.bid.id, label: world.bid.bid_number ? `b${world.bid.bid_number}` : null, project_name: world.bid.project_name } : null,
      gc_customer: world.gcCustomer ? { id: world.gcCustomer.id, name: world.gcCustomer.name } : null,
      master_user: master,
      row,
      line_item: lineItem,
      kind_after: p.kind ?? null,
      same_name_live_jobs: world.sameName.map((j) => ({ id: j.id, label: jobShortLabel(j), status: j.status })),
      readiness,
      not_done: [
        'the other child rows the form can add (payments, materials, more line items, a discount, team) — later verbs',
        'the hours baseline at award and the bid\'s budget carry — the form\'s award step',
        'the Drive folder — job-drive-folders places it on its own',
      ],
    },
  }
}

/** The apply's reply: the job, its label, and the next press. */
export function jobAppliedWords(
  job: { id: string; click_number?: string | null; hcp_number?: string | null; job_name?: string | null },
  kind: { asked: string | null; saved: boolean; why?: string },
  line: PriceLineLanded | null = null,
): Json {
  const label = jobShortLabel(job)
  const lineMissing = line && !line.saved
  return {
    job_id: job.id,
    label,
    kind: kind.asked ? (kind.saved ? kind.asked : `not saved: ${kind.why ?? 'the row refused the kind'}`) : null,
    line_item: priceLineLandedWords(line),
    next: lineMissing
      ? `${label} is on the Pipeline at Working with its price and NO line item, so its Bill tab totals $0. plan_job_update { job_id, set: { revenue: ${line.line_unit_price ?? 0} } } writes the line the price is missing — do that before anyone edits its Bill tab.`
      : `${label} is on the Pipeline at Working (a new job's default); get_job reads it. plan_job_update { job_id, status: "ready_to_bill" } when the work is done, then plan_bill bills it and hands the customer the link.`,
  }
}

// ── the line the price rides on (v2.8555) ────────────────────────────────────────────────────────────────────────

/** A job's line item as the plan reads it (jobs_ledger_fixtures). */
export type JobLineRow = { id: string; name: string | null; count: number | string | null; line_unit_price: number | string | null; line_kind: string | null; invoice_id: string | null; sequence_order: number | null }
export const JOB_LINE_COLS = 'id,name,count,line_unit_price,line_kind,invoice_id,sequence_order'

/** What the plan says it will do to the job's line items; null when it touches none. */
export type PriceLinePlan =
  | { write: 'insert'; name: string; count: 1; line_unit_price: number; words: string }
  | { write: 'update'; id: string; name: string; count: 1; before: number | null; line_unit_price: number | null; words: string }

/** The line as the apply found it: written with its id, or not, with the reason. */
export type PriceLineLanded = { write: 'insert' | 'update'; name: string; line_unit_price: number | null; saved: boolean; id?: string | null; why?: string }

/** A new job's one line: 1 of the name at the price, said in the plan's words. */
export function newPriceLine(name: string, price: number): Extract<PriceLinePlan, { write: 'insert' }> {
  return { write: 'insert', name, count: 1, line_unit_price: price, words: `one line item, "${name}", 1 × ${usd(price)} — the Bill tab's lines total the price` }
}

/**
 * The jobs_ledger_fixtures row for that line — the row New Job's `fixtureInsertRows` writes for one named work line
 * (src/lib/jobs/jobFormAutosaveSlices.ts), column for column, less the id: the form mints one, here the table does.
 */
export function priceLineRow(jobId: string, name: string, price: number): Json {
  return {
    job_id: jobId,
    name,
    sequence_order: 0,
    line_description: null,
    invoice_id: null,
    count: 1,
    line_unit_price: price > 0 ? price : null,
    line_kind: 'work',
    discount_pct: null,
    discount_basis_positions: null,
    discount_reason: null,
    stage_kind: 'any',
    shared_with_gc: false,
    bill_to_party: null,
  }
}

/** The lines' total as the form sums it (revenueDollarsFromFixtures): named rows, count × unit price, to the cent. */
export function linesTotalDollars(lines: readonly JobLineRow[]): number {
  let s = 0
  for (const f of lines) {
    if (!(f.name ?? '').trim()) continue
    const c = Number(f.count)
    const qty = Number.isFinite(c) && c > 0 ? c : 1
    const unit = f.line_unit_price == null ? 0 : Number(f.line_unit_price)
    s += qty * (Number.isFinite(unit) ? unit : 0)
  }
  return Math.round(s * 100) / 100
}

/**
 * What a price in `set` does to the job's lines. The Bill tab writes a job's price as the sum of its lines, so a
 * price set beside lines that do not total it is written back over at the tab's next save:
 *  - no line and a price over 0: one line of 1 at the price, even when the price itself does not change (the line a
 *    price never had — a job the seat made before v2.8555);
 *  - the price as the job holds it, or no line and a price of 0: nothing;
 *  - one plain work line of 1, on no bill, that totals the price today: that line's price moves with it;
 *  - anything else is refused in words — the lines are the Bill tab's to change.
 */
export function priceLinePlan(args: { label: string; jobName: string; priceBefore: number; priceAfter: number; lines: readonly JobLineRow[]; lineName?: string | null }): { ok: true; line: PriceLinePlan | null } | { ok: false; refused: string } {
  const { label, lines, priceBefore, priceAfter } = args
  if (lines.length === 0) {
    if (!(priceAfter > 0)) return { ok: true, line: null }
    const name = args.lineName || lineNameOf(args.jobName) || 'Job'
    const why = priceAfter === priceBefore ? `${label} has a price and no line item, so its Bill tab totals $0` : `${label} has no line item`
    return { ok: true, line: { ...newPriceLine(name, priceAfter), words: `one line item, "${name}", 1 × ${usd(priceAfter)} — ${why}; with it the tab's lines total the price` } }
  }
  if (priceAfter === priceBefore) return { ok: true, line: null }
  const total = linesTotalDollars(lines)
  const door = `A job's price is the sum of its line items, and the Bill tab's next save would write that sum back over a price set here. Change the lines on the job's Bill tab; this verb moves the price of a job with no line item, or with one unbilled line of 1.`
  if (lines.length > 1) return { ok: false, refused: `revenue: ${label} carries ${lines.length} line items totalling ${usd(total)}. ${door}` }
  const only = lines[0] as JobLineRow
  const name = (only.name ?? '').trim()
  const count = Number(only.count)
  const unit = only.line_unit_price == null ? null : Number(only.line_unit_price)
  const why = (only.line_kind ?? 'work') !== 'work'
    ? 'is a discount'
    : only.invoice_id
      ? 'is on a bill'
      : !name
        ? 'has no name'
        : count !== 1
          ? `is ${Number.isFinite(count) ? count : 'a count'} of a unit price`
          : total !== priceBefore
            ? `totals ${usd(total)} while the job's price is ${usd(priceBefore)} (a fee rides on the job, or the two already disagree)`
            : null
  if (why) return { ok: false, refused: `revenue: ${label}'s one line item${name ? `, "${name}",` : ''} ${why}. ${door}` }
  const after = priceAfter > 0 ? priceAfter : null
  return { ok: true, line: { write: 'update', id: only.id, name, count: 1, before: unit, line_unit_price: after, words: `the line item "${name}" goes from ${usd(unit ?? 0)} to ${usd(priceAfter)} with the price, so the Bill tab's lines still total it` } }
}

/** The reply's line: what was written, or that it was not and why. */
export function priceLineLandedWords(line: PriceLineLanded | null): Json | string | null {
  if (!line) return null
  if (!line.saved) return `not saved: ${line.why ?? 'the table refused the line item'}`
  return { wrote: line.write, id: line.id ?? null, name: line.name, count: 1, line_unit_price: line.line_unit_price }
}

// ── the update ───────────────────────────────────────────────────────────────────────────────────────────────────

export const JOB_STATUSES = ['waiting', 'working', 'ready_to_bill', 'billed', 'paid'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]
/** The Pipeline's words for a status (the board's columns). */
export const STATUS_WORDS: Readonly<Record<JobStatus, string>> = { waiting: 'Waiting', working: 'Working', ready_to_bill: 'Ready to Bill', billed: 'Billed', paid: 'Paid' }

/** The columns Edit Job writes (the identity slice, the price, the percent, the kind), each with its check. */
export const UPDATE_COLUMNS = [
  'job_name', 'job_address', 'hcp_number', 'click_number', 'customer_id', 'customer_name', 'customer_email', 'customer_phone', 'service_type_id',
  'development_id', 'project_id', 'bid_id', 'bill_to_party', 'gc_customer_id', 'google_drive_link', 'job_pictures_link', 'job_plans_link',
  'account_manager_user_id', 'revenue', 'pct_complete', 'kind',
] as const
export type UpdateColumn = (typeof UPDATE_COLUMNS)[number]
const UPDATE_COLUMN_SET: ReadonlySet<string> = new Set(UPDATE_COLUMNS)
/** The id columns, with the table each names, for the plan's read and words. */
const ID_COLUMNS: Readonly<Record<string, { table: string; finder: string }>> = {
  customer_id: { table: 'customers', finder: 'find_customer' },
  gc_customer_id: { table: 'customers', finder: 'find_customer' },
  service_type_id: { table: 'service_types', finder: 'read_rows on service_types' },
  development_id: { table: 'developments', finder: 'read_rows on developments' },
  project_id: { table: 'projects', finder: 'read_rows on projects' },
  bid_id: { table: 'bids', finder: 'find_bid' },
  account_manager_user_id: { table: 'users', finder: 'find_person' },
}
/** The columns a null clears; the rest need a value. */
const NULLABLE: ReadonlySet<string> = new Set(['customer_name', 'customer_email', 'customer_phone', 'development_id', 'project_id', 'bid_id', 'gc_customer_id', 'google_drive_link', 'job_pictures_link', 'job_plans_link', 'account_manager_user_id', 'kind'])

export type JobUpdatePayload = {
  action: 'update'
  job_id: string
  set: Partial<Record<UpdateColumn, string | number | null>>
  status?: JobStatus
  reason?: string
  /** The name of the line item a price with no line is written as; the job's name when left out. */
  line_name?: string
  /** Numbers the job answered to before, to put on or take off its list (`jobs_ledger.prior_numbers`). */
  prior_numbers?: { add?: string[]; remove?: string[] }
  /** false: a number this plan replaces is not kept as a prior number (a mistyped one). */
  keep_old_number?: false
}

/** Prior numbers a plan may add or take off at once. */
export const PRIOR_NUMBERS_MAX = 10
/** A prior number as the database holds it (src/lib/jobs/priorNumbers.ts priorNumberEntry): 'HCP 550' or 'C# 543'. */
const PRIOR_RE = /^(HCP|C#) [^\s"\\,()][^"\\,()]*$/

/** One prior number, shaped: the tag in capitals, one space, the number trimmed. `false` when it is neither shape. */
export function priorNumberOf(raw: unknown): string | false {
  if (typeof raw !== 'string') return false
  const m = raw.replace(/\s+/g, ' ').trim().match(/^(hcp|c#) (.+)$/i)
  if (!m) return false
  const entry = `${m[1]!.toUpperCase()} ${m[2]!.trim()}`
  return PRIOR_RE.test(entry) && m[2]!.trim().length <= NUMBER_MAX ? entry : false
}

/** The bare number of an entry: 'C# 543' → '543'. */
export const priorNumberBare = (entry: string): string => entry.replace(/^(HCP|C#) /, '')

const UPDATE_SHAPE = `needs update — { job_id (a jobs_ledger.id — find_job), set? ({ column: value } over the Edit Job form's columns: ${UPDATE_COLUMNS.join(', ')}; null clears one that may be blank), status? (${JOB_STATUSES.join(' | ')} — the Pipeline's own move, one step at a time), reason?, line_name? (with revenue on a job that has no line item: the name of the line the price is written as; the job's name when left out), prior_numbers? ({ add?: [...], remove?: [...] } — numbers the job answered to before, each 'C# 543' or 'HCP 550', up to ${PRIOR_NUMBERS_MAX} a list; the job search finds the job by them), keep_old_number? (false with hcp_number or click_number in set: the number being replaced is not kept as a prior number) }. One of set, status or prior_numbers at least. revenue moves the job's line item with it: a job with no line gets one line of 1 at the price, a job with one unbilled line of 1 has that line repriced, and any other job is refused, since the Bill tab writes the price as the sum of its lines. A number set replaces keeps the old one as a prior number.`

/** One column's value, checked as the form checks it; `undefined` means refused with the words. */
function checkColumn(verb: string, column: UpdateColumn, raw: unknown): { ok: true; value: string | number | null } | { ok: false; error: string } {
  if (raw === null) return NULLABLE.has(column) ? { ok: true, value: null } : { ok: false, error: `${verb}: ${column} cannot be cleared — give it a value.` }
  if (column === 'revenue') {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+(\.\d{1,2})?$/.test(raw.trim()) ? Number(raw.trim()) : NaN
    if (!Number.isFinite(n) || n < 0 || n > 99_999_999) return { ok: false, error: `${verb}: revenue is the job's price in dollars, a number of 0 or more.` }
    return { ok: true, value: Math.round(n * 100) / 100 }
  }
  if (column === 'pct_complete') {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN
    if (!Number.isInteger(n) || n < 0 || n > 100) return { ok: false, error: `${verb}: pct_complete is a whole number from 0 to 100.` }
    return { ok: true, value: n }
  }
  if (typeof raw !== 'string') return { ok: false, error: `${verb}: ${column} takes text.` }
  const v = raw.trim()
  if (column === 'kind') {
    if (!(JOB_KINDS as readonly string[]).includes(v.toLowerCase())) return { ok: false, error: `${verb}: kind is service or project, or null to unset it.` }
    return { ok: true, value: v.toLowerCase() }
  }
  if (column === 'bill_to_party') {
    if (!(BILL_TO_PARTIES as readonly string[]).includes(v.toLowerCase())) return { ok: false, error: `${verb}: bill_to_party is customer or gc.` }
    return { ok: true, value: v.toLowerCase() }
  }
  if (ID_COLUMNS[column]) {
    if (!UUID_RE.test(v)) return { ok: false, error: `${verb}: ${column} is a ${ID_COLUMNS[column].table}.id — ${ID_COLUMNS[column].finder}.` }
    return { ok: true, value: v.toLowerCase() }
  }
  if (column === 'google_drive_link' || column === 'job_pictures_link' || column === 'job_plans_link') {
    if (!LINK_RE.test(v) || v.length > LINK_MAX) return { ok: false, error: `${verb}: ${column} starts with https://, or null to clear it.` }
    return { ok: true, value: v }
  }
  if (column === 'customer_email') {
    if (!EMAIL_RE.test(v) || v.length > NAME_MAX) return { ok: false, error: `${verb}: customer_email is not an email address.` }
    return { ok: true, value: v }
  }
  if (column === 'job_name' || column === 'job_address') {
    if (!v || v.length > NAME_MAX) return { ok: false, error: `${verb}: ${column} is required and under ${NAME_MAX} characters — the form will not save it blank.` }
    return { ok: true, value: column === 'job_address' ? titleCaseAddress(v) : v }
  }
  if (column === 'hcp_number' || column === 'click_number' || column === 'customer_phone') {
    if (v.length > NUMBER_MAX) return { ok: false, error: `${verb}: ${column} is under ${NUMBER_MAX} characters.` }
    return { ok: true, value: column === 'customer_phone' && !v ? null : v }
  }
  if (v.length > NAME_MAX) return { ok: false, error: `${verb}: ${column} is under ${NAME_MAX} characters.` }
  return { ok: true, value: v || null }
}

export type JobUpdateInput = { ok: true; p: JobUpdatePayload; target: string; planHash: string | null } | { ok: false; error: string }

/** plan_job_update / apply_job_update's input, shaped: the job, the columns checked one by one, the status named. */
export function jobUpdateInput(verb: JobVerb, input: Json): JobUpdateInput {
  const shape = `${verb} ${UPDATE_SHAPE}`
  const src = obj(input.update)
  if (!src) return { ok: false, error: shape }
  const jobId = typeof src.job_id === 'string' ? src.job_id.trim().toLowerCase() : ''
  if (!UUID_RE.test(jobId)) return { ok: false, error: shape }
  const set = obj(src.set) ?? {}
  const p: JobUpdatePayload = { action: 'update', job_id: jobId, set: {} }
  for (const [column, raw] of Object.entries(set)) {
    if (!UPDATE_COLUMN_SET.has(column)) return { ok: false, error: `${verb}: ${column} is not a column this verb changes. The columns: ${UPDATE_COLUMNS.join(', ')}. A status is \`status\`, outside set.` }
    if (raw === undefined) continue
    const checked = checkColumn(verb, column as UpdateColumn, raw)
    if (!checked.ok) return checked
    p.set[column as UpdateColumn] = checked.value
  }
  const status = typeof src.status === 'string' ? src.status.trim().toLowerCase() : ''
  if (status) {
    if (!(JOB_STATUSES as readonly string[]).includes(status)) return { ok: false, error: `${verb}: status is one of ${JOB_STATUSES.join(', ')}.` }
    p.status = status as JobStatus
  }
  if (src.prior_numbers !== undefined && src.prior_numbers !== null) {
    const asked = obj(src.prior_numbers)
    const priorShape = `prior_numbers is { add?: [...], remove?: [...] }, each entry a number the job answered to before, written 'C# 543' (a Click number) or 'HCP 550' (an HCP number), up to ${PRIOR_NUMBERS_MAX} a list.`
    if (!asked) return { ok: false, error: `${verb}: ${priorShape}` }
    const lists: { add?: string[]; remove?: string[] } = {}
    for (const k of ['add', 'remove'] as const) {
      const raw = asked[k]
      if (raw === undefined || raw === null) continue
      if (!Array.isArray(raw) || raw.length > PRIOR_NUMBERS_MAX) return { ok: false, error: `${verb}: ${priorShape}` }
      const entries: string[] = []
      for (const one of raw) {
        const entry = priorNumberOf(one)
        if (!entry) return { ok: false, error: `${verb}: ${JSON.stringify(one)} is not a prior number: ${priorShape}` }
        if (!entries.includes(entry)) entries.push(entry)
      }
      if (entries.length) lists[k] = entries
    }
    const both = (lists.add ?? []).find((e) => (lists.remove ?? []).includes(e))
    if (both) return { ok: false, error: `${verb}: ${both} is in both add and remove. Name it in one.` }
    if (lists.add || lists.remove) p.prior_numbers = lists
  }
  if (src.keep_old_number === false) {
    if (p.set.hcp_number === undefined && p.set.click_number === undefined) return { ok: false, error: `${verb}: keep_old_number: false is about a number this plan replaces — give set.hcp_number or set.click_number with it.` }
    p.keep_old_number = false
  }
  if (!Object.keys(p.set).length && !p.status && !p.prior_numbers) return { ok: false, error: `${verb}: nothing to change — give set, status, prior_numbers, or several. ${UPDATE_SHAPE}` }
  const reason = typeof src.reason === 'string' ? src.reason.trim() : ''
  if (reason) {
    if (reason.length > 500) return { ok: false, error: `${verb}: reason is under 500 characters.` }
    p.reason = reason
  }
  const lineName = lineNameOf(src.line_name)
  if (lineName === false) return { ok: false, error: `${verb}: line_name is the line item's name, text under ${NAME_MAX} characters.` }
  if (lineName) {
    if (p.set.revenue === undefined) return { ok: false, error: `${verb}: line_name names the line item a price is written as — give set.revenue with it.` }
    p.line_name = lineName
  }
  let planHash: string | null = null
  if (verb === 'apply_job_update') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_job_update replied with.` }
    planHash = h
  }
  return { ok: true, p, target: jobId, planHash }
}

export type JobRow = { id: string; status: string | null; updated_at: string | null; master_user_id: string | null; prior_numbers?: string[] | null } & Partial<Record<UpdateColumn, string | number | null>>
export type JobUpdateWorld = {
  job: JobRow | null
  /** The rows the new ids name, by column: null when not visible. */
  named: Partial<Record<UpdateColumn, NamedRow | null>>
  /** The job's line items in order, read when `revenue` is in set; null when the plan does not touch the price. */
  lines: JobLineRow[] | null
  /** The other jobs wearing a number today that this plan adds as a prior number, by entry. Left out when none is added. */
  wearing?: Record<string, SameNameJob[]>
}

const JOB_COLS = ['id', 'status', 'updated_at', 'master_user_id', ...UPDATE_COLUMNS, 'prior_numbers'].join(',')

/** The reads the dry run needs: the job, each row a new id names, and the job's line items when the price is in set. */
export async function readJobUpdateWorld(reads: JobReads, p: JobUpdatePayload): Promise<JobUpdateWorld> {
  const one = async <T>(table: string, query: string): Promise<T | null> => ((await reads.rows(table, query))[0] as T | undefined) ?? null
  const job = await one<JobRow>('jobs_ledger', `select=${JOB_COLS}&id=eq.${p.job_id}`)
  const named: JobUpdateWorld['named'] = {}
  let lines: JobLineRow[] | null = null
  await Promise.all([
    p.set.revenue === undefined
      ? Promise.resolve()
      : reads.rows('jobs_ledger_fixtures', `select=${JOB_LINE_COLS}&job_id=eq.${p.job_id}&order=sequence_order.asc,id.asc`).then((rows) => {
          lines = rows as JobLineRow[]
        }),
    ...Object.entries(p.set).map(async ([column, value]) => {
      const spec = ID_COLUMNS[column]
      if (!spec || typeof value !== 'string') return
      const nameCol = spec.table === 'bids' ? 'project_name' : 'name'
      const row = await one<Json>(spec.table, `select=id,${nameCol}&id=eq.${value}`)
      named[column as UpdateColumn] = row ? { id: String(row.id), name: typeof row[nameCol] === 'string' ? (row[nameCol] as string) : null } : null
    }),
  ])
  // A number added as a prior number may be one another job wears today: the plan says so, since a search finds both.
  let wearing: Record<string, SameNameJob[]> | undefined
  if (p.prior_numbers?.add?.length) {
    wearing = {}
    await Promise.all(p.prior_numbers.add.map(async (entry) => {
      const quoted = encodeURIComponent(`"${priorNumberBare(entry)}"`)
      wearing![entry] = (await reads.rows('jobs_ledger', `select=${SAME_NAME_COLS}&id=neq.${p.job_id}&or=(click_number.eq.${quoted},hcp_number.eq.${quoted})&limit=5`)) as SameNameJob[]
    }))
  }
  return { job, named, lines, ...(wearing ? { wearing } : {}) }
}

/**
 * The steps update_job_status takes from one status to another, one at a time (the RPC allows a neighbour's move
 * only: forward waiting → working → ready_to_bill → billed → paid, and each back-step). Empty when already there.
 */
export function statusSteps(from: JobStatus, to: JobStatus): JobStatus[] {
  const a = JOB_STATUSES.indexOf(from)
  const b = JOB_STATUSES.indexOf(to)
  if (a < 0 || b < 0 || a === b) return []
  const steps: JobStatus[] = []
  if (a < b) for (let i = a + 1; i <= b; i++) steps.push(JOB_STATUSES[i] as JobStatus)
  else for (let i = a - 1; i >= b; i--) steps.push(JOB_STATUSES[i] as JobStatus)
  return steps
}

/** The job's label off a row whose columns are typed loosely. */
const labelOf = (job: JobRow): string => jobShortLabel({ click_number: job.click_number == null ? null : String(job.click_number), hcp_number: job.hcp_number == null ? null : String(job.hcp_number), job_name: job.job_name == null ? null : String(job.job_name) })

const same = (a: unknown, b: unknown): boolean => (a ?? null) === (b ?? null) || (typeof a === 'number' && typeof b === 'string' && Number(b) === a) || (typeof a === 'string' && typeof b === 'number' && Number(a) === b)

/** The job's prior numbers as the row holds them, blanks dropped. */
const priorList = (job: JobRow): string[] => (Array.isArray(job.prior_numbers) ? job.prior_numbers : []).filter((n): n is string => typeof n === 'string' && n.trim() !== '')

const NUMBER_TAGS = [['hcp_number', 'HCP'], ['click_number', 'C#']] as const
type JobNumbers = { hcp_number: string; click_number: string }

export type PriorNumbersPlan = {
  before: string[]
  after: string[]
  /** The numbers this plan replaces, newly on the list. */
  kept: string[]
  added: string[]
  removed: string[]
  /** Entries taken off because the job wears that number again after the plan. */
  dropped: string[]
  /** The numbers this plan replaces and does not keep (`keep_old_number: false`). */
  not_kept: string[]
  moved: boolean
}

/**
 * The job's prior numbers after a plan, in the combine's shape (`priorNumbersAfter` in devMcpJobCombine.ts): the list
 * as it stands less what the plan takes off, then the number each column gives up ('HCP 550' / 'C# 543') unless
 * `keepOld` is false, then what the plan adds, each once. A plan that changes a number also drops an entry the job
 * wears again afterwards. Refuses a take-off that is not on the list and an add of the job's own number.
 */
export function priorNumbersPlan(args: { label: string; list: readonly string[]; old: JobNumbers; now: JobNumbers; keepOld: boolean; add: readonly string[]; remove: readonly string[] }): { ok: true; plan: PriorNumbersPlan } | { ok: false; refused: string } {
  const { label, list, old, now, add, remove } = args
  const own = NUMBER_TAGS.filter(([c]) => now[c]).map(([c, tag]) => `${tag} ${now[c]}`)
  const outgoing = NUMBER_TAGS.filter(([c]) => old[c] && old[c] !== now[c]).map(([c, tag]) => `${tag} ${old[c]}`)
  const numberMoves = NUMBER_TAGS.some(([c]) => old[c] !== now[c])
  const missing = remove.find((e) => !list.includes(e))
  if (missing) return { ok: false, refused: `${missing} is not among ${label}'s prior numbers (${list.length ? list.join(', ') : 'it has none'}), so there is nothing to take off.` }
  const mine = add.find((e) => own.includes(e))
  if (mine) return { ok: false, refused: `${mine} is ${label}'s own number today. A prior number is one the job answered to before.` }
  const all = [...list.filter((e) => !remove.includes(e)), ...(args.keepOld ? outgoing : []), ...add]
  const once = all.filter((e, i) => all.indexOf(e) === i)
  const dropped = numberMoves ? once.filter((e) => own.includes(e)) : []
  const after = once.filter((e) => !dropped.includes(e))
  return {
    ok: true,
    plan: {
      before: [...list],
      after,
      kept: args.keepOld ? outgoing.filter((e) => after.includes(e) && !list.includes(e)) : [],
      added: add.filter((e) => !list.includes(e)),
      removed: [...remove],
      dropped,
      not_kept: args.keepOld ? [] : outgoing.filter((e) => !after.includes(e)),
      moved: JSON.stringify(after) !== JSON.stringify(list),
    },
  }
}

/** What the plan says of the list: before and after, why each entry moves, and what follows. */
function priorNumbersWords(plan: PriorNumbersPlan): Json {
  return {
    before: plan.before,
    after: plan.after,
    ...(plan.kept.length ? { keeps: `${plan.kept.join(', ')} — the number this plan replaces, kept so a search for it still finds the job (keep_old_number: false leaves it out)` } : {}),
    ...(plan.added.length ? { adds: plan.added } : {}),
    ...(plan.removed.length ? { removes: plan.removed } : {}),
    ...(plan.dropped.length ? { drops: `${plan.dropped.join(', ')} — the job's own number again after this plan, so no longer a prior one` } : {}),
    ...(plan.not_kept.length ? { not_kept: `${plan.not_kept.join(', ')} — keep_old_number is false: after the apply no search for it finds this job` } : {}),
    sets_off: 'The job search (search_jobs_ledger: find_job, the Pipeline\'s search) finds the job by every number on the list, and the screens read "also <number>" under the job\'s own. The list itself writes no line on the job\'s Activity.',
  }
}

/** A value read back after the PATCH against the one planned: a list entry by entry, anything else as text. */
export const landedSame = (got: unknown, planned: unknown): boolean => (Array.isArray(planned) ? JSON.stringify(Array.isArray(got) ? got : []) === JSON.stringify(planned) : String(got ?? '') === String(planned ?? ''))

/**
 * What the plan says and what the hash commits to: the job as it stands (its label, status, updated_at), every column
 * before → after with the no-ops dropped, the prior numbers before → after (`priorNumbersPlan`), the status steps in
 * the RPC's order with the one that deletes Ready to Bill lines named, the line item a price writes or moves
 * (`priceLinePlan`), and what the verb does not do. Refuses a job not visible, an id whose row is not visible, a price
 * beside lines that are not this verb's to change, a prior number that is not there to take off or is the job's own,
 * and a plan that changes nothing.
 */
export function jobUpdateDryRun(p: JobUpdatePayload, world: JobUpdateWorld): DryRun {
  const job = world.job
  if (!job) return { ok: false, refused: `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` }
  for (const [column, value] of Object.entries(p.set)) {
    const spec = ID_COLUMNS[column]
    if (spec && typeof value === 'string' && !world.named[column as UpdateColumn]) return { ok: false, refused: `${column}: no ${spec.table} row ${value} is visible to you — ${spec.finder}.` }
  }
  if (p.set.bill_to_party === 'gc' && !(p.set.gc_customer_id ?? job.gc_customer_id)) return { ok: false, refused: 'bill_to_party gc needs a GC on the job: set gc_customer_id with it.' }
  const changes: Array<{ column: string; before: unknown; after: unknown; named?: string | null }> = []
  const patch: Json = {}
  for (const [column, value] of Object.entries(p.set)) {
    const before = (job as Json)[column] ?? null
    if (same(before, value)) continue
    patch[column] = value
    const row = world.named[column as UpdateColumn]
    changes.push({ column, before, after: value, ...(row ? { named: row.name } : {}) })
  }
  // The prior numbers (0.135.0): the number a column gives up, and what the plan adds or takes off.
  const numberOf = (v: unknown): string => (v == null ? '' : String(v).trim())
  const prior = priorNumbersPlan({
    label: labelOf(job),
    list: priorList(job),
    old: { hcp_number: numberOf(job.hcp_number), click_number: numberOf(job.click_number) },
    now: { hcp_number: numberOf('hcp_number' in patch ? patch.hcp_number : job.hcp_number), click_number: numberOf('click_number' in patch ? patch.click_number : job.click_number) },
    keepOld: p.keep_old_number !== false,
    add: p.prior_numbers?.add ?? [],
    remove: p.prior_numbers?.remove ?? [],
  })
  if (!prior.ok) return prior
  const warnings: string[] = []
  if (prior.plan.added.length) {
    if (!world.wearing) return { ok: false, refused: `The jobs wearing ${prior.plan.added.join(', ')} today were not read, so the prior numbers cannot be planned. Plan again.` }
    for (const entry of prior.plan.added) {
      const others = world.wearing[entry] ?? []
      if (others.length) warnings.push(`${priorNumberBare(entry)} is the number ${others.map((j) => `${(j.job_name ?? '').trim() || 'a job'} (${j.id}, ${j.status ?? 'no status'})`).join(' and ')} ${others.length === 1 ? 'wears' : 'wear'} today. A search for it will find ${others.length === 1 ? 'both jobs' : 'all of them'}.`)
    }
  }
  if (prior.plan.moved) {
    patch.prior_numbers = prior.plan.after
    changes.push({ column: 'prior_numbers', before: prior.plan.before, after: prior.plan.after })
  }
  let line: PriceLinePlan | null = null
  if (p.set.revenue !== undefined) {
    if (!world.lines) return { ok: false, refused: `${labelOf(job)}'s line items were not read, so its price cannot be planned. Plan again.` }
    const priceBefore = Number(job.revenue ?? 0)
    const planned = priceLinePlan({ label: labelOf(job), jobName: String(job.job_name ?? ''), priceBefore: Number.isFinite(priceBefore) ? priceBefore : 0, priceAfter: Number(p.set.revenue), lines: world.lines, lineName: p.line_name })
    if (!planned.ok) return planned
    line = planned.line
  }
  if (p.line_name && line?.write !== 'insert') return { ok: false, refused: `line_name names a line item this plan would write, and it writes none: ${labelOf(job)} ${world.lines?.length ? 'already has its line items' : 'gets no line at a price of 0'}. Plan again without line_name.` }
  const from = (job.status ?? 'waiting') as JobStatus
  const steps = p.status ? statusSteps(from, p.status) : []
  if (!changes.length && !steps.length && !line) {
    if (p.prior_numbers) {
      const reads = [p.status ? `it is at ${STATUS_WORDS[from]}` : '', Object.keys(p.set).length ? 'every column in set already holds its value' : '', `its prior numbers already read ${prior.plan.before.length ? prior.plan.before.join(', ') : 'none'}`].filter(Boolean)
      return { ok: false, refused: `${labelOf(job)} already reads that way: ${reads.join(', ')}. Nothing to apply.` }
    }
    return { ok: false, refused: p.status ? `${labelOf(job)} already reads that way: it is at ${STATUS_WORDS[from]} and every column in set already holds its value. Nothing to apply.` : `${labelOf(job)} already reads that way: every column in set already holds its value. Nothing to apply.` }
  }
  const stepWords = steps.map((to, i) => {
    const prev: JobStatus = i === 0 ? from : (steps[i - 1] as JobStatus)
    const deletes = prev === 'ready_to_bill' && to === 'working'
    return { to, words: `${STATUS_WORDS[prev]} → ${STATUS_WORDS[to]}${deletes ? ' — deletes the job\'s Ready to Bill lines, as the Pipeline\'s send-back does' : ''}${to === 'billed' ? ' — the Pipeline\'s move alone; a Stripe bill is plan_bill' : ''}` }
  })
  return {
    ok: true,
    reply: {
      action: 'update',
      job: { id: job.id, label: labelOf(job), status: from, status_words: STATUS_WORDS[from], updated_at: job.updated_at },
      changes,
      patch,
      line_item: line,
      prior_numbers: prior.plan.moved || prior.plan.not_kept.length ? priorNumbersWords(prior.plan) : null,
      status: p.status ? { from, to: p.status, steps: stepWords } : null,
      reason: p.reason ?? null,
      ...(warnings.length ? { warnings } : {}),
      not_done: [
        'the job\'s other line items, a discount and its payments — the Bill tab\'s, or a later verb\'s',
        'the dispatch request the form closes when a phone or pictures link goes from blank to set',
        'the bid outcome the database derives when bid_id changes is written by its trigger, not said here',
        ...('hcp_number' in patch || 'click_number' in patch ? ['a sub labor sheet on the job keeps the number it was written under: plan_sub_labor { action: "change", sheet_id, job_id (the sheet\'s own job) } brings it up to date'] : []),
      ],
    },
  }
}

/** The apply's reply: what landed, what the RPC answered step by step, where the job stands. */
export function jobUpdateAppliedWords(
  job: { id: string; click_number?: string | null; hcp_number?: string | null; job_name?: string | null },
  landed: { changes: Array<{ column: string; before: unknown; after: unknown }>; held: string | null },
  status: { from: JobStatus; steps: Array<{ to: JobStatus; ok: boolean; error?: string | null; deleted_ready_to_bill_invoices?: number }> } | null,
  line: PriceLineLanded | null = null,
): Json {
  const label = jobShortLabel(job)
  const lastOk = status ? [...status.steps].reverse().find((s) => s.ok)?.to ?? status.from : null
  const stopped = status?.steps.find((s) => !s.ok) ?? null
  const now = lastOk ?? null
  const next = stopped
    ? `${label} stopped at ${STATUS_WORDS[now as JobStatus]}: ${stopped.error ?? 'the move was refused'}. Plan again from there.`
    : now === 'ready_to_bill'
      ? `${label} is at Ready to Bill. plan_bill bills it and hands the customer the link.`
      : `${label} reads as planned; get_job shows it.`
  return {
    job_id: job.id,
    label,
    changed: landed.changes,
    held: landed.held,
    line_item: priceLineLandedWords(line),
    status: status ? { from: status.from, now, steps: status.steps } : null,
    next,
  }
}
