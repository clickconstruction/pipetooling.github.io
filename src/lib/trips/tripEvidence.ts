/**
 * **What shows it** on an open trip (punch list #379, PR 5): counts of what the page already reads, over
 * the trip's own person-days. A person-day is one person on one of their days on the trip, whatever the
 * day's kind. A day a person was off is not theirs, so a punch that day shows nothing for the trip.
 *
 * The counts say what stands behind the painted days. They change nothing: no clock row, bill or cost.
 * Pure.
 */
import type { LatLng } from '../jobTravelEstimate'
import type { Trip } from './tripDays'
import { placeKey, pointsOfPunch, type PunchRow } from './tripHourRows'
import { placeOfPunch } from './tripPlace'
import { tripPersonKey, type TripPeopleIndex } from './tripRecord'

export type TripEvidence = {
  /** Clock rows on the site's jobs, by a person on the trip, on one of their trip days, whose place is the site. */
  punchesAtSite: number
  /** On my way and I’m here stamps on those people's rows on those days, each stamp one. */
  stamps: number
  /** History lines on a day anyone was on the trip, the trip's own two lines left out. */
  historyLines: number
}

/**
 * What shows one trip. `punches` are the clock's rows on the site's jobs, `site` the point of the site's
 * address (with none, no punch reads At the site), and `historyDays` the day of each History line that is
 * not a trip's own, one entry a line.
 */
export function tripEvidence(args: { trip: Trip; punches: ReadonlyArray<PunchRow>; site: LatLng | null; index: TripPeopleIndex; historyDays: ReadonlyArray<string> }): TripEvidence {
  const personDays = new Set<string>()
  const days = new Set<string>()
  for (const p of args.trip.people)
    for (const ymd of Object.keys(p.days)) {
      personDays.add(placeKey(p.personKey, ymd))
      days.add(ymd)
    }
  let punchesAtSite = 0
  let stamps = 0
  for (const p of args.punches) {
    if (!personDays.has(placeKey(tripPersonKey(args.index, { userId: p.user_id }), p.work_date))) continue
    if (placeOfPunch(pointsOfPunch(p), args.site) === 'site') punchesAtSite += 1
    if (p.travel_started_at) stamps += 1
    if (p.arrived_at) stamps += 1
  }
  let historyLines = 0
  for (const ymd of args.historyDays) if (days.has(ymd)) historyLines += 1
  return { punchesAtSite, stamps, historyLines }
}

export type TripEvidenceChip = {
  key: 'punches' | 'stamps' | 'lines'
  /** *8 punches at the site*; a zero reads plainly, *0 punches at the site*. */
  words: string
  /** Green for a sighting above zero; everything else is plain grey. */
  tone: 'green' | 'plain'
}

/** The chips under **What shows it**, in their order. */
export function tripEvidenceChips(e: TripEvidence): TripEvidenceChip[] {
  return [
    { key: 'punches', words: `${e.punchesAtSite} ${e.punchesAtSite === 1 ? 'punch' : 'punches'} at the site`, tone: e.punchesAtSite > 0 ? 'green' : 'plain' },
    { key: 'stamps', words: `${e.stamps} On my way and I’m here ${e.stamps === 1 ? 'stamp' : 'stamps'}`, tone: e.stamps > 0 ? 'green' : 'plain' },
    { key: 'lines', words: `${e.historyLines} ${e.historyLines === 1 ? 'line' : 'lines'} in History`, tone: 'plain' },
  ]
}
