import { contractJobLabel } from './fillInContracts'

/**
 * A stage that reads 100% and is not billed (punch list #397, PR 7).
 *
 * A job's stages are its priced lines, and the crew reports a percent on each. When a stage's
 * line reaches 100% and no bill carries it, the work is done and the money has not been asked
 * for. The Pipeline's *Bill the finished work* card already counts that money across every job.
 * This is the same fact one stage at a time, with the job named, on the office's Needs you.
 *
 * It offers the bill and never sends one: the press opens the job, and a person bills.
 *
 * A job on one line is left out. Its line at 100% is the whole job, and the crew's own prompt
 * already offers **Ready to Bill** for that. Pure; `stagesDoneIo.ts` reads.
 */

/** A job that holds a finished line, as the read hands it. */
export type StagesDoneJobSource = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null; status: string | null }

/** A line on one of those jobs. Every line of the job is read, so a one-line job can be told from a staged one. */
export type StagesDoneLineSource = { id: string; job_id: string; name: string | null; count: number | string | null; line_unit_price: number | string | null; line_kind?: string | null; invoice_id: string | null; progress_pct: number | string | null }

export type StageDoneRow = { fixtureId: string; jobId: string; jobLabel: string; name: string; priceUsd: number }

export type StagesDone = {
  /** The finished, unbilled stages, the most money first. */
  rows: StageDoneRow[]
  /** What those stages add up to. */
  usd: number
  /** The jobs they sit on, in the rows' order. */
  jobIds: string[]
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}
const usd0 = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`
const priceOf = (f: StagesDoneLineSource): number => num(f.line_unit_price) * (num(f.count) || 1)
const isPriced = (f: StagesDoneLineSource): boolean => f.line_kind !== 'discount' && priceOf(f) > 0

/**
 * The stages to bill: on a Working job with two or more priced lines, a priced line the crew put at
 * 100% that sits on no bill. A Waiting job has no work to bill, and a Billed or Paid one is past this.
 */
export function stagesDone(jobs: readonly StagesDoneJobSource[], lines: readonly StagesDoneLineSource[]): StagesDone {
  const working = new Map(jobs.filter((j) => j.status === 'working').map((j) => [j.id, j] as const))
  const pricedByJob = new Map<string, number>()
  for (const f of lines) if (working.has(f.job_id) && isPriced(f)) pricedByJob.set(f.job_id, (pricedByJob.get(f.job_id) ?? 0) + 1)
  const rows: StageDoneRow[] = []
  for (const f of lines) {
    const job = working.get(f.job_id)
    if (!job || !isPriced(f) || (pricedByJob.get(f.job_id) ?? 0) < 2) continue
    if (f.invoice_id || f.progress_pct == null || num(f.progress_pct) < 100) continue
    rows.push({ fixtureId: f.id, jobId: f.job_id, jobLabel: contractJobLabel(job), name: (f.name ?? '').trim() || 'A stage', priceUsd: priceOf(f) })
  }
  rows.sort((a, b) => b.priceUsd - a.priceUsd || a.jobLabel.localeCompare(b.jobLabel) || a.name.localeCompare(b.name))
  return { rows, usd: rows.reduce((s, r) => s + r.priceUsd, 0), jobIds: [...new Set(rows.map((r) => r.jobId))] }
}

/** The line's title: *A stage reads 100% and is not billed*, *3 stages read 100% and are not billed*. */
export function stagesDoneTitle(n: number): string {
  return n === 1 ? 'A stage reads 100% and is not billed' : `${n} stages read 100% and are not billed`
}

/** Under the title: the first stage and its job with its dollars, and how much more there is. */
export function stagesDoneDetail(d: Pick<StagesDone, 'rows' | 'usd'>): string {
  const first = d.rows[0]
  if (!first) return ''
  const lead = `${first.name} on ${first.jobLabel}, ${usd0(first.priceUsd)}.`
  const more = d.rows.length - 1
  if (more <= 0) return `${lead} The crew put it at 100%. Open the job to bill it.`
  return `${lead} ${more} more, ${usd0(d.usd)} in all. The crew put each at 100%. Open a job to bill it.`
}

/** The press: it opens the job that holds the first stage. It bills nothing. */
export const STAGES_DONE_ACTION = 'Open the job'

/** The first stage's job in the Pipeline, its window open. */
export function stagesDoneHref(jobId: string | null | undefined): string {
  return jobId ? `/jobs?tab=stages&jobDetail=${jobId}` : '/jobs?tab=stages'
}
