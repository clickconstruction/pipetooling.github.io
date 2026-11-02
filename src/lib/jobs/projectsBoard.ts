/**
 * The Projects board (punch list #242, PR 3): every working project as one card whose strip
 * is the labor budget, filled by the job's real days, divided by its stages, with the work done
 * as a mark and the money as a thin line; a slider under it sets the expected hours. This is
 * the one place the card's numbers are assembled — the superintendent's phone card (PR 4) reads
 * the same `projectPace`, so the office and the field can never disagree. Pure.
 *
 * - The gate: a job Working with a stage In order (set on the Bill tab or recognized from the
 *   line names, the way the Pipeline reads stages) or priced at $25,000 and up (#238's kind
 *   replaces the guess when it ships). Service calls stay out.
 * - Who sees it: the leader, the superintendents, the assistant and the controller. Who moves
 *   the expected hours: the leader and the office; a superintendent reads his own number.
 * - The track: the labor budget in hours from the Costs baseline (`resolveJobBudget`, bid →
 *   typed), else the lines' sum at the company split (`lineBudgets.ts`); the stages' shares cut
 *   it in order; the money is spend against the direct budget.
 * - Worst first: money leading, then behind by days, then even, then ahead, then no reading yet.
 */
import { isAssistantLike } from '../subcontractorLikeRole'
import { applyRecognizedStages } from './stageRecognition'
import { calcLineBudget, lineBudgetEntryOf, lineBudgetFor, sumLineBudgets, type LineBudgetColumns, type LineBudgetSettings } from './lineBudgets'
import { resolveJobBudget, spendByComponent, type JobBudgetRowLike, type JobBudgetSource } from './jobBudget'
import { JOB_BURN_DEFAULT_TARGET_MARGIN_PCT } from './jobBurn'
import { stageSharesOf, type StageShare } from './stageShares'
import { laborDaysOf, superintendentLine, type SuperintendentLine, type SuperintendentLineInput } from './superintendentLine'
import { jobStageChecklists, type JobStageRef, type StageChecklistAnswer, type StageChecklistQuestion } from './stageChecklist'
import type { ExpectedHoursTarget } from './expectedHours'
import type { JobChargeEvent } from '../jobChargesTimeline'

/** A line item as the board reads it; the five budget columns ride along once #234's PR 1 is live (PR 5). */
export type ProjectFixture = Partial<LineBudgetColumns> & {
  id: string
  name: string | null
  stage_kind: string | null
  line_kind?: string | null
  line_unit_price: number | string | null
  count: number | string | null
  progress_pct: number | string | null
  sequence_order: number | string | null
}

export type ProjectRow = {
  id: string
  hcp_number: string | number | null
  click_number: string | number | null
  job_name: string | null
  job_address: string | null
  status: string | null
  pct_complete: number | string | null
  revenue: number | string | null
  fixtures: ProjectFixture[] | null
}

/** A working job priced here or above is a project even with no stage marked. */
export const PROJECT_PRICE_GATE_USD = 25000

const num = (v: number | string | null | undefined, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return n != null && Number.isFinite(n) ? n : fallback
}

/** The job's lines with the Pipeline's stage recognition applied: an In-order plan by name when none was marked. */
export function stagedFixtures(fixtures: ReadonlyArray<ProjectFixture>): ProjectFixture[] {
  const normal = fixtures.map((f) => ({ ...f, count: num(f.count, 1) || 1, line_unit_price: num(f.line_unit_price), sequence_order: num(f.sequence_order) }))
  return applyRecognizedStages(normal).fixtures.map((f) => ({ ...f }))
}

export function isWorkingProject(row: ProjectRow): boolean {
  if ((row.status ?? '').toLowerCase() !== 'working') return false
  if (stagedFixtures(row.fixtures ?? []).some((f) => f.stage_kind === 'order')) return true
  return num(row.revenue) >= PROJECT_PRICE_GATE_USD
}

type Role = string | null | undefined

/** The leader, the superintendents, the assistant and the controller. */
export function canSeeProjectsBoard(role: Role): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'superintendent'
}

/** The leader and the office set the expected hours; a superintendent reads his own. */
export function canSetExpectedHours(role: Role): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

export function projectNumber(row: Pick<ProjectRow, 'hcp_number' | 'click_number'>): string {
  const n = String(row.hcp_number ?? '').trim() || String(row.click_number ?? '').trim()
  return n ? `J${n}` : 'J—'
}

export function projectLabel(row: Pick<ProjectRow, 'hcp_number' | 'click_number' | 'job_name'>): string {
  return `${projectNumber(row)} · ${(row.job_name ?? '').trim() || 'Untitled job'}`
}

/** The job's cost events as the Costs tab loads them, or null while they load or after a failed read. */
export type ProjectBurn = { chargeEvents: readonly JobChargeEvent[]; teamHours: number; revenue: number | null } | null

export type ProjectStage = { name: string; hours: number; laborUsd: number; pctDone: number | null }

export type ProjectPace = {
  input: SuperintendentLineInput
  line: SuperintendentLine
  /** The labor budget's hours from the Costs baseline or the lines' sum, before any target. */
  baseHours: number
  baseSource: JobBudgetSource
  /** The track's length: the base budget, rounded, at least 1. */
  budgetEdge: number
  /** The stages in order as pieces of the track, each as its share of the base budget in hours and at the cost rate in dollars. */
  stages: ProjectStage[]
  shares: StageShare[]
  priceUsd: number | null
  budgetUsd: number | null
}

export function projectPace(args: {
  row: ProjectRow
  budgetRow: JobBudgetRowLike | null | undefined
  burn: ProjectBurn
  target: ExpectedHoursTarget | null | undefined
  checklist: { answered: number; asked: number }
  settings: LineBudgetSettings
  /** Job Summary's target margin, for the assumed money budget; null takes the Burn default. */
  targetMarginPct: number | null
}): ProjectPace {
  const { row, settings } = args
  const fixtures = stagedFixtures(row.fixtures ?? []).filter((f) => f.line_kind !== 'discount')
  const lines = fixtures.map((f) => {
    const price = num(f.line_unit_price) * (num(f.count, 1) || 1)
    const entry = lineBudgetFor(lineBudgetEntryOf(f), f.name, settings)
    return { f, price, entry, calc: calcLineBudget(price, entry, settings) }
  })
  const sums = sumLineBudgets(
    lines.map((l) => ({ priceUsd: l.price, entry: l.entry, pctDone: l.f.progress_pct != null ? num(l.f.progress_pct) : null })),
    settings,
  )
  const rowPrice = row.revenue != null && num(row.revenue) > 0 ? num(row.revenue) : null
  const priceUsd = args.burn?.revenue ?? rowPrice ?? (sums.priceUsd > 0 ? sums.priceUsd : null)
  const margin = args.targetMarginPct != null && args.targetMarginPct > 0 && args.targetMarginPct < 100 ? args.targetMarginPct : JOB_BURN_DEFAULT_TARGET_MARGIN_PCT
  const resolved = resolveJobBudget({ row: args.budgetRow, priceUsd, targetMarginPct: margin })
  const fromRow = resolved.components != null && resolved.components.laborHours > 0
  const baseHours = fromRow ? resolved.components!.laborHours : sums.laborHours
  const baseSource: JobBudgetSource = fromRow ? resolved.source : 'assumed'
  const budgetEdge = Math.max(1, Math.round(baseHours))
  const shares = stageSharesOf(
    lines.map((l) => ({ id: l.f.id, name: l.f.name, stage_kind: l.f.stage_kind, line_kind: l.f.line_kind, progress_pct: l.f.progress_pct, sequence_order: l.f.sequence_order, laborHours: l.calc.laborHours, laborUsd: l.calc.laborUsd })),
  )
  const stages: ProjectStage[] = shares.map((s) => {
    const hours = (s.sharePct / 100) * budgetEdge
    return { name: s.name, hours, laborUsd: hours * settings.rateUsd, pctDone: s.pctDone }
  })
  const spentUsd = args.burn ? spendByComponent(args.burn.chargeEvents).totalUsd : null
  const budgetUsd = resolved.directUsd ?? (priceUsd != null ? priceUsd * (1 - margin / 100) : null)
  const t = args.target ?? null
  const input: SuperintendentLineInput = {
    pctDone: row.pct_complete != null ? num(row.pct_complete) : null,
    hoursUsed: args.burn ? args.burn.teamHours : null,
    laborDays: args.burn ? laborDaysOf(args.burn.chargeEvents) : [],
    hoursBudget: t ? t.hours : baseHours,
    budgetSource: t ? 'target' : baseSource,
    target: t ? { by: t.by, at: t.at, from: t.from, why: t.why } : null,
    money: spentUsd != null && budgetUsd != null ? { spentUsd, budgetUsd } : null,
    plannedFinishYmd: null,
    checklist: args.checklist,
    certifiedPct: null,
  }
  return { input, line: superintendentLine(input), baseHours, baseSource, budgetEdge, stages, shares, priceUsd, budgetUsd }
}

/** Worst first: money leading, then behind by days, then even, then ahead, then no reading yet. */
export function paceRank(l: SuperintendentLine): number {
  return l.tone === 'behind' ? (l.money?.leads ? 0 : 1) : l.tone === 'even' ? 2 : l.tone === 'ahead' ? 3 : 4
}

export function sortByPace<T extends { line: SuperintendentLine }>(cards: ReadonlyArray<T>): T[] {
  return [...cards].sort((a, b) => paceRank(a.line) - paceRank(b.line) || a.line.days - b.line.days)
}

/** The job's checklist count across its stages: answered of asked, from the stage checklists of v2.6077. */
export function checklistCountOf(
  fixtures: ReadonlyArray<ProjectFixture>,
  questions: readonly StageChecklistQuestion[],
  answersByFixture: ReadonlyMap<string, readonly StageChecklistAnswer[]>,
): { answered: number; asked: number } {
  const refs: JobStageRef[] = stagedFixtures(fixtures)
    .filter((f) => f.stage_kind === 'order' || f.stage_kind === 'any')
    .map((f) => ({ fixtureId: f.id, name: f.name ?? '', sequenceOrder: num(f.sequence_order) }))
  return jobStageChecklists(refs, questions, answersByFixture).reduce((s, x) => ({ answered: s.answered + x.state.answered, asked: s.asked + x.state.asked }), { answered: 0, asked: 0 })
}
