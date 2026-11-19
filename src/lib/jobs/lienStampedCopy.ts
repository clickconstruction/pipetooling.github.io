/**
 * The stamped copy that goes in a filed lien's envelopes (v2.7916). The owner's ask of 2026-11-19: "I want the
 * uploaded copy of the lien to be a part of the mailing to a customer, because I am required by law to share with them
 * a copy of the lien I filed. Because I have to submit the copy I filed I cannot share with them the redraw from our
 * record." Counsel's suggestion was the same: the mailed copy must be a copy of what was signed and filed.
 *
 * So the copy is the filing's saved copy (`job_lien_filings.document_url`), the clerk's stamped scan in the job's
 * Drive folder, every page of it. Nothing stands in for it: a lien with no saved copy, or with one the app cannot
 * print, is held with its reason and its door, and the rest of the run prints.
 *
 * What this file decides, with no read of its own:
 *  - where a filing's saved copy is (`lienCopySource`): a file in Drive, a link typed by hand, or nothing;
 *  - what kind of file its bytes are, by the bytes themselves and never by a name or a type Drive guessed;
 *  - whether it looks like more than one lien. On 2026-11-18 one filing carried an 18-page stack of eight liens. A
 *    stamped lien is usually two pages: the clerk's cover page and the signed affidavit. A copy past
 *    `LIEN_COPY_ASK_PAGES` pages or `LIEN_COPY_ASK_BYTES` is held until a person has opened it and said it is this
 *    lien alone;
 *  - what the kept print says about itself, so the desk can tell a print of the stamped copy from a print of the old
 *    redrawn page (`lienStampedPrintSnapshot`).
 *
 * `lienStampedCopyIo.ts` reads the bytes and `lienServePdf.ts` puts the pages in the print.
 */
import { driveFileIdOfUrl } from './jobFolderTrash'
import { normalizeDocumentUrl } from './lienFilingDocumentLink'
import type { LienServeHold } from '../jobsDocuments/lienServedCopy'

/** Where a filing's saved copy is. */
export type LienCopySource = { kind: 'drive'; fileId: string; url: string } | { kind: 'not_drive'; url: string } | { kind: 'none' }

/** A filing's saved copy as its `document_url` names it. A note typed in the link's place is no copy. */
export function lienCopySource(documentUrl: string | null | undefined): LienCopySource {
  const url = normalizeDocumentUrl(documentUrl)
  if (!url) return { kind: 'none' }
  const fileId = driveFileIdOfUrl(url)
  return fileId ? { kind: 'drive', fileId, url } : { kind: 'not_drive', url }
}

/** The kinds of file the print can carry: a PDF's own pages, or one picture on a page. */
export type LienCopyKind = 'pdf' | 'jpeg' | 'png'

/** What a file is by its first bytes; null for anything the print cannot carry (a HEIC photo, a Word file, a web page). */
export function lienCopyKind(bytes: Uint8Array): LienCopyKind | null {
  const at = (i: number) => bytes[i] ?? -1
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpeg'
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'png'
  // %PDF, allowed a little in front of it, as readers allow.
  for (let i = 0; i + 3 < bytes.length && i < 1024; i += 1) {
    if (at(i) === 0x25 && at(i + 1) === 0x50 && at(i + 2) === 0x44 && at(i + 3) === 0x46) return 'pdf'
  }
  return null
}

/** A saved copy as read: what it is, how many pages, how big, and its SHA-256 for the kept print's record. */
export type LienCopyFile = { kind: LienCopyKind; pages: number; bytes: number; sha256: string }

/** The pages a stamped lien usually has: the clerk's cover page and the signed affidavit. */
export const LIEN_COPY_USUAL_PAGES = 2
/** Past this many pages a saved copy is asked about. Three allows a second page of the affidavit; four is two liens. */
export const LIEN_COPY_ASK_PAGES = 3
/** Past this size a saved copy is asked about. The clerk's scans of 2026-11-16 were under half a megabyte each. */
export const LIEN_COPY_ASK_BYTES = 4 * 1024 * 1024

/** "6.2 MB", "480 KB". */
export function lienCopySizeWords(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** "2 pages", "1 page". */
export function lienCopyPagesWords(pages: number): string {
  return pages === 1 ? '1 page' : `${pages} pages`
}

/** What a card says of a copy that is read and ready: *Stamped copy: 2 pages.* */
export function lienCopyReadyWords(file: Pick<LienCopyFile, 'pages'>): string {
  return `Stamped copy: ${lienCopyPagesWords(file.pages)}.`
}

/** Why a saved copy looks like more than one lien, as the hold's words; '' when it does not. */
export function lienCopyDoubt(file: Pick<LienCopyFile, 'pages' | 'bytes'>): string {
  if (file.pages > LIEN_COPY_ASK_PAGES) return `the saved copy has ${file.pages} pages, and a stamped lien is usually ${LIEN_COPY_USUAL_PAGES}`
  if (file.bytes > LIEN_COPY_ASK_BYTES) return `the saved copy is ${lienCopySizeWords(file.bytes)}, several times a usual scan`
  return ''
}

export const LIEN_COPY_WORDS = {
  /** The press that lifts a `copy_several` hold, on the reader's word. */
  anyway: 'It is this lien alone. Print it',
  /** The door to the saved copy itself. */
  open: 'Open the saved copy ›',
  reading: 'Reading the stamped copy…',
  /** The fallback reason when the read failed and gave none. */
  unreadFallback: 'the file did not come through',
} as const

/** The hold for a copy that may be more than one lien. The reader lifts it after looking. */
export function lienCopySeveralHold(doubt: string): LienServeHold {
  return { key: 'copy_several', words: doubt, act: 'Open it and look. If it holds other liens, put this lien’s own scan in its place on the job’s Lien window.', door: 'scan', ask: true }
}

/** The hold for a saved copy the app could not read, with the reason the door gave. */
export function lienCopyUnreadableHold(reason: string): LienServeHold {
  const why = reason.trim().replace(/[.\s]+$/, '') || LIEN_COPY_WORDS.unreadFallback
  return { key: 'copy_unreadable', words: `the app could not read the saved copy: ${why}`, act: 'Check the saved copy on the job’s Lien window. Then open this window again.', door: 'scan' }
}

/** The hold for a saved copy that is not a PDF, a JPEG or a PNG. */
export const LIEN_COPY_NOT_PRINTABLE_HOLD: LienServeHold = { key: 'copy_not_printable', words: 'the saved copy is not a PDF, a JPEG or a PNG', act: 'Save the stamped scan as a PDF and put it in its place on the job’s Lien window.', door: 'scan' }

/** The hold for a PDF that does not open: damaged, or locked with a password. */
export const LIEN_COPY_BROKEN_HOLD: LienServeHold = { key: 'copy_broken', words: 'the saved copy is a PDF the app cannot open', act: 'Scan the stamped affidavit again and put it in its place on the job’s Lien window.', door: 'scan' }

/** One filing's saved copy as the window holds it: still being read, read, or held with its reason. */
export type LienCopyRead = { state: 'reading' } | { state: 'ok'; file: LienCopyFile } | { state: 'held'; hold: LienServeHold }

/**
 * What a print's row says about itself (`sent_documents.source_snapshot`): that the copy in the envelope was the
 * stamped scan, which file it was and its SHA-256, so what is filed on the job can be checked against the file in
 * Drive. A print made before v2.7916 has no such note: it is the redrawn page.
 */
export type LienStampedPrintSnapshot = { copy: 'stamped'; drive_file_id: string; scan_sha256: string; scan_pages: number; scan_bytes: number; envelopes: number; letter: boolean }

export function lienStampedPrintSnapshot(input: { fileId: string; file: LienCopyFile; envelopes: number; letter: boolean }): LienStampedPrintSnapshot {
  return { copy: 'stamped', drive_file_id: input.fileId, scan_sha256: input.file.sha256, scan_pages: input.file.pages, scan_bytes: input.file.bytes, envelopes: input.envelopes, letter: input.letter }
}

/** Whether a print's row is a print of the stamped copy. */
export function isStampedPrintSnapshot(snapshot: unknown): boolean {
  return !!snapshot && typeof snapshot === 'object' && (snapshot as { copy?: unknown }).copy === 'stamped'
}

/** The kept print's file name: *copy-of-lien-affidavit-job-2291.pdf*. */
export function lienStampedPrintFileName(jobNumber: string): string {
  const n = jobNumber.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return n ? `copy-of-lien-affidavit-job-${n}.pdf` : 'copy-of-lien-affidavit.pdf'
}
