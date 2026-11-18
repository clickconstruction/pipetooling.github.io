/**
 * What a trip cost (punch list #379, PR 8), for a dev or a controller, the Scoreboard's own readers
 * (`canSeeSiteCosts`). Two figures and their sum, both read from rows the Development page already holds:
 *
 * - **The crew's hours**: the labor dollars of the hours inside the trip. A person's day on the site's jobs
 *   (`developments/siteLabor.ts`, the Scoreboard's own hours and wages) goes to the trip that person was on
 *   that day, under the same key the hours split uses (`tripPersonKey`), so the dollars cover exactly the
 *   hours the trip's table counts. A day off in the middle, and a person who was not on the trip, stay out.
 * - **Card and bank charges in the days**: the charges in a job's card bucket that the job costs count
 *   (`developments/siteCosts.ts`: no internal transfer, no charge already on a supply invoice), dated on a
 *   day anyone was on the trip. The bucket holds a payment out of the bank with no card on it too (an ACH,
 *   a check), and the rows the page holds cannot tell the two apart, so the row is named for both.
 *
 * A day two trips both hold goes to the trip that went out first, as an hour does, so nothing is counted
 * twice. Everything outside every trip is **At home for the site**. A trip is a reading: nothing here
 * changes a clock row, a bill or a cost. Pure.
 */
import { cardChargeCostUsd } from '../../../supabase/functions/_shared/cardChargeAllocationFilter'
import { jobCardLineStatus, mercuryLinesFromRows } from '../../../supabase/functions/_shared/jobMaterialsCostLines'
import { scoreboardUsd } from '../developments/scoreboard'
import type { SiteCostRows } from '../developments/siteCosts'
import type { SiteLabor } from '../developments/siteLabor'
import { sortTrips, tripDayKind, tripDayOfPerson, type Trip } from './tripDays'
import { tripPersonKey, type TripPeopleIndex } from './tripRecord'

/** One counted card charge on one of the site's jobs, with the day it posted. */
export type TripCardCharge = {
  jobId: string
  /** The day the bank posted it; null when the row carries none. */
  ymd: string | null
  /** Money out: a refund is negative and comes off. */
  usd: number
  /** The bank transaction, so a charge split over two of the site's jobs is counted once. */
  txKey: string
}

/** The site's counted card charges from the cost rows the page holds, each with its day. */
export function siteCardCharges(rows: Pick<SiteCostRows, 'cardAlloc' | 'cardExclusions'>, toYmd: (raw: string | null) => string | null): TripCardCharge[] {
  const lines = mercuryLinesFromRows(rows.cardAlloc)
  const out: TripCardCharge[] = []
  lines.forEach((line, i) => {
    const jobId = rows.cardAlloc[i]?.job_id
    if (!jobId || jobCardLineStatus(line, rows.cardExclusions) !== 'counts') return
    out.push({ jobId, ymd: toYmd(line.postedAt), usd: cardChargeCostUsd(line.allocationAmount), txKey: line.mercuryTransactionId ?? `line:${line.id}` })
  })
  return out
}

export type TripCostWindow = { from: string; to: string }

/** One side of the split: a trip's figures, or everything outside every trip. */
export type TripCostFigures = {
  hours: number
  laborUsd: number
  /** The days with clocked work in it, each once. */
  workDays: Set<string>
  /** How many card charges, a charge split over two jobs counted once. */
  cards: number
  cardsUsd: number
}

export type TripCostSplit = {
  byTrip: Map<string, TripCostFigures>
  /** At home for the site: the hours, wages and card charges outside every trip. */
  home: TripCostFigures
  /** False when the clock's days are not known, so no hour or wage could be laid over a trip. */
  laborKnown: boolean
  /** False when no card charges were handed in. */
  cardsKnown: boolean
}

const round2 = (n: number): number => Math.round(n * 100) / 100
const inWindow = (window: TripCostWindow | null | undefined, ymd: string | null): boolean => !window || (!!ymd && ymd >= window.from && ymd <= window.to)

/**
 * Lay the site's wages and card charges over its trips. `jobIds`, when given, keeps the split to those jobs;
 * `window`, when given, to the days inside it, an undated charge then left out as the Scoreboard leaves it.
 */
export function splitTripCosts(args: {
  trips: ReadonlyArray<Trip>
  labor: SiteLabor | null
  index: TripPeopleIndex
  cards: ReadonlyArray<TripCardCharge> | null
  jobIds?: ReadonlySet<string> | null
  window?: TripCostWindow | null
}): TripCostSplit {
  const trips = sortTrips(args.trips)
  type Acc = TripCostFigures & { tx: Set<string> }
  const none = (): Acc => ({ hours: 0, laborUsd: 0, workDays: new Set(), cards: 0, cardsUsd: 0, tx: new Set() })
  const byTrip = new Map<string, Acc>()
  for (const t of trips) byTrip.set(t.id, none())
  const home = none()
  const laborKnown = !!args.labor?.daysKnown
  if (args.labor && laborKnown)
    for (const [jobId, job] of args.labor.byJobId) {
      if (args.jobIds && !args.jobIds.has(jobId)) continue
      for (const person of job.people) {
        const personKey = tripPersonKey(args.index, { personId: person.personId, userId: person.userId, name: person.personName })
        for (const d of person.byWorkDate ?? []) {
          if (!inWindow(args.window, d.ymd)) continue
          const on = tripDayOfPerson(trips, personKey, d.ymd)
          const into = (on ? byTrip.get(on.trip.id) : undefined) ?? home
          into.hours += d.hours
          into.laborUsd += d.costUsd
          if (d.hours > 0) into.workDays.add(d.ymd)
        }
      }
    }
  for (const c of args.cards ?? []) {
    if (args.jobIds && !args.jobIds.has(c.jobId)) continue
    if (!inWindow(args.window, c.ymd)) continue
    const ymd = c.ymd
    const trip = ymd ? trips.find((t) => tripDayKind(t, ymd) != null) : undefined
    const into = (trip ? byTrip.get(trip.id) : undefined) ?? home
    into.cardsUsd += c.usd
    into.tx.add(c.txKey)
  }
  const done = (a: Acc): TripCostFigures => ({ hours: a.hours, laborUsd: round2(a.laborUsd), workDays: a.workDays, cards: a.tx.size, cardsUsd: round2(a.cardsUsd) })
  return { byTrip: new Map([...byTrip].map(([id, a]) => [id, done(a)])), home: done(home), laborKnown, cardsKnown: args.cards != null }
}

// ---- What it cost, on an open trip ------------------------------------------------------------

/** One trip's cost: null where a figure is not known yet. */
export type TripCost = {
  laborUsd: number | null
  cards: { count: number; usd: number } | null
  /** The two together; null until both are known. */
  totalUsd: number | null
}

/**
 * What each trip cost, by its id. Null for a reader who may not see the site's costs: they get nothing.
 * The wages wait on the clock's days and the cards on the page's cost rows, each on its own.
 */
export function tripCostsOfTrips(args: { seesCosts: boolean; trips: ReadonlyArray<Trip>; labor: SiteLabor | null; index: TripPeopleIndex; cards: ReadonlyArray<TripCardCharge> | null }): Map<string, TripCost> | null {
  if (!args.seesCosts) return null
  const split = splitTripCosts(args)
  const out = new Map<string, TripCost>()
  for (const [id, f] of split.byTrip) {
    const laborUsd = split.laborKnown ? f.laborUsd : null
    const cards = split.cardsKnown ? { count: f.cards, usd: f.cardsUsd } : null
    out.set(id, { laborUsd, cards, totalUsd: laborUsd != null && cards ? round2(laborUsd + cards.usd) : null })
  }
  return out
}

/** Where the clock's wages stand for the table: read, still reading, closed to the reader, or unread. */
export type TripLaborState = 'read' | 'reading' | 'closed' | 'failed'
/** Where the page's cost rows stand: `off` when the rows the page holds carry no card charges to date. */
export type TripCardsState = 'read' | 'reading' | 'failed' | 'off'

export type TripCostLine = { key: 'labor' | 'cards' | 'total'; label: string; /** The quiet words after the label: how many charges. */ small: string | null; value: string; /** True when the value is a figure, false when it says why there is none. */ stands: boolean }

export const TRIP_COST_CAP = 'What it cost'
export const TRIP_COST_WHO = 'a dev or a controller'

const LABOR_WAIT: Readonly<Record<Exclude<TripLaborState, 'read'>, string>> = { reading: 'reading the clock…', closed: 'the clock’s days are closed', failed: 'the clock did not read' }
const CARDS_WAIT: Readonly<Record<'reading' | 'failed', string>> = { reading: 'reading the costs…', failed: 'the costs did not read' }

/**
 * The three rows of **What it cost** in words, money as the Scoreboard writes it. The card row is left out
 * when the page's cost rows carry no card charges (`off`), and the sum then stands on the wages alone.
 */
export function tripCostLines(cost: TripCost | undefined, state: { labor: TripLaborState; cards: TripCardsState }): TripCostLine[] {
  const labor = cost?.laborUsd ?? null
  const cards = cost?.cards ?? null
  const laborStands = state.labor === 'read' && labor != null
  const cardsStand = state.cards === 'read' && cards != null
  const lines: TripCostLine[] = [{ key: 'labor', label: 'The crew’s hours', small: null, value: laborStands ? scoreboardUsd(labor) : LABOR_WAIT[state.labor === 'read' ? 'reading' : state.labor], stands: laborStands }]
  if (state.cards !== 'off')
    lines.push({
      key: 'cards',
      label: 'Card and bank charges in the days',
      small: cardsStand ? `${cards.count} ${cards.count === 1 ? 'charge' : 'charges'}` : null,
      value: cardsStand ? scoreboardUsd(cards.usd) : CARDS_WAIT[state.cards === 'failed' ? 'failed' : 'reading'],
      stands: cardsStand,
    })
  const totalStands = laborStands && (state.cards === 'off' || cardsStand)
  lines.push({ key: 'total', label: 'The trip', small: null, value: totalStands ? scoreboardUsd(round2(labor + (cardsStand ? cards.usd : 0))) : '—', stands: totalStands })
  return lines
}
