/**
 * Signed contracts in Google Drive (punch list #377, PR 1): the rules, pure, with no database and no Drive in them. A
 * signed job contract lived in the app's own storage and nowhere in Drive, so Find a file could not find it. The filing
 * function (`job-contract-drive`, PR 2), the Contract sweep's Drive pass, the Contract window and Documents → Where files
 * go all read this one file, so each says the same thing about the same paper. The app's door is
 * `src/lib/jobs/jobContractDrive.ts`.
 *
 * The owner's seven calls of 2026-11-17, as the card records them:
 *  1. the paper goes in its job's folder, where estimators can read it;
 *  2. every signed paper with a file is filed, and one already in the jobs drive is adopted where it sits;
 *  3. it lands in Team only › Contracts, named by day, kind, job number and signer;
 *  4. a voided paper's copy is renamed VOIDED and kept;
 *  5. one paper over several jobs gets a copy in each job's folder;
 *  6. a sweep files it, never the signing, and the backfill is the same sweep;
 *  7. `signed_document_url` stays what the office typed.
 */
import { calendarYmdInAppTzFromIso } from './appTimeZone.ts'
import { driveSafeName } from './whereFilesGo.ts'

/** The sixth folder, inside Team only, found or made the first time a paper is filed on a job. */
export const CONTRACTS_FOLDER_NAME = 'Contracts'
/** The app's own mark on a file it filed (`appProperties`): the contract's id, so a second run finds the file it made. */
export const CONTRACT_FILE_MARK = 'pt_job_contract'
/** What a voided paper's copy is renamed to start with. */
export const VOIDED_NAME_PREFIX = 'VOIDED · '
/** A Drive name longer than this is cut, extension kept. */
const NAME_MAX = 180

/** How the Drive file came to be the paper's copy: the app put it there, or the office already had. */
export type ContractDriveOrigin = 'filed' | 'adopted'

/** Why a paper is not in Drive. */
export type ContractDriveHoldKind = 'no_drive' | 'no_root' | 'job_folder' | 'open_link' | 'link_outside' | 'no_file' | 'too_big' | 'drive_refused'

export const CONTRACT_DRIVE_HOLD_KINDS: readonly ContractDriveHoldKind[] = ['no_drive', 'no_root', 'job_folder', 'open_link', 'link_outside', 'no_file', 'too_big', 'drive_refused']

/** A `job_contracts` row as these rules read it. Every Drive column is optional: a read from before the migration has none. */
export interface ContractDriveRow {
  id: string
  job_id: string
  kind?: string | null
  status: string
  voided_at?: string | null
  signed_at?: string | null
  paper_signed_on?: string | null
  our_signed_on?: string | null
  signed_pdf_path?: string | null
  paper_upload_path?: string | null
  signed_document_url?: string | null
  covers_group_id?: string | null
  paper_title?: string | null
  drive_file_id?: string | null
  drive_filed_at?: string | null
  drive_file_origin?: string | null
  drive_file_hold?: string | null
  drive_file_hold_words?: string | null
  drive_file_tried_at?: string | null
  drive_void_marked_at?: string | null
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Signed and in force: the papers this card files. */
export function isSignedLive(row: Pick<ContractDriveRow, 'status' | 'voided_at'>): boolean {
  return row.status === 'signed' && !row.voided_at
}

export function isVoided(row: Pick<ContractDriveRow, 'status' | 'voided_at'>): boolean {
  return row.status === 'voided' || Boolean(row.voided_at)
}

/**
 * The Drive file a link names: `drive.google.com/file/d/<id>`, `open?id=`, `uc?id=`, and a Google Doc, Sheet or Slides
 * link, which is a Drive file too. Null for a folder link, a link elsewhere or no link.
 */
export function contractLinkFileId(url: string | null | undefined): string | null {
  const v = str(url)
  if (!v) return null
  const drive = /drive\.google\.com\/(?:file\/d\/([\w-]{20,})|(?:open|uc)\?(?:[^#]*&)?id=([\w-]{20,}))/.exec(v)
  if (drive) return drive[1] ?? drive[2] ?? null
  const doc = /docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([\w-]{20,})/.exec(v)
  return doc?.[1] ?? null
}

/** A Drive file's own page. */
export function contractDriveUrl(driveFileId: string): string {
  return `https://drive.google.com/file/d/${driveFileId}/view`
}

/** Where a signed paper's file is. */
export type ContractFileSource =
  /** In the contract bucket: the scan the office uploaded, or the PDF the signing built. */
  | { from: 'bucket'; path: string; ext: string; scan: boolean }
  /** No stored file, and the link the office typed names a Drive file. */
  | { from: 'drive_link'; driveFileId: string }
  /** No stored file, and the link is not a Drive file. */
  | { from: 'other_link'; url: string }
  | { from: 'none' }

function extOf(path: string): string {
  const ext = (path.split('/').pop() ?? '').split('.').pop() ?? ''
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, '')
  return clean && clean.length <= 5 && clean !== (path.split('/').pop() ?? '').toLowerCase() ? clean : 'pdf'
}

/**
 * One file per record. The scan when the record has one, since the paper is then the record's document; else the signed
 * PDF; else the link the office typed. A record with both a stored file and a link files the stored file.
 */
export function contractFileSource(row: Pick<ContractDriveRow, 'paper_upload_path' | 'signed_pdf_path' | 'signed_document_url'>): ContractFileSource {
  const scan = str(row.paper_upload_path)
  if (scan) return { from: 'bucket', path: scan, ext: extOf(scan), scan: true }
  const pdf = str(row.signed_pdf_path)
  if (pdf) return { from: 'bucket', path: pdf, ext: extOf(pdf), scan: false }
  const link = str(row.signed_document_url)
  if (!link) return { from: 'none' }
  const id = contractLinkFileId(link)
  return id ? { from: 'drive_link', driveFileId: id } : { from: 'other_link', url: link }
}

// ── the queue ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * How long a hold waits before the sweep tries the paper again. A hold whose cause clears by itself (Drive back, a root
 * set, the job's folder fixed, a refusal that was a blip) is taken every run; one that needs a person's file first is
 * taken hourly, which costs one read.
 */
export function holdRetryMinutes(kind: string | null | undefined): number {
  return kind === 'no_file' || kind === 'link_outside' || kind === 'open_link' || kind === 'too_big' ? 60 : 0
}

/** What the sweep owes a row now: a filing, the VOIDED mark on its own copy, or nothing. */
export type ContractDriveDue = 'file' | 'mark_void' | null

export function contractDriveDue(row: ContractDriveRow, nowMs: number): ContractDriveDue {
  if (isVoided(row)) {
    // Only the app's own copy is renamed. A file the office placed keeps its name.
    return str(row.drive_file_id) && row.drive_file_origin === 'filed' && !row.drive_void_marked_at ? 'mark_void' : null
  }
  if (!isSignedLive(row) || str(row.drive_file_id)) return null
  const tried = row.drive_file_tried_at ? new Date(row.drive_file_tried_at).getTime() : Number.NaN
  if (Number.isNaN(tried)) return 'file'
  return nowMs - tried >= holdRetryMinutes(row.drive_file_hold) * 60_000 ? 'file' : null
}

// ── the name ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The signed day, YYYY-MM-DD in the company's zone: the day on the paper when the office typed one, else the signing's. */
export function contractSignedDay(row: Pick<ContractDriveRow, 'kind' | 'our_signed_on' | 'paper_signed_on' | 'signed_at'>): string {
  const ymd = (v: unknown) => (/^\d{4}-\d{2}-\d{2}/.test(str(v)) ? str(v).slice(0, 10) : '')
  const typed = (row.kind === 'their_paper' ? ymd(row.our_signed_on) : '') || ymd(row.paper_signed_on)
  if (typed) return typed
  return row.signed_at ? calendarYmdInAppTzFromIso(row.signed_at) : ''
}

/** What the paper is, as its name says it. */
export function contractWhatWords(row: Pick<ContractDriveRow, 'kind'>, source: ContractFileSource): string {
  if (row.kind === 'their_paper') return 'Their paper signed by us'
  const base = row.kind === 'warranty' ? 'Signed warranty' : 'Signed contract'
  return source.from === 'bucket' && source.scan ? `${base} scan` : base
}

/** "251", "251 and 825", "251, 825 and 843": the numbers in the order a person reads them. */
export function joinJobNumbers(nums: readonly string[]): string {
  const key = (n: string) => Number.parseInt(n.replace(/\D+/g, ''), 10) || 0
  const list = [...new Set(nums.map((n) => n.trim()).filter(Boolean))].sort((a, b) => key(a) - key(b) || a.localeCompare(b))
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

export interface ContractDriveNameInput {
  row: Pick<ContractDriveRow, 'kind' | 'our_signed_on' | 'paper_signed_on' | 'signed_at' | 'paper_title'>
  source: ContractFileSource
  /** The job's own number, as the app prints it. */
  jobNumber: string | null | undefined
  /** Who signed, as the record's names line says it. */
  signer: string | null | undefined
  /** Every job the paper covers, when it covers more than this one (`covers_group_id`). */
  coversJobNumbers?: readonly string[]
  /** The customer, which names a paper over several jobs. */
  customerName?: string | null
}

/**
 * The file's name in Drive: the signed day, as the photo sweep names a shot, then what it is, the job's number and who
 * signed. *2026-11-14 Signed contract · 1042 · Dana Whitfield.pdf*. A GC's paper ends on its title; a paper over several
 * jobs says which and ends on the customer. A piece the record lacks is left out, never printed empty.
 */
export function contractDriveName(input: ContractDriveNameInput): string {
  const { row, source } = input
  const ext = source.from === 'bucket' ? source.ext : 'pdf'
  const covers = (input.coversJobNumbers ?? []).filter((n) => n.trim())
  const group = new Set(covers.map((n) => n.trim())).size > 1
  const mid = group ? `covers ${joinJobNumbers(covers)}` : str(input.jobNumber)
  const who = row.kind === 'their_paper' ? str(row.paper_title) : group ? str(input.customerName) || str(input.signer) : str(input.signer)
  const head = [contractSignedDay(row), contractWhatWords(row, source)].filter(Boolean).join(' ')
  const base = driveSafeName([head, mid, who].filter(Boolean).join(' · ').replace(/\//g, '-'))
  return `${base.slice(0, NAME_MAX).trim()}.${ext}`
}

/** A voided paper's copy, renamed once: the prefix goes on a name that does not have it. */
export function voidedDriveName(name: string): string {
  return name.startsWith(VOIDED_NAME_PREFIX) ? name : `${VOIDED_NAME_PREFIX}${name}`
}

/** A paper un-voided: the prefix comes off. */
export function unvoidedDriveName(name: string): string {
  return name.startsWith(VOIDED_NAME_PREFIX) ? name.slice(VOIDED_NAME_PREFIX.length) : name
}

// ── a paper the office already keeps in Drive ────────────────────────────────────────────────────────────────────

/** What Drive said about the file a typed link names, read as the service account. */
export interface LinkedFileFacts {
  /** Whether the service account could see the file at all. */
  seen: boolean
  isFolder: boolean
  trashed: boolean
  /** Whether the company's jobs Shared Drive holds it. */
  inCompanyDrive: boolean
}

/**
 * A paper that is already a Drive file is adopted, not copied: recorded as the paper's Drive copy and left exactly where
 * it is, under its own name. Only a file inside the jobs drive, where Find a file looks, can be.
 */
export function canAdoptLinkedFile(f: LinkedFileFacts): boolean {
  return f.seen && !f.isFolder && !f.trashed && f.inCompanyDrive
}

// ── the holds ────────────────────────────────────────────────────────────────────────────────────────────────────

/** The words of a hold whose reason is the same every time. The job's folder and Drive's refusal bring their own. */
export const CONTRACT_HOLD_WORDS: Readonly<Record<ContractDriveHoldKind, string>> = {
  no_drive: 'Drive is not connected. The paper is safe here and files itself once Drive is back.',
  no_root: 'The jobs root is not set yet. The paper is safe here and files itself once it is.',
  job_folder: 'This job’s Drive folder is held. The paper files itself once the folder is fixed.',
  open_link: 'This job’s folder is open to anyone with its link. A signed contract is not filed there.',
  link_outside: 'The signed paper is a link outside the jobs drive. Upload the scan and it is filed.',
  no_file: 'Nothing to file. This record has no scan and no link.',
  too_big: 'The scan is too big to file. Put it in the job’s folder in Drive and paste its link.',
  drive_refused: 'Drive refused the file. The app tries again by itself.',
}

/** A hold as the row keeps it: the kind, and the words a person reads. */
export interface ContractDriveHold {
  kind: ContractDriveHoldKind
  words: string
}

/** A hold with its words: the reason given when there is one (the job's own, Drive's own), else the kind's. */
export function contractHold(kind: ContractDriveHoldKind, reason?: string | null): ContractDriveHold {
  const given = str(reason)
  return { kind, words: (given || CONTRACT_HOLD_WORDS[kind]).slice(0, 400) }
}

/** Where a hold's door leads. */
export type ContractHoldDoorTo = 'where_files_go' | 'job_edit' | 'drive_folder' | 'add_scan'

/** The door a hold offers, or null when the app only has to try again. */
export function contractHoldDoor(kind: string | null | undefined): { label: string; to: ContractHoldDoorTo } | null {
  switch (kind) {
    case 'no_drive':
    case 'no_root':
      return { label: 'Open Where files go', to: 'where_files_go' }
    case 'job_folder':
      return { label: 'Open the job’s Edit tab', to: 'job_edit' }
    case 'open_link':
      return { label: 'Open the job’s folder', to: 'drive_folder' }
    case 'link_outside':
    case 'no_file':
    case 'too_big':
      return { label: 'Add the scan', to: 'add_scan' }
    default:
      return null
  }
}

/** Whether *Try again* makes sense: not while the paper still needs a file from a person. */
export function contractHoldRetries(kind: string | null | undefined): boolean {
  return kind !== 'no_file' && kind !== 'link_outside' && kind !== 'too_big'
}

// ── the Contract window's Drive block ────────────────────────────────────────────────────────────────────────────

export type ContractDriveState = 'none' | 'filed' | 'adopted' | 'waiting' | 'held' | 'voided'

export interface ContractDriveLine {
  state: ContractDriveState
  title: string
  sub: string
  /** The Drive file to open, when there is one. */
  driveFileId: string | null
  door: { label: string; to: ContractHoldDoorTo } | null
  /** *File it in Drive now*: a signed paper the sweep has not reached. */
  fileNow: boolean
  /** *Try again*: a hold the app can clear by trying. */
  retry: boolean
}

export const CONTRACT_DRIVE_WORDS = {
  block: 'Drive',
  filed: 'In the job’s Drive folder',
  adopted: 'In Drive, where the office put it',
  notYet: 'Not in Drive yet',
  waitingSub: 'The app files it within ten minutes.',
  voided: 'Voided',
  voidedMarked: 'The Drive copy is renamed VOIDED and kept.',
  voidedSoon: 'The Drive copy is renamed VOIDED within ten minutes.',
  voidedAdopted: 'The file in Drive is the office’s own and keeps its name.',
  open: 'Open in Drive',
  fileNow: 'File it in Drive now',
  filing: 'Filing…',
  retry: 'Try again',
  path: 'Team only › Contracts',
} as const

/**
 * The block's line for one record. `filedDay` is the filed day as the screen words a day (*Nov 14*); `path` is where an
 * adopted file sits, when the screen knows. A record that is not signed has no block.
 */
export function contractDriveLine(row: ContractDriveRow, opts: { filedDay?: string | null; path?: string | null } = {}): ContractDriveLine {
  const none: ContractDriveLine = { state: 'none', title: '', sub: '', driveFileId: null, door: null, fileNow: false, retry: false }
  const fileId = str(row.drive_file_id) || null
  const W = CONTRACT_DRIVE_WORDS
  if (isVoided(row)) {
    if (!fileId) return none
    const sub = row.drive_file_origin === 'filed' ? (row.drive_void_marked_at ? W.voidedMarked : W.voidedSoon) : W.voidedAdopted
    return { ...none, state: 'voided', title: W.voided, sub, driveFileId: fileId }
  }
  if (!isSignedLive(row)) return none
  if (fileId) {
    if (row.drive_file_origin === 'adopted') return { ...none, state: 'adopted', title: W.adopted, sub: str(opts.path), driveFileId: fileId }
    const day = str(opts.filedDay)
    return { ...none, state: 'filed', title: W.filed, sub: day ? `${W.path} · filed ${day}` : W.path, driveFileId: fileId }
  }
  const kind = str(row.drive_file_hold)
  if (!kind) return { ...none, state: 'waiting', title: W.notYet, sub: W.waitingSub, fileNow: true }
  const words = str(row.drive_file_hold_words) || CONTRACT_HOLD_WORDS[kind as ContractDriveHoldKind] || W.waitingSub
  return { ...none, state: 'held', title: W.notYet, sub: words, door: contractHoldDoor(kind), retry: contractHoldRetries(kind) }
}

// ── Documents → Where files go: the counts ───────────────────────────────────────────────────────────────────────

export interface ContractDriveCounts<T> {
  /** Signed and in force. */
  signed: number
  inDrive: number
  /** Signed, not filed, not held: the press files these. */
  waiting: number
  held: T[]
}

/** The card's counts over the signed papers: in Drive, waiting on the sweep, held with a reason. */
export function contractDriveCounts<T extends ContractDriveRow>(rows: readonly T[]): ContractDriveCounts<T> {
  const live = rows.filter(isSignedLive)
  const held = live.filter((r) => !str(r.drive_file_id) && str(r.drive_file_hold))
  const inDrive = live.filter((r) => str(r.drive_file_id)).length
  return { signed: live.length, inDrive, waiting: live.length - inDrive - held.length, held }
}

// ── the Contract sweep's Drive pass ──────────────────────────────────────────────────────────────────────────────

/**
 * The Drive files that are already a paper on file, by id and never by name: the file a signed record keeps (filed or
 * adopted), the file inside a signed record's typed link, and every copy the app itself made, voided ones too. A file
 * the office linked on a record that was then voided is nobody's paper again, so the pass may offer it.
 */
export function knownContractFileIds(rows: readonly Pick<ContractDriveRow, 'status' | 'voided_at' | 'drive_file_id' | 'drive_file_origin' | 'signed_document_url'>[]): Set<string> {
  const out = new Set<string>()
  for (const r of rows) {
    const id = str(r.drive_file_id)
    if (id && r.drive_file_origin === 'filed') out.add(id)
    if (!isSignedLive(r)) continue
    if (id) out.add(id)
    const linked = contractLinkFileId(r.signed_document_url)
    if (linked) out.add(linked)
  }
  return out
}

/** The scan's files with the papers on file taken out. */
export function withoutKnownContracts<T extends { id: string }>(files: readonly T[], known: ReadonlySet<string>): T[] {
  return known.size === 0 ? [...files] : files.filter((f) => !known.has(f.id))
}
