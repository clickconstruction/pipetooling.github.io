/**
 * The invented world's answers to the RPCs and edge functions the busiest screens ask for (punch
 * list #194). Each answer has the shape its caller parses, found by reading the caller, so a
 * section draws its own empty words or the world's rows instead of an error. Where the app expects
 * content, the answer is computed from the world's rows: the crew day from its schedule blocks and
 * clock sessions, a supervisor's days from the blocks of the people they lead, the map's points
 * from invented coordinates around Kyle, Texas. The state knob reaches these too: an empty company
 * answers empty. Pure apart from the store each handler is handed.
 */
import { todayYmdInAppTz } from '../../../utils/dateUtils'
import type { Row } from '../answer/postgrest'
import type { LensFnHandler, LensRpcHandler, LensWorldCtx } from './lensWorld'

const rows = (w: LensWorldCtx, table: string): Row[] => w.store.rows(table)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const ymdOf = (iso: unknown): string => str(iso).slice(0, 10)
const isSuper = (w: LensWorldCtx) => w.viewer.role === 'superintendent'

/** Monday of the week holding `ymd`, as YYYY-MM-DD. */
export function mondayOf(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** Today on the company's calendar, read by the app's own helper so the world and its screens agree. */
export function lensToday(now: Date): string {
  return todayYmdInAppTz(now)
}

/** Chicago's UTC offset on a day, as `-05:00` or `-06:00`, so an invented clock-in reads at the hour it says. */
export function chicagoOffset(ymd: string): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'shortOffset' }).formatToParts(new Date(`${ymd}T17:00:00Z`)).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-6'
  const m = name.match(/GMT([+-])(\d{1,2})/)
  return m ? `${m[1]}${m[2]!.padStart(2, '0')}:00` : '-06:00'
}

function jobLite(j: Row) {
  return { id: j.id, hcp_number: j.hcp_number ?? null, click_number: j.click_number ?? null, job_name: j.job_name ?? null, job_address: j.job_address ?? null, status: j.status ?? null, pct_complete: (j.pct_complete as number | null) ?? null }
}

/** Invented coordinates near Kyle for any address, the same every time: inside the lower 48, as the real function keeps them. */
export function lensPoint(addressNormalized: string): { lat: number; lng: number } {
  let h = 0
  for (const c of addressNormalized) h = (h * 33 + c.charCodeAt(0)) >>> 0
  const dx = ((h % 1000) / 1000 - 0.5) * 0.18
  const dy = (((h >>> 10) % 1000) / 1000 - 0.5) * 0.14
  return { lat: Math.round((29.9891 + dy) * 1e5) / 1e5, lng: Math.round((-97.8772 + dx) * 1e5) / 1e5 }
}

export const normalizeAddress = (a: string) => a.trim().replace(/\s+/g, ' ').toLowerCase()

const crewDay: LensRpcHandler = (args, w) => {
  const day = str(args.p_day) || lensToday(w.now)
  const sessions = rows(w, 'clock_sessions')
    .filter((s) => str(s.work_date) === day || ymdOf(s.clocked_in_at) === day)
    .map((s) => ({ user_id: s.user_id, job_id: s.job_ledger_id ?? null, clocked_in_at: s.clocked_in_at, clocked_out_at: s.clocked_out_at ?? null }))
  const blocks = rows(w, 'job_schedule_blocks')
    .filter((b) => str(b.work_date) === day)
    .map((b) => ({ user_id: b.assignee_user_id, job_id: b.job_id ?? null, bid_id: b.bid_id ?? null, time_start: b.time_start, time_end: b.time_end, note: b.note ?? null }))
  const jobIds = new Set<unknown>([...sessions.map((s) => s.job_id), ...blocks.map((b) => b.job_id)].filter(Boolean))
  return {
    day,
    sessions,
    blocks,
    reports: [],
    pct_notes: [],
    users: rows(w, 'users').map((u) => ({ id: u.id, name: u.name ?? null, role: u.role })),
    jobs: rows(w, 'jobs_ledger').filter((j) => jobIds.has(j.id)).map(jobLite),
  }
}

const supervisedDays: LensRpcHandler = (args, w) => {
  if (!isSuper(w)) return { supervisor: false }
  const from = str(args.p_from)
  const to = str(args.p_to)
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to)
  const users = new Map(rows(w, 'users').map((u) => [u.id, u]))
  const jobs = new Map(rows(w, 'jobs_ledger').map((j) => [j.id, j]))
  const byJobDay = new Map<string, { job_id: unknown; work_date: string; crew: Map<unknown, Row> }>()
  for (const b of rows(w, 'job_schedule_blocks')) {
    const d = str(b.work_date)
    if (!b.job_id || !inRange(d) || b.assignee_user_id === w.viewer.id) continue
    const key = `${b.job_id}|${d}`
    const cur = byJobDay.get(key) ?? { job_id: b.job_id, work_date: d, crew: new Map() }
    const u = users.get(b.assignee_user_id)
    if (u) cur.crew.set(u.id, u)
    byJobDay.set(key, cur)
  }
  const job_days = [...byJobDay.values()].map((x) => {
    const j = jobs.get(x.job_id) ?? {}
    return { job_id: x.job_id, work_date: x.work_date, hcp_number: j.hcp_number ?? null, click_number: j.click_number ?? null, job_name: j.job_name ?? null, customer_name: j.customer_name ?? null, job_address: j.job_address ?? null, report_count: 0, my_report_count: 0, crew: [...x.crew.values()].map((u) => ({ user_id: u.id, name: u.name ?? null, role: u.role ?? null })) }
  })
  const sessions = rows(w, 'clock_sessions')
    .filter((s) => inRange(str(s.work_date)) && s.user_id !== w.viewer.id)
    .map((s) => ({ id: s.id, user_id: s.user_id, name: (users.get(s.user_id)?.name as string | undefined) ?? null, job_id: s.job_ledger_id ?? null, work_date: s.work_date, clocked_in_at: s.clocked_in_at, clocked_out_at: s.clocked_out_at ?? null, notes: s.notes || null, approved: Boolean(s.approved_at) }))
  return { supervisor: true, from, to, job_days, sessions }
}

const supervisorDeck: LensRpcHandler = (args, w) => {
  const month = str(args.p_month) || `${lensToday(w.now).slice(0, 7)}-01`
  if (!isSuper(w)) return { supervisor: false }
  const users = new Map(rows(w, 'users').map((u) => [u.id, u]))
  const jobs = new Map(rows(w, 'jobs_ledger').map((j) => [j.id, j]))
  const people = new Map<unknown, { days: Set<string>; jobs: Set<string> }>()
  for (const b of rows(w, 'job_schedule_blocks')) {
    if (!str(b.work_date).startsWith(month.slice(0, 7)) || b.assignee_user_id === w.viewer.id) continue
    const p = people.get(b.assignee_user_id) ?? { days: new Set(), jobs: new Set() }
    p.days.add(str(b.work_date))
    const name = jobs.get(b.job_id)?.job_name
    if (typeof name === 'string') p.jobs.add(name)
    people.set(b.assignee_user_id, p)
  }
  return {
    supervisor: true,
    month,
    people: [...people.entries()].map(([id, p]) => ({ user_id: id, name: (users.get(id)?.name as string | undefined) ?? null, role: (users.get(id)?.role as string | undefined) ?? null, days: p.days.size, jobs: [...p.jobs], reviewed: false })),
  }
}

/** The jobs a person works on, from their schedule and their clock, as their dashboard lists them. */
const assignedJobs: LensRpcHandler = (_args, w) => {
  const mine = new Set<unknown>([
    ...rows(w, 'job_schedule_blocks').filter((b) => b.assignee_user_id === w.viewer.id).map((b) => b.job_id),
    ...rows(w, 'clock_sessions').filter((s) => s.user_id === w.viewer.id).map((s) => s.job_ledger_id),
  ])
  const lastClock = (jobId: unknown) => rows(w, 'clock_sessions').filter((s) => s.job_ledger_id === jobId).map((s) => str(s.clocked_in_at)).sort().pop() ?? null
  return rows(w, 'jobs_ledger')
    .filter((j) => mine.has(j.id))
    .map((j) => ({ id: j.id, click_number: j.click_number, hcp_number: j.hcp_number, job_name: j.job_name, job_address: j.job_address, customer_name: j.customer_name, status: j.status, revenue: j.revenue, master_user_id: j.master_user_id, service_type_id: j.service_type_id, service_type_name: 'Plumbing', created_at: j.created_at, project_id: null, google_drive_link: null, job_pictures_link: null, job_plans_link: null, in_progress_stage_name: null, in_progress_step_id: null, last_clock_activity_at: lastClock(j.id), last_job_activity_at: lastClock(j.id), last_report_at: null, last_schedule_activity_at: null, last_thread_note_at: null, my_last_report_at: null }))
}

const stagesEnrichment: LensRpcHandler = (args, w) => {
  const ids = new Set(Array.isArray(args.p_job_ids) ? (args.p_job_ids as unknown[]) : [])
  const schedule_max: Record<string, string> = {}
  for (const b of rows(w, 'job_schedule_blocks')) {
    const id = str(b.job_id)
    if (!id || (ids.size > 0 && !ids.has(id))) continue
    if (!schedule_max[id] || str(b.work_date) > schedule_max[id]!) schedule_max[id] = str(b.work_date)
  }
  return { materials: {}, fixtures: {}, schedule_max, estimates: {} }
}

const statementWeek: LensRpcHandler = (_args, w) => {
  const today = lensToday(w.now)
  const week_start = mondayOf(today)
  const deadline = new Date(`${week_start}T12:00:00Z`)
  deadline.setUTCDate(deadline.getUTCDate() + 4)
  return { office: true, week_start, deadline: deadline.toISOString().slice(0, 10), today, items: [], counts: { gcs: 0, to_check: 0, to_send: 0, to_send_total: 0, words_due: 0, done: 0, late: 0, total: 0 } }
}

export const LENS_RPC: Readonly<Record<string, LensRpcHandler>> = {
  get_my_partner_summary: () => ({ exists: false }),
  get_my_partner_jobs: () => ({ exists: false }),
  list_paid_claims: () => [],
  list_my_money_strip: () => [],
  trial_helpers_i_led_today: () => [],
  gc_review_week_status: () => ({ gcs_outstanding: 0, gcs_certified: 0, gcs_sent: 0, gcs_done: 0 }),
  get_my_statement_week: statementWeek,
  submittal_robot_liveness: () => ({ unrevoked_seats: 0, last_used_at: null, last_seen_at: null }),
  get_crew_day_payload: crewDay,
  get_supervised_days_payload: supervisedDays,
  get_supervisor_review_deck: supervisorDeck,
  my_sub_portal_address: (_a, w) => (w.viewer.role === 'subcontractor' ? { slug: 'sams-plumbing', token: null } : { slug: null, token: null }),
  get_billed_customer_pay_speeds: () => ({ company: null, customers: {}, segments: { residential: null, commercial: null }, customerTypes: {}, receipts: {}, quality: null }),
  list_job_promised_pay_dates: () => ({}),
  list_payment_promise_records: () => [],
  list_payment_chase_touches: () => [],
  get_stages_enrichment: stagesEnrichment,
  follow_up_count: (_a, w) => (w.mood === 'empty' ? 0 : 2),
  dispatch_inbox_note_stats: () => [],
  list_assigned_jobs_for_dashboard: assignedJobs,
}

const mercury: LensFnHandler = (_body, w) => {
  const accounts = w.mood === 'empty' ? [] : [
    { id: 'lens-operating', name: 'Operating', kind: 'checking', currentBalance: 48210.55, availableBalance: 47390.12 },
    { id: 'lens-payroll', name: 'Payroll', kind: 'checking', currentBalance: 18500, availableBalance: 18500 },
  ]
  return { ok: true, accounts, totalCurrentBalance: accounts.reduce((a, x) => a + x.currentBalance, 0), totalAvailableBalance: accounts.reduce((a, x) => a + x.availableBalance, 0) }
}

/** One point per address asked for, written to address_geocodes as the real function upserts them. */
const geocode: LensFnHandler = (body, w) => {
  const asked = (body as { addresses?: unknown } | null)?.addresses
  const list = Array.isArray(asked) ? asked.filter((a): a is string => typeof a === 'string').slice(0, 20) : []
  const results = list.map((a) => ({ address_normalized: normalizeAddress(a), ...lensPoint(normalizeAddress(a)) }))
  const stored = [...w.store.rows('address_geocodes')]
  for (const r of results) {
    if (!stored.some((s) => s.address_normalized === r.address_normalized)) stored.push({ ...r, geocode_error: null, geocoded_at: w.now.toISOString() })
  }
  w.store.set('address_geocodes', stored)
  return { results, failures: [] }
}

export const LENS_FUNCTIONS: Readonly<Record<string, LensFnHandler>> = {
  'get-mercury-account-balances': mercury,
  'geocode-address-batch': geocode,
  // An invented address has no Street View imagery; the caller reads ok:false as no picture.
  'street-view-preview': () => ({ ok: false, googleStatus: 'ZERO_RESULTS' }),
}
