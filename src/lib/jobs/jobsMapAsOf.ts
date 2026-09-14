/**
 * As of (v2.3398): the Pipeline map rewound to any day since the Pipeline
 * began recording status moves. Pure: the history rows in, the day's map jobs
 * and the since-then strip out; `loadJobsMapHistory` reads, `JobsMapCard`
 * renders.
 *
 * What "as of a day" means for a pin:
 *  - status on the day: the last recorded move at or before that day
 *    (`job_status_events`); before a job's first move, that move's
 *    `from_status`; a job with no moves at all kept the status it has now.
 *  - a job created after the day is not drawn.
 *  - Collections on the day: flagged at or before the day and still flagged
 *    now (the Pipeline clears the flag on paid, so a stint that has since been
 *    paid off cannot be shown).
 *  - money on the day: each bill that had gone out by the day, minus the
 *    payments dated at or before the day — so the rail's totals are the day's.
 *
 * The floor is the first day the Pipeline recorded a move; before it the
 * table cannot say where a job stood.
 */
import { ymdAddDays } from '../../utils/dateUtils'
import { normalizeAddressForGeocodeKey } from '../map/normalizeAddressForGeocode'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { effectiveInvoiceParty } from './billToParty'
import { ymdToDayNumber } from './jobRunningTimeline'
import type { JobsMapJob, JobsMapSection } from './jobsMap'

/** The first `job_status_events` row — history starts here. */
export const JOBS_MAP_AS_OF_FLOOR_YMD = '2026-02-22'

/** One job as the history read carries it — the light columns, no embeds beyond the GC name. */
export type JobsMapHistoryJob = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  status: string | null
  created_ymd: string
  collections_ymd: string | null
  customer_id: string | null
  customer_name: string | null
  gc_customer_id: string | null
  gc_name: string | null
  bill_to_party: string | null
}

export type JobsMapStatusMove = { job_id: string; from_status: string | null; to_status: string; ymd: string }
export type JobsMapBillRow = { invoice_id: string; job_id: string; amount: number; billed_ymd: string }
export type JobsMapPaymentRow = { invoice_id: string | null; amount: number; paid_ymd: string }

export type JobsMapHistory = {
  jobs: JobsMapHistoryJob[]
  /** Every move, oldest first (any order in; sorted here). */
  moves: JobsMapStatusMove[]
  bills: JobsMapBillRow[]
  payments: JobsMapPaymentRow[]
  loadedAt: number
}

function sectionForStatus(status: string | null | undefined): JobsMapSection | null {
  switch ((status ?? 'working').trim()) {
    case 'waiting':
      return 'waiting'
    case 'working':
      return 'working'
    case 'ready_to_bill':
      return 'readyToBill'
    case 'billed':
      return 'billed'
    case 'paid':
      return 'paid'
    default:
      return null
  }
}

/** Moves grouped by job, oldest first. */
export function movesByJob(moves: readonly JobsMapStatusMove[]): Map<string, JobsMapStatusMove[]> {
  const out = new Map<string, JobsMapStatusMove[]>()
  for (const m of [...moves].sort((a, b) => a.ymd.localeCompare(b.ymd))) {
    const list = out.get(m.job_id)
    if (list) list.push(m)
    else out.set(m.job_id, [m])
  }
  return out
}

/**
 * Where the job stood on `ymd`: the last move at or before the day; before the
 * first move, that move's `from_status`; with no moves, the status it has now.
 */
export function statusOnDay(job: Pick<JobsMapHistoryJob, 'status'>, moves: readonly JobsMapStatusMove[] | undefined, ymd: string): string | null {
  if (!moves || moves.length === 0) return job.status
  let last: JobsMapStatusMove | null = null
  for (const m of moves) {
    if (m.ymd <= ymd) last = m
    else break
  }
  if (last) return last.to_status
  return moves[0]!.from_status ?? job.status
}

/** Open balance on `ymd`: each bill out by then, minus the payments dated by then, clamped at zero per bill. Also the oldest such bill's age. */
export function moneyOnDay(
  bills: readonly JobsMapBillRow[],
  paymentsByInvoice: ReadonlyMap<string, readonly JobsMapPaymentRow[]>,
  ymd: string,
): { owedDollars: number; billedAgeDays: number | null } {
  let owed = 0
  let oldest: number | null = null
  for (const b of bills) {
    if (b.billed_ymd > ymd) continue
    let paid = 0
    for (const p of paymentsByInvoice.get(b.invoice_id) ?? []) if (p.paid_ymd <= ymd) paid += p.amount
    owed += Math.max(0, b.amount - paid)
    const age = ymdToDayNumber(ymd) - ymdToDayNumber(b.billed_ymd)
    if (oldest == null || age > oldest) oldest = age
  }
  return { owedDollars: owed, billedAgeDays: oldest }
}

/** Index helpers the card builds once per history load. */
export function indexJobsMapHistory(h: JobsMapHistory): {
  movesByJob: Map<string, JobsMapStatusMove[]>
  billsByJob: Map<string, JobsMapBillRow[]>
  paymentsByInvoice: Map<string, JobsMapPaymentRow[]>
} {
  const billsByJob = new Map<string, JobsMapBillRow[]>()
  for (const b of h.bills) (billsByJob.get(b.job_id) ?? billsByJob.set(b.job_id, []).get(b.job_id)!).push(b)
  const paymentsByInvoice = new Map<string, JobsMapPaymentRow[]>()
  for (const p of h.payments) {
    if (!p.invoice_id) continue
    ;(paymentsByInvoice.get(p.invoice_id) ?? paymentsByInvoice.set(p.invoice_id, []).get(p.invoice_id)!).push(p)
  }
  return { movesByJob: movesByJob(h.moves), billsByJob, paymentsByInvoice }
}

/**
 * The map's jobs as they stood on `ymd`. A job created after the day is not
 * drawn; the section is the status on the day; money is the day's; the
 * percent is not replayed (no history) so it is left out.
 */
export function jobsMapJobsAsOf(
  h: JobsMapHistory,
  idx: ReturnType<typeof indexJobsMapHistory>,
  ymd: string,
): { jobs: JobsMapJob[]; noAddress: JobsMapJob[] } {
  const jobs: JobsMapJob[] = []
  const noAddress: JobsMapJob[] = []
  for (const j of h.jobs) {
    if (j.created_ymd > ymd) continue
    const status = statusOnDay(j, idx.movesByJob.get(j.id), ymd)
    const section = sectionForStatus(status)
    if (!section) continue
    const inCollections = section === 'billed' && j.collections_ymd != null && j.collections_ymd <= ymd
    const party = effectiveInvoiceParty({ bill_to_party: j.bill_to_party, gc_customer_id: j.gc_customer_id, customer_id: j.customer_id }, null)
    const payerName = ((party === 'gc' ? j.gc_name : j.customer_name) ?? '').trim() || null
    const address = (j.job_address ?? '').trim()
    const addressKey = normalizeAddressForGeocodeKey(address)
    const numberLabel = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
    const jobName = (j.job_name ?? '').trim() || '—'
    const money = section === 'billed' || section === 'readyToBill' ? moneyOnDay(idx.billsByJob.get(j.id) ?? [], idx.paymentsByInvoice, ymd) : { owedDollars: 0, billedAgeDays: null }
    const job: JobsMapJob = {
      id: j.id,
      label: `${numberLabel} · ${jobName}`,
      numberLabel,
      jobName,
      payerName,
      address,
      addressKey,
      section,
      inCollections,
      pctComplete: null,
      owedDollars: money.owedDollars,
      billedAgeDays: section === 'billed' ? money.billedAgeDays : null,
      row: null,
    }
    if (addressKey.length < 3) noAddress.push(job)
    else jobs.push(job)
  }
  return { jobs, noAddress }
}

export type JobsMapSinceThen = {
  /** Jobs created after the day. */
  started: number
  /** Moves to Billed after the day. */
  billed: number
  /** Moves to Paid after the day. */
  paid: number
  /** Flagged into Collections after the day (still flagged now). */
  collections: number
}

/** What happened between the as-of day (exclusive) and today (inclusive). */
export function jobsMapSinceThen(h: JobsMapHistory, asOfYmd: string, todayYmd: string): JobsMapSinceThen {
  const between = (ymd: string | null | undefined) => ymd != null && ymd > asOfYmd && ymd <= todayYmd
  let started = 0
  let collections = 0
  for (const j of h.jobs) {
    if (between(j.created_ymd)) started += 1
    if (between(j.collections_ymd)) collections += 1
  }
  let billed = 0
  let paid = 0
  for (const m of h.moves) {
    if (!between(m.ymd)) continue
    if (m.to_status === 'billed') billed += 1
    else if (m.to_status === 'paid') paid += 1
  }
  return { started, billed, paid, collections }
}

/** `Since Jun 2: +41 jobs started · 38 billed · 52 paid · 2 sent to collections` (zero parts dropped; empty when nothing moved). */
export function jobsMapSinceThenLine(s: JobsMapSinceThen): string {
  const parts: string[] = []
  if (s.started > 0) parts.push(`+${s.started} ${s.started === 1 ? 'job' : 'jobs'} started`)
  if (s.billed > 0) parts.push(`${s.billed} billed`)
  if (s.paid > 0) parts.push(`${s.paid} paid`)
  if (s.collections > 0) parts.push(`${s.collections} sent to collections`)
  return parts.join(' · ')
}

/** Quick-jump chips: today, whole periods back, and the floor. Only those inside the window. */
export const JOBS_MAP_AS_OF_JUMPS: ReadonlyArray<{ daysBack: number; label: string }> = [
  { daysBack: 0, label: 'today' },
  { daysBack: 7, label: '1 wk' },
  { daysBack: 30, label: '1 mo' },
  { daysBack: 91, label: '3 mo' },
  { daysBack: 182, label: '6 mo' },
]

/** Days from the floor to today — the slider's range. */
export function jobsMapAsOfMaxBack(todayYmd: string, floorYmd: string = JOBS_MAP_AS_OF_FLOOR_YMD): number {
  return Math.max(0, ymdToDayNumber(todayYmd) - ymdToDayNumber(floorYmd))
}

/** The as-of day for a slider position, never before the floor. */
export function jobsMapAsOfYmd(todayYmd: string, daysBack: number, floorYmd: string = JOBS_MAP_AS_OF_FLOOR_YMD): string {
  const target = ymdAddDays(todayYmd, -Math.max(0, Math.floor(daysBack)))
  return target < floorYmd ? floorYmd : target
}

/** `104 d ago` / `3 wk ago` / `` for today. */
export function jobsMapDaysBackLabel(daysBack: number): string {
  if (daysBack <= 0) return ''
  if (daysBack % 7 === 0 && daysBack < 60) return `${daysBack / 7} wk ago`
  return `${daysBack} d ago`
}

/** One tick of Play: a day closer to today. */
export const JOBS_MAP_PLAY_MS_PER_DAY = 150
