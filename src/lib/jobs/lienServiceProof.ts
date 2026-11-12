/**
 * The proof that a filed lien affidavit's copies were mailed (punch list #314, change 5): a certified mail number and
 * a photo of the receipt for each copy, kept on the filing beside the day served.
 *
 * The office's first signed batch came back with receipts in a folder and nothing in the app that said which receipt
 * was whose. **Record service…** took one thing, the day. Now each copy has a place for its number and its receipt
 * photo, and neither holds the day: the serve-by watch clears on the day alone, as before.
 *
 * The proof rides in `job_lien_filings.sends`, the shape a notice's sends already use, with one more key,
 * `receipt_url`. A copy with no number and no photo writes no row, so a day recorded alone leaves the filing as it
 * was. Pure.
 */
import { LIEN_SEND_RECIPIENT_WORDS, parseLienSends, type LienSendLike } from './lienSendTracking'

/** Who a copy of the filed affidavit goes to (§ 53.055): the owner, and the original contractor when the job has one. */
export type ServiceCopy = 'owner' | 'original_contractor'

/** What the form holds for one copy while it is filled in. */
export type ServiceCopyDraft = { tracking: string; receiptUrl: string }

export const EMPTY_SERVICE_COPY: ServiceCopyDraft = { tracking: '', receiptUrl: '' }

function hasProof(d: ServiceCopyDraft | null | undefined): d is ServiceCopyDraft {
  return !!d && (d.tracking.trim() !== '' || d.receiptUrl.trim() !== '')
}

/**
 * The `sends` to write with the day served. A copy that has a number or a photo gets a row; a copy with neither gets
 * none. The method is certified mail, the only way the help sheet and the form's own label name. `contractor` is null
 * on a job contracted with the owner, which has one copy.
 */
export function serviceSends(input: { servedOn: string; owner: ServiceCopyDraft; contractor: ServiceCopyDraft | null }): LienSendLike[] {
  const day = input.servedOn.trim()
  const row = (recipient: ServiceCopy, d: ServiceCopyDraft): LienSendLike => ({
    recipient,
    method: 'certified_mail',
    tracking: d.tracking.trim(),
    ...(day ? { sent_on: day } : {}),
    ...(d.receiptUrl.trim() ? { receipt_url: d.receiptUrl.trim() } : {}),
  })
  const out: LienSendLike[] = []
  if (hasProof(input.owner)) out.push(row('owner', input.owner))
  if (hasProof(input.contractor)) out.push(row('original_contractor', input.contractor))
  return out
}

/** One copy's saved proof as the form's draft, so the form opens on what the filing already holds. */
export function serviceCopyDraft(sends: unknown, recipient: ServiceCopy): ServiceCopyDraft {
  const s = parseLienSends(sends).find((x) => x.recipient === recipient)
  return s ? { tracking: s.tracking ?? '', receiptUrl: s.receipt_url ?? '' } : { ...EMPTY_SERVICE_COPY }
}

export type ServiceProofLine = { recipient: ServiceCopy; who: string; tracking: string; receiptUrl: string }

/** What the Filings list shows under a served affidavit: each copy that has a number or a photo, the owner first. */
export function serviceProofLines(sends: unknown): ServiceProofLine[] {
  const out: ServiceProofLine[] = []
  for (const recipient of ['owner', 'original_contractor'] as const) {
    const s = parseLienSends(sends).find((x) => x.recipient === recipient)
    if (!s) continue
    const tracking = (s.tracking ?? '').trim()
    const receiptUrl = (s.receipt_url ?? '').trim()
    if (!tracking && !receiptUrl) continue
    out.push({ recipient, who: LIEN_SEND_RECIPIENT_WORDS[recipient] ?? recipient, tracking, receiptUrl })
  }
  return out
}

/** How many copies the job mails, and how many of them still have no number and no photo. */
export function serviceProofMissing(sends: unknown, hasContractor: boolean): number {
  const copies = hasContractor ? 2 : 1
  return Math.max(0, copies - serviceProofLines(sends).filter((l) => l.recipient === 'owner' || hasContractor).length)
}

/** The papers a receipt photo can be of. The clerk's stamped page is the filed affidavit itself, kept as the filing's saved copy. */
export type LienReceiptPhotoOf = ServiceCopy | 'clerk'

const PHOTO_OF: Record<LienReceiptPhotoOf, string> = {
  owner: 'mail receipt, owner',
  original_contractor: 'mail receipt, original contractor',
  clerk: 'the clerk’s stamped page',
}

/**
 * The name the photo takes in the job's Drive folder, under Team only, Sent by us. The day is the one on the form, so
 * the folder sorts the receipts by when the copies went. `ext` is the file's own, `jpg` once the phone has shrunk it.
 */
export function lienReceiptPhotoName(of: LienReceiptPhotoOf, jobNumber: string, ymd: string, ext = 'jpg'): string {
  const job = jobNumber.trim() ? `Job ${jobNumber.trim()}, ` : ''
  const day = ymd.trim() ? `, ${ymd.trim()}` : ''
  const clean = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'
  return `Lien affidavit, ${job}${PHOTO_OF[of]}${day}.${clean}`
}

/** The note the filing's saved copy takes when it is a photo of the clerk's stamped page. */
export const LIEN_CLERK_PAGE_NOTE = 'the clerk’s stamped page'

/** The form's words. Each sentence is one idea, as a first-timer reads it. */
export const LIEN_SERVICE_PROOF_WORDS = {
  ownerCopy: 'Copy to the owner',
  contractorCopy: 'Copy to the original contractor',
  number: 'Certified mail number',
  numberPlaceholder: 'the number on the receipt',
  photo: 'Take a photo of the receipt',
  clerkPhoto: 'Take a photo of the stamped page',
  saving: 'Saving the photo…',
  saved: 'Photo saved',
  again: 'Take it again',
  /** Under the form: what may wait and what may not. */
  hint: 'The number and the photo can wait. Record the day now. Add them later from the Filings list.',
  /** The door on a served affidavit's row. */
  addLater: 'add the mail receipts',
  change: 'mail receipts',
  /** What the photo press says where it lands. */
  where: 'The photo goes to the job’s Drive folder, under Sent by us.',
} as const

/** The toast once the service is saved, by what was typed. */
export function serviceSavedWords(sends: ReadonlyArray<LienSendLike>, hasContractor: boolean): string {
  const missing = serviceProofMissing(sends, hasContractor)
  if (missing === 0) return 'Service recorded with its mail receipts. The serve-by watch is cleared.'
  return 'Service recorded. The serve-by watch is cleared. Add the mail receipts when you have them.'
}

/**
 * Under Record service… on a job whose affidavit is on file while a hold is closed. The hold stops a new paper. It does
 * not stop the record of this one's copies, and the serve-by day is still running.
 */
export function heldServiceWords(serveBy: string): string {
  const by = serveBy.trim()
  return `This affidavit is already on file. Mail its copies${by ? ` by ${by}` : ''} and record the day here. The items above hold a new paper only.`
}
