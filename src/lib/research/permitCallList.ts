/**
 * Permits, Market: the call list (punch list #405, step two). Five builders to call this week,
 * each with its reasons as tags and no score. The rules here: who may be on the list, what each
 * tag means, the order, the chips over it, and how an answer takes a name off. Every count is
 * defined on the card (`to-dos/permits-market-page/README.md`, How each number is counted), so
 * a hand count can check it. No React, no Supabase.
 */
import { contactParts } from '../../../supabase/functions/_shared/permitLookup'
import { plumbingOnFile, shortDay, shortMoney, ymdPlusDays, type ResearchPermitRow } from './permitResearch'
import { BUILDER_KIND_WORDS, builderName, isBuilderKind, placeOf, type BuilderKind, type BuilderRow } from './permitBuilders'
import { marketPermitsSince, type MarketPermit } from './permitMarket'
import type { SitePermit } from './permitPublic'

// ---------- the answers ----------

export type CallAnswer = 'pursue' | 'not_for_us' | 'back'

/** One row of `builder_call_answers`. */
export type CallAnswerRow = {
  id: string
  builder_key: string
  answer: CallAnswer
  reason: string
  look_again_on: string | null
  city: string
  prospect_id: string | null
  permit_id: string | null
  answered_by: string
  answered_at: string
}

/** What stands on a name: the newest answer that is not a put-back. */
export type CallStanding = {
  answer: 'pursue' | 'not_for_us'
  row: CallAnswerRow
  /** True while the answer keeps the name off the list: until its day to look again, or for good with no day. */
  off: boolean
}

/** A pursued name is offered again after a quarter: by then the lead moved or went cold. */
export const PURSUE_LOOK_AGAIN_DAYS = 90
/** A name passed on is offered again after a year: by then its twelve months of permits are all new. */
export const NOT_FOR_US_LOOK_AGAIN_DAYS = 365

/** The day an answer given today lets the name be offered again. */
export function lookAgainOn(answer: 'pursue' | 'not_for_us', todayYmd: string): string {
  return ymdPlusDays(todayYmd, answer === 'pursue' ? PURSUE_LOOK_AGAIN_DAYS : NOT_FOR_US_LOOK_AGAIN_DAYS)
}

/** The answers folded to one standing per name. The newest row wins, and a put-back leaves none. */
export function foldCallAnswers(rows: readonly CallAnswerRow[], todayYmd: string): Map<string, CallStanding> {
  const newest = new Map<string, CallAnswerRow>()
  for (const r of rows) {
    const held = newest.get(r.builder_key)
    if (!held || r.answered_at > held.answered_at || (r.answered_at === held.answered_at && r.id > held.id)) newest.set(r.builder_key, r)
  }
  const out = new Map<string, CallStanding>()
  for (const [key, row] of newest) {
    if (row.answer === 'back') continue
    out.set(key, { answer: row.answer, row, off: row.look_again_on == null || row.look_again_on > todayYmd })
  }
  return out
}

/** The one-tap reasons Not for us offers. The words are kept, since nothing counts them yet. */
export const NOT_FOR_US_REASONS = ['They file for others', 'Not our kind of work', 'Too far for us', 'Too big for us', 'We know them'] as const

// ---------- reading a name ----------

/** What a name reads as before anyone has said what kind of company it is. */
export type NameReads = 'builder' | 'person' | 'files'

const BUILDS_WORDS = /\b(construction|constructors|contracting|contractors?|builders?|build|building)\b/i
// "Permit" and "expedit" count anywhere in a name, since a permit runner often writes its name as one word.
const FILES_WORDS = /permit|expedit|\b(engineers?|engineering|architects?|architecture|design|designs|consult\w*|survey\w*|drafting|planning)\b/i

/**
 * Whether a name reads as a company that builds. San Antonio's applicant is often a permit
 * runner, an engineer, an architect or one person, and the list is five names long, so a name
 * that reads as a builder comes first. The office's own word, the builder's kind, settles it
 * either way. This orders the list and tags the row. It never removes a name.
 */
export function nameReads(row: Pick<BuilderRow, 'key' | 'name' | 'sample_contact' | 'kind'>): NameReads {
  if (row.kind === 'gc' || row.kind === 'owner' || row.kind === 'developer') return 'builder'
  if (row.kind === 'person') return 'person'
  if (row.kind === 'architect' || row.kind === 'plumber') return 'files'
  const name = builderName(row)
  if (FILES_WORDS.test(name) && !BUILDS_WORDS.test(name)) return 'files'
  return contactParts(name).company != null ? 'builder' : 'person'
}

// ---------- the rows ----------

/** How far back each half of the trend looks. */
export const CALL_TREND_DAYS = 90
/** A name is on the list from this many commercial permits in twelve months. */
export const CALL_MIN_PERMITS = 3
/** How many names a week: one person calls them all. */
export const CALL_WEEK = 5

export type CallTrend = 'picking_up' | 'new_busy' | 'slowing'

/**
 * A name's trend, the last ninety days against the ninety before. New and busy: three or more now
 * and none before. Picking up: two or more more now. Slowing: three or more before and two or more
 * fewer now. A name that is new and busy reads that, not picking up.
 */
export function trendOf(last: number, prior: number): CallTrend | null {
  if (last >= 3 && prior === 0) return 'new_busy'
  if (last - prior >= 2) return 'picking_up'
  if (prior >= 3 && prior - last >= 2) return 'slowing'
  return null
}

/** Whether a city's records reach far enough back to compare two ninety-day halves. */
export function trendKnown(recordsStartYmd: string | null, todayYmd: string): boolean {
  return recordsStartYmd != null && recordsStartYmd <= ymdPlusDays(todayYmd, -2 * CALL_TREND_DAYS)
}

/** A job applied for with no plumbing permit tied to it and no answer that closes it. */
export type OpenJob = { id: string; address: string | null; appliedOn: string | null; work: string | null; value: number | null }

/** The tab's rows that are open now, by the builder that applied. */
export function openJobsByBuilder(rows: readonly ResearchPermitRow[]): Map<string, OpenJob[]> {
  const out = new Map<string, OpenJob[]>()
  for (const r of rows) {
    if (r.stage !== 'applied' || !r.builder_key || plumbingOnFile(r) || placeOf(r).place === 'closed') continue
    const job: OpenJob = { id: r.id, address: r.address, appliedOn: r.submitted_on ?? r.filed_on, work: r.project_name ?? r.work_type, value: r.declared_value }
    out.set(r.builder_key, [...(out.get(r.builder_key) ?? []), job])
  }
  for (const list of out.values()) list.sort((a, b) => (b.appliedOn ?? '').localeCompare(a.appliedOn ?? ''))
  return out
}

/**
 * Whether a city's declared values can be trusted for bands. Where one figure is on a sixth or
 * more of the valued permits, the city fills a default in, and no band is drawn from it.
 */
export function valuesReliable(permits: readonly Pick<MarketPermit, 'declared_value'>[]): boolean {
  const counts = new Map<number, number>()
  let valued = 0
  for (const p of permits) {
    const v = p.declared_value
    if (v == null || !Number.isFinite(v) || v <= 0) continue
    valued += 1
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  if (valued < 20) return false
  let most = 0
  for (const n of counts.values()) most = Math.max(most, n)
  return most * 6 < valued
}

/** One builder on the call list. */
export type CallRow = {
  key: string
  name: string
  kind: BuilderKind | null
  good: boolean
  reads: NameReads
  /** Commercial permits in twelve months, in the last ninety days and in the ninety before. */
  permits: number
  last90: number
  prior90: number
  /** Null when nothing is to say, and when the city's records are too short to say. */
  trend: CallTrend | null
  openJobs: OpenJob[]
  bids: number
  won: number
  lastBidOn: string | null
  /** Permits of $1M or more, where the city's values can be trusted. */
  over1m: number
  /** The middle half of their declared values, on three or more valued permits. */
  typical: { low: number; high: number } | null
  /** The kind of work on half or more of their issued permits. */
  mostly: string | null
  /** An answer whose day to look again has come: the name is offered again, and says so. */
  earlier: CallStanding | null
  builder: BuilderRow
}

function quarter(sorted: readonly number[], share: number): number {
  const at = (sorted.length - 1) * share
  const low = sorted[Math.floor(at)] ?? 0
  const high = sorted[Math.ceil(at)] ?? low
  return low + (high - low) * (at - Math.floor(at))
}

/**
 * The call list, in order.
 *
 * On it: a builder with three or more commercial permits in twelve months. Never a name marked
 * Avoid, a name said to file for others, or a name with an answer that still stands.
 *
 * The order, with no score: a name that reads as a builder, then a job open now, then picking up
 * or new and busy, then never bid, then the most permits in ninety days.
 */
export function callRows(input: {
  builders: readonly BuilderRow[]
  permits: readonly MarketPermit[]
  /** The tab's rows for the city, for the jobs open now. */
  rows: readonly ResearchPermitRow[]
  standings: ReadonlyMap<string, CallStanding>
  recordsStartYmd: string | null
  todayYmd: string
}): CallRow[] {
  const since = marketPermitsSince(input.todayYmd)
  const lastFrom = ymdPlusDays(input.todayYmd, -CALL_TREND_DAYS)
  const priorFrom = ymdPlusDays(input.todayYmd, -2 * CALL_TREND_DAYS)
  const known = trendKnown(input.recordsStartYmd, input.todayYmd)
  const reliable = valuesReliable(input.permits)
  type Tally = { permits: number; last90: number; prior90: number; values: number[]; work: Map<string, number>; issued: number }
  const tallies = new Map<string, Tally>()
  for (const p of input.permits) {
    const day = p.issued_on ?? p.submitted_on
    if (!p.builder_key || !day || day < since) continue
    const t = tallies.get(p.builder_key) ?? { permits: 0, last90: 0, prior90: 0, values: [], work: new Map<string, number>(), issued: 0 }
    tallies.set(p.builder_key, t)
    t.permits += 1
    if (day >= lastFrom) t.last90 += 1
    else if (day >= priorFrom) t.prior90 += 1
    if (p.declared_value != null && p.declared_value > 0) t.values.push(p.declared_value)
    if (p.stage !== 'applied' && p.work_type) {
      t.issued += 1
      t.work.set(p.work_type, (t.work.get(p.work_type) ?? 0) + 1)
    }
  }
  const open = openJobsByBuilder(input.rows)
  const out: CallRow[] = []
  for (const b of input.builders) {
    const t = tallies.get(b.key)
    if (!t || t.permits < CALL_MIN_PERMITS) continue
    if (b.mark === 'avoid' || b.kind === 'files_for_others') continue
    const standing = input.standings.get(b.key) ?? null
    if (standing?.off) continue
    const values = reliable ? [...t.values].sort((x, y) => x - y) : []
    let mostly: string | null = null
    for (const [work, n] of t.work) if (n * 2 >= t.issued && (mostly == null || n > (t.work.get(mostly) ?? 0))) mostly = work
    out.push({
      key: b.key,
      name: builderName(b),
      kind: isBuilderKind(b.kind) ? b.kind : null,
      good: b.mark === 'good',
      reads: nameReads(b),
      permits: t.permits,
      last90: t.last90,
      prior90: t.prior90,
      trend: known ? trendOf(t.last90, t.prior90) : null,
      openJobs: open.get(b.key) ?? [],
      bids: b.bids,
      won: b.won,
      lastBidOn: b.last_bid_on,
      over1m: values.filter((v) => v >= 1_000_000).length,
      typical: values.length >= 3 ? { low: quarter(values, 0.25), high: quarter(values, 0.75) } : null,
      mostly,
      earlier: standing,
      builder: b,
    })
  }
  const up = (r: CallRow) => r.trend === 'picking_up' || r.trend === 'new_busy'
  return out.sort(
    (a, b) =>
      Number(b.reads === 'builder') - Number(a.reads === 'builder') ||
      Number(b.openJobs.length > 0) - Number(a.openJobs.length > 0) ||
      Number(up(b)) - Number(up(a)) ||
      Number(b.bids === 0) - Number(a.bids === 0) ||
      b.last90 - a.last90 ||
      b.permits - a.permits ||
      a.name.localeCompare(b.name),
  )
}

// ---------- the chips ----------

export type CallShowing = 'week' | 'open' | 'picking_up' | 'new_busy' | 'never_bid' | 'over_1m'
export const CALL_SHOWING_WORDS: Record<CallShowing, string> = { week: 'This week', open: 'Has a job open now', picking_up: 'Picking up', new_busy: 'New and busy', never_bid: 'Never bid', over_1m: 'Jobs over $1M' }

function onChip(r: CallRow, showing: CallShowing): boolean {
  if (showing === 'open') return r.openJobs.length > 0
  if (showing === 'picking_up') return r.trend === 'picking_up'
  if (showing === 'new_busy') return r.trend === 'new_busy'
  if (showing === 'never_bid') return r.bids === 0
  if (showing === 'over_1m') return r.over1m > 0
  return true
}

/** The rows one chip shows, in the list's own order. This week is the first five. */
export function callRowsShowing(rows: readonly CallRow[], showing: CallShowing): CallRow[] {
  return showing === 'week' ? rows.slice(0, CALL_WEEK) : rows.filter((r) => onChip(r, showing))
}

export function callChipCounts(rows: readonly CallRow[]): Record<CallShowing, number> {
  const count = (s: CallShowing) => callRowsShowing(rows, s).length
  return { week: count('week'), open: count('open'), picking_up: count('picking_up'), new_busy: count('new_busy'), never_bid: count('never_bid'), over_1m: count('over_1m') }
}

/**
 * The chips a city draws. A chip the city's records cannot fill is left out: no trend where the
 * records are shorter than two ninety-day halves, no open jobs where the feed has no
 * applications, no $1M chip where the values cannot be trusted.
 */
export function callChips(input: { trendKnown: boolean; hasApplications: boolean; valuesReliable: boolean }): CallShowing[] {
  const out: CallShowing[] = ['week']
  if (input.hasApplications) out.push('open')
  if (input.trendKnown) out.push('picking_up', 'new_busy')
  out.push('never_bid')
  if (input.valuesReliable) out.push('over_1m')
  return out
}

// ---------- the words ----------

export type CallTag = { words: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'grey' }

const TREND_WORDS: Record<CallTrend, CallTag> = {
  picking_up: { words: 'Picking up', tone: 'green' },
  new_busy: { words: 'New and busy', tone: 'green' },
  slowing: { words: 'Slowing', tone: 'grey' },
}

/** How many bids with no win it takes before the tag turns red, as the table of companies has it. */
const NO_WIN_RED_BIDS = 3

/** A row's reasons, as tags: why it is here, our history with it, and what it may be. */
export function callTags(row: CallRow, todayYmd: string): CallTag[] {
  const tags: CallTag[] = []
  if (row.trend) tags.push(TREND_WORDS[row.trend])
  if (row.bids === 0) tags.push({ words: 'Never bid', tone: 'blue' })
  else tags.push({ words: `We bid ${row.bids}, won ${row.won}`, tone: row.won > 0 ? 'green' : row.bids >= NO_WIN_RED_BIDS ? 'red' : 'amber' })
  if (row.openJobs.length > 0) tags.push({ words: `${row.openJobs.length} job${row.openJobs.length === 1 ? '' : 's'} open now`, tone: 'amber' })
  if (row.good) tags.push({ words: 'Good', tone: 'green' })
  if (row.kind) tags.push({ words: BUILDER_KIND_WORDS[row.kind], tone: 'grey' })
  else if (row.reads === 'files') tags.push({ words: 'May file for others', tone: 'grey' })
  else if (row.reads === 'person') tags.push({ words: 'Could be a person', tone: 'grey' })
  if (row.earlier) tags.push({ words: `${row.earlier.answer === 'pursue' ? 'Pursued' : 'Passed'} ${shortDay(row.earlier.row.answered_at.slice(0, 10), todayYmd)}`, tone: 'grey' })
  return tags
}

/** "14 permits in the last year, 6 in the last 90 days against 2 in the 90 before." `reach` is `reachWords`. */
export function callCountWords(row: Pick<CallRow, 'permits' | 'last90' | 'prior90'>, reach: string | null, known: boolean): string {
  const first = `${row.permits} permit${row.permits === 1 ? '' : 's'} ${reach ?? 'we can see'}`
  return known ? `${first}, ${row.last90} in the last ${CALL_TREND_DAYS} days against ${row.prior90} in the ${CALL_TREND_DAYS} before.` : `${first}.`
}

/** "Mostly commercial remodels. Typical job $400k to $1.2M." Null when neither can be said. */
export function callWorkWords(row: Pick<CallRow, 'mostly' | 'typical'>): string | null {
  const parts: string[] = []
  if (row.mostly) parts.push(`Mostly ${row.mostly.toLowerCase()}.`)
  const low = row.typical ? shortMoney(row.typical.low) : null
  const high = row.typical ? shortMoney(row.typical.high) : null
  if (low && high) parts.push(low === high ? `Typical job ${low}.` : `Typical job ${low} to ${high}.`)
  return parts.length > 0 ? parts.join(' ') : null
}

/** "We priced 4 of their jobs and won none. The last was Jun 3." Null when we never bid them. */
export function callHistoryWords(row: Pick<CallRow, 'bids' | 'won' | 'lastBidOn'>, todayYmd: string): string | null {
  if (row.bids === 0) return null
  const priced = `We priced ${row.bids} of their job${row.bids === 1 ? '' : 's'} and won ${row.won === 0 ? 'none' : row.won}.`
  return row.lastBidOn ? `${priced} The last was ${shortDay(row.lastBidOn, todayYmd)}.` : priced
}

/** The two tiles the list fills: how many to call this week, and their jobs open now. */
export function callTiles(week: readonly CallRow[]): Array<{ value: string; words: string }> {
  const open = week.reduce((n, r) => n + r.openJobs.length, 0)
  return [
    { value: String(week.length), words: week.length === 1 ? 'builder to call this week' : 'builders to call this week' },
    { value: String(open), words: open === 1 ? 'of their jobs is applied for, with no plumber yet' : 'of their jobs are applied for, with no plumber yet' },
  ]
}

/**
 * What an empty list says. A city that publishes no applicant names no builder. A city whose
 * list is all answered says so, and a chip that holds nothing says what would fill it.
 */
export function callEmptyWords(input: { city: string; builders: number; eligible: number; showing: CallShowing }): string {
  if (input.builders === 0) return `${input.city} publishes no applicant on its permits, so no builder can be named here.`
  if (input.eligible === 0) return `Nothing waiting on a call. Every builder with ${CALL_MIN_PERMITS} or more permits here is answered.`
  return `Nothing waiting on a call under ${CALL_SHOWING_WORDS[input.showing]}.`
}

/** The line under the list: what the order is, and what a city's records leave out. */
export function callNoteWords(input: { city: string; trendKnown: boolean; hasApplications: boolean; recordsStart: string | null }): string {
  const order = 'Names that read as a builder come first, then a job open now, then picking up or new, then never bid.'
  const short = input.trendKnown ? '' : ` ${input.city}’s records${input.recordsStart ? ` start ${input.recordsStart}` : ' are short'}, so nothing here reads as picking up or new yet.`
  const issued = input.hasApplications ? '' : ` ${input.city} shows only issued permits, so no job is open here by the time we see it.`
  return `${order}${short}${issued}`
}

/** The toast after an answer: what happened and when the name may come back. */
export function answeredWords(name: string, answer: 'pursue' | 'not_for_us', lookAgain: string, todayYmd: string): string {
  const back = `It may be offered again after ${shortDay(lookAgain, todayYmd)}.`
  return answer === 'pursue' ? `${name} is off the list while you pursue them. ${back}` : `${name} is off the list. ${back}`
}

/** One answered name, for the list under the call list: what was said, by whom, and until when. */
export function standingWords(standing: CallStanding, nameOf: (userId: string) => string | null, todayYmd: string): string {
  const who = nameOf(standing.row.answered_by) ?? 'someone'
  const said = standing.answer === 'pursue' ? 'Pursuing' : 'Not for us'
  const why = standing.row.reason.trim() ? `, ${standing.row.reason.trim()}` : ''
  const until = standing.row.look_again_on ? `Off the list until ${shortDay(standing.row.look_again_on, todayYmd)}.` : 'Off the list.'
  return `${said}${why}. ${who}, ${shortDay(standing.row.answered_at.slice(0, 10), todayYmd)}. ${until}`
}

// ---------- pursue ----------

/**
 * The permit a pursue's lead is made from: the newest job open now, else the newest permit of
 * theirs the tab holds. Null when the tab holds none, which is a builder whose year is all
 * history: the caller then reads their newest permit and passes it through `permitRowOfSite`.
 */
export function pursuePermit(row: Pick<CallRow, 'key' | 'openJobs'>, rows: readonly ResearchPermitRow[]): ResearchPermitRow | null {
  const open = row.openJobs[0]
  const job = open ? rows.find((r) => r.id === open.id) : undefined
  if (job) return job
  let newest: ResearchPermitRow | null = null
  for (const r of rows) if (r.builder_key === row.key && (newest == null || (r.filed_on ?? '') > (newest.filed_on ?? ''))) newest = r
  return newest
}

/** A permit read off `permits` as the row a lead is made from: what the feed gave, with nothing said about it. */
export function permitRowOfSite(city: string, p: SitePermit, builder: Pick<BuilderRow, 'key' | 'name' | 'kind'>): ResearchPermitRow {
  return {
    id: p.id,
    city,
    source: '',
    permit_number: p.permit_number,
    permit_type: p.permit_type,
    stage: p.stage === 'applied' ? 'applied' : 'issued',
    residential: false,
    work_type: p.work_type,
    project_name: null,
    address: p.address,
    zip: null,
    lat: null,
    lng: null,
    submitted_on: p.submitted_on,
    issued_on: p.issued_on,
    filed_on: p.issued_on ?? p.submitted_on,
    declared_value: p.declared_value,
    area_sf: null,
    contact: p.contact,
    plumber: null,
    plumber_permit_on: null,
    verdict: null,
    verdict_reason: null,
    verdict_look_again_on: null,
    verdict_prospect_id: null,
    verdict_by: null,
    verdict_by_name: null,
    verdict_at: null,
    builder_key: builder.key,
    builder_name: builder.name,
    builder_kind: builder.kind,
  }
}

/** The reason kept on the answer and on the permit when a name is pursued from the list. */
export const PURSUED_FROM_LIST = 'Pursued from the call list.'

/** What Ask for says until a name is looked up, and what the press beside it does. */
export const ASK_FOR_EMPTY = { main: 'Nobody looked this name up yet.', tail: 'opens a search for who to ask for.' } as const
