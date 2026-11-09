import { jobKindOfRow, type JobKindFixture, type JobKindRowLike } from '../jobs/jobKind'
import { awardBaselineOptions, awardBaselinePick, awardBaselineRpcArgs, type AwardBaselineInput, type AwardBaselineOption, type AwardBaselineRpcArgs, type AwardBaselineSource, type AwardBidBreakdown } from '../jobs/awardBaseline'
import { baselineReading, type BaselineRate } from '../bids/bidBaselineRates'
import { underBaselinePriceFloor } from '../jobs/baselinePriceFloor'
import { contractJobLabel } from './fillInContracts'
import { fillInRowKey, type FillInRowBase } from './fillIn'

/**
 * The baseline kind (punch list #234, PR 1a): the rows behind the Needs you line *N projects working
 * with no hours baseline* — the working jobs that read as a project and carry no `job_budgets` row
 * with hours, which is every project made before baselines were written at award. One row per job,
 * newest first: the price, when it was made, what the linked bid's Labor rows carry, what the book
 * says at its price. The answer is one press — the bid's estimate or the book's hours, the first
 * usable one leading — the same write as the award window (`award_job_baseline`); Undo clears the
 * row. A project with neither has only its door, the Costs tab, where a figure can be typed. Pure;
 * `fillInBaselinesIo.ts` reads and writes.
 */
export type BaselineJobSource = JobKindRowLike & {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  customer_name: string | null
  created_at: string | null
}

export type BaselineFixtureSource = JobKindFixture & { job_id: string }

/** A `job_budgets` row as the kind reads it: a row with hours is a baseline, whatever its kind. */
export type BaselineBudgetSource = { job_id: string; kind: string; labor_hours: number | string | null }

/** The linked bid's breakdown, read once per bid; `breakdown` null when the read failed or the bid is gone. */
export type BaselineBidSource = { bid_id: string; bid_number: string | null; breakdown: AwardBidBreakdown | null }

export type BaselineCandidates = { jobs: readonly BaselineJobSource[]; fixtures: readonly BaselineFixtureSource[]; budgets: readonly BaselineBudgetSource[] }

/** `bids` or `book` null: that read failed, so the row leaves that press out rather than guess. */
export type BaselineSources = BaselineCandidates & { bids: readonly BaselineBidSource[] | null; book: readonly BaselineRate[] | null }

export type BaselineFillInRow = FillInRowBase & {
  kind: 'baseline'
  jobId: string
  jobLabel: string
  createdAt: string | null
  priceUsd: number | null
  bidId: string | null
  input: AwardBaselineInput
  options: AwardBaselineOption[]
  /** The source that leads; null when neither the bid nor the book can be written (the door is the answer). */
  pick: Exclude<AwardBaselineSource, 'typed'> | null
}

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`
const h0 = (n: number): string => `${Math.round(n).toLocaleString('en-US')} h`

const dollars = (raw: number | string | null | undefined): number => {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function byJob<T>(rows: readonly T[], jobOf: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const r of rows) (out.get(jobOf(r)) ?? out.set(jobOf(r), []).get(jobOf(r))!).push(r)
  return out
}

/**
 * The working projects with no hours baseline, in the order given. A blank status reads as working. A project priced
 * under the $2,500 floor never appears (the owner's second call of 2026-11-09); one with no price yet still does.
 */
export function projectsWithNoBaseline<T extends BaselineJobSource>(jobs: readonly T[], fixtures: readonly BaselineFixtureSource[], budgets: readonly BaselineBudgetSource[]): T[] {
  const fixturesOf = byJob(fixtures, (f) => f.job_id)
  const withHours = new Set(budgets.filter((b) => dollars(b.labor_hours) > 0).map((b) => b.job_id))
  return jobs.filter((j) => (j.status ?? 'working') === 'working' && !j.billing_only && !withHours.has(j.id) && !underBaselinePriceFloor(j.revenue) && jobKindOfRow({ ...j, fixtures: fixturesOf.get(j.id) ?? [] }).kind === 'project')
}

const madeWords = (createdAt: string | null): string => {
  if (!createdAt) return 'A project, made before baselines were written at award.'
  const day = new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `A project, made ${day}, before baselines were written at award.`
}

/** The newest job first, then the higher number. */
export function compareBaselineRows(a: BaselineFillInRow, b: BaselineFillInRow): number {
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.jobLabel.localeCompare(a.jobLabel, undefined, { numeric: true })
}

export function baselineFillInRows(s: BaselineSources, rateUsd: number): BaselineFillInRow[] {
  const bidsOf = new Map((s.bids ?? []).map((b) => [b.bid_id, b] as const))
  return projectsWithNoBaseline(s.jobs, s.fixtures, s.budgets)
    .map((job): BaselineFillInRow => {
      const jobLabel = contractJobLabel(job)
      const customer = (job.customer_name ?? '').trim() || null
      const revenue = dollars(job.revenue)
      const priceUsd = revenue > 0 ? revenue : null
      const bid = job.bid_id ? (bidsOf.get(job.bid_id) ?? null) : null
      const bidLabel = bid?.bid_number ? `B${bid.bid_number}` : job.linkedBid?.bid_number ? `B${job.linkedBid.bid_number}` : job.bid_id ? 'the bid' : null
      const input: AwardBaselineInput = {
        breakdown: bid?.breakdown ?? null,
        bidLabel,
        book: s.book ? baselineReading(s.book, priceUsd) : null,
        priceUsd,
        rateUsd: Number(bid?.breakdown?.labor_rate) > 0 ? Number(bid!.breakdown!.labor_rate) : rateUsd,
        typedHours: null,
      }
      const options = awardBaselineOptions(input)
      const first = awardBaselinePick(options)
      const pick = first === 'typed' ? null : first
      const knows = [madeWords(job.created_at)]
      const bidOpt = options.find((o) => o.source === 'bid')!
      const bookOpt = options.find((o) => o.source === 'book')!
      if (job.bid_id) knows.push(!bid?.breakdown ? `${bidLabel === 'the bid' ? 'The bid' : bidLabel} could not be read.` : bidOpt.usable ? `${bidLabel} has hours on ${bid.breakdown.completeness!.rows_with_hours} of ${bid.breakdown.completeness!.rows_total} rows: ${h0(bidOpt.hours!)}.` : bidOpt.why)
      else knows.push('No bid is linked.')
      if (s.book) knows.push(bookOpt.usable ? `The book says ${h0(bookOpt.hours!)}: ${bookOpt.why.split('. ')[0]}.` : bookOpt.why)
      if (!pick) knows.push("Type a figure on the job's Costs tab, or fill the Labor rows on the bid.")
      return {
        key: fillInRowKey('baseline', job.id),
        kind: 'baseline',
        severity: 'gray',
        title: [jobLabel, customer, revenue > 0 ? usd(revenue) : null].filter(Boolean).join(' · '),
        knows,
        doorHref: `/jobs?tab=stages&edit=${encodeURIComponent(job.id)}`,
        doorLabel: 'Open the job',
        jobId: job.id,
        jobLabel,
        createdAt: job.created_at,
        priceUsd,
        bidId: job.bid_id ?? null,
        input,
        options,
        pick,
      }
    })
    .sort(compareBaselineRows)
}

/** The `award_job_baseline` call a press on a row makes; null when that source cannot be written. */
export function baselineRowRpcArgs(row: BaselineFillInRow, source: Exclude<AwardBaselineSource, 'typed'>): AwardBaselineRpcArgs | null {
  return awardBaselineRpcArgs(row.input, row.options, source, row.jobId, row.bidId)
}

/** The press's words: "Take B901's estimate · 158 h" / "Freeze the book's 471 h". */
export function baselinePressWords(row: BaselineFillInRow, source: Exclude<AwardBaselineSource, 'typed'>): string {
  const o = row.options.find((x) => x.source === source)
  if (!o || !o.usable || o.hours == null) return ''
  return source === 'bid' ? `Take ${row.input.bidLabel ?? "the bid"}'s estimate · ${h0(o.hours)}` : `Freeze the book's ${h0(o.hours)}`
}

/** The saved line under the deck. */
export function baselineTrailWords(source: Exclude<AwardBaselineSource, 'typed'>, hours: number): string {
  return `${h0(hours)} ${source === 'bid' ? 'from the bid' : 'assumed from the book'} · frozen as the baseline`
}
