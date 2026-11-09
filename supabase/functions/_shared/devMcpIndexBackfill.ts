/**
 * The dev seat's door to the file index (punch list #240, PR 2): what `plan_index_backfill` and `apply_index_backfill`
 * take, what a plan commits to, how the apply walks the plan's jobs with a cursor, and the words. Pure, no imports, so
 * `src/lib/devMcp/devMcpIndexBackfill.test.ts` reads it as `dev-mcp` does. The pass itself is `fileIndex.ts`, the same
 * code under drive-link's `index_job` and the sweep; this file only decides which job comes next and what to say.
 */

export const BACKFILL_SCOPES = ['live', 'paid', 'job', 'person'] as const
export type BackfillScope = (typeof BACKFILL_SCOPES)[number]

/** How many files one apply call takes at most, and the cap on a plan's jobs. */
export const BACKFILL_BATCH_DEFAULT = 25
export const BACKFILL_BATCH_MAX = 40
export const BACKFILL_JOBS_MAX = 500

export interface BackfillPlan {
  scope: BackfillScope
  /** The one job, when the scope is `job`. */
  job_id: string | null
  /** The one person, when the scope is `person` (#285, PR 3): their HR file's files and their matter's documents, through the records pass. */
  person_id: string | null
  /** At most this many jobs, oldest first (by `created_at`, then id) for the live jobs, newest first for the paid ones. */
  limit: number
  /** Held rows (slow, error, big, reading) taken again, when their last check is an hour old. */
  retry: boolean
  /** The plan's own start: the jobs after this one in the walk's order (the next cap's worth, or going on past a job that left the scope). */
  after_job: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHAPE =
  'plan_index_backfill needs plan — { scope: live | paid | job | person, job_id? (a jobs_ledger.id, with scope job), person_id? (a people.id, with scope person: the files on their HR file and their matter), limit? (jobs, at most 500), retry? (held rows again), after_job? (a jobs_ledger.id: the list starts after it) }.'

/** The plan's input, read strictly; refused in words when it is not the shape the door takes. */
export function parseBackfillPlan(input: unknown): { ok: true; plan: BackfillPlan } | { ok: false; error: string } {
  const o = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : null
  if (!o) return { ok: false, error: SHAPE }
  const scope = typeof o.scope === 'string' ? o.scope.trim() : ''
  if (!(BACKFILL_SCOPES as readonly string[]).includes(scope)) return { ok: false, error: SHAPE }
  const jobId = typeof o.job_id === 'string' ? o.job_id.trim() : ''
  if (scope === 'job' && !UUID_RE.test(jobId)) return { ok: false, error: SHAPE }
  if (scope !== 'job' && jobId) return { ok: false, error: `${SHAPE} job_id goes with scope job alone.` }
  const personId = typeof o.person_id === 'string' ? o.person_id.trim() : ''
  if (scope === 'person' && !UUID_RE.test(personId)) return { ok: false, error: SHAPE }
  if (scope !== 'person' && personId) return { ok: false, error: `${SHAPE} person_id goes with scope person alone.` }
  const afterJob = typeof o.after_job === 'string' ? o.after_job.trim() : ''
  if (afterJob && !UUID_RE.test(afterJob)) return { ok: false, error: SHAPE }
  if (afterJob && (scope === 'job' || scope === 'person')) return { ok: false, error: `${SHAPE} after_job has no place with scope ${scope}.` }
  const limitRaw = o.limit == null ? BACKFILL_JOBS_MAX : Number(o.limit)
  if (!Number.isFinite(limitRaw) || limitRaw < 1) return { ok: false, error: SHAPE }
  return {
    ok: true,
    plan: { scope: scope as BackfillScope, job_id: scope === 'job' ? jobId : null, person_id: scope === 'person' ? personId : null, limit: Math.min(BACKFILL_JOBS_MAX, Math.floor(limitRaw)), retry: o.retry === true, after_job: afterJob || null },
  }
}

/** Which jobs a scope reads: the status filter, the order and the start, as the function's query takes them. The person scope never comes here: it walks records, not jobs (`personBackfill*`). */
export function backfillJobsQuery(plan: BackfillPlan): { status: 'live' | 'paid' | 'one'; jobId: string | null; afterJob: string | null; ascending: boolean; limit: number } {
  if (plan.scope === 'job') return { status: 'one', jobId: plan.job_id, afterJob: null, ascending: true, limit: 1 }
  // The person scope never comes here (the server branches on it first); read as live so the type stays honest.
  return { status: plan.scope === 'paid' ? 'paid' : 'live', jobId: null, afterJob: plan.after_job, ascending: plan.scope !== 'paid', limit: plan.limit }
}

/**
 * The PostgREST `or` filter that starts the list after a job, in the walk's order (`created_at`, then `id`): strictly
 * after on the stamp, or the same stamp and a greater id, so jobs an import stamped alike are neither skipped nor
 * repeated. Values are quoted, since a stamp carries `:` and `.`.
 */
export function backfillAfterFilter(createdAt: string, id: string, ascending: boolean): string {
  const past = ascending ? 'gt' : 'lt'
  return `created_at.${past}."${createdAt}",and(created_at.eq."${createdAt}",id.${past}."${id}")`
}

/** A job as the plan lists it. */
export interface BackfillJob {
  id: string
  number: string | null
  name: string | null
  status: string | null
  /** Rows the index holds for it already, when the plan read them. */
  rows: number | null
}

/** What the plan hash commits to: the scope, the switches, the start and the job ids in order. A job added to the scope since changes it. */
export function backfillCommitment(plan: BackfillPlan, jobs: readonly BackfillJob[]): Record<string, unknown> {
  return { scope: plan.scope, job_id: plan.job_id, limit: plan.limit, retry: plan.retry, after_job: plan.after_job, job_ids: jobs.map((j) => j.id) }
}

// ── the person scope (#285, PR 3, v2.6721) ───────────────────────────────────────────────────────────────────────
// A person's HR file and their matter hold files the index reads through the records pass (`fileIndexRecords.ts`),
// not a Drive walk: the plan lists every file they carry and which have no row (or a held one), and the apply runs
// the pass over the person, a batch at a time, until the queue is empty. The commitment is the person's whole file
// list, so a file filed or removed since the plan refuses the apply while an apply that indexed files does not.

/** A record file as the person's plan lists it: the attachment or matter document, where its bytes are, the record it hangs on, and whether the index has read it. */
export interface PersonBackfillFile {
  id: string
  source: 'hr_attachment' | 'matter_document'
  name: string
  record_kind: string
  record_title: string | null
  where: 'bucket' | 'drive' | 'none'
  /** `due` has no row (or a held one an hour on); `held` has a held row the plan's `retry` would take; `read` has its words or a settled hold. */
  state: 'due' | 'held' | 'read'
}

/** The person as the plan names them. */
export interface PersonBackfillPerson {
  id: string
  name: string
}

/** What the person plan's hash commits to: the person, the switch, and every file they carry (ids sorted), read or not. */
export function personBackfillCommitment(plan: BackfillPlan, fileIds: readonly string[]): Record<string, unknown> {
  return { scope: 'person', person_id: plan.person_id, retry: plan.retry, file_ids: [...fileIds].sort() }
}

/** The person plan as the agent reads it: the counts by state, by where and by record, the first few files due, and the how. */
export function personBackfillPlanReply(plan: BackfillPlan, person: PersonBackfillPerson, files: readonly PersonBackfillFile[]): Record<string, unknown> {
  const due = files.filter((f) => f.state === 'due' || (plan.retry && f.state === 'held'))
  const count = (pick: (f: PersonBackfillFile) => string) => {
    const out: Record<string, number> = {}
    for (const f of files) out[pick(f)] = (out[pick(f)] ?? 0) + 1
    return out
  }
  return {
    scope: 'person',
    person: { id: person.id, name: person.name },
    retry: plan.retry,
    files: files.length,
    files_read: files.filter((f) => f.state === 'read').length,
    files_held: files.filter((f) => f.state === 'held').length,
    files_due: due.length,
    by_record: count((f) => f.record_kind),
    by_where: count((f) => f.where),
    first_due: due.slice(0, 8).map((f) => ({ id: f.id, name: f.name, record: f.record_kind, title: f.record_title, where: f.where })),
    reads: 'Per file: the staged copy read from its bucket, or a linked file read from Drive by the id its link names (its kind and size from Drive first). A text PDF through its text layer until its time is spent, a .eml decoded, a text file whole; a scan is held for OCR, which does not reach the bucket yet; a link that names no file is held as a kind the index does not read.',
    how:
      due.length === 0
        ? `Every file on ${person.name}'s file has its row${files.some((f) => f.state === 'held') ? ' (some held — plan again with retry: true to take them)' : ''}. Nothing to apply.`
        : `apply_index_backfill with the same plan and this plan_hash, batch ${RECORDS_BATCH_DEFAULT_WORDS} (at most ${RECORDS_BATCH_MAX_WORDS}): each call takes the next files due and answers indexed / held / remaining. Call again with the same plan while remaining is above 0; sleep a few seconds between calls. Every answer is written to file_index as it goes, so a stopped loop loses nothing. A file filed or removed on the person since the plan refuses the apply — plan again.`,
  }
}

/** The person apply's answer: what this call did and where the loop goes next. */
export function personBackfillApplyReply(person: PersonBackfillPerson, pass: { due: number; tried: number; indexed: number; held: readonly { id: string; name: string; why: string }[]; remaining: number }, filesInPlan: number): Record<string, unknown> {
  const done = pass.remaining === 0
  return {
    scope: 'person',
    person: { id: person.id, name: person.name },
    files: filesInPlan,
    due: pass.due,
    tried: pass.tried,
    indexed: pass.indexed,
    held: pass.held,
    remaining: pass.remaining,
    done,
    next: done
      ? `${person.name}'s files are indexed${pass.held.length > 0 ? `, ${pass.held.length} held with their reasons above` : ''}. Read read_file_index_status (records_without_rows) and search_case with in: files; write the counts into the card.`
      : `${pass.remaining} files to go on ${person.name}. Call apply_index_backfill again with the same plan and plan_hash (${pass.indexed} indexed this call).`,
  }
}

const RECORDS_BATCH_DEFAULT_WORDS = 10
const RECORDS_BATCH_MAX_WORDS = 25

/** The batch a person apply takes, within the records cap (10, at most 25: each is a bucket or Drive read). */
export function recordsBatch(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1) return RECORDS_BATCH_DEFAULT_WORDS
  return Math.min(RECORDS_BATCH_MAX_WORDS, Math.floor(n))
}

/** The plan as the agent reads it. */
export function backfillPlanReply(plan: BackfillPlan, jobs: readonly BackfillJob[], sweepLastAt: string | null): Record<string, unknown> {
  const withRows = jobs.filter((j) => (j.rows ?? 0) > 0).length
  const last = jobs[jobs.length - 1] ?? null
  const mayBeMore = plan.scope !== 'job' && jobs.length >= plan.limit
  return {
    scope: plan.scope,
    retry: plan.retry,
    after_job: plan.after_job,
    jobs: jobs.length,
    jobs_with_rows: withRows,
    jobs_without_rows: jobs.length - withRows,
    first_jobs: jobs.slice(0, 8).map((j) => ({ id: j.id, job: j.number, rows: j.rows })),
    last_job: last ? { id: last.id, job: last.number } : null,
    may_be_more: mayBeMore,
    sweep_last_at: sweepLastAt,
    reads: 'Per job: one to three Drive lists for its folders, then one Drive read per file not in the table (or changed since). Google Docs export as text, PDFs read through their text layer from the first page until their time is spent, a scan is held for the OCR pass; a call stops before the CPU limit and answers what remains.',
    how: `apply_index_backfill with the same plan and this plan_hash, batch ${BACKFILL_BATCH_DEFAULT} (at most ${BACKFILL_BATCH_MAX}): each call takes one job's next files and answers indexed / held / remaining and next_after. Call again with after_job = next_after until jobs_left is 0; sleep a few seconds between calls. Every answer is written to file_index as it goes, so a stopped loop loses nothing.${
      mayBeMore && last ? ` The list stops at ${plan.limit} jobs: once these are done, plan again with after_job = "${last.id}" inside the plan for the jobs after it.` : ''
    }`,
  }
}

/**
 * The job the apply works on: the first in the plan after the cursor, or null when the plan is walked. A cursor the plan
 * does not hold is `lost` (the job left the scope, or the plan was made from another start), never a silent start over.
 */
export function nextBackfillJob(jobs: readonly BackfillJob[], afterJobId: string | null): { job: BackfillJob | null; position: number; left: number; lost: boolean } {
  const at = afterJobId ? jobs.findIndex((j) => j.id === afterJobId) : -1
  if (afterJobId && at < 0) return { job: null, position: -1, left: jobs.length, lost: true }
  const position = at + 1
  const job = jobs[position] ?? null
  return { job, position, left: Math.max(0, jobs.length - position), lost: false }
}

/** The refusal when the apply's cursor is not in the plan. */
export function cursorLostWords(afterJobId: string): string {
  return `Nothing indexed: after_job ${afterJobId} is not in this plan — it left the scope, or the plan was made from another start. To go on from it, plan again with after_job = "${afterJobId}" inside the plan and apply that plan without after_job; to start this plan over, leave after_job out.`
}

/** The batch an apply takes, within the cap. */
export function backfillBatch(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1) return BACKFILL_BATCH_DEFAULT
  return Math.min(BACKFILL_BATCH_MAX, Math.floor(n))
}

/** The apply's answer: what this call did on this job, and where the loop goes next. */
export function backfillApplyReply(job: BackfillJob, pass: { indexed: number; held: readonly { id: string; name: string; why: string }[]; remaining: number; planned: number; skipped: number }, total: number, position: number, jobsInPlan: number): Record<string, unknown> {
  const done = pass.remaining === 0
  const left = jobsInPlan - position - (done ? 1 : 0)
  return {
    job: { id: job.id, job: job.number, status: job.status },
    files: total,
    indexed: pass.indexed,
    held: pass.held,
    skipped_current: pass.skipped,
    remaining: pass.remaining,
    job_done: done,
    next_after: done ? job.id : null,
    jobs_done: position + (done ? 1 : 0),
    jobs_left: left,
    next: done
      ? left > 0
        ? `Job ${job.number ?? job.id} is done. Call apply_index_backfill again with after_job = "${job.id}" for the next job (${left} left).`
        : `Job ${job.number ?? job.id} is done, and it was the last in the plan. Read read_file_index_status, then write the counts and the held files into the card.`
      : `Job ${job.number ?? job.id} has ${pass.remaining} files to go. Call apply_index_backfill again with the same after_job (${pass.indexed} indexed this call).`,
  }
}

/**
 * The apply's answer for a job it could not walk (Drive refused its folder, or the account can open none): the job is
 * passed over with its reason and the cursor moves on, so one bad folder never strands the loop; the agent names it in
 * the card.
 */
export function backfillJobPassedReply(job: BackfillJob, why: string, position: number, jobsInPlan: number): Record<string, unknown> {
  const left = jobsInPlan - position - 1
  const passed = `Job ${job.number ?? job.id} was passed over: ${why}. Its files are not indexed; name it in the card.`
  return {
    job: { id: job.id, job: job.number, status: job.status },
    files: 0,
    indexed: 0,
    held: [],
    skipped_current: 0,
    remaining: 0,
    job_done: true,
    job_passed: why,
    next_after: job.id,
    jobs_done: position + 1,
    jobs_left: left,
    next: left > 0 ? `${passed} Call apply_index_backfill again with after_job = "${job.id}" for the next job (${left} left).` : `${passed} It was the last in the plan: read read_file_index_status, then write the counts and the held files into the card.`,
  }
}

/** The line that opens a status reply, from the RPC's counts. */
export function statusReading(s: Record<string, unknown>): string {
  const n = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) : Number(s[k]) || 0)
  const rows = n('rows')
  if (rows === 0) return 'The index is empty: nothing has been indexed yet.'
  const text = n('with_text')
  const liveNo = n('live_jobs_without_rows')
  const live = n('live_jobs_with_folder')
  return `${rows} files indexed, ${text} with text; ${live - liveNo} of ${live} live jobs with a folder have rows${liveNo > 0 ? `, ${liveNo} have none yet` : ''}.`
}
