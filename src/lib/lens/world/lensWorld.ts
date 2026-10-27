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
export const LENS_CONFIG_TABLES: ReadonlySet<string> = new Set(['app_settings', 'service_types'])

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

function rowsFor(viewer: LensPerson, mood: LensMood): Record<string, Row[]> {
  const readOnly = mood === 'training'
  const all: Record<string, Row[]> = {
    users: users(viewer, readOnly),
    service_types: serviceTypes,
    customers,
    jobs_ledger: jobs,
  }
  if (mood !== 'empty') return all
  // An empty company: its settings and trades, and the person signed in, and nothing else.
  const out: Record<string, Row[]> = { users: all.users!.filter((u) => u.id === viewer.id) }
  for (const t of LENS_CONFIG_TABLES) if (all[t]) out[t] = all[t]!
  return out
}

export function buildLensWorld(cfg: LensConfig): LensWorld {
  const viewer = LENS_PEOPLE[cfg.as]
  return {
    viewer,
    mood: cfg.mood,
    store: new MapStore(rowsFor(viewer, cfg.mood)),
    readOnly: cfg.mood === 'training',
    rpc: {},
    functions: {},
  }
}
