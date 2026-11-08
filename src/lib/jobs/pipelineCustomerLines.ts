/**
 * Punch list #125, PR 1 (v2.6683): the board's read of the customer's conversation, as the rows come back from
 * `pipeline_customer_lines(p_job_ids, p_per_job)` (migration 20261108030000). Pure. Each row is one of a job's newest
 * calls, texts, emails or portal lines, with who it is with and who of ours wrote it; this file folds them into the same
 * `JobActivityMessage` Job activity reads (`jobActivityMessagesFromRows`), one list per job, oldest first, so the row's
 * box and the phone card draw a line exactly as the expanded Job activity and the customer's sheet do.
 */
import type { ContactKind } from '../contacts/kernel'
import { jobActivityMessagesFromRows, type JobActivityMessage, type JobMessageContact, type JobMessageRow } from './jobActivityMessages'

/** How many lines per job the board asks for: the sheet's three, so the box and the sheet show the same lines. */
export const PIPELINE_CUSTOMER_LINES_PER_JOB = 3

/** One row of `pipeline_customer_lines`. */
export interface PipelineCustomerLineRow {
  job_id: string
  id: string
  contact_id: string
  contact_kind: string
  contact_name: string | null
  contact_goes_by: string | null
  channel: string
  direction: string
  at: string
  who_user_id: string | null
  who_text: string | null
  who_name: string | null
  subject: string | null
  body: string | null
  duration_seconds: number | null
  summary: string | null
  transcript: string | null
  delivery: string | null
  auto: boolean | null
  tied: boolean
}

/** A row's string field, or '' when the wire left it out. */
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strOrNull = (v: unknown): string | null => (v == null ? null : str(v))

/** A wire row as the function returns it, tolerating a missing optional field; null when it is not a row at all. */
export function pipelineCustomerLineRow(r: unknown): PipelineCustomerLineRow | null {
  if (r == null || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  const jobId = str(o.job_id)
  const id = str(o.id)
  const contactId = str(o.contact_id)
  if (!jobId || !id || !contactId) return null
  return {
    job_id: jobId,
    id,
    contact_id: contactId,
    contact_kind: str(o.contact_kind),
    contact_name: strOrNull(o.contact_name),
    contact_goes_by: strOrNull(o.contact_goes_by),
    channel: str(o.channel),
    direction: str(o.direction),
    at: str(o.at),
    who_user_id: strOrNull(o.who_user_id),
    who_text: strOrNull(o.who_text),
    who_name: strOrNull(o.who_name),
    subject: strOrNull(o.subject),
    body: strOrNull(o.body),
    duration_seconds: typeof o.duration_seconds === 'number' ? o.duration_seconds : null,
    summary: strOrNull(o.summary),
    transcript: strOrNull(o.transcript),
    delivery: strOrNull(o.delivery),
    auto: typeof o.auto === 'boolean' ? o.auto : null,
    tied: o.tied === true,
  }
}

/** The row as a `messages` row, so Job activity's own mapper reads it: tied to the job, or to nothing. */
function messageRowOf(r: PipelineCustomerLineRow): JobMessageRow {
  return {
    id: r.id,
    contact_id: r.contact_id,
    channel_id: null,
    bid_id: null,
    project_id: null,
    jobs_ledger_id: r.tied ? r.job_id : null,
    channel: r.channel,
    direction: r.direction,
    who_user_id: r.who_user_id,
    who_text: r.who_text ?? '',
    at: r.at,
    subject: r.subject,
    body: r.body ?? '',
    optout_line: null,
    back_on: null,
    back_by: null,
    duration_seconds: r.duration_seconds,
    delivery: r.delivery,
    auto: r.auto,
    summary: r.summary,
    transcript: r.transcript,
    office_only: false,
  }
}

/**
 * The lines by job, each list oldest first as Job activity orders them, through `jobActivityMessagesFromRows` so a
 * line's who, words and tone are the ones the expanded view draws. A job with no lines has no entry.
 */
export function pipelineCustomerLinesByJob(rows: readonly unknown[]): Map<string, JobActivityMessage[]> {
  const byJob = new Map<string, PipelineCustomerLineRow[]>()
  for (const raw of rows) {
    const r = pipelineCustomerLineRow(raw)
    if (!r) continue
    const list = byJob.get(r.job_id)
    if (list) list.push(r)
    else byJob.set(r.job_id, [r])
  }
  const out = new Map<string, JobActivityMessage[]>()
  for (const [jobId, list] of byJob) {
    const contacts: JobMessageContact[] = []
    const seen = new Set<string>()
    const userNames: Record<string, string> = {}
    for (const r of list) {
      if (!seen.has(r.contact_id)) {
        seen.add(r.contact_id)
        contacts.push({ id: r.contact_id, name: r.contact_name ?? '', goesBy: r.contact_goes_by, kind: r.contact_kind as ContactKind })
      }
      if (r.who_user_id && r.who_name) userNames[r.who_user_id] = r.who_name
    }
    // The function already applied the untied rule and the job's start, so `since` stays open here.
    const lines = jobActivityMessagesFromRows(list.map(messageRowOf), contacts, userNames, { id: jobId, since: null })
    if (lines.length) out.set(jobId, lines)
  }
  return out
}
