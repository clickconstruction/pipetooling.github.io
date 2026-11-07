/**
 * The charged basis of a signed hours statement, priced (punch list #251 over #254's crew-days; lifted out of the
 * window's read for the dev MCP, punch list #212): the person's counted days become the crew-days they were part of —
 * the people out on the job that day, the crew's hours, the shape and its rate — so two papers never sell the same hour
 * twice. Pending rows stay pending; a day the card cannot price is listed with no amount and named. Pure: the window's
 * read (`hoursStatementRead.ts`) and the dev MCP's (`_shared/devMcpHoursStatement.ts`, through the edge copy) hand it
 * the same rows and the same reads, so a charged number on the seat is the number on the paper.
 */
import { buildCrewDays, jobChargeRuleWords, type CrewSessionInput, type CrewUncharged, type JobChargeRule } from '../charges/crewDays'
import { crewRateWords, type RateCard } from '../charges/rateCard'
import { indexAdjustments, type ChargeAdjustment } from '../charges/adjustments'
import type { HoursStatementRow } from './hoursStatement'

/** What the charged paper was priced by, for the window's line and the saved row. */
export type HoursStatementChargeFacts = {
  /** The headline rate: the job's shape or flat rate, else the master-with-a-helper row; null when the card has none. */
  rate: number | null
  /** `master with a helper throughout · $285.00 the crew’s hour`, or `the crew on each day, from the rate card`. */
  words: string
  /** Days in the span the person was part of that could not be priced, with the reason once each. */
  unpriced: string[]
  crewDays: number
  /**
   * Who counts as nobody on this person's days that priced at nothing because nobody out counted (the live pass), most
   * such days first, and how many such days. The office window names them; the paper keeps its neutral reason.
   */
  uncharged: CrewUncharged[]
  unchargedDays: number
}

export type HoursStatementChargedInput = {
  /** The person's own rows on the job in the span, as the clock read them (pending rows pass through unpriced). */
  rows: ReadonlyArray<HoursStatementRow>
  userId: string
  /** Every approved session on the job in the span, each person's standing from `charge_standings()`. */
  crew: ReadonlyArray<CrewSessionInput>
  card: RateCard
  rule: JobChargeRule
  /** The Charges window's open adjustments on the job (punch list #254, PR 3); none when the read failed. */
  adjustments: ReadonlyArray<ChargeAdjustment>
  span: { from: string; to: string }
}

/** The person's days as the crew-days they were part of, priced, and what the paper was priced by. */
export function hoursStatementChargedRows(input: HoursStatementChargedInput): { rows: HoursStatementRow[]; charge: HoursStatementChargeFacts } {
  const { rows, userId, card, rule, span } = input
  const applied = indexAdjustments(input.adjustments)
  const dayShape = new Map(Array.from(applied.dayShape.entries()).map(([day, o]) => [day, o.shape] as const))
  const days = buildCrewDays(
    input.crew.filter((s) => s.workDate >= span.from && s.workDate <= span.to),
    card,
    rule,
    { dayShape, dayOff: applied.dayOff },
  )
  const mine = new Map(rows.filter((r) => !r.pending).map((r) => [r.day, r] as const))
  const out: HoursStatementRow[] = []
  const unpriced = new Set<string>()
  const unchargedBy = new Map<string, CrewUncharged>()
  let unchargedDays = 0
  let crewDays = 0
  for (const d of days.days) {
    const own = mine.get(d.workDate)
    if (!own || !d.people.some((p) => p.userId === userId)) continue
    crewDays += 1
    if (d.shape == null) {
      unchargedDays += 1
      for (const p of d.people) {
        if (p.standing !== 'none') continue
        const u = unchargedBy.get(p.userId) ?? { userId: p.userId, name: p.name, days: 0 }
        u.days += 1
        unchargedBy.set(p.userId, u)
      }
    }
    const others = d.people.filter((p) => p.userId !== userId).map((p) => p.name)
    const note = `${others.length ? `with ${others.join(', ')}` : 'alone'} · ${d.shapeWords}${d.why ? ` · ${d.why}` : ''}`
    if (d.why) unpriced.add(d.why)
    // The crew's hours, or the person's own when nobody out that day is charged, so an unpriced day still shows its hours.
    out.push({ day: d.workDate, hours: d.crewHours > 0 ? d.crewHours : own.hours, note, inLabel: own.inLabel, outLabel: own.outLabel, pending: false, chargeRate: d.rate })
  }
  for (const r of rows) if (r.pending) out.push(r)
  const headline = rule.kind === 'flat' ? rule.rate : rule.kind === 'shape' ? (card.rates[rule.shape] ?? null) : (card.rates.master_helper ?? null)
  const charge: HoursStatementChargeFacts = {
    rate: headline,
    words: `${jobChargeRuleWords(rule)}${headline != null ? ` · ${crewRateWords({ rate: headline, why: null })}` : ''}`,
    unpriced: Array.from(unpriced),
    crewDays,
    uncharged: Array.from(unchargedBy.values()).sort((a, b) => b.days - a.days || a.name.localeCompare(b.name)),
    unchargedDays,
  }
  return { rows: out, charge }
}
