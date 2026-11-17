/**
 * The rows the trip rules read (punch list #379, PR 3), made from what the Development page already has:
 * the site's hours by person, job and day (`developments/siteLabor.ts`, the same figures the Scoreboard
 * shows, so the Trips band and the Scoreboard cannot disagree on a site's hours), and the clock's punches
 * on the site's jobs, each read against the site's point.
 *
 * A day's hours with no punch behind them, a day placed from a schedule or imported from pay, read as no
 * place. Pure; `tripsIo.ts` reads the punches.
 */
import type { LatLng } from '../jobTravelEstimate'
import type { SiteLabor } from '../developments/siteLabor'
import type { TripHourRow } from './tripHours'
import { placeOfDay, placeOfPunch, type PunchPoint, type TripPlace } from './tripPlace'
import { tripPersonKey, type TripPeopleIndex } from './tripRecord'

/** One clock row on one of the site's jobs, with the places it carries. */
export type PunchRow = {
  user_id: string
  work_date: string
  clock_in_lat: number | null
  clock_in_lng: number | null
  clock_in_location_source: string | null
  arrived_lat: number | null
  arrived_lng: number | null
  arrived_location_source: string | null
  clock_out_lat: number | null
  clock_out_lng: number | null
  clock_out_location_source: string | null
}

export const PUNCH_COLUMNS = 'id, user_id, work_date, clock_in_lat, clock_in_lng, clock_in_location_source, arrived_lat, arrived_lng, arrived_location_source, clock_out_lat, clock_out_lng, clock_out_location_source'

function point(lat: number | null, lng: number | null, source: string | null): PunchPoint | null {
  if (lat == null || lng == null) return null
  // The clock asks the phone first and guesses from the network when it will not say (`resolveClockPunchCoordinates`).
  return { lat: Number(lat), lng: Number(lng), rough: source !== 'gps' }
}

/** The places one clock row carries: on clock in, on arrival and on clock out. */
export function pointsOfPunch(p: PunchRow): Array<PunchPoint | null> {
  return [point(p.clock_in_lat, p.clock_in_lng, p.clock_in_location_source), point(p.arrived_lat, p.arrived_lng, p.arrived_location_source), point(p.clock_out_lat, p.clock_out_lng, p.clock_out_location_source)]
}

export const placeKey = (personKey: string, ymd: string): string => `${personKey}\u0000${ymd}`

/** What each person's day of punches on the site's jobs says about the site, by person and day. */
export function placesByPersonDay(punches: ReadonlyArray<PunchRow>, site: LatLng | null, index: TripPeopleIndex): Map<string, TripPlace> {
  const byDay = new Map<string, TripPlace[]>()
  for (const p of punches) {
    const key = placeKey(tripPersonKey(index, { userId: p.user_id }), p.work_date)
    const list = byDay.get(key) ?? []
    list.push(placeOfPunch(pointsOfPunch(p), site))
    byDay.set(key, list)
  }
  const out = new Map<string, TripPlace>()
  for (const [key, places] of byDay) out.set(key, placeOfDay(places))
  return out
}

/**
 * The site's hours as rows for the split: one for each person, job and day. Null when the days are not
 * known (a reader the clock's rows are closed to gets hours with no days), since an hour with no day
 * cannot be laid over a trip.
 */
export function tripHourRowsFromLabor(labor: SiteLabor, index: TripPeopleIndex, places: ReadonlyMap<string, TripPlace>): TripHourRow[] | null {
  if (!labor.daysKnown) return null
  const rows: TripHourRow[] = []
  for (const [jobId, job] of labor.byJobId)
    for (const person of job.people) {
      const personKey = tripPersonKey(index, { personId: person.personId, userId: person.userId, name: person.personName })
      for (const d of person.byWorkDate ?? []) {
        if (!(d.hours > 0)) continue
        rows.push({ personKey, ymd: d.ymd, hours: d.hours, jobId, place: places.get(placeKey(personKey, d.ymd)) ?? 'none' })
      }
    }
  return rows
}
