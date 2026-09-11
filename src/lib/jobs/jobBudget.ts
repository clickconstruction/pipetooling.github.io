/**
 * The job budget with a provenance (Burn against the bid, PR 1 — v2.3297).
 *
 * Three footings, ranked by truth:
 *   ◆ bid      a snapshot of the linked bid's direct cost (job_budgets.kind = 'bid')
 *   ✎ typed    hours · materials · subs typed by the person who scoped the job
 *   ≈ assumed  price × (1 − target margin) — today's behavior, when there is no row
 *
 * Direct cost = labor hours × rate + materials + subs + other (equipment · permits ·
 * waste · other · driving · travel). Never the estimator's time (that sits in the
 * overhead pool) and never overhead (Burn keeps it out of the direct signal).
 *
 * Partial estimates stay partial: an hours-only estimate burns labor against the
 * bid and everything else against the assumption, and the words say so. Pure.
 */
import { JOB_BURN_DEFAULT_TARGET_MARGIN_PCT } from './jobBurn'

export type JobBudgetSource = 'bid' | 'typed' | 'assumed'

export const JOB_BUDGET_GLYPH: Record<JobBudgetSource, string> = { bid: '◆', typed: '✎', assumed: '≈' }
export const JOB_BUDGET_SOURCE_WORDS: Record<JobBudgetSource, string> = { bid: 'from the bid', typed: 'typed', assumed: 'assumed' }

/** `job_budgets.completeness` as the RPC writes it. */
export type JobBudgetCompleteness = {
  rows_total: number
  rows_with_hours: number
  rate_set: boolean
  materials_source: 'po' | 'takeoff' | 'typed' | 'none'
  usable: boolean
}

/** The `job_budgets` row shape the kernel reads (numbers may arrive as strings from PostgREST). */
export type JobBudgetRowLike = {
  kind: string
  bid_id?: string | null
  bid_version_id?: string | null
  labor_hours: number | string | null
  labor_rate?: number | string | null
  labor_usd: number | string | null
  materials_usd: number | string | null
  subs_usd: number | string | null
  other_usd: number | string | null
  total_direct_usd: number | string | null
  completeness?: unknown
  taken_at?: string | null
  taken_by?: string | null
  note?: string | null
}

export type JobBudgetComponents = {
  laborHours: number
  laborRate: number | null
  laborUsd: number
  materialsUsd: number
  subsUsd: number
  otherUsd: number
}

export type ResolvedJobBudget = {
  source: JobBudgetSource
  glyph: string
  /** The direct-cost budget in dollars; null only when nothing at all is known (no row, no price). */
  directUsd: number | null
  components: JobBudgetComponents | null
  completeness: JobBudgetCompleteness | null
  /** The target the assumption used; null for bid / typed. */
  targetMarginPct: number | null
  bidId: string | null
  takenAt: string | null
  takenBy: string | null
  note: string | null
  /** Which components stand on the footing and which fall back to the assumption (a partial estimate). */
  partial: { labor: boolean; materials: boolean; subs: boolean } | null
}

const n = (v: unknown): number => {
  const x = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(x) ? x : 0
}

export function parseJobBudgetCompleteness(v: unknown): JobBudgetCompleteness | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const src = o.materials_source
  return {
    rows_total: n(o.rows_total),
    rows_with_hours: n(o.rows_with_hours),
    rate_set: o.rate_set === true,
    materials_source: src === 'po' || src === 'takeoff' || src === 'typed' ? src : 'none',
    usable: o.usable === true,
  }
}

/** The completeness rule, the same one the Labor tab's head reads: hours on 90 % of the rows and a rate. */
export const JOB_BUDGET_USABLE_HOURS_SHARE = 0.9
export function budgetCompletenessUsable(c: Pick<JobBudgetCompleteness, 'rows_total' | 'rows_with_hours' | 'rate_set'>): boolean {
  return c.rows_total > 0 && c.rows_with_hours / c.rows_total >= JOB_BUDGET_USABLE_HOURS_SHARE && c.rate_set
}

export function resolveJobBudget(args: { row: JobBudgetRowLike | null | undefined; priceUsd: number | null; targetMarginPct: number | null }): ResolvedJobBudget {
  const row = args.row
  if (row && (row.kind === 'bid' || row.kind === 'typed')) {
    const components: JobBudgetComponents = {
      laborHours: n(row.labor_hours),
      laborRate: row.labor_rate != null && n(row.labor_rate) > 0 ? n(row.labor_rate) : null,
      laborUsd: n(row.labor_usd),
      materialsUsd: n(row.materials_usd),
      subsUsd: n(row.subs_usd),
      otherUsd: n(row.other_usd),
    }
    const completeness = parseJobBudgetCompleteness(row.completeness)
    const total = n(row.total_direct_usd) || components.laborUsd + components.materialsUsd + components.subsUsd + components.otherUsd
    const source: JobBudgetSource = row.kind
    // Which components the footing actually covers — a bid with hours but no rate has labor hours, not labor dollars.
    const partial = {
      labor: components.laborHours > 0,
      materials: components.materialsUsd > 0,
      subs: components.subsUsd > 0,
    }
    return {
      source,
      glyph: JOB_BUDGET_GLYPH[source],
      directUsd: total > 0 ? total : null,
      components,
      completeness,
      targetMarginPct: null,
      bidId: row.bid_id ?? null,
      takenAt: row.taken_at ?? null,
      takenBy: row.taken_by ?? null,
      note: row.note ?? null,
      partial,
    }
  }
  const price = args.priceUsd != null && args.priceUsd > 0 ? args.priceUsd : null
  const target = args.targetMarginPct != null && args.targetMarginPct > 0 && args.targetMarginPct < 100 ? args.targetMarginPct : JOB_BURN_DEFAULT_TARGET_MARGIN_PCT
  return {
    source: 'assumed',
    glyph: JOB_BUDGET_GLYPH.assumed,
    directUsd: price != null ? price * (1 - target / 100) : null,
    components: null,
    completeness: null,
    targetMarginPct: target,
    bidId: null,
    takenAt: null,
    takenBy: null,
    note: null,
    partial: null,
  }
}

/** What `resolveJobBurnBudget` should be handed as `bidEstimateUsd`: the footing's direct cost when it is not an assumption. */
export function budgetForBurn(r: ResolvedJobBudget): number | null {
  return r.source !== 'assumed' && r.directUsd != null && r.directUsd > 0 ? r.directUsd : null
}

export type ComponentBurn = {
  usedUsd: number
  budgetUsd: number | null
  /** used ÷ budget × 100; null without a budget. */
  pct: number | null
  /** pct − % done; positive = spend ahead of the work. Null without a budget or a % done. */
  aheadPts: number | null
  /** used ÷ (% done) — where the component lands at today's pace; the used amount when done or unknown. */
  atCompletionUsd: number | null
  /** used − budget; positive = over. */
  overUsd: number | null
}

/** One component's burn: used vs its budget, against the job's % done. */
export function componentBurn(args: { usedUsd: number; budgetUsd: number | null; pctDone: number | null }): ComponentBurn {
  const used = Math.max(0, args.usedUsd)
  const budget = args.budgetUsd != null && args.budgetUsd > 0 ? args.budgetUsd : null
  const done = args.pctDone != null && args.pctDone > 0 ? Math.min(args.pctDone, 100) : null
  const pct = budget != null ? (used / budget) * 100 : null
  const atCompletion = done != null ? used / (done / 100) : used > 0 ? used : null
  return {
    usedUsd: used,
    budgetUsd: budget,
    pct,
    aheadPts: pct != null && done != null ? pct - done : null,
    atCompletionUsd: atCompletion,
    overUsd: budget != null ? used - budget : null,
  }
}

/** "materials are $6,700 over the estimate with 23 % of the work left, and labor is 9 points ahead of progress" — the sentence the card prints. */
export function budgetWhyWords(args: { labor: ComponentBurn; materials: ComponentBurn; subs: ComponentBurn; pctDone: number | null; fmt: (n: number) => string }): string {
  const parts: string[] = []
  const left = args.pctDone != null ? Math.max(0, 100 - Math.min(args.pctDone, 100)) : null
  const say = (name: string, b: ComponentBurn) => {
    if (b.budgetUsd == null) return
    if (b.overUsd != null && b.overUsd > 0) parts.push(`${name} ${name === 'subs' ? 'are' : 'is'} $${args.fmt(b.overUsd)} over the estimate${left != null ? ` with ${Math.round(left)} % of the work left` : ''}`)
    else if (b.aheadPts != null && b.aheadPts >= 5) parts.push(`${name} ${name === 'subs' ? 'are' : 'is'} ${Math.round(b.aheadPts)} points ahead of progress`)
    else if (b.aheadPts != null && b.aheadPts <= -5) parts.push(`${name} ${name === 'subs' ? 'are' : 'is'} ${Math.round(-b.aheadPts)} points under`)
  }
  say('materials', args.materials)
  say('labor', args.labor)
  say('subs', args.subs)
  if (parts.length === 0) return args.labor.budgetUsd == null && args.materials.budgetUsd == null && args.subs.budgetUsd == null ? 'No component budget to read against yet.' : 'Every component is on pace with the work.'
  const s = parts.join(', and ')
  return s.charAt(0).toUpperCase() + s.slice(1) + '.'
}
