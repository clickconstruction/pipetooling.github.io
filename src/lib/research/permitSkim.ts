/**
 * Permits, the skim (punch list #302): the pure rules behind step one. Which permits are in the
 * deck, the best-first order with the words that say why a card sits where it does, the lines a
 * card reads, the two answers and the verdict each one writes, the one-tap pass reasons, the keys
 * a desk uses, and the words of the caught-up state. No React, no Supabase.
 */
import { haversineMeters, TRAVEL_ROAD_WINDING_FACTOR, type LatLng } from '../jobTravelEstimate'
import { hintFor, rowLens, rowsAboveFloor, shortMoney, sqFtWords, type ContactHistory, type Hint, type PermitVerdict, type ResearchPermitRow, type ValueFloor } from './permitResearch'

const METERS_PER_MILE = 1609.344

/** Our own mark on a builder, once builders exist; the skim reads it and never sets it. */
export type BuilderMark = 'good' | 'avoid'

/** What the score reads beside the row itself. */
export type SkimContext = {
  todayYmd: string
  office: LatLng | null
  history: ReadonlyMap<string, ContactHistory>
  /** A builder's mark by the row's id, when one is set. */
  marks?: ReadonlyMap<string, BuilderMark>
  /** Rows whose name only files permits for others. */
  filesForOthers?: ReadonlySet<string>
}

/** Driven miles from the office, estimated from the straight line, whole miles; null with no point or no office. */
export function milesFromOffice(row: Pick<ResearchPermitRow, 'lat' | 'lng'>, office: LatLng | null): number | null {
  if (!office || row.lat == null || row.lng == null) return null
  const miles = (haversineMeters(office, { lat: row.lat, lng: row.lng }) * TRAVEL_ROAD_WINDING_FACTOR) / METERS_PER_MILE
  return Number.isFinite(miles) ? Math.max(1, Math.round(miles)) : null
}

export function milesWords(miles: number | null): string | null {
  if (miles == null) return null
  return `${miles} mile${miles === 1 ? '' : 's'} from the office`
}

/** Whole days between two YYYY-MM-DD days; null when either is missing. */
export function daysBetween(fromYmd: string | null, toYmd: string): number | null {
  if (!fromYmd) return null
  const a = Date.parse(`${fromYmd}T00:00:00Z`)
  const b = Date.parse(`${toYmd}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

/** "applied 4 days ago", "issued today". */
export function filedWords(row: Pick<ResearchPermitRow, 'stage' | 'filed_on'>, todayYmd: string): string {
  const verb = row.stage === 'issued' ? 'issued' : 'applied'
  const days = daysBetween(row.filed_on, todayYmd)
  if (days == null) return verb
  if (days <= 0) return `${verb} today`
  if (days === 1) return `${verb} yesterday`
  return `${verb} ${days} days ago`
}

/** The card's title: the feed's project name when it says something, else the work and its size. */
export function skimTitle(row: Pick<ResearchPermitRow, 'project_name' | 'work_type' | 'area_sf' | 'address'>): string {
  const name = (row.project_name ?? '').replace(/\s+/g, ' ').trim()
  const useful = name !== '' && !/^Building No:/i.test(name) && name.toLowerCase() !== (row.address ?? '').toLowerCase()
  const size = sqFtWords(row.area_sf)
  if (useful) return size ? `${name}, ${size}` : name
  return [row.work_type ?? 'Permit', size].filter(Boolean).join(', ')
}

/** The money line: "$1.4M declared" or "Value not declared". */
export function skimMoney(row: Pick<ResearchPermitRow, 'declared_value'>): string {
  const money = shortMoney(row.declared_value)
  return money ? `${money} declared` : 'Value not declared'
}

type Point = { points: number; words: string }

/** One permit as the deck holds it: its score, the line that says why, and what the card reads. */
export type SkimCard = {
  row: ResearchPermitRow
  score: number
  why: string
  miles: number | null
  hint: Hint
  mark: BuilderMark | null
}

/**
 * How likely a permit is to be work we want, as a number to sort on. Every card in the deck has
 * no plumber yet, so that is the first word and carries no points. The rest: our history with the
 * name, the builder's mark, the declared value, the kind of work, the miles, and how old it is.
 * The order is a hint. Every card is still seen and answered.
 */
export function skimScore(row: ResearchPermitRow, ctx: SkimContext): SkimCard {
  const plus: Point[] = []
  const minus: Point[] = []
  const hint = hintFor(row.contact, ctx.history)
  const mark = ctx.marks?.get(row.id) ?? null
  const miles = milesFromOffice(row, ctx.office)

  if (mark === 'good') plus.push({ points: 4, words: 'a builder marked Good' })
  if (mark === 'avoid') minus.push({ points: 6, words: 'a builder marked Avoid' })
  if (ctx.filesForOthers?.has(row.id)) minus.push({ points: 2, words: 'the name only files for others' })

  if (hint.tone === 'warm') plus.push({ points: 3, words: 'a builder we won with' })
  else if (hint.tone === 'seen') plus.push({ points: 1, words: 'a builder we have bid' })
  else if (hint.tone === 'cold') minus.push({ points: 1, words: 'bids priced and none won' })

  const value = row.declared_value
  const money = shortMoney(value)
  if (value != null && money) {
    if (value >= 1_000_000) plus.push({ points: 3, words: money })
    else if (value >= 250_000) plus.push({ points: 2, words: money })
    else if (value >= 25_000) plus.push({ points: 1, words: money })
    else minus.push({ points: 2, words: `small, ${money}` })
  }

  const work = (row.work_type ?? '').toLowerCase()
  if (work === 'new commercial') plus.push({ points: 2, words: 'a new building' })
  else if (work === 'commercial addition' || work === 'commercial remodel') plus.push({ points: 1, words: work === 'commercial addition' ? 'an addition' : 'a remodel' })
  else if (work === 'commercial site work') minus.push({ points: 3, words: 'site work' })

  if (row.area_sf != null && row.area_sf >= 5000) plus.push({ points: 1, words: sqFtWords(row.area_sf) ?? 'a large area' })

  if (miles != null) {
    if (miles <= 15) plus.push({ points: 2, words: `${miles} miles` })
    else if (miles <= 30) plus.push({ points: 1, words: `${miles} miles` })
    else if (miles > 50) minus.push({ points: 3, words: `${miles} miles away` })
  }

  const age = daysBetween(row.filed_on, ctx.todayYmd)
  let early = 0
  if (row.stage === 'applied') early += 1
  if (age != null && age <= 7) early += 1
  if (age != null && age > 45) minus.push({ points: 2, words: `filed ${age} days ago` })

  const score = plus.reduce((n, p) => n + p.points, 0) + early - minus.reduce((n, p) => n + p.points, 0)
  const best = [...plus].sort((a, b) => b.points - a.points).map((p) => p.words)
  const worst = [...minus].sort((a, b) => b.points - a.points).map((p) => p.words)
  const why = worst.length > 0 && score <= 0 ? `Near the end: ${worst.slice(0, 2).join(' · ')}` : ['no plumber yet', ...best.slice(0, 2), ...worst.slice(0, 1)].join(' · ')
  return { row, score, why: why.charAt(0).toUpperCase() + why.slice(1), miles, hint, mark }
}

/**
 * The deck: every permit that waits on an answer (no verdict, no plumbing permit on it) above the
 * value floor, best first, the newest first among equals. No window: a permit stays until it is answered.
 */
export function skimDeck(rows: readonly ResearchPermitRow[], ctx: SkimContext, floor: ValueFloor): SkimCard[] {
  return rowsAboveFloor(rows, floor)
    .filter((r) => rowLens(r) === 'waiting')
    .map((r) => skimScore(r, ctx))
    .sort((a, b) => b.score - a.score || (b.row.filed_on ?? '').localeCompare(a.row.filed_on ?? '') || a.row.permit_number.localeCompare(b.row.permit_number))
}

/** The two answers of the skim. */
export type SkimAnswer = 'keep' | 'pass'

/** The one-tap reasons a pass offers. Optional: a pass with none still closes the permit. */
export const PASS_REASONS = [
  { code: 'too_small', words: 'Too small' },
  { code: 'too_far', words: 'Too far' },
  { code: 'not_our_work', words: 'Not our work' },
  { code: 'not_this_builder', words: 'Not this builder' },
] as const
export type PassReasonCode = (typeof PASS_REASONS)[number]['code']

/** The verdict an answer writes: Keep is the ledger's `look`, Pass its `not_for_us`, each with words the next reader can read. */
export function skimVerdict(answer: SkimAnswer, reasonCode: PassReasonCode | null): { verdict: PermitVerdict; reason: string } {
  if (answer === 'keep') return { verdict: 'look', reason: 'Kept on the skim.' }
  const reason = PASS_REASONS.find((r) => r.code === reasonCode)
  return { verdict: 'not_for_us', reason: reason ? `Passed on the skim: ${reason.words.toLowerCase()}.` : 'Passed on the skim.' }
}

/** What the bar under the next card says after an answer. */
export function answeredWords(answer: SkimAnswer): string {
  return answer === 'keep' ? 'Kept for a closer look.' : 'Passed. Why?'
}

/** What a key does on a desk. Null for a key the skim does not use. */
export type SkimKeyAct = { act: 'keep' } | { act: 'pass' } | { act: 'undo' } | { act: 'open' } | { act: 'reason'; code: PassReasonCode }
export function skimKeyAct(key: string): SkimKeyAct | null {
  if (key === 'ArrowRight') return { act: 'keep' }
  if (key === 'ArrowLeft') return { act: 'pass' }
  if (key === 'z' || key === 'Z') return { act: 'undo' }
  if (key === 'Enter') return { act: 'open' }
  if (/^[1-4]$/.test(key)) {
    const reason = PASS_REASONS[Number(key) - 1]
    return reason ? { act: 'reason', code: reason.code } : null
  }
  return null
}

/** How long an answer is held before it is written, so Undo has something to take back. */
export const SKIM_HOLD_MS = 15_000

/** "12 to skim". */
export function toSkimWords(left: number): string {
  return `${left} to skim`
}

/** The caught-up state's second line: what this sitting answered, and when more arrives. */
export function caughtUpWords(kept: number, passed: number): string {
  const n = kept + passed
  const sitting = n === 0 ? 'Every permit the feed brought has an answer.' : `You answered ${n} just now: ${kept} kept, ${passed} passed.`
  return `${sitting} The next pull is tomorrow at 5:30 AM.`
}

/** The press under the caught-up words: where the kept ones wait. Null when nothing is kept. */
export function digInWords(keptCount: number): string | null {
  return keptCount > 0 ? `Dig in · ${keptCount} kept` : null
}
