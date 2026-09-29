/**
 * Settings → Data & recovery → "ZZ test jobs (dev)" — the sweep's rules (v2.4157).
 *
 * Live passes and twins leave `ZZ`-prefixed jobs on the Pipeline (GLOSSARY → ZZ
 * convention): the office scrolls past them and their bids sit inside the money
 * strip. This kernel finds them and sweeps each the sanctioned way — its Job
 * total zeroed and its Specific Work lines removed, then
 * `migrate_job_ledger_costs_and_delete` into the sink: the one ZZ job kept on
 * purpose, named with the word "sink" (`ZZ TEST sink`). Costs, hours, notes and
 * reports land there, the row is deleted, and the deleted-records archive keeps
 * it 90 days. The sink must itself be a ZZ job, so the sweep can never fold a
 * test row into a customer's job; a job numbered like an old sink is not one.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

/** The word in a ZZ job's name that marks it as the sink (any case). */
export const ZZ_SWEEP_SINK_WORD = 'sink'
/** What to name the sink when there is none. */
export const ZZ_SWEEP_SINK_SUGGESTED_NAME = 'ZZ TEST sink'
export const ZZ_SWEEP_DEFAULT_MIN_AGE_DAYS = 7

/** PostgREST select for the rows the plan reads. */
export const ZZ_TEST_JOBS_SELECT = 'id, hcp_number, click_number, job_name, customer_name, status, revenue, created_at'
/** PostgREST `.or()` filter — the server-side half of `isZzTestJob`; the plan re-checks. */
export const ZZ_TEST_JOBS_OR_FILTER = 'job_name.ilike.ZZ%,customer_name.ilike.ZZ%'

export type ZzJobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  customer_name: string | null
  status: string | null
  revenue: number | string | null
  created_at: string | null
}

export type ZzSweepRow = {
  id: string
  /** Displayed job number (HCP, else Click) or '—'. */
  jobNumber: string
  jobName: string
  customerName: string
  status: string
  revenue: number
  createdAt: string | null
  /** Whole days since created; null when the row carries no created_at (treated as old). */
  ageDays: number | null
}

export type ZzSweepPlan = {
  /** The oldest ZZ job named with the sink word, or null — then nothing can be swept. */
  sink: ZzSweepRow | null
  /** Oldest first: ZZ rows at least `minAgeDays` old, every sink-named row excluded. */
  sweep: ZzSweepRow[]
  /** ZZ rows newer than `minAgeDays` — a live pass may still be using them. */
  tooNew: ZzSweepRow[]
  /** Rows the server filter returned that the name rule does not accept (never swept). */
  skippedNotZz: number
}

/** The ZZ convention: the name starts with "ZZ" (any case, after trimming). */
export function isZzTestName(name: string | null | undefined): boolean {
  return /^zz/i.test((name ?? '').trim())
}

/** A test job by the convention: its own name or its customer's name is a ZZ name. */
export function isZzTestJob(row: { job_name?: string | null; customer_name?: string | null }): boolean {
  return isZzTestName(row.job_name) || isZzTestName(row.customer_name)
}

/** The sink: a job whose OWN name is a ZZ name and carries the sink word (a ZZ customer alone is not enough). */
export function isZzSinkJob(row: { job_name?: string | null; customer_name?: string | null }): boolean {
  return isZzTestName(row.job_name) && new RegExp(`\\b${ZZ_SWEEP_SINK_WORD}\\b`, 'i').test(row.job_name ?? '')
}

const DAY_MS = 24 * 60 * 60 * 1000

function toSweepRow(r: ZzJobRow, now: Date): ZzSweepRow {
  const created = r.created_at ? new Date(r.created_at) : null
  const ageDays = created && !Number.isNaN(created.getTime()) ? Math.floor((now.getTime() - created.getTime()) / DAY_MS) : null
  return {
    id: r.id,
    jobNumber: effectiveJobLedgerNumber(r.hcp_number, r.click_number) || '—',
    jobName: (r.job_name ?? '').trim() || '—',
    customerName: (r.customer_name ?? '').trim() || '—',
    status: r.status ?? '',
    revenue: Number(r.revenue ?? 0) || 0,
    createdAt: r.created_at,
    ageDays,
  }
}

const oldestFirst = (a: ZzSweepRow, b: ZzSweepRow) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')

export function planZzTestJobSweep(rows: ZzJobRow[], opts: { now: Date; minAgeDays: number }): ZzSweepPlan {
  const minAge = Math.max(0, Math.floor(opts.minAgeDays))
  let skippedNotZz = 0
  const sinks: ZzSweepRow[] = []
  const sweep: ZzSweepRow[] = []
  const tooNew: ZzSweepRow[] = []
  for (const r of rows) {
    if (!isZzTestJob(r)) {
      skippedNotZz += 1
      continue
    }
    const row = toSweepRow(r, opts.now)
    if (isZzSinkJob(r)) {
      // Every sink-named row stays; the oldest is the one swept into.
      sinks.push(row)
      continue
    }
    if (row.ageDays !== null && row.ageDays < minAge) tooNew.push(row)
    else sweep.push(row)
  }
  sinks.sort(oldestFirst)
  sweep.sort(oldestFirst)
  tooNew.sort(oldestFirst)
  return { sink: sinks[0] ?? null, sweep, tooNew, skippedNotZz }
}

/** The one line under the Check button. */
export function zzSweepSummaryWords(plan: ZzSweepPlan, minAgeDays: number): string {
  const total = plan.sweep.length + plan.tooNew.length
  if (total === 0) return plan.sink ? `None found — only the sink (J${plan.sink.jobNumber}) is left.` : 'None found.'
  const jobs = (n: number) => `${n} ZZ test ${n === 1 ? 'job' : 'jobs'}`
  const parts = [jobs(total)]
  if (!plan.sink) {
    parts.push(`no sink — make a New Job named "${ZZ_SWEEP_SINK_SUGGESTED_NAME}" before sweeping`)
  } else {
    parts.push(`${plan.sweep.length} older than ${minAgeDays} ${minAgeDays === 1 ? 'day' : 'days'} can be swept into J${plan.sink.jobNumber}`)
    if (plan.tooNew.length > 0) parts.push(`${plan.tooNew.length} newer ${plan.tooNew.length === 1 ? 'stays' : 'stay'}`)
  }
  return parts.join(' · ')
}

export type ZzSweepResult = { ok: true; estimateUnlinked: boolean } | { ok: false; error: string }

function errorText(e: { message?: string } | null | undefined, fallback: string): string {
  return (e?.message ?? '').trim() || fallback
}

/**
 * Sweeps one ZZ job into the sink, in this order: the Job total to $0 (so the
 * sink's total does not grow), its Specific Work lines deleted (so they do not
 * pile up on the sink), then the migrate-and-delete RPC (costs, hours, notes,
 * reports move; the row goes to the archive). The first failure stops it — a
 * half-swept job is a ZZ job with no lines and a $0 total, still on the board.
 */
export async function sweepZzTestJobIntoSink(
  supabase: SupabaseClient,
  jobId: string,
  sinkId: string,
): Promise<ZzSweepResult> {
  if (!jobId || !sinkId || jobId === sinkId) return { ok: false, error: 'The sink cannot be swept into itself.' }
  const zero = await supabase.from('jobs_ledger').update({ revenue: 0 }).eq('id', jobId)
  if (zero.error) return { ok: false, error: errorText(zero.error, 'Could not zero the Job total') }
  const lines = await supabase.from('jobs_ledger_fixtures').delete().eq('job_id', jobId)
  if (lines.error) return { ok: false, error: errorText(lines.error, 'Could not remove the Specific Work lines') }
  const { data, error } = await supabase.rpc('migrate_job_ledger_costs_and_delete', {
    p_from: jobId,
    p_to: sinkId,
    p_allow_billed: true,
  })
  if (error) return { ok: false, error: errorText(error, 'Could not sweep the job') }
  const payload = data as { ok?: boolean; error?: string; estimate_unlinked?: unknown } | null
  if (!payload?.ok) return { ok: false, error: (payload?.error ?? '').trim() || 'Could not sweep the job' }
  return { ok: true, estimateUnlinked: payload.estimate_unlinked === true }
}
