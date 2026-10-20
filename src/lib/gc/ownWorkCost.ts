/**
 * GC mode, Owner Billing's O11: what our own work really costs, read from the Pipeline jobs it is spent on (the plan is
 * to-dos/gc-mode/mockups/owner-billing-o11.md on branch spike/gc-mode). Pure. Each linked job's spend is the Costs tab's
 * own (`spendByComponent` over the job's charge events, `loadJobChargesTimelineInputs`); this turns it into what
 * Money's margin counts.
 *
 * - General conditions (O11b): the Pipeline job our number names for them. They are time, not work done, so they count
 *   at their budget until the spend passes it, then at the spend, and at what they cost once the job closes.
 * - Our own crew (O11a): the Pipeline job a crew trade runs on (Building's U8). It counts at today's pace, spent ÷
 *   percent done, the Costs tab's own figure, once the Pipeline says it is not too early (`JOB_BURN_EARLY_*`); at what it
 *   cost once done; at its price before that.
 * - A Pipeline job counts once, in the first place that holds it (`ownWorkHolders`); the others say where it counts.
 * - Labor dollars are real only for a reader who sees pay (`has_payroll_access()`). Without it the spend would read
 *   $0 labor with no error, so our own work counts at its budget and the words say why.
 */
import { spendByComponent } from '../jobs/jobBudget'
import { JOB_BURN_EARLY_FIELD_DAYS, JOB_BURN_EARLY_PCT } from '../jobs/jobBurn'
import type { JobChargeEvent } from '../jobChargesTimeline'
import { generalConditionsHolder } from './crewJobRows'
import type { GcProject, TradePackage } from './types'

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
  /** Each trade our own crew does, by its id, to its Pipeline job (U8's links). Absent: none read. */
  crewJobs?: Record<string, string>
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
 * - 'closed': the job is closed (`closedOn`), so what they cost;
 * - 'shared': a crew already counts the job, so their budget.
 */
export type GeneralConditionsCostState = 'none' | 'hidden' | 'loading' | 'error' | 'running' | 'closed' | 'shared'

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
  /** 'shared': where the job counts instead ("Plumbing", "Plumbing at Stone Oak"). */
  sharedWith?: string
}

/** General conditions' cost on a project, from the Pipeline job our number names for them. */
export function generalConditionsCost(
  project: Pick<GcProject, 'generalConditions' | 'generalConditionsJobId' | 'closedOn'>,
  own: OwnWorkCosts | undefined,
  sharedWith?: string | null,
): GeneralConditionsCost {
  const budget = project.generalConditions
  const jobId = project.generalConditionsJobId ?? null
  const atBudget = (state: GeneralConditionsCostState, jobLabel: string | null = null): GeneralConditionsCost => ({ budget, jobId, jobLabel, spent: null, counted: budget, state })
  if (!jobId) return atBudget('none')
  if (!own) return atBudget('loading')
  if (!own.payAccess) return atBudget('hidden')
  if (sharedWith) return { ...atBudget('shared'), sharedWith }
  const read = own.byJob[jobId]
  if (read === undefined) return atBudget('loading')
  if (read === 'error') return atBudget('error')
  if (project.closedOn) return { budget, jobId, jobLabel: read.label, spent: read.spentUsd, counted: read.spentUsd, state: 'closed' }
  return { budget, jobId, jobLabel: read.label, spent: read.spentUsd, counted: Math.max(budget, read.spentUsd), state: 'running' }
}

/** The Pipeline jobs our own work names on these projects, for the page to read: general conditions' and our crews'. */
export function ownWorkJobIds(projects: ReadonlyArray<Pick<GcProject, 'generalConditionsJobId'>>, crewJobs: Readonly<Record<string, string>> = {}): string[] {
  return [...new Set([...projects.map((p) => p.generalConditionsJobId), ...Object.values(crewJobs)].filter((id): id is string => Boolean(id)))]
}

/**
 * Where each Pipeline job counts: the first place that holds it, project by project, each project's crew trades
 * first, then its general conditions. Any later place counts at its price or budget and names this one.
 */
export function ownWorkHolders(projects: ReadonlyArray<Pick<GcProject, 'id' | 'name' | 'packages' | 'generalConditionsJobId'>>, own: OwnWorkCosts | undefined): Map<string, { key: string; projectId: string; words: string }> {
  const out = new Map<string, { key: string; projectId: string; words: string }>()
  for (const p of projects) {
    for (const pkg of p.packages) {
      const jobId = pkg.selfPerform ? own?.crewJobs?.[pkg.id] : undefined
      if (jobId && !out.has(jobId)) out.set(jobId, { key: pkg.id, projectId: p.id, words: pkg.trade })
    }
    const gcJob = p.generalConditionsJobId
    if (gcJob && !out.has(gcJob)) out.set(gcJob, { key: generalConditionsHolder(p.id), projectId: p.id, words: 'general conditions' })
  }
  return out
}

/** The words for where a job counts, from the place asking: "Plumbing" here, "Plumbing at Stone Oak" on another job. */
export function holderWords(holder: { projectId: string; words: string } | undefined, projectId: string, projects: ReadonlyArray<Pick<GcProject, 'id' | 'name'>>): string | null {
  if (!holder) return null
  if (holder.projectId === projectId) return holder.words
  return `${holder.words} at ${projects.find((p) => p.id === holder.projectId)?.name ?? 'another job'}`
}

/**
 * Where our own crew's cost comes from, on one trade:
 * - 'none': no Pipeline job linked, so its price;
 * - 'hidden' / 'loading' / 'error': the job's spend is not read, so its price;
 * - 'shared': the job counts in another place, so its price;
 * - 'early': read, but too early to say what it will cost (the Pipeline's rule), so its price;
 * - 'pace': spent ÷ percent done, what it will cost at today's pace;
 * - 'done': 100% done, or its Pipeline job billed or paid, so what it cost.
 */
export type CrewCostState = 'none' | 'hidden' | 'loading' | 'error' | 'shared' | 'early' | 'pace' | 'done'

export interface CrewCost {
  /** What the customer signed for the trade. */
  signed: number
  jobId: string | null
  jobLabel: string | null
  /** Spent so far on the job; null unless 'early', 'pace' or 'done'. */
  spent: number | null
  /** Our crew's percent done, from its Pipeline job (U8's `selfPerform.pctDone`). */
  pctDone: number | null
  /** What the margin counts for the trade. */
  counted: number
  state: CrewCostState
  /** 'shared': where the job counts instead. */
  sharedWith?: string
}

/** Our own crew's cost on a trade, from its Pipeline job. */
export function crewCost(pkg: Pick<TradePackage, 'id' | 'selfPerform'>, signed: number, own: OwnWorkCosts | undefined, sharedWith?: string | null): CrewCost {
  const jobId = own?.crewJobs?.[pkg.id] ?? null
  const pctDone = pkg.selfPerform?.pctDone ?? null
  const atPrice = (state: CrewCostState, jobLabel: string | null = null): CrewCost => ({ signed, jobId, jobLabel, spent: null, pctDone, counted: signed, state })
  if (!jobId) return atPrice('none')
  if (!own) return atPrice('loading')
  if (!own.payAccess) return atPrice('hidden')
  if (sharedWith) return { ...atPrice('shared'), sharedWith }
  const read = own.byJob[jobId]
  if (read === undefined) return atPrice('loading')
  if (read === 'error') return atPrice('error')
  const spent = read.spentUsd
  if ((pctDone !== null && pctDone >= 100) || read.finished) return { signed, jobId, jobLabel: read.label, spent, pctDone, counted: spent, state: 'done' }
  if (pctDone === null || pctDone < JOB_BURN_EARLY_PCT || read.fieldDays < JOB_BURN_EARLY_FIELD_DAYS) return { ...atPrice('early', read.label), spent }
  return { signed, jobId, jobLabel: read.label, spent, pctDone, counted: spent / (pctDone / 100), state: 'pace' }
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
    case 'shared':
      return `General conditions ${budget}, at their budget: their Pipeline job counts on ${gc.sharedWith ?? 'a crew'} already.`
  }
}

/** Our own crew's line on Money's margin, after the trade's name. */
export function crewCostWords(c: CrewCost): string {
  const signed = `our own crew · signed for ${dollars(c.signed)}`
  const on = c.jobLabel ? ` on Pipeline job ${c.jobLabel}` : ''
  switch (c.state) {
    case 'none':
      return `${signed}, at its price: it has no Pipeline job yet`
    case 'hidden':
      return `${signed}, at its price: its labor cost is for those who see pay`
    case 'loading':
      return `${signed}, at its price until its Pipeline job's spend is read`
    case 'error':
      return `${signed}, at its price: its Pipeline job's spend did not load`
    case 'shared':
      return `${signed}, at its price: its Pipeline job counts on ${c.sharedWith ?? 'another trade'} already`
    case 'early':
      return `${signed} · ${dollars(c.spent ?? 0)} spent so far${on}, too early to say what it will cost`
    case 'pace':
      return `${signed}, about ${dollars(c.counted)} at today's pace${on} · ${dollars(c.spent ?? 0)} spent, ${Math.round(c.pctDone ?? 0)}% done`
    case 'done':
      return `${signed}, cost ${dollars(c.counted)}${on}`
  }
}

/** Closeout's sentence on what our own crew cost, or null where today's words stand alone. */
export function crewCloseoutWords(c: CrewCost): string | null {
  const on = c.jobLabel ? ` on Pipeline job ${c.jobLabel}` : ''
  switch (c.state) {
    case 'done':
      return `It cost ${dollars(c.counted)}${on}, against ${dollars(c.signed)} signed.`
    case 'pace':
      return `At today's pace it costs about ${dollars(c.counted)}${on}, against ${dollars(c.signed)} signed.`
    case 'early':
      return `${dollars(c.spent ?? 0)} is spent so far${on}. It is too early to say what it will cost.`
    case 'hidden':
      return 'Its labor cost is for those who see pay.'
    default:
      return null
  }
}
