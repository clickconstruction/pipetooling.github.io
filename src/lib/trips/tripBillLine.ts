/**
 * Put a trip on a bill (punch list #391): an Extra trip becomes one line among a job's lines. The line waits
 * there until a bill takes it. The mark lives on the line (`jobs_ledger_fixtures.trip_id`), never on the trip,
 * so everything a trip says about its money is read from its line and the bill that took the line.
 *
 * Pure. Here: the line's name and the words under it, made from the trip and then the office's to change;
 * who may press and when the press shows; which jobs the window offers; what the window's button says and
 * why it is dead; and the trip's billing standing. `tripBillLineIo.ts` reads the lines and makes the press.
 *
 * Words: this is *a trip's line* or *Put on a bill*. It is never a *trip charge*, which is the turnaway's fee.
 */
import type { TripStanding } from './tripDays'
import { TRIP_BILLING_LABEL, type TripBilling, type TripRecord } from './tripRecord'
import { tripNameOfRecord } from './tripsLook'

/** The roles that may put a trip on a bill: the ones that may add a discount to a job (`trip_put_on_job_line`). */
export const TRIP_BILL_LINE_ROLES: ReadonlyArray<string> = ['dev', 'master_technician', 'assistant', 'controller']

export function canPutTripOnBill(role: string | null | undefined): boolean {
  return !!role && TRIP_BILL_LINE_ROLES.includes(role)
}

/** The line's own limits, as the function holds them. */
export const TRIP_LINE_NAME_MAX = 200
export const TRIP_LINE_WORDS_MAX = 2000
export const TRIP_LINE_AMOUNT_MAX = 1_000_000

/** The press on an open trip, and the window's quiet line under its figures. */
export const TRIP_PUT_ON_BILL_LABEL = 'Put on a bill'
export const TRIP_BILL_LINE_NOTE = 'Adds one line to the job. It goes out when a bill takes it.'

/** Dollars for the eye: *$6,800*, and *$6,800.50* when there are cents. */
export function tripDollars(n: number): string {
  const cents = Math.round(n * 100) % 100 !== 0
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`
}

/** *crew of 4*, or *1 person*. */
function crewWords(n: number): string | null {
  if (n <= 0) return null
  return n === 1 ? '1 person' : `crew of ${n}`
}

/**
 * The line's name: the trip's number, its crew and its days, as *Trip 14, crew of 4, Nov 2 to 8*. A trip
 * made before numbers is told by its days: *Trip of Nov 2 to 8, crew of 4*. The customer reads it on the bill.
 */
export function tripLineName(record: Pick<TripRecord, 'tripNumber' | 'people'>, todayYmd: string): string {
  const name = tripNameOfRecord(record, todayYmd)
  const crew = crewWords(record.people.filter((p) => p.name.trim()).length)
  const parts = name.number ? [name.number, crew, name.days] : [name.days ? `Trip of ${name.days}` : 'Trip', crew]
  return parts.filter(Boolean).join(', ').slice(0, TRIP_LINE_NAME_MAX)
}

const sentence = (s: string): string => {
  const t = s.trim()
  if (!t) return ''
  return /[.!?]$/.test(t) ? t : `${t}.`
}

/**
 * The words under the line: what the trip was for, and who asked when they did, as *Reset the riser the
 * framers moved. Asked by Walt, by phone.* Our own trips name nobody. The customer reads this too.
 */
export function tripLineWords(record: Pick<TripRecord, 'purpose' | 'askedBy' | 'askedWho' | 'askedHow'>): string {
  const who = record.askedBy === 'them' ? record.askedWho.trim() : ''
  const how = record.askedBy === 'them' ? record.askedHow.trim() : ''
  const asked = who ? `Asked by ${[who, how].filter(Boolean).join(', ')}` : how ? `Asked ${how}` : ''
  return [sentence(record.purpose), sentence(asked)].filter(Boolean).join(' ').slice(0, TRIP_LINE_WORDS_MAX)
}

// ---- the line a trip holds --------------------------------------------------------------------

/** A trip's line as the look reads it: the line, its job, and the bill that took it. */
export type TripBillLine = {
  fixtureId: string
  tripId: string
  jobId: string
  /** The line's dollars: count times price. */
  amount: number | null
  /** The status of the bill that took the line; null while no bill has. */
  invoiceStatus: string | null
}

/** One row as the read asks for it. */
export type TripBillLineRow = {
  id: string
  trip_id: string | null
  job_id: string
  count: number | null
  line_unit_price: number | string | null
  invoice_id: string | null
  jobs_ledger_invoices: { status: string | null } | null
}

export const TRIP_BILL_LINE_SELECT = 'id, trip_id, job_id, count, line_unit_price, invoice_id, jobs_ledger_invoices(status)'

export function tripBillLineFromRow(row: TripBillLineRow): TripBillLine | null {
  if (!row.trip_id) return null
  const price = row.line_unit_price == null ? null : Number(row.line_unit_price)
  const count = Number(row.count)
  return {
    fixtureId: row.id,
    tripId: row.trip_id,
    jobId: row.job_id,
    amount: price != null && Number.isFinite(price) ? Math.round(price * (Number.isFinite(count) && count > 0 ? count : 1) * 100) / 100 : null,
    // A line on a bill whose status did not come back still reads billed: it is on a bill.
    invoiceStatus: row.invoice_id ? (row.jobs_ledger_invoices?.status ?? 'billed') : null,
  }
}

/** Each trip's line by the trip's id. One trip holds one line. */
export function tripBillLinesByTrip(rows: ReadonlyArray<TripBillLineRow>): Map<string, TripBillLine> {
  const out = new Map<string, TripBillLine>()
  for (const row of rows) {
    const line = tripBillLineFromRow(row)
    if (line) out.set(line.tripId, line)
  }
  return out
}

// ---- where the trip's money stands ------------------------------------------------------------

export type TripBillStandingKind = 'not_billed' | 'on_lines' | 'on_bill' | 'billed' | 'paid'

export type TripBillStanding = {
  kind: TripBillStandingKind
  /** The chip: *Extra · on J2101’s lines, on no bill yet*. */
  words: string
  /** The door to the line, when the trip holds one: *Open J2101 on Bill*. */
  door: string | null
  /** The line's figure beside the door: *$6,800 · line*; null with no line or no price. */
  figure: string | null
}

const possessive = (label: string): string => (/s$/i.test(label) ? `${label}’` : `${label}’s`)

/**
 * Where a trip's money stands, read from its line and the bill that took the line. Null for a trip that
 * holds no line and is not Extra, since its own billing word says everything. `linesRead` is false while the
 * lines are not in, and for a reader the lines are closed to: an Extra trip then says its own word and no more.
 *
 * A trip moved off Extra while its line exists still reads the line: the line stays, and so does its door.
 */
export function tripBillStanding(args: { billing: TripBilling | null; line: TripBillLine | null; linesRead: boolean; jobShort: string | null }): TripBillStanding | null {
  const { billing, line } = args
  if (!line) {
    if (billing !== 'extra' || !args.linesRead) return null
    return { kind: 'not_billed', words: `${TRIP_BILLING_LABEL.extra} · not billed yet`, door: null, figure: null }
  }
  const lead = billing ? TRIP_BILLING_LABEL[billing] : 'No billing said'
  const job = args.jobShort?.trim() || null
  const door = `Open ${job ?? 'the job'} on Bill`
  const figure = line.amount != null ? `${tripDollars(line.amount)} · line` : null
  if (!line.invoiceStatus) return { kind: 'on_lines', words: `${lead} · on ${job ? possessive(job) : 'a job’s'} lines, on no bill yet`, door, figure }
  if (line.invoiceStatus === 'ready_to_bill') return { kind: 'on_bill', words: `${lead} · on a bill, not sent`, door, figure }
  if (line.invoiceStatus === 'paid') return { kind: 'paid', words: `${lead} · paid`, door, figure }
  return { kind: 'billed', words: `${lead} · billed`, door, figure }
}

/**
 * Does **Put on a bill** show on this open trip? On a trip marked Extra that has gone out (out now or back),
 * that holds no line, for a role that may change a job's lines, once the lines are read. A planned trip shows
 * none, and a crew member never sees it.
 */
export function tripPutOnBillShows(args: { billing: TripBilling | null; standing: TripStanding; role: string | null | undefined; line: TripBillLine | null; linesRead: boolean }): boolean {
  return args.billing === 'extra' && args.standing !== 'planned' && canPutTripOnBill(args.role) && args.linesRead && !args.line
}

// ---- the window -------------------------------------------------------------------------------

export type TripBillJob = { id: string; label: string; name: string }

export type TripBillJobChoices = {
  /** The jobs the window lists. */
  jobs: TripBillJob[]
  /** The job picked when the window opens: the only one there is; null when the office has to pick. */
  picked: string | null
  /** What the pick's empty line says: *Pick one of Heron Point’s jobs*. */
  askWords: string
  /** Why nothing can be picked; null when there is a job to pick. */
  noneWords: string | null
}

/**
 * The jobs the window offers. A trip that names its jobs offers those: one trip makes one line on one job, and
 * the office picks which. A trip with no job named offers the site's jobs, and the picked job joins the
 * trip's jobs. A job that is no longer on the site is left out.
 */
export function tripBillJobChoices(args: { tripJobIds: ReadonlyArray<string>; siteJobs: ReadonlyArray<TripBillJob>; siteName: string }): TripBillJobChoices {
  const onSite = new Map(args.siteJobs.map((j) => [j.id, j]))
  const named = [...new Set(args.tripJobIds)].map((id) => onSite.get(id)).filter((j): j is TripBillJob => !!j)
  const jobs = named.length > 0 ? named : [...args.siteJobs]
  const site = args.siteName.trim()
  return {
    jobs,
    picked: jobs.length === 1 ? (jobs[0]?.id ?? null) : null,
    askWords: named.length > 0 ? 'Pick one of the trip’s jobs' : `Pick one of ${site ? possessive(site) : 'the site’s'} jobs`,
    noneWords: jobs.length === 0 ? 'This site has no job yet. Add a job first, then put the trip on its lines.' : null,
  }
}

/** A typed amount as dollars: *6,800*, *$6800.50*. Null for anything that is not a plain amount. */
export function parseTripLineAmount(typed: string): number | null {
  const t = typed.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/** A job by its label alone, as the window's title says it: *J2101*. Its name stands in when it has no label. */
export function tripBillJobShort(job: TripBillJob | null | undefined): string | null {
  return job?.label.trim() || job?.name.trim() || null
}

/** The window's title: *Put Trip 14 on J2101’s lines*, or *Put Trip 14 on a job’s lines* before a job is picked. */
export function tripBillWindowTitle(tripShort: string, job: TripBillJob | null | undefined): string {
  const short = tripBillJobShort(job)
  return `Put ${tripShort} on ${short ? possessive(short) : 'a job’s'} lines`
}

export type TripBillWindowState = {
  /** The amount as dollars; null while it is not a plain amount. */
  amount: number | null
  /** The button's words, with its figure once there is one: *Add the line · $6,800*. */
  confirmLabel: string
  /** Why the button is dead, in the window's words; null when it can be pressed. */
  problem: string | null
}

/**
 * What the window's button says and whether it can be pressed. The button names the act and its figure. It
 * is dead until a job is picked, the amount is a plain amount above nothing and under the cap, and the line
 * has a name, and it says which of those is missing.
 */
export function tripBillWindowState(args: { jobId: string | null; amountTyped: string; name: string; askWords: string }): TripBillWindowState {
  const amount = parseTripLineAmount(args.amountTyped)
  const good = amount != null && amount > 0 && amount <= TRIP_LINE_AMOUNT_MAX
  const confirmLabel = good ? `Add the line · ${tripDollars(amount)}` : 'Add the line'
  let problem: string | null = null
  if (!args.jobId) problem = `${args.askWords}.`
  else if (!args.amountTyped.trim()) problem = 'Type the amount.'
  else if (amount == null) problem = 'The amount is dollars and cents, such as 6,800.00.'
  else if (amount <= 0) problem = 'The amount has to be more than nothing.'
  else if (amount > TRIP_LINE_AMOUNT_MAX) problem = 'That amount is over $1,000,000. Check it.'
  else if (!args.name.trim()) problem = 'Give the line a name.'
  return { amount: good ? amount : null, confirmLabel, problem }
}

/** The press's reply, as `trip_put_on_job_line` gives it. */
export type TripBillLineReply = {
  duplicate: boolean
  dryRun: boolean
  fixtureId: string | null
  jobId: string | null
  revenueBefore: number | null
  revenueAfter: number | null
}

const num = (v: unknown): number | null => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null)

export function parseTripBillLineReply(data: unknown): TripBillLineReply {
  const r = (data ?? {}) as Record<string, unknown>
  return {
    duplicate: r.duplicate === true,
    dryRun: r.dry_run === true,
    fixtureId: typeof r.fixture_id === 'string' ? r.fixture_id : null,
    jobId: typeof r.job_id === 'string' ? r.job_id : null,
    revenueBefore: num(r.revenue_before),
    revenueAfter: num(r.revenue_after),
  }
}

/** The job total before and after, as the window's strip says them: *$184,000* and *$190,800*. */
export function tripBillTotalsWords(reply: Pick<TripBillLineReply, 'revenueBefore' | 'revenueAfter'>): { before: string; after: string } | null {
  if (reply.revenueBefore == null || reply.revenueAfter == null) return null
  return { before: tripDollars(reply.revenueBefore), after: tripDollars(reply.revenueAfter) }
}

/** What the press says once the line is on the job: *Trip 14 is on J2101’s lines.* */
export function tripOnLinesWords(tripShort: string, job: TripBillJob | null | undefined): string {
  const short = tripBillJobShort(job)
  return `${tripShort} is on ${short ? possessive(short) : 'the job’s'} lines.`
}

/** What a second press says: the trip already holds its line. */
export function tripAlreadyOnLinesWords(tripShort: string, job: TripBillJob | null | undefined): string {
  const short = tripBillJobShort(job)
  return `${tripShort} is already on ${short ? possessive(short) : 'a job’s'} lines. Nothing was added.`
}
