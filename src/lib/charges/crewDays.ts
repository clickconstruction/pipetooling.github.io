/**
 * Crew-days (punch list #254, PR 1): the people who clocked on a job on the same day are that day's crew. The crew's
 * hours are the longest day of anyone in it who is charged; its shape comes from their standings, its rate from the
 * rate card, or from the job's rule when the job says one shape throughout or a flat rate. Eight hours of two techs
 * together is one line of eight crew-hours, never sixteen person-hours. Pure: the reads hand in approved sessions
 * with each person's standing, and get back the days, the weeks and the totals the paper, the window and the ledger
 * draw.
 */
import { CREW_SHAPE_LOWER, crewRateFor, crewShapeOf, type ChargeStanding, type CrewShape, type RateCard } from './rateCard'

export type CrewSessionInput = {
  userId: string
  name: string
  standing: ChargeStanding
  /** YYYY-MM-DD in the office's day. */
  workDate: string
  hours: number
  /** True for a row the office imported from the pay records rather than a clocked session. */
  imported?: boolean
}

/** How a job prices its labor: the crew on each day from the card, one shape throughout, or a flat rate for every hour. */
export type JobChargeRule = { kind: 'crew' } | { kind: 'shape'; shape: CrewShape } | { kind: 'flat'; rate: number }

export const DEFAULT_JOB_CHARGE_RULE: JobChargeRule = { kind: 'crew' }

export type CrewDayPerson = { userId: string; name: string; standing: ChargeStanding; hours: number }

export type CrewDay = {
  workDate: string
  people: CrewDayPerson[]
  /** The longest day of anyone charged; 0 when nobody is. */
  crewHours: number
  /** Every person's hours added, for the office. */
  personHours: number
  /** The shape the standings make, before the job's rule. */
  shape: CrewShape | null
  /** The shape the day is priced at: the job's shape, or the crew's. */
  pricedShape: CrewShape | null
  extra: number
  rate: number | null
  charged: number | null
  /** Why the day is not priced, or null. */
  why: string | null
  /** Any person's row on this day came from the pay records. */
  imported: boolean
  /** Who was out, in words: `Trace, Joseph`. */
  who: string
  /** The shape in words, with the job's rule named when it decided. */
  shapeWords: string
  /** An adjustment set this day's shape. */
  adjusted: boolean
}

export type CrewDaysTotals = {
  days: number
  crewHours: number
  personHours: number
  charged: number
  /** Days with no rate, by count; the paper names each. */
  unpriced: number
  importedDays: number
  /** Days an adjustment left off the paper. */
  daysLeftOff: number
  /** Days an adjustment set to another shape. */
  daysAdjusted: number
}

export type CrewDaysResult = { days: CrewDay[]; totals: CrewDaysTotals }

/** The office's adjustments on days (punch list #254, PR 3): a shape set on a day, or a day left off. */
export type CrewDayOverrides = {
  dayShape?: ReadonlyMap<string, CrewShape>
  dayOff?: ReadonlySet<string>
}

/** To the cent, a half-cent rounding up, whatever floating point made of the product. */
const cents = (n: number): number => Math.round(Math.round(n * 1000) / 10) / 100

function uniqueNames(people: CrewDayPerson[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of people) {
    if (seen.has(p.userId)) continue
    seen.add(p.userId)
    out.push(p.name)
  }
  return out.join(', ')
}

/** The sessions grouped into crew-days and priced; days sorted by date, people by hours then name. A day left off by an adjustment is dropped and counted. */
export function buildCrewDays(sessions: ReadonlyArray<CrewSessionInput>, card: RateCard, rule: JobChargeRule = DEFAULT_JOB_CHARGE_RULE, overrides: CrewDayOverrides = {}): CrewDaysResult {
  const byDay = new Map<string, { people: Map<string, CrewDayPerson>; imported: boolean }>()
  let daysLeftOff = 0
  const seenOff = new Set<string>()
  for (const s of sessions) {
    if (!(s.hours > 0)) continue
    if (overrides.dayOff?.has(s.workDate)) {
      if (!seenOff.has(s.workDate)) {
        seenOff.add(s.workDate)
        daysLeftOff += 1
      }
      continue
    }
    const day = byDay.get(s.workDate) ?? { people: new Map(), imported: false }
    const prior = day.people.get(s.userId)
    day.people.set(s.userId, { userId: s.userId, name: s.name, standing: s.standing, hours: cents((prior?.hours ?? 0) + s.hours) })
    if (s.imported) day.imported = true
    byDay.set(s.workDate, day)
  }
  const days: CrewDay[] = []
  for (const [workDate, d] of Array.from(byDay.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const people = Array.from(d.people.values()).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name))
    const charged = people.filter((p) => p.standing !== 'none')
    const crewHours = charged.length ? Math.max(...charged.map((p) => p.hours)) : 0
    const personHours = cents(people.reduce((a, p) => a + p.hours, 0))
    const read = crewShapeOf(people.map((p) => p.standing))
    let pricedShape: CrewShape | null = read.shape
    let rate: number | null = null
    let why: string | null = null
    let shapeWords = read.shape ? CREW_SHAPE_LOWER[read.shape] : 'nobody charged'
    const setTo = overrides.dayShape?.get(workDate) ?? null
    if (read.shape == null) {
      why = 'Nobody out that day is charged to a customer.'
    } else if (setTo) {
      pricedShape = setTo
      const price = crewRateFor(card, setTo, 0)
      rate = price.rate
      why = price.why
      shapeWords = `${CREW_SHAPE_LOWER[setTo]} · adjusted`
    } else if (rule.kind === 'flat') {
      rate = rule.rate > 0 ? cents(rule.rate) : null
      why = rate == null ? 'The job’s flat rate is not set.' : null
      shapeWords = `${CREW_SHAPE_LOWER[read.shape]} · the job’s flat rate`
    } else if (rule.kind === 'shape') {
      pricedShape = rule.shape
      const price = crewRateFor(card, rule.shape, 0)
      rate = price.rate
      why = price.why
      shapeWords = `${CREW_SHAPE_LOWER[rule.shape]} · the job’s rule`
    } else {
      const price = crewRateFor(card, read.shape, read.extra)
      rate = price.rate
      why = price.why
      if (read.extra > 0) shapeWords = `${CREW_SHAPE_LOWER[read.shape]} and ${read.extra} more`
    }
    const chargedAmount = rate != null && crewHours > 0 ? cents(crewHours * rate) : null
    days.push({
      workDate,
      people,
      crewHours,
      personHours,
      shape: read.shape,
      pricedShape,
      extra: read.extra,
      rate,
      charged: chargedAmount,
      why: chargedAmount == null ? why ?? 'No hours charged that day.' : null,
      imported: d.imported,
      who: uniqueNames(people),
      shapeWords,
      adjusted: setTo != null && read.shape != null,
    })
  }
  const totals: CrewDaysTotals = {
    days: days.length,
    crewHours: cents(days.reduce((a, d) => a + d.crewHours, 0)),
    personHours: cents(days.reduce((a, d) => a + d.personHours, 0)),
    charged: cents(days.reduce((a, d) => a + (d.charged ?? 0), 0)),
    unpriced: days.filter((d) => d.charged == null).length,
    importedDays: days.filter((d) => d.imported).length,
    daysLeftOff,
    daysAdjusted: days.filter((d) => d.adjusted).length,
  }
  return { days, totals }
}

export type CrewWeek = {
  /** Monday, YYYY-MM-DD. */
  weekStart: string
  days: number
  crewHours: number
  charged: number
  /** Everyone out that week, once each. */
  who: string
  /** The shapes the week was priced at, once each, in words. */
  shapeWords: string
  /** Rates seen that week; one when the week prices alike. */
  rates: number[]
  imported: boolean
  unpriced: number
}

/** Monday of the week a YYYY-MM-DD falls in, without a time zone. */
export function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  const back = (dt.getUTCDay() + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - back)
  return dt.toISOString().slice(0, 10)
}

/** Crew-days rolled into weeks for the paper's lines. */
export function crewDaysByWeek(days: ReadonlyArray<CrewDay>): CrewWeek[] {
  const weeks = new Map<string, CrewWeek & { names: Set<string>; shapes: Set<string>; rateSet: Set<number> }>()
  for (const d of days) {
    const k = mondayOf(d.workDate)
    const w = weeks.get(k) ?? { weekStart: k, days: 0, crewHours: 0, charged: 0, who: '', shapeWords: '', rates: [], imported: false, unpriced: 0, names: new Set<string>(), shapes: new Set<string>(), rateSet: new Set<number>() }
    w.days += 1
    w.crewHours = cents(w.crewHours + d.crewHours)
    w.charged = cents(w.charged + (d.charged ?? 0))
    for (const p of d.people) w.names.add(p.name)
    w.shapes.add(d.shapeWords)
    if (d.rate != null) w.rateSet.add(d.rate)
    if (d.imported) w.imported = true
    if (d.charged == null) w.unpriced += 1
    weeks.set(k, w)
  }
  return Array.from(weeks.values())
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1))
    .map(({ names, shapes, rateSet, ...w }) => ({ ...w, who: Array.from(names).join(', '), shapeWords: Array.from(shapes).join(' · '), rates: Array.from(rateSet).sort((a, b) => a - b) }))
}

/** The job's rule from the job row's columns; anything unreadable is the crew on each day. */
export function jobChargeRuleFrom(row: { charge_rule?: unknown; charge_shape?: unknown; hourly_charge_rate?: unknown }, parseShape: (v: unknown) => CrewShape | null): JobChargeRule {
  if (row.charge_rule === 'shape') {
    const shape = parseShape(row.charge_shape)
    if (shape) return { kind: 'shape', shape }
  }
  if (row.charge_rule === 'flat') {
    const rate = typeof row.hourly_charge_rate === 'number' ? row.hourly_charge_rate : Number(row.hourly_charge_rate)
    if (Number.isFinite(rate) && rate > 0) return { kind: 'flat', rate: cents(rate) }
  }
  return DEFAULT_JOB_CHARGE_RULE
}

/** The rule in words for a chip: `the crew on each day`, `master with a helper throughout`, `a flat $300.00 an hour`. */
export function jobChargeRuleWords(rule: JobChargeRule): string {
  if (rule.kind === 'shape') return `${CREW_SHAPE_LOWER[rule.shape]} throughout`
  if (rule.kind === 'flat') return `a flat $${rule.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} an hour`
  return 'the crew on each day'
}
