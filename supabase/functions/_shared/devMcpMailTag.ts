/**
 * A conversation tagged onto a job from the dev seat (server 0.30.0): `plan_mail_tag` → `apply_mail_tag` run
 * gmail-mine's own tag — the Messages → My email press — as the login whose box the conversation is in, through the
 * seat's door on that function (`as`, `plan`), so every mail lands on the job's Activity and notes at its own time,
 * deduplicated by Message-ID, with later mail following as the press's would. The lines are that person's mail; the
 * tag is the dev's: its row names the dev (`tagged_by`) and its grey line on the thread says the dev tagged it from the
 * person's mail, through the dev seat. Since punch list #289 (server 0.42.0)
 * the target may be a person instead: each mail lands as a dated entry on that person's HR file, deduplicated by its
 * Gmail id, later mail following as entries; `stop` lifts that follow. The pure half: the arguments, the commitment the
 * plan hashes (the target, the conversation, and what the tag would do with each mail), the words.
 */
import type { MyMailJobRef, MyMailPersonTagOk, MyMailPersonTagPlanOk, MyMailTagOk, MyMailTagPlanOk } from './gcKernels/lib/myMail/contract.ts'
import type { MailAccount } from './devMcpMailSearch.ts'

/** The person target (punch list #289): the file the entries land on, and whether the ask is to lift the follow instead. */
export interface MailTagPerson {
  personId: string
  stop: boolean
}

export interface MailTagArgs {
  account: MailAccount
  threadId: string
  /** The job, or null when the target is a person. */
  job: MyMailJobRef | null
  /** The person, or null when the target is a job. */
  person: MailTagPerson | null
  /** The call log's target. */
  target: string
  /** `tag.for_record: true` (server 0.79.0, punch list #324): file every mail of this tag for the record, whatever its age. A job tag's alone. */
  forRecord: boolean
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

/** The person in the seat's words (`person_id`, a people.id, and `stop`) or null when `person_id` is no uuid. */
export function mailTagPersonOf(person: Record<string, unknown>): MailTagPerson | null {
  const id = person.person_id
  if (typeof id !== 'string' || !UUID.test(id)) return null
  return { personId: id.toLowerCase(), stop: person.stop === true }
}

const SHAPE = '{ account, thread_id, job: { jobs_ledger_id | bid_id | project_id } | person: { person_id, stop? }, for_record? }'

/**
 * `plan_mail_tag` / `apply_mail_tag`'s arguments: `tag = { account, thread_id, job: { jobs_ledger_id | bid_id | project_id } }`,
 * or since punch list #289 `tag = { account, thread_id, person: { person_id, stop? } }`. A job tag lands lines as the
 * login, so the login must be current; a person tag's entries are the dev's, so an archived login's box may be read.
 */
export function mailTagArgs(args: Record<string, unknown>, known: readonly MailAccount[]): { ok: true; value: MailTagArgs } | { ok: false; error: string } {
  const tag = obj(args.tag)
  if (!tag) return { ok: false, error: `plan_mail_tag needs tag — ${SHAPE}.` }
  const account = typeof tag.account === 'string' ? tag.account.trim().toLowerCase() : ''
  const threadId = typeof tag.thread_id === 'string' ? tag.thread_id.trim() : ''
  if (!account || !threadId) return { ok: false, error: "tag needs account (the address a search_mail hit names) and thread_id (the hit's thread_id)." }
  const found = known.find((a) => a.email.toLowerCase() === account)
  if (!found) return { ok: false, error: `"${tag.account}" is not a login of the Workspace the delegation covers. A tag reads the company’s own mailboxes and no other.` }
  if (!GMAIL_ID.test(threadId)) return { ok: false, error: `"${threadId}" is not a Gmail thread id (the thread_id a search_mail hit carries).` }
  const jobIn = obj(tag.job)
  const personIn = obj(tag.person)
  if (jobIn && personIn) return { ok: false, error: 'tag names both a job and a person; a conversation is tagged onto one target a call.' }
  if (personIn) {
    const person = mailTagPersonOf(personIn)
    if (!person) return { ok: false, error: 'tag.person needs person_id, a people.id (find_person), a uuid; stop: true lifts the follow instead of tagging.' }
    if (tag.for_record !== undefined) return { ok: false, error: 'for_record belongs to a tag onto a job; an HR file takes each mail as a dated entry and asks nobody.' }
    return { ok: true, value: { account: found, threadId, job: null, person, target: `person ${person.personId}`, forRecord: false } }
  }
  if (found.archived) return { ok: false, error: `${found.email} is an archived login; a tag onto a job lands lines as a current person. A tag onto a person's HR file (tag.person) may read an archived box.` }
  const job = jobIn ? mailTagJobOf(jobIn) : null
  if (!job) return { ok: false, error: `tag needs job — one of jobs_ledger_id (a Pipeline job — find_job), bid_id or project_id, a uuid — or person: { person_id } (an HR file).` }
  if (tag.for_record !== undefined && typeof tag.for_record !== 'boolean') return { ok: false, error: 'for_record is true or false: true files every mail of this tag for the record, whatever its age.' }
  return { ok: true, value: { account: found, threadId, job, person: null, target: `${job.kind} ${job.id}`, forRecord: tag.for_record === true } }
}

/** What the plan commits to: the account, the conversation, the job, and what the tag would do with each mail. The hash is over this alone. */
export interface MailTagCommitment {
  account: string
  thread_id: string
  job: MyMailJobRef
  counts: MyMailTagPlanOk['counts']
  mails: Array<{ gmailId: string; kind: 'write' | 'tie' | 'skip'; tie?: boolean }>
  moving_from: string | null
  /** Present and true when the plan was asked to file every mail for the record (server 0.79.0): an apply without it is another plan. */
  for_record?: true
}

export function tagCommitment(args: MailTagArgs, preview: MyMailTagPlanOk): MailTagCommitment {
  return {
    account: args.account.email,
    thread_id: args.threadId,
    job: args.job ?? { kind: 'pipeline', id: '' },
    counts: preview.counts,
    mails: preview.mails.map((m) => (m.kind === 'tie' ? { gmailId: m.gmailId, kind: m.kind, tie: m.tie === true } : { gmailId: m.gmailId, kind: m.kind })),
    moving_from: preview.movingFrom,
    ...(args.forRecord ? { for_record: true as const } : {}),
  }
}

/** What a person tag's plan commits to (punch list #289): the account, the conversation, the person, stop or not, whether a follow stands, and what each mail becomes. */
export interface MailTagPersonCommitment {
  account: string
  thread_id: string
  person: { person_id: string; stop: boolean }
  following: boolean
  counts: MyMailPersonTagPlanOk['counts']
  mails: Array<{ gmailId: string; kind: 'entry' | 'already' | 'skip' }>
}

export function personTagCommitment(args: MailTagArgs, preview: MyMailPersonTagPlanOk): MailTagPersonCommitment {
  return {
    account: args.account.email,
    thread_id: args.threadId,
    person: { person_id: args.person?.personId ?? '', stop: args.person?.stop === true },
    following: preview.following,
    counts: preview.counts,
    mails: preview.mails.map((m) => ({ gmailId: m.gmailId, kind: m.kind })),
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

/**
 * What the tag would do to Follow up (server 0.79.0, punch list #324): each mail's `lands` says `record` (filed for the
 * record, asks nobody) or `followUp` (lands as mail that came in today would, and a mail of theirs opens the thread).
 */
export function followUpReading(counts: Pick<MyMailTagPlanOk['counts'], 'lines' | 'filed'>): string {
  if (counts.lines === 0) return 'Nothing new would reach Follow up.'
  const live = counts.lines - counts.filed
  if (live === 0) return `All ${words(counts.lines, 'new line', 'new lines')} would be filed for the record: nothing opens on Follow up, and nobody is asked for a reply.`
  const filed = counts.filed > 0 ? `${words(counts.filed, 'line', 'lines')} would be filed for the record (older than 14 days). ` : ''
  return `${filed}${words(live, 'line', 'lines')} would land as mail that came in today: a mail of theirs opens the thread on Follow up. Pass for_record: true to file every mail instead.`
}

/** One line on what a person tag would do. */
export function personTagReading(preview: MyMailPersonTagPlanOk): string {
  const c = preview.counts
  if (preview.stop) {
    return preview.following
      ? `The follow on this conversation is lifted: later mail no longer lands on ${preview.person.name}'s file. The ${words(c.already, 'entry', 'entries')} already on the file stay.`
      : `This conversation is not followed onto ${preview.person.name}'s file; there is nothing to lift. The ${words(c.already, 'entry', 'entries')} on the file stay.`
  }
  const parts = [`${words(c.entries, 'entry', 'entries')} written`, `${words(c.already, 'mail', 'mails')} on the file already`, `${words(c.skipped, 'mail', 'mails')} skipped`]
  const nothing = c.entries === 0
  return `${words(preview.mails.length, 'mail', 'mails')} in the conversation: ${parts.join(', ')}${preview.following ? '; the follow is on already and is refreshed' : ''}${nothing ? '. No entry would be written: every mail is on the file already or never written' : ''}.`
}

/** `plan_mail_tag`'s reply. */
export function tagPlanReply(commitment: MailTagCommitment, preview: MyMailTagPlanOk, hash: string): Record<string, unknown> {
  return {
    plan_hash: hash,
    next: `Read this plan. If it is what you meant, call apply_mail_tag with the same tag and plan_hash: "${hash.slice(0, 12)}…" (the whole value). apply plans again first and tags only when the conversation and the job are as the plan saw them. One apply per plan.`,
    reading: tagReading(preview),
    // The lines are the person's mail; the tag is the dev's, and the thread says so (gmail-mine's `myMailTagEventWords`).
    lands: `${words(commitment.counts.lines + commitment.counts.tied, 'line', 'lines')} on ${preview.job.num ? `${preview.job.num} ` : ''}${preview.job.name}'s Activity and notes, each at its mail's own time, as ${commitment.account}. A new tag's grey line on the thread names you, through the dev seat. ${followUpReading(preview.counts)}`,
    ...commitment,
    /** The job as its chip reads, and each mail with its headers and why: over the commitment's bare ids. */
    job: preview.job,
    mails: preview.mails,
  }
}

/** `plan_mail_tag`'s reply for a person target. */
export function personTagPlanReply(commitment: MailTagPersonCommitment, preview: MyMailPersonTagPlanOk, hash: string): Record<string, unknown> {
  return {
    plan_hash: hash,
    next: `Read this plan. If it is what you meant, call apply_mail_tag with the same tag and plan_hash: "${hash.slice(0, 12)}…" (the whole value). apply plans again first and ${preview.stop ? 'lifts the follow' : 'writes the entries'} only when the conversation and the file are as the plan saw them. One apply per plan.`,
    reading: personTagReading(preview),
    lands: preview.stop
      ? `Nothing lands; the follow on ${preview.person.name}'s file comes off.`
      : `${words(commitment.counts.entries, 'entry', 'entries')} on ${preview.person.name}'s HR file, each on its mail's own day, as you; the mail stays in ${commitment.account}'s box and each entry carries its Gmail id. Later mail in the conversation follows as entries.`,
    ...commitment,
    /** The person as the file names them, and each mail with its headers and why: over the commitment's bare ids. */
    person: { ...commitment.person, name: preview.person.name },
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

/** `apply_mail_tag`'s reply for a person target. */
export function personTagApplyReply(commitment: MailTagPersonCommitment, preview: MyMailPersonTagPlanOk, done: MyMailPersonTagOk): Record<string, unknown> {
  return {
    tagged: done.stopped
      ? `The follow on this conversation is lifted from ${preview.person.name}'s file; the ${words(done.already, 'entry', 'entries')} on the file stay.`
      : `${words(done.entries, 'entry', 'entries')} written onto ${preview.person.name}'s HR file, ${words(done.already, 'mail', 'mails')} on the file already, ${words(done.skipped, 'mail', 'mails')} skipped; later mail in the conversation follows as entries by itself.`,
    person_id: done.personId,
    entries: done.entries,
    already: done.already,
    skipped: done.skipped,
    stopped: done.stopped,
    ...commitment,
  }
}

/** The words when the plan at apply is not the plan quoted. */
export function mailTagChangedWords(onto: 'job' | 'person' = 'job'): string {
  return onto === 'person'
    ? 'The conversation or the file is not as the plan saw it (a mail arrived, an entry landed, or the follow changed), so nothing was written. Plan again.'
    : 'The conversation or the job is not as the plan saw it (a mail arrived, a line moved, or the job changed), so nothing was tagged. Plan again.'
}

/** The words when a plan was applied already. */
export function mailTagAppliedWords(prior: { target: string | null; at: string | null }, onto: 'job' | 'person' = 'job'): string {
  const where = onto === 'person' ? 'The conversation is on the file and later mail follows; plan again only for another conversation, another person or to lift the follow.' : 'The conversation is on the job and later mail follows; plan again only for another conversation or another job.'
  return `This plan was applied already${prior.at ? ` at ${prior.at}` : ''}${prior.target ? ` (${prior.target})` : ''}. ${where}`
}
