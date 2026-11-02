import { JOB_KIND_WORDS, jobKindOfRow, type JobKind, type JobKindFixture, type JobKindRowLike } from '../jobs/jobKind'
import { contractJobLabel } from './fillInContracts'
import { fillInRowKey, type FillInRowBase } from './fillIn'

/**
 * The job-kind kind (punch list #238, PR 2): the rows behind the Needs you line *N jobs working have
 * no kind*, the working jobs `jobKind` reads as not set. One row per job, newest first: the money,
 * the signals the kernel had, what the hours and the billing say, and a lean from the hours when
 * they plainly lean. The answer is one press, Project or Service call, the same write as the Kind
 * control on Edit Job (`saveJobKind`); Skip and Undo are the shell's. A job the signals settle never
 * reaches the deck, so there is nothing plain left to stamp in bulk. Pure; `fillInJobKindsIo.ts`
 * reads and writes.
 */
export type JobKindJobSource = JobKindRowLike & {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  customer_name: string | null
  created_at: string | null
}

export type JobKindFixtureSource = JobKindFixture & { job_id: string }

/** An approved clock session on a candidate job. */
export type JobKindSessionSource = { job_ledger_id: string; user_id: string | null; work_date: string; clocked_in_at: string | null; clocked_out_at: string | null }

export type JobKindBillSource = { job_id: string; amount: number | null; status: string | null }

export type JobKindCandidates = { jobs: readonly JobKindJobSource[]; fixtures: readonly JobKindFixtureSource[] }

/** `sessions` or `bills` null: that read failed, so the row leaves its line out rather than say nothing happened. */
export type JobKindSources = JobKindCandidates & { sessions: readonly JobKindSessionSource[] | null; bills: readonly JobKindBillSource[] | null }

export type JobKindFillInRow = FillInRowBase & {
  kind: 'job-kind'
  jobId: string
  jobLabel: string
  createdAt: string | null
  /** The press the hours lean to; null when they do not plainly lean. Never a decision. */
  lean: JobKind | null
}

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

const dollars = (raw: number | string | null | undefined): number => {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function byJob<T>(rows: readonly T[], jobOf: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const r of rows) (out.get(jobOf(r)) ?? out.set(jobOf(r), []).get(jobOf(r))!).push(r)
  return out
}

/** The working jobs the kernel reads as not set, in the order given. A blank status reads as working, as the board has it. */
export function jobsWithNoKind<T extends JobKindJobSource>(jobs: readonly T[], fixtures: readonly JobKindFixtureSource[]): T[] {
  const fixturesOf = byJob(fixtures, (f) => f.job_id)
  return jobs.filter((j) => (j.status ?? 'working') === 'working' && !j.billing_only && jobKindOfRow({ ...j, fixtures: fixturesOf.get(j.id) ?? [] }).kind === null)
}

export type JobKindHours = { hours: number; people: number; spanDays: number }

function ymdDay(ymd: string): number {
  return Math.round(Date.parse(`${ymd.slice(0, 10)}T12:00:00Z`) / 86_400_000)
}

/** What the clock says about one job: the hours of its closed sessions, how many people, first day to last. */
export function jobKindHours(sessions: readonly JobKindSessionSource[]): JobKindHours | null {
  if (sessions.length === 0) return null
  let hours = 0
  const people = new Set<string>()
  const days: number[] = []
  for (const s of sessions) {
    if (s.user_id) people.add(s.user_id)
    const day = ymdDay(s.work_date)
    if (Number.isFinite(day)) days.push(day)
    const ms = Date.parse(s.clocked_out_at ?? '') - Date.parse(s.clocked_in_at ?? '')
    if (Number.isFinite(ms) && ms > 0) hours += ms / 3_600_000
  }
  return { hours, people: people.size, spanDays: days.length ? Math.max(...days) - Math.min(...days) + 1 : 0 }
}

const spanWords = (days: number): string => (days < 14 ? `${days} day${days === 1 ? '' : 's'}` : `${Math.round(days / 7)} weeks`)
const peopleWords = (n: number): string => (n === 1 ? '1 person' : `${n} people`)

export function jobKindHoursWords(h: JobKindHours | null): string {
  if (!h) return 'No approved clock time on it yet.'
  const hours = Math.round(h.hours)
  return `Clocked ${hours} hour${hours === 1 ? '' : 's'} over ${spanWords(h.spanDays)} by ${peopleWords(h.people)}.`
}

export function jobKindBillWords(revenue: number, bills: readonly JobKindBillSource[]): string {
  const sent = bills.filter((b) => b.status === 'billed' || b.status === 'paid')
  if (sent.length === 0) return revenue > 0 ? `Not billed yet, with ${usd(revenue)} on the job.` : 'Not billed yet, and no price on the job.'
  const billed = sent.reduce((sum, b) => sum + dollars(b.amount), 0)
  const times = sent.length === 1 ? 'once' : sent.length === 2 ? 'twice' : `${sent.length} times`
  const left = revenue - billed
  return left > 0 ? `Billed ${times}, ${usd(billed)}, with ${usd(left)} left.` : `Billed ${times}, ${usd(billed)}.`
}

/** Three weeks and two people reads like a project. */
export const JOB_KIND_LEAN_PROJECT_DAYS = 21
export const JOB_KIND_LEAN_PROJECT_PEOPLE = 2
/** Two days or fewer reads like a service call. */
export const JOB_KIND_LEAN_SERVICE_DAYS = 2

/** The hours' lean, in words the card shows. A hint and never a decision: the press is the office's. */
export function jobKindLean(h: JobKindHours | null): { kind: JobKind; words: string } | null {
  if (!h || h.spanDays === 0) return null
  if (h.spanDays >= JOB_KIND_LEAN_PROJECT_DAYS && h.people >= JOB_KIND_LEAN_PROJECT_PEOPLE) {
    return { kind: 'project', words: `${spanWords(h.spanDays)} and ${peopleWords(h.people)} on one job reads like a project. The press is yours.` }
  }
  if (h.spanDays <= JOB_KIND_LEAN_SERVICE_DAYS) {
    return { kind: 'service', words: `${spanWords(h.spanDays)} on the job reads like a service call. The press is yours.` }
  }
  return null
}

/** The newest job first, then the higher number. */
export function compareJobKindRows(a: JobKindFillInRow, b: JobKindFillInRow): number {
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.jobLabel.localeCompare(a.jobLabel, undefined, { numeric: true })
}

export function jobKindFillInRows(s: JobKindSources): JobKindFillInRow[] {
  const fixturesOf = byJob(s.fixtures, (f) => f.job_id)
  const sessionsOf = byJob(s.sessions ?? [], (x) => x.job_ledger_id)
  const billsOf = byJob(s.bills ?? [], (b) => b.job_id)
  return jobsWithNoKind(s.jobs, s.fixtures)
    .map((job): JobKindFillInRow => {
      const jobLabel = contractJobLabel(job)
      const customer = (job.customer_name ?? '').trim() || null
      const revenue = dollars(job.revenue)
      const hours = s.sessions ? jobKindHours(sessionsOf.get(job.id) ?? []) : null
      const lean = jobKindLean(hours)
      const knows = [jobKindOfRow({ ...job, fixtures: fixturesOf.get(job.id) ?? [] }).reason]
      if (s.sessions) knows.push(jobKindHoursWords(hours))
      if (s.bills) knows.push(jobKindBillWords(revenue, billsOf.get(job.id) ?? []))
      if (lean) knows.push(lean.words)
      return {
        key: fillInRowKey('job-kind', job.id),
        kind: 'job-kind',
        severity: 'gray',
        title: [jobLabel, customer, revenue > 0 ? usd(revenue) : null].filter(Boolean).join(' · '),
        knows,
        doorHref: `/jobs?tab=stages&edit=${encodeURIComponent(job.id)}`,
        doorLabel: 'Open the job',
        jobId: job.id,
        jobLabel,
        createdAt: job.created_at,
        lean: lean?.kind ?? null,
      }
    })
    .sort(compareJobKindRows)
}

/** The saved line under the deck. */
export function jobKindTrailWords(kind: JobKind): string {
  return `${JOB_KIND_WORDS[kind]} · saved on the job`
}
