/**
 * What goes in the envelope after a lien affidavit is filed (punch list #366): the copy of the affidavit that
 * Tex. Prop. Code § 53.055 has the claimant send to the owner or reputed owner, and to the original contractor when
 * the claimant is not one, by the fifth day after the filing. In front of it, a short cover letter.
 *
 * The copy is the clerk's stamped scan, the filing's saved copy, every page of it (the owner's ask of 2026-11-19: "I
 * am required by law to share with them a copy of the lien I filed. Because I have to submit the copy I filed I cannot
 * share with them the redraw from our record"; counsel's suggestion was the same, a copy of what was signed and
 * filed). Until v2.7916 the app drew the copy from the filing's stored fields, marked COPY, with no signature, seal or
 * stamp. That page is gone and nothing draws it. `lienStampedCopy.ts` holds the rules a saved copy is read by.
 *
 * Two rules the words keep. The letter is a courtesy and never stands in for the copy, so an envelope always carries
 * the copy and the letter can be left out. And the letter says only what is true of the filing: the county, the day,
 * the document number, the amount, and how to pay and get a release. It makes no threat and gives no advice. It says
 * *affidavit claiming a lien* and never *a lien*, the statute's own phrase, so the same words are true on a homestead.
 *
 * Pure. Every sentence a reader outside the company sees is in this file, one sentence per fact.
 */
import type { ServiceCopy } from '../jobs/lienServiceProof'
import { demandDate, demandMoney } from './demandLetter'
import type { FilingDocBlock, FilingDocExtras, LienAffidavitFields } from './lienFilingDocuments'

/** Counsel has not read the cover letter's words. The press stays live; the screen says so (the owner's pick, 2026-11-16). */
export const LIEN_SERVE_LETTER_READ_BY_COUNSEL = false

/** A reader's name and address as the office holds them today. Blank parts fall back to the affidavit's own. */
export type LienServeParty = { name: string; address: string }

/** The filed affidavit as the copy and its letter need it. */
export type LienServeFacts = {
  /** The affidavit's fields as the filing keeps them. */
  fields: LienAffidavitFields
  /** The job is under an original contractor, so a second copy goes to it. False is a job contracted with the owner. */
  isSub: boolean
  /** The county whose clerk took the filing; the affidavit's own county when the record names none. */
  county: string
  recordingNumber: string
  /** YYYY-MM-DD */
  filedYmd: string
  /** The day on the letter, YYYY-MM-DD. */
  letterYmd: string
  /** The number an owner calls to pay or ask. Blank leaves the call line off. */
  phone: string
  /**
   * Where each envelope goes today: the property record's owner and the GC's customer record. § 53.055 sends the
   * copy to the last known address, which is the office's newest one, not the one typed on the paper weeks ago. The
   * copy itself never reads these: it is the paper as filed.
   */
  to?: { owner?: LienServeParty | null; contractor?: LienServeParty | null }
}

export type LienServeRecipient = { recipient: ServiceCopy; name: string; address: string }

const pick = (now: string | undefined, filed: string) => (now ?? '').trim() || filed.trim()

/** Who a copy goes to: the owner, then the original contractor on a job that has one. Today's name and address first, the paper's own when the office holds none. */
export function lienServeRecipients(f: Pick<LienServeFacts, 'fields' | 'isSub' | 'to'>): LienServeRecipient[] {
  const out: LienServeRecipient[] = [{ recipient: 'owner', name: pick(f.to?.owner?.name, f.fields.ownerName), address: pick(f.to?.owner?.address, f.fields.ownerAddress) }]
  if (f.isSub) out.push({ recipient: 'original_contractor', name: pick(f.to?.contractor?.name, f.fields.originalContractorName), address: pick(f.to?.contractor?.address, f.fields.originalContractorAddress) })
  return out
}

/**
 * What stops a filing's copies from printing, and the door that fixes it: `filing` is typed on the filing's own row,
 * `scan` is the stamped copy on the job's Lien window, `property` the property record, `contractor` the GC's customer
 * record. The `copy_` holds are found when the saved copy is read (`lienStampedCopy.ts`); the rest are read off the
 * rows. `ask` marks a hold the reader can lift on their own word: a copy that looks like more than one lien.
 */
export type LienServeHoldKey = 'no_recording_number' | 'no_saved_copy' | 'copy_not_drive' | 'copy_unreadable' | 'copy_not_printable' | 'copy_broken' | 'copy_several' | 'no_owner_address' | 'no_contractor' | 'no_contractor_address'
export type LienServeHold = { key: LienServeHoldKey; words: string; act: string; door: 'filing' | 'scan' | 'property' | 'contractor'; ask?: boolean }

type RowHoldKey = 'no_recording_number' | 'no_saved_copy' | 'copy_not_drive' | 'no_owner_address' | 'no_contractor' | 'no_contractor_address'

const HOLD: Record<RowHoldKey, Omit<LienServeHold, 'key'>> = {
  no_recording_number: { words: 'no recording number yet', act: 'Type the number the clerk gave.', door: 'filing' },
  no_saved_copy: { words: 'no stamped copy saved', act: 'Add the clerk’s stamped scan on the job’s Lien window.', door: 'scan' },
  copy_not_drive: { words: 'the saved copy is a link the app cannot read', act: 'Upload the stamped scan itself on the job’s Lien window.', door: 'scan' },
  no_owner_address: { words: 'no mailing address for the owner', act: 'Add it on the property record.', door: 'property' },
  no_contractor: { words: 'no original contractor named', act: 'Add the GC on the job.', door: 'contractor' },
  no_contractor_address: { words: 'no mailing address for the original contractor', act: 'Add it on the GC’s customer record.', door: 'contractor' },
}

/**
 * Whether the filing keeps the affidavit's words, which the cover letter states: the owner, the property and the
 * amount. A filing recorded with *Already filed — record it…*, or filed by counsel, may keep none. Its stamped copy
 * still prints, with no letter in front: the letter never says what the record does not hold.
 */
export function lienServeLetterDrawable(fields: Pick<LienAffidavitFields, 'ownerName' | 'propertyAddress' | 'unpaidAmount'>): boolean {
  return Boolean(fields.ownerName.trim() && fields.propertyAddress.trim() && fields.unpaidAmount.trim())
}

/**
 * Every reason the rows give that a filing's copies cannot print yet, the filing's own first. Empty when they can. A
 * filing with no recording number is held (the owner's pick): its letter names the number. A filing with no saved
 * copy, or with a saved copy that is a typed link and not a file in Drive, is held too: the copy is the stamped scan
 * and nothing stands in for it. `savedCopy` is the reading of the filing's `document_url` (`lienCopySource`).
 */
export function lienServeHolds(f: Pick<LienServeFacts, 'fields' | 'isSub' | 'recordingNumber' | 'to'>, savedCopy: 'drive' | 'none' | 'not_drive'): LienServeHold[] {
  const keys: RowHoldKey[] = []
  if (!f.recordingNumber.trim()) keys.push('no_recording_number')
  if (savedCopy === 'none') keys.push('no_saved_copy')
  if (savedCopy === 'not_drive') keys.push('copy_not_drive')
  for (const r of lienServeRecipients(f)) {
    if (r.recipient === 'owner' && !r.address) keys.push('no_owner_address')
    if (r.recipient === 'original_contractor' && !r.name) keys.push('no_contractor')
    else if (r.recipient === 'original_contractor' && !r.address) keys.push('no_contractor_address')
  }
  return keys.map((key) => ({ key, ...HOLD[key] }))
}

/** The holds as one line under a dead press: "Held: no recording number yet, no mailing address for the owner." */
export function lienServeHoldWords(holds: ReadonlyArray<LienServeHold>): string {
  return holds.length === 0 ? '' : `Held: ${holds.map((h) => h.words).join(', ')}.`
}

/** What to do about them, each said once, in the holds' order. */
export function lienServeHoldActs(holds: ReadonlyArray<LienServeHold>): string {
  return [...new Set(holds.map((h) => h.act))].join(' ')
}

const sameParty = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** A line-start phrase as a sentence carries it; an acronym keeps its capitals (HVAC). */
function midSentence(s: string): string {
  const t = s.trim()
  const first = t.split(/\s+/)[0] ?? ''
  return /^[A-Z0-9&/]{2,}$/.test(first) ? t : t.charAt(0).toLowerCase() + t.slice(1)
}

/** "Hays" from "Hays", "Hays County" or " hays county ". */
function countyName(f: Pick<LienServeFacts, 'county' | 'fields'>): string {
  return (f.county.trim() || f.fields.county.trim()).replace(/\s+county$/i, '')
}

/** Where and when the affidavit was filed: "November 13, 2026, County Clerk of Hays County, Texas". */
export function lienServeFiledWords(f: Pick<LienServeFacts, 'county' | 'fields' | 'filedYmd'>): string {
  return `${demandDate(f.filedYmd)}, County Clerk of ${countyName(f) || '_______'} County, Texas`
}

/** Whose contract the work was under, as this reader is told it. */
function contractWords(f: LienServeFacts, to: ServiceCopy): string {
  const company = f.fields.claimantCompany.trim() || 'the claimant'
  const original = f.fields.originalContractorName.trim()
  const hirer = f.fields.contractedWithName.trim()
  if (!f.isSub) return `under ${company}'s contract with you`
  const underOriginal = !hirer || sameParty(hirer, original)
  if (to === 'original_contractor') return underOriginal ? `under ${company}'s contract with you` : `under a contract with ${hirer}`
  return underOriginal ? `under a contract with ${original}, the original contractor` : `under a contract with ${hirer}. The original contractor is ${original}`
}

/** The letter's three paragraphs for one reader. Kept apart so a test, the sample page and counsel read the same words. */
export function lienServeLetterParagraphs(f: LienServeFacts, to: ServiceCopy): string[] {
  const company = f.fields.claimantCompany.trim() || 'The claimant'
  const claim = demandMoney(f.fields.unpaidAmount)
  const work = midSentence(f.fields.workDescription) || 'labor and materials'
  const as = to === 'owner' ? 'the owner or reputed owner of the property' : 'the original contractor'
  const phone = f.phone.trim()
  return [
    `${company} has filed an affidavit claiming a lien on the property named above. A copy of the affidavit is enclosed. It is sent to you as ${as}, as Texas Property Code § 53.055 requires.`,
    `The affidavit states a claim of ${claim} for ${work} furnished to improve the property ${contractWords(f, to)}.`,
    `When the claim is paid, ${company} will sign a release of the claim and of the lien in a form that can be filed with the county clerk.${phone ? ` To pay, or to ask about the amount, call ${phone}.` : ''}`,
  ]
}

export const LIEN_SERVE_LETTER_TITLE = ['Copy of lien affidavit', 'Texas Property Code § 53.055'] as const
export const LIEN_SERVE_LETTER_ENCLOSED = 'Enclosed: a copy of the lien affidavit.'
/** How the envelope goes, on the strip under the letterhead. The help sheet and Enter mail numbers… name no other way. */
export const LIEN_SERVE_LETTER_METHOD = 'By certified mail'

/** The cover letter to one reader: the letterhead, the day, who it is to, the filing's facts, three paragraphs, the signature. */
export function buildLienServeLetterBlocks(f: LienServeFacts, to: ServiceCopy, extras?: Pick<FilingDocExtras, 'letterhead'>): FilingDocBlock[] {
  const who = lienServeRecipients(f).find((r) => r.recipient === to) ?? { recipient: to, name: '', address: '' }
  const blocks: FilingDocBlock[] = []
  if (extras?.letterhead && extras.letterhead.company.trim()) blocks.push({ kind: 'letterhead', ...extras.letterhead })
  blocks.push({ kind: 'refstrip', items: [demandDate(f.letterYmd), LIEN_SERVE_LETTER_METHOD] })
  blocks.push({ kind: 'title', lines: [...LIEN_SERVE_LETTER_TITLE] })
  blocks.push({ kind: 'formLine', label: to === 'owner' ? 'To the owner or reputed owner' : 'To the original contractor', value: who.name })
  blocks.push({ kind: 'formLine', label: 'Address', value: who.address })
  blocks.push({ kind: 'formLine', label: 'Property', value: f.fields.propertyAddress.trim() })
  blocks.push({ kind: 'formLine', label: 'Filed', value: lienServeFiledWords(f) })
  blocks.push({ kind: 'formLine', label: 'Document number', value: f.recordingNumber.trim() })
  blocks.push({ kind: 'formLine', label: 'Amount of the claim', value: demandMoney(f.fields.unpaidAmount) })
  for (const text of lienServeLetterParagraphs(f, to)) blocks.push({ kind: 'paragraph', text })
  blocks.push({ kind: 'signature', lines: [f.fields.claimantPersonName.trim(), f.fields.claimantCompany.trim()].filter((l) => l) })
  blocks.push({ kind: 'paragraph', text: LIEN_SERVE_LETTER_ENCLOSED })
  return blocks
}

export type LienServeLetter = { recipient: ServiceCopy; label: string; blocks: FilingDocBlock[] }

const TO_WORDS: Record<ServiceCopy, string> = { owner: 'the owner', original_contractor: 'the original contractor' }

/**
 * One filing's cover letters, one for each reader in envelope order. Empty when the letter is not wanted, or when the
 * filing does not keep the words a letter states (`lienServeLetterDrawable`). The copy behind each letter is the
 * stamped scan and is not drawn here.
 */
export function lienServeLetters(f: LienServeFacts, opts: { letter: boolean; letterhead?: FilingDocExtras['letterhead'] }): LienServeLetter[] {
  if (!opts.letter || !lienServeLetterDrawable(f.fields)) return []
  return lienServeRecipients(f).map((r) => ({ recipient: r.recipient, label: `Letter to ${TO_WORDS[r.recipient]}`, blocks: buildLienServeLetterBlocks(f, r.recipient, { letterhead: opts.letterhead }) }))
}

/**
 * The kind a printed packet is filed under on the job (`docs/SENT_COPIES.md`). Never changes once rows exist. A print
 * made before v2.7916 is the redrawn page, kept as HTML. A print of the stamped copy is a PDF whose row says so
 * (`lienStampedPrintSnapshot`).
 */
export const LIEN_SERVED_COPY_SENT_KIND = 'lien_affidavit_copy'

export function lienServedCopySentTitle(jobNumber: string): string {
  const n = jobNumber.trim()
  return n ? `Copy of lien affidavit — Job ${n}` : 'Copy of lien affidavit'
}

/** The press and the words around it, in the Lien window and on the desk. */
export const LIEN_SERVE_WORDS = {
  press: 'Print the copies to mail',
  letterBox: 'Print the cover letter in front of each copy',
  letterUnread: 'Counsel has not read this letter yet.',
  /** Under the press: what the copy is. */
  copyIs: 'The copy in each envelope is the clerk’s stamped scan, every page of it.',
  /** A lien whose record keeps none of the affidavit's words. */
  noLetter: 'No cover letter for this lien. The app holds no record of the affidavit’s words.',
  /** Where the print goes. */
  opens: 'The print opens as one PDF in a new tab.',
  numberLabel: 'Recording number',
  numberSave: 'Save the number',
  /** Under the press: how many envelopes, and what to do next. */
  then: 'Mail each envelope by certified mail. Then press Enter mail numbers… and type each number.',
} as const

/** "Two envelopes: the owner and the original contractor." */
export function lienServeEnvelopeWords(f: Pick<LienServeFacts, 'isSub'>): string {
  return f.isSub ? 'Two envelopes: the owner and the original contractor.' : 'One envelope: the owner.'
}
