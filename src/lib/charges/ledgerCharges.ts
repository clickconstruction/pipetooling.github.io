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
import { CREW_SHAPES, NOBODY_CHARGED_WHY, parseChargeStanding, parseCrewShape, type ChargeStanding, type RateCard } from './rateCard'
import { moneyWords } from './moneyParts'
import { liveOverArchived, loginRows, standingsByPersonId, type ChargeStandingRow } from './chargeStandings'

export type LedgerChargesInput = {
  /**
   * The row's team labor breakdown: one entry per person with their hours by work date. Since v2.6501 the job's approved
   * pay-record days ride in the same list, one entry a person with `imported: true` and the People record's id, so a
   * person with no login prices beside the clock's people and a linked one's days land on the same crew-day.
   */
  breakdown: ReadonlyArray<{ personName: string; personId?: string | null; imported?: boolean; byWorkDate: ReadonlyArray<{ workDate: string; hours: number }> }>
  /** A person's standing by the key the breakdown names them with (the name key, or the person id). */
  standingOf: (personName: string, personId: string | null | undefined) => ChargeStanding
  /**
   * The login a person on the breakdown reaches (the live pass): through the People record's link, else by the name.
   * Someone with none and no standing of their own is named apart, with the People record as the place to set it
   * (v2.6501); someone with one is named as the login is, so the note reads the name the list shows. Left out, everyone
   * is taken to have one.
   */
  loginOf?: (personName: string, personId: string | null | undefined) => { id: string; name: string | null } | null
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
  /**
   * Why the standings could not be read, when they could not (v2.6484): every day is then unknown rather than nobody's,
   * so nothing on the row prices and the note carries the read's reason in place of the nobody line. Null or left out when
   * the read answered.
   */
  standingsUnread?: string | null
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
  /** Days priced at nothing for any reason; the premium waits on these. */
  unpricedDays: number
  /** Of those, the days nobody out counted for; a standing fixes these alone. */
  unchargedDays: number
  /** Why some of the row is not priced, each once; null when every day priced. Names who counts as nobody first, or the read that failed. */
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
  const loginless = new Set<string>()
  for (const p of input.breakdown) {
    const key = p.personId || p.personName
    const standing = input.standingOf(p.personName, p.personId)
    const login = input.loginOf ? input.loginOf(p.personName, p.personId) : undefined
    if (login === null) loginless.add(key)
    const shown = login?.name?.trim() || p.personName
    for (const d of p.byWorkDate) {
      if (!(d.hours > 0)) continue
      sessions.push({ userId: key, name: shown.split(' ')[0] || shown, standing, workDate: d.workDate, hours: d.hours, imported: p.imported === true })
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
  // The standings could not be read (v2.6484): every day is unknown, not nobody's, so the row stays a dash with the
  // read's reason, and the nobody note never names anyone for a read that failed.
  if (input.standingsUnread) {
    return {
      priced: false,
      laborUsd: 0,
      materialsUsd,
      chargesUsd: materialsUsd,
      premium: premiumOf(input.contractUsd, materialsUsd),
      crewHours: 0,
      days: days.totals.days,
      unpricedDays: days.totals.days,
      unchargedDays: 0,
      note: standingsUnreadWords(input.standingsUnread),
      uncharged: [],
      rule,
      markupPct,
    }
  }
  const whys = new Set<string>()
  const withLogin = days.totals.uncharged.filter((u) => !loginless.has(u.userId))
  const nobody = unchargedWords(withLogin)
  // A day with nobody charged is explained by naming who counts as nobody, with where to set it; the neutral line stays for the paper.
  if (nobody) {
    whys.add(nobody)
    whys.add(UNCHARGED_FIX_WORDS)
  }
  // Someone with no login cannot be set in Who counts as what, so they are named with the link they need instead.
  const noLogin = loginlessWords(days.totals.uncharged.filter((u) => loginless.has(u.userId)))
  if (noLogin) whys.add(noLogin)
  for (const d of days.days) if (d.why && !((nobody || noLogin) && d.why === NOBODY_CHARGED_WHY)) whys.add(d.why)
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
    unchargedDays: days.totals.unchargedDays,
    note: whys.size ? Array.from(whys).join(' ') : null,
    uncharged: days.totals.uncharged.map((u) => u.name),
    rule,
    markupPct,
  }
}

/**
 * The job's approved pay-record days as breakdown entries (v2.6501): one a person, `imported`, keyed by the People
 * record's id, so a linked person's days join their clock days on the crew-day and an unlinked person's price by the
 * standing on their record.
 */
export function payRecordBreakdown(rows: ReadonlyArray<{ personId: string; personName: string; workDate: string; hours: number }>): Array<{ personName: string; personId: string; imported: true; byWorkDate: Array<{ workDate: string; hours: number }> }> {
  const byPerson = new Map<string, { personName: string; personId: string; imported: true; byWorkDate: Array<{ workDate: string; hours: number }> }>()
  for (const r of rows) {
    if (!(r.hours > 0)) continue
    const e = byPerson.get(r.personId) ?? { personName: r.personName, personId: r.personId, imported: true as const, byWorkDate: [] }
    e.byWorkDate.push({ workDate: r.workDate, hours: r.hours })
    byPerson.set(r.personId, e)
  }
  return Array.from(byPerson.values())
}

/** The toolbar chip: `Charged at $285.00 the crew’s hour (master with a helper) · 4 of 7 rows set · materials 25% over cost`. */
export function rateCardChipWords(card: RateCard): string {
  const set = CREW_SHAPES.filter((s) => card.rates[s] != null).length + (card.extraPerson != null ? 1 : 0)
  const lead = card.rates.master_helper != null ? `Charged at ${moneyWords(card.rates.master_helper)} the crew’s hour (master with a helper)` : 'Charged by the rate card'
  const rows = `${set} of ${CREW_SHAPES.length + 1} rows set`
  const materials = card.materialsMarkupPct != null ? `materials ${card.materialsMarkupPct}% over cost` : 'materials at cost, no markup set'
  return `${lead} · ${rows} · ${materials}`
}

/**
 * People on the crew rows with no login who count as nobody yet, named for the office (the live pass; the words since
 * v2.6501): `Ana has no login. Set their Charged as on the People record, or in Who counts as what.` A People record
 * with no login holds its own Charged as, so the fix is a pick, not a link. Null when there is nobody to name.
 */
export function loginlessWords(people: ReadonlyArray<{ name: string }>): string | null {
  const names = Array.from(new Set(people.map((p) => p.name)))
  if (names.length === 0) return null
  const list = names.length === 1 ? names[0] : names.length <= 3 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
  return `${list} ${names.length === 1 ? 'has' : 'have'} no login. Set ${names.length === 1 ? 'their Charged as on the People record' : 'each one’s Charged as on the People record'}, or in Who counts as what.`
}

/**
 * The cell's title when the standings could not be read (v2.6484): the read's reason, through `formatErrorMessage` at
 * the read, never the nobody note, since nobody is known to count as nothing.
 */
export function standingsUnreadWords(reason: string): string {
  return `Who counts as what could not be read, so nothing is priced yet: ${reason}`
}

/**
 * A row's two Job Summary cells: the charges, and the premium against the price. The premium waits while any day
 * prices at nothing (the live pass), since charges short by whole days would show a premium that is not there.
 */
export function ledgerSummaryCell(c: Pick<LedgerCharges, 'priced' | 'chargesUsd' | 'premium' | 'unpricedDays' | 'note'>): { chargesUsd: number | null; premiumUsd: number | null; note: string | null } {
  if (!c.priced) return { chargesUsd: null, premiumUsd: null, note: c.note }
  return { chargesUsd: c.chargesUsd, premiumUsd: c.unpricedDays > 0 ? null : c.premium.signed, note: c.note }
}

/**
 * The login a breakdown person reaches: by the People record's link, else by the name key; null when none. By name, a
 * login still here wins over one that left with the same name (v2.6490), since `charge_standings()` answers both.
 */
export function loginLookup(rows: ReadonlyArray<Pick<ChargeStandingRow, 'id' | 'name' | 'archived_at'>>, nameKey: (name: string) => string, personIdToUserId?: ReadonlyMap<string, string>): NonNullable<LedgerChargesInput['loginOf']> {
  // The login rows alone: a People record with no login (v2.6501) is not a login anyone reaches.
  const users = loginRows(rows)
  const byId = new Map(users.map((u) => [u.id, u] as const))
  const byName = liveOverArchived(users, (u) => (u.name ? nameKey(u.name) : null))
  return (personName, personId) => {
    const userId = personId ? personIdToUserId?.get(personId) : undefined
    const u = (userId ? byId.get(userId) : undefined) ?? byName.get(nameKey(personName))
    return u ? { id: u.id, name: u.name } : null
  }
}

/**
 * A standing lookup from the rows `charge_standings()` answers, by the name key the breakdown uses, by user id and, for
 * a People record with no login, by its own id (v2.6501). A linked record reads its login's standing; an unlinked one
 * with a row of its own reads that, never a login's by name. By name, a login still here wins over one that left with
 * the same name (v2.6490); by id every row answers, so a person who left prices by the standing set on their login.
 */
export function standingLookup(rows: ReadonlyArray<ChargeStandingRow>, nameKey: (name: string) => string, personIdToUserId?: ReadonlyMap<string, string>): LedgerChargesInput['standingOf'] {
  const users = loginRows(rows)
  const byId = new Map<string, ChargeStanding>()
  for (const u of users) byId.set(u.id, parseChargeStanding(u.charge_standing))
  const byPersonId = standingsByPersonId(rows)
  const byName = new Map<string, ChargeStanding>()
  for (const [k, u] of liveOverArchived(users, (u) => (u.name ? nameKey(u.name) : null))) byName.set(k, parseChargeStanding(u.charge_standing))
  return (personName, personId) => {
    const userId = personId ? personIdToUserId?.get(personId) : undefined
    if (userId && byId.has(userId)) return byId.get(userId)!
    if (personId && !userId && byPersonId.has(personId)) return byPersonId.get(personId)!
    return byName.get(nameKey(personName)) ?? 'none'
  }
}
