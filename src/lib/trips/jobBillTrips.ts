/**
 * Extra trips on a job's Bill tab. A trip marked Extra is work past the job's price, and until now the one place
 * that took it to a bill was the trip itself, on its site's Development page. The office makes a bill in the Job
 * window, so that is where an unbilled Extra trip has to be seen: under the job's Line Items, each with
 * **Put on a bill**, and **+ Trip** for one nobody has kept yet.
 *
 * Which trips a job is shown, all pure:
 * - the trip is Extra and holds no line;
 * - it names this job under Work goes on, or names no job at all, in which case the press adds this job to it;
 * - a trip that names other jobs alone is theirs, and is not shown here.
 *
 * A trip that has gone out has the press, for the roles that may change a job's lines. A planned one is listed
 * with why it has none, so a trip made from this tab does not vanish. Nothing here writes.
 */
import { emptyWords } from '../emptyWords'
import { sortTrips, tripStanding } from './tripDays'
import { canPutTripOnBill, type TripBillLine } from './tripBillLine'
import { NO_TRIP_PEOPLE, tripOfRecord, type TripRecord } from './tripRecord'
import { tripNameOfRecord } from './tripsLook'

/** The strip's name on the Bill tab. */
export const JOB_BILL_TRIPS_LABEL = 'Extra trips not on a bill'

/** What the strip says when no Extra trip waits. */
export const JOB_BILL_TRIPS_NONE_WORDS = emptyWords({ kind: 'waiting', who: 'a bill' }).main

/** What stands in the strip's place when the site's trips or their lines did not read. */
export const JOB_BILL_TRIPS_FAILED_WORDS = 'The site’s trips did not read. Reload to try again.'

/** What the strip says under its name: what the press does, and that nothing is sent. */
export const JOB_BILL_TRIPS_NOTE = 'Put on a bill adds the trip as one line here. A bill takes the line later.'

export type JobBillTripRow = {
  id: string
  record: TripRecord
  /** *Trip 3 · Nov 9 to 11*. */
  name: string
  /** *Trip 3*, for a toast. */
  short: string
  /** What it was for. */
  why: string
  /** Who went, by name. */
  who: string
  /** *Extra · not billed yet*, or *Extra · planned*. */
  state: string
  /** Why there is no press on this row; null when there is one. */
  held: string | null
  /** The trip names no job yet, so the press adds this one to it. */
  namesNoJob: boolean
}

/** May this role see the strip at all? The roles that read and change every trip. */
export function seesJobBillTrips(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller' || role === 'primary'
}

/**
 * The Extra trips a job's Bill tab shows, oldest first. `lines` is the lines the site's trips hold, by trip; null
 * while they are not read, and then nothing is shown, since a trip that holds a line must not be offered again.
 */
export function jobBillTrips(args: { records: ReadonlyArray<TripRecord>; jobId: string; lines: ReadonlyMap<string, TripBillLine> | null; role: string | null | undefined; todayYmd: string }): JobBillTripRow[] {
  if (!args.lines) return []
  const lines = args.lines
  const mine = args.records.filter((r) => r.billing === 'extra' && !lines.has(r.id) && (r.jobIds.length === 0 || r.jobIds.includes(args.jobId)))
  const byId = new Map(mine.map((r) => [r.id, r]))
  return sortTrips(mine.map((r) => tripOfRecord(r, NO_TRIP_PEOPLE))).flatMap((trip) => {
    const record = byId.get(trip.id)
    if (!record) return []
    const planned = tripStanding(trip, args.todayYmd) === 'planned'
    const name = tripNameOfRecord(record, args.todayYmd)
    return [
      {
        id: record.id,
        record,
        name: name.full,
        short: name.short,
        why: record.purpose.trim() || 'A trip',
        who: record.people.map((p) => p.name.trim()).filter(Boolean).join(', '),
        state: planned ? 'Extra · planned' : 'Extra · not billed yet',
        held: planned ? 'It can go on a bill once it has gone out.' : canPutTripOnBill(args.role) ? null : 'The office or a leader puts it on a bill.',
        namesNoJob: record.jobIds.length === 0,
      },
    ]
  })
}

/** The count beside the strip's name: the trips with a press. */
export function jobBillTripsReady(rows: ReadonlyArray<JobBillTripRow>): number {
  return rows.filter((r) => !r.held).length
}
