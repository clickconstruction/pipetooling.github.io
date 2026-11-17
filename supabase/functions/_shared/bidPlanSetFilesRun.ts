/**
 * A mail's files kept as a set of plans on a bid (punch list #368, PR 1): the rules of the `bid-plan-set-files`
 * function with everything outside it passed in, so a fake drives every refusal and every order of events. An
 * addendum or a revised spec reaches a bid by mail; the press files what the mail carries into the bid's own project
 * folder under Plans › <the set's name> and adds one `bid_plan_sets` row that points at that folder.
 *
 * Who may: the roles that write a bid's sets (`bid_plan_sets_insert`), on a bid they can see, with a mail they can see
 * that is tied to that bid. What is checked before anything is made: all of it. One set a name on a bid: a second keep
 * under the same name answers the set already there, so a later mail of the same conversation joins it. A file is
 * marked on its own row (`message_attachments.bid_plan_set_id`) only once it is in the folder, which is how a mail
 * reads as kept and how a set reads as from a mail. `bid-plan-set-files/index.ts` wires this to Supabase and Drive.
 * Its one import is the job leg's naming rules, so `src/lib/bids/bidPlanSetFilesRun.test.ts` imports it as the
 * function does.
 */
import { planSetFileNameAt, planSetFolderName, planSetFolderNameAt } from './planSetFilesRun.ts'

/** The roles `bid_plan_sets_insert` lets write a bid's sets. The test reads the migration and fails when they differ. */
export const BID_SET_WRITE_ROLES: readonly string[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator']

/** The folder inside a bid's project folder that holds its sets, named as a job's is. */
export const BID_PLANS_FOLDER_NAME = 'Plans'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NAME_MAX = 200
const MEMO_MAX = 2000
/** Folders of one name, or files of one name in a folder, past which the run stops looking for a free one. */
const NAME_TRIES = 20

/** A cut that lands on a whole character: half an emoji would make Drive's query throw. */
const wholeChars = (s: string, max: number): string => Array.from(s).slice(0, max).join('')

export type BidPlanSetFilesAsk =
  | { action: 'keep'; bidId: string; messageId: string; name: string; memo: string; planDate: string }
  | { action: 'save_attachment'; setId: string; attachmentId: string }

const uuidOf = (v: unknown): string | null => (typeof v === 'string' && UUID.test(v) ? v : null)

export function parseBidPlanSetFilesAsk(body: Record<string, unknown> | null): BidPlanSetFilesAsk | null {
  if (!body) return null
  if (body.action === 'keep') {
    const bidId = uuidOf(body.bid_id)
    const messageId = uuidOf(body.message_id)
    if (!bidId || !messageId) return null
    return {
      action: 'keep',
      bidId,
      messageId,
      name: typeof body.name === 'string' ? wholeChars(body.name.replace(/\s+/g, ' ').trim(), NAME_MAX).trim() : '',
      memo: typeof body.memo === 'string' ? wholeChars(body.memo.trim(), MEMO_MAX) : '',
      planDate: typeof body.plan_date === 'string' ? body.plan_date.trim() : '',
    }
  }
  if (body.action === 'save_attachment') {
    const setId = uuidOf(body.set_id)
    const attachmentId = uuidOf(body.attachment_id)
    return setId && attachmentId ? { action: 'save_attachment', setId, attachmentId } : null
  }
  return null
}

/** A civil day as `YYYY-MM-DD` that the calendar holds, or null. */
export function civilDay(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? ymd : null
}

/** What Drive says of a folder the app means to file into. */
export type BidSetFolderSeen = 'ok' | 'outside_drive' | 'cannot_open' | 'cannot_write' | 'not_a_folder'

/**
 * Why the app cannot file into a folder, in words with the fix, or null when it can. `what` names the folder: the
 * bid's project folder, or a set's own. A folder in a personal Drive takes the app's folders and not its files.
 */
export function bidSetFolderHoldWords(seen: BidSetFolderSeen, what: string, appEmail: string, owner: string | null): string | null {
  const kept = 'Nothing was made. The mail keeps its files.'
  switch (seen) {
    case 'ok':
      return null
    case 'outside_drive':
      return `${what} is in ${owner ? `${owner}’s My Drive` : 'a personal Drive'}, where the app can make folders but cannot save a file. Move the folder into the company’s shared Drive. ${kept}`
    case 'cannot_open':
      return `The app cannot open ${lowerFirst(what)}. Share it with ${appEmail} as an editor. ${kept}`
    case 'cannot_write':
      return `The app can open ${lowerFirst(what)} but cannot add to it. Share it with ${appEmail} as an editor. ${kept}`
    case 'not_a_folder':
      return `${what} is not a Drive folder. ${kept}`
  }
}

const lowerFirst = (s: string): string => (s ? s[0]!.toLowerCase() + s.slice(1) : s)

export type BidSetRow = { id: string; bid_id: string; name: string; link: string }
export type BidMailLineRow = { id: string; bid_id: string | null; channel: string }
export type BidMailAttachmentRow = { id: string; kind: string; name: string; mime: string | null; bucket_path: string | null; message_bid_id: string | null }
/** What a set's row says of the files behind its link, as `plan-fetch`'s probe would. */
export type BidSetFileFacts = { file_name: string | null; file_size: number | null; file_count: number | null; checked_at: string; check_note: null }
export type BidPlanSetFilesReply = { status: number; body: Record<string, unknown> }

export type BidPlanSetFilesDrive = {
  /** The bid's project folder made as needed, then Plans inside it; or the words for why the app cannot file there. */
  plansFolder(bidId: string): Promise<{ id: string } | { why: string }>
  findOrCreateFolder(parentId: string, name: string): Promise<{ id: string; created: boolean }>
  /** What the app may do in a folder, and whose Drive it is in when that matters. */
  seeFolder(folderId: string): Promise<{ seen: BidSetFolderSeen; owner: string | null }>
  /** The files of exactly this name in the folder, with their sizes (a Google file has none). */
  filesNamed(folderId: string, name: string): Promise<Array<{ id: string; size: number | null }>>
  /** Every file in the folder, folders left out. */
  filesIn(folderId: string): Promise<Array<{ name: string; size: number | null; mime: string | null }>>
  upload(folderId: string, bytes: Uint8Array, name: string, mime: string): Promise<{ id: string }>
}

/** Every read throws when it fails: a database blip must never read as *no such mail* or *not one we kept*. */
export type BidPlanSetFilesDeps = {
  // As the service role.
  readMe(): Promise<{ role?: string | null; read_only?: boolean | null; is_digital_twin?: boolean | null } | null>
  /** The sets whose link points at this folder. */
  setsOnFolder(folderId: string): Promise<BidSetRow[]>
  /** Marks a file as filed into a set, once it is in the folder. */
  stampAttachment(attachmentId: string, setId: string): Promise<void>
  /** What stands behind the set's link now. A failure here is not the file's. */
  stampFileFacts(setId: string, facts: BidSetFileFacts): Promise<void>
  /** Our copy of a mail's file, or null when it does not read. */
  download(bucketPath: string): Promise<Uint8Array | null>
  // Through the caller's client, so the rows' own policies decide.
  canSeeBid(bidId: string): Promise<boolean>
  readMail(messageId: string): Promise<BidMailLineRow | null>
  readSet(setId: string): Promise<BidSetRow | null>
  readAttachment(attachmentId: string): Promise<BidMailAttachmentRow | null>
  /** The new set's row. Throws with the database's reason when the insert is refused. */
  insertSet(row: { bid_id: string; name: string; memo: string; plan_date: string | null; link: string; created_by: string }): Promise<BidSetRow>
  folderIdFromUrl(url: string | null): string | null
  folderUrl(folderId: string): string
  fileUrl(fileId: string, mime: string | null): string
  appEmail(): string
  nowIso(): string
  /** Null when Drive is not set up here. */
  drive(): Promise<BidPlanSetFilesDrive | null>
}

const refuse = (status: number, error: string, why?: string): BidPlanSetFilesReply => ({ status, body: why ? { error, why } : { error } })
const answer = (body: Record<string, unknown>): BidPlanSetFilesReply => ({ status: 200, body })

/** The account's refusal, or null when it may write a bid's sets. */
async function whoRefusal(deps: BidPlanSetFilesDeps): Promise<BidPlanSetFilesReply | null> {
  const me = await deps.readMe()
  if (!me) return refuse(403, 'Your account did not read, so nothing changed.')
  if (me.is_digital_twin) return refuse(403, 'A digital twin cannot change Drive.')
  if (me.read_only) return refuse(403, 'A training account cannot change Drive.')
  if (!BID_SET_WRITE_ROLES.includes(me.role ?? '')) return refuse(403, 'Only the office and the estimators add a set of plans to a bid.')
  return null
}

/** The first name the folder does not hold yet, so two files of one name stay apart for a person reading the folder. */
async function freeFileName(drive: BidPlanSetFilesDrive, folderId: string, name: string): Promise<string> {
  for (let n = 1; n <= NAME_TRIES; n += 1) {
    const candidate = planSetFileNameAt(name, n)
    if ((await drive.filesNamed(folderId, candidate)).length === 0) return candidate
  }
  return name
}

const isPdf = (f: { name: string; mime: string | null }): boolean => f.mime === 'application/pdf' || /\.pdf$/i.test(f.name)

/** The set's file columns from what its folder holds: one file by its name, PDFs alone by their count, a mix as *3 files*. */
export function bidSetFileFacts(files: ReadonlyArray<{ name: string; size: number | null; mime: string | null }>, nowIso: string): BidSetFileFacts {
  const size = files.reduce((n, f) => n + (f.size ?? 0), 0)
  const allPdf = files.length > 0 && files.every(isPdf)
  return {
    file_name: files.length === 1 ? files[0]!.name : files.length > 1 && !allPdf ? `${files.length} files` : null,
    file_size: files.length > 0 ? size : null,
    file_count: allPdf ? files.length : null,
    checked_at: nowIso,
    check_note: null,
  }
}

async function keep(ask: Extract<BidPlanSetFilesAsk, { action: 'keep' }>, callerId: string, deps: BidPlanSetFilesDeps): Promise<BidPlanSetFilesReply> {
  if (!ask.name) return refuse(400, 'Give the set a name.')
  const planDate = ask.planDate ? civilDay(ask.planDate) : null
  if (ask.planDate && !planDate) return refuse(400, 'That date is not a day on the calendar.')
  if (!(await deps.canSeeBid(ask.bidId))) return refuse(404, 'This bid is not one you can see.')
  const mail = await deps.readMail(ask.messageId)
  if (!mail) return refuse(404, 'That mail is not one you can see.')
  if (mail.channel !== 'email') return refuse(409, 'Only an email’s files are kept as a set of plans.')
  if (mail.bid_id !== ask.bidId) return refuse(409, 'That mail is not tied to this bid. Tie it to the bid first.', 'not_tied')

  const drive = await deps.drive()
  if (!drive) return refuse(503, 'Drive is not set up here yet.')
  const plans = await drive.plansFolder(ask.bidId)
  if ('why' in plans) return refuse(409, plans.why, 'folder_held')

  const base = planSetFolderName(ask.name)
  for (let n = 1; n <= NAME_TRIES; n += 1) {
    const found = await drive.findOrCreateFolder(plans.id, planSetFolderNameAt(base, n))
    const url = deps.folderUrl(found.id)
    const holders = found.created ? [] : await deps.setsOnFolder(found.id)
    // A set of this bid already points at the folder: a second press, or a later mail under the same name, joins it.
    const mine = holders.find((h) => h.bid_id === ask.bidId)
    if (mine) return answer({ set: mine, folderUrl: url, made: false, reused: true })
    if (holders.length > 0) continue
    const set = await deps.insertSet({ bid_id: ask.bidId, name: ask.name, memo: ask.memo, plan_date: planDate, link: url, created_by: callerId })
    return answer({ set, folderUrl: url, made: found.created, reused: false })
  }
  throw new Error('Too many folders of that name sit under this bid’s Plans. Rename the set and try again.')
}

async function saveAttachment(ask: Extract<BidPlanSetFilesAsk, { action: 'save_attachment' }>, deps: BidPlanSetFilesDeps): Promise<BidPlanSetFilesReply> {
  const set = await deps.readSet(ask.setId)
  if (!set) return refuse(404, 'That set is not one you can see.')
  const mail = await deps.readAttachment(ask.attachmentId)
  if (!mail || mail.kind !== 'file') return refuse(404, 'That file is not one we kept.')
  if (!mail.bucket_path) return refuse(409, 'That file stayed in Gmail, so we hold no copy of it to file.')
  if (mail.message_bid_id !== set.bid_id) return refuse(409, 'That mail is not tied to this set’s bid.', 'not_tied')
  const folderId = deps.folderIdFromUrl(set.link || null)
  if (!folderId) return refuse(409, bidSetFolderHoldWords('not_a_folder', 'This set’s link', deps.appEmail(), null)!, 'folder_held')

  const drive = await deps.drive()
  if (!drive) return refuse(503, 'Drive is not set up here yet.')
  const folder = await drive.seeFolder(folderId)
  const hold = bidSetFolderHoldWords(folder.seen, 'This set’s folder', deps.appEmail(), folder.owner)
  if (hold) return refuse(409, hold, 'folder_held')
  const bytes = await deps.download(mail.bucket_path)
  if (!bytes) return refuse(500, 'Our copy of that file did not read.')

  // A second try of a file that landed before its answer got back finds it again. A mail may carry two files of one
  // name, so the size has to match too.
  const mime = mail.mime || 'application/octet-stream'
  const same = (await drive.filesNamed(folderId, mail.name)).find((f) => f.size === bytes.length)
  const fileId = same ? same.id : (await drive.upload(folderId, bytes, await freeFileName(drive, folderId, mail.name), mime)).id
  // The mark is written only now, with the file in the folder: a mail never reads as kept on a file that is not there.
  await deps.stampAttachment(mail.id, set.id)
  try {
    await deps.stampFileFacts(set.id, bidSetFileFacts(await drive.filesIn(folderId), deps.nowIso()))
  } catch {
    /* the set's file line is a courtesy: Check the link on the bid reads it again */
  }
  return answer({ driveFileId: fileId, url: deps.fileUrl(fileId, mime), folderUrl: deps.folderUrl(folderId), ...(same ? { reused: true } : {}) })
}

export async function runBidPlanSetFiles(ask: BidPlanSetFilesAsk, callerId: string, deps: BidPlanSetFilesDeps): Promise<BidPlanSetFilesReply> {
  const refusal = await whoRefusal(deps)
  if (refusal) return refusal
  return ask.action === 'keep' ? keep(ask, callerId, deps) : saveAttachment(ask, deps)
}
