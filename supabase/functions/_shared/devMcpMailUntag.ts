/**
 * A conversation taken back off its job from the dev seat (server 0.79.0): `plan_mail_untag` → `apply_mail_untag` run
 * gmail-mine's own untag — the Messages → My email press — as the login whose box the conversation is in, through the
 * seat's door on that function (`as`, `plan`), for a tag the seat made and no other. The person's lines of the
 * conversation go with their files and raw copies, a line the office keeps something on stays, a matter keeps its own
 * copy, a line of the boxes is untied only when the tag tied it, the grey line and the row go. Gmail is not touched. The
 * seat's untag also clears what would still show who was written to: the ties the tag made onto the job's people and
 * the contacts it made for a sender nobody knew, once they keep no line. The pure half: the arguments, the commitment
 * the plan hashes (the box, the conversation, the job, and every line, tie and contact the untag would touch), the words.
 */
import type { MyMailUntagHeldWhy, MyMailUntagOk, MyMailUntagPlanOk } from './gcKernels/lib/myMail/contract.ts'
import type { MailAccount } from './devMcpMailSearch.ts'

export interface MailUntagArgs {
  account: MailAccount
  threadId: string
  /** The call log's target. */
  target: string
}

const GMAIL_ID = /^[A-Za-z0-9_-]{4,64}$/

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/**
 * `plan_mail_untag` / `apply_mail_untag`'s arguments: `untag = { account, thread_id }`. An archived login's box is
 * taken: an untag only takes off, so the lines of a teammate who has left since can still come off.
 */
export function mailUntagArgs(args: Record<string, unknown>, known: readonly MailAccount[]): { ok: true; value: MailUntagArgs } | { ok: false; error: string } {
  const untag = obj(args.untag)
  if (!untag) return { ok: false, error: 'plan_mail_untag needs untag — { account, thread_id }.' }
  const account = typeof untag.account === 'string' ? untag.account.trim().toLowerCase() : ''
  const threadId = typeof untag.thread_id === 'string' ? untag.thread_id.trim() : ''
  if (!account || !threadId) return { ok: false, error: 'untag needs account (the address the tag named) and thread_id (the conversation the tag named).' }
  const found = known.find((a) => a.email.toLowerCase() === account)
  if (!found) return { ok: false, error: `"${untag.account}" is not a login of the Workspace the delegation covers. An untag reads the company’s own mailboxes and no other.` }
  if (!GMAIL_ID.test(threadId)) return { ok: false, error: `"${threadId}" is not a Gmail thread id (the thread_id the tag carried).` }
  if (untag.job !== undefined || untag.person !== undefined) return { ok: false, error: 'untag names a conversation alone — { account, thread_id }. It comes off the job it is on; a follow onto an HR file is lifted with plan_mail_tag and stop.' }
  return { ok: true, value: { account: found, threadId, target: `thread ${threadId}` } }
}

/** What the plan commits to: the box, the conversation, the job it is on, and everything the untag would touch. The hash is over this alone. */
export interface MailUntagCommitment {
  account: string
  thread_id: string
  job_key: string
  remove: string[]
  held: Array<{ id: string; why: MyMailUntagHeldWhy }>
  untie: string[]
  files: number
  kept_for_matter: number
  grey_line: boolean
  ties: string[]
  ties_left: number
  contacts: string[]
  contacts_left_empty: number
}

export function untagCommitment(args: MailUntagArgs, preview: MyMailUntagPlanOk): MailUntagCommitment {
  return {
    account: args.account.email,
    thread_id: args.threadId,
    job_key: preview.jobKey,
    remove: preview.remove,
    held: preview.held,
    untie: preview.untie,
    files: preview.files,
    kept_for_matter: preview.keptForMatter,
    grey_line: preview.greyLine,
    ties: preview.sweep.ties,
    ties_left: preview.sweep.tiesLeft,
    contacts: preview.sweep.contacts,
    contacts_left_empty: preview.sweep.contactsLeftEmpty,
  }
}

const words = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

const HELD_WORDS: Readonly<Record<MyMailUntagHeldWhy, string>> = { promise: 'a promise written down on it', highlight: 'a highlight on it', owed: 'what we owe was done by it' }

/** The plan's counts: how many lines each thing holds. */
export function untagHeldCounts(c: Pick<MailUntagCommitment, 'held'>): Record<MyMailUntagHeldWhy, number> {
  const out: Record<MyMailUntagHeldWhy, number> = { promise: 0, highlight: 0, owed: 0 }
  for (const h of c.held) out[h.why]++
  return out
}

/** One line on what the untag would take off. */
export function untagReading(c: MailUntagCommitment): string {
  const held = untagHeldCounts(c)
  const why = (Object.keys(held) as MyMailUntagHeldWhy[]).filter((k) => held[k] > 0).map((k) => `${held[k]} for ${HELD_WORDS[k]}`)
  return [
    `${words(c.remove.length, 'line goes', 'lines go')} with ${words(c.files, 'file', 'files')} and each line's raw copy`,
    `${words(c.untie.length, 'line of the boxes comes', 'lines of the boxes come')} off the job and ${c.untie.length === 1 ? 'stays' : 'stay'} in Messages`,
    c.held.length > 0 ? `${words(c.held.length, 'line stays', 'lines stay')} on the job (${why.join(', ')})` : 'no line is held',
    c.kept_for_matter > 0 ? `a legal matter keeps its own copy of ${words(c.kept_for_matter, 'document', 'documents')} made from them` : 'no legal matter holds a copy',
    `${c.grey_line ? 'the grey line and the tag' : 'the tag'} ${c.grey_line ? 'go' : 'goes'}`,
    'nothing changes in Gmail',
  ].join('; ') + '.'
}

/** What the untag clears beyond the lines, and what is left behind that still shows who was written to, in words. */
export function untagLeftWords(c: MailUntagCommitment): string {
  const cleared = [
    `${words(c.ties.length, 'person comes', 'people come')} off the job's people`,
    `${words(c.contacts.length, 'contact the tag made goes', 'contacts the tag made go')} with ${c.contacts.length === 1 ? 'its' : 'their'} address`,
  ]
  const left: string[] = []
  if (c.held.length > 0) left.push(`${words(c.held.length, 'held line stays', 'held lines stay')} readable on the job with ${c.held.length === 1 ? 'its' : 'their'} files: clear what the office keeps on ${c.held.length === 1 ? 'it' : 'them'} first, then plan again`)
  if (c.ties_left > 0) left.push(`${words(c.ties_left, 'person stays', 'people stay')} on the job's people with no line there (put there before the tag, or starred): take them off in Messages`)
  if (c.contacts_left_empty > 0) left.push(`${words(c.contacts_left_empty, 'contact stays', 'contacts stay')} in Messages with no line (known before the tag, or named since)`)
  return `Cleared with the lines: ${cleared.join(', ')}. Left: ${left.length > 0 ? left.join('; ') : 'nothing that names who was written to'}. Never touched: a line the boxes wrote stays in its person's thread, each thread's state (open or done, who has it) stays as it is, a notification already sent is not recalled, and the job's activity held nothing of the tag but these lines.`
}

/** `plan_mail_untag`'s reply. */
export function untagPlanReply(commitment: MailUntagCommitment, hash: string): Record<string, unknown> {
  return {
    plan_hash: hash,
    next: `Read this plan. If it is what you meant, call apply_mail_untag with the same untag and plan_hash: "${hash.slice(0, 12)}…" (the whole value). apply plans again first and untags only when the conversation is as the plan saw it. There is no undo: the lines, their files and their raw copies are deleted; the mail itself stays in ${commitment.account}'s Gmail. One apply per plan.`,
    reading: untagReading(commitment),
    left: untagLeftWords(commitment),
    after: 'The follow stops with the tag, and the app’s own Sent read will not put the conversation back. It may then go onto a person’s HR file (plan_mail_tag with person) or be tagged again.',
    held_why: untagHeldCounts(commitment),
    ...commitment,
  }
}

/** `apply_mail_untag`'s reply. */
export function untagApplyReply(commitment: MailUntagCommitment, done: MyMailUntagOk): Record<string, unknown> {
  const swept = done.swept ?? { ties: 0, tiesLeft: 0, contacts: 0, contactsLeftEmpty: 0 }
  return {
    untagged: `${words(done.removed, 'line', 'lines')} removed with ${done.removed === 1 ? 'its' : 'their'} files and raw copies, ${words(done.untied ?? 0, 'line', 'lines')} of the boxes untied, ${words(done.held ?? 0, 'line', 'lines')} held; ${words(swept.ties, 'person', 'people')} off the job's people and ${words(swept.contacts, 'contact', 'contacts')} the tag made removed; the grey line and the tag are gone. Nothing changed in Gmail.`,
    removed: done.removed,
    held: done.held ?? 0,
    untied: done.untied ?? 0,
    kept_for_matter: done.keptForMatter,
    ties_removed: swept.ties,
    ties_left: swept.tiesLeft,
    contacts_removed: swept.contacts,
    contacts_left_empty: swept.contactsLeftEmpty,
    account: commitment.account,
    thread_id: commitment.thread_id,
    job_key: commitment.job_key,
  }
}

/** The words when the plan at apply is not the plan quoted. */
export function mailUntagChangedWords(): string {
  return 'The conversation is not as the plan saw it (a mail landed, a line moved, or the office kept something on a line), so nothing was taken off. Plan again.'
}

/** The words when a plan was applied already. */
export function mailUntagAppliedWords(prior: { target: string | null; at: string | null }): string {
  return `This plan was applied already${prior.at ? ` at ${prior.at}` : ''}${prior.target ? ` (${prior.target})` : ''}. The conversation is off the job; an untag that stopped partway is finished by planning again.`
}
