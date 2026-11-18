/**
 * A certified mail receipt as a file (the owner's yes of 2026-11-17 to the mail proof mock-ups): the press that took a
 * photo alone now takes a photo or a PDF, so a receipt scanned at the office goes up as it is. The press reads **Add
 * the receipt** wherever it stands, and a saved receipt has **Replace** and **Take off**.
 *
 * The second half is the proof kept the moment it is added. *Filed liens: copies to mail* held each photo's link in
 * the window until **Record**, so a window closed first lost the link while the photo stayed in Drive.
 * `lienSendsWithProof` is the merge that write makes: one copy's number and receipt into the filing's `sends`, every
 * other copy and every other key left as they were.
 *
 * Pure: the kinds of file, the one reason a file is refused, the file's name, the merge and every word a person
 * reads. `lienReceiptKeepIo.ts` writes. This file is the client's alone, so `lienServiceProof.ts`, which the edge
 * functions hold a copy of, stays untouched.
 */
import { ADD_FILE_MAX_BYTES, addFileSizeWords, addFileTooBig } from './jobFolderAddFile'
import { LIEN_SCAN_ACCEPT, lienScanExtension, lienScanIsPdf, type LienScanFileLike } from './lienScanFile'
import { parseLienSends, type LienSendLike } from './lienSendTracking'
import { lienReceiptPhotoName, type LienReceiptPaper, type ServiceCopy } from './lienServiceProof'

/** The kinds of file the receipt press takes: a photo or a PDF. One rule with a scan of the paper itself. */
export const LIEN_RECEIPT_ACCEPT = LIEN_SCAN_ACCEPT

/** A PDF goes up as it is. A photo is shrunk on the device first, and its barcode is read for the number. */
export function lienReceiptIsPdf(file: Pick<LienScanFileLike, 'type' | 'name'>): boolean {
  return lienScanIsPdf(file)
}

/** Why a file cannot be a receipt, in sentences, or null when it can. A photo's size is checked after it is shrunk. */
export function lienReceiptProblem(file: LienScanFileLike): string | null {
  const pdf = lienReceiptIsPdf(file)
  if (!pdf && !file.type.startsWith('image/')) return LIEN_RECEIPT_WORDS.notReceipt
  if (file.size <= 0) return LIEN_RECEIPT_WORDS.empty
  if (pdf && addFileTooBig(file.size)) return `That file is ${addFileSizeWords(file.size)}. The most a file can be is ${addFileSizeWords(ADD_FILE_MAX_BYTES)}. Scan this receipt alone, or at a lower quality.`
  return null
}

/**
 * The receipt's name in the job's Drive folder, the one a photo already takes (`lienReceiptPhotoName`): a PDF keeps
 * `pdf`, a shrunk photo is `jpg`, and a photo the browser could not shrink keeps its own extension.
 */
export function lienReceiptFileName(input: { of: ServiceCopy; jobNumber: string; ymd: string; file: Pick<LienScanFileLike, 'type' | 'name'>; shrunk: boolean; paper?: LienReceiptPaper }): string {
  const ext = lienReceiptIsPdf(input.file) ? 'pdf' : input.shrunk ? 'jpg' : lienScanExtension(input.file)
  return lienReceiptPhotoName(input.of, input.jobNumber, input.ymd, ext, input.paper ?? 'affidavit')
}

/** What one copy's proof is changed to. A key left out is left as the filing holds it; `receiptUrl: ''` takes the receipt off. */
export type LienCopyProof = { tracking?: string; receiptUrl?: string }

/**
 * The filing's `sends` with one copy's proof changed. The copy's row keeps its method, its day and whatever a mail
 * provider put on it. A copy with no row gets one, by certified mail, once it has a number or a receipt. A row left
 * with no number, no receipt and no day is dropped, so a receipt taken off an unserved lien leaves the filing as it
 * was. Every other copy's row is untouched.
 */
export function lienSendsWithProof(sends: unknown, recipient: ServiceCopy, proof: LienCopyProof): LienSendLike[] {
  const rows = parseLienSends(sends)
  const at = rows.findIndex((s) => s.recipient === recipient)
  const had = at >= 0 ? rows[at]! : null
  const tracking = proof.tracking === undefined ? (had?.tracking ?? '') : proof.tracking.trim()
  const receiptUrl = proof.receiptUrl === undefined ? (had?.receipt_url ?? '') : proof.receiptUrl.trim()
  const base: LienSendLike = had ? { ...had } : { recipient, method: 'certified_mail', tracking: '' }
  delete base.receipt_url
  const next: LienSendLike = { ...base, tracking, ...(receiptUrl ? { receipt_url: receiptUrl } : {}) }
  const empty = !tracking && !receiptUrl && !(next.sent_on ?? '').trim() && !(next.piece_id ?? '').trim()
  if (!had) return empty ? rows : [...rows, next]
  return empty ? rows.filter((_, i) => i !== at) : rows.map((s, i) => (i === at ? next : s))
}

/** Whether a copy's number or receipt differs from what the filing holds, so a write is owed. */
export function lienCopyProofChanged(sends: unknown, recipient: ServiceCopy, draft: { tracking: string; receiptUrl: string }): boolean {
  const had = parseLienSends(sends).find((s) => s.recipient === recipient)
  return (had?.tracking ?? '').trim() !== draft.tracking.trim() || (had?.receipt_url ?? '').trim() !== draft.receiptUrl.trim()
}

/** The press's words. Each sentence is one idea, as a first-timer reads it. */
export const LIEN_RECEIPT_WORDS = {
  /** The press with no receipt yet, the same on every screen. */
  add: 'Add the receipt',
  /** The press once a receipt is saved. */
  replace: 'Replace',
  saving: 'Saving the receipt…',
  saved: 'Receipt saved',
  open: 'Open',
  takeOff: 'Take off',
  /** The two answers to the ask. The first names the act. */
  takeOffConfirm: 'Take it off',
  keep: 'Keep it',
  takeOffAsk: 'Take this receipt off? The file stays in the job’s Drive folder.',
  /** The phone's sheet: two ways to add one. */
  photo: 'Take a photo',
  photoSub: 'The camera opens. The number is read off the receipt.',
  choose: 'Choose a photo or a PDF',
  chooseSub: 'A picture or a scan already on this phone.',
  notNow: 'Not now',
  where: 'It goes to the job’s Drive folder, under Sent by us.',
  /** Beside the press on a computer. */
  hint: 'A photo or a PDF.',
  pdfNotRead: 'A PDF is not read for its number. Type the number in the box.',
  notReceipt: 'That file is not a receipt. Add a photo or a PDF.',
  empty: 'That file is empty. Scan the receipt again.',
  failed: 'The receipt was not saved.',
  /** *Filed liens: copies to mail*, over the list: what is kept and what Record still does. */
  keptLead: 'Saved as you go.',
  keptRest: 'Each receipt and number is kept on its lien the moment you add it. Record sets the day mailed.',
  /** Under an envelope whose proof is on the filing. */
  kept: 'Kept on this lien.',
  /** Under an envelope whose proof did not reach the filing. Record still writes it. */
  notKept: 'Not kept yet',
} as const

/** Under an envelope whose proof did not reach the filing: the reason, and what still saves it. */
export function lienReceiptNotKeptWords(reason: string): string {
  const why = reason.trim().replace(/[.\s]+$/, '')
  return `${LIEN_RECEIPT_WORDS.notKept}${why ? `: ${why}` : ''}. Record saves it with the day.`
}
