/**
 * A trip's lines in History (punch list #379, PR 3): one the day a trip leaves and one the day it is back.
 * They are read from the trip's days, never kept as rows, so a trip whose days change moves its lines and
 * a deleted trip leaves none behind. A planned trip has no line yet, and a trip that is out has only the
 * first. A line leads with the trip's number, *Trip 5 out* and *Trip 5 back*, and names its trip so the feed
 * can open it. Pure.
 */
import type { ChangeLine } from '../developments/whatChanged'
import { tripDayCounts, tripSpan, type Trip } from './tripDays'
import type { TripRecord } from './tripRecord'
import { daysWords, namesWords, tripName } from './tripsLook'

const dayIso = (ymd: string): string => `${ymd}T12:00:00.000Z`

/** The day a trip leaves: its first day on the road or at the site, since a day getting ready is still at home. */
export function tripLeftDay(trip: Trip): string | null {
  let first: string | null = null
  for (const p of trip.people)
    for (const [ymd, kind] of Object.entries(p.days)) {
      if (kind === 'ready') continue
      if (first == null || ymd < first) first = ymd
    }
  return first ?? tripSpan(trip)?.first ?? null
}

export function tripHistoryLines(args: { trips: ReadonlyArray<{ record: TripRecord; trip: Trip }>; siteName: string; todayYmd: string }): ChangeLine[] {
  const lines: ChangeLine[] = []
  const about = { kind: 'site' as const, id: null, label: args.siteName }
  for (const { record, trip } of args.trips) {
    const span = tripSpan(trip)
    if (!span) continue
    const who = namesWords(record.people.map((p) => p.name))
    const why = record.purpose.trim()
    const left = tripLeftDay(trip)
    const name = tripName({ tripNumber: record.tripNumber, span, todayYmd: args.todayYmd })
    // *Trip 5 out*; a trip made before numbers says *Trip out*, as it always did.
    const lead = name.number ?? 'Trip'
    const door = { id: record.id, door: name.door }
    if (left && left <= args.todayYmd) {
      lines.push({ id: `trip-out:${record.id}`, at: dayIso(left), kind: 'trip', verb: `${lead} out`, trip: door, about, detail: [`${who} left for ${args.siteName}`, why || null].filter(Boolean).join(' · '), by: null, waitingDays: null, dayOnly: true })
    }
    if (span.last < args.todayYmd) {
      const site = tripDayCounts(trip).site
      lines.push({ id: `trip-back:${record.id}`, at: dayIso(span.last), kind: 'trip', verb: `${lead} back`, trip: door, about, detail: [`${who} ${record.people.length === 1 ? 'is' : 'are'} back`, `${daysWords(site)} at the site`, record.outcome.trim() || null].filter(Boolean).join(' · '), by: null, waitingDays: null, dayOnly: true })
    }
  }
  return lines
}
