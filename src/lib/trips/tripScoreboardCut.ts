/**
 * The Scoreboard cut by trip (punch list #379, PR 8), beside the cuts by job, part and person
 * (`developments/scoreboardCuts.ts`). One row for each trip that has gone out, newest first, and a last row
 * **At home for the site** for everything on the site's jobs outside every trip.
 *
 * A trip's row fills only what can honestly be laid over its days:
 * - **Hours**, **Days** and **Labor**: its people's clocked hours on their own trip days, the days with that
 *   work each once, and the wages of those hours (`tripCost.ts`, the same split as **What it cost**).
 * - **Parts**: the card and bank charges dated in its days, the bucket **Card and bank charges in the days**
 *   names on the open trip (a card charge, or a payment out of the bank with no card on it).
 * - **Cost**: the two together, which is **The trip** on the open trip.
 *
 * The last row fills **Hours**, **Days**, **Labor** and **Parts**: the site less its trips, so those four add
 * up to the site's own totals, the ones the cut by job shows. **Subs** and **Overhead** are not cut by trip
 * and are blank on every row, the last one too, so the board never says a sub who went on a trip was at
 * home. The last row therefore has no **Cost**, and Cost is not claimed to add up. **Earned** and **Profit**
 * belong to a job and not to days: blank on every row, and nothing is allocated. In a window the rows carry
 * the days inside it alone. Pure; the page reads, the component draws.
 */
import type { ScoreboardColumnKey, ScoreboardModel } from '../developments/scoreboard'
import type { SiteCostsRead } from '../developments/siteCosts'
import type { SiteLaborRead } from '../developments/siteLabor'
import { siteCardCharges, splitTripCosts } from './tripCost'
import { TRIP_HOUR_BUCKET_LABEL } from './tripHours'
import { tripPeopleIndex, type TripRecord, type TripRosterPerson } from './tripRecord'
import { buildTripsLook, daysWords } from './tripsLook'

/** The measures a row fills; a key that is not here is a blank cell. */
export type ScoreboardTripMeasures = Partial<Record<ScoreboardColumnKey, number>>

export type ScoreboardTripRow = {
  key: string
  /** The last row: everything outside every trip. */
  home: boolean
  /** A trip by its short name, *Trip 5*, or its days for a trip made before numbers; the last row's name. */
  name: string
  /** The trip's days and what it was for, *Oct 29 to Nov 4 · Lift stations*; the last row's small words. */
  kit: string
  /** The trip the row is, for the door on its name; null on the last row. */
  tripId: string | null
  /** What the door on the name says on a hover: *Open Trip 5*. */
  door: string | null
  m: ScoreboardTripMeasures
  /** The days with clocked work in the row, so the rows' days can be counted once across them. */
  dayKeys: ReadonlySet<string>
  /** What the Days cell says on a hover: a trip's own length beside its days with work. */
  daysTitle: string | null
  /** What the Parts cell says on a hover. */
  partsTitle: string | null
}

export type ScoreboardTripCut = {
  rows: ScoreboardTripRow[]
  /** Why there are no rows yet, when there are none: a read still out, or the clock's days closed to the reader. */
  pending: string | null
}

export const SCOREBOARD_TRIP_HOME_WORDS = TRIP_HOUR_BUCKET_LABEL.home

export const SCOREBOARD_TRIP_NOTE =
  'A trip’s cost is its crew’s hours and the card and bank charges dated in its days. Parts on a trip’s row holds those charges, and the last row holds the rest of the hours, the wages and the parts. Subs and overhead are not cut by trip. Earned and profit belong to a job, not to days.'

export const SCOREBOARD_TRIP_LEAD_NOTE = 'A trip’s row holds its crew’s hours on their trip days. Earned belongs to a job, not to days.'

const round2 = (n: number): number => Math.round(n * 100) / 100

export function scoreboardTripCut(args: {
  model: ScoreboardModel
  labor: SiteLaborRead | undefined
  /** The site's kept trips, and the roster that names their people; null while either is not read. */
  records: ReadonlyArray<TripRecord> | null
  roster: ReadonlyArray<TripRosterPerson> | null
  costs: SiteCostsRead | undefined
  seesCosts: boolean
  todayYmd: string
  /** The day of a card charge's bank stamp, as the Scoreboard's window reads it. */
  toYmd: (raw: string | null) => string | null
}): ScoreboardTripCut {
  if (!args.records || !args.roster) return { rows: [], pending: 'Reading the trips…' }
  if (args.labor?.state === 'failed') return { rows: [], pending: 'The clock would not read, so the hours are not laid over the trips.' }
  if (args.labor?.state !== 'read') return { rows: [], pending: 'Reading the clock…' }
  if (!args.labor.labor.daysKnown) return { rows: [], pending: 'The clock’s days are closed to you, so the hours are not laid over the trips.' }
  const { model } = args
  const index = tripPeopleIndex(args.roster)
  const look = buildTripsLook({ records: args.records, index, hours: null, todayYmd: args.todayYmd })
  const cards = args.seesCosts && args.costs?.state === 'read' && args.costs.rows ? siteCardCharges(args.costs.rows, args.toYmd) : null
  const jobIds = new Set([...model.rows, ...model.empties].map((r) => r.jobId))
  const split = splitTripCosts({ trips: look.rows.map((r) => r.trip), labor: args.labor.labor, index, cards, jobIds, window: model.window })
  // The costs the last row carries stand on the site's own cost totals, so they wait for that read.
  const costsIn = args.seesCosts && split.cardsKnown && model.reads.costs === 'read'
  const rows: ScoreboardTripRow[] = []
  const sum = { hours: 0, labor: 0, parts: 0 }
  for (const row of look.rows) {
    const f = split.byTrip.get(row.id)
    if (!f) continue
    // A trip that has not gone out is a row only if something already fell on its days.
    if (row.standing === 'planned' && f.hours === 0 && f.cards === 0) continue
    const m: ScoreboardTripMeasures = { hours: round2(f.hours), days: f.workDays.size }
    if (args.seesCosts) m.labor = f.laborUsd
    if (costsIn) {
      m.parts = f.cardsUsd
      m.cost = round2(f.laborUsd + f.cardsUsd)
    }
    sum.hours += m.hours ?? 0
    sum.labor += m.labor ?? 0
    sum.parts += m.parts ?? 0
    rows.push({
      key: row.id,
      home: false,
      // The name column is tight: the number alone names the trip, and its days lead the small words.
      name: row.name.short,
      kit: row.name.number ? `${row.when} · ${row.why}` : row.why,
      tripId: row.id,
      door: row.name.door,
      m,
      dayKeys: f.workDays,
      daysTitle: `Days with clocked work inside the trip. The trip itself ran ${daysWords(row.dayCounts.days)}.`,
      partsTitle: costsIn ? `Card and bank charges in the days: ${f.cards} ${f.cards === 1 ? 'charge' : 'charges'} dated on a day someone was on the trip` : null,
    })
  }
  // The last row is the site less its trips in hours, wages and parts, so those add up to the site's own totals.
  // Subs and overhead are not cut by trip, so the row carries neither, and so no cost.
  const home: ScoreboardTripMeasures = { hours: round2(model.site.hours - sum.hours), days: split.home.workDays.size }
  if (args.seesCosts) home.labor = round2(model.site.labor - sum.labor)
  if (costsIn) home.parts = round2(model.site.parts - sum.parts)
  rows.push({
    key: 'home',
    home: true,
    name: SCOREBOARD_TRIP_HOME_WORDS,
    kit: 'everything outside a trip',
    tripId: null,
    door: null,
    m: home,
    dayKeys: split.home.workDays,
    daysTitle: 'Days with clocked work outside every trip',
    partsTitle: costsIn ? 'Supply houses, the tally, other charges, and the card and bank charges outside every trip’s days' : null,
  })
  return { rows, pending: null }
}
