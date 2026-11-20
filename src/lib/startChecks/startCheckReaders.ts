/**
 * Before we start (punch list #382, PR 8): a bullet of ours reads the app. Three readers, each from what a screen
 * already keeps: the order log's dates for the stage's lines, the trip that covers day one, and the city's record of a
 * plumbing permit in our name at the job's address. Each answers the same three things a hand tick does: ready or
 * not, the fact in a few words, and the press that fixes it, here a door to the screen that holds the fact.
 *
 * A reader never guesses. Where the app holds nothing to read (a job with no bid, an address in a city whose records
 * we do not read, a person whose seat cannot read the source) it says so in words and reads open, and the bullet's
 * own value turns it back to a hand tick. Pure: the reads are `startCheckReadersIo.ts`.
 */
import { stageOfStageName } from '../submittals/procurementLog'
import { countWords, daysBetween, daySpan, monthDay, type UsReads } from './startChecks'
import type { StageLine, StartBulletRow, UsReading } from './startCheckRows'

// ---- what each read hands over ---------------------------------------------------------------------

/** One line of the order log, as much of it as the reader asks: its stage and its three days. */
export type OrderLine = { stage: 'rough_in' | 'top_out' | 'trim_set' | null; orderedOn: string | null; expectedOn: string | null; deliveredOn: string | null }
/** A job's order log: none because the job has no bid, shut to this seat, or its lines. */
export type OrderLogRead = { state: 'no_bid' } | { state: 'cannot' } | { state: 'read'; bidId: string; lines: readonly OrderLine[] }

/** A trip on the job, as much of it as the reader asks. */
export type TripFact = { id: string; name: string; first: string | null; last: string | null; people: readonly string[] }
/** `no_site` is a job on no development: trips are planned on one. */
export type TripsRead = { state: 'cannot' } | { state: 'no_site' } | { state: 'read'; developmentId: string; trips: readonly TripFact[] }

/** A plumbing permit in our name at the job's address, from the city's records. */
export type PermitFact = { number: string; issued: boolean; issuedOn: string | null }
export type PermitsRead = { state: 'cannot' } | { state: 'no_records' } | { state: 'read'; permits: readonly PermitFact[] }

/** Everything read for one job. A kind nobody asked for, or still on its way, is absent. `failed` is a read that did not come back. */
export type JobReads = { orderLog?: OrderLogRead; trips?: TripsRead; permits?: PermitsRead; failed?: boolean }

// ---- the words -------------------------------------------------------------------------------------

export const READER_WORDS = {
  reading: 'Reading it now.',
  failed: 'The app could not read this just now. Open the list again to try once more.',
  noSite: 'Trips are planned on a development. This job is on none.',
  noDays: 'We have no days planned for this stage, so the app cannot tell yet.',
  orderDoor: 'Open the order log',
  tripDoor: 'Open Trips',
  permitDoor: 'Open Permits',
  noBid: 'This job came from no bid, so it has no order log.',
  orderShut: 'Your seat cannot read this job’s order log.',
  noStageName: 'The order log sorts by Rough In, Top Out and Trim Set. This stage’s name is none of them.',
  noLines: 'The order log has no lines for this stage.',
  tripShut: 'Only the office and the people on a trip can read it.',
  noTrip: 'No trip covers the first day.',
  permitShut: 'Only the office and the estimators read the city’s permit records.',
  noRecords: 'The app reads no city permit records for this address.',
  noPermit: 'The city’s records show no plumbing permit in our name at this address.',
} as const

/** What a bullet of ours can read, in the order the choice draws them, each in the words after *read from*. */
export const READS_CHOICES: ReadonlyArray<{ value: UsReads; label: string }> = [
  { value: 'hand', label: 'ticked by hand' },
  { value: 'order_log', label: 'read from the order log' },
  { value: 'trip', label: 'read from Trips' },
  { value: 'permit', label: 'read from the city’s permits' },
]
export const readsLabel = (reads: UsReads): string => READS_CHOICES.find((c) => c.value === reads)?.label ?? 'ticked by hand'

/** The order log of a bid. */
export const orderLogHref = (bidId: string): string => `/bids?tab=submittals&bidId=${encodeURIComponent(bidId)}`
/** The Trips look of a development. */
export const tripsHref = (developmentId: string): string => `/developments/${encodeURIComponent(developmentId)}?look=trips`
export const PERMITS_HREF = '/prospects?tab=permits'

const open = (fact: string, door = '', href: string | null = null): UsReading => ({ ok: false, fact, door, href })
const linesWords = (n: number): string => countWords(n, 'line', 'lines')

// ---- the three readers -----------------------------------------------------------------------------

/**
 * Our material lands before day one. Ready when every line of the stage is on site, or is ordered and lands before
 * the first day. A line with no order is open, and so is one that lands on the first day or after it. So is a line
 * whose day to land has gone by with nobody marking it on site: a day before `today` is a promise that was not kept,
 * however far ahead of the first day it reads. `today` is the company's day, 'YYYY-MM-DD'. With none the reader
 * cannot tell a day that has gone by from one ahead, and compares with the first day alone.
 */
export function readOrderLog(read: OrderLogRead | undefined, stageName: string, dayOne: string | null, today = ''): UsReading {
  if (!read) return open(READER_WORDS.reading)
  if (read.state === 'no_bid') return open(READER_WORDS.noBid)
  if (read.state === 'cannot') return open(READER_WORDS.orderShut)
  const href = orderLogHref(read.bidId)
  const key = stageOfStageName(stageName)
  if (!key) return open(READER_WORDS.noStageName, READER_WORDS.orderDoor, href)
  const lines = read.lines.filter((l) => l.stage === key)
  const n = lines.length
  if (n === 0) return open(READER_WORDS.noLines, READER_WORDS.orderDoor, href)
  const landed = lines.filter((l) => l.deliveredOn).length
  if (landed === n) return { ok: true, fact: n === 1 ? 'The one line is on site.' : `All ${n} lines are on site.`, door: READER_WORDS.orderDoor, href }
  const coming = lines.filter((l) => !l.deliveredOn)
  const notOrdered = coming.filter((l) => !l.orderedOn && !l.expectedOn).length
  if (notOrdered > 0) return open(`${notOrdered} of ${linesWords(n)} ${notOrdered === 1 ? 'is' : 'are'} not ordered yet.`, READER_WORDS.orderDoor, href)
  const noDay = coming.filter((l) => !l.expectedOn).length
  if (noDay > 0) return open(`${noDay} of ${linesWords(n)} ${noDay === 1 ? 'has' : 'have'} no day to land yet.`, READER_WORDS.orderDoor, href)
  const due = today ? coming.map((l) => l.expectedOn as string).filter((d) => d < today).sort() : []
  if (due.length === 1) return open(`1 of ${linesWords(n)} was due ${monthDay(due[0] as string)} and is not on site.`, READER_WORDS.orderDoor, href)
  if (due.length > 1) return open(`${due.length} of ${linesWords(n)} are past due and not on site. The oldest was due ${monthDay(due[0] as string)}.`, READER_WORDS.orderDoor, href)
  if (!dayOne) return open(READER_WORDS.noDays, READER_WORDS.orderDoor, href)
  const last = coming.map((l) => l.expectedOn as string).sort().pop() as string
  const late = coming.filter((l) => (l.expectedOn as string) >= dayOne).length
  if (late > 0) return open(`${late} of ${linesWords(n)} ${late === 1 ? 'lands' : 'land'} on the first day or after it. The last lands ${monthDay(last)}.`, READER_WORDS.orderDoor, href)
  return { ok: true, fact: `${landed} of ${linesWords(n)} on site. The last lands ${monthDay(last)}, ${countWords(daysBetween(last, dayOne), 'day', 'days')} ahead.`, door: READER_WORDS.orderDoor, href }
}

/** The crew's trip is planned. Ready when a trip on the job has a person on it and its days cover our first day. */
export function readTrip(read: TripsRead | undefined, dayOne: string | null): UsReading {
  if (!read) return open(READER_WORDS.reading)
  if (read.state === 'cannot') return open(READER_WORDS.tripShut)
  if (read.state === 'no_site') return open(READER_WORDS.noSite)
  const href = tripsHref(read.developmentId)
  const door = READER_WORDS.tripDoor
  if (!dayOne) return open(READER_WORDS.noDays, door, href)
  const covers = read.trips.find((t) => t.first != null && t.last != null && t.first <= dayOne && dayOne <= t.last)
  if (!covers) return open(READER_WORDS.noTrip, door, href)
  if (covers.people.length === 0) return open(`${covers.name} has nobody on it yet.`, door, href)
  const who = covers.people.length <= 1 ? (covers.people[0] ?? '') : `${covers.people.slice(0, -1).join(', ')} and ${covers.people[covers.people.length - 1]}`
  return { ok: true, fact: `${covers.name}: ${who}, ${daySpan(covers.first as string, covers.last as string)}.`, door, href }
}

/** Our permit is issued. Ready when the city's records show a plumbing permit in our name at the address, issued. */
export function readPermit(read: PermitsRead | undefined): UsReading {
  if (!read) return open(READER_WORDS.reading)
  if (read.state === 'cannot') return open(READER_WORDS.permitShut)
  if (read.state === 'no_records') return open(READER_WORDS.noRecords)
  const issued = read.permits.filter((p) => p.issued).sort((a, b) => (a.issuedOn ?? '').localeCompare(b.issuedOn ?? ''))[0]
  if (issued) return { ok: true, fact: `Plumbing permit ${issued.number} ${issued.issuedOn ? `was issued ${monthDay(issued.issuedOn)}` : 'is issued'}.`, door: READER_WORDS.permitDoor, href: PERMITS_HREF }
  const applied = read.permits[0]
  if (applied) return open(`Plumbing permit ${applied.number} is applied for and not issued yet.`, READER_WORDS.permitDoor, PERMITS_HREF)
  return open(READER_WORDS.noPermit, READER_WORDS.permitDoor, PERMITS_HREF)
}

// ---- the seam `stageFromRows` asks ------------------------------------------------------------------

/** What to read for these bullets: the jobs that have a live bullet of each kind. Nothing is read for a kind nobody uses. */
export function readsWanted(bullets: readonly Pick<StartBulletRow, 'job_id' | 'reads' | 'waits_on' | 'removed_at'>[]): { orderLog: string[]; trips: string[]; permits: string[] } {
  const of = (kind: UsReads) => [...new Set(bullets.filter((b) => b.waits_on === 'us' && !b.removed_at && b.reads === kind).map((b) => b.job_id))].sort()
  return { orderLog: of('order_log'), trips: of('trip'), permits: of('permit') }
}

/**
 * The reader a list is built with: each bullet of ours against its own stage line and what was read for its job.
 * `today` is the company's day, which the order log's reader holds a line's day to land against.
 */
export function readerFor(lines: readonly StageLine[], reads: ReadonlyMap<string, JobReads>, today = ''): (row: StartBulletRow) => UsReading | null {
  const lineOf = new Map(lines.map((l) => [l.fixtureId, l]))
  return (row) => {
    const line = lineOf.get(row.fixture_id)
    const job = reads.get(row.job_id)
    const dayOne = line?.window?.[0] ?? null
    if (row.reads !== 'order_log' && row.reads !== 'trip' && row.reads !== 'permit') return null
    if (job?.failed) return open(READER_WORDS.failed)
    if (row.reads === 'order_log') return readOrderLog(job?.orderLog, line?.name ?? '', dayOne, today)
    if (row.reads === 'trip') return readTrip(job?.trips, dayOne)
    if (row.reads === 'permit') return readPermit(job?.permits)
    return null
  }
}
