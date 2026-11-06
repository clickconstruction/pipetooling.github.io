/**
 * A conversation tagged onto a job from the dev seat (server 0.30.0): `plan_mail_tag` → `apply_mail_tag` run
 * gmail-mine's own tag — the Messages → My email press — as the login whose box the conversation is in, through the
 * seat's door on that function (`as`, `plan`), so every mail lands on the job's Activity and notes at its own time,
 * deduplicated by Message-ID, with later mail following as the press's would. The pure half: the arguments, the
 * commitment the plan hashes (the job, the conversation, and what the tag would do with each mail), the words.
 */
import type { MyMailJobRef, MyMailTagOk, MyMailTagPlanOk } from './gcKernels/lib/myMail/contract.ts'
import type { MailAccount } from './devMcpMailSearch.ts'

export interface MailTagArgs {
  account: MailAccount
  threadId: string
  job: MyMailJobRef
  /** The call log's target. */
  target: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GMAIL_ID = /^[A-Za-z0-9_-]{4,64}$/

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** The job in the seat's words (`jobs_ledger_id` | `bid_id` | `project_id`) as gmail-mine names it (`kind`, `id`). */
export function mailTagJobOf(to: Record<string, unknown>): MyMailJobRef | null {
  for (const [key, kind] of [['jobs_ledger_id', 'pipeline'], ['bid_id', 'bid'], ['project_id', 'project']] as const) {
    const v = to[key]
    if (typeof v === 'string' && UUID.test(v)) return { kind, id: v.toLowerCase() }
  }
  return null
}

/** `plan_mail_tag` / `apply_mail_tag`'s arguments: `tag = { account, thread_id, job: { jobs_ledger_id | bid_id | project_id } }`. */
export function mailTagArgs(args: Record<string, unknown>, known: readonly MailAccount[]): { ok: true; value: MailTagArgs } | { ok: false; error: string } {
  const tag = obj(args.tag)
  if (!tag) return { ok: false, error: 'plan_mail_tag needs tag — { account, thread_id, job: { jobs_ledger_id | bid_id | project_id } }.' }
  const account = typeof tag.account === 'string' ? tag.account.trim().toLowerCase() : ''
  const threadId = typeof tag.thread_id === 'string' ? tag.thread_id.trim() : ''
  if (!account || !threadId) return { ok: false, error: "tag needs account (the address a search_mail hit names) and thread_id (the hit's thread_id)." }
  const found = known.find((a) => a.email.toLowerCase() === account)
  if (!found) return { ok: false, error: `"${tag.account}" is not a login of the Workspace the delegation covers. A tag reads the company’s own mailboxes and no other.` }
  if (found.archived) return { ok: false, error: `${found.email} is an archived login; a tag lands lines as a current person.` }
  if (!GMAIL_ID.test(threadId)) return { ok: false, error: `"${threadId}" is not a Gmail thread id (the thread_id a search_mail hit carries).` }
  const jobIn = obj(tag.job)
  const job = jobIn ? mailTagJobOf(jobIn) : null
  if (!job) return { ok: false, error: 'tag.job needs one of jobs_ledger_id (a Pipeline job — find_job), bid_id or project_id, a uuid.' }
  return { ok: true, value: { account: found, threadId, job, target: `${job.kind} ${job.id}` } }
}

/** What the plan commits to: the account, the conversation, the job, and what the tag would do with each mail. The hash is over this alone. */
export interface MailTagCommitment {
  account: string
  thread_id: string
  job: MyMailJobRef
  counts: MyMailTagPlanOk['counts']
  mails: Array<{ gmailId: string; kind: 'write' | 'tie' | 'skip'; tie?: boolean }>
  moving_from: string | null
}

export function tagCommitment(args: MailTagArgs, preview: MyMailTagPlanOk): MailTagCommitment {
  return {
    account: args.account.email,
    thread_id: args.threadId,
    job: args.job,
    counts: preview.counts,
    mails: preview.mails.map((m) => (m.kind === 'tie' ? { gmailId: m.gmailId, kind: m.kind, tie: m.tie === true } : { gmailId: m.gmailId, kind: m.kind })),
    moving_from: preview.movingFrom,
  }
}

const words = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** One line on what the tag would do. */
export function tagReading(preview: MyMailTagPlanOk): string {
  const c = preview.counts
  const parts = [`${words(c.lines, 'line', 'lines')} written`, `${words(c.tied, 'line', 'lines')} tied`, `${words(c.files, 'file', 'files')} kept`, `${words(c.skipped, 'mail', 'mails')} skipped`]
  const nothing = c.lines === 0 && c.tied === 0
  return `${words(preview.mails.length, 'mail', 'mails')} in the conversation: ${parts.join(', ')}${preview.movingFrom ? `; moves off ${preview.movingFrom}` : ''}${nothing ? '. Nothing would land: every mail is on the job already or never written' : ''}.`
}

/** `plan_mail_tag`'s reply. */
export function tagPlanReply(commitment: MailTagCommitment, preview: MyMailTagPlanOk, hash: string): Record<string, unknown> {
  return {
    plan_hash: hash,
    next: `Read this plan. If it is what you meant, call apply_mail_tag with the same tag and plan_hash: "${hash.slice(0, 12)}…" (the whole value). apply plans again first and tags only when the conversation and the job are as the plan saw them. One apply per plan.`,
    reading: tagReading(preview),
    lands: `${words(commitment.counts.lines + commitment.counts.tied, 'line', 'lines')} on ${preview.job.num ? `${preview.job.num} ` : ''}${preview.job.name}'s Activity and notes, each at its mail's own time, as ${commitment.account}.`,
    ...commitment,
    /** The job as its chip reads, and each mail with its headers and why: over the commitment's bare ids. */
    job: preview.job,
    mails: preview.mails,
  }
}

/** `apply_mail_tag`'s reply. */
export function tagApplyReply(commitment: MailTagCommitment, preview: MyMailTagPlanOk, done: MyMailTagOk): Record<string, unknown> {
  return {
    tagged: `${words(done.lines, 'line', 'lines')} written and ${words(done.tied, 'line', 'lines')} tied onto ${preview.job.num ? `${preview.job.num} ` : ''}${preview.job.name}, ${words(done.files, 'file', 'files')} kept; later mail in the conversation follows by itself.`,
    job_key: done.jobKey,
    lines: done.lines,
    tied: done.tied,
    files: done.files,
    contact_id: done.contactId,
    unknown_sender: done.unknownSender,
    ...commitment,
  }
}

/** The words when the plan at apply is not the plan quoted. */
export function mailTagChangedWords(): string {
  return 'The conversation or the job is not as the plan saw it (a mail arrived, a line moved, or the job changed), so nothing was tagged. Plan again.'
}

/** The words when a plan was applied already. */
export function mailTagAppliedWords(prior: { target: string | null; at: string | null }): string {
  return `This plan was applied already${prior.at ? ` at ${prior.at}` : ''}${prior.target ? ` (${prior.target})` : ''}. The conversation is on the job and later mail follows; plan again only for another conversation or another job.`
}
