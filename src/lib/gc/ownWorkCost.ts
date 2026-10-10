/**
 * GC mode, Owner Billing's O11: what our own work really costs, read from the Pipeline jobs it is spent on (the plan is
 * to-dos/gc-mode/mockups/owner-billing-o11.md on branch spike/gc-mode). Pure. Each linked job's spend is the Costs tab's
 * own (`spendByComponent` over the job's charge events, `loadJobChargesTimelineInputs`); this turns it into what
 * Money's margin counts.
 *
 * - General conditions (O11b): the Pipeline job our number names for them. They are time, not work done, so they count
 *   at their budget until the spend passes it, then at the spend, and at what they cost once the job closes.
 * - Labor dollars are real only for a reader who sees pay (`has_payroll_access()`). Without it the spend would read
 *   $0 labor with no error, so our own work counts at its budget and the words say why.
 */
import { spendByComponent } from '../jobs/jobBudget'
import type { JobChargeEvent } from '../jobChargesTimeline'
import type { GcProject } from './types'

/** One Pipeline job's spend so far, as its Costs tab reads it. */
export interface OwnWorkJobCost {
  jobId: string
  /** The job's number as the Pipeline shows it (`jobNumberLabel`). */
  label: string
  name: string
  /** Every source added up: team labor, sub labor, card charges, fuel, supply house, tally parts, other charges. */
  spentUsd: number
  teamUsd: number
  subUsd: number
  partsUsd: number
  /** Days with team labor on the job. */
  fieldDays: number
  /** The Pipeline job is billed or paid. */
  finished: boolean
}

/** What the page read for our own work: whether the reader sees pay, and each linked job's spend. */
export interface OwnWorkCosts {
  payAccess: boolean
  /** By Pipeline job id; 'error' when that job's read failed. A job not here is still loading. */
  byJob: Record<string, OwnWorkJobCost | 'error'>
}

/** A Pipeline job's spend from its charge events. */
export function ownWorkJobCost(job: { id: string; label: string; name: string; status: string | null }, events: ReadonlyArray<Pick<JobChargeEvent, 'source' | 'amount' | 'dateKey'>>): OwnWorkJobCost {
  const spend = spendByComponent(events)
  const fieldDays = new Set(events.filter((e) => e.source === 'team_labor').map((e) => e.dateKey)).size
  return {
    jobId: job.id,
    label: job.label,
    name: job.name,
    spentUsd: spend.totalUsd,
    teamUsd: spend.teamUsd,
    subUsd: spend.subUsd,
    partsUsd: spend.partsUsd,
    fieldDays,
    finished: job.status === 'billed' || job.status === 'paid',
  }
}

/**
 * Where general conditions' cost comes from:
 * - 'none': no Pipeline job named, so their budget;
 * - 'hidden': the reader does not see pay, so their budget;
 * - 'loading' / 'error': the job's spend is not read, so their budget;
 * - 'running': the job's spend, at their budget until it passes it;
 * - 'closed': the job is closed (`closedOn`), so what they cost.
 */
export type GeneralConditionsCostState = 'none' | 'hidden' | 'loading' | 'error' | 'running' | 'closed'

export interface GeneralConditionsCost {
  budget: number
  jobId: string | null
  /** The Pipeline job's number, once read. */
  jobLabel: string | null
  /** Spent so far on the job; null unless 'running' or 'closed'. */
  spent: number | null
  /** What the margin counts for them. */
  counted: number
  state: GeneralConditionsCostState
}

/** General conditions' cost on a project, from the Pipeline job our number names for them. */
export function generalConditionsCost(project: Pick<GcProject, 'generalConditions' | 'generalConditionsJobId' | 'closedOn'>, own: OwnWorkCosts | undefined): GeneralConditionsCost {
  const budget = project.generalConditions
  const jobId = project.generalConditionsJobId ?? null
  const atBudget = (state: GeneralConditionsCostState, jobLabel: string | null = null): GeneralConditionsCost => ({ budget, jobId, jobLabel, spent: null, counted: budget, state })
  if (!jobId) return atBudget('none')
  if (!own) return atBudget('loading')
  if (!own.payAccess) return atBudget('hidden')
  const read = own.byJob[jobId]
  if (read === undefined) return atBudget('loading')
  if (read === 'error') return atBudget('error')
  if (project.closedOn) return { budget, jobId, jobLabel: read.label, spent: read.spentUsd, counted: read.spentUsd, state: 'closed' }
  return { budget, jobId, jobLabel: read.label, spent: read.spentUsd, counted: Math.max(budget, read.spentUsd), state: 'running' }
}

/** The Pipeline jobs our own work names on these projects, for the page to read: today general conditions'. */
export function ownWorkJobIds(projects: ReadonlyArray<Pick<GcProject, 'generalConditionsJobId'>>): string[] {
  return [...new Set(projects.map((p) => p.generalConditionsJobId).filter((id): id is string => Boolean(id)))]
}

/** "$138,000": whole dollars, as the margin shows them. */
const dollars = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/** What general conditions' cost reads as, on Money's margin and on Closeout. */
export function generalConditionsWords(gc: GeneralConditionsCost): string {
  const budget = dollars(gc.budget)
  const on = gc.jobLabel ? ` on Pipeline job ${gc.jobLabel}` : ''
  switch (gc.state) {
    case 'none':
      return `General conditions ${budget}, at their budget: no Pipeline job is named for them yet.`
    case 'hidden':
      return `General conditions ${budget}, at their budget: their labor cost is for those who see pay.`
    case 'loading':
      return `General conditions ${budget}, at their budget until their Pipeline job's spend is read.`
    case 'error':
      return `General conditions ${budget}, at their budget: their Pipeline job's spend did not load.`
    case 'closed':
      return `General conditions cost ${dollars(gc.spent ?? 0)} of their ${budget} budget${on}.`
    case 'running': {
      const spent = gc.spent ?? 0
      const over = spent - gc.budget
      return `General conditions ${budget}: ${dollars(spent)} spent so far${on}${over >= 0.5 ? `, ${dollars(over)} over their budget` : ''}.`
    }
  }
}
