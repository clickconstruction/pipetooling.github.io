/**
 * A job's charges, whole (punch list #254, PR 3): the crew-days at their rates, the material lines at the markup, the
 * office's adjustments on top, and the stand against the price. One pure build the Job Summary's two columns, the
 * Charges window and the Statement of charges all draw from, so every surface prices the same rows the same way.
 * The reads hand in the inputs; nothing here touches the database.
 */
import { buildCrewDays, crewDaysByWeek, type CrewDay, type CrewSessionInput, type CrewWeek, type JobChargeRule, DEFAULT_JOB_CHARGE_RULE } from './crewDays'
import { chargeMaterials, type MaterialLineCharged, type MaterialLineInput, type MaterialsChargedTotals } from './materialsCharged'
import { adjustMaterialLines, indexAdjustments, type ChargeAdjustment } from './adjustments'
import { premiumOf, type Premium } from './premium'
import type { RateCard } from './rateCard'

export type JobChargesInput = {
  sessions: ReadonlyArray<CrewSessionInput>
  lines: ReadonlyArray<MaterialLineInput>
  card: RateCard
  rule?: JobChargeRule
  /** The job's own markup, else the card's. */
  markupPct?: number | null
  adjustments?: ReadonlyArray<ChargeAdjustment>
  /** The job's revenue, the price. */
  revenue: number
}

export type JobChargesTotals = {
  labor: number
  materials: number
  charges: number
  crewHours: number
  personHours: number
  days: number
  unpricedDays: number
}

export type JobCharges = {
  days: CrewDay[]
  weeks: CrewWeek[]
  materials: { lines: MaterialLineCharged[]; leftOff: MaterialLineInput[]; totals: MaterialsChargedTotals; markupPct: number | null; why: string | null }
  totals: JobChargesTotals
  premium: Premium
  /** The same figures with no adjustment applied, for the window's tiles and the office copy. */
  record: { totals: JobChargesTotals; premium: Premium }
  adjustmentsCount: number
  /** Why some of it is not priced, each once, for the window and the paper. */
  notes: string[]
}

const cents = (n: number): number => Math.round(Math.round(n * 1000) / 10) / 100

function totalsOf(days: ReturnType<typeof buildCrewDays>, materials: ReturnType<typeof chargeMaterials>): JobChargesTotals {
  return {
    labor: days.totals.charged,
    materials: materials.totals.charged,
    charges: cents(days.totals.charged + materials.totals.charged),
    crewHours: days.totals.crewHours,
    personHours: days.totals.personHours,
    days: days.totals.days,
    unpricedDays: days.totals.unpriced,
  }
}

export function buildJobCharges(input: JobChargesInput): JobCharges {
  const rule = input.rule ?? DEFAULT_JOB_CHARGE_RULE
  const markup = input.markupPct ?? input.card.materialsMarkupPct
  const applied = indexAdjustments(input.adjustments ?? [])
  const days = buildCrewDays(input.sessions, input.card, rule, { dayShape: applied.dayShape, dayOff: applied.dayOff })
  const materials = chargeMaterials(adjustMaterialLines(input.lines, applied), markup)
  const totals = totalsOf(days, materials)
  const recordDays = buildCrewDays(input.sessions, input.card, rule)
  const recordMaterials = chargeMaterials(input.lines, markup)
  const recordTotals = totalsOf(recordDays, recordMaterials)
  const notes: string[] = []
  const whys = new Set<string>()
  for (const d of days.days) if (d.why) whys.add(d.why)
  for (const w of whys) notes.push(w)
  if (materials.why) notes.push(materials.why)
  return {
    days: days.days,
    weeks: crewDaysByWeek(days.days),
    materials: { lines: materials.lines, leftOff: materials.leftOff, totals: materials.totals, markupPct: materials.markupPct, why: materials.why },
    totals,
    premium: premiumOf(input.revenue, totals.charges),
    record: { totals: recordTotals, premium: premiumOf(input.revenue, recordTotals.charges) },
    adjustmentsCount: (input.adjustments ?? []).length,
    notes,
  }
}
