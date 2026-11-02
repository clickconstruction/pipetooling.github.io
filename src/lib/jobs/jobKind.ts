/**
 * A job's kind (punch list #238): a service call or a project, read from the job's own facts.
 *
 * The owner, 2026-11-01: "Service calls, we don't know how much to bill until the very end. While
 * projects coming from bids or estimates or even oral conversations, we know how much they are
 * gonna cost before we start." So the kind is WHEN THE PRICE IS KNOWN. A project is priced before
 * the first hour is worked and its price moves only by change orders; a service call is priced by
 * the work and billed at the end. The customer's Res/Comm is the customer's business, not the
 * job's: a restaurant's clogged drain is a service call, a custom home's rough-in is a project.
 *
 * One kernel every reader uses, in this order: the office's explicit kind (`jobs_ledger.kind`,
 * which wins over the signals from the press on); else a billing-only job → project (it carries a
 * GC project's bills and nothing else); else a price on the job before any work → project; else a
 * bid or a GC project behind the job → project; else Stage Plan rows → project; else an HCP number
 * with none of those, or a price that came with the work → service call; else not set. A caller
 * passes the facts it has; a rule whose fact is not loaded is skipped, never guessed. Pure.
 */
import { recognizeStages, type RecognizableFixture } from './stageRecognition'

export type JobKind = 'service' | 'project'

export const JOB_KINDS: readonly JobKind[] = ['service', 'project']

/** The chip's words: the crew's own. The Glossary gives the honest names, a priced job and time and materials. */
export const JOB_KIND_WORDS: Readonly<Record<JobKind, string>> = { service: 'Service call', project: 'Project' }
export const JOB_KIND_UNSET_WORDS = 'Kind not set'

export function normalizeJobKind(raw: unknown): JobKind | null {
  return raw === 'service' || raw === 'project' ? raw : null
}

/** A line item as the kind reads it: the Stage Plan's own shape. */
export type JobKindFixture = RecognizableFixture

export type JobKindFacts = {
  /** `jobs_ledger.kind`: the office's own answer. */
  kind?: string | null
  hcp_number?: string | null
  click_number?: string | null
  bid_id?: string | null
  project_id?: string | null
  /** The bid's number for the reason words ("from bid B917"). */
  bidNumber?: string | null
  /** The job's line items; undefined = not loaded (the stages rule is skipped). */
  fixtures?: ReadonlyArray<JobKindFixture> | null
  /** The job's price in dollars (`jobs_ledger.revenue`); null or 0 = unpriced. */
  revenue?: number | string | null
  /** The first day of work (`jobs_ledger.first_work_date`, YYYY-MM-DD); null = no work yet; undefined = not known. */
  firstWorkDate?: string | null
  /** The day the price was set, YYYY-MM-DD, when it is remembered (the New Job form types it today); undefined = not remembered. */
  pricedOn?: string | null
  /** `jobs_ledger.billing_only`: GC mode's billing job, which nobody clocks on, so its first day of work says nothing. */
  billingOnly?: boolean | null
}

export type JobKindSource = 'explicit' | 'billing_only' | 'priced_before_work' | 'bid' | 'gc_project' | 'stages' | 'hcp' | 'priced_with_work' | null

export type JobKindRead = {
  kind: JobKind | null
  source: JobKindSource
  /** The line under the control: "Project · priced $112,000 from bid B917." */
  reason: string
  /** The office pressed it: the signals no longer move it. */
  settled: boolean
}

const UNSET_REASON = 'No price before the work, no bid, no stages: your call.'

function dollars(revenue: number | string | null | undefined): number {
  const n = Number(revenue)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** "from bid B917": `bids.bid_number` holds the bare number and the board prints it with its B. */
function fromBid(bidNumber: string | null | undefined): string {
  const bid = (bidNumber ?? '').trim()
  if (!bid) return 'from its bid'
  return `from bid ${/^\d/.test(bid) ? `B${bid}` : bid}`
}

function hasStages(fixtures: ReadonlyArray<JobKindFixture>): boolean {
  if (fixtures.some((f) => f.stage_kind === 'order')) return true
  return recognizeStages(fixtures).recognized
}

/** The kind the facts give, with its source and the words that say why. */
export function jobKind(facts: JobKindFacts): JobKindRead {
  const explicit = normalizeJobKind(facts.kind)
  if (explicit) {
    return { kind: explicit, source: 'explicit', reason: explicit === 'project' ? 'Project · the office said so.' : 'Service call · the office said so.', settled: true }
  }
  // A sheet of a job points at its job; a billing-only job points at the GC project whose bills it carries.
  if (facts.billingOnly) {
    return { kind: 'project', source: 'billing_only', reason: 'Project · the bills of a GC project we build.', settled: false }
  }
  const price = dollars(facts.revenue)
  const firstWork = facts.firstWorkDate
  // A price on the job and no work yet, or a price set before the first day of work: the owner's own test.
  // A bid behind the job is where that price came from, so the words name the bid.
  if (price > 0 && (firstWork === null || (typeof firstWork === 'string' && typeof facts.pricedOn === 'string' && facts.pricedOn < firstWork))) {
    const words = facts.bid_id ? fromBid(facts.bidNumber) : 'before the work'
    return { kind: 'project', source: 'priced_before_work', reason: `Project · priced ${money(price)} ${words}.`, settled: false }
  }
  if (facts.bid_id) {
    const from = fromBid(facts.bidNumber)
    return { kind: 'project', source: 'bid', reason: price > 0 ? `Project · priced ${money(price)} ${from}.` : `Project · priced ${from}.`, settled: false }
  }
  if (facts.project_id) {
    return { kind: 'project', source: 'gc_project', reason: 'Project · a GC project we build.', settled: false }
  }
  if (facts.fixtures && hasStages(facts.fixtures)) {
    return { kind: 'project', source: 'stages', reason: 'Project · stages on the job.', settled: false }
  }
  if ((facts.hcp_number ?? '').trim()) {
    return { kind: 'service', source: 'hcp', reason: 'Service call · priced when done.', settled: false }
  }
  // A price that came on or after the first day of work: the tech found the work and priced it.
  if (price > 0 && typeof firstWork === 'string' && typeof facts.pricedOn === 'string' && facts.pricedOn >= firstWork) {
    return { kind: 'service', source: 'priced_with_work', reason: `Service call · priced ${money(price)} with the work.`, settled: false }
  }
  return { kind: null, source: null, reason: UNSET_REASON, settled: false }
}

/** A `jobs_ledger` row as the readers hold it: the explicit kind rides on the row once the types carry it. */
export type JobKindRowLike = {
  kind?: string | null
  hcp_number?: string | null
  click_number?: string | null
  bid_id?: string | null
  project_id?: string | null
  revenue?: number | string | null
  first_work_date?: string | null
  /** `jobs_ledger.status`: past the work, a blank first day means the clock never saw it, not that no work was done. */
  status?: string | null
  billing_only?: boolean | null
  fixtures?: ReadonlyArray<JobKindFixture> | null
  linkedBid?: { bid_number?: string | null } | null
}

/** Statuses a job only reaches once its work is done. */
const PAST_THE_WORK: ReadonlySet<string> = new Set(['ready_to_bill', 'billed', 'paid'])

/**
 * The first day of work as the kernel reads it: a date, null for no work yet, undefined for not
 * known. `first_work_date` caches approved clock sessions only, so a blank one on a job already
 * billed says nothing about when its price was known, and the price rule is skipped.
 */
function firstWorkFact(row: JobKindRowLike): string | null | undefined {
  if (row.first_work_date === undefined) return undefined
  if (row.first_work_date) return row.first_work_date
  return PAST_THE_WORK.has(row.status ?? '') ? undefined : null
}

/**
 * The facts a ledger row carries. The row never remembers the day its price was typed, so
 * `pricedOn` stays unknown: a priced job with no work yet still reads as a project (the price is
 * on it before any work), and a priced job already worked falls to its bid, its stages or its
 * number. The explicit kind is read loosely until the types chore carries the column.
 */
export function jobKindFacts(row: JobKindRowLike): JobKindFacts {
  return {
    kind: row.kind ?? null,
    hcp_number: row.hcp_number ?? null,
    click_number: row.click_number ?? null,
    bid_id: row.bid_id ?? null,
    project_id: row.project_id ?? null,
    bidNumber: row.linkedBid?.bid_number ?? null,
    fixtures: row.fixtures ?? undefined,
    revenue: row.revenue ?? null,
    firstWorkDate: firstWorkFact(row),
    billingOnly: row.billing_only ?? null,
  }
}

/** One read for a row: `jobKind(jobKindFacts(row))`. */
export function jobKindOfRow(row: JobKindRowLike): JobKindRead {
  return jobKind(jobKindFacts(row))
}

// ---------------------------------------------------------------------------
// The chip
// ---------------------------------------------------------------------------

export type JobKindChipTone = 'project' | 'service' | 'unset'

export type JobKindChipWords = {
  label: string
  tone: JobKindChipTone
  /** The hover text: the reason, and whether the office pressed it. */
  title: string
}

/** Blue for a project, green for a service call, amber "Kind not set" until the office presses. */
export function jobKindChip(read: JobKindRead): JobKindChipWords {
  if (read.kind === 'project') return { label: JOB_KIND_WORDS.project, tone: 'project', title: read.reason }
  if (read.kind === 'service') return { label: JOB_KIND_WORDS.service, tone: 'service', title: read.reason }
  return { label: JOB_KIND_UNSET_WORDS, tone: 'unset', title: `${JOB_KIND_UNSET_WORDS}. ${read.reason}` }
}

// ---------------------------------------------------------------------------
// The board filter
// ---------------------------------------------------------------------------

export const STAGES_KIND_FILTERS = ['project', 'service', 'unset'] as const
export type StagesKindFilter = (typeof STAGES_KIND_FILTERS)[number]

export const STAGES_KIND_FILTER_LABELS: Readonly<Record<StagesKindFilter, string>> = {
  project: 'Projects',
  service: 'Service calls',
  unset: JOB_KIND_UNSET_WORDS,
}

export function parseStagesKindFilter(raw: string | null | undefined): StagesKindFilter | '' {
  return raw === 'project' || raw === 'service' || raw === 'unset' ? raw : ''
}

/** The rows whose kind the filter names; every row when no filter is set. */
export function filterJobsByKind<T extends JobKindRowLike>(jobs: readonly T[], filter: StagesKindFilter | ''): T[] {
  if (!filter) return [...jobs]
  return jobs.filter((j) => (jobKindOfRow(j).kind ?? 'unset') === filter)
}

/** How many rows each filter would show, for the menu's options ("Kind not set · 7"). */
export function jobKindCounts(jobs: ReadonlyArray<JobKindRowLike>): Record<StagesKindFilter, number> {
  const counts: Record<StagesKindFilter, number> = { project: 0, service: 0, unset: 0 }
  for (const j of jobs) counts[jobKindOfRow(j).kind ?? 'unset'] += 1
  return counts
}

/** The option's words with its count: "Kind not set · 7". */
export function stagesKindFilterOptionLabel(filter: StagesKindFilter, counts: Record<StagesKindFilter, number> | null | undefined): string {
  const label = STAGES_KIND_FILTER_LABELS[filter]
  return counts ? `${label} · ${counts[filter]}` : label
}

// ---------------------------------------------------------------------------
// The press
// ---------------------------------------------------------------------------

/** What the press writes onto `jobs_ledger`. */
export function jobKindPatch(kind: JobKind | null): { kind: JobKind | null } {
  return { kind }
}

/**
 * What New Job saves with a new job. The office's press, always. With no press the column stays
 * null and the signals read on, since they stay true and move with the job: a bid linked later or
 * stages typed later still change the read, and the press stays the office's alone. One exception:
 * the row never remembers the day its price was typed, so a price the form sees before any work is
 * saved as a project when no other signal would keep it after the first day of work.
 */
export function jobKindForNewJob(facts: JobKindFacts): JobKind | null {
  const read = jobKind(facts)
  if (read.settled) return read.kind
  if (read.source !== 'priced_before_work') return null
  return jobKind({ ...facts, firstWorkDate: undefined, pricedOn: undefined }).kind === 'project' ? null : 'project'
}

/** The one sentence under the two presses when the signals settle nothing (the mock-up's words). */
export const JOB_KIND_CONTROL_HELP = 'A service call is priced by the work and billed at the end. A project is priced before it starts and moves only by change orders.'
