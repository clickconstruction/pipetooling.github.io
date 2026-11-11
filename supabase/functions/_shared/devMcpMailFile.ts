/**
 * A file off a mail (server 0.29.0, the PR after v2.6565): `read_mail_file` hands one file on a `search_mail` hit back
 * as base64; `plan_mail_file` → `apply_mail_file` takes it straight off the mail and files it where it belongs — a
 * job's Drive folder as the Documents tab's Add a file does (drive-link's `put`, as the dev), a person's HR file as a
 * piece of evidence (`plan_person_evidence` → `apply_person_evidence`), or a legal matter's Evidence tab
 * (`plan_matter_document` → `apply_matter_document`) — the bytes read from Gmail on the server and never passing
 * through the agent. The pure half: the arguments, the file picked off the mail by its name, the inner verb's
 * arguments, the job landing's commitment, the words.
 *
 * Server 0.52.0 (v2.6806): `read_mail_file` reads in pieces. The door cuts every reply at `REPLY_MAX_CHARS`, so a file
 * over about 59 KB used to come back as base64 cut mid-string. A reply now carries at most `MAIL_FILE_SLICE_MAX_BYTES`
 * of the file with `offset`, `length` and `next_offset`, the size and the sha256 of the whole, and the words that say
 * which argument reads on (`mailFileReadReply`).
 *
 * Server 0.60.0 (v2.6880, punch list #296): `read_mail_file_text` hands back the file's words instead of its bytes —
 * a PDF's text layer, a text file, an `.eml` decoded — read on the server by the file index's own reader
 * (`fileText.ts` → `textFromBytes`) and paged by character (`mailFileTextReply`). A scan, a kind the reader does not
 * read, a file past its size and a read that failed answer in words that name `read_mail_file` (`mailFileTextHeldWords`).
 */
import { REPLY_MAX_CHARS, replyText } from './devMcpDoor.ts'
import { type FileTextRead, INDEX_TEXT_MAX_CHARS, TEXT_PDF_MAX_BYTES, TEXT_PLAIN_MAX_BYTES } from './fileIndexKernel.ts'
import type { EmailFile } from './gcKernels/lib/emailIn/gmailMessage.ts'
import { isMailFile, type MailAccount } from './devMcpMailSearch.ts'

/** The most bytes a file off a mail may hold: the evidence and document doors' own cap, and drive-link's `put`. */
export const MAIL_FILE_MAX_BYTES = 10 * 1024 * 1024

/**
 * The most bytes of a file one `read_mail_file` reply carries: 54,000 bytes are 72,000 base64 characters, which leaves
 * the door's 80,000-character reply 8,000 for the file's facts and the words. A multiple of three, so pieces read at
 * this length join as base64 text as well as bytes.
 */
export const MAIL_FILE_SLICE_MAX_BYTES = 54_000

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

/** A whole number of bytes from an argument: a number or its digits, never a fraction or a negative. */
function wholeNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,12}$/.test(v.trim()) ? Number(v.trim()) : NaN
  return Number.isInteger(n) && n >= 0 ? n : null
}

/**
 * `read_mail_file`'s arguments: the account, the hit's id and the file's name, and where in the file to read — `offset`
 * (the byte to start at, 0 when left out) and `length` (the bytes asked for; the most a reply carries when left out,
 * and never more than that).
 */
export function mailFileReadArgs(args: Record<string, unknown>, known: readonly MailAccount[]): { ok: true; account: MailAccount; id: string; name: string; offset: number; length: number | null } | { ok: false; error: string } {
  const base = mailFileBase(args, known, 'read_mail_file')
  if (!base.ok) return base
  const given = (v: unknown) => v !== undefined && v !== null
  const offset = given(args.offset) ? wholeNumber(args.offset) : 0
  if (offset === null) return { ok: false, error: 'read_mail_file: offset is the byte to start at, a whole number from 0 (a reply’s next_offset).' }
  const length = given(args.length) ? wholeNumber(args.length) : null
  if (given(args.length) && (length === null || length < 1)) return { ok: false, error: `read_mail_file: length is how many bytes to hand back, a whole number from 1; a reply carries at most ${MAIL_FILE_SLICE_MAX_BYTES}.` }
  return { ok: true, account: base.account, id: base.id, name: base.name, offset, length }
}

/** `read_mail_file_text`'s arguments: the account, the hit's id and the file's name, and `offset`, the character to start at (0 when left out). */
export function mailFileTextArgs(args: Record<string, unknown>, known: readonly MailAccount[]): { ok: true; account: MailAccount; id: string; name: string; offset: number } | { ok: false; error: string } {
  const base = mailFileBase(args, known, 'read_mail_file_text')
  if (!base.ok) return base
  const offset = args.offset !== undefined && args.offset !== null ? wholeNumber(args.offset) : 0
  if (offset === null) return { ok: false, error: 'read_mail_file_text: offset is the character to start at, a whole number from 0 (a reply’s next_offset).' }
  return { ok: true, account: base.account, id: base.id, name: base.name, offset }
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
 * memo, entry_id?, counsel_only? }` or `{ kind: 'matter_document', matter_id, title, shows, dated_on?, state?, counsel_only?, … }`.
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
  // What read_mail lists: everything but a small picture placed in the body. A PDF Apple Mail places there is a file (0.62.0).
  const real = files.filter(isMailFile)
  const exact = real.filter((f) => f.name.toLowerCase() === want)
  if (exact.length === 1) return { ok: true, file: exact[0]! }
  if (exact.length > 1) return { ok: false, error: `${exact.length} files on that mail are named "${name}"; a name has to pick one.` }
  const starts = real.filter((f) => f.name.toLowerCase().startsWith(want))
  if (starts.length === 1) return { ok: true, file: starts[0]! }
  const names = real.map((f) => f.name)
  if (names.length === 0) return { ok: false, error: 'That mail carries no file (a small picture placed in the body, such as a signature’s logo, is left out).' }
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

/** A file off a mail as its bytes, before any of it is written as base64. */
export interface MailFileRaw {
  name: string
  mime: string
  sha256: string
  bytes: Uint8Array
}

/** The file whole as base64, as the filing verbs send it on. */
export function mailFileWhole(file: MailFileRaw): MailFileBytes {
  return { name: file.name, mime: file.mime, size_bytes: file.bytes.length, sha256: file.sha256, content_base64: bytesToBase64(file.bytes) }
}

const count = (n: number): string => n.toLocaleString('en-US')

/**
 * `read_mail_file`'s reply: the bytes from `offset`, as many as were asked for and fit, as `content_base64`, with the
 * size and the sha256 of the whole file, the piece's `offset` and `length`, and `next_offset` — the argument that reads
 * on, null when this piece ends the file. A file that fits comes whole in one reply; one that does not says so in
 * `read_next`, which stands before the bytes. The reply is measured as the door writes it and the piece shortened until
 * it fits, so the door's cut never lands inside the base64.
 */
export function mailFileReadReply(account: string, id: string, file: MailFileRaw, ask: { offset: number; length: number | null } = { offset: 0, length: null }): { ok: true; reply: Record<string, unknown> } | { ok: false; error: string } {
  const size = file.bytes.length
  if (ask.offset >= size) return { ok: false, error: `offset ${count(ask.offset)} is past the end of ${file.name}, which is ${count(size)} bytes: offsets run from 0 to ${count(size - 1)}.` }
  let length = Math.min(ask.length ?? MAIL_FILE_SLICE_MAX_BYTES, MAIL_FILE_SLICE_MAX_BYTES, size - ask.offset)
  for (;;) {
    const end = ask.offset + length
    const next = end < size ? end : null
    const reply: Record<string, unknown> = { account, id, name: file.name, mime: file.mime, size_bytes: size, sha256: file.sha256, offset: ask.offset, length, next_offset: next }
    const words = mailFileReadNextWords({ size, offset: ask.offset, length, next })
    if (words) reply.read_next = words
    reply.content_base64 = bytesToBase64(file.bytes.subarray(ask.offset, end))
    if (length <= 3 || replyText(reply).length <= REPLY_MAX_CHARS) return { ok: true, reply }
    length = Math.max(3, Math.floor(length / 2 / 3) * 3)
  }
}

/** What a piece says about itself and how to read on; nothing when the reply is the whole file. */
export function mailFileReadNextWords(piece: { size: number; offset: number; length: number; next: number | null }): string | null {
  const { size, offset, length, next } = piece
  if (offset === 0 && next === null) return null
  const span = `bytes ${count(offset)} to ${count(offset + length - 1)} of ${count(size)}`
  const join = 'Decode each piece and join the bytes in order; sha256 is of the whole file, so check the joined bytes against it.'
  if (next === null) return `This is the last piece, ${span}. ${join}`
  const left = Math.ceil((size - next) / length)
  return `This is ${span}, not the whole file: a reply is cut at ${count(REPLY_MAX_CHARS)} characters, so a file comes in pieces of at most ${count(MAIL_FILE_SLICE_MAX_BYTES)} bytes. Call read_mail_file again with the same account, id and name and offset: ${next}, and on until next_offset is null (${left} more ${left === 1 ? 'call' : 'calls'} at this length). ${join}`
}

/**
 * The most characters of a file's words one `read_mail_file_text` reply carries. JSON writes a line end as two
 * characters, so 60,000 leaves the door's 80,000 room for a page of short lines and the file's facts; a text that
 * escapes to more is shortened until the reply fits.
 */
export const MAIL_FILE_TEXT_MAX_CHARS = 60_000
/** How far back from the cut a line end is looked for, so a piece ends on a whole line where one is near. */
const TEXT_LINE_END_REACH = 2_000

/** Where a piece of `text` from `offset` ends: at most `max` characters on, on a line end where one is near, never between the halves of one character. */
export function textPieceEnd(text: string, offset: number, max: number): number {
  let end = Math.min(text.length, offset + Math.max(1, max))
  if (end >= text.length) return text.length
  const line = text.lastIndexOf('\n', end - 1)
  if (line >= offset && end - (line + 1) <= TEXT_LINE_END_REACH) end = line + 1
  const last = text.charCodeAt(end - 1)
  if (last >= 0xd800 && last <= 0xdbff && end - 1 > offset) end -= 1
  return end
}

/** Why a file off a mail has no words to hand back, each naming the next press. */
export function mailFileTextHeldWords(file: { name: string; mime: string; size_bytes: number }, why: 'scan' | 'kind' | 'big' | 'slow' | 'error'): string {
  const bytes = 'Read its bytes with read_mail_file (same account, id and name).'
  switch (why) {
    case 'scan':
      return `${file.name} is a scan with no text layer, so there are no words to hand back. ${bytes} Or file it on its job with plan_mail_file → apply_mail_file: the file index reads a filed scan by OCR where OCR is set up (read_file_index_status says how many scans wait).`
    case 'kind':
      return `${file.name} (${file.mime}) is a kind of file the reader does not read: it reads a PDF’s text layer, a text file (.txt, .csv, .md) and an email (.eml). ${bytes}`
    case 'big':
      return `${file.name} is ${kbWords(file.size_bytes)}, past what the reader takes: a PDF up to ${TEXT_PDF_MAX_BYTES / 1024 / 1024} MB, a text file or an email up to ${TEXT_PLAIN_MAX_BYTES / 1024 / 1024} MB. ${bytes}`
    case 'slow':
      return `The read of ${file.name} ran out of time before a page of it was read. ${bytes}`
    case 'error':
      return `The reader could not open ${file.name} (a damaged PDF or one locked with a password reads this way). ${bytes}`
  }
}

/**
 * `read_mail_file_text`'s reply: the file's words from `offset`, at most `MAIL_FILE_TEXT_MAX_CHARS` of them and cut on a
 * line end where one is near, with where they came from (`text_source`), a PDF's `pages` and `pages_read`, `chars` (the
 * whole text's length) and `next_offset` — the argument that reads on, null when this piece ends the text. `read_next`
 * stands before the words whenever they are not the whole file's: a piece of a longer text, or a PDF the reader stopped
 * in. The reply is measured as the door writes it and the piece shortened until it fits, so the door's cut never lands
 * inside the words. A file with no words is refused in words (`mailFileTextHeldWords`).
 */
export function mailFileTextReply(account: string, id: string, file: MailFileRaw, read: FileTextRead, ask: { offset: number } = { offset: 0 }): { ok: true; reply: Record<string, unknown> } | { ok: false; error: string } {
  const facts = { name: file.name, mime: file.mime, size_bytes: file.bytes.length }
  if ('why' in read) return { ok: false, error: mailFileTextHeldWords(facts, read.why) }
  const text = read.text.replace(/\u0000/g, '')
  const chars = text.length
  if (text.trim() === '') return { ok: false, error: `${file.name} holds no words: the reader read it and found it empty. Read its bytes with read_mail_file (same account, id and name).` }
  if (ask.offset >= chars) return { ok: false, error: `offset ${count(ask.offset)} is past the end of ${file.name}’s words, which are ${count(chars)} characters: offsets run from 0 to ${count(chars - 1)}.` }
  const pages = read.pages
  const pagesRead = pages == null ? null : (read.pagesRead ?? pages)
  let max = MAIL_FILE_TEXT_MAX_CHARS
  for (;;) {
    const end = textPieceEnd(text, ask.offset, max)
    const next = end < chars ? end : null
    const reply: Record<string, unknown> = { account, id, ...facts, sha256: file.sha256, text_source: read.source, pages, pages_read: pagesRead, chars, offset: ask.offset, next_offset: next }
    const words = mailFileTextNextWords({ chars, offset: ask.offset, end, next, pages, pagesRead })
    if (words) reply.read_next = words
    reply.text = text.slice(ask.offset, end)
    if (end - ask.offset <= 1 || replyText(reply).length <= REPLY_MAX_CHARS) return { ok: true, reply }
    max = Math.max(1, Math.floor(((end - ask.offset) * 3) / 4))
  }
}

/** What a piece of a file's words says about itself and how to read on; nothing when the reply is the whole file's words. */
export function mailFileTextNextWords(piece: { chars: number; offset: number; end: number; next: number | null; pages: number | null; pagesRead: number | null }): string | null {
  const { chars, offset, end, next, pages, pagesRead } = piece
  const short =
    pages != null && pagesRead != null && pagesRead < pages
      ? `The reader stopped after page ${count(pagesRead)} of ${count(pages)} (its time for one file, or its ${count(INDEX_TEXT_MAX_CHARS)} characters), so these ${count(chars)} characters are the words of the first ${count(pagesRead)} ${pagesRead === 1 ? 'page' : 'pages'} only. The pages past that are read from the file’s bytes with read_mail_file.`
      : null
  if (offset === 0 && next === null) return short
  const span = `characters ${count(offset)} to ${count(end - 1)} of ${count(chars)}`
  if (next === null) return [`These are the last of the words, ${span}.`, short].filter(Boolean).join(' ')
  const left = Math.ceil((chars - next) / MAIL_FILE_TEXT_MAX_CHARS)
  return [
    `These are ${span}, not the whole text: a reply is cut at ${count(REPLY_MAX_CHARS)} characters, so the words come at most ${count(MAIL_FILE_TEXT_MAX_CHARS)} at a time, ending on a line. Call read_mail_file_text again with the same account, id and name and offset: ${next}, and on until next_offset is null (about ${left} more ${left === 1 ? 'call' : 'calls'}).`,
    short,
  ]
    .filter(Boolean)
    .join(' ')
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
