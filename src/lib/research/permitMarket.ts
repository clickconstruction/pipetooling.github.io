/**
 * Permits, the Market view (punch list #405, step one): the rules behind the table of companies
 * we bid and the clock. The table turns Builders around. Builders lists every name on a city's
 * permits with our bids beside it. This lists every company we priced a job for in two years,
 * with the permits its names pulled in every city the pull reads, and says what that reads as.
 * The clock is the quarter marks of the days between two dates on a permit. Every count here is
 * defined on the card (`to-dos/permits-market-page/README.md`, How each number is counted), so a
 * hand count can check it. No React, no Supabase.
 */
import { nameKey } from '../../../supabase/functions/_shared/permitLookup'
import { isZzBidName, isZzTestName } from '../../../supabase/functions/_shared/zzTestJob'
import { ymdPlusDays, type ResearchPermitRow } from './permitResearch'
import { builderName, type BuilderRow } from './permitBuilders'
import type { AnswerBook } from './builderAnswers'
import { lookAlikePairs, type PermitName } from './nameLikeness'
import { nameGrade } from './nameAnswers'
import { daysBetween } from './permitSkim'

// ---------- the companies we bid ----------

/** How far back a bid counts: two years. */
export const MARKET_BID_DAYS = 730
/** How far back a permit counts: twelve months, as `research_builders` counts a builder's. */
export const MARKET_PERMIT_DAYS = 365

/** The first day a bid counts from. */
export function marketBidsSince(todayYmd: string): string {
  return ymdPlusDays(todayYmd, -MARKET_BID_DAYS)
}

/** The first day a permit counts from. */
export function marketPermitsSince(todayYmd: string): string {
  return ymdPlusDays(todayYmd, -MARKET_PERMIT_DAYS)
}

/** One of our bids as the table reads it: who it was priced for, how it ended, and the day it was made. */
export type MarketBid = {
  id: string
  customerId: string | null
  customerName: string | null
  /** The old builders list's name on the bid, when it has one. */
  gcName: string | null
  outcome: string | null
  bidOn: string | null
  projectName: string | null
}

/** The outcomes that count as won, as `research_builders` counts them. */
const WON = new Set(['won', 'started_or_complete'])

/**
 * The bid platforms a catch-all customer is named for, as its name key starts. A bid found on a
 * platform with no GC chosen yet sits under a customer of the platform's name. That customer is
 * a bucket and not a company, so it is no row of the table.
 */
const BID_PLATFORM_KEYS = ['planhub', 'buildingconnected', 'constructconnect', 'isqft', 'smartbid', 'bidnet', 'buildingblok', 'civcast', 'demandstar'] as const

/** A customer named for a bid platform: the bucket its bids sit under until a GC is chosen. */
export function isBidPlatformBucket(name: string | null | undefined): boolean {
  const key = nameKey(name)
  return key != null && BID_PLATFORM_KEYS.some((p) => key.startsWith(p))
}

/** One city's Builders rows, as `research_builders` returns them. */
export type CityBuilders = { city: string; rows: readonly BuilderRow[] }

/** What a company's bids and permits read as. */
export type BidCompanyReads = 'wins' | 'never_win' | 'early' | 'no_permit'

/** Where a company's permits are: one name on one city's permits. */
export type BidCompanyPermits = { city: string; builderKey: string; name: string; permits: number; tied: boolean }

/** One company we priced a job for in two years. */
export type BidCompany = {
  /** The company's name as permits are keyed (`research_name_key`). */
  key: string
  name: string
  /** Our customer rows of this name. Empty when the name is only on the old builders list. */
  customerIds: string[]
  bids: number
  won: number
  lastBidOn: string | null
  /** Commercial permits in twelve months, in every city, under the key or a name a person tied to the customer. */
  permits: number
  /** Where they are, the most first. */
  sources: BidCompanyPermits[]
  reads: BidCompanyReads
  /** With no permit on record, for a customer of ours: a name on the permits that begins this one, or is begun by it. */
  looksLike: string | null
}

/** How many bids with no win it takes before the table says we never win. Fewer is too early to say. */
export const NEVER_WIN_MIN_BIDS = 3

function readsOf(c: Pick<BidCompany, 'bids' | 'won' | 'permits'>): BidCompanyReads {
  if (c.permits === 0) return 'no_permit'
  if (c.won > 0) return 'wins'
  return c.bids >= NEVER_WIN_MIN_BIDS ? 'never_win' : 'early'
}

type Tally = { key: string; names: Map<string, number>; customerIds: Set<string>; bidIds: Set<string>; won: number; lastBidOn: string | null }

/** The spelling used most, the first seen on a tie. */
function mostUsed(names: ReadonlyMap<string, number>): string {
  let best = ''
  let n = 0
  for (const [name, count] of names) {
    if (count > n) {
      best = name
      n = count
    }
  }
  return best
}

/**
 * Every company we priced a job for in two years, with the permits its names pulled.
 *
 * - A bid counts under its customer's name and under the old builders list's name on it, each
 *   keyed as permits are. One bid under two names of one key counts once.
 * - Left out: a practice bid (the ZZ convention), a ZZ customer, and a customer named for a bid
 *   platform.
 * - The permits are each city's Builders count under the company's key, plus the count under
 *   every name a person tied to the customer for all of its permits.
 * - A customer of ours with no permit on record gets a name on the permits that begins its own,
 *   or is begun by it, when there is one (`nameGrade`'s *likely*, the grade a builder's sheet asks
 *   *Same company?* on). The row then says the name may be theirs. Nothing is tied on a likeness.
 */
export function bidCompanies(input: { bids: readonly MarketBid[]; builders: readonly CityBuilders[]; book: AnswerBook | null; todayYmd: string }): BidCompany[] {
  const since = marketBidsSince(input.todayYmd)
  const tallies = new Map<string, Tally>()
  for (const b of input.bids) {
    if (isZzBidName(b.projectName)) continue
    if (b.bidOn != null && (b.bidOn < since || b.bidOn > input.todayYmd)) continue
    const seen = new Set<string>()
    const parties: Array<{ name: string | null; customerId: string | null }> = [
      { name: b.customerName, customerId: b.customerId },
      { name: b.gcName, customerId: null },
    ]
    for (const p of parties) {
      const name = (p.name ?? '').trim()
      if (name === '' || isZzTestName(name) || isBidPlatformBucket(name)) continue
      const key = nameKey(name)
      if (!key) continue
      const t = tallies.get(key) ?? { key, names: new Map<string, number>(), customerIds: new Set<string>(), bidIds: new Set<string>(), won: 0, lastBidOn: null }
      tallies.set(key, t)
      // The customer's own spelling leads the old list's: it is the one the office keeps.
      t.names.set(name, (t.names.get(name) ?? 0) + (p.customerId ? 1000 : 1))
      if (p.customerId) t.customerIds.add(p.customerId)
      if (seen.has(key) || t.bidIds.has(b.id)) continue
      seen.add(key)
      t.bidIds.add(b.id)
      if (WON.has(b.outcome ?? '')) t.won += 1
      if (b.bidOn && b.bidOn > (t.lastBidOn ?? '')) t.lastBidOn = b.bidOn
    }
  }

  // Each name on the permits, by key: where it is and how many.
  const onPermits = new Map<string, BidCompanyPermits[]>()
  for (const c of input.builders) {
    for (const r of c.rows) {
      if (r.permits <= 0) continue
      onPermits.set(r.key, [...(onPermits.get(r.key) ?? []), { city: c.city, builderKey: r.key, name: builderName(r), permits: r.permits, tied: false }])
    }
  }
  // The names a person tied to each customer, for all of their permits.
  const tiedTo = new Map<string, Set<string>>()
  for (const [builderKey, groups] of input.book?.tied ?? []) {
    for (const g of groups) tiedTo.set(g.key, new Set([...(tiedTo.get(g.key) ?? []), builderKey]))
  }

  const out: BidCompany[] = []
  for (const t of tallies.values()) {
    const sources: BidCompanyPermits[] = [...(onPermits.get(t.key) ?? [])]
    for (const builderKey of tiedTo.get(t.key) ?? []) {
      if (builderKey === t.key) continue
      for (const s of onPermits.get(builderKey) ?? []) sources.push({ ...s, tied: true })
    }
    sources.sort((a, b) => b.permits - a.permits || a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
    const permits = sources.reduce((n, s) => n + s.permits, 0)
    const bids = t.bidIds.size
    // Our customer rows of this name, the ones with no bid in the window too: a tie is written on a row.
    const group = input.book?.groups.find((g) => g.key === t.key)
    const customerIds = [...new Set([...t.customerIds, ...(group?.ids ?? [])])]
    out.push({ key: t.key, name: mostUsed(t.names), customerIds, bids, won: t.won, lastBidOn: t.lastBidOn, permits, sources, reads: readsOf({ bids, won: t.won, permits }), looksLike: null })
  }

  // A name on the permits that may be theirs, for our customers with no permit on record. A name
  // only on the old builders list has no customer row to write a tie on, so none is offered.
  const bare = out.filter((c) => c.permits === 0 && c.customerIds.length > 0)
  if (bare.length > 0) {
    const names = new Map<string, PermitName>()
    for (const c of input.builders) {
      for (const r of c.rows) {
        const held = names.get(r.key)
        if (held) names.set(r.key, { ...held, permits: held.permits + r.permits })
        else names.set(r.key, { key: r.key, name: builderName(r), permits: r.permits, lastOn: r.last_permit_on, kind: r.kind })
      }
    }
    // A name someone already answered for the customer, either way, is not offered again.
    const settled = new Map<string, Set<string>>()
    for (const c of bare) {
      const said = new Set<string>()
      for (const s of input.book?.states.get(c.key)?.values() ?? []) if (s.all || s.someoneElse) said.add(s.key)
      settled.set(c.key, said)
    }
    const pairs = lookAlikePairs(bare.map((c) => ({ id: c.key, name: c.name })), [...names.values()], new Map(), settled, bare.length * 50)
    const best = new Map<string, string>()
    for (const p of pairs) if (!best.has(p.customerId) && nameGrade(p.suggestion.name, p.customerName) === 'likely') best.set(p.customerId, p.suggestion.name)
    for (const c of bare) c.looksLike = best.get(c.key) ?? null
  }

  return out.sort((a, b) => b.permits - a.permits || b.bids - a.bids || a.name.localeCompare(b.name))
}

/** The three chips over the table. */
export type BidCompanyShowing = 'builds' | 'no_permit' | 'tie'
export const BID_COMPANY_SHOWING: readonly BidCompanyShowing[] = ['builds', 'no_permit', 'tie']
export const BID_COMPANY_SHOWING_WORDS: Record<BidCompanyShowing, string> = { builds: 'Builds here', no_permit: 'No permit on record', tie: 'Tie a name' }

function shows(c: BidCompany, showing: BidCompanyShowing): boolean {
  if (showing === 'builds') return c.permits > 0
  if (showing === 'no_permit') return c.permits === 0
  return c.permits === 0 && c.looksLike != null
}

/** The rows one chip shows, in the table's own order. */
export function bidCompaniesShowing(rows: readonly BidCompany[], showing: BidCompanyShowing): BidCompany[] {
  return rows.filter((c) => shows(c, showing))
}

export function bidCompanyChipCounts(rows: readonly BidCompany[]): Record<BidCompanyShowing, number> {
  return { builds: bidCompaniesShowing(rows, 'builds').length, no_permit: bidCompaniesShowing(rows, 'no_permit').length, tie: bidCompaniesShowing(rows, 'tie').length }
}

export type ReadsWords = { tag: string; tone: 'green' | 'red' | 'amber' | 'grey'; hint: string }

const TRIES = ['', 'one try', 'two tries']

/** The tag in the Reads as column, and the few words after it. */
export function readsWords(c: Pick<BidCompany, 'reads' | 'bids' | 'looksLike'>): ReadsWords {
  if (c.reads === 'wins') return { tag: 'Builds, and we win', tone: 'green', hint: 'keep close' }
  if (c.reads === 'never_win') return { tag: 'Builds, we never win', tone: 'red', hint: 'ask why' }
  if (c.reads === 'early') return { tag: `Builds, ${TRIES[c.bids] ?? `${c.bids} tries`}`, tone: 'amber', hint: 'too early to say' }
  return { tag: 'No permit on record', tone: 'grey', hint: c.looksLike ? `${c.looksLike} on the permits may be them` : 'may build elsewhere, or file under another name' }
}

/** "San Antonio 9 · Austin 2", and "under Ridgeway Permits" where a tied name pulled them. */
export function permitsWhereWords(c: Pick<BidCompany, 'sources'>): string | null {
  if (c.sources.length === 0) return null
  const byCity = new Map<string, number>()
  for (const s of c.sources) byCity.set(s.city, (byCity.get(s.city) ?? 0) + s.permits)
  const where = [...byCity.entries()].map(([city, n]) => `${city} ${n}`).join(' · ')
  const tied = [...new Set(c.sources.filter((s) => s.tied).map((s) => s.name))]
  if (tied.length === 0) return where
  return `${where} · under ${tied.length > 2 ? `${tied.length} tied names` : tied.join(' and ')}`
}

/** The first tile: how many of the companies we bid pulled a permit. */
export function builtTile(rows: readonly BidCompany[]): { value: string; words: string } {
  const built = rows.filter((c) => c.permits > 0).length
  return { value: `${built} of ${rows.length}`, words: rows.length === 1 ? 'company we bid pulled a permit here' : 'companies we bid pulled a permit here' }
}

// ---------- the clock ----------

/** The quarter marks of a list of days: a quarter are at or under `q1`, half at or under `median`, three quarters at or under `q3`. */
export type ClockSpread = { n: number; q1: number; median: number; q3: number }

/** Fewer than this many jobs is too few to draw a clock on. */
export const CLOCK_MIN_JOBS = 5

function markAt(sorted: readonly number[], share: number): number {
  const at = (sorted.length - 1) * share
  const low = Math.floor(at)
  const high = Math.ceil(at)
  const a = sorted[low] ?? 0
  const b = sorted[high] ?? a
  return Math.round(a + (b - a) * (at - low))
}

/** The quarter marks and the middle, in whole days. Null on fewer than `CLOCK_MIN_JOBS`. */
export function clockSpread(days: readonly number[]): ClockSpread | null {
  const sorted = days.filter((d) => Number.isFinite(d) && d >= 0).sort((a, b) => a - b)
  if (sorted.length < CLOCK_MIN_JOBS) return null
  return { n: sorted.length, q1: markAt(sorted, 0.25), median: markAt(sorted, 0.5), q3: markAt(sorted, 0.75) }
}

/** A permit's two days, as the clock reads an application. */
export type ClockPermit = { stage: string; submitted_on: string | null; issued_on: string | null }

/**
 * One commercial building permit of a city's last twelve months, as the Market view reads it off
 * `permits`. The rows read back as history are among them: the skim's read leaves those out, and
 * most of a year is history. The call list, the clock and the charts all count these.
 */
export type MarketPermit = ClockPermit & { builder_key: string | null; work_type: string | null; declared_value: number | null }

/**
 * Application to permit: the applications submitted in twelve months that carry an issued day,
 * and the days between the two. An application still waiting has no second day and is left out,
 * so the newest months read a little short.
 */
export function applicationClockDays(rows: readonly ClockPermit[], todayYmd: string): number[] {
  const since = marketPermitsSince(todayYmd)
  const out: number[] = []
  for (const r of rows) {
    if (r.stage !== 'applied' || !r.submitted_on || !r.issued_on || r.submitted_on < since || r.submitted_on > todayYmd) continue
    const days = daysBetween(r.submitted_on, r.issued_on)
    if (days != null && days >= 0) out.push(days)
  }
  return out
}

/**
 * Building permit to the plumber's permit: the building permits of twelve months with a plumbing
 * permit that counts for the job (`plumber_permit_on`, which the read sets by
 * `permit_address_plumbing_counts`), and the days from the building permit's day to it. A
 * plumbing permit dated before the building permit reads as none: the job was taken the day the
 * city showed it. The read keeps the newest plumbing permit's day, so a job with two is measured
 * to its later one.
 */
export function plumberClockDays(rows: ReadonlyArray<Pick<ResearchPermitRow, 'filed_on' | 'plumber_permit_on'>>, todayYmd: string): number[] {
  const since = marketPermitsSince(todayYmd)
  const out: number[] = []
  for (const r of rows) {
    if (!r.filed_on || !r.plumber_permit_on || r.filed_on < since) continue
    const days = daysBetween(r.filed_on, r.plumber_permit_on)
    if (days != null) out.push(Math.max(0, days))
  }
  return out
}

/** Which two dates a clock runs between. */
export type ClockKind = 'application' | 'plumber'

/** One clock as the screen draws it. */
export type MarketClock = { kind: ClockKind; city: string; spread: ClockSpread }

/** "45 days", "1 day", "the same day". */
export function clockDaysWords(days: number): string {
  if (days <= 0) return 'the same day'
  return `${days} day${days === 1 ? '' : 's'}`
}

/** "about 6 weeks" from two weeks up, else the days. */
export function aboutWeeksWords(days: number): string {
  if (days < 14) return clockDaysWords(days)
  const weeks = Math.round(days / 7)
  return `about ${weeks} weeks`
}

/** The line over a clock: which city, and which two dates. */
export function clockTitle(clock: Pick<MarketClock, 'kind' | 'city'>): string {
  return clock.kind === 'application' ? `${clock.city} · application to permit` : `${clock.city} · building permit to the plumber’s permit`
}

/** The note under a clock: what the days mean for a call. */
export function clockNote(clock: MarketClock): string {
  const { q1, median, q3, n } = clock.spread
  const jobs = `${n.toLocaleString('en-US')} ${clock.kind === 'application' ? 'applications' : 'jobs'}`
  const middle = `The middle half took ${q1} to ${q3} days, over ${jobs}.`
  if (clock.kind === 'application') {
    const wait = median <= 0 ? 'Half of the applications get their permit the same day.' : `Half of the applications wait ${clockDaysWords(median)} or more for the permit.`
    return `${wait} That is the time to call in. ${middle}`
  }
  const taken = median <= 0 ? 'Half of the jobs have a plumber’s permit by the day of the building permit.' : `Half of the jobs have a plumber’s permit within ${clockDaysWords(median)} of the building permit.`
  return `${taken} The job is taken by the time the city shows it. Read ${clock.city} for who builds. ${middle}`
}

/** How far the clock's bar reaches: 120 days, or past the widest third quarter in steps of 30. */
export function clockScaleDays(clocks: readonly MarketClock[]): number {
  const widest = clocks.reduce((n, c) => Math.max(n, c.spread.q3), 0)
  return Math.max(120, Math.ceil(widest / 30) * 30)
}

/** Where a day sits on the bar, 0 to 100. */
export function clockAt(days: number, scaleDays: number): number {
  if (scaleDays <= 0) return 0
  return Math.max(0, Math.min(100, (days / scaleDays) * 100))
}

/**
 * The clocks a city's page draws. Application to permit where the city's applications carry an
 * issued day. Building permit to the plumber's permit only where the city's permits name
 * plumbers: where they never do, nothing is drawn about plumbers.
 */
export function marketClocks(input: { city: string; applications: readonly ClockPermit[]; rows: ReadonlyArray<Pick<ResearchPermitRow, 'filed_on' | 'plumber_permit_on'>>; namesPlumbers: boolean; todayYmd: string }): MarketClock[] {
  const out: MarketClock[] = []
  const application = clockSpread(applicationClockDays(input.applications, input.todayYmd))
  if (application) out.push({ kind: 'application', city: input.city, spread: application })
  const plumber = input.namesPlumbers ? clockSpread(plumberClockDays(input.rows, input.todayYmd)) : null
  if (plumber) out.push({ kind: 'plumber', city: input.city, spread: plumber })
  return out
}

/** The clock's tile: the middle wait of the city's first clock. Null when no clock is drawn. */
export function clockTile(clocks: readonly MarketClock[]): { value: string; words: string } | null {
  const first = clocks[0]
  if (!first) return null
  if (first.kind === 'application') return { value: aboutWeeksWords(first.spread.median).replace(/^about /, '~'), words: 'from an application to its permit' }
  return { value: clockDaysWords(first.spread.median), words: 'from a building permit to the plumber’s permit' }
}
