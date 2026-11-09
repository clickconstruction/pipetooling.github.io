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

export const JOB_VERBS = ['plan_job', 'apply_job'] as const
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

const SHAPE = `needs job — { job_name (under ${NAME_MAX}), job_address, customer_id (a customers.id — find_customer), service_type_id (a service_types.id — read_rows on service_types), revenue? (dollars, the price; 0 when left out), hcp_number?, click_number? (the office's numbers, blank allowed), customer_name? / customer_email? / customer_phone? (the customer's own when left out), development_id? (a developments.id), project_id? (a projects.id), bid_id? (a bids.id — find_bid), kind? (service | project), bill_to_party? (customer | gc; gc needs gc_customer_id), gc_customer_id?, google_drive_link? / job_pictures_link? / job_plans_link? (https://…), allow_duplicate_name? (a live job already wearing the name on this customer refuses the plan unless true) }.`

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
  const email = row.customer_email as string | null
  const readiness: Json = {
    status: 'working — a new job starts there (the table\'s default since 20260722264000); plan_job_update { status: "ready_to_bill" } when the work is done',
    revenue: (row.revenue as number) > 0 ? `${row.revenue} — the amount a bill will carry` : 'none — set revenue (the price) before a bill, or the bill has nothing to carry',
    customer_email: email ? `${email} — a Stripe bill goes here` : 'none — a Stripe bill needs the customer\'s email (customer_email, or on the customer)',
    customer_phone: row.customer_phone ? `${row.customer_phone}` : 'none on the job; a text goes to a number on the customer\'s contact (plan_bill reads it)',
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
      kind_after: p.kind ?? null,
      same_name_live_jobs: world.sameName.map((j) => ({ id: j.id, label: jobShortLabel(j), status: j.status })),
      readiness,
      not_done: [
        'the child rows the form can add (payments, materials, fixtures, team) — later verbs',
        'the hours baseline at award and the bid\'s budget carry — the form\'s award step',
        'the Drive folder — job-drive-folders places it on its own',
      ],
    },
  }
}

/** The apply's reply: the job, its label, and the next press. */
export function jobAppliedWords(job: { id: string; click_number?: string | null; hcp_number?: string | null; job_name?: string | null }, kind: { asked: string | null; saved: boolean; why?: string }): Json {
  const label = jobShortLabel(job)
  return {
    job_id: job.id,
    label,
    kind: kind.asked ? (kind.saved ? kind.asked : `not saved: ${kind.why ?? 'the row refused the kind'}`) : null,
    next: `${label} is on the Pipeline at Working (a new job's default); get_job reads it. plan_job_update { job_id, status: "ready_to_bill" } when the work is done, then plan_bill bills it and hands the customer the link.`,
  }
}
