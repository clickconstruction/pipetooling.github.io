import { lineBudgetEntryOf, lineBudgetFor, type LineBudgetColumns, type LineBudgetSettings } from '../jobs/lineBudgets'
import { contractJobLabel } from './fillInContracts'

/**
 * The owner's weekly review of the guesses (punch list #234, PR 1c): the assumed lines — typed, on the
 * company's split, not yet tuned and not yet stamped — on the projects awarded in the last week. One
 * card, not a prompt per line: *4 assumed lines on 2 projects awarded this week · $9,400 of $168,000*,
 * with *Looks right · stamp 4* (reviewed with his name, left assumed) and *Tune* (the first job's Bill
 * tab). Pure; `lineBudgetsReviewIo.ts` reads and stamps.
 */
export const LINE_BUDGETS_REVIEW_WINDOW_DAYS = 7

/** A project awarded in the window, as the read hands it. */
export type ReviewJobSource = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; customer_name: string | null; revenue: number | string | null; awarded_at: string | null }

/** A line on one of those projects. */
export type ReviewFixtureSource = LineBudgetColumns & { id: string; job_id: string; name: string | null; count: number | string | null; line_unit_price: number | string | null; line_kind?: string | null; budget_reviewed_at?: string | null }

export type ReviewLine = { fixtureId: string; jobId: string; jobLabel: string; name: string; priceUsd: number; laborPct: number; materialsPct: number }

export type LineBudgetsReview = {
  lines: ReviewLine[]
  /** The projects the lines sit on, in award order, newest first. */
  jobIds: string[]
  /** The assumed lines' dollars and every line's dollars on those projects. */
  assumedUsd: number
  totalUsd: number
  /** The lines on those projects that need nothing: from the workbench, tuned, or already stamped. */
  settledLines: number
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}
const usd0 = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

/** Awarded inside the window: `awarded_at` on or after `today − 7 days`. */
export function awardedThisWeek(awardedAt: string | null, nowIso: string, days = LINE_BUDGETS_REVIEW_WINDOW_DAYS): boolean {
  if (!awardedAt) return false
  const t = Date.parse(awardedAt)
  const now = Date.parse(nowIso)
  return Number.isFinite(t) && Number.isFinite(now) && now - t <= days * 86_400_000 && t <= now
}

export function lineBudgetsReview(jobs: readonly ReviewJobSource[], fixtures: readonly ReviewFixtureSource[], settings: LineBudgetSettings, nowIso: string): LineBudgetsReview {
  const recent = jobs.filter((j) => awardedThisWeek(j.awarded_at, nowIso)).sort((a, b) => (b.awarded_at ?? '').localeCompare(a.awarded_at ?? ''))
  const byId = new Map(recent.map((j) => [j.id, j] as const))
  const lines: ReviewLine[] = []
  let assumedUsd = 0
  let totalUsd = 0
  let settled = 0
  const jobIds = new Set<string>()
  for (const f of fixtures) {
    const job = byId.get(f.job_id)
    if (!job || f.line_kind === 'discount') continue
    const price = num(f.line_unit_price) * (num(f.count) || 1)
    totalUsd += Math.max(0, price)
    const stored = lineBudgetEntryOf(f)
    if (stored || f.budget_reviewed_at) {
      settled += 1
      continue
    }
    const e = lineBudgetFor(undefined, f.name, settings)
    lines.push({ fixtureId: f.id, jobId: f.job_id, jobLabel: contractJobLabel(job), name: (f.name ?? '').trim() || 'Line', priceUsd: price, laborPct: e.laborPct, materialsPct: e.materialsPct })
    assumedUsd += Math.max(0, price)
    jobIds.add(f.job_id)
  }
  const order = recent.map((j) => j.id).filter((id) => jobIds.has(id))
  lines.sort((a, b) => order.indexOf(a.jobId) - order.indexOf(b.jobId) || b.priceUsd - a.priceUsd)
  return { lines, jobIds: order, assumedUsd, totalUsd, settledLines: settled }
}

/** The card's title: "4 assumed lines on 2 projects awarded this week". */
export function lineBudgetsReviewTitle(r: LineBudgetsReview): string {
  const n = r.lines.length
  const p = r.jobIds.length
  return `${n} assumed line${n === 1 ? '' : 's'} on ${p} project${p === 1 ? '' : 's'} awarded this week`
}

/** The card's detail: "$9,400 of $168,000 on the company split. Looks right stamps them with your name and leaves them assumed; Tune opens the job." */
export function lineBudgetsReviewDetail(r: LineBudgetsReview): string {
  return `${usd0(r.assumedUsd)} of ${usd0(r.totalUsd)} on the company split. Looks right stamps them with your name and leaves them assumed. Tune opens the job.`
}

/** Under the list: "The other 9 lines on these 2 projects came from the workbench, were tuned, or were stamped, and need nothing." */
export function lineBudgetsReviewSettledWords(r: LineBudgetsReview): string {
  if (r.settledLines === 0) return ''
  const p = r.jobIds.length
  const n = `${r.settledLines} line${r.settledLines === 1 ? '' : 's'}`
  // With no assumed line left there is no "other": the week's lines are all settled (a read after the stamp).
  if (p === 0) return `${n} on this week's projects came from the workbench, were tuned, or were stamped, and need nothing.`
  return `The other ${n} on ${p === 1 ? 'this project' : `these ${p} projects`} came from the workbench, were tuned, or were stamped, and need nothing.`
}

/** One row's reading: "J1042 · Water heater, 50 gal, added · $4,000 · ≈ 45 / 35". */
export function reviewLineWords(l: ReviewLine): string {
  return `${l.jobLabel} · ${l.name} · ${usd0(l.priceUsd)} · ≈ ${l.laborPct} / ${l.materialsPct}`
}
