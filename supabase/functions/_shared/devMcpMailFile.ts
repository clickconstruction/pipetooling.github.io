/**
 * A file off a mail (server 0.29.0, the PR after v2.6565): `read_mail_file` hands one file on a `search_mail` hit back
 * as base64; `plan_mail_file` → `apply_mail_file` takes it straight off the mail and files it where it belongs — a
 * job's Drive folder as the Documents tab's Add a file does (drive-link's `put`, as the dev), a person's HR file as a
 * piece of evidence (`plan_person_evidence` → `apply_person_evidence`), or a legal matter's Evidence tab
 * (`plan_matter_document` → `apply_matter_document`) — the bytes read from Gmail on the server and never passing
 * through the agent. The pure half: the arguments, the file picked off the mail by its name, the inner verb's
 * arguments, the job landing's commitment, the words.
 */
import type { EmailFile } from './gcKernels/lib/emailIn/gmailMessage.ts'
import type { MailAccount } from './devMcpMailSearch.ts'

/** The most bytes a file off a mail may hold: the evidence and document doors' own cap, and drive-link's `put`. */
export const MAIL_FILE_MAX_BYTES = 10 * 1024 * 1024

/** Where a file lands on a job, as drive-link's `put` names the landings (the Documents tab's Add a file sends `top`). */
export const MAIL_FILE_JOB_WHERES = ['top', 'plans', 'pictures', 'sent', 'photos'] as const
export type MailFileJobWhere = (typeof MAIL_FILE_JOB_WHERES)[number]

export type MailFileJobRef = { jobs_ledger_id: string } | { bid_id: string } | { project_id: string }

export type MailFileTarget =
  | { kind: 'job'; job: MailFileJobRef; where: MailFileJobWhere }
  | { kind: 'person_evidence'; evidence: Record<string, unknown> }
  | { kind: 'matter_document'; document: Record<string, unknown> }

export interface MailFileArgs {
  account: MailAccount
  id: string
  /** The file's name on the mail, as `read_mail` lists it. */
  name: string
  to: MailFileTarget
  /** The call log's target. */
  target: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GMAIL_ID = /^[A-Za-z0-9_-]{4,64}$/

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

/** `read_mail_file`'s arguments: the account, the hit's id and the file's name. */
export function mailFileReadArgs(args: Record<string, unknown>, known: readonly MailAccount[]): { ok: true; account: MailAccount; id: string; name: string } | { ok: false; error: string } {
  const base = mailFileBase(args, known, 'read_mail_file')
  if (!base.ok) return base
  return { ok: true, account: base.account, id: base.id, name: base.name }
}

function mailFileBase(args: Record<string, unknown>, known: readonly MailAccount[], verb: string): { ok: true; account: MailAccount; id: string; name: string } | { ok: false; error: string } {
  const account = typeof args.account === 'string' ? args.account.trim().toLowerCase() : ''
  const id = typeof args.id === 'string' ? args.id.trim() : ''
  const name = typeof args.name === 'string' ? args.name.trim() : ''
  if (!account || !id || !name) return { ok: false, error: `${verb} needs account (the address a search_mail hit names), id (its Gmail id) and name (the file's name as read_mail lists it).` }
  const found = known.find((a) => a.email.toLowerCase() === account)
  if (!found) return { ok: false, error: `"${args.account}" is not a login of the Workspace the delegation covers. ${verb} reads the company’s own mailboxes and no other.` }
  if (!GMAIL_ID.test(id)) return { ok: false, error: `"${id}" is not a Gmail message id (the id a search_mail hit carries).` }
  return { ok: true, account: found, id, name }
}

/**
 * `plan_mail_file` / `apply_mail_file`'s arguments: `file = { account, id, name, to }`, where `to` is one of
 * `{ kind: 'job', jobs_ledger_id | bid_id | project_id, where? }`, `{ kind: 'person_evidence', person_id, dated_on, title,
 * memo, entry_id?, counsel_only? }` or `{ kind: 'matter_document', matter_id, title, shows, dated_on?, state?, … }`.
 * The inner door checks the rest of an evidence record or a document as it does for its own verbs.
 */
export function mailFileArgs(args: Record<string, unknown>, known: readonly MailAccount[]): { ok: true; value: MailFileArgs } | { ok: false; error: string } {
  const file = obj(args.file)
  if (!file) return { ok: false, error: "plan_mail_file needs file — { account, id, name, to: { kind: job | person_evidence | matter_document, … } }." }
  const base = mailFileBase(file, known, 'plan_mail_file')
  if (!base.ok) return base
  const to = obj(file.to)
  const kind = to ? String(to.kind ?? '') : ''
  let target: MailFileTarget
  if (kind === 'job') {
    const ref = jobRefOf(to!)
    if (!ref) return { ok: false, error: "to.kind job needs one of jobs_ledger_id (a Pipeline job — find_job), bid_id or project_id, a uuid." }
    const where = to!.where === undefined || to!.where === null ? 'top' : (MAIL_FILE_JOB_WHERES.find((w) => w === to!.where) ?? null)
    if (!where) return { ok: false, error: `to.where is one of ${MAIL_FILE_JOB_WHERES.join(' | ')} (top, the job's folder itself, when left out).` }
    target = { kind: 'job', job: ref, where }
  } else if (kind === 'person_evidence') {
    const person = typeof to!.person_id === 'string' && UUID.test(to!.person_id) ? to!.person_id : ''
    if (!person) return { ok: false, error: 'to.kind person_evidence needs person_id (a people.id — get_person_file resolves a login or a name), dated_on, title and memo, as plan_person_evidence takes them.' }
    const { kind: _k, ...rest } = to!
    target = { kind: 'person_evidence', evidence: rest }
  } else if (kind === 'matter_document') {
    const matter = typeof to!.matter_id === 'string' && UUID.test(to!.matter_id) ? to!.matter_id : ''
    if (!matter) return { ok: false, error: 'to.kind matter_document needs matter_id (a legal_matters.id), title and shows, as plan_matter_document takes them.' }
    const { kind: _k, ...rest } = to!
    target = { kind: 'matter_document', document: rest }
  } else {
    return { ok: false, error: "file.to.kind is job (the job's Drive folder), person_evidence (a person's HR file) or matter_document (a matter's Evidence tab)." }
  }
  const target_label = target.kind === 'job' ? `job ${Object.values(target.job)[0]}` : target.kind === 'person_evidence' ? `person ${String(target.evidence.person_id)}` : `matter ${String(target.document.matter_id)}`
  return { ok: true, value: { account: base.account, id: base.id, name: base.name, to: target, target: target_label } }
}

function jobRefOf(to: Record<string, unknown>): MailFileJobRef | null {
  for (const key of ['jobs_ledger_id', 'bid_id', 'project_id'] as const) {
    const v = to[key]
    if (typeof v === 'string' && UUID.test(v)) return { [key]: v } as MailFileJobRef
  }
  return null
}

/** The file on the mail whose name is `name` (case-blind, exact first, then the one that starts with it), or the names to pick from. */
export function pickMailFile(files: readonly EmailFile[], name: string): { ok: true; file: EmailFile } | { ok: false; error: string } {
  const want = name.trim().toLowerCase()
  const real = files.filter((f) => !f.inline)
  const exact = real.filter((f) => f.name.toLowerCase() === want)
  if (exact.length === 1) return { ok: true, file: exact[0]! }
  if (exact.length > 1) return { ok: false, error: `${exact.length} files on that mail are named "${name}"; a name has to pick one.` }
  const starts = real.filter((f) => f.name.toLowerCase().startsWith(want))
  if (starts.length === 1) return { ok: true, file: starts[0]! }
  const names = real.map((f) => f.name)
  if (names.length === 0) return { ok: false, error: 'That mail carries no file (pictures placed in the body are left out).' }
  return { ok: false, error: `No file named "${name}" on that mail. Its files: ${names.map((n) => `"${n}"`).join(', ')}.` }
}

/** Standard base64 of bytes, in pieces so a 10 MB file never builds one call's argument list. */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step))
  return btoa(bin)
}

export interface MailFileBytes {
  name: string
  mime: string
  size_bytes: number
  sha256: string
  /** Standard base64. */
  content_base64: string
}

/** `read_mail_file`'s reply: the file whole, with where it came from. */
export function mailFileReadReply(account: string, id: string, file: MailFileBytes): Record<string, unknown> {
  return { account, id, ...file }
}

/** The inner verb and its arguments for an evidence record or a matter document: the file as content_base64. */
export function innerVerbFor(step: 'plan' | 'apply', to: Exclude<MailFileTarget, { kind: 'job' }>, file: MailFileBytes, planHash: string | null): { verb: string; args: Record<string, unknown> } {
  if (to.kind === 'person_evidence') {
    const evidence = { ...to.evidence, files: [{ name: file.name, content_base64: file.content_base64, mime: file.mime }] }
    return { verb: `${step}_person_evidence`, args: step === 'apply' ? { evidence, plan_hash: planHash } : { evidence } }
  }
  const document = { ...to.document, original_name: file.name, content_base64: file.content_base64, mime: file.mime }
  return { verb: `${step}_matter_document`, args: step === 'apply' ? { document, plan_hash: planHash } : { document } }
}

/** What a job landing commits to: the job, the landing and the file's facts. The hash is over this alone. */
export interface MailFileJobCommitment {
  job: MailFileJobRef
  job_label: string
  where: MailFileJobWhere
  file: { name: string; mime: string; size_bytes: number; sha256: string }
  from: { account: string; id: string }
}

export function jobCommitment(args: MailFileArgs, jobLabel: string, file: MailFileBytes): MailFileJobCommitment {
  if (args.to.kind !== 'job') throw new Error('jobCommitment takes a job target')
  return { job: args.to.job, job_label: jobLabel, where: args.to.where, file: { name: file.name, mime: file.mime, size_bytes: file.size_bytes, sha256: file.sha256 }, from: { account: args.account.email, id: args.id } }
}

export const MAIL_FILE_WHERE_WORDS: Readonly<Record<MailFileJobWhere, string>> = {
  top: "the job's folder itself",
  plans: "the job's Plans folder",
  pictures: "the job's Customer Pictures folder",
  sent: 'Team only › Sent by us',
  photos: 'Team only › Photos',
}

/** `plan_mail_file`'s reply for a job landing. */
export function jobPlanReply(commitment: MailFileJobCommitment, hash: string): Record<string, unknown> {
  return {
    plan_hash: hash,
    next: `Read this plan. If it is what you meant, call apply_mail_file with the same file and plan_hash: "${hash.slice(0, 12)}…" (the whole value). apply reads the file off the mail again and writes only when it is the same bytes. One apply per plan.`,
    lands: `${commitment.file.name} (${commitment.file.mime}, ${kbWords(commitment.file.size_bytes)}) into ${MAIL_FILE_WHERE_WORDS[commitment.where]} of ${commitment.job_label}.`,
    ...commitment,
  }
}

export function jobApplyReply(commitment: MailFileJobCommitment, put: { driveFileId: string; url: string }): Record<string, unknown> {
  return { filed: `${commitment.file.name} is in ${MAIL_FILE_WHERE_WORDS[commitment.where]} of ${commitment.job_label}.`, drive_file_id: put.driveFileId, url: put.url, ...commitment }
}

const kbWords = (n: number): string => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/** The words when what apply sees — the job, the landing or the file's bytes read off the mail again — is not what the plan saw. */
export function mailFileChangedWords(name: string): string {
  return `${name} as read now is not what the plan saw (the job, the landing or the file's bytes differ), so nothing was written. Plan again.`
}

/** The words when a plan was applied already. */
export function mailFileAppliedWords(prior: { target: string | null; at: string | null }): string {
  return `This plan was applied already${prior.at ? ` at ${prior.at}` : ''}${prior.target ? ` (${prior.target})` : ''}. The file is where the plan said; plan again only for another file or another place.`
}
