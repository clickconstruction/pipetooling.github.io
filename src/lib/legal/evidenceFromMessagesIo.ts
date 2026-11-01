/**
 * The reads and the writes behind the Legal desk's **From the job's messages…** (punch list #230 PR 5). The rules and
 * the words are `evidenceFromMessages.ts`; this file only reads and writes.
 *
 * `loadEvidenceFromMessages` reads, as the signed-in office member: what the matter's live documents already hold (a
 * line by `source_message_id`, a send by its file's name; before migration 20261101130407 is pushed this read is
 * refused and the door says it waits for the push), the email lines tied to the account's Pipeline jobs and to the
 * bids they came from, with each line's person, channel address, files (`message_attachments`) and the names of the
 * team on them, the app's own sends on those jobs (`sent_documents`, parsed by `parseSentCopy`; a reply-box send's
 * filed copy is its line's, as `sentLines.ts` leaves it out of the thread), the boxes' addresses, and the size of each
 * tagged line's raw copy in `message-attachments/mine/`. The Legal desk's four roles are all on the office team the
 * Messages tables and the bucket admit, and `sent_documents` is the office's, so nothing here reads past a policy.
 *
 * `putEvidenceFromMessages` makes one `.eml` per ready email and files it through `addLegalMatterDocument` with its
 * line: a tagged line's raw copy as received (the record made here when the raw copy is gone), a box-read line's
 * record with its kept files inside, a send's filed copy. It keeps going past a row that fails and names it after.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '../../types/database'
import { DatabaseError, formatErrorMessage, withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { COMPANY_EMAIL_FROM_LABEL } from '../customerEmailFrom'
import { BOXES_SETTINGS_KEY, parseBoxSettings } from '../messages/boxes'
import { jobKey, jobKeyOfRow } from '../messages/jobKeys'
import type { BidTileRow } from '../messages/jobTiles'
import { parseSentCopy } from '../sent/sentCopies'
import { SENT_COPIES_BUCKET } from '../sent/sentCopiesIo'
import { LEGAL_DOCUMENT_MAX_BYTES, legalDocumentSizeWords } from './legalMatterDocuments'
import { addLegalMatterDocument, isSourceLineNotPushed } from './legalMatterDocumentsIo'
import {
  EVIDENCE_FROM_MESSAGES_WORDS,
  MY_MAIL_RAW_BUCKET,
  conversationsOf,
  documentDraftOf,
  emlFilesOfLine,
  emlOf,
  evidenceJobTiles,
  fileCanFit,
  myMailRawPath,
  onMatterKeys,
  type EmlFile,
  type EvidenceConversation,
  type EvidenceCopy,
  type EvidenceEmlContext,
  type EvidenceJobRow,
  type EvidenceLine,
  type EvidenceLineFile,
  type EvidencePeople,
  type EvidencePutOutcome,
  type EvidencePutPlan,
  type EvidenceSentCopy,
  type EvidenceStep,
} from './evidenceFromMessages'

type Db = SupabaseClient<Database>
type Row = Record<string, unknown>

/** Everything the window draws and the press needs. */
export interface EvidenceFromMessagesData {
  conversations: EvidenceConversation[]
  /** The items the matter's live documents already hold. */
  onMatter: ReadonlySet<string>
  /** Each tagged line's raw copy's size in bytes, by line id; null when none was found. */
  rawBytes: Readonly<Record<string, number | null>>
  ctx: EvidenceEmlContext
  people: EvidencePeople
}

/** The window's two calls; a render smoke hands in its own. */
export interface EvidenceFromMessagesIo {
  load: () => Promise<EvidenceFromMessagesData>
  put: (plan: EvidencePutPlan, data: EvidenceFromMessagesData) => Promise<EvidencePutOutcome>
}

/** The io for one matter and its account's jobs. */
export function evidenceFromMessagesIo(db: Db, opts: { matterId: string; jobs: readonly EvidenceJobRow[] }): EvidenceFromMessagesIo {
  return {
    load: () => loadEvidenceFromMessages(db, opts),
    put: (plan, data) => putEvidenceFromMessages(db, opts.matterId, plan, data),
  }
}

// ---------- reading ----------

const LINE_COLS =
  'id, contact_id, channel_id, bid_id, project_id, jobs_ledger_id, channel, direction, who_user_id, who_text, at, subject, body, mailbox, mail_user_id, gmail_id, gmail_thread_id, rfc_message_id'
const SENT_COLS =
  'id, kind, title, how, recipient_name, recipient_emails, subject, source_table, source_id, copy_path, copy_type, copy_bytes, copy_hash, attachments, sent_at, sent_by_name, bid_id, job_ids'
/** The most lines or copies one read brings, newest first. */
const READ_MAX = 2000
const SLICE = 150

const unique = (ids: ReadonlyArray<string | null | undefined>): string[] => [...new Set(ids.filter((id): id is string => typeof id === 'string' && id !== ''))]
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const rowsOf = (data: unknown): Row[] => (Array.isArray(data) ? data.filter((r): r is Row => !!r && typeof r === 'object') : [])

/** One read, retried on a lost signal; no rows is an empty list. */
async function read<T>(op: () => PromiseLike<SupabaseClientResult<T[]>>, operation: string): Promise<T[]> {
  return (await withSupabaseRetry(op, operation)) ?? []
}

/** `.in()` in slices, so a long list never makes the address too long. */
async function inSlices<T>(ids: readonly string[], one: (slice: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += SLICE) out.push(...(await one(ids.slice(i, i + SLICE))))
  return out
}

/** A `messages` row as the door reads it (`mailbox` and `mail_user_id` since migration 20261101083844). */
type MessageLine = Pick<Tables<'messages'>, 'id' | 'contact_id' | 'channel_id' | 'bid_id' | 'project_id' | 'jobs_ledger_id' | 'channel' | 'direction' | 'who_user_id' | 'who_text' | 'at' | 'subject' | 'body' | 'mailbox' | 'mail_user_id' | 'gmail_id' | 'gmail_thread_id' | 'rfc_message_id'>
/** An email line, in or out: the only rows the door lists. */
type LineRow = Omit<MessageLine, 'direction'> & { direction: 'in' | 'out' }
const isEmailLine = (r: MessageLine): r is LineRow => r.channel === 'email' && (r.direction === 'in' || r.direction === 'out')

/** The account's email lines tied to these jobs (`jobs_ledger_id`) or these bids (`bid_id`), newest first. */
async function readLines(db: Db, column: 'jobs_ledger_id' | 'bid_id', ids: readonly string[]): Promise<LineRow[]> {
  const rows = await inSlices(ids, (slice) =>
    read<MessageLine>(() => db.from('messages').select(LINE_COLS).eq('channel', 'email').in(column, slice).order('at', { ascending: false }).limit(READ_MAX), 'load the email on the account’s jobs'),
  )
  return rows.filter(isEmailLine)
}

/** A sent copy with the job ties the door reads, and the filed attachments with their sizes. */
type SentRow = EvidenceSentCopy & { sourceTable: string; sourceId: string | null }

type SentDocument = Pick<Tables<'sent_documents'>, 'id' | 'kind' | 'title' | 'how' | 'recipient_name' | 'recipient_emails' | 'subject' | 'source_table' | 'source_id' | 'copy_path' | 'copy_type' | 'copy_bytes' | 'copy_hash' | 'attachments' | 'sent_at' | 'sent_by_name' | 'bid_id' | 'job_ids'>

function sentRowOf(r: SentDocument, accountJobs: ReadonlySet<string>, accountBids: ReadonlySet<string>): SentRow | null {
  const copy = parseSentCopy(r)
  if (!copy || copy.how !== 'email') return null
  const jobIds = (r.job_ids ?? []).filter((j) => j !== '')
  const bidId = r.bid_id
  const onJob = jobIds.find((j) => accountJobs.has(j))
  const key = onJob ? jobKey({ kind: 'pipeline', id: onJob }) : bidId && accountBids.has(bidId) ? jobKey({ kind: 'bid', id: bidId }) : jobIds[0] ? jobKey({ kind: 'pipeline', id: jobIds[0] }) : ''
  const attachments = rowsOf(r.attachments).filter((a) => str(a.path)).map((a) => ({ name: str(a.name) || 'Attachment', path: str(a.path), type: str(a.type), bytes: numOrNull(a.bytes) }))
  return {
    id: copy.id,
    kind: copy.kind,
    title: copy.title,
    subject: copy.subject,
    recipientName: copy.recipientName,
    recipientEmails: copy.recipientEmails,
    sentAt: copy.sentAt,
    sentByName: copy.sentByName,
    copyPath: copy.copyPath,
    copyType: copy.copyType,
    copyBytes: r.copy_bytes,
    attachments,
    jobKey: key,
    sourceTable: copy.sourceTable,
    sourceId: copy.sourceId,
  }
}

/** The emails the app filed on these jobs (`job_ids`) or these bids (`bid_id`), newest first. */
async function readSent(db: Db, by: 'job_ids' | 'bid_id', ids: readonly string[]): Promise<SentDocument[]> {
  return inSlices(ids, (slice) =>
    read<SentDocument>(() => {
      const q = db.from('sent_documents').select(SENT_COLS).eq('how', 'email')
      return (by === 'job_ids' ? q.overlaps('job_ids', slice) : q.in('bid_id', slice)).order('sent_at', { ascending: false }).limit(READ_MAX)
    }, 'load the emails the app sent on the account’s jobs'),
  )
}

/**
 * The matter's live documents' lines and sends. `source_message_id` is this PR's column (migration 20261101130407),
 * read by name until the types regenerate after the push; before the push the read is refused, and the door says it
 * waits for the push.
 */
async function readOnMatter(db: Db, matterId: string): Promise<Set<string>> {
  const columns: string = 'id, source_message_id, original_name'
  const rows = await read<unknown>(async () => {
    const res = await db.from('legal_matter_documents').select(columns).eq('matter_id', matterId).is('voided_at', null)
    if (res.error && isSourceLineNotPushed(res.error.code)) throw new Error(EVIDENCE_FROM_MESSAGES_WORDS.notPushed)
    return res as SupabaseClientResult<unknown[]>
  }, 'read the documents on the matter')
  return onMatterKeys(rowsOf(rows).map((r) => ({ source_message_id: strOrNull(r.source_message_id), original_name: str(r.original_name) })))
}

/** The boxes' addresses, for the To of a mail that came in on one. Best effort: none is a mail with no To. */
async function readBoxes(db: Db): Promise<EvidenceEmlContext['boxes']> {
  try {
    const res = await db.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle()
    const boxes = parseBoxSettings(res.data?.value_text ?? null)
    return { ...(boxes?.team.address ? { team: boxes.team.address } : {}), ...(boxes?.bids.address ? { bids: boxes.bids.address } : {}) }
  } catch {
    return {}
  }
}

/** A tagged line's raw copy's size, or null when there is none to find (or the list could not be read). */
async function rawSize(db: Db, lineId: string): Promise<number | null> {
  const name = myMailRawPath(lineId).slice('mine/'.length)
  try {
    const { data, error } = await db.storage.from(MY_MAIL_RAW_BUCKET).list('mine', { limit: 2, search: name })
    if (error) return null
    const hit = (data ?? []).find((f) => f.name === name)
    if (!hit) return null
    const meta = hit.metadata as Record<string, unknown> | null | undefined
    return numOrNull(meta?.size) ?? 0
  } catch {
    return null
  }
}

/** Each in turn, a few at a time. */
async function inBatches<T, R>(items: readonly T[], size: number, each: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(each))))
  return out
}

/** The account's email as the door lists it, and what the press needs. */
export async function loadEvidenceFromMessages(db: Db, opts: { matterId: string; jobs: readonly EvidenceJobRow[] }): Promise<EvidenceFromMessagesData> {
  const todayYmd = todayYmdInAppTz()
  const jobIds = unique(opts.jobs.map((j) => j.id))
  const jobBidIds = unique(opts.jobs.map((j) => j.bid_id))
  // First, so a database the migration has not reached says so before anything else is read.
  const onMatter = await readOnMatter(db, opts.matterId)
  const [byJob, byBid, sentByJob, sentByBid, boxes] = await Promise.all([
    jobIds.length ? readLines(db, 'jobs_ledger_id', jobIds) : Promise.resolve([]),
    jobBidIds.length ? readLines(db, 'bid_id', jobBidIds) : Promise.resolve([]),
    jobIds.length ? readSent(db, 'job_ids', jobIds) : Promise.resolve([]),
    jobBidIds.length ? readSent(db, 'bid_id', jobBidIds) : Promise.resolve([]),
    readBoxes(db),
  ])
  const lineRows = [...new Map([...byJob, ...byBid].map((l) => [l.id, l] as const)).values()]
  const lineIds = lineRows.map((l) => l.id)
  const [contacts, channels, files, users, bids] = await Promise.all([
    inSlices(unique(lineRows.map((l) => l.contact_id)), (ids) => read(() => db.from('contacts').select('id, kind, name').in('id', ids), 'load the people on the email')),
    inSlices(unique(lineRows.map((l) => l.channel_id)), (ids) => read(() => db.from('contact_channels').select('id, value').in('id', ids), 'load the addresses on the email')),
    inSlices(lineIds, (ids) => read(() => db.from('message_attachments').select('id, message_id, sort_order, kind, name, mime, size_bytes, bucket_path, left_in_gmail, url').in('message_id', ids), 'load the files on the email')),
    inSlices(unique(lineRows.flatMap((l) => [l.who_user_id, l.mail_user_id])), (ids) => read(() => db.from('users').select('id, name, email').in('id', ids), 'load the names of the team')),
    inSlices(unique([...jobBidIds, ...lineRows.map((l) => l.bid_id)]), (ids) => read<BidTileRow>(() => db.from('bids').select('id, bid_number, project_name, bid_due_date, bid_date_sent, outcome').in('id', ids), 'load the bids the jobs came from')),
  ])

  const accountJobs = new Set(jobIds)
  const accountBids = new Set(jobBidIds)
  const sentRows = [...new Map([...sentByJob, ...sentByBid].map((r) => sentRowOf(r, accountJobs, accountBids)).filter((r): r is SentRow => r !== null).map((r) => [r.id, r] as const)).values()]
  // A reply-box email is its line in the thread (`sentLines.ts` leaves its copy out): here its copy is the line's filed one.
  const filedByLine = new Map(sentRows.filter((r) => r.sourceTable === 'messages' && r.sourceId).map((r) => [r.sourceId!, r] as const))
  const sends = sentRows.filter((r) => r.sourceTable !== 'messages')

  const contactById = new Map(contacts.map((c) => [c.id, { name: c.name ?? '', kind: c.kind }] as const))
  const addressById = new Map(channels.map((c) => [c.id, c.value] as const))
  const filesByLine = new Map<string, EvidenceLineFile[]>()
  for (const f of [...files].sort((a, b) => a.sort_order - b.sort_order)) {
    const file: EvidenceLineFile = { id: f.id, name: f.name || 'file', mime: f.mime, size: f.size_bytes, bucketPath: f.bucket_path, kind: f.kind || 'file', url: f.url, leftInGmail: f.left_in_gmail }
    filesByLine.set(f.message_id, [...(filesByLine.get(f.message_id) ?? []), file])
  }
  const people: EvidencePeople = { users: Object.fromEntries(users.map((u) => [u.id, { name: u.name ?? '', email: u.email ?? '' }])) }
  const lines: EvidenceLine[] = lineRows.map((l) => {
    const contact = contactById.get(l.contact_id)
    return {
      id: l.id,
      contactId: l.contact_id,
      contactName: contact?.name ?? '',
      contactKind: contact?.kind ?? '',
      contactAddress: (l.channel_id ? addressById.get(l.channel_id) : '') ?? '',
      jobKey: jobKeyOfRow(l) ?? '',
      direction: l.direction,
      at: l.at,
      subject: l.subject ?? '',
      body: l.body,
      whoUserId: l.who_user_id,
      whoText: l.who_text,
      mailbox: l.mailbox,
      mailUserId: l.mail_user_id,
      gmailId: l.gmail_id,
      gmailThreadId: l.gmail_thread_id,
      rfcMessageId: l.rfc_message_id,
      files: filesByLine.get(l.id) ?? [],
      filed: filedByLine.get(l.id) ?? null,
    }
  })
  const tiles = evidenceJobTiles(opts.jobs, bids, todayYmd)
  const conversations = conversationsOf(lines, sends, people, { words: tiles.words, todayYmd })

  const tagged = lines.filter((l) => l.mailbox === 'mine').map((l) => l.id)
  const sizes = await inBatches(tagged, 8, async (id) => [id, await rawSize(db, id)] as const)
  return {
    conversations,
    onMatter,
    rawBytes: Object.fromEntries(sizes),
    ctx: { todayYmd, boxes, users: people.users, appFrom: COMPANY_EMAIL_FROM_LABEL },
    people,
  }
}

// ---------- the press ----------

/** Storage's own answer for a file that is not there, as against one that could not be read. */
function isMissingObject(error: unknown): boolean {
  const e = error as { status?: unknown; statusCode?: unknown; message?: unknown } | null
  return e?.statusCode === '404' || e?.status === 404 || /not.?found|does not exist/i.test(typeof e?.message === 'string' ? e.message : '')
}

async function downloadBytes(db: Db, bucket: string, path: string): Promise<Uint8Array> {
  const { data, error } = await db.storage.from(bucket).download(path)
  if (error || !data) throw error ?? new Error(`Could not read ${path}`)
  return new Uint8Array(await data.arrayBuffer())
}

/** A tagged line's raw copy, or null when it is not there; a read that fails for another reason throws. */
async function rawCopy(db: Db, lineId: string): Promise<Uint8Array | null> {
  const { data, error } = await db.storage.from(MY_MAIL_RAW_BUCKET).download(myMailRawPath(lineId))
  if (error) {
    if (isMissingObject(error)) return null
    throw error
  }
  return data ? new Uint8Array(await data.arrayBuffer()) : null
}

/** A line's files, the ones that can ride inside read from our copies; one that will not read is named instead. */
async function lineFiles(db: Db, line: EvidenceLine): Promise<EmlFile[]> {
  const wanted = line.files.filter((f) => f.bucketPath && fileCanFit(f.size))
  const read = await inBatches(wanted, 4, async (f) => [f.id, await downloadBytes(db, MY_MAIL_RAW_BUCKET, f.bucketPath!).catch(() => null)] as const)
  return emlFilesOfLine(line, Object.fromEntries(read))
}

/** A filed copy's page and its files, as the app kept them in `sent-documents`. */
async function filedCopy(db: Db, copy: EvidenceSentCopy): Promise<{ html: string; files: EmlFile[] }> {
  if (!copy.copyPath) throw new Error('The app kept no copy of this send.')
  const { data, error } = await db.storage.from(SENT_COPIES_BUCKET).download(copy.copyPath)
  if (error || !data) throw error ?? new Error('The filed copy could not be read.')
  const html = await data.text()
  const files = await inBatches(copy.attachments, 4, async (a): Promise<EmlFile> => {
    const fits = fileCanFit(a.bytes)
    const bytes = fits ? await downloadBytes(db, SENT_COPIES_BUCKET, a.path).catch(() => null) : null
    return { name: a.name, mime: a.type || 'application/octet-stream', bytes, note: fits ? 'our copy could not be read' : `over the ${Math.round(LEGAL_DOCUMENT_MAX_BYTES / 1024 / 1024)} MB this copy may carry` }
  })
  return { html, files }
}

/** The `.eml` for one ready email, and how it was made. */
async function emlForStep(db: Db, step: EvidenceStep, data: EvidenceFromMessagesData): Promise<{ body: Uint8Array | string; copy: EvidenceCopy }> {
  const item = step.item
  if (item.kind === 'sent') {
    const { html, files } = await filedCopy(db, item.copy)
    return { body: emlOf(item, files, data.ctx, { html }).text, copy: 'filed' }
  }
  const line = item.line
  if (line.mailbox === 'mine') {
    const raw = await rawCopy(db, line.id)
    if (raw) {
      if (raw.length > LEGAL_DOCUMENT_MAX_BYTES) throw new Error(`The mail as received is ${legalDocumentSizeWords(raw.length)}. A matter takes ${Math.round(LEGAL_DOCUMENT_MAX_BYTES / 1024 / 1024)} MB at most.`)
      return { body: raw, copy: 'raw' }
    }
    return { body: emlOf(item, await lineFiles(db, line), data.ctx).text, copy: 'made_raw_missing' }
  }
  if (!line.gmailId && line.filed?.copyPath) {
    const { html, files } = await filedCopy(db, line.filed)
    return { body: emlOf(item, files, data.ctx, { html }).text, copy: 'filed' }
  }
  return { body: emlOf(item, await lineFiles(db, line), data.ctx).text, copy: 'made' }
}

/** The press: each ready email on the matter in turn, past any that fails, which is named with its reason. */
export async function putEvidenceFromMessages(db: Db, matterId: string, plan: EvidencePutPlan, data: EvidenceFromMessagesData): Promise<EvidencePutOutcome> {
  const done: EvidencePutOutcome['done'] = []
  const failed: EvidencePutOutcome['failed'] = []
  for (const step of plan.ready) {
    try {
      const made = await emlForStep(db, step, data)
      // A made copy is ASCII, so its length is its size; `emlOf` keeps it within the 10 MB unless its words alone are not.
      if ((typeof made.body === 'string' ? made.body.length : made.body.byteLength) > LEGAL_DOCUMENT_MAX_BYTES) throw new Error(EVIDENCE_FROM_MESSAGES_WORDS.tooBigMade)
      const { draft, fileName } = documentDraftOf(step.conversation, step.item, step.n, step.count, { ourName: PORTAL_COMPANY.name, copy: made.copy, todayYmd: data.ctx.todayYmd, people: data.people })
      await addLegalMatterDocument(db, matterId, draft, new File([made.body], fileName, { type: 'message/rfc822' }))
      done.push({ key: step.item.key, title: draft.title, copy: made.copy })
    } catch (e) {
      // The one-per-line index (migration 20261101130407): another press put this email on while the window was open.
      const already = e instanceof DatabaseError && e.code === '23505'
      failed.push({ key: step.item.key, title: step.title, reason: already ? EVIDENCE_FROM_MESSAGES_WORDS.alreadyOn : formatErrorMessage(e, EVIDENCE_FROM_MESSAGES_WORDS.putFailed) })
    }
  }
  return { done, failed, held: plan.held }
}
