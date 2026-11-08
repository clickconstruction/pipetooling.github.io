/**
 * The Projects board (punch list #242, PR 3): every working project as one card whose strip
 * is the labor budget, filled by the job's real days, divided by its stages, with the work done
 * as a mark and the money as a thin line; a slider under it sets the expected hours. This is
 * the one place the card's numbers are assembled — the superintendent's phone card (PR 4) reads
 * the same `projectPace`, so the office and the field can never disagree. Pure.
 *
 * - The gate: a job Working whose kind reads Project (`jobKindOfRow`, punch list #238, the same
 *   read as the job's chip). A job reading Service call stays off, whatever its price. A job reading
 *   Kind not set keeps the guess the kind replaced until the office presses, a stage In order (set
 *   on the Bill tab or recognized from the line names, the way the Pipeline reads stages) or a price
 *   of $25,000 and up: a card that should not be there costs nothing, a missing one costs the morning
 *   read. A billing-only job stays off, as on the Pipeline's Working column: nobody clocks on it.
 * - Who sees it: the leader, the superintendents, the assistant and the controller. Who moves
 *   the expected hours: the leader and the office; a superintendent reads his own number.
 * - The track: the labor budget in hours from the Costs baseline (bid, then typed), else the
 *   lines' sum at the company split (`lineBudgets.ts`); the stages' shares cut it in order; the
 *   money is the read's blended percent of the money budget (`projectBoardRead.ts`).
 * - Worst first: money leading, then behind by days, then even, then ahead, then no reading yet.
 */
import { isAssistantLike } from '../subcontractorLikeRole'
import { applyRecognizedStages } from './stageRecognition'
import { jobKindOfRow, type JobKind, type JobKindRowLike } from './jobKind'
import { calcLineBudget, lineBudgetEntryOf, lineBudgetFor, sumLineBudgets, type LineBudgetColumns, type LineBudgetSettings } from './lineBudgets'
import { isJobBudgetRowKind, type JobBudgetSource } from './jobBudget'
import { laborEventsOf, teamHoursOf, type ProjectBoardJob } from './projectBoardRead'
import { stageSharesOf, type StageShare } from './stageShares'
import { laborDaysOf, superintendentLine, type SuperintendentLine, type SuperintendentLineInput } from './superintendentLine'
import { jobStageChecklists, type JobStageRef, type StageChecklistAnswer, type StageChecklistQuestion } from './stageChecklist'
import type { ExpectedHoursTarget } from './expectedHours'

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

/** `kind` and the facts beside it are what the job's kind reads; a read older than them leaves `kind` undefined. */
export type ProjectRow = Pick<JobKindRowLike, 'kind' | 'bid_id' | 'project_id' | 'first_work_date' | 'billing_only'> & {
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

/** A working job with no kind yet, priced here or above, is a project even with no stage marked. */
export const PROJECT_PRICE_GATE_USD = 25000

/** What lands a job on the board, in the page's words: under the cards, and beside a job that is not here. */
export const PROJECT_GATE_WORDS = `A project is a Working job whose kind reads Project. A job with no kind yet lands here with a stage In order or a price of $${PROJECT_PRICE_GATE_USD.toLocaleString('en-US')} and up. A service call stays off at any price.`

const num = (v: number | string | null | undefined, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return n != null && Number.isFinite(n) ? n : fallback
}

const numOrNull = (v: number | string | null | undefined): number | null => (v == null ? null : num(v))

/** The job's lines with the Pipeline's stage recognition applied: an In-order plan by name when none was marked. */
export function stagedFixtures(fixtures: ReadonlyArray<ProjectFixture>): ProjectFixture[] {
  const normal = fixtures.map((f) => ({ ...f, count: num(f.count, 1) || 1, line_unit_price: num(f.line_unit_price), sequence_order: num(f.sequence_order) }))
  return applyRecognizedStages(normal).fixtures.map((f) => ({ ...f }))
}

/** The kind as the job's chip reads it, or null when it reads not set. A read older than the facts says nothing, so it reads not set too. */
function kindOfProjectRow(row: ProjectRow): JobKind | null {
  if (row.kind === undefined) return null
  return jobKindOfRow({
    ...row,
    hcp_number: row.hcp_number == null ? null : String(row.hcp_number),
    click_number: row.click_number == null ? null : String(row.click_number),
    fixtures: row.fixtures?.map((f) => ({ ...f, count: numOrNull(f.count), line_unit_price: numOrNull(f.line_unit_price), sequence_order: numOrNull(f.sequence_order) })),
  }).kind
}

/** The guess a job with no kind keeps: a stage In order, marked or recognized, or the price. */
function looksLikeAProject(row: ProjectRow): boolean {
  if (stagedFixtures(row.fixtures ?? []).some((f) => f.stage_kind === 'order')) return true
  return num(row.revenue) >= PROJECT_PRICE_GATE_USD
}

export function isWorkingProject(row: ProjectRow): boolean {
  if ((row.status ?? '').toLowerCase() !== 'working' || row.billing_only) return false
  const kind = kindOfProjectRow(row)
  return kind === 'project' || (kind === null && looksLikeAProject(row))
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
}

export function projectPace(args: {
  job: ProjectBoardJob
  target: ExpectedHoursTarget | null | undefined
  checklist: { answered: number; asked: number }
  settings: LineBudgetSettings
}): ProjectPace {
  const { job, settings } = args
  const fixtures = stagedFixtures(job.fixtures ?? []).filter((f) => f.line_kind !== 'discount')
  const lines = fixtures.map((f) => {
    const price = num(f.line_unit_price) * (num(f.count, 1) || 1)
    const entry = lineBudgetFor(lineBudgetEntryOf(f), f.name, settings)
    return { f, price, entry, calc: calcLineBudget(price, entry, settings) }
  })
  const sums = sumLineBudgets(
    lines.map((l) => ({ priceUsd: l.price, entry: l.entry, pctDone: l.f.progress_pct != null ? num(l.f.progress_pct) : null })),
    settings,
  )
  // A book baseline (punch list #234 PR 1a) is a pace budget too, read as a guess.
  const fromBaseline = isJobBudgetRowKind(job.budgetKind) && (job.budgetHours ?? 0) > 0
  const baseHours = fromBaseline ? job.budgetHours! : sums.laborHours
  const baseSource: JobBudgetSource = fromBaseline ? (job.budgetKind as JobBudgetSource) : 'assumed'
  const budgetEdge = Math.max(1, Math.round(baseHours))
  const shares = stageSharesOf(
    lines.map((l) => ({ id: l.f.id, name: l.f.name, stage_kind: l.f.stage_kind, line_kind: l.f.line_kind, progress_pct: l.f.progress_pct, sequence_order: l.f.sequence_order, laborHours: l.calc.laborHours, laborUsd: l.calc.laborUsd })),
  )
  const stages: ProjectStage[] = shares.map((s) => {
    const hours = (s.sharePct / 100) * budgetEdge
    return { name: s.name, hours, laborUsd: hours * settings.rateUsd, pctDone: s.pctDone }
  })
  const t = args.target ?? null
  const input: SuperintendentLineInput = {
    pctDone: job.pct_complete != null ? num(job.pct_complete) : null,
    hoursUsed: teamHoursOf(job),
    laborDays: laborDaysOf(laborEventsOf(job)),
    hoursBudget: t ? t.hours : baseHours,
    budgetSource: t ? 'target' : baseSource,
    target: t ? { by: t.by, at: t.at, from: t.from, why: t.why } : null,
    // The line reads only the ratio: the read's percent, over a budget of 100.
    money: job.spentPct != null ? { spentUsd: job.spentPct, budgetUsd: 100 } : null,
    // The planned finish frozen at award (punch list #234 PR 2), when the read carries one.
    plannedFinishYmd: job.plannedFinish ?? null,
    checklist: args.checklist,
    certifiedPct: null,
  }
  return { input, line: superintendentLine(input), baseHours, baseSource, budgetEdge, stages, shares }
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

/** How the board's projects stand, counted for the Dashboard's one-line strip (punch list #242, PR 6). */
export type PaceCounts = { total: number; behind: number; moneyLeading: number; even: number; ahead: number; early: number }

export function paceCounts(lines: ReadonlyArray<SuperintendentLine>): PaceCounts {
  const c: PaceCounts = { total: lines.length, behind: 0, moneyLeading: 0, even: 0, ahead: 0, early: 0 }
  for (const l of lines) {
    if (l.tone === 'behind') {
      c.behind += 1
      if (l.money?.leads) c.moneyLeading += 1
    } else if (l.tone === 'even') c.even += 1
    else if (l.tone === 'ahead') c.ahead += 1
    else c.early += 1
  }
  return c
}

/** The worst project's short words for the strip: *money ahead* or *N d behind*; null when it is not behind. */
export function worstWords(line: SuperintendentLine): string | null {
  if (line.tone !== 'behind') return null
  if (line.money?.wrong) return 'budget?'
  if (line.money?.leads && line.days >= 0) return 'money ahead'
  return `${-line.days} d behind`
}
