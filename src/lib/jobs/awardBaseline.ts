/**
 * The budgets at award (punch list #234, PR 1a). When a project is made — a job priced before
 * the work, #238's kind — it leaves award with one hours baseline, frozen, and its source. Three
 * sources, tried in order; the first usable one is the pick, the dead ones say what would make
 * them usable, and the press names the number and where it came from:
 *
 *   ◆ bid    the bid's Labor rows, when the estimate is usable (hours on 90 % of the rows and a rate)
 *   ≈ book   the labor book's assumed hours — hours per $1k from similar projects × the price — a guess, read as one
 *   ✎ typed  a figure with the typer's name on it
 *
 * *Not now* still writes the book's number, so nothing is ever blank. Pure; the window and the
 * Quickfill deck line both read this, and `award_job_baseline` writes it.
 */
import { BASELINE_MIN_SAMPLE, type BaselineReading } from '../bids/bidBaselineRates'
import type { LineBudgetWrite } from './lineBudgets'

export type AwardBaselineSource = 'bid' | 'book' | 'typed'

export const AWARD_BASELINE_GLYPH: Record<AwardBaselineSource, string> = { bid: '◆', book: '≈', typed: '✎' }

/** `bid_estimate_breakdown` as the award reads it; the fields the pick needs, numbers may arrive as strings. */
export type AwardBidBreakdown = {
  has_estimate: boolean
  labor_hours: number | string | null
  labor_rate: number | string | null
  labor_usd: number | string | null
  materials_usd: number | string | null
  completeness: { rows_total: number; rows_with_hours: number; rate_set: boolean; usable: boolean } | null
  labor_hours_by_stage?: { rough?: number | string | null; top?: number | string | null; trim?: number | string | null } | null
}

export type AwardBaselineInput = {
  /** The linked bid's breakdown; null when no bid is linked. */
  breakdown: AwardBidBreakdown | null
  /** "B917", or null when no bid is linked. */
  bidLabel: string | null
  /** The labor book's reading at the job's price; null while it loads. */
  book: BaselineReading | null
  /** The job's price (the lines' sum, or the carried bid value). */
  priceUsd: number | null
  /** The burdened cost rate the book's and the typed hours are priced at: the bid's labor rate when it has one, else the company's. */
  rateUsd: number
  /** What was typed in the Typed box; null or 0 = nothing yet. */
  typedHours: number | null
}

export type AwardBaselineOption = {
  source: AwardBaselineSource
  glyph: string
  /** The hours this source gives; null when it cannot. */
  hours: number | null
  /** Whether the press can write this source now. */
  usable: boolean
  /** "480 h · from the bid's Labor rows" / "Typed". */
  head: string
  /** Under the head: why it is usable, or what would make it so. */
  why: string
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}
const h0 = (n: number): string => `${Math.round(n).toLocaleString('en-US')} h`
const usd0 = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

export function bidBaselineUsable(b: AwardBidBreakdown | null): boolean {
  return !!b && b.has_estimate && !!b.completeness?.usable && num(b.labor_hours) > 0
}

/** "Rough In 210 h · Top Out 150 h · Trim Set 120 h" from the breakdown's stage hours; '' when none carry any. */
export function stageHoursWords(b: AwardBidBreakdown | null): string {
  const s = b?.labor_hours_by_stage
  if (!s) return ''
  const parts = [
    ['Rough In', num(s.rough)],
    ['Top Out', num(s.top)],
    ['Trim Set', num(s.trim)],
  ].filter(([, h]) => (h as number) > 0) as Array<[string, number]>
  return parts.map(([name, h]) => `${name} ${h0(h)}`).join(' · ')
}

export function bookBaselineUsable(book: BaselineReading | null, priceUsd: number | null): boolean {
  return !!book && book.impliedHours != null && book.impliedHours > 0 && book.n >= BASELINE_MIN_SAMPLE && priceUsd != null && priceUsd > 0
}

/** "4.2 h per $1k × $112,000, from 12 similar projects" / "2 baselines so far · needs 3" / "Needs a price on the job." */
export function bookBaselineWhy(book: BaselineReading | null, priceUsd: number | null): string {
  if (priceUsd == null || priceUsd <= 0) return 'Needs a price on the job.'
  if (!book) return 'Reading the book…'
  if (book.n === 0) return 'No baselines in the book yet — they are kept when jobs bill.'
  if (book.n < BASELINE_MIN_SAMPLE) return `${book.n} baseline${book.n === 1 ? '' : 's'} in the book so far · needs ${BASELINE_MIN_SAMPLE}.`
  return `${book.medianHoursPerThousand!.toFixed(1)} h per $1k × ${usd0(priceUsd)}, from ${book.n} ${book.scope === 'similar' ? 'similar projects' : 'projects of every size'}.`
}

/** The three options in the order they are tried, each saying what it gives or what it needs. */
export function awardBaselineOptions(i: AwardBaselineInput): AwardBaselineOption[] {
  const b = i.breakdown
  const bidHours = b ? num(b.labor_hours) : 0
  const bidUsable = bidBaselineUsable(b)
  const bidTag = i.bidLabel ?? 'the bid'
  const bid: AwardBaselineOption = (() => {
    if (!b) return { source: 'bid', glyph: '◆', hours: null, usable: false, head: "From the bid's Labor rows", why: 'No bid is linked to this job.' }
    if (!b.has_estimate) return { source: 'bid', glyph: '◆', hours: null, usable: false, head: "From the bid's Labor rows", why: `${bidTag} has no cost estimate. Add hours on its Labor tab and this becomes the pick.` }
    const c = b.completeness
    if (!bidUsable) {
      const rows = c ? `hours on ${c.rows_with_hours} of ${c.rows_total} rows` : 'no hours'
      const carry = bidHours > 0 ? ` The ${c?.rows_with_hours ?? 0} rows carry ${h0(bidHours)}.` : ''
      const rate = c && !c.rate_set ? ' No labor rate is set.' : ''
      return { source: 'bid', glyph: '◆', hours: null, usable: false, head: "From the bid's Labor rows", why: `Not usable: ${rows}.${rate} Fill the Labor rows on ${bidTag} and this becomes the pick.${carry}` }
    }
    const stages = stageHoursWords(b)
    return { source: 'bid', glyph: '◆', hours: bidHours, usable: true, head: `${h0(bidHours)} · from the bid's Labor rows`, why: `${c!.rows_with_hours} of ${c!.rows_total} rows carry hours.${stages ? ` ${stages}.` : ''} The bid's own number. This is the one that scores.` }
  })()

  const bookUsable = bookBaselineUsable(i.book, i.priceUsd)
  const bookHours = bookUsable ? i.book!.impliedHours! : null
  let bookWhy = bookBaselineWhy(i.book, i.priceUsd)
  if (bookUsable && bidUsable && bidHours > 0) {
    const pct = Math.round(((bookHours! - bidHours) / bidHours) * 100)
    bookWhy += pct === 0 ? ' The book and the bid agree here.' : ` The book runs ${Math.abs(pct)}% ${pct > 0 ? 'over' : 'under'} the bid here. Worth a look at the bid, not a reason to override it.`
  } else if (bookUsable) {
    bookWhy += ' A guess, read as one. The line draws grey and the score skips it until a bid baseline or a typed one replaces it.'
  }
  const book: AwardBaselineOption = { source: 'book', glyph: '≈', hours: bookHours, usable: bookUsable, head: bookUsable ? `${h0(bookHours!)} · from the book, assumed` : 'From the book, assumed', why: bookWhy }

  const typedHours = i.typedHours != null && i.typedHours > 0 ? i.typedHours : null
  const typed: AwardBaselineOption = { source: 'typed', glyph: '✎', hours: typedHours, usable: typedHours != null, head: typedHours != null ? `${h0(typedHours)} · typed` : 'Typed', why: 'Your own figure, with your name on it. When you know better than the book: a repeat building, a known crew, a plan the bid did not show.' }
  return [bid, book, typed]
}

/** The first usable source in order; 'typed' when nothing is usable (the box is the only way left). */
export function awardBaselinePick(options: readonly AwardBaselineOption[]): AwardBaselineSource {
  return options.find((o) => o.usable)?.source ?? 'typed'
}

/** The press's words: "Award it · 480 h from the bid" / "Award it · 471 h assumed" / "Award it · 220 h typed" / "Award it · no baseline yet". */
export function awardPressWords(options: readonly AwardBaselineOption[], pick: AwardBaselineSource, verb = 'Award it'): string {
  const o = options.find((x) => x.source === pick)
  if (!o || !o.usable || o.hours == null) return `${verb} · no baseline yet`
  const tail = pick === 'bid' ? 'from the bid' : pick === 'book' ? 'assumed' : 'typed'
  return `${verb} · ${h0(o.hours)} ${tail}`
}

/** What *Not now* writes: the book's number when it has one, else nothing (the job stays without a baseline and the deck line catches it). */
export function awardNotNowSource(options: readonly AwardBaselineOption[]): 'book' | null {
  return options.find((o) => o.source === 'book')?.usable ? 'book' : null
}

export type AwardBaselineRpcArgs = {
  p_job_id: string
  p_source: AwardBaselineSource
  p_bid_id: string | null
  p_labor_hours: number | null
  p_labor_rate: number | null
  p_book: Record<string, unknown>
  p_note: string | null
}

/** The `award_job_baseline` call for a pick; null when the pick cannot be written (a dead source). */
export function awardBaselineRpcArgs(i: AwardBaselineInput, options: readonly AwardBaselineOption[], pick: AwardBaselineSource, jobId: string, bidId: string | null, note: string | null = null): AwardBaselineRpcArgs | null {
  const o = options.find((x) => x.source === pick)
  if (!o || !o.usable) return null
  if (pick === 'bid') return bidId ? { p_job_id: jobId, p_source: 'bid', p_bid_id: bidId, p_labor_hours: null, p_labor_rate: null, p_book: {}, p_note: null } : null
  if (pick === 'book') {
    const b = i.book!
    return { p_job_id: jobId, p_source: 'book', p_bid_id: null, p_labor_hours: Math.round(o.hours! * 10) / 10, p_labor_rate: i.rateUsd, p_book: { hours_per_thousand: b.medianHoursPerThousand, n: b.n, price_usd: i.priceUsd, scope: b.scope, billed: b.billed }, p_note: null }
  }
  return { p_job_id: jobId, p_source: 'typed', p_bid_id: null, p_labor_hours: Math.round(o.hours! * 10) / 10, p_labor_rate: i.rateUsd, p_book: {}, p_note: note && note.trim() ? note.trim() : null }
}

/**
 * The ◆ a carried line takes at award: the bid's workbench priced labor and materials in dollars,
 * so the line that carries the bid's price carries their shares too (`budget_source` workbench).
 * Null when the estimate is not usable or the price is zero; materials give way so the two never
 * pass the price.
 */
export function workbenchLineBudget(b: AwardBidBreakdown | null, linePriceUsd: number | null, fallbackRateUsd: number): LineBudgetWrite | null {
  if (!bidBaselineUsable(b) || linePriceUsd == null || linePriceUsd <= 0) return null
  const laborUsd = num(b!.labor_usd)
  const materialsUsd = num(b!.materials_usd)
  if (laborUsd <= 0) return null
  const laborPct = Math.max(0, Math.min(100, Math.round((laborUsd / linePriceUsd) * 100)))
  const materialsPct = Math.max(0, Math.min(100 - laborPct, Math.round((materialsUsd / linePriceUsd) * 100)))
  const rate = num(b!.labor_rate)
  return { budget_labor_pct: laborPct, budget_materials_pct: materialsPct, budget_source: 'workbench', budget_tuned_at: null, budget_rate_usd: rate > 0 ? rate : fallbackRateUsd }
}
