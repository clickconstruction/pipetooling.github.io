/**
 * The invented world a sealed frame answers from (punch list #194): one company, its people (one
 * per role), its customers and its jobs, built for the frame's person and state. It extends the
 * sample people the customer pages already show (Sam Sample at 100 Sample St in Kyle, Pat Sample
 * at Sample Contracting, Elena at Sample Owner LLC, Sam Plumber), so the office's screens and the
 * customer's tell one story. Rows are typed by database.ts, so a misspelled column or a wrong type
 * fails the typecheck. Nothing here is a live row.
 */
import { SAMPLE_GC, SAMPLE_HOMEOWNER, SAMPLE_OWNER, SAMPLE_SUB } from '../../../../supabase/functions/_shared/customerSample'
import type { Database } from '../../../types/database'
import type { LensStore, Row } from '../answer/postgrest'
import type { LensConfig, LensMood } from '../lensName'
import { LENS_PEOPLE, type LensPerson } from '../lensPeople'
import { LENS_FUNCTIONS, LENS_RPC, chicagoOffset, lensPoint, lensToday, normalizeAddress } from './lensWorldAnswers'

type Tables = Database['public']['Tables']
type RowOf<N extends keyof Tables> = Tables[N]['Row']

export type LensWorldCtx = { viewer: LensPerson; mood: LensMood; store: LensStore; now: Date; /** Training mode: a handler that writes refuses, as the database does. */ readOnly: boolean }
export type LensRpcHandler = (args: Record<string, unknown>, w: LensWorldCtx) => unknown
export type LensFnHandler = (body: unknown, w: LensWorldCtx) => unknown

export type LensWorld = {
  viewer: LensPerson
  mood: LensMood
  store: LensStore
  /** Training mode: the database refuses this person's writes. */
  readOnly: boolean
  rpc: Readonly<Record<string, LensRpcHandler>>
  functions: Readonly<Record<string, LensFnHandler>>
}

/** Tables an empty company still has: its settings and its trades. */
export const LENS_CONFIG_TABLES: ReadonlySet<string> = new Set(['app_settings', 'service_types', 'address_geocodes'])

export class MapStore implements LensStore {
  private map = new Map<string, Row[]>()
  constructor(seed: Record<string, Row[]> = {}) {
    for (const [k, v] of Object.entries(seed)) this.map.set(k, v.map((r) => ({ ...r })))
  }
  rows(table: string): Row[] {
    return this.map.get(table) ?? []
  }
  set(table: string, rows: Row[]): void {
    this.map.set(table, rows)
  }
  tables(): string[] {
    return [...this.map.keys()]
  }
}

const id = (group: string, n: number) => `00000000-0000-4194-${group}-${String(n).padStart(12, '0')}`
const MASTER = LENS_PEOPLE.master_technician.id
const at = (day: string, time = '15:00:00') => `${day}T${time}.000Z`

export const LENS_IDS = {
  plumbing: id('8003', 1),
  homeowner: id('8001', 1),
  gc: id('8001', 2),
  owner: id('8001', 3),
  sub: id('8001', 4),
} as const

function users(viewer: LensPerson, readOnly: boolean): Partial<RowOf<'users'>>[] {
  return Object.values(LENS_PEOPLE).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    role: p.role,
    title: p.label,
    read_only: p.id === viewer.id && readOnly,
    is_sample: true,
    is_digital_twin: false,
    is_walk_tester: false,
    calibration_standard: false,
    needs_supervision: false,
    estimator_prospects_access: false,
    team_prospects_access: false,
    dispatch_mode_enabled: false,
    archived_at: null,
    created_at: at('2026-01-05'),
  }))
}

const serviceTypes: Partial<RowOf<'service_types'>>[] = [
  { id: LENS_IDS.plumbing, name: 'Plumbing', sequence_order: 1, billing_only: false, color: null, ledger_bid_prefix: 'B', ledger_job_prefix: 'P' },
]

const customers: Partial<RowOf<'customers'>>[] = [
  { id: LENS_IDS.homeowner, name: SAMPLE_HOMEOWNER.name, address: SAMPLE_HOMEOWNER.address, customer_type: 'homeowner', master_user_id: MASTER, payment_terms: 'due_on_receipt', lien_notice_policy: 'default', gc_pays_by_default: false, sees_customer_bills: true, contact_info: { phone: SAMPLE_HOMEOWNER.phone, email: SAMPLE_HOMEOWNER.email }, created_at: at('2026-03-02') },
  { id: LENS_IDS.gc, name: SAMPLE_GC.company, address: 'San Marcos, TX', customer_type: 'gc', master_user_id: MASTER, payment_terms: 'net_30', lien_notice_policy: 'default', gc_pays_by_default: true, sees_customer_bills: true, contact_info: { name: SAMPLE_GC.contact, email: SAMPLE_GC.email }, created_at: at('2026-02-11') },
  { id: LENS_IDS.owner, name: SAMPLE_OWNER.company, address: SAMPLE_OWNER.address, customer_type: 'owner', master_user_id: MASTER, payment_terms: 'net_30', lien_notice_policy: 'default', gc_pays_by_default: false, sees_customer_bills: true, contact_info: { name: SAMPLE_OWNER.contact }, created_at: at('2026-04-20') },
  { id: LENS_IDS.sub, name: SAMPLE_SUB.company, address: 'Kyle, TX', customer_type: 'trade_partner', master_user_id: MASTER, payment_terms: 'net_30', lien_notice_policy: 'default', gc_pays_by_default: false, sees_customer_bills: false, contact_info: { name: SAMPLE_SUB.contact, email: SAMPLE_SUB.email }, created_at: at('2026-05-14') },
]

type JobSeed = { n: number; number: string; name: string; customer: string; customerName: string; address: string; status: string; revenue: number; paid: number }

const JOBS: JobSeed[] = [
  { n: 1, number: '1312', name: 'Water heater replacement', customer: LENS_IDS.homeowner, customerName: SAMPLE_HOMEOWNER.name, address: SAMPLE_HOMEOWNER.address, status: 'paid', revenue: 4380, paid: 4380 },
  { n: 2, number: '1318', name: 'Sample Retail Shell rough-in', customer: LENS_IDS.owner, customerName: SAMPLE_OWNER.company, address: SAMPLE_OWNER.address, status: 'working', revenue: 86400, paid: 21600 },
  { n: 3, number: '1321', name: 'Cedar Bend Apartments, building C', customer: LENS_IDS.gc, customerName: SAMPLE_GC.company, address: 'San Marcos, TX', status: 'billed', revenue: 212950, paid: 148000 },
  { n: 4, number: '1324', name: 'Whitfield-Okonkwo-Hernández residence, full kitchen and laundry repipe with a tankless conversion', customer: LENS_IDS.homeowner, customerName: SAMPLE_HOMEOWNER.name, address: SAMPLE_HOMEOWNER.address, status: 'waiting', revenue: 18725, paid: 0 },
  { n: 5, number: '1327', name: 'Leak under slab', customer: LENS_IDS.homeowner, customerName: SAMPLE_HOMEOWNER.name, address: SAMPLE_HOMEOWNER.address, status: 'ready_to_bill', revenue: 1250, paid: 0 },
]

const jobs: Partial<RowOf<'jobs_ledger'>>[] = JOBS.map((j) => ({
  id: id('8002', j.n),
  hcp_number: j.number,
  click_number: j.number,
  job_name: j.name,
  job_address: j.address,
  customer_id: j.customer,
  customer_name: j.customerName,
  status: j.status,
  revenue: j.revenue,
  payments_made: j.paid,
  service_type_id: LENS_IDS.plumbing,
  master_user_id: MASTER,
  bill_to_party: 'customer',
  billing_only: false,
  bill_copy_other_party: false,
  show_bills_to_other_party: false,
  gc_auto_offer_next: false,
  gc_shares_stage_dates: false,
  lien_last_work_note: '',
  lien_payment_bond: 'unknown',
  created_at: at('2026-09-01'),
}))

const JOB = (n: number) => id('8002', n)
const P = LENS_PEOPLE

/** A day on the company's calendar, `offset` days from today. */
function dayFrom(today: string, offset: number): string {
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

/** Who works where today and around it: the schedule the crew day, My Schedule and a supervisor's days read. */
function blocks(today: string): Partial<RowOf<'job_schedule_blocks'>>[] {
  const b = (n: number, who: LensPerson, offset: number, start: string, end: string, job: string | null, bid: string | null = null, note: string | null = null) => ({
    id: id('8004', n), assignee_user_id: who.id, work_date: dayFrom(today, offset), time_start: start, time_end: end, job_id: job, bid_id: bid, note, created_by: P.assistant.id, created_at: at(dayFrom(today, offset - 3)), updated_at: at(dayFrom(today, offset - 3)),
  })
  return [
    b(1, P.primary, 0, '07:00:00', '11:30:00', JOB(2)),
    b(2, P.primary, 0, '13:00:00', '15:00:00', JOB(5), null, 'Bring the slab leak locator'),
    b(3, P.helpers, 0, '07:00:00', '15:30:00', JOB(2)),
    b(4, P.superintendent, 0, '08:00:00', '09:00:00', JOB(3), null, 'Walk building C with Pat'),
    b(5, P.superintendent, 0, '10:00:00', '11:00:00', JOB(2)),
    b(6, P.estimator, 0, '09:00:00', '10:00:00', null, BID(1), 'Site visit, building D'),
    b(7, P.primary, 1, '07:00:00', '15:30:00', JOB(2)),
    b(8, P.helpers, 1, '07:00:00', '15:30:00', JOB(2)),
    b(9, P.subcontractor, 1, '08:00:00', '16:00:00', JOB(3)),
    b(10, P.primary, -1, '07:00:00', '15:30:00', JOB(2)),
    b(11, P.helpers, -1, '07:00:00', '15:30:00', JOB(2)),
    b(12, P.primary, -2, '07:00:00', '15:30:00', JOB(1)),
    b(13, P.helpers, -2, '07:00:00', '15:30:00', JOB(1)),
  ]
}

/** Who clocked in: today's crew is on the clock, yesterday's went home. */
function sessions(today: string): Partial<RowOf<'clock_sessions'>>[] {
  const s = (n: number, who: LensPerson, offset: number, inAt: string, outAt: string | null, job: string) => {
    const day = dayFrom(today, offset)
    const z = chicagoOffset(day)
    return { id: id('8005', n), user_id: who.id, work_date: day, clocked_in_at: `${day}T${inAt}${z}`, clocked_out_at: outAt ? `${day}T${outAt}${z}` : null, job_ledger_id: job, notes: '', origin: 'app', created_at: `${day}T${inAt}${z}` }
  }
  return [
    s(1, P.primary, 0, '07:02:00', null, JOB(2)),
    s(2, P.helpers, 0, '07:05:00', null, JOB(2)),
    s(3, P.superintendent, 0, '07:40:00', null, JOB(3)),
    s(4, P.primary, -1, '06:58:00', '15:34:00', JOB(2)),
    s(5, P.helpers, -1, '07:01:00', '15:31:00', JOB(2)),
  ]
}

const BID = (n: number) => id('8006', n)

function bids(today: string): Partial<RowOf<'bids'>>[] {
  const base = { service_type_id: LENS_IDS.plumbing, estimator_id: P.estimator.id, created_by: P.estimator.id, accepted_alternate_tags: [], alternate_group_tags: [], declined_alternate_tags: [], itb_links: [], holdout: false, bid_to_marked_plans: false, include_materials_by_stage: false, include_payment_schedule: false, include_schedule_of_values: false, materials_model: 'standard', robot_opt_out: false, sov_letter_total_only: false, sov_shape: 'standard', sov_split_labor_material: false }
  return [
    { ...base, id: BID(1), bid_number: 'B1301', project_name: 'Cedar Bend Apartments, building D', address: 'San Marcos, TX', customer_id: LENS_IDS.gc, bid_due_date: dayFrom(today, 3), created_at: at(dayFrom(today, -9)) },
    { ...base, id: BID(2), bid_number: 'B1302', project_name: 'Sample Retail Shell, phase 2', address: SAMPLE_OWNER.address, customer_id: LENS_IDS.owner, bid_due_date: dayFrom(today, 8), created_at: at(dayFrom(today, -2)) },
    { ...base, id: BID(3), bid_number: 'B1303', project_name: 'Kyle library restrooms', address: 'Kyle, TX', customer_id: LENS_IDS.gc, bid_due_date: dayFrom(today, 4), bid_value: 48250, priced_at: at(dayFrom(today, -1)), priced_by: P.estimator.id, created_at: at(dayFrom(today, -14)) },
    { ...base, id: BID(4), bid_number: 'B1304', project_name: 'Kitchen repipe', address: SAMPLE_HOMEOWNER.address, customer_id: LENS_IDS.homeowner, bid_value: 18725, bid_date_sent: dayFrom(today, -5), created_at: at(dayFrom(today, -20)) },
    { ...base, id: BID(5), bid_number: 'B1288', project_name: 'Cedar Bend Apartments, building C', address: 'San Marcos, TX', customer_id: LENS_IDS.gc, bid_value: 212950, agreed_value: 212950, outcome: 'won', outcome_at: at(dayFrom(today, -60)), bid_date_sent: dayFrom(today, -75), created_at: at(dayFrom(today, -90)) },
  ]
}

/** The bills behind the jobs' money: what was billed and what came in, so every money strip adds up. */
function invoices(today: string): Partial<RowOf<'jobs_ledger_invoices'>>[] {
  const inv = (n: number, job: number, amount: number, status: string, offset: number, seq = 1) => ({ id: id('8007', n), job_id: JOB(job), amount, status, billed_at: at(dayFrom(today, offset)), sequence_order: seq, is_primary_rtb_bundle: false, lien_offer_pct: 0, created_at: at(dayFrom(today, offset)) })
  return [inv(1, 1, 4380, 'paid', -12), inv(2, 2, 21600, 'paid', -40), inv(3, 3, 148000, 'paid', -50), inv(4, 3, 64950, 'billed', -21, 2)]
}

/** The map's points for the world's addresses, so a map reads them instead of asking for a geocode. */
function geocodes(now: Date): Partial<RowOf<'address_geocodes'>>[] {
  const addrs = [SAMPLE_HOMEOWNER.address, SAMPLE_OWNER.address, 'San Marcos, TX', 'Kyle, TX']
  return addrs.map((a) => ({ address_normalized: normalizeAddress(a), ...lensPoint(normalizeAddress(a)), geocode_error: null, geocoded_at: now.toISOString() }))
}

/** The people at the company, as the roster reads them: one row per invented person, tied to their sign-in. */
function people(): Partial<RowOf<'people'>>[] {
  return Object.values(P).map((p, i) => ({ id: id('8008', i + 1), name: p.name, kind: p.role === 'subcontractor' ? 'sub' : 'employee', account_user_id: p.id, master_user_id: MASTER, email: p.email, phone: p.phone, license_asked: false, start_date: '2025-03-03', created_at: at('2025-03-03') }))
}

const CONTACT = (n: number) => id('8009', n)

/** The office's threads: who wrote, what they said, and the job each thread is about. */
function threads(today: string): { contacts: Partial<RowOf<'contacts'>>[]; messages: Partial<RowOf<'messages'>>[]; contactJobs: Partial<RowOf<'contact_jobs'>>[] } {
  const z = chicagoOffset(today)
  const atToday = (hhmm: string, offset = 0) => `${dayFrom(today, offset)}T${hhmm}:00${z}`
  const contacts: Partial<RowOf<'contacts'>>[] = [
    { id: CONTACT(1), kind: 'customer', state: 'waiting', customer_id: LENS_IDS.homeowner, name: SAMPLE_HOMEOWNER.name, created_at: at('2026-03-02') },
    { id: CONTACT(2), kind: 'customer', state: 'waiting', customer_id: LENS_IDS.gc, name: SAMPLE_GC.contact, created_at: at('2026-02-11') },
    { id: CONTACT(3), kind: 'customer', state: 'done', customer_id: LENS_IDS.owner, name: SAMPLE_OWNER.contact, created_at: at('2026-04-20') },
    { id: CONTACT(4), kind: 'trade', state: 'done', name: SAMPLE_SUB.contact, created_at: at('2026-05-14') },
  ]
  const m = (n: number, contact: number, channel: string, direction: string, when: string, body: string, who: string, job: number | null = null) => ({ id: id('800a', n), contact_id: CONTACT(contact), channel, direction, at: when, body, who_text: who, office_only: direction === 'team', quo_rev: 0, jobs_ledger_id: job ? JOB(job) : null, created_at: when })
  const messages: Partial<RowOf<'messages'>>[] = [
    m(1, 1, 'text', 'in', atToday('08:12'), 'Is someone coming today about the leak under the slab?', SAMPLE_HOMEOWNER.name, 5),
    m(2, 1, 'text', 'out', atToday('08:20'), 'Yes, Paco is on his way after lunch. He will text you when he leaves the shop.', P.assistant.name, 5),
    m(3, 1, 'text', 'in', atToday('08:21'), 'Thank you!', SAMPLE_HOMEOWNER.name, 5),
    m(4, 2, 'email', 'in', atToday('16:40', -1), 'Can your crew start building C Monday? The slab is poured.', SAMPLE_GC.contact, 3),
    m(5, 2, 'note', 'team', atToday('09:05'), 'Called Pat back, waiting on the revised set before we commit.', P.assistant.name, 3),
    m(6, 3, 'call', 'in', atToday('11:30', -2), 'Asked whether the inspection is still on for 9.', SAMPLE_OWNER.contact, 2),
    m(7, 3, 'text', 'out', atToday('11:42', -2), 'Still on for 9, we will be there at 8:30.', P.superintendent.name, 2),
    m(8, 4, 'text', 'in', atToday('15:02', -1), 'Paperwork for building C is signed and sent back.', SAMPLE_SUB.contact, 3),
  ]
  const contactJobs: Partial<RowOf<'contact_jobs'>>[] = [
    { id: id('800b', 1), contact_id: CONTACT(1), jobs_ledger_id: JOB(5), is_default: true, created_at: at('2026-09-05') },
    { id: id('800b', 2), contact_id: CONTACT(2), jobs_ledger_id: JOB(3), is_default: true, created_at: at('2026-09-03') },
    { id: id('800b', 3), contact_id: CONTACT(3), jobs_ledger_id: JOB(2), is_default: true, created_at: at('2026-09-02') },
  ]
  return { contacts, messages, contactJobs }
}

/** A sub or a helper reads only the jobs they work on, as the database's rules give them. */
const FIELD_ROLES = new Set(['subcontractor', 'helpers', 'primary'])

function rowsFor(viewer: LensPerson, mood: LensMood, now: Date): Record<string, Row[]> {
  const readOnly = mood === 'training'
  const today = lensToday(now)
  const sched = blocks(today)
  const clock = sessions(today)
  const mine = new Set<unknown>([...sched.filter((b) => b.assignee_user_id === viewer.id).map((b) => b.job_id), ...clock.filter((s) => s.user_id === viewer.id).map((s) => s.job_ledger_id)])
  const all: Record<string, Row[]> = {
    users: users(viewer, readOnly),
    service_types: serviceTypes,
    customers,
    jobs_ledger: FIELD_ROLES.has(viewer.role) ? jobs.filter((j) => mine.has(j.id)) : jobs,
    job_schedule_blocks: sched,
    clock_sessions: clock,
    bids: FIELD_ROLES.has(viewer.role) ? [] : bids(today),
    jobs_ledger_invoices: FIELD_ROLES.has(viewer.role) ? [] : invoices(today),
    address_geocodes: geocodes(now),
    people: people(),
    ...(FIELD_ROLES.has(viewer.role) ? {} : (() => {
      const th = threads(today)
      return { contacts: th.contacts, messages: th.messages, contact_jobs: th.contactJobs }
    })()),
  }
  if (mood !== 'empty') return all
  // An empty company: its settings and trades, and the person signed in, and nothing else.
  const out: Record<string, Row[]> = { users: all.users!.filter((u) => u.id === viewer.id) }
  for (const t of LENS_CONFIG_TABLES) if (all[t]) out[t] = all[t]!
  return out
}

export function buildLensWorld(cfg: LensConfig, now: Date = new Date()): LensWorld {
  const viewer = LENS_PEOPLE[cfg.as]
  return {
    viewer,
    mood: cfg.mood,
    store: new MapStore(rowsFor(viewer, cfg.mood, now)),
    readOnly: cfg.mood === 'training',
    rpc: LENS_RPC,
    functions: LENS_FUNCTIONS,
  }
}
