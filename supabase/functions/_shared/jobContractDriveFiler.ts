/**
 * Signed contracts in Google Drive (punch list #377, PR 2): one paper through the rules. `jobContractDrive.ts` decides;
 * this file does it, against a Drive and a store it is handed, so `src/lib/jobs/jobContractDriveFiler.test.ts` runs the
 * whole path with neither. The function `job-contract-drive` hands it the real ones.
 *
 * A paper is never lost here. Whatever happens, the record and its file in the app's storage are as they were: the only
 * writes are the Drive columns on the row, and a filing that cannot go through leaves its reason there. Nothing throws
 * past `fileContract`: Drive's own refusal becomes the hold `drive_refused`, with Drive's words.
 */
import {
  CONTRACTS_FOLDER_NAME,
  CONTRACT_FILE_MARK,
  canAdoptLinkedFile,
  contractDriveName,
  contractFileSource,
  contractHold,
  isSignedLive,
  isVoided,
  voidedDriveName,
  type ContractDriveHold,
  type ContractDriveHoldKind,
  type ContractDriveRow,
  type ContractFileSource,
  type LinkedFileFacts,
} from './jobContractDrive.ts'
import { JOB_FOLDER_TREE, driveFailWords } from './whereFilesGo.ts'

/** A stored file past this is not sent to Drive whole: the paper is held as too big. */
export const CONTRACT_FILE_MAX_BYTES = 25 * 1024 * 1024

/** The Drive the filer talks to. Each call may throw with Drive's reason. */
export interface FilerDrive {
  /** The job's folder, placed in the tree as the photo sweep's first photo places it; or why it cannot be. */
  jobFolder(jobId: string): Promise<{ folderId: string } | { why: string }>
  /** A folder of that name under the parent, found or made. */
  folder(parentId: string, name: string): Promise<string>
  /** Whether anyone with the link can open the folder, its own sharing and what it inherits. */
  openToAnyone(folderId: string): Promise<boolean>
  /** The file in the folder that carries this contract's mark, if a run already made one. */
  marked(folderId: string, contractId: string): Promise<{ id: string; name: string } | null>
  nameTaken(folderId: string, name: string): Promise<boolean>
  upload(folderId: string, bytes: Uint8Array, name: string, mime: string, mark: Record<string, string>): Promise<string>
  /** What Drive says of the file a typed link names. */
  linked(fileId: string): Promise<LinkedFileFacts>
  /** A file's name, or null when Drive no longer holds it. */
  fileName(fileId: string): Promise<string | null>
  rename(fileId: string, name: string): Promise<void>
  /** Hands the file to the index now. Best effort: the index sweep is the net. */
  index(fileId: string): Promise<void>
}

/** What a paper's name is made of, read from the record and its job. */
export interface ContractNameFacts {
  jobNumber: string | null
  signer: string | null
  /** Every job the paper covers when it covers more than one; else empty. */
  coversJobNumbers: readonly string[]
  customerName: string | null
}

/** The app's own side: the stored file, the facts for the name, and the row's Drive columns. */
export interface FilerStore {
  /** The stored file's bytes, `tooBig` past the cap, or null when the bucket has no such file. */
  bytes(path: string, maxBytes: number): Promise<{ bytes: Uint8Array; mime: string | null } | 'tooBig' | null>
  nameFacts(row: ContractDriveRow): Promise<ContractNameFacts>
  save(contractId: string, patch: Record<string, string | null>): Promise<void>
}

export type FileOutcome =
  | { id: string; did: 'filed' | 'adopted' | 'found'; driveFileId: string; name: string | null }
  | { id: string; did: 'held'; hold: ContractDriveHold }
  | { id: string; did: 'marked' | 'nothing' }

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export function mimeForExt(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? 'application/octet-stream'
}

/** `name.pdf` → `name (2).pdf`, `name (3).pdf`: the first the folder does not hold. */
export async function freeContractName(name: string, taken: (name: string) => Promise<boolean>, tries = 20): Promise<string> {
  if (!(await taken(name))) return name
  const dot = name.lastIndexOf('.')
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  for (let n = 2; n < tries + 2; n += 1) {
    const next = `${stem} (${n})${ext}`
    if (!(await taken(next))) return next
  }
  throw new Error('Too many files of that name in the folder.')
}

const reasonOf = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** The columns a filing writes: the file, the day, how it came to be, and the hold cleared. */
function filedPatch(driveFileId: string, origin: 'filed' | 'adopted', nowIso: string): Record<string, string | null> {
  return { drive_file_id: driveFileId, drive_filed_at: nowIso, drive_file_origin: origin, drive_file_hold: null, drive_file_hold_words: null, drive_file_tried_at: nowIso }
}

function heldPatch(hold: ContractDriveHold, nowIso: string): Record<string, string | null> {
  return { drive_file_hold: hold.kind, drive_file_hold_words: hold.words, drive_file_tried_at: nowIso }
}

/** A hold the whole run shares (Drive not connected, no jobs root): written on the row without asking Drive anything. */
export async function holdContract(row: Pick<ContractDriveRow, 'id'>, kind: ContractDriveHoldKind, store: FilerStore, nowIso: string, reason?: string | null): Promise<FileOutcome> {
  const hold = contractHold(kind, reason)
  await store.save(row.id, heldPatch(hold, nowIso))
  return { id: row.id, did: 'held', hold }
}

async function bucketFiling(row: ContractDriveRow, source: Extract<ContractFileSource, { from: 'bucket' }>, drive: FilerDrive, store: FilerStore, nowIso: string): Promise<FileOutcome> {
  const hold = (kind: ContractDriveHoldKind, reason?: string | null) => holdContract(row, kind, store, nowIso, reason)
  const placed = await drive.jobFolder(row.job_id)
  if ('why' in placed) return hold('job_folder', placed.why)
  const teamId = await drive.folder(placed.folderId, JOB_FOLDER_TREE.teamOnly)
  const contractsId = await drive.folder(teamId, CONTRACTS_FOLDER_NAME)
  // A signed contract is a legal paper: never into a folder anyone with its link can open.
  if (await drive.openToAnyone(contractsId)) return hold('open_link')
  // A run that uploaded the file and died before the row was written left the file with this contract's mark.
  const made = await drive.marked(contractsId, row.id)
  if (made) {
    await store.save(row.id, filedPatch(made.id, 'filed', nowIso))
    await drive.index(made.id).catch(() => {})
    return { id: row.id, did: 'found', driveFileId: made.id, name: made.name }
  }
  const file = await store.bytes(source.path, CONTRACT_FILE_MAX_BYTES)
  if (file === 'tooBig') return hold('too_big')
  if (!file) return hold('no_file', 'The record’s file is missing from the app’s storage. Add the scan again.')
  const facts = await store.nameFacts(row)
  const wanted = contractDriveName({ row, source, jobNumber: facts.jobNumber, signer: facts.signer, coversJobNumbers: facts.coversJobNumbers, customerName: facts.customerName })
  const name = await freeContractName(wanted, (n) => drive.nameTaken(contractsId, n))
  const id = await drive.upload(contractsId, file.bytes, name, file.mime || mimeForExt(source.ext), { [CONTRACT_FILE_MARK]: row.id })
  await store.save(row.id, filedPatch(id, 'filed', nowIso))
  await drive.index(id).catch(() => {})
  return { id: row.id, did: 'filed', driveFileId: id, name }
}

/**
 * One signed paper into Drive: the stored file uploaded under Team only › Contracts in its job's folder, or the Drive
 * file a typed link names adopted where it sits. A paper already in Drive, or one that is not signed and in force, is
 * left alone. Whatever stops it is written on the row as the hold.
 */
export async function fileContract(row: ContractDriveRow, drive: FilerDrive, store: FilerStore, now: Date = new Date()): Promise<FileOutcome> {
  if (!isSignedLive(row) || (row.drive_file_id ?? '').trim()) return { id: row.id, did: 'nothing' }
  const nowIso = now.toISOString()
  const source = contractFileSource(row)
  try {
    if (source.from === 'none') return await holdContract(row, 'no_file', store, nowIso)
    if (source.from === 'other_link') return await holdContract(row, 'link_outside', store, nowIso)
    if (source.from === 'drive_link') {
      if (!canAdoptLinkedFile(await drive.linked(source.driveFileId))) return await holdContract(row, 'link_outside', store, nowIso)
      await store.save(row.id, filedPatch(source.driveFileId, 'adopted', nowIso))
      await drive.index(source.driveFileId).catch(() => {})
      return { id: row.id, did: 'adopted', driveFileId: source.driveFileId, name: null }
    }
    return await bucketFiling(row, source, drive, store, nowIso)
  } catch (e) {
    // Drive's own refusal, in Drive's words. The row write itself failing is the one thing that can still throw.
    return await holdContract(row, 'drive_refused', store, nowIso, driveFailWords(reasonOf(e)))
  }
}

/**
 * A voided paper's copy, renamed to start with VOIDED and kept. Only a copy the app made: a file the office placed keeps
 * its name. A copy Drive no longer holds is marked done, since there is nothing left to rename. A Drive refusal leaves
 * the row unmarked, so the next run tries again.
 */
export async function markVoidedCopy(row: ContractDriveRow, drive: FilerDrive, store: FilerStore, now: Date = new Date()): Promise<FileOutcome> {
  const fileId = (row.drive_file_id ?? '').trim()
  if (!isVoided(row) || !fileId || row.drive_file_origin !== 'filed' || row.drive_void_marked_at) return { id: row.id, did: 'nothing' }
  try {
    const name = await drive.fileName(fileId)
    if (name != null && voidedDriveName(name) !== name) await drive.rename(fileId, voidedDriveName(name))
    await store.save(row.id, { drive_void_marked_at: now.toISOString() })
    return { id: row.id, did: 'marked' }
  } catch {
    return { id: row.id, did: 'nothing' }
  }
}
