// A bid's sent paper filed from Drive and linked, and a Drive folder read, from the dev seat (v2.7154 / 0.82.0 — the
// bid train's pair 6, punch list #339, to-dos/dev-seat-bid-submission.md). The owner, 2026-11-11, on old proposal files
// copied into company Drive, a folder a bid: "connected to their bids where a user links the submissions" and "if we
// don't have dev verbs to support this, we should add those too". The seat could set the link (plan_bid_update) and
// nothing could list a Drive folder, make a bid's project folder or put a file in it, so the session working the real
// case read Drive through a browser and left its links in bid notes.
//
//   read_drive_folder { folder | file, page? }      a folder's files and folders, or one file's facts with its parents
//                                                    and who it is shared with, through the intake service account on a
//                                                    read-only token. Nothing is written and no file's bytes are read.
//   plan_bid_submission → apply_bid_submission       one Drive file into Team only › Sent by us of the bid's project
//                                                    folder (JOB_FOLDER_TREE.sentByUs, the app's fixed home for what we
//                                                    sent), bids.bid_submission_link set to the filed copy as the Files
//                                                    window's pasted link sets it, and a line on the bid's Notes.
//
// Every door is one the app already has: the project folder is made by bid-photos' `make` (the Files window's Make the
// project folder, which writes bids.drive_link itself), a file outside the company's Shared Drive is read on the server
// and lands through drive-link's `put` with where: 'sent', the link is the Files window's own PATCH on bids as the dev,
// and the note is the row plan_activity_note writes. One step has no door: a file already in the company's Shared Drive
// is copied with Drive's own copy by the service account, so a large paper never passes through the function.
//
// The plan commits to the bid, the link it carries, the folder as it stands, the file's name, size and Drive's own
// checksums, and what Sent by us already holds; never to a clock. Pure but for the reads, which come in through two
// small interfaces (the seat's Reader, as the dev under RLS, and DriveGet over the service account's token), so the
// tests run over a stood-in database and Drive (src/lib/devMcp/devMcpBidSubmission.test.ts).

import { findBid, resolve, type Reader, type Row } from './devMcpComposites.ts'
import { REPLY_MAX_CHARS, replyText, type RowFilter } from './devMcpDoor.ts'
import { DRIVE, driveFileIdFromUrl, driveFolderIdFromUrl } from './driveUpload.ts'
import { DRIVE_FOLDER_MIME, driveViewUrl, landingPath } from './driveLink.ts'
import { bidFolderHoldWords, type BidFolderSeen } from './bidPhotos.ts'
import {
  DRIVE_BID_FOLDER_PATTERN_KEY,
  DRIVE_COMPANY_FOLDER_ID_KEY,
  DRIVE_FLEET_FOLDER_ID_KEY,
  DRIVE_FOLDERS_MADE_KEY,
  DRIVE_JOB_FOLDER_PATTERN_KEY,
  DRIVE_JOBS_ROOT_FOLDER_ID_KEY,
  DRIVE_PEOPLE_FOLDER_ID_KEY,
  DRIVE_TASKS_FOLDER_ID_KEY,
  bidFolderName,
  driveSettingsFromRows,
  type DriveSettings,
} from './whereFilesGo.ts'
import { formatBidLedgerNumberLabel } from './ledgerDisplayPrefixes.ts'
import { todayYmdInAppTz } from './appTimeZone.ts'

export const BID_SUBMISSION_VERBS = ['plan_bid_submission', 'apply_bid_submission'] as const
export type BidSubmissionVerb = (typeof BID_SUBMISSION_VERBS)[number]

export function isBidSubmissionVerb(name: string): name is BidSubmissionVerb {
  return (BID_SUBMISSION_VERBS as readonly string[]).includes(name)
}

/** The scope the reads mint their token with: Drive can be read with it and nothing in Drive can be changed. */
export const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
/** How many of a folder's entries one read_drive_folder reply lists; `page` reads on. */
export const DRIVE_FOLDER_PAGE = 100
/** The longest name a reply prints; Drive lets a name run far past what a reply can afford a hundred times. */
export const DRIVE_NAME_MAX = 300
/** How many levels up a file's parents are named. */
export const DRIVE_PATH_DEPTH = 6
/** How many people a file is shared with a reply lists. */
export const DRIVE_SHARED_WITH_MAX = 50
/** The most bytes a paper outside the company's Shared Drive may hold: drive-link's `put` takes no more. */
export const SUBMISSION_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
/** How many of the papers already in Sent by us the plan names; all of them are counted. */
export const SUBMISSION_SENT_LISTED = 20
/** Where the paper lands inside the bid's project folder: Team only › Sent by us, drive-link's own landing for `sent`. */
export const SUBMISSION_LANDING: readonly string[] = landingPath('sent')
export const SUBMISSION_LANDING_WORDS = SUBMISSION_LANDING.join(' › ')
/** The column the Files window's pasted submission link writes, and the Bid Board's Submission chip reads. */
export const SUBMISSION_LINK_COLUMN = 'bid_submission_link'

const HASH_RE = /^[0-9a-f]{64}$/
const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/
const PAGE_RE = /^[^\s]{1,4000}$/
const REF_MAX = 200
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut'
const GOOGLE_PREFIX = 'application/vnd.google-apps.'

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const count = (n: number): string => n.toLocaleString('en-US')
const sizeWords = (n: number): string => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const cut = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max)}…` : s)

// ── Drive, as the reads ask it ───────────────────────────────────────────────────────────────────────────────────────

export type DriveAnswer = { status: number; body: Json }
/** One GET of Drive's API: the path after `drive/v3` and its query. A test stands in for it. */
export type DriveGet = (path: string, params?: Record<string, string>) => Promise<DriveAnswer>

/** The real DriveGet over a token: a GET and nothing else, so a read can never write whatever token it holds. */
export function driveGetWith(token: string, fetchFn: typeof fetch = fetch): DriveGet {
  return async (path, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    const res = await fetchFn(`${DRIVE}${path}${qs ? `?${qs}` : ''}`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
    let body: Json = {}
    try {
      body = obj(await res.json()) ?? {}
    } catch { /* an answer that is not JSON reads as no body */ }
    return { status: res.status, body }
  }
}

const okStatus = (a: DriveAnswer): boolean => a.status >= 200 && a.status < 300

/** Drive's reason off an error body, with its reason codes. */
export function driveReason(body: Json): string {
  const e = obj(body.error)
  if (!e) return ''
  const codes = (Array.isArray(e.errors) ? e.errors : []).map((x) => obj(x)?.reason).filter((r): r is string => typeof r === 'string')
  return `${str(e.message).replace(/[.\s]+$/, '')}${codes.length ? ` [${codes.join(', ')}]` : ''}`.slice(0, 300)
}

/**
 * Drive's refusal of a read, in words that name the share that fixes it, as driveFilingRefusal words a filing's. A
 * folder or a file the service account was never given reads as 404, never 403: Drive does not say a thing exists to
 * someone who cannot open it.
 */
export function driveReadRefusal(what: 'folder' | 'file', id: string, status: number, reason: string, serviceAccount: string | null): string {
  const account = serviceAccount ? `the intake service account (${serviceAccount})` : 'the intake service account (the client_email in GOOGLE_SERVICE_ACCOUNT_JSON)'
  const share = what === 'folder'
    ? `Share the folder with ${account} as a Viewer, or add it to the folder's Shared Drive as a Viewer member; then read again.`
    : `Share the file, or the folder that holds it, with ${account} as a Viewer; then read again.`
  if (status === 404) return `Drive has no ${what} ${id} that ${account} can open: the id is wrong, or the ${what} was never shared with it. ${share}`
  if (status === 403 && /rate ?limit|quota/i.test(reason)) return `Drive is rate-limiting the service account: ${reason || 'rate limit'}. Wait a minute and read again.`
  if (status === 403) return `Drive refused the read of ${what} ${id}: ${reason || 'forbidden'}. ${share}`
  if (status === 401) return `Drive did not take the service account's token (401): ${reason || 'unauthorized'}. Check GOOGLE_SERVICE_ACCOUNT_JSON (docs/DRIVE_INTAKE_SETUP.md).`
  return `Drive could not read ${what} ${id} (${status}): ${reason || 'no reason given'}. Try again in a minute.`
}

/** A Drive id out of an id or any of Drive's links: a folder's page, a file's viewer, open?id=, a Doc's, Sheet's or Slides' own link. */
export function driveIdOf(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (DRIVE_ID_RE.test(v)) return v
  if (!/^https?:\/\//i.test(v)) return null
  const docs = /docs\.google\.com\/(?:document|spreadsheets|presentation|file)\/(?:u\/\d+\/)?d\/([\w-]{10,})/.exec(v)
  return driveFolderIdFromUrl(v) ?? driveFileIdFromUrl(v) ?? docs?.[1] ?? null
}

// ── read_drive_folder ────────────────────────────────────────────────────────────────────────────────────────────────

export type DriveFolderAsk = { kind: 'folder'; id: string; page: string | null } | { kind: 'file'; id: string }

const READ_SHAPE = 'read_drive_folder needs folder (a Drive folder id or its link) to list what the folder holds, or file (a Drive file id or its link) for one file’s facts; page (a reply’s next_page) reads a long folder on.'

/** read_drive_folder's arguments: exactly one of folder or file, an id or a link; `page` with a folder only. */
export function driveFolderArgs(args: Json): { ok: true; ask: DriveFolderAsk } | { ok: false; error: string } {
  const folder = typeof args.folder === 'string' ? args.folder.trim() : ''
  const file = typeof args.file === 'string' ? args.file.trim() : ''
  if ((folder && file) || (!folder && !file)) return { ok: false, error: READ_SHAPE }
  const raw = folder || file
  const id = driveIdOf(raw)
  if (!id) return { ok: false, error: `"${cut(raw, 80)}" is not a Drive id or a Drive link. ${READ_SHAPE}` }
  if (file) {
    if (args.page !== undefined && args.page !== null && args.page !== '') return { ok: false, error: 'page reads a folder on; one file’s facts come in one reply.' }
    return { ok: true, ask: { kind: 'file', id } }
  }
  let page: string | null = null
  if (args.page !== undefined && args.page !== null && args.page !== '') {
    if (typeof args.page !== 'string' || !PAGE_RE.test(args.page.trim())) return { ok: false, error: 'page is the next_page value a read_drive_folder reply handed back, quoted whole.' }
    page = args.page.trim()
  }
  return { ok: true, ask: { kind: 'folder', id, page } }
}

const SETTINGS_KEYS = [DRIVE_JOBS_ROOT_FOLDER_ID_KEY, DRIVE_JOB_FOLDER_PATTERN_KEY, DRIVE_BID_FOLDER_PATTERN_KEY, DRIVE_FOLDERS_MADE_KEY, DRIVE_COMPANY_FOLDER_ID_KEY, DRIVE_PEOPLE_FOLDER_ID_KEY, DRIVE_FLEET_FOLDER_ID_KEY, DRIVE_TASKS_FOLDER_ID_KEY]

/** The company's Shared Drive: the one that holds the jobs root (Documents → Where files go). */
export type CompanyDrive = { settings: DriveSettings; rootFolderId: string | null; driveId: string | null; name: string | null }

/**
 * The office's Drive settings as the dev reads them (`app_settings` under RLS, the env's root filling in as it does for
 * every maker) and the Shared Drive the jobs root sits in. A root that does not read, or sits in a My Drive, answers no
 * drive: nothing is the company's Shared Drive then.
 */
export async function readCompanyDrive(reader: Reader, drive: DriveGet, envRoot: string | null | undefined): Promise<CompanyDrive> {
  let rows: Row[] = []
  try {
    rows = await reader.rows('app_settings', { select: 'key,value_text', filters: [{ column: 'key', op: 'in', value: SETTINGS_KEYS }], limit: 50 })
  } catch { /* a read that fails reads as no rows, so the env still serves (readDriveSettings) */ }
  const settings = driveSettingsFromRows(rows.map((r) => ({ key: str(r.key), value_text: typeof r.value_text === 'string' ? r.value_text : null })), envRoot)
  if (!settings.rootFolderId) return { settings, rootFolderId: null, driveId: null, name: null }
  const root = await drive(`/files/${encodeURIComponent(settings.rootFolderId)}`, { fields: 'id,name,driveId', supportsAllDrives: 'true' })
  const driveId = okStatus(root) ? strOrNull(root.body.driveId) : null
  return { settings, rootFolderId: settings.rootFolderId, driveId, name: driveId ? await sharedDriveName(drive, driveId) : null }
}

/** A Shared Drive's name, or null when it does not read. */
async function sharedDriveName(drive: DriveGet, driveId: string): Promise<string | null> {
  try {
    const d = await drive(`/drives/${encodeURIComponent(driveId)}`, { fields: 'name' })
    return okStatus(d) ? strOrNull(d.body.name) : null
  } catch {
    return null
  }
}

const ENTRY_FIELDS = 'id,name,mimeType,size,modifiedTime,driveId,webViewLink,md5Checksum,owners(displayName,emailAddress),shortcutDetails(targetId,targetMimeType)'

/** What an entry is, in a word: a folder, a file with bytes, a shortcut to another, or one of Google's own kinds. */
export function driveKind(mime: string): 'folder' | 'file' | 'shortcut' | 'google_doc' | 'google_sheet' | 'google_slides' | 'google_other' {
  if (mime === DRIVE_FOLDER_MIME) return 'folder'
  if (mime === SHORTCUT_MIME) return 'shortcut'
  if (mime === `${GOOGLE_PREFIX}document`) return 'google_doc'
  if (mime === `${GOOGLE_PREFIX}spreadsheet`) return 'google_sheet'
  if (mime === `${GOOGLE_PREFIX}presentation`) return 'google_slides'
  return mime.startsWith(GOOGLE_PREFIX) ? 'google_other' : 'file'
}

/** The owner as Drive names one: a name with its address, or null inside a Shared Drive, where the drive owns the file. */
function ownerOf(body: Json): string | null {
  const o = obj((Array.isArray(body.owners) ? body.owners : [])[0])
  if (!o) return null
  const name = strOrNull(o.displayName)
  const email = strOrNull(o.emailAddress)
  return name && email ? `${name} <${email}>` : (name ?? email)
}

const sizeOf = (body: Json): number | null => {
  const n = body.size == null || body.size === '' ? NaN : Number(body.size)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** One listed entry as the reply prints it. */
export function driveEntry(f: Json, companyDriveId: string | null): Json {
  const mime = str(f.mimeType)
  const kind = driveKind(mime)
  const id = str(f.id)
  const shortcut = obj(f.shortcutDetails)
  return {
    id,
    name: cut(str(f.name), DRIVE_NAME_MAX),
    kind,
    mime,
    size_bytes: sizeOf(f),
    modified_time: strOrNull(f.modifiedTime),
    owner: ownerOf(f),
    company_drive: companyDriveId != null && strOrNull(f.driveId) === companyDriveId,
    url: strOrNull(f.webViewLink) ?? driveViewUrl(id, mime),
    ...(kind === 'shortcut' && shortcut ? { points_to: str(shortcut.targetId) } : {}),
  }
}

export type DriveRead = { ok: true; reply: Json; rows: number } | { ok: false; error: string }

/**
 * A folder's page: the folder's own facts first (so a folder that cannot be opened, or an id that is a file, is said
 * before anything is listed), then up to DRIVE_FOLDER_PAGE of what it holds, folders first and then by name. The reply
 * is measured as the door writes it and its tail dropped until it fits, with `next_page` kept only when the page came
 * whole, so the door's cut never lands inside the list.
 */
export async function readDriveFolder(drive: DriveGet, ask: Extract<DriveFolderAsk, { kind: 'folder' }>, ctx: { serviceAccount: string | null; company: CompanyDrive }): Promise<DriveRead> {
  const meta = await drive(`/files/${encodeURIComponent(ask.id)}`, { fields: 'id,name,mimeType,driveId,parents,trashed,webViewLink,owners(displayName,emailAddress)', supportsAllDrives: 'true' })
  if (!okStatus(meta)) return { ok: false, error: driveReadRefusal('folder', ask.id, meta.status, driveReason(meta.body), ctx.serviceAccount) }
  const name = str(meta.body.name)
  if (str(meta.body.mimeType) !== DRIVE_FOLDER_MIME) return { ok: false, error: `${name || ask.id} is a file, not a folder. read_drive_folder { file: "${ask.id}" } answers its facts.` }
  const params: Record<string, string> = {
    q: `'${ask.id}' in parents and trashed = false`,
    pageSize: String(DRIVE_FOLDER_PAGE),
    orderBy: 'folder,name',
    fields: `nextPageToken,files(${ENTRY_FIELDS})`,
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  }
  if (ask.page) params.pageToken = ask.page
  const list = await drive('/files', params)
  if (!okStatus(list)) {
    const reason = driveReason(list.body)
    if (ask.page && list.status === 400) return { ok: false, error: `Drive did not take that page (${reason || 'invalid page token'}): a next_page is good for the folder it came from and for a while. Read the folder again from its start.` }
    return { ok: false, error: driveReadRefusal('folder', ask.id, list.status, reason, ctx.serviceAccount) }
  }
  const driveId = strOrNull(meta.body.driveId)
  const all = (Array.isArray(list.body.files) ? list.body.files : []).map((f) => driveEntry(obj(f) ?? {}, ctx.company.driveId))
  const nextPage = strOrNull(list.body.nextPageToken)
  const folder = {
    id: ask.id,
    name: cut(name, DRIVE_NAME_MAX),
    url: strOrNull(meta.body.webViewLink) ?? driveViewUrl(ask.id, DRIVE_FOLDER_MIME),
    owner: ownerOf(meta.body),
    shared_drive: driveId ? (driveId === ctx.company.driveId ? ctx.company.name : await sharedDriveName(drive, driveId)) : null,
    company_drive: ctx.company.driveId != null && driveId === ctx.company.driveId,
    trashed: meta.body.trashed === true,
    parent: strOrNull((Array.isArray(meta.body.parents) ? meta.body.parents : [])[0]),
  }
  let entries = all
  for (;;) {
    const whole = entries.length === all.length
    const reply: Json = {
      folder,
      listed: entries.length,
      folders: entries.filter((e) => e.kind === 'folder').length,
      files: entries.filter((e) => e.kind !== 'folder').length,
      next_page: whole ? nextPage : null,
      ...folderReadNextWords({ listed: entries.length, of: all.length, nextPage: whole ? nextPage : null }),
      entries,
    }
    if (entries.length === 0 || replyText(reply).length <= REPLY_MAX_CHARS) return { ok: true, reply, rows: entries.length }
    entries = entries.slice(0, Math.max(0, Math.floor(entries.length * 0.8)))
  }
}

/** What a page says about itself: nothing when it is the whole folder, the argument that reads on, or that it was cut to fit. */
export function folderReadNextWords(page: { listed: number; of: number; nextPage: string | null }): { read_next?: string } {
  if (page.listed < page.of) return { read_next: `These are the first ${count(page.listed)} of the ${count(page.of)} entries this page held: the rest did not fit a reply of ${count(REPLY_MAX_CHARS)} characters. Read a folder inside this one by its own id, or one file with read_drive_folder { file }.` }
  if (page.nextPage) return { read_next: `The folder holds more than these ${count(page.listed)}: a reply lists at most ${DRIVE_FOLDER_PAGE}. Call read_drive_folder again with the same folder and page: next_page, quoted whole, and on until next_page is null.` }
  return {}
}

/**
 * One file's facts: what it is, its size and Drive's own checksums, when it changed and who changed it, its owner, the
 * folders above it by name, whether the company's Shared Drive holds it and who it is shared with. The sharing is read
 * fail-soft: a viewer of someone's file is not always shown its sharing, and the facts stand without it.
 */
export async function readDriveFile(drive: DriveGet, ask: Extract<DriveFolderAsk, { kind: 'file' }>, ctx: { serviceAccount: string | null; company: CompanyDrive }): Promise<DriveRead> {
  const meta = await drive(`/files/${encodeURIComponent(ask.id)}`, {
    fields: 'id,name,mimeType,size,md5Checksum,sha256Checksum,createdTime,modifiedTime,trashed,driveId,parents,webViewLink,owners(displayName,emailAddress),lastModifyingUser(displayName,emailAddress),shortcutDetails(targetId,targetMimeType)',
    supportsAllDrives: 'true',
  })
  if (!okStatus(meta)) return { ok: false, error: driveReadRefusal('file', ask.id, meta.status, driveReason(meta.body), ctx.serviceAccount) }
  const b = meta.body
  const mime = str(b.mimeType)
  const driveId = strOrNull(b.driveId)
  const parents: { id: string; name: string | null }[] = []
  let parent = strOrNull((Array.isArray(b.parents) ? b.parents : [])[0])
  for (let i = 0; i < DRIVE_PATH_DEPTH && parent; i += 1) {
    const p = await drive(`/files/${encodeURIComponent(parent)}`, { fields: 'id,name,parents', supportsAllDrives: 'true' })
    if (!okStatus(p)) {
      parents.push({ id: parent, name: null })
      break
    }
    parents.push({ id: parent, name: strOrNull(p.body.name) })
    parent = strOrNull((Array.isArray(p.body.parents) ? p.body.parents : [])[0])
  }
  const driveName = driveId ? (driveId === ctx.company.driveId ? ctx.company.name : await sharedDriveName(drive, driveId)) : null
  let sharedWith: Json[] | null = null
  let sharedWhy: string | null = null
  const perms = await drive(`/files/${encodeURIComponent(ask.id)}/permissions`, { fields: 'permissions(type,role,emailAddress,displayName,domain,deleted)', pageSize: '100', supportsAllDrives: 'true' })
  if (okStatus(perms)) {
    sharedWith = (Array.isArray(perms.body.permissions) ? perms.body.permissions : [])
      .map((x) => obj(x) ?? {})
      .filter((x) => x.deleted !== true)
      .slice(0, DRIVE_SHARED_WITH_MAX)
      .map((x) => ({ who: strOrNull(x.emailAddress) ?? strOrNull(x.domain) ?? (str(x.type) === 'anyone' ? 'anyone with the link' : (strOrNull(x.displayName) ?? str(x.type))), name: strOrNull(x.displayName), kind: str(x.type), role: str(x.role) }))
  } else {
    sharedWhy = `Drive did not show the sharing (${perms.status}${driveReason(perms.body) ? `: ${driveReason(perms.body)}` : ''}); a viewer is not always shown who else a file is shared with.`
  }
  const who = obj(b.lastModifyingUser)
  const shortcut = obj(b.shortcutDetails)
  const reply: Json = {
    file: {
      id: ask.id,
      name: cut(str(b.name), DRIVE_NAME_MAX),
      kind: driveKind(mime),
      mime,
      size_bytes: sizeOf(b),
      md5: strOrNull(b.md5Checksum),
      sha256: strOrNull(b.sha256Checksum),
      created_time: strOrNull(b.createdTime),
      modified_time: strOrNull(b.modifiedTime),
      modified_by: who ? (strOrNull(who.displayName) ?? strOrNull(who.emailAddress)) : null,
      owner: ownerOf(b),
      shared_drive: driveName,
      company_drive: ctx.company.driveId != null && driveId === ctx.company.driveId,
      trashed: b.trashed === true,
      url: strOrNull(b.webViewLink) ?? driveViewUrl(ask.id, mime),
      ...(shortcut ? { points_to: str(shortcut.targetId) } : {}),
    },
    // The folder that holds it first, then each folder above, as far up as the service account can read.
    parents,
    path: [...parents].reverse().map((p) => p.name ?? p.id),
    shared_with: sharedWith,
    ...(sharedWhy ? { shared_with_why: sharedWhy } : {}),
  }
  return { ok: true, reply, rows: 1 }
}

// ── plan_bid_submission / apply_bid_submission: the ask ──────────────────────────────────────────────────────────────

export type BidSubmissionPayload = {
  action: 'file'
  /** An id, or text that finds exactly one bid ("b398"). */
  bid: string
  /** The Drive file to file, by its id (a drive_url is read down to it). */
  drive_file_id: string
  /** True to take the place of a link the bid already carries. */
  replace: boolean
}

export type BidSubmissionInput = { ok: true; p: BidSubmissionPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = 'needs submission — { bid (an id, or text that finds one bid: "b398" — find_bid), drive_file_id (the paper’s Drive file id) or drive_url (its link), replace? (true to take the place of a link the bid already carries) }. One paper a call: a bid with several takes several calls.'

/** plan_bid_submission / apply_bid_submission's input, shaped; apply_ must quote a 64-hex plan_hash. */
export function bidSubmissionInput(verb: BidSubmissionVerb, input: Json): BidSubmissionInput {
  const shape = `${verb} ${SHAPE}`
  const src = obj(input.submission)
  if (!src) return { ok: false, error: shape }
  const bid = typeof src.bid === 'string' ? src.bid.trim() : ''
  if (!bid || bid.length > REF_MAX) return { ok: false, error: `${verb}: bid names the bid — its id, or text that finds exactly one ("b398"). ${SHAPE}` }
  const rawId = typeof src.drive_file_id === 'string' ? src.drive_file_id.trim() : ''
  const rawUrl = typeof src.drive_url === 'string' ? src.drive_url.trim() : ''
  if (!rawId && !rawUrl) return { ok: false, error: `${verb}: name the paper by drive_file_id or drive_url (read_drive_folder lists a folder's files with their ids). ${SHAPE}` }
  if (rawId && !DRIVE_ID_RE.test(rawId)) return { ok: false, error: `${verb}: drive_file_id "${cut(rawId, 80)}" is not a Drive file id; a link goes in drive_url.` }
  const fromUrl = rawUrl ? driveIdOf(rawUrl) : null
  if (rawUrl && !fromUrl) return { ok: false, error: `${verb}: drive_url "${cut(rawUrl, 80)}" does not carry a Drive file id; use the file's own link, or its drive_file_id.` }
  if (rawUrl && driveFolderIdFromUrl(rawUrl)) return { ok: false, error: `${verb}: drive_url is a folder's link, and a sent paper is one file. read_drive_folder { folder } lists the folder's files with their ids.` }
  if (rawId && fromUrl && rawId !== fromUrl) return { ok: false, error: `${verb}: drive_file_id (${rawId}) and drive_url (${fromUrl}) name two files; send one.` }
  if (src.replace !== undefined && src.replace !== null && typeof src.replace !== 'boolean') return { ok: false, error: `${verb}: replace is true or false.` }
  let planHash: string | null = null
  if (verb === 'apply_bid_submission') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!HASH_RE.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_bid_submission replied with.` }
    planHash = h
  }
  return { ok: true, p: { action: 'file', bid, drive_file_id: rawId || fromUrl!, replace: src.replace === true }, target: bid, planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────────

export type SubmissionFile = {
  id: string
  name: string
  mime: string
  size: number | null
  md5: string | null
  sha256: string | null
  modified: string | null
  trashed: boolean
  driveId: string | null
  parents: string[]
  owner: string | null
  url: string
  canCopy: boolean | null
  canDownload: boolean | null
  shortcutTo: string | null
}

export type SentPaper = { id: string; name: string; size: number | null; md5: string | null; modified: string | null }

export type SubmissionFolder =
  /** The bid has no project folder: the apply makes it, under this name. `rootSet` false means no jobs root to make it under. */
  | { kind: 'none'; name: string; rootSet: boolean }
  /** The bid's link is not a folder the app can file into; `seen` says how, `owner` whose My Drive. */
  | { kind: 'held'; seen: Exclude<BidFolderSeen, 'ok'>; name: string; owner: string | null; url: string | null }
  | { kind: 'ok'; id: string; name: string; url: string; driveId: string }

export type SubmissionWorld = {
  /** `link` is the submission link trimmed, null when blank; `linkRaw` is the column as stored, for the write's guard. */
  bid: { id: string; label: string; projectName: string; link: string | null; linkRaw: string | null; driveLink: string | null }
  file: SubmissionFile
  company: { rootFolderId: string | null; driveId: string | null; name: string | null }
  folder: SubmissionFolder
  /** Team only › Sent by us inside the project folder: its id when it exists, and the papers it holds, newest first. */
  sent: { id: string | null; papers: SentPaper[]; capped: boolean }
}

const eq = (column: string, value: string): RowFilter[] => [{ column, op: 'eq', value }]

/** The project folder as Drive describes it to the app: seeBidFolder's own kinds (`_shared/bidFolder.ts`), over DriveGet. */
async function seeProjectFolder(drive: DriveGet, folderId: string): Promise<{ seen: BidFolderSeen; name: string; owner: string | null; driveId: string | null }> {
  const a = await drive(`/files/${encodeURIComponent(folderId)}`, { fields: 'id,name,mimeType,parents,driveId,owners(displayName,emailAddress),capabilities/canAddChildren', supportsAllDrives: 'true' })
  if (a.status === 403 || a.status === 404) return { seen: 'cannot_open', name: '', owner: null, driveId: null }
  if (!okStatus(a)) throw new Error(`Drive answered ${a.status} when the app looked at the bid’s folder.`)
  const name = str(a.body.name)
  const o = obj((Array.isArray(a.body.owners) ? a.body.owners : [])[0])
  const owner = o ? (strOrNull(o.displayName) ?? strOrNull(o.emailAddress)) : null
  const driveId = strOrNull(a.body.driveId)
  if (str(a.body.mimeType) !== DRIVE_FOLDER_MIME) return { seen: 'not_a_folder', name, owner: null, driveId }
  if (obj(a.body.capabilities)?.canAddChildren !== true) return { seen: 'cannot_write', name, owner, driveId }
  if (!driveId) return { seen: 'outside_drive', name, owner, driveId: null }
  return { seen: 'ok', name, owner: null, driveId }
}

/** A child folder by its name, or null; never made here (`childFolder` in driveJobFolder.ts, over DriveGet). */
async function childFolderId(drive: DriveGet, parentId: string, name: string): Promise<string | null> {
  const a = await drive('/files', {
    q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })
  if (!okStatus(a)) throw new Error(`Drive answered ${a.status} when the app looked inside the bid’s folder.`)
  return strOrNull(obj((Array.isArray(a.body.files) ? a.body.files : [])[0])?.id)
}

/**
 * The bid, the paper, the company's Shared Drive, the bid's project folder and what its Sent by us already holds, as
 * the dev reads the bid and the service account reads Drive. `ref` is an id or text that finds exactly one bid.
 * Answers `{ refused }` in words when the bid or the file is not found; throws on a read that failed for another reason.
 */
export async function readBidSubmissionWorld(reader: Reader, drive: DriveGet, p: BidSubmissionPayload, ctx: { envRoot: string | null | undefined; serviceAccount: string | null }): Promise<SubmissionWorld | { refused: string }> {
  const resolved = await resolve(p.bid, () => findBid(reader, p.bid) as Promise<{ matches: Row[] }>, 'bid')
  if ('refused' in resolved) return resolved
  const id = resolved.id
  const [bidRows, prefixRows] = await Promise.all([
    reader.rows('bids', { select: `id,bid_number,project_name,address,created_at,customer_id,service_type_id,drive_link,${SUBMISSION_LINK_COLUMN}`, filters: eq('id', id), limit: 1 }),
    reader.rows('service_types', { select: 'id,ledger_bid_prefix', limit: 200 }),
  ])
  const bid = bidRows[0]
  if (!bid) return { refused: `No bid ${id} — it does not exist, or RLS hides it from you.` }

  const meta = await drive(`/files/${encodeURIComponent(p.drive_file_id)}`, {
    fields: 'id,name,mimeType,size,md5Checksum,sha256Checksum,modifiedTime,trashed,driveId,parents,webViewLink,owners(displayName,emailAddress),capabilities(canCopy,canDownload),shortcutDetails(targetId,targetMimeType)',
    supportsAllDrives: 'true',
  })
  if (!okStatus(meta)) return { refused: driveReadRefusal('file', p.drive_file_id, meta.status, driveReason(meta.body), ctx.serviceAccount) }
  const m = meta.body
  const caps = obj(m.capabilities)
  const file: SubmissionFile = {
    id: p.drive_file_id,
    name: str(m.name),
    mime: str(m.mimeType),
    size: sizeOf(m),
    md5: strOrNull(m.md5Checksum),
    sha256: strOrNull(m.sha256Checksum),
    modified: strOrNull(m.modifiedTime),
    trashed: m.trashed === true,
    driveId: strOrNull(m.driveId),
    parents: (Array.isArray(m.parents) ? m.parents : []).map(str).filter(Boolean),
    owner: ownerOf(m),
    url: strOrNull(m.webViewLink) ?? driveViewUrl(p.drive_file_id, str(m.mimeType)),
    canCopy: typeof caps?.canCopy === 'boolean' ? caps.canCopy : null,
    canDownload: typeof caps?.canDownload === 'boolean' ? caps.canDownload : null,
    shortcutTo: strOrNull(obj(m.shortcutDetails)?.targetId),
  }

  const company = await readCompanyDrive(reader, drive, ctx.envRoot)
  const prefix = prefixRows.find((r) => str(r.id) === str(bid.service_type_id))
  const world: SubmissionWorld = {
    bid: {
      id,
      label: formatBidLedgerNumberLabel(strOrNull(prefix?.ledger_bid_prefix), str(bid.bid_number)),
      projectName: str(bid.project_name),
      link: strOrNull(bid[SUBMISSION_LINK_COLUMN]),
      linkRaw: typeof bid[SUBMISSION_LINK_COLUMN] === 'string' ? (bid[SUBMISSION_LINK_COLUMN] as string) : null,
      driveLink: strOrNull(bid.drive_link),
    },
    file,
    company: { rootFolderId: company.rootFolderId, driveId: company.driveId, name: company.name },
    folder: { kind: 'none', name: '', rootSet: company.rootFolderId != null },
    sent: { id: null, papers: [], capped: false },
  }

  if (!world.bid.driveLink) {
    // No project folder yet: the name bid-photos' make will give it (bidFolderNameFor's rule, the customer read only when the pattern asks).
    let customer: string | null = null
    if (company.settings.bidPattern.includes('customer') && strOrNull(bid.customer_id)) {
      const c = await reader.rows('customers', { select: 'id,name', filters: eq('id', str(bid.customer_id)), limit: 1 })
      customer = strOrNull(c[0]?.name)
    }
    const name = bidFolderName(company.settings.bidPattern, {
      id,
      project: strOrNull(bid.project_name),
      number: strOrNull(bid.bid_number) ?? (typeof bid.bid_number === 'number' ? bid.bid_number : null),
      customer,
      address: strOrNull(bid.address),
      year: strOrNull(bid.created_at) ? todayYmdInAppTz(new Date(str(bid.created_at))).slice(0, 4) : null,
    })
    world.folder = { kind: 'none', name, rootSet: company.rootFolderId != null }
    return world
  }

  const folderId = driveFolderIdFromUrl(world.bid.driveLink)
  if (!folderId) {
    world.folder = { kind: 'held', seen: 'not_a_folder', name: '', owner: null, url: world.bid.driveLink }
    return world
  }
  const seen = await seeProjectFolder(drive, folderId)
  const url = driveViewUrl(folderId, DRIVE_FOLDER_MIME)
  if (seen.seen !== 'ok') {
    world.folder = { kind: 'held', seen: seen.seen, name: seen.name, owner: seen.owner, url }
    return world
  }
  world.folder = { kind: 'ok', id: folderId, name: seen.name, url, driveId: seen.driveId! }
  let into: string | null = folderId
  for (const name of SUBMISSION_LANDING) into = into ? await childFolderId(drive, into, name) : null
  if (into) {
    const list = await drive('/files', {
      q: `'${into}' in parents and trashed = false and mimeType != '${DRIVE_FOLDER_MIME}'`,
      pageSize: '100',
      orderBy: 'modifiedTime desc',
      fields: 'nextPageToken,files(id,name,size,md5Checksum,modifiedTime)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    })
    if (!okStatus(list)) throw new Error(`Drive answered ${list.status} when the app read the bid’s ${SUBMISSION_LANDING_WORDS} folder.`)
    world.sent = {
      id: into,
      papers: (Array.isArray(list.body.files) ? list.body.files : []).map((x) => obj(x) ?? {}).map((x) => ({ id: str(x.id), name: str(x.name), size: sizeOf(x), md5: strOrNull(x.md5Checksum), modified: strOrNull(x.modifiedTime) })),
      capped: strOrNull(list.body.nextPageToken) != null,
    }
  }
  return world
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** How the paper reaches Sent by us: Drive's own copy, a read and an upload through drive-link, or it is there already. */
export type SubmissionHow = 'copy' | 'upload' | 'already_there'

/** Why the app cannot file into the bid's project folder: bidFolderHoldWords' own sentence and fix, without its line about photos. */
export function submissionFolderHold(seen: Exclude<BidFolderSeen, 'ok'>, serviceAccount: string | null, owner: string | null): string {
  // canActAsPerson false: drive-link's put and Drive's copy file as the service account, which a My Drive folder refuses.
  const words = bidFolderHoldWords(seen, serviceAccount ?? 'the intake service account', owner, false) ?? ''
  return `${words.replace(/\s*The photos are safe[^.]*\.\s*$/, '')} Nothing was filed and the bid's link is as it was; plan again once it is fixed.`
}

/** A Drive link down to the file it opens, or null: two links to one file are one paper. */
function linkedFileId(link: string | null): string | null {
  return link ? driveIdOf(link) : null
}

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/**
 * What the plan says and what the hash commits to: the bid and the link it carries, the paper's facts as Drive states
 * them, the folder as it stands, how the paper reaches Sent by us, what is there already, the link after and the line
 * the Notes get. Every refusal is said before anything is hashed. No clock comes in.
 */
export function bidSubmissionDryRun(p: BidSubmissionPayload, world: SubmissionWorld, ctx: { serviceAccount: string | null }): DryRun {
  const f = world.file
  const refuse = (refused: string): DryRun => ({ ok: false, refused })
  const kind = driveKind(f.mime)
  if (f.trashed) return refuse(`${f.name} is in Drive's trash. Restore it first, then plan again.`)
  if (kind === 'folder') return refuse(`${f.name} is a folder, and a sent paper is one file. read_drive_folder { folder: "${f.id}" } lists its files with their ids; file them one a call.`)
  if (kind === 'shortcut') return refuse(`${f.name} is a shortcut${f.shortcutTo ? ` to ${f.shortcutTo}` : ''}, not the paper itself. Name the file it points to.`)
  if (kind !== 'file' || f.size == null || (!f.md5 && !f.sha256)) {
    const what = kind === 'google_doc' ? 'a Google Doc' : kind === 'google_sheet' ? 'a Google Sheet' : kind === 'google_slides' ? 'a Google Slides deck' : 'a kind of file Drive keeps no bytes or checksum for'
    return refuse(`${f.name} is ${what}: it can still be edited, so it is not the paper that was sent, and the plan has no bytes to commit to. In Drive, File → Download → PDF, put the PDF beside it, and name that file.`)
  }

  // The project folder: there, made at the apply, or held.
  const folder = world.folder
  if (folder.kind === 'held') return refuse(submissionFolderHold(folder.seen, ctx.serviceAccount, folder.owner))
  if (folder.kind === 'none' && !folder.rootSet) return refuse('This bid has no project folder, and the jobs root to make one under is not set yet. Set it on Documents → Where files go, or paste the bid’s folder on the bid under Files & links; then plan again.')

  // How it gets there.
  const inSent = world.sent.id != null && f.parents.includes(world.sent.id)
  const twin = !inSent ? world.sent.papers.find((s) => s.name === f.name && s.size === f.size && s.md5 != null && s.md5 === f.md5) : undefined
  const companyDriveId = world.company.driveId ?? (folder.kind === 'ok' ? folder.driveId : null)
  const inCompanyDrive = f.driveId != null && f.driveId === companyDriveId
  const how: SubmissionHow = inSent || twin ? 'already_there' : inCompanyDrive ? 'copy' : 'upload'
  if (how === 'copy' && f.canCopy === false) return refuse(`Drive does not let the intake service account copy ${f.name} (copying is turned off for it). A manager of the file turns on copying for viewers, or downloads it and puts the copy in the bid's folder; then plan again.`)
  if (how === 'upload') {
    const outside = `${f.name} is outside the company's Shared Drive${world.company.name ? ` (${world.company.name})` : ''}, so it is read on the server and uploaded`
    if (f.canDownload === false) return refuse(`${outside}, and Drive does not let the intake service account download it. Its owner turns on downloading for viewers, or moves it into the company's Shared Drive, where it is copied whole; then plan again.`)
    if (f.size > SUBMISSION_UPLOAD_MAX_BYTES) return refuse(`${outside}, and it is ${sizeWords(f.size)}: an upload takes at most ${SUBMISSION_UPLOAD_MAX_BYTES / 1024 / 1024} MB. Move it into the company's Shared Drive, where Drive copies it whole whatever its size; then plan again.`)
    if (f.size < 1) return refuse(`${f.name} is empty in Drive (0 bytes); there is no paper in it to file.`)
  }

  // The link: one column, one link.
  const filedId = inSent ? f.id : (twin?.id ?? null)
  const before = world.bid.link
  const beforeId = linkedFileId(before)
  if (filedId && beforeId === filedId) return refuse(`${world.bid.label} already carries this paper as its submission link (${before}), and the file is in ${SUBMISSION_LANDING_WORDS} of its project folder. There is nothing to file or to link.`)
  if (before && !p.replace) return refuse(`${world.bid.label} already has a submission link: ${before}. The column holds one link. Plan again with replace: true to make ${f.name} the link in its place; the paper it points to now stays where it is in Drive.`)

  const folderName = folder.name || 'the bid’s project folder'
  const lands = `${SUBMISSION_LANDING_WORDS} of ${folderName}`
  const others = world.sent.papers.filter((s) => s.id !== filedId)
  const sameName = others.filter((s) => s.name === f.name)
  const warnings: string[] = []
  if (how !== 'already_there' && sameName.length) warnings.push(`${SUBMISSION_LANDING_WORDS} already holds ${sameName.length === 1 ? 'a file' : `${sameName.length} files`} named ${f.name} with other bytes (${sameName.map((s) => s.id).join(', ')}): Drive keeps both under the one name, and this one becomes the link.`)
  if (world.sent.capped) warnings.push(`${SUBMISSION_LANDING_WORDS} holds more than the ${world.sent.papers.length} papers read; a paper past them with the same bytes would not be seen as already filed.`)
  if (p.replace && !before) warnings.push('replace was given and the bid carries no submission link: nothing is replaced.')
  if (how === 'upload') warnings.push(`${f.name} is not in the company's Shared Drive, so the copy is a read on the server and an upload through drive-link's put, ${SUBMISSION_UPLOAD_MAX_BYTES / 1024 / 1024} MB at most; the copy's modified time is the apply's, not the paper's.`)

  const howWords =
    how === 'already_there'
      ? inSent
        ? `Nothing is copied: ${f.name} is already in ${lands}. Only the link and the note are written.`
        : `Nothing is copied: the same bytes are already in ${lands} as ${twin!.id} (the same name, size and md5). That file becomes the link.`
      : how === 'copy'
        ? `Drive's own copy: ${f.name} (${f.mime}, ${sizeWords(f.size)}) is in the company's Shared Drive, so the service account copies it into ${lands} and no byte passes through the server. The original stays where it is.`
        : `Read and uploaded: the server reads ${f.name} (${f.mime}, ${sizeWords(f.size)}) from Drive, checks the bytes against what this plan saw, and uploads them into ${lands} through drive-link's put as you. The original stays where it is.`
  const after = filedId ? driveViewUrl(filedId) : null
  const note = submissionNoteText(f.name, before && p.replace ? before : null)

  const reply: Json = {
    action: 'file',
    bid: { id: world.bid.id, label: world.bid.label, project_name: world.bid.projectName },
    file: { drive_file_id: f.id, name: f.name, mime: f.mime, size_bytes: f.size, md5: f.md5, sha256: f.sha256, modified_time: f.modified, owner: f.owner, in_company_drive: inCompanyDrive, url: f.url },
    project_folder:
      folder.kind === 'ok'
        ? { state: 'exists', id: folder.id, name: folder.name, url: folder.url }
        : { state: 'made_at_apply', name: folder.name, makes: `The bid has no project folder. apply makes it first, as the Files window's Make the project folder does (bid-photos' make, as you): "${folder.name}" under the jobs root, with Team only › Photos inside, and bids.drive_link written by that function.` },
    lands,
    how,
    how_words: howWords,
    // The file already in Sent by us that becomes the link, when nothing is copied; null when the apply files a copy.
    already_filed_as: filedId,
    sent_by_us: {
      exists: world.sent.id != null,
      holds: others.length,
      papers: others.slice(0, SUBMISSION_SENT_LISTED).map((s) => ({ id: s.id, name: s.name, modified_time: s.modified })),
      ...(others.length ? { one_link: `bids.${SUBMISSION_LINK_COLUMN} holds one link and the folder holds ${others.length === 1 ? 'another paper' : `${others.length} other papers`}. This paper, the newest filed, becomes the link; the rest stay in the folder, a click away from it.` } : {}),
    },
    link: {
      column: SUBMISSION_LINK_COLUMN,
      before,
      after: after ?? 'the filed copy’s link (https://drive.google.com/file/d/<its id>/view), known once the apply has filed it',
      replaces: Boolean(before),
      reads: 'the Bid Board’s Submission chip and the Files window’s Submission link, as a pasted link reads',
    },
    note: { lands: `Bids → Bid Board → ${world.bid.label}'s Notes, as a note by you, stamped when the apply writes it`, text: note },
    warnings,
    not_done: [
      'a contact logged with its method (the Bid Board’s Log contact): no verb writes one yet',
      'the sent date, who it went to and the outcome: plan_bid_update',
      'nothing goes to the customer or the GC, and nobody is told',
      'the original file is neither moved nor removed',
    ],
  }
  return { ok: true, reply }
}

/** The line the bid's Notes get, as plan_activity_note writes one. No clock and no id of the copy: the plan shows it whole. */
export function submissionNoteText(fileName: string, replaced: string | null): string {
  return `Sent paper filed from Drive: “${fileName}” is in ${SUBMISSION_LANDING_WORDS} of the bid’s project folder and is the bid’s submission link.${replaced ? ` It takes the place of ${replaced}.` : ''}`
}

/** The row the note's insert sends: plan_activity_note's own for a bid (the Bid Board's Notes popover, no contact method). `now` is the apply's clock. */
export function submissionNoteRow(bidId: string, text: string, me: { userId: string }, now: string): Json {
  return { bid_id: bidId, gc_customer_id: null, notes: text, contact_method: null, occurred_at: now, created_by: me.userId }
}

/**
 * The link's write, as the Files window's pasted link writes it (bidFilesIo saveBidFileLink: one PATCH on bids that
 * must answer with its row), held to the link the plan read: a link someone set while the paper was being filed
 * matches no row, and the apply says so instead of writing over it.
 */
export function submissionLinkWrite(bidId: string, before: string | null, after: string): { query: string; body: Json } {
  const guard = before && before.trim() ? `${SUBMISSION_LINK_COLUMN}=eq.${encodeURIComponent(before)}` : `or=(${SUBMISSION_LINK_COLUMN}.is.null,${SUBMISSION_LINK_COLUMN}.eq.)`
  return { query: `id=eq.${bidId}&${guard}&select=id,${SUBMISSION_LINK_COLUMN}`, body: { [SUBMISSION_LINK_COLUMN]: after } }
}

/** Why bytes read at the apply are not the paper the plan saw, or null when they are. */
export function uploadBytesProblem(file: { name: string; size_bytes: number; sha256: string | null }, read: { length: number; sha256: string }): string | null {
  if (read.length !== file.size_bytes) return `${file.name} read as ${count(read.length)} bytes and the plan saw ${count(file.size_bytes)}: the file changed in Drive since. Nothing was filed. Plan again.`
  if (file.sha256 && file.sha256.toLowerCase() !== read.sha256.toLowerCase()) return `${file.name} read with sha256 ${read.sha256.slice(0, 12)}… and the plan saw ${file.sha256.slice(0, 12)}…: the file changed in Drive since. Nothing was filed. Plan again.`
  return null
}

/** Drive's refusal of the copy or of a folder made for it, in words with the share that fixes it. */
export function submissionFilingRefusal(message: string, serviceAccount: string | null, folderUrl: string | null): string {
  const reason = message.trim().replace(/[.\s]+$/, '')
  const account = serviceAccount ? `the intake service account (${serviceAccount})` : 'the intake service account'
  const where = folderUrl ? `the bid's project folder (${folderUrl})` : "the bid's project folder"
  if (/rate ?limit/i.test(reason)) return `Drive is rate-limiting the service account: ${reason}. Nothing was filed and the bid's link is as it was. Wait a minute and plan again.`
  if (/storage ?quota/i.test(reason)) return `Drive refused the filing: ${reason}. ${where} is not on a Shared Drive, where the service account has no storage. Move the folder into the company's Shared Drive. Nothing was filed and the bid's link is as it was.`
  return `Drive refused the filing: ${reason}. A manager gives ${account} write access to ${where}: Contributor on its Shared Drive. Nothing was filed and the bid's link is as it was.`
}

export type SubmissionOutcome = {
  /** The file the link points to: the copy made, or the one that was there already. */
  filed: { id: string; url: string; how: SubmissionHow; md5: string | null }
  /** The project folder: made by this apply, with its link, or there before. */
  folder: { made: boolean; url: string | null }
  link: { set: boolean; before: string | null; after: string; why?: string | null }
  note: { saved: boolean; id?: string | null; why?: string | null }
}

/** The apply's reply: each step by name, what it wrote, and the read that shows it. */
export function bidSubmissionAppliedWords(reply: Json, outcome: SubmissionOutcome): Json {
  const bid = obj(reply.bid) ?? {}
  const file = obj(reply.file) ?? {}
  const label = str(bid.label)
  const lands = str(reply.lands)
  const name = str(file.name)
  const planMd5 = strOrNull(file.md5)
  const warnings: string[] = []
  if (outcome.filed.how === 'copy' && planMd5 && outcome.filed.md5 && planMd5 !== outcome.filed.md5) warnings.push(`The copy's md5 (${outcome.filed.md5}) is not the plan's (${planMd5}): the file changed in Drive in the moment between the plan's read and the copy. Read both and file again if the copy is not the paper.`)
  if (!outcome.link.set) warnings.push(`The paper is filed and the link was NOT set: ${outcome.link.why ?? 'the write matched no row'}. plan_bid_update { update: { bid_id: "${str(bid.id)}", set: { ${SUBMISSION_LINK_COLUMN}: "${outcome.link.after}" } } } sets it.`)
  if (outcome.link.set && !outcome.note.saved) warnings.push(`The note did not save (${outcome.note.why ?? 'no reason given'}); the paper is filed and linked. plan_activity_note leaves the line.`)
  return {
    filed: outcome.filed.how === 'already_there' ? `${name} was already in ${lands}; nothing was copied.` : `${name} is in ${lands} (${outcome.filed.how === 'copy' ? "Drive's own copy" : 'read and uploaded'}).`,
    drive_file_id: outcome.filed.id,
    url: outcome.filed.url,
    project_folder: { made: outcome.folder.made, url: outcome.folder.url },
    link: { column: SUBMISSION_LINK_COLUMN, before: outcome.link.before, after: outcome.link.set ? outcome.link.after : outcome.link.before, set: outcome.link.set },
    note: outcome.note.saved ? { saved: true, id: outcome.note.id ?? null } : { saved: false },
    bid: { id: str(bid.id), label },
    ...(warnings.length ? { warnings } : {}),
    next: `get_bid { bid: "${label}" } reads the bid with its links; read_drive_folder { file: "${outcome.filed.id}" } reads the filed paper's facts; read_rows on bids_submission_entries by bid_id lists the bid's notes, this one newest.`,
  }
}
