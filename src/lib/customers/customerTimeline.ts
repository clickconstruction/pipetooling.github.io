/**
 * Customer timeline (punch list #97): one customer's whole story on one spine of time.
 *
 * The owner's ask (2026-10-07): look up a customer and scroll a vertical timeline where each
 * job is an arrow from the day its card was made to the day the final payment landed. Office
 * acts with the customer sit left of the arrows (bills, payments and their deposits, promises,
 * statements, notices, office notes); what we put in sits right (crew hours, field notes,
 * reports, tests, supply tickets). A bar floats above with what they owe us and the hours and
 * materials we have not been paid for, and reads those numbers as of the day you scroll to.
 *
 * Pure: `buildCustomerTimeline(input, todayYmd, nowMs)` turns the rows `fetchCustomerTimeline`
 * reads into render-ready rows. The rules, each stated once:
 *
 * - **Whose jobs.** Every job where the customer is the payer (`customer_id`) or the GC
 *   (`gc_customer_id`). On a GC's job somebody else may pay; every card on it names them.
 * - **A job's name** is its street when the job name only repeats a name the timeline already
 *   shows: the customer's, the payer's or the GC's (jobs are often named after their GC).
 * - **First seen.** A job starts at the earliest thing on record: the card, a status move, a
 *   bill, a payment, a crew day, a ticket, a note. A job whose records start more than a week
 *   before its card was made opens on *First record* (imported work), not *Job card made*.
 * - **Paid in full** is the last move to `paid` (else the last payment) while the job is paid.
 * - **The rail's state on a day** is the job's last status move that day: dashed while waiting,
 *   solid while working (Ready to Bill included), hollow while billed and waiting on the money,
 *   red while in Collections.
 * - **Lanes.** Four colored lanes. Open jobs first (most owed, then busiest), then paid jobs,
 *   newest first. A job takes the first lane whose jobs never overlap it in time, so paid
 *   history reuses lanes; the rest share one grey lane. Jobs open at once never share a color.
 * - **Folds.** A job's crew days fold into one card until an office card on that job or a pause
 *   of more than two weeks. Three or more notes one person wrote on one day fold into one card
 *   (the words once when they are the same words); so do three or more bills billed or sent on
 *   one day, three or more jobs made or paid in full on one day, and the same notice step on
 *   two or more jobs.
 * - **Owed now** is the bill-truth kernel's: open billed rows (job shells included), clamped
 *   once each, Collections in, Uncollectible out. **Owed on a past day** replays each bill:
 *   open from its billed day, less its linked payments as they landed.
 * - **Unpaid hours and materials** are crew hours and supply-house tickets on jobs not yet paid
 *   in full (on a past day: on jobs not paid by that day).
 * - **Rows.** Newest first, one per day with anything on it; a month label when the month
 *   changes; a spacer between days ten or more days apart that says how long; a stretch of more
 *   than sixty days with no job open folds to one *quiet* line.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { appliedByInvoiceUnderRule, isSettledRemainder, openBillRowsForJob, type BillTruthJob } from '../billing/billTruth'
import { customerDaysToPay, type DaysToPay, type ProfileJob } from './customerProfileStats'

export const TIMELINE_COLORED_LANES = 4
export const TIMELINE_PALETTE_SIZE = 8
export const TIMELINE_GAP_ROW_DAYS = 10
export const TIMELINE_QUIET_FOLD_DAYS = 60
export const TIMELINE_HOURS_RUN_BREAK_DAYS = 14
export const TIMELINE_IMPORTED_AFTER_DAYS = 7
/** An open clock session counts at most this many hours toward its day. */
const OPEN_SESSION_CAP_HOURS = 16

// ---------------------------------------------------------------------------
// Input: the rows, mapped by the fetch to plain shapes.
// ---------------------------------------------------------------------------

export type TimelineJobInput = {
  id: string
  hcpNumber: string | null
  clickNumber: string | null
  jobName: string | null
  jobAddress: string | null
  status: string | null
  revenue: number | null
  paymentsMade: number | null
  /** Instant. */
  createdAt: string | null
  customerId: string | null
  /** `jobs_ledger.customer_name`: who the job bills. */
  customerName: string | null
  gcCustomerId: string | null
  /** The GC's customer name, when the job has a GC. */
  gcName?: string | null
  collectionsAt: string | null
  collectionsNote: string | null
  uncollectibleAt: string | null
  uncollectibleReason: string | null
}

export type TimelineInvoiceInput = {
  id: string
  jobId: string
  status: string | null
  amount: number | null
  /** Bill order for the payment rule (v2.5010); billedAt, then id, break ties without it. */
  sequenceOrder?: number | null
  /** Instant. */
  billedAt: string | null
  /** Instant: the latest send to the customer. */
  sentToCustomerAt: string | null
  /** `external_send_channel`. */
  channel: string | null
}

export type TimelinePaymentInput = {
  id: string
  jobId: string
  invoiceId: string | null
  amount: number | null
  /** Date. */
  paidOn: string | null
  paymentType: string | null
  referenceNumber: string | null
  /** Instant: the Mercury deposit the payment was matched to. */
  depositPostedAt: string | null
  depositFrom: string | null
}

export type TimelineStatusEventInput = { jobId: string; fromStatus: string | null; toStatus: string | null; changedAt: string }

export type TimelineNoteInput = {
  id: string
  jobId: string
  body: string
  /** Instant. */
  createdAt: string
  authorName: string | null
  authorRole: string | null
}

export type TimelineClockInput = {
  id: string
  jobId: string
  userName: string | null
  /** Date. */
  workDate: string | null
  clockedInAt: string | null
  clockedOutAt: string | null
  notes: string | null
}

export type TimelineReportInput = {
  id: string
  jobId: string
  createdAt: string
  templateName: string | null
  authorName: string | null
  /** The report's first answer (`jobReportPreviewLine`). */
  preview: string
  percent: number | null
}

export type TimelineTestReportInput = {
  id: string
  jobId: string
  /** Date. */
  testDate: string | null
  createdAt: string
  testType: string | null
  result: string | null
  system: string | null
}

export type TimelineSupplyTicketInput = {
  id: string
  jobId: string
  /** Date. */
  invoiceDate: string | null
  /** The job's share: invoice amount × allocation pct. */
  amount: number
  supplyHouse: string | null
  invoiceNumber: string | null
}

export type TimelinePromiseInput = {
  id: string
  jobId: string
  createdAt: string
  /** Date. */
  promisedDate: string
  note: string | null
  saidBy: string | null
}

export type TimelineStatementInput = { id: string; sentAt: string; sentByName: string | null; jobCount: number | null; total: number | null }

export type TimelineLienSendInput = { method: string | null; recipient: string | null; sentOn: string | null }

export type TimelineLienFilingInput = {
  id: string
  jobId: string
  kind: string | null
  createdAt: string
  amount: number | null
  sends: TimelineLienSendInput[]
}

export type CustomerTimelineInput = {
  customer: { id: string; name: string; createdAt: string | null; dateMet: string | null }
  jobs: TimelineJobInput[]
  invoices: TimelineInvoiceInput[]
  payments: TimelinePaymentInput[]
  statusEvents: TimelineStatusEventInput[]
  notes: TimelineNoteInput[]
  clockSessions: TimelineClockInput[]
  reports: TimelineReportInput[]
  testReports: TimelineTestReportInput[]
  supplyTickets: TimelineSupplyTicketInput[]
  promises: TimelinePromiseInput[]
  statements: TimelineStatementInput[]
  lienFilings: TimelineLienFilingInput[]
}

export function emptyCustomerTimelineInput(customer: CustomerTimelineInput['customer']): CustomerTimelineInput {
  return {
    customer,
    jobs: [],
    invoices: [],
    payments: [],
    statusEvents: [],
    notes: [],
    clockSessions: [],
    reports: [],
    testReports: [],
    supplyTickets: [],
    promises: [],
    statements: [],
    lienFilings: [],
  }
}

// ---------------------------------------------------------------------------
// Output.
// ---------------------------------------------------------------------------

export type TimelineRole = 'customer' | 'gc' | 'both'
export type TimelineRailState = 'waiting' | 'working' | 'billed' | 'collections'
export type TimelineSide = 'office' | 'field'
export type TimelineCardKind =
  | 'customer'
  | 'start'
  | 'bill'
  | 'billSent'
  | 'payment'
  | 'closed'
  | 'promise'
  | 'statement'
  | 'collections'
  | 'uncollectible'
  | 'lien'
  | 'note'
  | 'hours'
  | 'fieldNote'
  | 'report'
  | 'test'
  | 'material'

export type TimelineJob = {
  id: string
  numberLabel: string
  /** The street, or the job name when it says something the customer's name does not. */
  label: string
  /** Who the job bills, when that is not this customer (a GC's job). */
  payerName: string | null
  role: TimelineRole
  status: string
  open: boolean
  firstSeenYmd: string
  cardMadeYmd: string | null
  imported: boolean
  paidYmd: string | null
  /** 0..3: a colored lane. null: the grey lane. */
  lane: number | null
  /** 0..7: the job's color. null on the grey lane. */
  colorIndex: number | null
  owedNow: number
  openBillCount: number
  hoursTotal: number
  cardCount: number
}

export type TimelineHours = {
  total: number
  days: number
  fromYmd: string
  toYmd: string
  crew: string[]
  /** This card's hours ÷ the job's hours, 0..1. null when the job has no hours. */
  shareOfJob: number | null
}

export type TimelineCard = {
  key: string
  ymd: string
  side: TimelineSide
  kind: TimelineCardKind
  /** The one job the card is about; null on a customer-level card or a fold across jobs. */
  jobId: string | null
  /** Every job the card covers. */
  jobIds: string[]
  title: string
  amount: number | null
  /** Short facts, shown joined. */
  lines: string[]
  /** What someone wrote or said, shown as a quote. */
  quote: string | null
  /** A fold's per-job lines. */
  items: string[]
  by: string | null
  hours: TimelineHours | null
  /** Shown under Money. */
  money: boolean
}

export type TimelineLaneCell = {
  /** null on the grey lane. */
  jobId: string | null
  state: TimelineRailState | 'other'
  /** full: through the row. top: from the row's node up (the job started here). bottom: up to the node (it ended here). none: the node alone (made and paid that day). */
  extent: 'full' | 'top' | 'bottom' | 'none'
  mark: 'start' | 'end' | 'dot' | null
  colorIndex: number | null
} | null

export type TimelineSnapshot = { owed: number; unpaidHours: number; unpaidMaterials: number }

export type TimelineRow =
  | { kind: 'month'; key: string; ymd: string; label: string; lanes: TimelineLaneCell[] }
  | { kind: 'gap'; key: string; ymd: string; days: number; label: string; lanes: TimelineLaneCell[] }
  | { kind: 'quiet'; key: string; fromYmd: string; toYmd: string; label: string }
  | {
      kind: 'day'
      key: string
      ymd: string
      office: TimelineCard[]
      field: TimelineCard[]
      lanes: TimelineLaneCell[]
      jobIds: string[]
      snapshot: TimelineSnapshot
    }

export type TimelinePromise = { promisedYmd: string; jobId: string; kept: boolean; broken: boolean }

export type TimelineSummary = {
  owed: number
  openBillCount: number
  owedJobCount: number
  oldestOpenBillDays: number | null
  promise: TimelinePromise | null
  notYetBilled: number
  notYetBilledJobCount: number
  booked: number
  bookedJobCount: number
  unpaidHours: number
  unpaidCrewDays: number
  unpaidHoursJobCount: number
  unpaidMaterials: number
  unpaidTicketCount: number
  openJobCount: number
  paidJobCount: number
  daysToPay: DaysToPay
}

export type CustomerTimeline = {
  customer: { id: string; name: string }
  todayYmd: string
  /** Ranked: open jobs (most owed first), then paid jobs (newest first). */
  jobs: TimelineJob[]
  /** Colored lanes in use, 0..4. */
  laneCount: number
  hasOtherLane: boolean
  otherJobCount: number
  /** One cell per lane (colored lanes, then the grey lane): the jobs still open today. */
  openToday: TimelineLaneCell[]
  rows: TimelineRow[]
  summary: TimelineSummary
}

// ---------------------------------------------------------------------------
// Day and word helpers.
// ---------------------------------------------------------------------------

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** A `date` column's day ('' when absent). Never through a time zone: '2026-06-11' is June 11. */
export function timelineDayOfDate(value: string | null | undefined): string {
  const s = (value ?? '').trim().slice(0, 10)
  return YMD_RE.test(s) ? s : ''
}

/** An instant's day in the company calendar ('' when absent). */
export function timelineDayOfInstant(iso: string | null | undefined): string {
  const s = (iso ?? '').trim()
  if (!s) return ''
  if (YMD_RE.test(s)) return s
  return calendarYmdInAppTzFromIso(s)
}

function epochDay(ymd: string): number {
  return Math.round(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))) / 86_400_000)
}

export function timelineDaysBetween(fromYmd: string, toYmd: string): number {
  return epochDay(toYmd) - epochDay(fromYmd)
}

/** 'Mar 20'. */
export function timelineDayWords(ymd: string): string {
  if (!YMD_RE.test(ymd)) return ''
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1] ?? ''} ${Number(ymd.slice(8, 10))}`
}

/** 'Mar 2026'. */
export function timelineMonthWords(ymd: string): string {
  if (!YMD_RE.test(ymd)) return ''
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1] ?? ''} ${ymd.slice(0, 4)}`
}

/** '9 days' · '3 weeks' · '4 months'. */
export function timelineSpanWords(days: number): string {
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`
  if (days < 60) return `${Math.round(days / 7)} weeks`
  const months = Math.round(days / 30)
  return `${months} month${months === 1 ? '' : 's'}`
}

/** '$31,250' (cents only under $100, and only when there are any). */
export function timelineMoney(n: number): string {
  const v = Math.abs(n)
  const body =
    v >= 100 || Number.isInteger(v)
      ? Math.round(v).toLocaleString('en-US')
      : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${n < 0 ? '-' : ''}$${body}`
}

/** '70h 46m'. */
export function timelineHoursWords(hours: number): string {
  const minutes = Math.max(0, Math.round(hours * 60))
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

function squash(text: string | null | undefined, max: number): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

function nameWords(s: string | null | undefined): string[] {
  return (s ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2)
}

/**
 * The job's words: the street when every word of the job name is a word of a name the timeline
 * already shows (the customer, the payer, the GC). 'Dana Lee' on Dana Lee's job, 'Ridgeway' on
 * Ridgeway Builders' job, read as their street.
 */
export function timelineJobLabel(jobName: string | null, jobAddress: string | null, relatedNames: ReadonlyArray<string | null | undefined>): string {
  const name = (jobName ?? '').trim()
  const street = (jobAddress ?? '').split(',')[0]?.trim() ?? ''
  const words = nameWords(name)
  const repeats =
    words.length === 0 ||
    relatedNames.some((other) => {
      const known = new Set(nameWords(other))
      return known.size > 0 && words.every((w) => known.has(w))
    })
  if (repeats && street) return street
  return name || street || 'job'
}

const FIELD_ROLES = new Set(['master_technician', 'helpers', 'subcontractor', 'superintendent'])

/**
 * A note's side: the people doing the work write field notes (a Leader is a master plumber);
 * everyone else, and an author the app no longer knows, writes office notes.
 */
export function timelineNoteSide(authorRole: string | null | undefined): TimelineSide {
  return FIELD_ROLES.has((authorRole ?? '').trim()) ? 'field' : 'office'
}

export function timelinePaymentTitle(paymentType: string | null, referenceNumber: string | null): string {
  const t = (paymentType ?? '').trim().toLowerCase()
  const isCheck = /check|cheque/.test(t)
  const base = isCheck
    ? 'Check'
    : t === 'ach'
      ? 'ACH'
      : t === 'wire'
        ? 'Wire'
        : /card|stripe/.test(t)
          ? 'Card'
          : t === 'cash'
            ? 'Cash'
            : t === 'zelle'
              ? 'Zelle'
              : 'Payment'
  const ref = (referenceNumber ?? '').trim()
  return isCheck && /^\d{1,8}$/.test(ref) ? `${base} #${ref}` : base
}

function channelWords(channel: string | null): string | null {
  const c = (channel ?? '').trim().toLowerCase()
  if (!c) return null
  if (c === 'stripe') return 'Stripe bill'
  if (c === 'housecallpro') return 'HousecallPro bill'
  if (c.includes('mail')) return 'mailed'
  if (c.includes('hand')) return 'by hand'
  return c.replace(/_/g, ' ')
}

const LIEN_KIND_WORDS: Record<string, string> = {
  notice_53_056: 'Notice of unpaid balance',
  retainage_53_057: 'Retainage notice',
  affidavit: 'Lien affidavit',
  release: 'Lien release',
}

function lienKindWords(kind: string | null): string {
  const k = (kind ?? '').trim()
  if (LIEN_KIND_WORDS[k]) return LIEN_KIND_WORDS[k]!
  const s = k.replace(/_/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Lien paper'
}

function sendMethodWords(method: string | null): string | null {
  const m = (method ?? '').trim().toLowerCase()
  if (!m) return null
  if (m === 'certified_mail') return 'certified mail'
  if (m === 'first_class_mail') return 'first-class mail'
  return m.replace(/_/g, ' ')
}

function recipientWords(recipient: string | null): string | null {
  const r = (recipient ?? '').trim().toLowerCase()
  if (!r) return null
  if (r === 'owner') return 'to the owner'
  if (r === 'gc' || r === 'original_contractor') return 'to the GC'
  return `to the ${r.replace(/_/g, ' ')}`
}

function testWords(testType: string | null, result: string | null): string {
  const t = (testType ?? '').trim().replace(/_/g, ' ')
  const head = t ? `${t.charAt(0).toUpperCase()}${t.slice(1)} test` : 'Test'
  const r = (result ?? '').trim().replace(/_/g, ' ')
  return r ? `${head} · ${r}` : head
}

// ---------------------------------------------------------------------------
// Status → rail state.
// ---------------------------------------------------------------------------

type RawState = TimelineRailState | 'paid'

function railStateOf(status: string | null | undefined): RawState {
  const s = (status ?? '').trim()
  if (s === 'waiting') return 'waiting'
  if (s === 'billed') return 'billed'
  if (s === 'paid') return 'paid'
  return 'working'
}

type JobWork = {
  input: TimelineJobInput
  out: TimelineJob
  /** Status moves by day, oldest first: the day's last move wins. */
  moves: Array<{ ymd: string; state: RawState }>
  initialState: RawState
  collectionsYmd: string | null
  uncollectibleYmd: string | null
  endYmd: string
}

function stateAt(job: JobWork, ymd: string): RawState {
  if (job.out.paidYmd && ymd >= job.out.paidYmd) return 'paid'
  let state: RawState = job.initialState
  for (const m of job.moves) {
    if (m.ymd <= ymd) state = m.state
    else break
  }
  if (state === 'paid') {
    // A move to paid the job later left (sent back): paid until the next move.
    return 'paid'
  }
  if (state === 'billed' && job.collectionsYmd && ymd >= job.collectionsYmd) return 'collections'
  return state
}

function activeOn(job: JobWork, ymd: string): boolean {
  return ymd >= job.out.firstSeenYmd && ymd <= job.endYmd
}

// ---------------------------------------------------------------------------
// The build.
// ---------------------------------------------------------------------------

type CardDraft = TimelineCard & { rank: number; author?: string; foldKey?: string }

const OFFICE_RANK: Partial<Record<TimelineCardKind, number>> = {
  lien: 0,
  uncollectible: 1,
  collections: 2,
  payment: 3,
  closed: 4,
  bill: 5,
  billSent: 6,
  statement: 7,
  promise: 8,
  note: 9,
  start: 10,
  customer: 11,
}
const FIELD_RANK: Partial<Record<TimelineCardKind, number>> = { hours: 0, report: 1, test: 2, material: 3, fieldNote: 4 }
const MONEY_KINDS = new Set<TimelineCardKind>([
  'bill',
  'billSent',
  'payment',
  'closed',
  'promise',
  'statement',
  'collections',
  'uncollectible',
  'lien',
  'start',
  'customer',
])

function cardRank(side: TimelineSide, kind: TimelineCardKind): number {
  return side === 'office' ? (OFFICE_RANK[kind] ?? 20) : (FIELD_RANK[kind] ?? 20)
}

export function buildCustomerTimeline(input: CustomerTimelineInput, todayYmd: string, nowMs: number): CustomerTimeline {
  const customerName = input.customer.name.trim() || 'Customer'
  const byJob = <T extends { jobId: string }>(rows: readonly T[]): Map<string, T[]> => {
    const m = new Map<string, T[]>()
    for (const r of rows) {
      const list = m.get(r.jobId)
      if (list) list.push(r)
      else m.set(r.jobId, [r])
    }
    return m
  }
  const jobIds = new Set(input.jobs.map((j) => j.id))
  const own = <T extends { jobId: string }>(rows: readonly T[]): T[] => rows.filter((r) => jobIds.has(r.jobId))
  const invoicesByJob = byJob(own(input.invoices))
  const paymentsByJob = byJob(own(input.payments))
  const eventsByJob = byJob(own(input.statusEvents))

  const ticketsByJob = byJob(own(input.supplyTickets))
  const notes = own(input.notes)
  const reports = own(input.reports)
  const tests = own(input.testReports)
  const promises = own(input.promises)
  const filings = own(input.lienFilings)
  const invoiceById = new Map(own(input.invoices).map((i) => [i.id, i]))

  // Crew days: hours per job per work day.
  type CrewDay = { jobId: string; ymd: string; hours: number; crew: Set<string>; notes: Array<{ ms: number; text: string }> }
  const crewDays = new Map<string, CrewDay>()
  for (const s of own(input.clockSessions)) {
    const ymd = timelineDayOfDate(s.workDate) || timelineDayOfInstant(s.clockedInAt)
    if (!ymd) continue
    const inMs = s.clockedInAt ? Date.parse(s.clockedInAt) : NaN
    const outMs = s.clockedOutAt ? Date.parse(s.clockedOutAt) : NaN
    let hours = 0
    if (Number.isFinite(inMs) && Number.isFinite(outMs)) hours = Math.max(0, (outMs - inMs) / 3_600_000)
    else if (Number.isFinite(inMs)) hours = Math.min(OPEN_SESSION_CAP_HOURS, Math.max(0, (nowMs - inMs) / 3_600_000))
    const key = `${s.jobId}|${ymd}`
    const day = crewDays.get(key) ?? { jobId: s.jobId, ymd, hours: 0, crew: new Set<string>(), notes: [] }
    day.hours += hours
    const who = (s.userName ?? '').trim()
    if (who) day.crew.add(who.split(/\s+/)[0] ?? who)
    const note = squash(s.notes, 160)
    if (note) day.notes.push({ ms: Number.isFinite(inMs) ? inMs : 0, text: note })
    crewDays.set(key, day)
  }
  const crewDaysByJob = byJob([...crewDays.values()])

  // ----- jobs -----
  const works: JobWork[] = []
  for (const j of input.jobs) {
    const role: TimelineRole =
      j.customerId === input.customer.id && j.gcCustomerId === input.customer.id
        ? 'both'
        : j.customerId === input.customer.id
          ? 'customer'
          : 'gc'
    const payer = role === 'gc' ? (j.customerName ?? '').trim() || null : null
    const events = [...(eventsByJob.get(j.id) ?? [])].sort((a, b) => a.changedAt.localeCompare(b.changedAt))
    const moves: JobWork['moves'] = []
    for (const e of events) {
      const ymd = timelineDayOfInstant(e.changedAt)
      if (!ymd) continue
      const state = railStateOf(e.toStatus)
      const last = moves[moves.length - 1]
      if (last && last.ymd === ymd) last.state = state
      else moves.push({ ymd, state })
    }
    const invs = invoicesByJob.get(j.id) ?? []
    const pays = paymentsByJob.get(j.id) ?? []
    const cardMade = timelineDayOfInstant(j.createdAt) || null
    const traces: string[] = []
    if (cardMade) traces.push(cardMade)
    for (const m of moves) traces.push(m.ymd)
    for (const i of invs) {
      const b = timelineDayOfInstant(i.billedAt)
      if (b) traces.push(b)
    }
    for (const p of pays) {
      const d = timelineDayOfDate(p.paidOn)
      if (d) traces.push(d)
    }
    for (const d of crewDaysByJob.get(j.id) ?? []) traces.push(d.ymd)
    for (const t of ticketsByJob.get(j.id) ?? []) {
      const d = timelineDayOfDate(t.invoiceDate)
      if (d) traces.push(d)
    }
    for (const n of notes) if (n.jobId === j.id) traces.push(timelineDayOfInstant(n.createdAt))
    const firstSeen = traces.filter(Boolean).sort()[0] ?? todayYmd
    const status = (j.status ?? '').trim() || 'working'
    let paidYmd: string | null = null
    if (status === 'paid') {
      const lastPaidMove = [...moves].reverse().find((m) => m.state === 'paid')
      const lastPayment = pays.map((p) => timelineDayOfDate(p.paidOn)).filter(Boolean).sort().pop()
      paidYmd = lastPaidMove?.ymd ?? lastPayment ?? cardMade ?? firstSeen
      if (paidYmd < firstSeen) paidYmd = firstSeen
    }
    const firstMove = events[0]
    let initialState: RawState = firstMove ? railStateOf(firstMove.fromStatus) : railStateOf(status)
    if (initialState === 'paid') initialState = invs.some((i) => i.billedAt) ? 'billed' : 'working'
    const imported = cardMade != null && timelineDaysBetween(firstSeen, cardMade) > TIMELINE_IMPORTED_AFTER_DAYS
    const label = timelineJobLabel(j.jobName, j.jobAddress, [customerName, j.customerName, j.gcName])
    works.push({
      input: j,
      moves,
      initialState,
      collectionsYmd: j.collectionsAt ? timelineDayOfInstant(j.collectionsAt) || null : null,
      uncollectibleYmd: j.uncollectibleAt ? timelineDayOfInstant(j.uncollectibleAt) || null : null,
      endYmd: paidYmd ?? todayYmd,
      out: {
        id: j.id,
        numberLabel: effectiveJobLedgerNumber(j.hcpNumber, j.clickNumber) || '—',
        label,
        payerName: payer,
        role,
        status,
        open: status !== 'paid',
        firstSeenYmd: firstSeen,
        cardMadeYmd: cardMade,
        imported,
        paidYmd,
        lane: null,
        colorIndex: null,
        owedNow: 0,
        openBillCount: 0,
        hoursTotal: 0,
        cardCount: 0,
      },
    })
  }
  const workById = new Map(works.map((w) => [w.out.id, w]))

  // ----- owed now, by the bill-truth kernel -----
  let owedTotal = 0
  let openBillCount = 0
  let oldestOpenBillDays: number | null = null
  const owedJobs = new Set<string>()
  const remainingByInvoice = new Map<string, number>()
  for (const w of works) {
    const j = w.input
    const btJob: BillTruthJob = {
      id: j.id,
      status: j.status,
      revenue: j.revenue,
      payments_made: j.paymentsMade,
      collections_at: j.collectionsAt,
      uncollectible_at: j.uncollectibleAt,
    }
    const invs = invoicesByJob.get(j.id) ?? []
    const billRows = invs.map((i) => ({ id: i.id, job_id: j.id, status: i.status, amount: i.amount, sequence_order: i.sequenceOrder ?? undefined, billed_at: i.billedAt ?? undefined }))
    // The one payment rule (v2.5010; the owner's call of 2026-10-09): money put on the job with no bill picked pays its bills too.
    const rows = openBillRowsForJob(
      btJob,
      billRows,
      appliedByInvoiceUnderRule(
        [{ id: j.id, revenue: j.revenue }],
        billRows,
        (paymentsByJob.get(j.id) ?? []).map((p) => ({ invoice_id: p.invoiceId, amount: p.amount, job_id: j.id, paid_on: p.paidOn ?? undefined })),
      ),
    )
    for (const row of rows) {
      if (row.invoiceId) remainingByInvoice.set(row.invoiceId, row.remaining)
      if (row.uncollectible || isSettledRemainder(row.remaining)) continue
      w.out.owedNow += row.remaining
      w.out.openBillCount += 1
      owedTotal += row.remaining
      openBillCount += 1
      owedJobs.add(j.id)
      const billedYmd = row.invoiceId
        ? timelineDayOfInstant(invoiceById.get(row.invoiceId)?.billedAt)
        : (w.moves.find((m) => m.state === 'billed')?.ymd ?? w.out.cardMadeYmd ?? '')
      if (billedYmd) {
        const age = Math.max(0, timelineDaysBetween(billedYmd, todayYmd))
        if (oldestOpenBillDays == null || age > oldestOpenBillDays) oldestOpenBillDays = age
      }
    }
  }

  // ----- cards -----
  const drafts: CardDraft[] = []
  const add = (c: Omit<CardDraft, 'rank' | 'money' | 'items' | 'hours' | 'jobIds' | 'lines' | 'quote' | 'by' | 'amount'> &
    Partial<Pick<CardDraft, 'items' | 'hours' | 'jobIds' | 'lines' | 'quote' | 'by' | 'amount' | 'author' | 'foldKey'>>) => {
    if (!c.ymd) return
    drafts.push({
      ...c,
      amount: c.amount ?? null,
      lines: (c.lines ?? []).filter((l): l is string => !!l && l.trim().length > 0),
      quote: c.quote ? c.quote : null,
      items: c.items ?? [],
      by: c.by ?? null,
      hours: c.hours ?? null,
      jobIds: c.jobIds ?? (c.jobId ? [c.jobId] : []),
      money: MONEY_KINDS.has(c.kind),
      rank: cardRank(c.side, c.kind),
    })
  }

  const customerAddedYmd = timelineDayOfDate(input.customer.dateMet) || timelineDayOfInstant(input.customer.createdAt)
  if (customerAddedYmd) {
    add({ key: `customer:${input.customer.id}`, ymd: customerAddedYmd, side: 'office', kind: 'customer', jobId: null, title: 'Customer added', lines: [] })
  }

  for (const w of works) {
    const j = w.input
    const o = w.out
    const price = Number(j.revenue ?? 0)
    add({
      key: `start:${j.id}`,
      ymd: o.firstSeenYmd,
      side: 'office',
      kind: 'start',
      jobId: j.id,
      title: o.imported ? 'First record' : 'Job card made',
      lines: [price > 0 ? `${timelineMoney(price)} job` : 'no price yet', o.imported && o.cardMadeYmd ? `card made ${timelineDayWords(o.cardMadeYmd)}` : ''],
    })
    if (w.collectionsYmd) {
      add({ key: `collections:${j.id}`, ymd: w.collectionsYmd, side: 'office', kind: 'collections', jobId: j.id, title: 'Flagged for Collections', quote: squash(j.collectionsNote, 200) || null })
    }
    if (w.uncollectibleYmd) {
      add({ key: `uncollectible:${j.id}`, ymd: w.uncollectibleYmd, side: 'office', kind: 'uncollectible', jobId: j.id, title: 'Marked uncollectible', quote: squash(j.uncollectibleReason, 200) || null })
    }
  }

  for (const inv of own(input.invoices)) {
    const billedYmd = timelineDayOfInstant(inv.billedAt)
    const amount = Number(inv.amount ?? 0)
    if (billedYmd) {
      const remaining = remainingByInvoice.get(inv.id)
      const w = workById.get(inv.jobId)
      const stateWords =
        inv.status === 'paid'
          ? 'paid'
          : w?.input.uncollectibleAt
            ? 'given up on'
            : remaining == null
              ? ''
              : isSettledRemainder(remaining)
                ? 'paid, not yet marked'
                : remaining < amount - 0.005
                  ? `${timelineMoney(remaining)} still open`
                  : 'open'
      add({ key: `bill:${inv.id}`, ymd: billedYmd, side: 'office', kind: 'bill', jobId: inv.jobId, title: 'Billed', amount, lines: [channelWords(inv.channel) ?? '', stateWords] })
    }
    const sentYmd = timelineDayOfInstant(inv.sentToCustomerAt)
    if (sentYmd && sentYmd !== billedYmd) {
      const after = billedYmd ? timelineDaysBetween(billedYmd, sentYmd) : 0
      add({ key: `sent:${inv.id}`, ymd: sentYmd, side: 'office', kind: 'billSent', jobId: inv.jobId, title: 'Bill sent', amount, lines: [after > 0 ? `${after} days after it was billed` : ''] })
    }
  }

  // A billed job with no dated bill line (HousecallPro-era or a shell): its move to billed is the bill.
  const hasDatedBill = (jobId: string) =>
    (invoicesByJob.get(jobId) ?? []).some((i) => (i.status === 'billed' || i.status === 'paid') && timelineDayOfInstant(i.billedAt))
  for (const w of works) {
    if (hasDatedBill(w.out.id)) continue
    const billedMove = w.moves.find((m) => m.state === 'billed')
    if (!billedMove) continue
    const revenue = Number(w.input.revenue ?? 0)
    add({ key: `shell:${w.out.id}`, ymd: billedMove.ymd, side: 'office', kind: 'bill', jobId: w.out.id, title: 'Marked billed', amount: revenue > 0 ? revenue : null, lines: ['no bill line'] })
  }

  const paymentCardJobDays = new Set<string>()
  for (const p of own(input.payments)) {
    const ymd = timelineDayOfDate(p.paidOn)
    if (!ymd) continue
    const w = workById.get(p.jobId)
    const inv = p.invoiceId ? invoiceById.get(p.invoiceId) : undefined
    const billedYmd = timelineDayOfInstant(inv?.billedAt)
    const after = billedYmd ? timelineDaysBetween(billedYmd, ymd) : null
    const deposit = timelineDayOfInstant(p.depositPostedAt)
    const closes = !!w?.out.paidYmd && w.out.paidYmd === ymd
    paymentCardJobDays.add(`${p.jobId}|${ymd}`)
    add({
      key: `payment:${p.id}`,
      ymd,
      side: 'office',
      kind: 'payment',
      jobId: p.jobId,
      title: `${timelinePaymentTitle(p.paymentType, p.referenceNumber)}${closes ? ' · paid in full' : ''}`,
      amount: Number(p.amount ?? 0),
      lines: [
        after != null && after >= 0 ? `${after} day${after === 1 ? '' : 's'} after the bill` : '',
        !p.invoiceId ? 'not tied to a bill' : '',
        deposit ? `deposited ${timelineDayWords(deposit)}` : '',
        (p.depositFrom ?? '').trim() ? `from ${(p.depositFrom ?? '').trim()}` : '',
      ],
    })
  }
  for (const w of works) {
    if (w.out.paidYmd && !paymentCardJobDays.has(`${w.out.id}|${w.out.paidYmd}`)) {
      add({ key: `closed:${w.out.id}`, ymd: w.out.paidYmd, side: 'office', kind: 'closed', jobId: w.out.id, title: 'Paid in full' })
    }
  }

  for (const pr of promises) {
    const promised = timelineDayOfDate(pr.promisedDate)
    add({
      key: `promise:${pr.id}`,
      ymd: timelineDayOfInstant(pr.createdAt),
      side: 'office',
      kind: 'promise',
      jobId: pr.jobId,
      title: promised ? `They said ${timelineDayWords(promised)}` : 'They gave a date',
      quote: squash(pr.note, 200) || null,
      by: (pr.saidBy ?? '').trim() || null,
    })
  }

  for (const st of input.statements) {
    add({
      key: `statement:${st.id}`,
      ymd: timelineDayOfInstant(st.sentAt),
      side: 'office',
      kind: 'statement',
      jobId: null,
      title: 'GC statement sent',
      amount: st.total != null ? Number(st.total) : null,
      lines: [st.jobCount != null ? `${st.jobCount} job${st.jobCount === 1 ? '' : 's'}` : '', (st.sentByName ?? '').trim() ? `by ${(st.sentByName ?? '').trim()}` : ''],
    })
  }

  for (const f of filings) {
    const kindWords = lienKindWords(f.kind)
    const amount = f.amount != null ? Number(f.amount) : null
    const sends = f.sends.filter((s) => timelineDayOfDate(s.sentOn))
    if (sends.length === 0) {
      add({ key: `lien:${f.id}`, ymd: timelineDayOfInstant(f.createdAt), side: 'office', kind: 'lien', jobId: f.jobId, title: `${kindWords} recorded`, amount, foldKey: `${kindWords} recorded` })
      continue
    }
    sends.forEach((s, i) => {
      const method = sendMethodWords(s.method)
      const title = `${kindWords} ${method && method.includes('mail') ? 'mailed' : 'sent'}`
      add({ key: `lien:${f.id}:${i}`, ymd: timelineDayOfDate(s.sentOn), side: 'office', kind: 'lien', jobId: f.jobId, title, amount, lines: [method ?? '', recipientWords(s.recipient) ?? ''], foldKey: title })
    })
  }

  for (const n of notes) {
    const side = timelineNoteSide(n.authorRole)
    const author = (n.authorName ?? '').trim() || (side === 'office' ? 'Office' : 'Field')
    const text = squash(n.body, 280)
    if (!text) continue
    add({ key: `note:${n.id}`, ymd: timelineDayOfInstant(n.createdAt), side, kind: side === 'office' ? 'note' : 'fieldNote', jobId: n.jobId, title: author, quote: text, author })
  }

  for (const r of reports) {
    add({
      key: `report:${r.id}`,
      ymd: timelineDayOfInstant(r.createdAt),
      side: 'field',
      kind: 'report',
      jobId: r.jobId,
      title: (r.templateName ?? '').trim() || 'Field report',
      lines: [r.percent != null ? `${r.percent}% done` : ''],
      quote: squash(r.preview, 200) || null,
      by: (r.authorName ?? '').trim() || null,
    })
  }

  for (const t of tests) {
    add({
      key: `test:${t.id}`,
      ymd: timelineDayOfDate(t.testDate) || timelineDayOfInstant(t.createdAt),
      side: 'field',
      kind: 'test',
      jobId: t.jobId,
      title: testWords(t.testType, t.result),
      lines: [(t.system ?? '').trim()],
    })
  }

  for (const t of own(input.supplyTickets)) {
    add({
      key: `ticket:${t.id}`,
      ymd: timelineDayOfDate(t.invoiceDate),
      side: 'field',
      kind: 'material',
      jobId: t.jobId,
      title: (t.supplyHouse ?? '').trim() || 'Supply house',
      amount: t.amount,
      lines: [(t.invoiceNumber ?? '').trim() ? `ticket ${(t.invoiceNumber ?? '').trim()}` : ''],
    })
  }

  // ----- crew days, folded between office cards on the job -----
  const officeDaysByJob = new Map<string, string[]>()
  for (const d of drafts) {
    if (d.side !== 'office' || !d.jobId) continue
    const list = officeDaysByJob.get(d.jobId) ?? []
    list.push(d.ymd)
    officeDaysByJob.set(d.jobId, list)
  }
  for (const w of works) {
    const days = [...(crewDaysByJob.get(w.out.id) ?? [])].sort((a, b) => b.ymd.localeCompare(a.ymd))
    w.out.hoursTotal = days.reduce((s, d) => s + d.hours, 0)
    const officeDays = officeDaysByJob.get(w.out.id) ?? []
    let run: CrewDay[] = []
    const flush = () => {
      if (run.length === 0) return
      const newest = run[0]!
      const oldest = run[run.length - 1]!
      const total = run.reduce((s, d) => s + d.hours, 0)
      const crew = [...new Set(run.flatMap((d) => [...d.crew]))]
      // The newest thing the crew wrote in the run.
      const quote =
        run
          .flatMap((d) => d.notes.map((n) => ({ ...n, ymd: d.ymd })))
          .sort((a, b) => b.ymd.localeCompare(a.ymd) || b.ms - a.ms)[0]?.text ?? null
      const share = w.out.hoursTotal > 0 ? total / w.out.hoursTotal : null
      add({
        key: `hours:${w.out.id}:${oldest.ymd}:${newest.ymd}`,
        ymd: newest.ymd,
        side: 'field',
        kind: 'hours',
        jobId: w.out.id,
        title: timelineHoursWords(total),
        quote,
        lines: [
          run.length === 1 ? 'one day' : `${timelineDayWords(oldest.ymd)} → ${timelineDayWords(newest.ymd)} · ${run.length} work days`,
          share != null && run.length < days.length ? `${Math.round(share * 100)}% of the job's hours` : '',
        ],
        hours: { total, days: run.length, fromYmd: oldest.ymd, toYmd: newest.ymd, crew, shareOfJob: share },
      })
      run = []
    }
    for (const d of days) {
      const oldestInRun = run[run.length - 1]
      if (oldestInRun) {
        const pause = timelineDaysBetween(d.ymd, oldestInRun.ymd)
        const officeBetween = officeDays.some((o) => o > d.ymd && o <= oldestInRun.ymd)
        if (pause > TIMELINE_HOURS_RUN_BREAK_DAYS || officeBetween) flush()
      }
      run.push(d)
    }
    flush()
  }

  // ----- batch folds: notes, bills, notice steps on one day -----
  const jobRef = (jobId: string | null) => {
    const w = jobId ? workById.get(jobId) : undefined
    return w ? `${w.out.numberLabel} · ${w.out.label}` : ''
  }
  const groups = new Map<string, CardDraft[]>()
  for (const d of drafts) {
    let key: string | null = null
    if ((d.kind === 'note' || d.kind === 'fieldNote') && d.author) key = `${d.ymd}|${d.kind}|${d.author}`
    else if (d.kind === 'bill' || d.kind === 'billSent') key = `${d.ymd}|${d.kind}`
    else if ((d.kind === 'start' || d.kind === 'closed') && d.jobId) key = `${d.ymd}|${d.kind}|${d.title}`
    else if (d.kind === 'lien' && d.foldKey) key = `${d.ymd}|lien|${d.foldKey}`
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(d)
    groups.set(key, list)
  }
  const folded = new Set<CardDraft>()
  const foldCards: CardDraft[] = []
  for (const [key, list] of groups) {
    const first = list[0]!
    const jobsCovered = [...new Set(list.map((d) => d.jobId).filter((id): id is string => !!id))]
    const min = first.kind === 'lien' ? 2 : 3
    if (list.length < min || jobsCovered.length < 2) continue
    for (const d of list) folded.add(d)
    const base = { key: `fold:${key}`, ymd: first.ymd, side: first.side, kind: first.kind, jobId: null, jobIds: jobsCovered, rank: first.rank, money: first.money, hours: null }
    if (first.kind === 'note' || first.kind === 'fieldNote') {
      const sameWords = list.every((d) => d.quote === first.quote)
      foldCards.push({
        ...base,
        title: `${list.length} notes`,
        by: first.author ?? null,
        amount: null,
        quote: sameWords ? first.quote : null,
        lines: sameWords ? [`the same words on ${jobsCovered.length} jobs`] : [],
        items: sameWords ? [jobsCovered.map((id) => jobRef(id)).join(', ')] : list.map((d) => `${jobRef(d.jobId)}: “${squash(d.quote, 110)}”`),
      })
    } else if (first.kind === 'start' || first.kind === 'closed') {
      const payer = (jobId: string | null) => (jobId ? (workById.get(jobId)?.out.payerName ?? null) : null)
      foldCards.push({
        ...base,
        title:
          first.kind === 'closed'
            ? `${list.length} jobs paid in full`
            : first.title === 'First record'
              ? `${list.length} jobs first on record`
              : `${list.length} job cards made`,
        by: null,
        amount: null,
        quote: null,
        lines: [],
        items: list.map((d) => [jobRef(d.jobId), ...d.lines, payer(d.jobId) ? `${payer(d.jobId)} pays` : ''].filter(Boolean).join(' · ')),
      })
    } else if (first.kind === 'lien') {
      foldCards.push({
        ...base,
        title: `${first.title} · ${jobsCovered.length} jobs`,
        by: null,
        amount: list.reduce((s, d) => s + (d.amount ?? 0), 0) || null,
        quote: null,
        lines: first.lines,
        items: list.map((d) => `${jobRef(d.jobId)}${d.amount != null ? ` · ${timelineMoney(d.amount)}` : ''}`),
      })
    } else {
      const total = list.reduce((s, d) => s + (d.amount ?? 0), 0)
      foldCards.push({
        ...base,
        title: `${list.length} bills ${first.kind === 'bill' ? 'billed' : 'sent'}`,
        by: null,
        amount: total,
        quote: null,
        lines: [],
        items: list.map((d) => `${jobRef(d.jobId)} · ${timelineMoney(d.amount ?? 0)}`),
      })
    }
  }
  const cards: CardDraft[] = [...drafts.filter((d) => !folded.has(d)), ...foldCards]
  for (const c of cards) for (const id of c.jobIds) {
    const w = workById.get(id)
    if (w) w.out.cardCount += 1
  }

  // ----- lanes -----
  const open = works.filter((w) => w.out.open)
  const paid = works.filter((w) => !w.out.open)
  open.sort(
    (a, b) =>
      b.out.owedNow - a.out.owedNow ||
      b.out.cardCount - a.out.cardCount ||
      a.out.firstSeenYmd.localeCompare(b.out.firstSeenYmd) ||
      a.out.id.localeCompare(b.out.id),
  )
  paid.sort((a, b) => b.endYmd.localeCompare(a.endYmd) || a.out.id.localeCompare(b.out.id))
  const ranked = [...open, ...paid]
  const overlaps = (a: JobWork, b: JobWork) => !(a.endYmd < b.out.firstSeenYmd || a.out.firstSeenYmd > b.endYmd)
  const laneJobs: JobWork[][] = Array.from({ length: TIMELINE_COLORED_LANES }, () => [])
  const colored: JobWork[] = []
  for (const w of ranked) {
    const lane = laneJobs.findIndex((jobsInLane) => jobsInLane.every((other) => !overlaps(w, other)))
    if (lane < 0) continue
    laneJobs[lane]!.push(w)
    w.out.lane = lane
    const used = new Set(colored.filter((c) => overlaps(c, w)).map((c) => c.out.colorIndex))
    for (let step = 0; step < TIMELINE_PALETTE_SIZE; step++) {
      const candidate = (colored.length + step) % TIMELINE_PALETTE_SIZE
      if (!used.has(candidate)) {
        w.out.colorIndex = candidate
        break
      }
    }
    colored.push(w)
  }
  const laneCount = laneJobs.filter((l) => l.length > 0).length
  const others = ranked.filter((w) => w.out.lane == null)

  const cellsFor = (ymd: string, touched: ReadonlySet<string> | null): TimelineLaneCell[] => {
    const cells: TimelineLaneCell[] = []
    for (let lane = 0; lane < laneCount; lane++) {
      const w = laneJobs[lane]!.find((x) => activeOn(x, ymd))
      if (!w) {
        cells.push(null)
        continue
      }
      const here = touched?.has(w.out.id) ?? false
      const starts = touched != null && ymd === w.out.firstSeenYmd
      const ends = touched != null && w.out.paidYmd === ymd
      const state = stateAt(w, ymd)
      if (ends) {
        const before = stateAt(w, ymdBefore(ymd))
        cells.push({ jobId: w.out.id, state: before === 'paid' ? 'billed' : before, extent: starts ? 'none' : 'bottom', mark: 'end', colorIndex: w.out.colorIndex })
        continue
      }
      if (state === 'paid') {
        cells.push(null)
        continue
      }
      cells.push({ jobId: w.out.id, state, extent: starts ? 'top' : 'full', mark: starts ? 'start' : here ? 'dot' : null, colorIndex: w.out.colorIndex })
    }
    if (others.length > 0) {
      const live = others.filter((w) => activeOn(w, ymd) && stateAt(w, ymd) !== 'paid')
      const here = touched != null && others.some((w) => touched.has(w.out.id))
      cells.push(live.length > 0 || here ? { jobId: null, state: 'other', extent: 'full', mark: here ? 'dot' : null, colorIndex: null } : null)
    }
    return cells
  }

  // ----- money and work as of a day (the scrub) -----
  type BillHistory = { jobId: string; billedYmd: string; amount: number; payments: Array<{ ymd: string; amount: number }>; settledYmd: string | null }
  const bills: BillHistory[] = []
  for (const inv of own(input.invoices)) {
    if (inv.status !== 'billed' && inv.status !== 'paid') continue
    const billedYmd = timelineDayOfInstant(inv.billedAt)
    if (!billedYmd) continue
    const w = workById.get(inv.jobId)
    const linked = (paymentsByJob.get(inv.jobId) ?? [])
      .filter((p) => p.invoiceId === inv.id)
      .map((p) => ({ ymd: timelineDayOfDate(p.paidOn) || billedYmd, amount: Number(p.amount ?? 0) }))
    // When a bill stopped being owed without payments that cover it: the job's paid-in-full day,
    // else (a paid progress bill) the first payment on the job not tied to a bill, else its billed day.
    let settledYmd: string | null = null
    const covered = linked.reduce((s, p) => s + p.amount, 0)
    const jobPaidYmd = w?.out.paidYmd ?? null
    if (covered < Number(inv.amount ?? 0) - 0.005) {
      if (jobPaidYmd && jobPaidYmd >= billedYmd) settledYmd = jobPaidYmd
      else if (inv.status === 'paid') {
        const unlinkedAfter = (paymentsByJob.get(inv.jobId) ?? [])
          .filter((p) => !p.invoiceId)
          .map((p) => timelineDayOfDate(p.paidOn))
          .filter((d) => d && d >= billedYmd)
          .sort()[0]
        settledYmd = unlinkedAfter ?? billedYmd
      }
    }
    const uncollectibleYmd = w?.uncollectibleYmd ?? null
    if (uncollectibleYmd && (!settledYmd || uncollectibleYmd < settledYmd)) settledYmd = uncollectibleYmd
    bills.push({ jobId: inv.jobId, billedYmd, amount: Number(inv.amount ?? 0), payments: linked, settledYmd })
  }
  const shellJobs = works.filter((w) => !hasDatedBill(w.out.id) && (w.out.status === 'billed' || w.out.status === 'paid'))
  const snapshotAt = (ymd: string): TimelineSnapshot => {
    let owed = 0
    for (const b of bills) {
      if (ymd < b.billedYmd) continue
      if (b.settledYmd && ymd >= b.settledYmd) continue
      const paidSoFar = b.payments.reduce((s, p) => (p.ymd <= ymd ? s + p.amount : s), 0)
      owed += Math.max(0, b.amount - paidSoFar)
    }
    for (const w of shellJobs) {
      const st = stateAt(w, ymd)
      if (st !== 'billed' && st !== 'collections') continue
      if (w.uncollectibleYmd && ymd >= w.uncollectibleYmd) continue
      const unlinked = (paymentsByJob.get(w.out.id) ?? []).filter((p) => !p.invoiceId && (timelineDayOfDate(p.paidOn) || '9999') <= ymd)
      owed += Math.max(0, Number(w.input.revenue ?? 0) - unlinked.reduce((s, p) => s + Number(p.amount ?? 0), 0))
    }
    let unpaidHours = 0
    let unpaidMaterials = 0
    for (const w of works) {
      if (w.out.paidYmd && ymd >= w.out.paidYmd) continue
      for (const d of crewDaysByJob.get(w.out.id) ?? []) if (d.ymd <= ymd) unpaidHours += d.hours
      for (const t of ticketsByJob.get(w.out.id) ?? []) {
        const td = timelineDayOfDate(t.invoiceDate)
        if (td && td <= ymd) unpaidMaterials += t.amount
      }
    }
    return { owed, unpaidHours, unpaidMaterials }
  }

  // ----- rows -----
  const cardsByDay = new Map<string, CardDraft[]>()
  for (const c of cards) {
    const list = cardsByDay.get(c.ymd) ?? []
    list.push(c)
    cardsByDay.set(c.ymd, list)
  }
  const days = [...cardsByDay.keys()].sort((a, b) => b.localeCompare(a))
  const nothingOpenBetween = (olderYmd: string, newerYmd: string) =>
    !works.some((w) => w.out.firstSeenYmd < newerYmd && w.endYmd > olderYmd)
  const rows: TimelineRow[] = []
  let newerYmd: string | null = null
  let lastMonth: string | null = null
  const newestDay = days[0]
  if (newestDay) {
    const sinceNewest = timelineDaysBetween(newestDay, todayYmd)
    if (sinceNewest >= TIMELINE_GAP_ROW_DAYS) {
      rows.push({ kind: 'gap', key: `gap:${newestDay}:today`, ymd: newestDay, days: sinceNewest, label: `${timelineSpanWords(sinceNewest)} to today`, lanes: cellsFor(newestDay, null) })
    }
  }
  for (const ymd of days) {
    if (newerYmd) {
      const gap = timelineDaysBetween(ymd, newerYmd)
      if (gap > TIMELINE_QUIET_FOLD_DAYS && nothingOpenBetween(ymd, newerYmd)) {
        rows.push({ kind: 'quiet', key: `quiet:${ymd}:${newerYmd}`, fromYmd: ymd, toYmd: newerYmd, label: `${timelineSpanWords(gap)} quiet` })
        lastMonth = null
      } else if (gap >= TIMELINE_GAP_ROW_DAYS) {
        rows.push({ kind: 'gap', key: `gap:${ymd}:${newerYmd}`, ymd, days: gap, label: timelineSpanWords(gap), lanes: cellsFor(ymd, null) })
      }
    }
    const month = ymd.slice(0, 7)
    if (month !== lastMonth) {
      rows.push({ kind: 'month', key: `month:${ymd}`, ymd, label: timelineMonthWords(ymd), lanes: cellsFor(ymd, null) })
      lastMonth = month
    }
    const dayCards = (cardsByDay.get(ymd) ?? []).sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key))
    const touched = new Set(dayCards.flatMap((c) => c.jobIds))
    rows.push({
      kind: 'day',
      key: `day:${ymd}`,
      ymd,
      office: dayCards.filter((c) => c.side === 'office').map(stripDraft),
      field: dayCards.filter((c) => c.side === 'field').map(stripDraft),
      lanes: cellsFor(ymd, touched),
      jobIds: [...touched],
      snapshot: snapshotAt(ymd),
    })
    newerYmd = ymd
  }

  // ----- summary -----
  let notYetBilled = 0
  let notYetBilledJobCount = 0
  let booked = 0
  let bookedJobCount = 0
  let unpaidHours = 0
  let unpaidCrewDays = 0
  let unpaidHoursJobCount = 0
  let unpaidMaterials = 0
  let unpaidTicketCount = 0
  for (const w of works) {
    if (!w.out.open) continue
    const billedSoFar = (invoicesByJob.get(w.out.id) ?? [])
      .filter((i) => i.status === 'billed' || i.status === 'paid')
      .reduce((s, i) => s + Number(i.amount ?? 0), 0)
    const left = Math.max(0, Number(w.input.revenue ?? 0) - billedSoFar)
    if (w.out.status === 'waiting') {
      booked += left
      if (left > 0.005) bookedJobCount += 1
    } else if (w.out.status !== 'billed') {
      notYetBilled += left
      if (left > 0.005) notYetBilledJobCount += 1
    }
    const jobDays = crewDaysByJob.get(w.out.id) ?? []
    if (jobDays.length > 0) unpaidHoursJobCount += 1
    unpaidCrewDays += jobDays.length
    unpaidHours += jobDays.reduce((s, d) => s + d.hours, 0)
    for (const t of ticketsByJob.get(w.out.id) ?? []) {
      unpaidMaterials += t.amount
      unpaidTicketCount += 1
    }
  }
  const latestPromise = [...promises].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  let promise: TimelinePromise | null = null
  if (latestPromise) {
    const promisedYmd = timelineDayOfDate(latestPromise.promisedDate)
    const w = workById.get(latestPromise.jobId)
    const stillOwed = (w?.out.owedNow ?? 0) > 0.005
    if (promisedYmd) {
      promise = { promisedYmd, jobId: latestPromise.jobId, kept: !stillOwed, broken: stillOwed && promisedYmd < todayYmd }
    }
  }
  const profileJobs: ProfileJob[] = works.map((w) => ({
    id: w.out.id,
    status: w.input.status,
    revenue: w.input.revenue,
    payments_made: w.input.paymentsMade,
    invoices: (invoicesByJob.get(w.out.id) ?? []).map((i) => ({ id: i.id, status: i.status ?? '', amount: i.amount, billed_at: i.billedAt, estimated_bill_date: null })),
    payments: (paymentsByJob.get(w.out.id) ?? []).map((p) => ({ invoice_id: p.invoiceId, amount: p.amount, paid_on: p.paidOn })),
  }))

  const openToday = cellsFor(todayYmd, null).map((cell) => (cell ? { ...cell, extent: 'full' as const, mark: null } : null))

  return {
    customer: { id: input.customer.id, name: customerName },
    todayYmd,
    jobs: ranked.map((w) => w.out),
    laneCount,
    hasOtherLane: others.length > 0,
    otherJobCount: others.length,
    openToday,
    rows,
    summary: {
      owed: owedTotal,
      openBillCount,
      owedJobCount: owedJobs.size,
      oldestOpenBillDays,
      promise,
      notYetBilled,
      notYetBilledJobCount,
      booked,
      bookedJobCount,
      unpaidHours,
      unpaidCrewDays,
      unpaidHoursJobCount,
      unpaidMaterials,
      unpaidTicketCount,
      openJobCount: works.filter((w) => w.out.open).length,
      paidJobCount: works.filter((w) => !w.out.open).length,
      daysToPay: customerDaysToPay(profileJobs, todayYmd),
    },
  }
}

function ymdBefore(ymd: string): string {
  const d = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)) - 1))
  return d.toISOString().slice(0, 10)
}

function stripDraft(d: CardDraft): TimelineCard {
  return {
    key: d.key,
    ymd: d.ymd,
    side: d.side,
    kind: d.kind,
    jobId: d.jobId,
    jobIds: d.jobIds,
    title: d.title,
    amount: d.amount,
    lines: d.lines,
    quote: d.quote,
    items: d.items,
    by: d.by,
    hours: d.hours,
    money: d.money,
  }
}

/** A card passes the Show filter. */
export function timelineCardShown(card: Pick<TimelineCard, 'money' | 'side'>, show: 'all' | 'money' | 'field'): boolean {
  if (show === 'money') return card.money
  if (show === 'field') return card.side === 'field'
  return true
}
