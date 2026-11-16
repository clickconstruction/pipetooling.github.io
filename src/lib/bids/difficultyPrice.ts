/**
 * GC difficulty rating (punch list #357, PR 4): the price list, what a point costs.
 *
 * The owner's call of 2026-11-14: the points become cost lines, never a multiple and never margin points. The office
 * owns the numbers — the owner and the controller edit them from the Bid Board behind *Pricing rules*, estimators
 * read them — and they are versioned like the criteria: a published version is immutable, a bid priced under it keeps
 * its lines when the next is published. One row of `difficulty_price_versions` holds one version's `body`, the
 * shape here.
 *
 * Pure: no React, no supabase. The reads and writes are in `difficultyPriceIo.ts`; the arithmetic that turns a
 * rating into lines is `difficultyLines.ts`.
 */
import type { DifficultyPayingRule } from './difficultyPaying'

/** Who may rate a GC: the office (owner, assistant, controller, dev), the estimators, the masters in the field. */
export type DifficultyRater = 'office' | 'estimator' | 'master'
export const DIFFICULTY_RATERS: ReadonlyArray<DifficultyRater> = ['office', 'estimator', 'master']
/**
 * Who may rate when no price list says, or when a list carries no raters: all three groups. The database's gate
 * (`gc_difficulty_can_rate()`, the insert rule on `gc_difficulty_ratings`) carries the same list; the test holds the
 * two equal.
 */
export const DIFFICULTY_RATERS_DEFAULT: ReadonlyArray<DifficultyRater> = DIFFICULTY_RATERS

export type DifficultyPriceList = {
  /** Each field point adds this percent of the bid's field hours, at its labor rate. */
  fieldPctPerPoint: number
  /** Each office point adds this many office hours… */
  officeHoursPerPoint: number
  /** …at this many dollars an hour. */
  officeRate: number
  /** Each site point (PR 6) adds this percent of the bid's field hours, at its labor rate. */
  sitePctPerPoint: number
  /** The paying point: the days the median runs past this count… */
  payingDaysPast: number
  /** …at this percent a month on the price. */
  payingMonthlyRate: number
  /** Paying is read from the bills once a GC has this many. */
  payingMinBills: number
  /** A paying point too when this many bills in a year ran past their calendar. */
  payingLateBillsInYear: number
  /** All lines together add at most this percent of the bid's own cost. */
  capPct: number
  raters: DifficultyRater[]
}

/**
 * Version 1, the canvas's numbers. The same JSON is seeded by the migration; the test holds the two equal. Version 2
 * (v2.7468, the owner's word of 2026-11-16) is these numbers with the estimators added to `raters`.
 */
export const DIFFICULTY_PRICE_V1: DifficultyPriceList = {
  fieldPctPerPoint: 5,
  officeHoursPerPoint: 12,
  officeRate: 80,
  sitePctPerPoint: 4,
  payingDaysPast: 45,
  payingMonthlyRate: 1.5,
  payingMinBills: 3,
  payingLateBillsInYear: 2,
  capPct: 10,
  raters: ['office', 'master'],
}

/** The numeric fields, in the order the sheet draws them. */
export const DIFFICULTY_PRICE_NUMBER_KEYS = [
  'fieldPctPerPoint',
  'officeHoursPerPoint',
  'officeRate',
  'sitePctPerPoint',
  'payingDaysPast',
  'payingMonthlyRate',
  'payingMinBills',
  'payingLateBillsInYear',
  'capPct',
] as const satisfies ReadonlyArray<keyof DifficultyPriceList>

export type DifficultyPriceNumberKey = (typeof DIFFICULTY_PRICE_NUMBER_KEYS)[number]

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v != null && !Array.isArray(v)
}

function num(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return fallback
}

/**
 * The body as the row holds it, every number read leniently (a draft can be half typed) and a missing one taking
 * version 1's; raters that are not a list read as every group, as the database's gate reads them. Null when the value
 * is not an object at all.
 */
export function parseDifficultyPriceList(raw: unknown): DifficultyPriceList | null {
  const obj = typeof raw === 'string' ? safeJson(raw) : raw
  if (!isRecord(obj)) return null
  const out: DifficultyPriceList = { ...DIFFICULTY_PRICE_V1, raters: [...DIFFICULTY_RATERS_DEFAULT] }
  for (const k of DIFFICULTY_PRICE_NUMBER_KEYS) out[k] = num(obj[k], DIFFICULTY_PRICE_V1[k])
  if (Array.isArray(obj.raters)) out.raters = obj.raters.filter((r): r is DifficultyRater => DIFFICULTY_RATERS.includes(r as DifficultyRater))
  return out
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** The rules a price list must keep before it is published. Each line is one a person can act on; empty is a pass. */
export function difficultyPriceProblems(p: DifficultyPriceList): string[] {
  const problems: string[] = []
  const pct = (v: number, what: string) => {
    if (!Number.isFinite(v) || v < 0 || v > 100) problems.push(`${what} is a percent from 0 to 100.`)
  }
  pct(p.fieldPctPerPoint, 'The field percent')
  pct(p.sitePctPerPoint, 'The site percent')
  pct(p.capPct, 'The cap')
  if (!Number.isFinite(p.payingMonthlyRate) || p.payingMonthlyRate < 0 || p.payingMonthlyRate > 20) problems.push('The monthly rate is a percent from 0 to 20.')
  if (!Number.isFinite(p.officeHoursPerPoint) || p.officeHoursPerPoint < 0 || p.officeHoursPerPoint > 500) problems.push('Office hours per point is 0 to 500.')
  if (!Number.isFinite(p.officeRate) || p.officeRate < 0 || p.officeRate > 1000) problems.push('The office rate is 0 to 1,000 dollars an hour.')
  if (!Number.isInteger(p.payingDaysPast) || p.payingDaysPast < 0 || p.payingDaysPast > 365) problems.push('The paying days are a whole number from 0 to 365.')
  if (!Number.isInteger(p.payingMinBills) || p.payingMinBills < 1 || p.payingMinBills > 50) problems.push('The bills a read needs is a whole number from 1 to 50.')
  if (!Number.isInteger(p.payingLateBillsInYear) || p.payingLateBillsInYear < 1 || p.payingLateBillsInYear > 50) problems.push('The late bills in a year is a whole number from 1 to 50.')
  if (p.raters.length === 0) problems.push('Someone has to be able to rate a GC: pick at least one of the office, the estimators and the masters.')
  return problems
}

/** The paying rule the reader takes from the price list. */
export function difficultyPayingRuleOf(p: DifficultyPriceList): DifficultyPayingRule {
  return { daysPast: p.payingDaysPast, lateBillsInYear: p.payingLateBillsInYear, minBills: p.payingMinBills }
}

/** The rater group a role falls in; null for a role that is never one (a sub, a helper, a primary, a superintendent). */
export function difficultyRaterOfRole(role: string | null | undefined): DifficultyRater | null {
  if (role === 'estimator') return 'estimator'
  if (role === 'master_technician') return 'master'
  if (role === 'dev' || role === 'assistant' || role === 'controller') return 'office'
  return null
}

/**
 * Whether a role may rate a GC under this price list. A dev always may; with no list read, every group may. This is
 * the one answer every rating press asks (the GC's card, the Bid Board's chip, the sheet from a bid, the ask at the
 * end of a job), and the database asks its twin, `gc_difficulty_can_rate()`, before it takes the row.
 */
export function difficultyCanRate(p: DifficultyPriceList | null, role: string | null | undefined): boolean {
  if (role === 'dev') return true
  const group = difficultyRaterOfRole(role)
  if (!group) return false
  return (p?.raters ?? DIFFICULTY_RATERS_DEFAULT).includes(group)
}

export const DIFFICULTY_RATER_WORDS: Readonly<Record<DifficultyRater, string>> = {
  office: 'The office',
  estimator: 'The estimators',
  master: 'The masters',
}

/** The owner or the controller edits the price list; a dev too. */
export function difficultyCanEditPrice(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'controller'
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const pctWords = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`

/** The price list in sentences, one per rule, as the Workbench's fold and the guide read it. */
export function difficultyPriceWords(p: DifficultyPriceList): string[] {
  return [
    `Each field point adds ${pctWords(p.fieldPctPerPoint)} of the bid's field hours at its labor rate.`,
    `Each office point adds ${p.officeHoursPerPoint} office hours at ${money(p.officeRate)} an hour.`,
    `Each site point adds ${pctWords(p.sitePctPerPoint)} of the bid's field hours at its labor rate.`,
    `The paying point carries the price for the days past ${p.payingDaysPast} at ${pctWords(p.payingMonthlyRate)} a month.`,
    `All lines together add at most ${pctWords(p.capPct)} of the bid's own cost.`,
    `Paying is read from the bills once a GC has ${p.payingMinBills} or more, or when ${p.payingLateBillsInYear} in a year ran past their calendar.`,
  ]
}

/** "price list version 2 · 2026-11-20 by Taunya". */
export function difficultyPriceVersionWords(v: { version: number; publishedAt: string | null; publishedByName: string }): string {
  const day = v.publishedAt ? v.publishedAt.slice(0, 10) : ''
  const by = v.publishedByName.trim()
  const when = [day, by ? `by ${by}` : ''].filter(Boolean).join(' ')
  return when ? `price list version ${v.version} · ${when}` : `price list version ${v.version}`
}

export const DIFFICULTY_PRICE_WORDS = {
  door: 'Pricing rules',
  title: 'Pricing rules · what difficulty costs',
  lead: 'The owner and the controller edit, estimators read.',
  readOnly: 'The owner and the controller set what a point costs. You can read it here.',
  noVersion: 'No price list is published yet, so a rating adds nothing to a bid.',
  saveAs: (next: number) => `Save as version ${next}`,
  saved: (v: number) => `Version ${v} is published. Bids priced from now on read it.`,
  everyVersion: 'Every version',
  keepLines: (v: number) => `Saving makes version ${v + 1}. Bids priced under version ${v} keep their lines.`,
  ratersLabel: 'Who may rate a GC',
  close: 'Close',
} as const
