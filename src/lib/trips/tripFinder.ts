/**
 * The finder behind **Looks like a trip** (v2.7653, punch list #379, PR 1). The app never makes a trip. It
 * may say that a run of punches at the site has no trip over it, and a person then makes the trip or says
 * **Not a trip** once, which is remembered so the same days are not offered again.
 *
 * A run is the days people punched in at the site with no more than a weekend between them. People whose
 * days run together are one offer, since a crew goes out together. Pure.
 */
import { daysBetween, type Trip, type TripDays, type TripPerson } from './tripDays'

/** A day a person punched in at the site (a punch whose place is the site). */
export type SitePunchDay = { personKey: string; name?: string; ymd: string }

/** A person's days somebody said were not a trip, both ends in. */
export type TripDismissal = { personKey: string; first: string; last: string }

export type TripSuggestion = {
  /** Stable for the same people and days, for a list's key. */
  key: string
  first: string
  last: string
  people: Array<{ personKey: string; name: string; days: string[] }>
  /** Person-days with a punch at the site in the run. */
  punchDays: number
}

/** The most empty days inside one run: a weekend. */
export const TRIP_FINDER_MAX_GAP_DAYS = 2

/**
 * Runs of punches at the site that no trip covers. A person-day is covered when any trip has that person
 * on it that day, whatever the day's kind, and it is passed over when somebody said Not a trip for it.
 * Oldest run first.
 */
export function findTripsNotMade(args: { punchDays: ReadonlyArray<SitePunchDay>; trips: ReadonlyArray<Trip>; dismissed?: ReadonlyArray<TripDismissal>; maxGapDays?: number }): TripSuggestion[] {
  const maxGap = args.maxGapDays ?? TRIP_FINDER_MAX_GAP_DAYS
  const covered = new Set<string>()
  for (const t of args.trips) for (const p of t.people) for (const ymd of Object.keys(p.days)) covered.add(`${p.personKey}\u0000${ymd}`)
  const dismissedFor = new Map<string, TripDismissal[]>()
  for (const d of args.dismissed ?? []) dismissedFor.set(d.personKey, [...(dismissedFor.get(d.personKey) ?? []), d])
  const names = new Map<string, string>()
  const open = new Map<string, Set<string>>() // day → the people who punched at the site that day, uncovered
  for (const p of args.punchDays) {
    if (p.name && !names.has(p.personKey)) names.set(p.personKey, p.name)
    if (covered.has(`${p.personKey}\u0000${p.ymd}`)) continue
    if ((dismissedFor.get(p.personKey) ?? []).some((d) => d.first <= p.ymd && p.ymd <= d.last)) continue
    const who = open.get(p.ymd) ?? new Set<string>()
    who.add(p.personKey)
    open.set(p.ymd, who)
  }
  const days = [...open.keys()].sort()
  const runs: string[][] = []
  for (const ymd of days) {
    const run = runs[runs.length - 1]
    const prev = run?.[run.length - 1]
    if (run && prev && daysBetween(prev, ymd) <= maxGap + 1) run.push(ymd)
    else runs.push([ymd])
  }
  return runs.map((run) => {
    const byPerson = new Map<string, string[]>()
    for (const ymd of run) for (const personKey of open.get(ymd) ?? []) byPerson.set(personKey, [...(byPerson.get(personKey) ?? []), ymd])
    const people = [...byPerson.entries()]
      .map(([personKey, d]) => ({ personKey, name: names.get(personKey) ?? personKey, days: d }))
      .sort((a, b) => b.days.length - a.days.length || a.name.localeCompare(b.name))
    const first = run[0] ?? ''
    const last = run[run.length - 1] ?? first
    return {
      key: `${first}:${last}:${people.map((p) => p.personKey).sort().join(',')}`,
      first,
      last,
      people,
      punchDays: people.reduce((n, p) => n + p.days.length, 0),
    }
  })
}

/** **Make it a trip**: the people and days come filled from the punches, each punch day painted At the site. */
export function tripPeopleFromSuggestion(s: TripSuggestion): TripPerson[] {
  return s.people.map((p) => {
    const days: Record<string, 'site'> = {}
    for (const ymd of p.days) days[ymd] = 'site'
    return { personKey: p.personKey, name: p.name, days: days as TripDays }
  })
}

/** **Not a trip**, once: what to remember so the same days are not offered again, one line a person. */
export function dismissalsForSuggestion(s: TripSuggestion): TripDismissal[] {
  return s.people.map((p) => ({ personKey: p.personKey, first: p.days[0] ?? s.first, last: p.days[p.days.length - 1] ?? s.last }))
}
