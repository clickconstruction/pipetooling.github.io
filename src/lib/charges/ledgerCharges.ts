/**
 * Charges and premium for a Job Summary row (punch list #254, PR 3): the ledger already holds every person's hours by
 * work date on every row (the team labor breakdown) and the sums of its material streams, so the two columns price
 * from those without a new read per row. Labor is crew-days at the rate card or the job's rule, with the day
 * adjustments on top; materials are the row's supply-house, tallied and typed sums at the markup, with the line
 * adjustments honored through the cost each kept when it was made. The Charges window prices the same rows line by
 * line; the two agree because they share the kernels and the adjustments.
 */
import { buildCrewDays, jobChargeRuleFrom, unchargedWords, UNCHARGED_FIX_WORDS, type CrewSessionInput, type JobChargeRule } from './crewDays'
import { chargedAtMarkup } from './materialsCharged'
import { indexAdjustments, type ChargeAdjustment } from './adjustments'
import { premiumOf, type Premium } from './premium'
import { CREW_SHAPES, parseChargeStanding, parseCrewShape, type ChargeStanding, type RateCard } from './rateCard'
import { moneyWords } from './moneyParts'

export type LedgerChargesInput = {
  /** The row's team labor breakdown: one entry per person with their hours by work date. */
  breakdown: ReadonlyArray<{ personName: string; personId?: string | null; byWorkDate: ReadonlyArray<{ workDate: string; hours: number }> }>
  /** A person's standing by the key the breakdown names them with (the name key, or the person id). */
  standingOf: (personName: string, personId: string | null | undefined) => ChargeStanding
  /** The row's material sums: supply-house invoice shares, tallied parts, typed material charges. */
  invoicesFromSupplyHouses: number
  partsFromTally: number
  billedMaterialsSum: number
  card: RateCard
  /** The job row's charging columns, read through a cast until the types catch up. */
  job: { charge_rule?: unknown; charge_shape?: unknown; hourly_charge_rate?: unknown; materials_markup_pct?: unknown }
  adjustments?: ReadonlyArray<ChargeAdjustment>
  /** The contract price: `jobs_ledger.revenue`. */
  contractUsd: number
}

export type LedgerCharges = {
  /** False when nothing on the row could be priced: no labor or materials at all, or every day unpriced and no materials. The column reads a dash then. */
  priced: boolean
  laborUsd: number
  materialsUsd: number
  chargesUsd: number
  premium: Premium
  crewHours: number
  days: number
  unpricedDays: number
  /** Why some of the row is not priced, each once; null when every day priced. Names who counts as nobody first. */
  note: string | null
  /** The first names of people out who count as nobody yet, most days first. */
  uncharged: string[]
  rule: JobChargeRule
  markupPct: number | null
}

const cents = (n: number): number => Math.round(Math.round(n * 1000) / 10) / 100

function numOf(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function ledgerChargesFor(input: LedgerChargesInput): LedgerCharges {
  const rule = jobChargeRuleFrom(input.job, parseCrewShape)
  const jobMarkup = numOf(input.job.materials_markup_pct)
  const markupPct = jobMarkup ?? input.card.materialsMarkupPct
  const applied = indexAdjustments(input.adjustments ?? [])
  const sessions: CrewSessionInput[] = []
  for (const p of input.breakdown) {
    const key = p.personId || p.personName
    const standing = input.standingOf(p.personName, p.personId)
    for (const d of p.byWorkDate) {
      if (!(d.hours > 0)) continue
      sessions.push({ userId: key, name: p.personName.split(' ')[0] || p.personName, standing, workDate: d.workDate, hours: d.hours })
    }
  }
  const dayShape = new Map(Array.from(applied.dayShape.entries()).map(([day, o]) => [day, o.shape] as const))
  const days = buildCrewDays(sessions, input.card, rule, { dayShape, dayOff: applied.dayOff })
  // Materials from the sums, then the line adjustments by the cost each kept: a line left off leaves at cost plus markup,
  // a line passed through leaves its markup only.
  const materialCost = cents(Math.max(0, input.invoicesFromSupplyHouses) + Math.max(0, input.partsFromTally) + Math.max(0, input.billedMaterialsSum))
  let materialsUsd = markupPct == null ? materialCost : chargedAtMarkup(materialCost, markupPct)
  for (const a of input.adjustments ?? []) {
    if (a.amount == null) continue
    if (a.kind === 'line_off') materialsUsd = cents(materialsUsd - (markupPct == null ? a.amount : chargedAtMarkup(a.amount, markupPct)))
    else if (a.kind === 'line_pass_through' && markupPct != null) materialsUsd = cents(materialsUsd - (chargedAtMarkup(a.amount, markupPct) - a.amount))
  }
  materialsUsd = Math.max(0, materialsUsd)
  const chargesUsd = cents(days.totals.charged + materialsUsd)
  const whys = new Set<string>()
  const nobody = unchargedWords(days.totals.uncharged)
  // A day with nobody charged is explained by naming who counts as nobody, with where to set it; the neutral line stays for the paper.
  if (nobody) {
    whys.add(nobody)
    whys.add(UNCHARGED_FIX_WORDS)
  }
  for (const d of days.days) if (d.why && !(nobody && d.why === 'Nobody out that day is charged to a customer.')) whys.add(d.why)
  if (markupPct == null && materialCost > 0) whys.add('No markup on materials is set, so materials are at cost.')
  const priced = materialCost > 0 || (days.totals.days > 0 && days.totals.unpriced < days.totals.days)
  return {
    priced,
    laborUsd: days.totals.charged,
    materialsUsd,
    chargesUsd,
    premium: premiumOf(input.contractUsd, chargesUsd),
    crewHours: days.totals.crewHours,
    days: days.totals.days,
    unpricedDays: days.totals.unpriced,
    note: whys.size ? Array.from(whys).join(' ') : null,
    uncharged: days.totals.uncharged.map((u) => u.name),
    rule,
    markupPct,
  }
}

/** The toolbar chip: `Charged at $285.00 the crew’s hour (master with a helper) · 4 of 7 rows set · materials 25% over cost`. */
export function rateCardChipWords(card: RateCard): string {
  const set = CREW_SHAPES.filter((s) => card.rates[s] != null).length + (card.extraPerson != null ? 1 : 0)
  const lead = card.rates.master_helper != null ? `Charged at ${moneyWords(card.rates.master_helper)} the crew’s hour (master with a helper)` : 'Charged by the rate card'
  const rows = `${set} of ${CREW_SHAPES.length + 1} rows set`
  const materials = card.materialsMarkupPct != null ? `materials ${card.materialsMarkupPct}% over cost` : 'materials at cost, no markup set'
  return `${lead} · ${rows} · ${materials}`
}

/** A standing lookup from the users rows the page already holds, by the name key the breakdown uses and by user id. */
export function standingLookup(users: ReadonlyArray<{ id: string; name: string | null; charge_standing?: unknown }>, nameKey: (name: string) => string, personIdToUserId?: ReadonlyMap<string, string>): LedgerChargesInput['standingOf'] {
  const byName = new Map<string, ChargeStanding>()
  const byId = new Map<string, ChargeStanding>()
  for (const u of users) {
    const s = parseChargeStanding(u.charge_standing)
    byId.set(u.id, s)
    if (u.name) byName.set(nameKey(u.name), s)
  }
  return (personName, personId) => {
    const userId = personId ? personIdToUserId?.get(personId) : undefined
    if (userId && byId.has(userId)) return byId.get(userId)!
    return byName.get(nameKey(personName)) ?? 'none'
  }
}
